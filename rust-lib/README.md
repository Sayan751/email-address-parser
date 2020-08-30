# email-address-parser

An RFC 5322 compliant email address parser.

You can parse string for email address like this.

```rust
use email_address_parser::EmailAddress;

let email = EmailAddress::parse("foo@bar.com", Some(true)).unwrap();
assert_eq!(email.get_local_part(), "foo");
assert_eq!(email.get_domain(), "bar.com");
```

For an input string that is an invalid email address, it returns `None`.

```rust
use email_address_parser::EmailAddress;

assert!(EmailAddress::parse("test@-iana.org", Some(true)).is_none());
```

To parse an email address with obsolete parts (as per RFC 5322) in it, pass `None` as the second argument to have non-strict parsing.

```rust
let email = EmailAddress::parse("\u{0d}\u{0a} \u{0d}\u{0a} test@iana.org", None);
assert!(email.is_some());
```

## Development

### Build
- Only Rust
  ```shell
  cargo build
  ```
- WASM
  ```shell
  wasm-pack build --out-dir ../npm-pkg/dist/bundler
  wasm-pack build --target nodejs --out-dir ../npm-pkg/dist/cjs
  ```

### Test

- Only Rust
  ```shell
  cargo test
  ```

- WASM
  ```shell
  wasm-pack test --node
  ```

### Doc generation

```shell
cargo doc --no-deps --open
```

### Publishing checklist
[] Update crate version and commit.
[] Add git tag with `git tag -a v{TAG} -m "{MSG}"`.
[] Push tag `git push --follow-tags`.