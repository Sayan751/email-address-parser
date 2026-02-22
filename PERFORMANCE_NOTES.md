# Performance Notes (WASM vs Native JS Parser)

This document records benchmark observations from the Peggy-based native JS parser (ESM) vs the existing Rust/WASM implementation.

The goal is to make the claims reproducible without requiring a PR discussion thread.

## Summary

- The Rust/WASM implementation outperformed the native JS (Peggy) parser in both Node and browser benchmarks.
- In browser benchmarks (the more important case for JS<->WASM boundary overhead), WASM still won after including:
  - JS -> WASM call overhead
  - string marshaling
  - object wrapping/freeing in the WASM path
- The performance gap is largest on invalid-input rejection cases.
- The gap is smaller (and sometimes near parity) on complex/obsolete lax parsing cases.

## Browser Benchmark Result (5-run average)

Environment:

- Browser: headless Microsoft Edge (via `playwright-core`)
- Harness: `npm-pkg/benchmarks/browser-runner.cjs` + `npm-pkg/benchmarks/browser/page.mjs`
- Targets compared:
  - WASM (`npm-pkg/dist/web`)
  - Native JS parser (`npm-pkg/dist/esm`)

Average over 5 runs:

| Benchmark                                             | Avg WASM ops/sec | Avg ESM ops/sec | Avg speedup (WASM/ESM) | Avg difference |
| ----------------------------------------------------- | ---------------: | --------------: | ---------------------: | -------------: |
| parse valid address with ASCII characters             |          837,353 |         496,740 |                  1.69x |         +68.6% |
| parse valid address with Unicode characters           |          512,780 |         465,872 |                  1.10x |         +10.1% |
| parse obsolete RFC 5322 syntax in lax mode            |          334,169 |         329,964 |                  1.01x |          +1.3% |
| parse invalid address with invalid domain label       |        1,385,170 |         104,769 |                 13.24x |       +1222.1% |
| isValid for valid address with ASCII characters       |        1,005,320 |         492,880 |                  2.04x |        +104.0% |
| isValid for valid address with Unicode characters     |          637,638 |         446,720 |                  1.44x |         +42.7% |
| isValid for invalid address with invalid domain label |        1,332,150 |         140,042 |                  9.56x |        +851.3% |
| constructor for valid address with ASCII characters   |          749,821 |         466,990 |                  1.62x |         +60.6% |

Derived summary:

- Arithmetic mean speedup across the 8 cases: ~3.96x (skewed by invalid-input cases)
- Median speedup across the 8 cases: ~1.66x

## Interpretation

- WASM remains the performance path.
- Native JS (Peggy) can still be useful as a no-WASM compatibility fallback.
- Invalid-case rejection is where the native JS parser falls behind most.

## How to Reproduce

### 1. Build the Rust/WASM artifacts

From `rust-lib`:

```powershell
wasm-pack build --target nodejs --out-dir ../npm-pkg/dist/cjs
wasm-pack build --target web --out-dir ../npm-pkg/dist/web
```

### 2. Build the native JS parser/runtime artifacts

From `npm-pkg`:

```powershell
npm install
npm run build
```

This generates:

- `dist/esm` (native JS parser wrapper)
- `src/generated` parser output from Peggy (via the build pipeline)

### 3. Run the Node benchmark (compare mode)

From `npm-pkg`:

```powershell
npm run bench:compare
```

Quick run:

```powershell
npm run bench:compare:quick
```

### 4. Run the browser benchmark (compare mode)

From `npm-pkg`:

```powershell
npm run bench:browser
```

Quick run:

```powershell
npm run bench:browser:quick
```

Notes:

- The browser benchmark uses headless Edge via `playwright-core`.
- A browser executable can be overridden with:

```powershell
$env:BENCH_BROWSER_EXECUTABLE = "C:\Path\To\msedge.exe"
```

### 5. Reproduce the 5-run browser average (PowerShell)

From `npm-pkg`, this is the command used to aggregate the `Browser compare summary` lines:

```powershell
$ErrorActionPreference='Stop'
$runs=5
$aggregate=@{}

for ($i=1; $i -le $runs; $i++) {
  Write-Host "=== Run $i/$runs ==="
  $lines = & npm run bench:browser 2>&1 | ForEach-Object { $_.ToString() }
  $matched=0

  foreach ($line in $lines) {
    if ($line -match '^- (?<name>.*): wasm=(?<wasm>[0-9.]+) ops/sec, esm=(?<esm>[0-9.]+) ops/sec, speedup=(?<speedup>[0-9.]+)x$') {
      $name=$Matches.name
      if (-not $aggregate.ContainsKey($name)) {
        $aggregate[$name] = [pscustomobject]@{
          Name=$name; WasmSum=0.0; EsmSum=0.0; SpeedupSum=0.0; Count=0
        }
      }
      $item=$aggregate[$name]
      $item.WasmSum += [double]$Matches.wasm
      $item.EsmSum += [double]$Matches.esm
      $item.SpeedupSum += [double]$Matches.speedup
      $item.Count += 1
      $matched += 1
      Write-Host $line
    }
  }

  if ($matched -eq 0) {
    throw "No parsed benchmark summary lines in run $i"
  }
}

Write-Host "`n=== Average over $runs runs ==="
$aggregate.Values |
  Sort-Object Name |
  ForEach-Object {
    $avgWasm = $_.WasmSum / $_.Count
    $avgEsm = $_.EsmSum / $_.Count
    [pscustomobject]@{
      Benchmark = $_.Name
      AvgWasmOps = [math]::Round($avgWasm, 0)
      AvgEsmOps = [math]::Round($avgEsm, 0)
      AvgSpeedupX = [math]::Round($_.SpeedupSum / $_.Count, 2)
      AvgDifferencePct = [math]::Round((($avgWasm / $avgEsm) - 1) * 100, 1)
    }
  } | Format-Table -AutoSize
```

## Scope / Caveats

- These numbers are branch-specific and depend on the current benchmark harness and generated parser.
- Browser results are from headless execution; interactive browser runs may differ slightly.
- Arithmetic mean speedup is not a good single KPI due to skew from invalid-input cases. Use per-case or median speedup for decision-making.
