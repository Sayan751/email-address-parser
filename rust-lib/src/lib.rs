//! An RFC 5322 compliant email address parser.
//!
//! # Examples
//! You can parse string for email address like this.
//! ```
//! use email_address_parser::EmailAddress;
//!
//! let email = EmailAddress::parse("foo@bar.com", None).unwrap();
//! assert_eq!(email.get_local_part(), "foo");
//! assert_eq!(email.get_domain(), "bar.com");
//! ```
//!
//! For an input string that is an invalid email address, it returns `None`.
//! ```
//! use email_address_parser::EmailAddress;
//!
//! assert!(EmailAddress::parse("test@-iana.org", None).is_none());
//! ```
//!
//! To parse an email address with obsolete parts (as per RFC 5322) in it, pass `None` as the second argument to have non-strict parsing.
//! ```
//! use email_address_parser::*;
//!
//! let email = EmailAddress::parse("\u{0d}\u{0a} \u{0d}\u{0a} test@iana.org", Some(ParsingOptions{is_lax: true, supports_unicode: false}));
//! assert!(email.is_some());
//! ```

#[macro_use]
extern crate pest_derive;

mod email_address;
#[doc(inline)]
pub use self::email_address::EmailAddress;
pub use self::email_address::ParsingOptions;
