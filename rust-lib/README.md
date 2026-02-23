# email-address-parser

An RFC 5322 and RFC 6532 compliant email address parser.

You can parse a string as an email address like this.

```rust
use email_address_parser::EmailAddress;

let email = EmailAddress::parse("foo@bar.com", None).unwrap();
assert_eq!(email.get_local_part(), "foo");
assert_eq!(email.get_domain(), "bar.com");
```

For an input string that is an invalid email address, it returns `None`.

```rust
use email_address_parser::EmailAddress;

assert!(EmailAddress::parse("test@-iana.org", None).is_none());
```

To parse an email address with obsolete parts (as per RFC 5322), pass `Some(ParsingOptions::new(true))` to enable lax parsing.

```rust
use email_address_parser::{EmailAddress, ParsingOptions};

let email = EmailAddress::parse(
    "\u{0d}\u{0a} \u{0d}\u{0a} test@iana.org",
    Some(ParsingOptions::new(true)),
);
assert!(email.is_some());
```

## Unicode support

In compliance to [RFC 6532](https://tools.ietf.org/html/rfc6532), it supports parsing, validating, and instantiating email addresses with Unicode characters.

```rust
use email_address_parser::EmailAddress;

assert_eq!(
    format!("{}", EmailAddress::new("foö", "bücher.de", None).unwrap()),
    "foö@bücher.de"
);
assert_eq!(
    format!("{}", EmailAddress::parse("foö@bücher.de", None).unwrap()),
    "foö@bücher.de"
);
assert!(EmailAddress::is_valid("foö@bücher.de", None));
```
