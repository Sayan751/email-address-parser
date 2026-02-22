/// <reference types="node" />
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

function detectBrowserExecutable() {
  if (process.env.BENCH_BROWSER_EXECUTABLE) {
    return process.env.BENCH_BROWSER_EXECUTABLE;
  }

  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No supported browser executable found. Set BENCH_BROWSER_EXECUTABLE to msedge/chrome path."
  );
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".d.ts":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url || "/", "http://localhost");
      let pathname = decodeURIComponent(reqUrl.pathname);
      if (pathname === "/") pathname = "/benchmarks/browser/index.html";
      const resolved = path.resolve(rootDir, `.${pathname}`);

      if (!resolved.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      res.setHeader("Content-Type", contentTypeFor(resolved));
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
      });
    });
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function compareSummary(suites) {
  if (suites.length !== 2) return [];
  const wasm = suites.find((s) => s.target === "wasm");
  const esm = suites.find((s) => s.target === "esm");
  if (!wasm || !esm) return [];

  const rows = [];
  for (let i = 0; i < Math.min(wasm.tasks.length, esm.tasks.length); i += 1) {
    const w = wasm.tasks[i];
    const e = esm.tasks[i];
    const ratio = e.hz > 0 ? w.hz / e.hz : Infinity;
    rows.push({
      name: w.name.replace(/^wasm /, ""),
      wasmHz: w.hz,
      esmHz: e.hz,
      speedup: ratio,
    });
  }
  return rows;
}

function printSuites(suites) {
  const headers = ["Benchmark", "Ops/sec", "Mean (ms)", "P99 (ms)", "Samples"];
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

  for (const suite of suites) {
    console.log(`${suite.label} benchmark (browser)`);
    console.log(
      `iterations=${suite.config.iterations}, warmupIterations=${suite.config.warmupIterations}, timeMs=${suite.config.timeMs}, batchSize=${suite.config.batchSize}`
    );
    console.log("");
    console.log(row(headers));
    console.log(separator);
    for (const task of suite.tasks) {
      const sortedSamples = [...task.samples].sort((a, b) => a - b);
      const meanMs = (task.mean || 0) * 1000;
      const p99Ms = (percentile(sortedSamples, 0.99) || task.p99 || 0) * 1000;
      console.log(
        row([
          task.name,
          (task.hz || 0).toFixed(0),
          meanMs.toFixed(4),
          p99Ms.toFixed(4),
          task.samples?.length || 0,
        ])
      );
    }
    console.log("");
  }

  const comparison = compareSummary(suites);
  if (comparison.length > 0) {
    console.log("Browser compare summary (WASM / ESM ops/sec)");
    for (const item of comparison) {
      console.log(
        `- ${item.name}: wasm=${item.wasmHz.toFixed(0)} ops/sec, esm=${item.esmHz.toFixed(
          0
        )} ops/sec, speedup=${item.speedup.toFixed(2)}x`
      );
    }
  }
}

async function run() {
  const { chromium } = require("playwright-core");
  const npmPkgRoot = path.resolve(__dirname, "..");
  const target = process.env.BENCH_TARGET || "compare";
  const iterations = Number(process.env.BENCH_ITERATIONS || 20000);
  const warmupIterations = Number(process.env.BENCH_WARMUP_ITERATIONS || 5000);
  const timeMs = Number(process.env.BENCH_TIME_MS || 1000);
  const batchSize = Number(process.env.BENCH_BATCH_SIZE || 50);

  const { server, port } = await startStaticServer(npmPkgRoot);
  const executablePath = detectBrowserExecutable();
  let browser;

  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (process.env.BENCH_BROWSER_PAGE_CONSOLE === "1") {
        console.log(`[browser:${msg.type()}] ${msg.text()}`);
      }
    });

    const url = new URL(`http://127.0.0.1:${port}/benchmarks/browser/index.html`);
    url.searchParams.set("target", target);
    url.searchParams.set("iterations", String(iterations));
    url.searchParams.set("warmupIterations", String(warmupIterations));
    url.searchParams.set("timeMs", String(timeMs));
    url.searchParams.set("batchSize", String(batchSize));

    await page.goto(url.toString(), { waitUntil: "load" });
    await page.waitForFunction(() => window.__BROWSER_BENCH_DONE__ === true, null, {
      timeout: 10 * 60 * 1000,
    });

    const error = await page.evaluate(() => window.__BROWSER_BENCH_ERROR__ || null);
    if (error) {
      throw new Error(`Browser benchmark page error:\n${error}`);
    }

    const results = await page.evaluate(() => window.__BROWSER_BENCH_RESULTS__);
    printSuites(results || []);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
