# Email Address Parser

[![crate version](https://img.shields.io/crates/v/email-address-parser)](https://crates.io/crates/email-address-parser)
[![crate download count](https://img.shields.io/crates/d/email-address-parser?label=crate%20download)](https://crates.io/crates/email-address-parser)
[![npm version](https://img.shields.io/npm/v/@sparser/email-address-parser)](https://www.npmjs.com/package/@sparser/email-address-parser)
[![npm download](https://img.shields.io/npm/dt/@sparser/email-address-parser?label=npm%20download)](https://www.npmjs.com/package/@sparser/email-address-parser)
![build status](https://github.com/Sayan751/email-address-parser/workflows/build/badge.svg)

An [RFC 5322](https://tools.ietf.org/html/rfc5322) (without [display name support](#out-of-scope)), and [RFC 6532](https://tools.ietf.org/html/rfc6532) compliant email address parser implemented in Rust with a [`nom`](https://github.com/rust-bakery/nom)-based parser.
This repository contains a [rust crate](./rust-lib/README.md) as well as a wrapper [WebAssembly module](./npm-pkg/README.md).
Benchmark summaries for releases are tracked in [Performance.md](./Performance.md).

### Out of scope

Note that this package is only for parsing email addresses.
It does not support parsing email addresses with display name, such as the following: `John Doe <john@doe.com>`.
