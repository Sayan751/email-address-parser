# email-address-parser

This is a WASM wrapper over the rust crate [email-address-parser](TODO) which provides an RFC 5322 compliant implementation of email address parser.
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
    const EmailAddress = parser.default.EmailAddress;
    
    // pares valid address
    const email = EmailAddress.parse("foo@bar.com", true);
    // get local part and domain
    console.log(`local part: ${email.local_part()}, domain: ${email.domain()}`); // local part: foo, domain: bar.com

    // invalid address
    console.log(EmailAddress.parse("foo@-bar.com", true)); // undefined
  })
  .catch((reason) => {
    console.error(reason);
  });
```

### In webapp with bundler (like webpack)

```js
// @ts-check
import("@sp/email-address-parser")
  .then(({ EmailAddress }) => {
    // pares valid address
    const email = EmailAddress.parse("foo@bar.com", true);
    // get local part and domain
    console.log(`local part: ${email.local_part()}, domain: ${email.domain()}`);  // local part: foo, domain: bar.com

    // invalid address
    console.log(EmailAddress.parse("foo@-bar.com", true)); // undefined
});

```