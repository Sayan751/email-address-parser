# An RFC 5322 compliant email address parser

TODO

## Development

### Build
- Only Rust
  ```shell
  cargo build
  ```
- WASM
  ```shell
  wasm-pack build --out-dir pkg/bundler
  wasm-pack build --target nodejs --out-dir pkg/cjs
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