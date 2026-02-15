"use strict";

async function runWasmSuite() {
  const { Bench } = await import("tinybench");
  const pkg = require("../dist/cjs/email_address_parser.js");
  const { EmailAddress, ParsingOptions } = pkg;

  const iterations = Number(process.env.BENCH_ITERATIONS || 20000);
  const warmupIterations = Number(process.env.BENCH_WARMUP_ITERATIONS || 5000);
  const timeMs = Number(process.env.BENCH_TIME_MS || 1000);

  const bench = new Bench({
    iterations,
    warmupIterations,
    time: timeMs,
  });

  bench
    .add("wasm parse valid address with ASCII characters", () => {
      const parsed = EmailAddress.parse("foo@bar.com");
      if (parsed) parsed.free();
    })
    .add("wasm parse invalid address with invalid domain label", () => {
      const parsed = EmailAddress.parse("foo@-bar.com");
      if (parsed) parsed.free();
    })
    .add("wasm parse valid address with Unicode characters", () => {
      const parsed = EmailAddress.parse("foö@bücher.de");
      if (parsed) parsed.free();
    })
    .add("wasm parse obsolete RFC 5322 syntax in lax mode", () => {
      const parsed = EmailAddress.parse(
        "\r\n \r\n test@iana.org",
        new ParsingOptions(true)
      );
      if (parsed) parsed.free();
    })
    .add("wasm isValid for valid address with ASCII characters", () => {
      EmailAddress.isValid("foo@bar.com");
    })
    .add("wasm isValid for invalid address with invalid domain label", () => {
      EmailAddress.isValid("foo@-bar.com");
    })
    .add("wasm isValid for valid address with Unicode characters", () => {
      EmailAddress.isValid("foö@bücher.de");
    })
    .add("wasm constructor for valid address with ASCII characters", () => {
      const email = new EmailAddress("foo", "bar.com");
      email.free();
    });

  await bench.warmup();
  await bench.run();

  console.log("WASM benchmark (tinybench)");
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

async function main() {
  const target = process.env.BENCH_TARGET || "wasm";

  if (target !== "wasm") {
    throw new Error(
      `Unknown BENCH_TARGET '${target}'. Supported values: wasm.`
    );
  }

  await runWasmSuite();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
