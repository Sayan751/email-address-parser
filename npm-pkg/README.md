# email-address-parser

This is a WASM wrapper over the rust crate [email-address-parser](https://crates.io/crates/email-address-parser) which provides an [RFC 5322](https://tools.ietf.org/html/rfc5322), and [RFC 6532](https://tools.ietf.org/html/rfc6532) compliant implementation of email address parser.
The code for this npm package is generated with with [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen).

## Install

```shell
npm i @sparser/email-address-parser
```

## Usage

### Node.js

```js
import("@sp/email-address-parser")
  .then((parser) => {
    const { EmailAddress, ParsingOptions } = parser.default;

    // pares valid address
    const email = EmailAddress.parse("foo@bar.com");
    // get local part and domain
    console.log(`local part: ${email.localPart}, domain: ${email.domain}`); // local part: foo, domain: bar.com

    // invalid address
    console.log(EmailAddress.parse("foo@-bar.com", new ParsingOptions(true))); // undefined
  })
  .catch((reason) => {
    console.error(reason);
  });
```

### In webapp with bundler (like webpack)

```js
// @ts-check
import("@sp/email-address-parser")
  .then(({ EmailAddress, ParsingOptions }) => {
    // pares valid address
    const email = EmailAddress.parse("foo@bar.com");
    // get local part and domain
    console.log(`local part: ${email.localPart}, domain: ${email.domain}`);  // local part: foo, domain: bar.com

    // invalid address
    console.log(EmailAddress.parse("foo@-bar.com", new ParsingOptions(true))); // undefined
});

```

## API

The `EmailAddress` class encapsulates the validation and parsing part.
Optionally an instance of `ParsingOptions` can be used to affect the strictness of the parsing.

### `ParsingOptions`

An instance of this class can be used affect the strictness of the parsing.

#### Strict parsing

```ts
// strict parsing options
const options = new ParsingOptions(false); // ParsingOptions { is_lax: false }
```

With strict parsing, the [obsolete production rules](https://tools.ietf.org/html/rfc5322#section-4) as outlined in RFC 5322, are disallowed.
Strict parsing is the default setting; i.e. while [parsing](#parse) or [validating](#isvalid) and email address, no parsing options needs to be explicitly supplied.

#### Lax parsing

```ts
// lax parsing options
const options = new ParsingOptions(true); // ParsingOptions { is_lax: true }
```

If the input contains obsolete local part or domain, then an instance of the options object needs to be used explicitly.

### `EmailAddress`

This is responsible for validating and parsing email addresses.

#### `parse`

Parses a given string as an email address, and returns an instance `EmailAddress` if the input is valid, else `undefined`.

```ts
const email = EmailAddress.parse(`foo@bar.com`);
assert(email.getLocalPart() === "foo");
assert(email.getDomain() === "bar.com");

// for invalid addresses `undefined` is returned.
assert(EmailAddress.parse(`foo@-bar.com`, new ParsingOptions(true)) === undefined);
```

#### `isValid`

Validates if the given `input` string is an email address or not.
Unlike the `parse` method, it does not instantiate an `EmailAddress`.

```ts
assert(EmailAddress.isValid(`foo@bar.com`));
assert(!EmailAddress.isValid(`foo@-bar.com`, new ParsingOptions(true)));
```

#### Instance methods

An instance of `EmailAddress` can also be created using the constructor.

```ts
const email = new EmailAddress("foo", "bar.com");
assert(email.localPart === "foo");
assert(email.domain === "bar.com");
```

If either the local part or domain is invalid and cannot be parsed, the constructor throws error.
For example, the following attempts fails.

```ts
new EmailAddress('-foo', 'bar.com');
new EmailAddress('foo', '-bar.com');
```

### Unicode support

In compliance to [RFC 6532](https://tools.ietf.org/html/rfc6532), it supports parsing, validating, and instantiating email addresses with Unicode characters.

```ts
assert(`${new EmailAddress('foö', 'bücher.de')}` === 'foö@bücher.de');
assert(`${EmailAddress.parse('foö@bücher.de')}` === 'foö@bücher.de');
assert(EmailAddress.isValid('foö@bücher.de'));
```
