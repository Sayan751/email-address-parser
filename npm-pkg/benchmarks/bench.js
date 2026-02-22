"use strict";

const EMAIL = "foo@bar.com";
const EMAIL_INVALID_LOCAL_PART = "foo-@bar.com";
const EMAIL_INVALID_DOMAIN = "foo@-bar.com";
const EMAIL_UNICODE = "foö@bücher.de";
const EMAIL_LONG =
  "this.is.a.very-long.email@super-super.deliberately.long.and.awesome-domain.com";
const EMAIL_OBS = "\r\n \r\n test@iana.org";
const DEFAULT_BENCH_OPTIONS = Object.freeze({
  iterations: 20000,
  warmupIterations: 5000,
  timeMs: 1000,
  format: "table",
});

async function loadBenchmarkTarget() {
  const pkg = require("../dist/cjs/email_address_parser.js");
  const label = "WASM";

  return {
    label,
    target: "wasm",
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

function printUsage() {
  console.log("Usage: node ./benchmarks/bench.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --iterations <n>         Benchmark iterations per task (default: 20000)");
  console.log("  --warmup-iterations <n>  Warmup iterations per task (default: 5000)");
  console.log("  --time-ms <n>            Time budget per task in ms (default: 1000)");
  console.log("  --format <table|json>    Output format (default: table)");
  console.log("  --json                   Shortcut for --format json");
  console.log("  --help                   Show this help");
}

function parsePositiveInt(rawValue, flagName) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid value for ${flagName}: '${rawValue}'`);
  }
  return value;
}

function parseBenchArgs(argv) {
  const options = { ...DEFAULT_BENCH_OPTIONS };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--json") {
      options.format = "json";
      continue;
    }

    if (arg === "--format" || arg === "-f") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
      const normalized = value.toLowerCase();
      if (normalized !== "table" && normalized !== "json") {
        throw new Error(`Invalid value for ${arg}: '${value}'`);
      }
      options.format = normalized;
      continue;
    }

    if (arg === "--iterations" || arg === "-i") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
      options.iterations = parsePositiveInt(value, arg);
      continue;
    }

    if (arg === "--warmup-iterations" || arg === "-w") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
      options.warmupIterations = parsePositiveInt(value, arg);
      continue;
    }

    if (arg === "--time-ms" || arg === "-t") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
      options.timeMs = parsePositiveInt(value, arg);
      continue;
    }

    throw new Error(`Unknown argument: '${arg}'. Use --help for usage.`);
  }

  return options;
}

function getTaskMetrics(result) {
  const hz = result.throughput?.mean ?? result.hz ?? 0;
  const meanMs = result.latency?.mean ?? (result.mean || 0) * 1000;
  const p99Ms = result.latency?.p99 ?? (result.p99 || 0) * 1000;
  const samples =
    result.latency?.samplesCount ??
    (Array.isArray(result.samples) ? result.samples.length : 0);
  return { hz, meanMs, p99Ms, samples };
}

function printTableBench(label, iterations, warmupIterations, timeMs, bench) {
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
    if (!("throughput" in result) && !("hz" in result)) continue;

    const metrics = getTaskMetrics(result);
    console.log(
      row([
        task.name,
        metrics.hz.toFixed(0),
        metrics.meanMs.toFixed(4),
        metrics.p99Ms.toFixed(4),
        metrics.samples,
      ])
    );
  }
}

function classifyCase(taskName) {
  const name = taskName.toLowerCase();

  let api = "other";
  if (name.includes(" parse ")) api = "parse";
  else if (name.includes(" isvalid ")) api = "is_valid";
  else if (name.includes(" constructor ")) api = "new";

  let inputCase = "other";
  if (name.includes("ascii")) inputCase = "valid";
  if (name.includes("invalid domain")) inputCase = "invalid domain";
  if (name.includes("unicode")) inputCase = "unicode";
  if (name.includes("obsolete rfc 5322")) inputCase = "obs";
  if (name.includes("invalid local part")) inputCase = "invalid local part";

  return { api, case: inputCase };
}

function buildSummary(runtime, iterations, warmupIterations, timeMs, bench) {
  const results = [];
  const skipped = [];
  for (const task of bench.tasks) {
    const result = task.result;
    if (!result) {
      skipped.push({ task: task.name, reason: "no-result" });
      continue;
    }
    if (!("throughput" in result) && !("hz" in result)) {
      skipped.push({
        task: task.name,
        state: result.state,
        error: result.error ? String(result.error.message || result.error) : undefined,
      });
      continue;
    }

    const metrics = getTaskMetrics(result);
    results.push({
      task: task.name,
      ...classifyCase(task.name),
      opsPerSec: metrics.hz,
      meanMs: metrics.meanMs,
      meanNs: metrics.meanMs * 1e6,
      p99Ms: metrics.p99Ms,
      samples: metrics.samples,
    });
  }

  return {
    tool: "tinybench",
    runtime: runtime.label,
    target: runtime.target,
    config: {
      iterations,
      warmupIterations,
      timeMs,
    },
    results,
    skipped,
  };
}

function addTasks(bench, target, runtime, EmailAddress, ParsingOptions) {
  const createLaxOptions = () => runtime.createLaxOptions(ParsingOptions);

  // const consumeExpectedThrow = (fn) => {
  //   try {
  //     fn();
  //   } catch (_err) {
  //     console.log(_err)
  //     // expected for invalid constructor inputs
  //   }
  // };

  bench
    .add(`${target} parse valid address with ASCII characters`, () => {
      const parsed = EmailAddress.parse(EMAIL);
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse invalid address with invalid local part`, () => {
      const parsed = EmailAddress.parse(EMAIL_INVALID_LOCAL_PART);
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse invalid address with invalid domain label`, () => {
      const parsed = EmailAddress.parse(EMAIL_INVALID_DOMAIN);
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse valid address with Unicode characters`, () => {
      const parsed = EmailAddress.parse(EMAIL_UNICODE);
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse valid long address`, () => {
      const parsed = EmailAddress.parse(EMAIL_LONG);
      runtime.releaseParsed(parsed);
    })
    .add(`${target} parse obsolete RFC 5322 syntax in lax mode`, () => {
      const parsed = EmailAddress.parse(EMAIL_OBS, createLaxOptions());
      runtime.releaseParsed(parsed);
    })
    .add(`${target} isValid for valid address with ASCII characters`, () => {
      EmailAddress.isValid(EMAIL);
    })
    .add(`${target} isValid for invalid address with invalid local part`, () => {
      EmailAddress.isValid(EMAIL_INVALID_LOCAL_PART);
    })
    .add(`${target} isValid for invalid address with invalid domain label`, () => {
      EmailAddress.isValid(EMAIL_INVALID_DOMAIN);
    })
    .add(`${target} isValid for valid address with Unicode characters`, () => {
      EmailAddress.isValid(EMAIL_UNICODE);
    })
    .add(`${target} isValid for valid long address`, () => {
      EmailAddress.isValid(EMAIL_LONG);
    })
    .add(`${target} isValid for obsolete RFC 5322 syntax in lax mode`, () => {
      EmailAddress.isValid(EMAIL_OBS, createLaxOptions());
    })
    .add(`${target} constructor for valid address with ASCII characters`, () => {
      const email = new EmailAddress("foo", "bar.com");
      runtime.releaseConstructed(email);
    })
    // .add(`${target} constructor for invalid local part`, () => {
    //   consumeExpectedThrow(() => new EmailAddress("foo-", "bar.com"));
    // })
    // .add(`${target} constructor for invalid domain label`, () => {
    //   consumeExpectedThrow(() => new EmailAddress("foo", "-bar.com"));
    // })
    .add(`${target} constructor for valid address with Unicode characters`, () => {
      const email = new EmailAddress("foö", "bücher.de");
      runtime.releaseConstructed(email);
    })
    .add(`${target} constructor for valid long address`, () => {
      const email = new EmailAddress(
        "this.is.a.very-long.email",
        "super-super.deliberately.long.and.awesome-domain.com"
      );
      runtime.releaseConstructed(email);
    })
    .add(`${target} constructor for obsolete RFC 5322 local-part in lax mode`, () => {
      const email = new EmailAddress("\r\n \r\n test", "iana.org", createLaxOptions());
      runtime.releaseConstructed(email);
    });
}

async function runSuite(target, benchOptions) {
  const { Bench } = await import("tinybench");
  const runtime = await loadBenchmarkTarget();
  const { EmailAddress, ParsingOptions } = runtime;
  const { iterations, warmupIterations, timeMs, format } = benchOptions;

  const bench = new Bench({
    iterations,
    warmupIterations,
    time: timeMs,
  });

  addTasks(bench, target, runtime, EmailAddress, ParsingOptions);

  await bench.run();

  const summary = buildSummary(runtime, iterations, warmupIterations, timeMs, bench);
  if (format === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else if (format !== "silent") {
    printTableBench(runtime.label, iterations, warmupIterations, timeMs, bench);
  }

  return summary;
}

async function main() {
  const target = "wasm";
  const args = parseBenchArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  await runSuite(target, args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
