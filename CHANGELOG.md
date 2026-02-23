## 3.0.0-rc.1 (2026-02-23)

* removed pest in favor of nom ([1694c80](https://github.com/Sayan751/email-address-parser/commit/1694c80))



## 2.0.1 (2026-02-22)

* add comment with working example ([322225e](https://github.com/Sayan751/email-address-parser/commit/322225e))
* add FromStr method for EmailAddress ([0b85d56](https://github.com/Sayan751/email-address-parser/commit/0b85d56))
* add suggestion for version bump ([6fa20fc](https://github.com/Sayan751/email-address-parser/commit/6fa20fc))
* added js ([e8af545](https://github.com/Sayan751/email-address-parser/commit/e8af545))
* added performance report ([7a4c563](https://github.com/Sayan751/email-address-parser/commit/7a4c563))
* Fix comment typo ([b982564](https://github.com/Sayan751/email-address-parser/commit/b982564))
* Revert "add suggestion for version bump" ([763ac22](https://github.com/Sayan751/email-address-parser/commit/763ac22))
* updated rust deps ([a66b9ba](https://github.com/Sayan751/email-address-parser/commit/a66b9ba))
* chore: prepare v2.0.0 ([6748a35](https://github.com/Sayan751/email-address-parser/commit/6748a35))



##  (2023-05-31)

* add comment with working example ([322225e](https://github.com/Sayan751/email-address-parser/commit/322225e))
* add FromStr method for EmailAddress ([0b85d56](https://github.com/Sayan751/email-address-parser/commit/0b85d56))



##  (2022-12-26)

* Make wasm-bindgen dependency optional. ([96ccb04](https://github.com/Sayan751/email-address-parser/commit/96ccb04))



## 2.0.0-rc1 (2022-08-27)

* chore: depensendcy update ([adddfc0](https://github.com/Sayan751/email-address-parser/commit/adddfc0))
* chore: updated readme ([1ea65ce](https://github.com/Sayan751/email-address-parser/commit/1ea65ce))
* chore: updated the node version in CI ([6ff216b](https://github.com/Sayan751/email-address-parser/commit/6ff216b))
* chore(npm-pkg): fixed reported vulnerability ([df6de2b](https://github.com/Sayan751/email-address-parser/commit/df6de2b))
* chore(npm-pkg): updated npm deps ([9ea74b8](https://github.com/Sayan751/email-address-parser/commit/9ea74b8))



## 2.0.0-rc1 (2021-10-11)

* fix: strict parsing ([7df3246](https://github.com/Sayan751/email-address-parser/commit/7df3246)), closes [#4](https://github.com/Sayan751/email-address-parser/issues/4)



## 1.0.3 (2021-09-15)

* Added a test for the clone functionality. ([356a343](https://github.com/Sayan751/email-address-parser/commit/356a343))
* Dervice clone for EmailAddress struct. ([f59275a](https://github.com/Sayan751/email-address-parser/commit/f59275a))
* Ignored intellij files. ([2a9c85e](https://github.com/Sayan751/email-address-parser/commit/2a9c85e))
* Removed unnecessary borrows. ([ba8b3e0](https://github.com/Sayan751/email-address-parser/commit/ba8b3e0))



## 1.0.1 (2021-04-24)

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
