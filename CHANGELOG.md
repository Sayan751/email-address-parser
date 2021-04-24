##  (2021-04-24)

* Derive Eq, PartialEq, and Hash for EmailAddress ([c643037](https://github.com/Sayan751/email-address-parser/commit/c643037))

## 1.0.0 (2020-09-06)

### Features

* Enabled parsing local part, and domain on instantiation ([92b2af9](https://github.com/Sayan751/email-address-parser/commit/92b2af9)). `EmailAddress::new` (in Rust) or `new EmailAddress(...)` (in JS) throws error if either local part or domain is invalid.
* Added `EmailAddress::is_valid` (in Rust), and `EmailAddress.isValid()` (in JS) to simply validates a given string. This parses like the `parse` method, but does not instantiates an `EmailAddress` object, and return `true`/`false` instead ([3988d98](https://github.com/Sayan751/email-address-parser/commit/3988d98)).
* Adding unicode support RFC 6532 ([5d1f60e](https://github.com/Sayan751/email-address-parser/commit/5d1f60e)).

### Breaking Changes

* The methods `localPart()`, and `domain()` exposed to JS, has been converted to ES6 getters. This means `email.localPart()` or `email.domain()` can simply be converted to `email.localPart` and `email.domain` respectively.
* In JS, the static method `EmailAddress.new` has been converted to a constructor. Use simply `new EmailAddress(...)` to instantiate `EmailAddress`.
* The signature of `parse` and `new` has been changed. Instead of an optional boolean as the lat parameter, they now expect an optional `ParsingOptions` instance.
* The constructor function (`new`) not returns `Result<EmailAddress, String>` in Rust instead of `Option<EmailAddress>`. Semantically, this makes more sense. In JS side, the core `new` function has been wrapped with a constructor function that panics (throws error in JS). The later function is not meant to be used from Rust, and strictly for JS users.

## 0.3.0-rc2 (2020-08-30)

Initial release of an RFC 5233 compliant email parser.
