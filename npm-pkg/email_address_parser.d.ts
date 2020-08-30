export class EmailAddress {
  free(): void;
  /**
   * Instantiates a new `EmailAddress`.
   * 
   * @example
   * ```ts
   * const email = EmailAddress.new("foo", "bar.com");
   * ```
   */
  static new(local_part: string, domain: string): EmailAddress;

  /**
   * Parses a given string as an email address.
   * @param {string} input The input to parse.
   * @param {boolean | undefined} is_strict  Use `true` to enable strict parsing.
   * @returns {EmailAddress | undefined} An instance `EmailAddress` if the input is valid, else `undefined`.
   * 
   * @example
   * ```ts
   * const email = EmailAddress.parse(`foo@bar.com`, true);
   * assert(email.local_part() === "foo");
   * assert(email.domain() === "bar.com");
   * 
   * assert(EmailAddress.parse(`foo@-bar.com`) === undefined);
   * ```
   */
  static parse(input: string, is_strict?: boolean): EmailAddress | undefined;
  /**
   * @returns {string} The local part of the email address.
   * @example
   * ```
   * let email = EmailAddress.new("foo", "bar.com");
   * assert(email.local_part() === "foo");
   * 
   * email = EmailAddress.parse(`foo@bar.com`, true);
   * assert(email.local_part() === "foo");
   * ```
   */
  local_part(): string;
  /**
   * @returns {string} The domain of the email address.
   * @example
   * ```  * 
   * let email = EmailAddress.new("foo", "bar.com");
   * assert(email.domain() === "bar.com");
   * 
   * email = EmailAddress.parse(`foo@bar.com`, true);
   * assert(email.domain() === "bar.com");
   * ```
   */
  domain(): string;
}
