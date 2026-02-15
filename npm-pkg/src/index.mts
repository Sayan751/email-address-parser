import { parse } from "./generated/rfc5322.parser.mjs";

/**
 * Options for parsing.
 */
export class ParsingOptions {
  /**
   * Instantiates `ParsingOptions`.
   * @param {boolean} is_lax Can be set to`true` or `false` to  enable/disable obsolete parts parsing.
   */
  public constructor(public readonly is_lax: boolean) { }
}

export class EmailAddress {
  private readonly _localPart: string;
  private readonly _domain: string;

  private static fromParsed(localPart: string, domain: string): EmailAddress {
    const instance = Object.create(EmailAddress.prototype) as EmailAddress;
    (instance as any)._localPart = localPart;
    (instance as any)._domain = domain;
    return instance;
  }

  /**
   * Instantiates a new `EmailAddress`.
   * It throws error if either the local part or domain is invalid and cannot be parsed.
   *
   * @param {ParsingOptions} [options] When not provided, the default options is used. That comprised of strict parsing; i.e. obsolete parts as defined by RFC5322 are not allowed.
   * @example
   * ```ts
   * const email = new EmailAddress("foo", "bar.com");
   * ```
   */
  public constructor(
    local_part: string,
    domain: string,
    options?: ParsingOptions
  ) {
    const normalizedOptions = options ?? new ParsingOptions(false);
    const created = EmailAddress.parse(
      `${local_part}@${domain}`,
      normalizedOptions
    );
    if (created) {
      this._localPart = created.localPart;
      this._domain = created.domain;
      return;
    }

    if (normalizedOptions.is_lax) {
      this._localPart = local_part;
      this._domain = domain;
      return;
    }

    throw new Error(`Invalid local part '${local_part}'.`);
  }

  /**
   * Parses a given string as an email address.
   * @param {string} input The input to parse.
   * @param {ParsingOptions} [options] When not provided, the default options is used. That comprised of strict parsing; i.e. obsolete parts as defined by RFC5322 are not allowed.
   * @returns {(EmailAddress | undefined)} An instance `EmailAddress` if the input is valid, else `undefined`.
   *
   * @example
   * ```ts
   * // valid address
   * const email = EmailAddress.parse(`foo@bar.com`);
   * assert(email.getLocalPart() === "foo");
   * assert(email.getDomain() === "bar.com");
   *
   * // invalid address
   * assert(EmailAddress.parse(`foo@-bar.com`, new ParsingOptions(true)) === undefined);
   * ```
   */
  public static parse(
    input: string,
    options?: ParsingOptions
  ): EmailAddress | undefined {
    const useLax = options?.is_lax === true;
    try {
      const startRule = useLax ? "address_single_obs" : "address_single";
      const result = parse(input, { startRule });
      return EmailAddress.fromParsed(result.local_part, result.domain);
    } catch (_error) {
      return undefined;
    }
  }

  /**
   * Validates if the given `input` string is an email address or not.
   * Unlike the `parse` method, it does not instantiate an `EmailAddress`.
   * @param {string} input The string to validate.
   * @param {ParsingOptions} [options] When not provided, the default options is used. That comprised of strict parsing; i.e. obsolete parts as defined by RFC5322 are not allowed.
   * @returns {boolean} `true` if the `input` is valid, `false` otherwise.
   * @example
   * ```ts
   * assert(EmailAddress.isValid(`foo@bar.com`));
   * assert(!EmailAddress.isValid(`foo@-bar.com`, new ParsingOptions(true)));
   * ```
   */
  public static isValid(input: string, options?: ParsingOptions): boolean {
    return EmailAddress.parse(input, options) !== undefined;
  }

  /**
   * @returns {string} The local part of the email address.
   * @example
   * ```
   * let email = new EmailAddress("foo", "bar.com");
   * assert(email.localPart === "foo");
   *
   * email = EmailAddress.parse(`foo@bar.com`);
   * assert(email.localPart === "foo");
   * ```
   */
  public get localPart(): string {
    return this._localPart;
  }

  /**
   * @returns {string} The domain of the email address.
   * @example
   * ```  *
   * let email = new EmailAddress("foo", "bar.com");
   * assert(email.domain === "bar.com");
   *
   * email = EmailAddress.parse(`foo@bar.com`);
   * assert(email.domain === "bar.com");
   * ```
   */
  public get domain(): string {
    return this._domain;
  }

  public toString(): string {
    return `${this._localPart}@${this._domain}`;
  }
}

export default {
  EmailAddress,
  ParsingOptions,
};
