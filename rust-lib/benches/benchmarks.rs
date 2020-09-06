use criterion::{black_box, criterion_group, criterion_main, Criterion};
use email_address_parser::*;

const EMAIL: &str = "foo@bar.com";
const EMAIL_INVALID_LOCAL_PART: &str = "foo-@bar.com";
const EMAIL_INVALID_DOMAIN: &str = "foo@-bar.com";
const EMAIL_UNICODE: &str = "foö@bär.com";
const EMAIL_LONG: &str = "this.is.a.very-long.email@super-super.deliberately.long.and.awesome-domain.com";
const EMAIL_OBS: &str = "\u{0d}\u{0a} \u{0d}\u{0a} test@iana.org";

pub fn parse_benchmark(c: &mut Criterion) {
  c.bench_function("parse - valid", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL), black_box(None))));
  c.bench_function("parse - invalid local part", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL_INVALID_LOCAL_PART), black_box(None))));
  c.bench_function("parse - invalid domain", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL_INVALID_DOMAIN), black_box(None))));
  c.bench_function("parse - unicode", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL_UNICODE), black_box(None))));
  c.bench_function("parse - long", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL_LONG), black_box(None))));
  c.bench_function("parse - obs", |b| b.iter(|| EmailAddress::parse(black_box(EMAIL_OBS), black_box(Some(ParsingOptions::new(true))))));
}

pub fn is_valid_benchmark(c: &mut Criterion) {
  c.bench_function("is_valid - valid", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL), black_box(None))));
  c.bench_function("is_valid - invalid local part", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL_INVALID_LOCAL_PART), black_box(None))));
  c.bench_function("is_valid - invalid domain", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL_INVALID_DOMAIN), black_box(None))));
  c.bench_function("is_valid - unicode", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL_UNICODE), black_box(None))));
  c.bench_function("is_valid - long", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL_LONG), black_box(None))));
  c.bench_function("is_valid - obs", |b| b.iter(|| EmailAddress::is_valid(black_box(EMAIL_OBS), black_box(Some(ParsingOptions::new(true))))));
}

pub fn new_benchmark(c: &mut Criterion) {
  c.bench_function("new - valid", |b| b.iter(|| EmailAddress::new(black_box("foo"), black_box("bar.com"), black_box(None))));
  c.bench_function("new - invalid local part", |b| b.iter(|| EmailAddress::new(black_box("foo-"), black_box("bar.com"), black_box(None))));
  c.bench_function("new - invalid domain", |b| b.iter(|| EmailAddress::new(black_box("foo"), black_box("-bar.com"), black_box(None))));
  c.bench_function("new - unicode", |b| b.iter(|| EmailAddress::new(black_box("foö"), black_box("bär.com"), black_box(None))));
  c.bench_function("new - long", |b| b.iter(|| EmailAddress::new(black_box("this.is.a.very-long.email"), black_box("super-super.deliberately.long.and.awesome-domain.com"), black_box(None))));
  c.bench_function("new - obs", |b| b.iter(|| EmailAddress::new(black_box("\u{0d}\u{0a} \u{0d}\u{0a} test"), black_box("iana.org"), black_box(None))));
}

criterion_group!(benches, parse_benchmark, is_valid_benchmark, new_benchmark);
criterion_main!(benches);
