# @sparser/email-address-parser-regex

Regex-based RFC 5322 and RFC 6532 compliant email address parser.

## Install

```bash
npm install @sparser/email-address-parser-regex
```

## Usage

```ts
import { EmailAddress, ParsingOptions } from "@sparser/email-address-parser-regex";

const email = EmailAddress.parse("foo@bar.com");
console.log(email?.localPart); // foo
console.log(email?.domain); // bar.com

const isValid = EmailAddress.isValid("foo@bar.com", new ParsingOptions(false));
console.log(isValid); // true
```

Advanced regex exports are available from:

```ts
import { EMAIL_REGEX_STRICT, isValidEmail, parseEmail } from "@sparser/email-address-parser-regex/email-regex";
```
