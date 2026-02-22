const statusEl = document.getElementById("status");

function parseIntParam(name, fallback) {
  const raw = new URLSearchParams(location.search).get(name);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function makeTimerTask(fn, batchSize) {
  return () => {
    const t0 = performance.now();
    for (let i = 0; i < batchSize; i += 1) fn();
    const t1 = performance.now();
    return (t1 - t0) / batchSize;
  };
}

async function runMicroBench(name, fn, config) {
  const { warmupIterations, iterations, timeMs, batchSize } = config;
  const timed = makeTimerTask(fn, batchSize);

  for (let i = 0; i < warmupIterations; i += 1) {
    timed();
  }

  const samples = [];
  let ops = 0;
  const runStart = performance.now();

  while (ops < iterations || performance.now() - runStart < timeMs) {
    const perOpMs = timed();
    samples.push(perOpMs);
    ops += batchSize;
  }

  const elapsedMs = performance.now() - runStart;
  const sorted = [...samples].sort((a, b) => a - b);
  const meanMs =
    samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
  const hz = elapsedMs > 0 ? (ops * 1000) / elapsedMs : 0;

  return {
    name,
    hz,
    mean: meanMs / 1000,
    p99: percentile(sorted, 0.99) / 1000,
    samples,
  };
}

async function loadRuntime(target) {
  if (target === "wasm") {
    const pkg = await import("../../dist/web/email_address_parser.js");
    if (typeof pkg.default === "function") {
      await pkg.default();
    }
    return {
      label: "WASM",
      target,
      ...pkg,
      release(value) {
        if (value && typeof value.free === "function") value.free();
      },
      createLaxOptions(ParsingOptions) {
        return new ParsingOptions(true);
      },
    };
  }

  if (target === "esm") {
    const pkg = await import("../../dist/esm/index.mjs");
    return {
      label: "ESM (native JS parser)",
      target,
      ...pkg,
      release() {},
      createLaxOptions(ParsingOptions) {
        return new ParsingOptions(true);
      },
    };
  }

  throw new Error(`Unknown target '${target}'`);
}

async function runSuite(target, config) {
  const runtime = await loadRuntime(target);
  const { EmailAddress, ParsingOptions } = runtime;
  const cases = [
    {
      name: `${target} parse valid address with ASCII characters`,
      fn: () => {
        const parsed = EmailAddress.parse("foo@bar.com");
        runtime.release(parsed);
      },
    },
    {
      name: `${target} parse invalid address with invalid domain label`,
      fn: () => {
        const parsed = EmailAddress.parse("foo@-bar.com");
        runtime.release(parsed);
      },
    },
    {
      name: `${target} parse valid address with Unicode characters`,
      fn: () => {
        const parsed = EmailAddress.parse("foö@bücher.de");
        runtime.release(parsed);
      },
    },
    {
      name: `${target} parse obsolete RFC 5322 syntax in lax mode`,
      fn: () => {
        const parsed = EmailAddress.parse(
          "\r\n \r\n test@iana.org",
          runtime.createLaxOptions(ParsingOptions)
        );
        runtime.release(parsed);
      },
    },
    {
      name: `${target} isValid for valid address with ASCII characters`,
      fn: () => {
        EmailAddress.isValid("foo@bar.com");
      },
    },
    {
      name: `${target} isValid for invalid address with invalid domain label`,
      fn: () => {
        EmailAddress.isValid("foo@-bar.com");
      },
    },
    {
      name: `${target} isValid for valid address with Unicode characters`,
      fn: () => {
        EmailAddress.isValid("foö@bücher.de");
      },
    },
    {
      name: `${target} constructor for valid address with ASCII characters`,
      fn: () => {
        const email = new EmailAddress("foo", "bar.com");
        runtime.release(email);
      },
    },
  ];

  const tasks = [];
  for (const benchCase of cases) {
    tasks.push(await runMicroBench(benchCase.name, benchCase.fn, config));
  }

  return {
    label: runtime.label,
    target,
    config,
    tasks,
  };
}

function renderText(results) {
  const lines = [];
  for (const suite of results) {
    lines.push(`${suite.label} benchmark (browser)`);
    lines.push(
      `iterations=${suite.config.iterations}, warmupIterations=${suite.config.warmupIterations}, timeMs=${suite.config.timeMs}, batchSize=${suite.config.batchSize}`
    );
    lines.push("");
    for (const task of suite.tasks) {
      lines.push(
        `${task.name}: ${task.hz.toFixed(0)} ops/sec, mean=${(task.mean * 1000).toFixed(
          4
        )} ms, p99=${(task.p99 * 1000).toFixed(4)} ms`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const params = new URLSearchParams(location.search);
  const target = params.get("target") || "compare";
  const config = {
    iterations: parseIntParam("iterations", 20000),
    warmupIterations: parseIntParam("warmupIterations", 5000),
    timeMs: parseIntParam("timeMs", 1000),
    batchSize: parseIntParam("batchSize", 50),
  };

  const targets = target === "compare" ? ["wasm", "esm"] : [target];
  const results = [];
  for (const benchTarget of targets) {
    statusEl.textContent = `Running ${benchTarget} benchmarks...`;
    results.push(await runSuite(benchTarget, config));
  }

  window.__BROWSER_BENCH_RESULTS__ = results;
  window.__BROWSER_BENCH_DONE__ = true;
  statusEl.textContent = renderText(results);
}

main().catch((err) => {
  window.__BROWSER_BENCH_ERROR__ = String(err?.stack || err);
  window.__BROWSER_BENCH_DONE__ = true;
  statusEl.textContent = window.__BROWSER_BENCH_ERROR__;
});
