const WSP = "[ \\t]";
const OBS_NO_WS_CTL = "[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]";
const NON_ASCII = "\\P{ASCII}";

const ATEXT_ASCII = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]";
const ATEXT_NO_DASH_ASCII = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~]";

const ATEXT_CHAR = `(?:${ATEXT_ASCII}|${NON_ASCII})`;
const ATEXT_NO_DASH_CHAR = `(?:${ATEXT_NO_DASH_ASCII}|${NON_ASCII})`;

const QTEXT_CHAR = `(?:[\\x21\\x23-\\x5B\\x5D-\\x7E]|${NON_ASCII}|${OBS_NO_WS_CTL})`;
const DTEXT_CHAR = `(?:[\\x21-\\x5A\\x5E-\\x7E]|${NON_ASCII}|${OBS_NO_WS_CTL})`;
const CTEXT_CHAR = `(?:[\\x21-\\x27\\x2A-\\x5B\\x5D-\\x7E]|${NON_ASCII}|${OBS_NO_WS_CTL})`;

// Rust parser allows any ASCII octet after "\" for quoted-pair.
const QUOTED_PAIR = "\\\\[\\x00-\\x7F]";

// Mirrors parser fws(): WSP+ or WSP* CRLF WSP+, optionally repeated with CRLF WSP+.
const FWS = `(?:${WSP}+|${WSP}*\\r\\n${WSP}+)(?:\\r\\n${WSP}+)*`;
const COMMENT = `\\((?:(?:${FWS})?(?:${CTEXT_CHAR}|${QUOTED_PAIR}|\\((?:${CTEXT_CHAR}|${QUOTED_PAIR})*\\)))*(?:${FWS})?\\)`;
const CFWS = `(?:${FWS}|(?:(?:(?:${FWS})?${COMMENT})+(?:${FWS})?))`;

const DOT_ATOM_LABEL = `${ATEXT_NO_DASH_CHAR}(?:${ATEXT_CHAR}*${ATEXT_NO_DASH_CHAR})?`;
const DOT_ATOM_TEXT = `${DOT_ATOM_LABEL}(?:\\.${DOT_ATOM_LABEL})*`;

// Rust strict parser consumes at most one WSP char around dot-atom.
const DOT_ATOM = `${WSP}?${DOT_ATOM_TEXT}${WSP}?`;

const QCONTENT = `(?:${QTEXT_CHAR}|${QUOTED_PAIR})`;
const QUOTED_STRING_CORE = `"(?:(?:${FWS})?${QCONTENT})*(?:${FWS})?"`;
const QUOTED_STRING = `(?:${CFWS})?${QUOTED_STRING_CORE}(?:${CFWS})?`;

const DCONTENT = `(?:${DTEXT_CHAR}|${QUOTED_PAIR})`;
const DOMAIN_LITERAL_CORE = `\\[(?:(?:${FWS})?${DCONTENT})*(?:${FWS})?\\]`;
const DOMAIN_LITERAL = `(?:${CFWS})?${DOMAIN_LITERAL_CORE}(?:${CFWS})?`;

const LOCAL_PART_STRICT = `(?:${DOT_ATOM}|${QUOTED_STRING})`;
const DOMAIN_STRICT = `(?:${DOT_ATOM}|${DOMAIN_LITERAL})`;
const EMAIL_STRICT = `^${LOCAL_PART_STRICT}@${DOMAIN_STRICT}$`;

const ATOM = `(?:${CFWS})?${ATEXT_CHAR}+(?:${CFWS})?`;
const WORD = `(?:${ATOM}|${QUOTED_STRING})`;
const OBS_LOCAL_PART = `(?:${FWS})*${WORD}(?:(?:${CFWS})*\\.(?:${CFWS})*${WORD})*`;

const OBS_DOMAIN_LABEL = `${ATEXT_NO_DASH_CHAR}+`;
const OBS_DOMAIN = `(?:` +
  `(?:${CFWS})*${OBS_DOMAIN_LABEL}(?:(?:${CFWS})*(?:\\.|-+)(?:${CFWS})*${OBS_DOMAIN_LABEL})*(?:${FWS})*` +
  `|${DOMAIN_LITERAL}` +
  `)`;
const EMAIL_LAX = `^${OBS_LOCAL_PART}@${OBS_DOMAIN}$`;

export const EMAIL_REGEX_STRICT = new RegExp(EMAIL_STRICT, "u");
export const EMAIL_REGEX_LAX = new RegExp(EMAIL_LAX, "u");
export const LOCAL_PART_REGEX_STRICT = new RegExp(`^${LOCAL_PART_STRICT}$`, "u");
export const LOCAL_PART_REGEX_LAX = new RegExp(`^${OBS_LOCAL_PART}$`, "u");
export const DOMAIN_REGEX_STRICT = new RegExp(`^${DOMAIN_STRICT}$`, "u");
export const DOMAIN_REGEX_LAX = new RegExp(`^${OBS_DOMAIN}$`, "u");

export function isValidEmail(email: string, isLax: boolean = false): boolean {
  return (isLax ? EMAIL_REGEX_LAX : EMAIL_REGEX_STRICT).test(email);
}

export function parseEmail(
  email: string,
  isLax: boolean = false
): { localPart: string; domain: string } | null {
  if (!(isLax ? EMAIL_REGEX_LAX : EMAIL_REGEX_STRICT).test(email)) {
    return null;
  }

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return null;
  }

  return {
    localPart: email.slice(0, atIndex),
    domain: email.slice(atIndex + 1),
  };
}

export class ParsingOptions {
  public readonly is_lax: boolean;

  public constructor(is_lax: boolean) {
    this.is_lax = is_lax;
  }
}

export class EmailAddress {
  private readonly _localPart: string;
  private readonly _domain: string;

  public constructor(local_part: string, domain: string, options?: ParsingOptions) {
    const isLax = options?.is_lax ?? false;
    if (!isLax && !isValidEmail(`${local_part}@${domain}`, false)) {
      throw new Error(`Invalid local part '${local_part}'.`);
    }

    this._localPart = local_part;
    this._domain = domain;
  }

  public static parse(input: string, options?: ParsingOptions): EmailAddress | undefined {
    const isLax = options?.is_lax ?? false;
    const parsed = parseEmail(input, isLax);
    if (!parsed) {
      return undefined;
    }

    return new EmailAddress(parsed.localPart, parsed.domain, options);
  }

  public static isValid(input: string, options?: ParsingOptions): boolean {
    return isValidEmail(input, options?.is_lax ?? false);
  }

  public get localPart(): string {
    return this._localPart;
  }

  public get domain(): string {
    return this._domain;
  }

  public toString(): string {
    return `${this._localPart}@${this._domain}`;
  }

  // Kept for API compatibility with WASM wrapper.
  public free(): void {}
}
