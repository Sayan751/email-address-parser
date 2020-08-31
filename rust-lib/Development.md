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

- [ ] Update crate version and commit.
- [ ] Generate changelog with `npx conventional-changelog-cli -i CHANGELOG.md -s`, and edit accordingly the version.
- [ ] Add git tag with `git tag -a v{TAG} -m "{MSG}"`.
- [ ] Push tag `git push --follow-tags`.

