### Build

- Only Rust

  ```shell
  cargo build
  ```

- WASM

  ```shell
  wasm-pack build --out-dir ../npm-packages/wasm/dist/bundler
  wasm-pack build --target nodejs --out-dir ../npm-packages/wasm/dist/cjs
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

- [ ] Update Rust crate version in `rust-lib/Cargo.toml` and run `cargo build --release` (this updates `Cargo.lock`).
- [ ] Update npm package versions from `npm-packages`:
  - `npm version {VERSION} --workspace wasm --no-git-tag-version`
  - `npm version {VERSION} --workspace regex --no-git-tag-version`
- [ ] Validate Rust locally:
  - `cargo test`
  - `wasm-pack test --node`
  - `wasm-pack build --out-dir ../npm-packages/wasm/dist/bundler --release`
  - `wasm-pack build --target nodejs --out-dir ../npm-packages/wasm/dist/cjs --release`
- [ ] Validate npm workspace locally (from `npm-packages`):
  - `npm ci`
  - `npm test --workspace wasm`
  - `npm run build --workspace regex`
  - `npm test --workspace regex`
- [ ] (Optional) Refresh benchmark report:
  - `pwsh -File ./Generate-PerformanceReport.ps1 -VersionLabel "v{VERSION}"`
- [ ] Generate changelog with `npx conventional-changelog-cli -i CHANGELOG.md -s`, and edit version headings.
- [ ] Commit.
- [ ] Add git tag: `git tag -a v{TAG} -m "{MSG}"`.
- [ ] Push branch and tags: `git push --follow-tags origin master`.
- [ ] Confirm CI release jobs publish all targets: crates.io, `@sparser/email-address-parser` (wasm), and `@sparser/email-address-parser-regex`.
