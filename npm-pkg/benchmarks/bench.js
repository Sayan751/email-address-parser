"use strict";

async function loadBenchmarkTarget(target) {
  if (target === "wasm") {
    const pkg = require("../dist/cjs/email_address_parser.js");
    return {
      label: "WASM",
      target,
      ...pkg,
      releaseParsed(value) {
        if (value && typeof value.free === "function") {
          value.free();
        }
      },
      releaseConstructed(value) {
        if (value && typeof value.free === "function") {
          value.free();
        }
      },
      createLaxOptions(ParsingOptions) {
        return new ParsingOptions(true);
      },
    };
  }

  if (target === "esm") {
    const pkg = await import("../dist/esm/index.mjs");
    return {
      label: "ESM (native JS parser)",
      target,
      ...pkg,
      releaseParsed() {},
      releaseConstructed() {},
      createLaxOptions(ParsingOptions) {
        return new ParsingOptions(true);
      },
    };
  }

  throw new Error(
    `Unknown BENCH_TARGET '${target}'. Supported values: wasm, esm.`
  );
}

function formatAndPrintBench(label, iterations, warmupIterations, timeMs, bench) {
  console.log(`${label} benchmark (tinybench)`);
  console.log(
    `iterations=${iterations}, warmupIterations=${warmupIterations}, timeMs=${timeMs}`
  );
  console.log("");

  const headers = [
    "Benchmark",
    "Ops/sec",
    "Mean (ms)",
    "P99 (ms)",
    "Samples",
  ];
  const widths = [66, 14, 14, 12, 10];
  const pad = (value, width, rightAlign = false) => {
    const text = String(value);
    return rightAlign ? text.padStart(width) : text.padEnd(width);
  };
  const row = (columns) =>
    columns
      .map((value, index) => pad(value, widths[index], index > 0))
      .join(" | ");
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");

  console.log(row(headers));
  console.log(separator);

  for (const task of bench.tasks) {
    const result = task.result;
    if (!result) continue;

    const hz = result.hz || 0;
    const meanMs = (result.mean || 0) * 1000;
    const p99Ms = (result.p99 || 0) * 1000;
    console.log(
      row([
        task.name,
        hz.toFixed(0),
        meanMs.toFixed(4),
        p99Ms.toFixed(4),
        result.samples.length,
      ])
    );
  }
}

async function runSuite(target) {
  const { Bench } = await import("tinybench");
  const runtime = await loadBenchmarkTarget(target);
  const { EmailAddress, ParsingOptions } = runtime;

  const iterations = Number(process.env.BENCH_ITERATIONS || 20000);
  const warmupIterations = Number(process.env.BENCH_WARMUP_ITERATIONS || 5000);
  const timeMs = Number(process.env.BENCH_TIME_MS || 1000);

  const bench = new Bench({
    iterations,
    warmupIterations,
    time: timeMs,
  });

  bench
    .add(`${target} parse valid address with ASCII characters`, () => {
      const parsed = EmailAddress.parse("foo@bar.com");
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse invalid address with invalid domain label`, () => {
      const parsed = EmailAddress.parse("foo@-bar.com");
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse valid address with Unicode characters`, () => {
      const parsed = EmailAddress.parse("foö@bücher.de");
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse obsolete RFC 5322 syntax in lax mode`, () => {
      const parsed = EmailAddress.parse("\r\n \r\n test@iana.org", runtime.createLaxOptions(ParsingOptions));
      runtime.releaseParsed(parsed);
    })
    .add(`${target} isValid for valid address with ASCII characters`, () => {
      EmailAddress.isValid("foo@bar.com");
    })
    .add(`${target} isValid for invalid address with invalid domain label`, () => {
      EmailAddress.isValid("foo@-bar.com");
    })
    .add(`${target} isValid for valid address with Unicode characters`, () => {
      EmailAddress.isValid("foö@bücher.de");
    })
    .add(`${target} constructor for valid address with ASCII characters`, () => {
      const email = new EmailAddress("foo", "bar.com");
      runtime.releaseConstructed(email);
    });

  await bench.warmup();
  await bench.run();

  formatAndPrintBench(runtime.label, iterations, warmupIterations, timeMs, bench);
}

async function runCompareSuites() {
  await runSuite("wasm");
  console.log("");
  await runSuite("esm");
}

async function main() {
  const target = process.env.BENCH_TARGET || "wasm";
  if (target === "compare") {
    await runCompareSuites();
    return;
  }
  await runSuite(target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
