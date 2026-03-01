import { isValidEmail, parseEmail } from "./email-regex.js";

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
