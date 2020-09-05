export class EmailAddress {
  public free(): void;

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
  public static parse(input: string, options?: ParsingOptions): EmailAddress | undefined;

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

  public static isValid(input: string, options?: ParsingOptions): boolean;

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
  public constructor(local_part: string, domain: string, options?: ParsingOptions);

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
  public get localPart(): string;

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
  public get domain(): string;
}

/**
 * Options for parsing.
 */
export class ParsingOptions {
  public free(): void;
  /**
   * Instantiates `ParsingOptions`.
   * @param {boolean} is_lax Can be set to`true` or `false` to  enable/disable obsolete parts parsing.
   */
  public constructor(is_lax: boolean);
  /**
   * Returns the is_lax option set during instantiation.
   */
  public readonly is_lax: boolean;
}
