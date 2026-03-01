# Performance Notes

Average time per operation (baseline `v2.0.0`), consolidated by API.

- Rust: Criterion (`cargo bench --bench benchmarks`)
- WASM + Regex: Tinybench (`npm run bench -- --json --target all`)
- New generated sections include `%` delta columns versus the immediately previous version section.
- This baseline was rerun with an aligned ~1s measurement window: Criterion `--measurement-time 1 --warm-up-time 1`, Tinybench `--time-ms 1000`.
- Results are useful for trend tracking; absolute values depend on machine/runtime/harness.
- `N/A` in JS `new` invalid cases: currently excluded from npm benchmarks because repeated throwing constructor calls destabilize the shared WASM instance during benchmarking.

<!-- Add performance report for new versions here. --->

## v3.0.0-rc.3 (added regex-based implementation for JS)

- Criterion setup: `--measurement-time 1 --warm-up-time 1`
- Tinybench setup: `--target all --time-ms 1000` (`--iterations` and `--warmup-iterations` are runner limits/defaults)
- Delta columns compare against previous section: `v3.0.0-rc.1 (nom, no pest)`

### `parse`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev | Regex (avg) | Regex Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: | ----------: | --------------: |
| valid              |   79.14 ns |         +1.05% |  257.42 ns |         +3.04% |   144.06 ns |             N/A |
| invalid local part |   23.55 ns |         +5.31% |   84.87 ns |         +0.25% |    63.76 ns |             N/A |
| invalid domain     |   32.01 ns |         -0.67% |   84.39 ns |         -2.93% |    66.38 ns |             N/A |
| unicode            |   79.35 ns |         +0.22% |  398.63 ns |         +3.93% |   253.03 ns |             N/A |
| long               |  211.15 ns |         +9.40% |  435.28 ns |         +1.97% |   493.05 ns |             N/A |
| obs                |  136.54 ns |         +1.90% |  490.09 ns |         -0.24% |    98.93 ns |             N/A |

### `is_valid`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev | Regex (avg) | Regex Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: | ----------: | --------------: |
| valid              |   32.94 ns |        +10.70% |   83.71 ns |         -0.84% |    64.28 ns |             N/A |
| invalid local part |   21.99 ns |         +3.82% |   84.35 ns |         +7.55% |    57.92 ns |             N/A |
| invalid domain     |   28.51 ns |         +1.16% |   84.61 ns |         -2.95% |    64.52 ns |             N/A |
| unicode            |   33.18 ns |         +5.87% |  168.06 ns |         +1.37% |    64.53 ns |             N/A |
| long               |  167.91 ns |        +11.76% |  231.57 ns |         -0.41% |   175.39 ns |             N/A |
| obs                |   87.41 ns |         +4.35% |  329.10 ns |         -3.51% |    70.25 ns |             N/A |

### `new`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev | Regex (avg) | Regex Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: | ----------: | --------------: |
| valid              |  146.39 ns |         +2.36% |  341.08 ns |         -5.16% |    99.49 ns |             N/A |
| invalid local part |  127.64 ns |         -0.89% |        N/A |            N/A |         N/A |             N/A |
| invalid domain     |  135.13 ns |        -39.63% |        N/A |            N/A |         N/A |             N/A |
| unicode            |  144.57 ns |         -0.53% |  577.63 ns |         -0.84% |   183.82 ns |             N/A |
| long               |  311.58 ns |         +6.25% |  562.42 ns |         -2.00% |   310.39 ns |             N/A |
| obs                |  136.33 ns |         +1.81% |  604.91 ns |         -7.73% |    42.10 ns |             N/A |


## v3.0.0-rc.1 (nom, no pest)

- Criterion setup: `--measurement-time 1 --warm-up-time 1`
- Tinybench setup: `--time-ms 1000` (`--iterations` and `--warmup-iterations` are runner limits/defaults)
- Delta columns compare against previous section: `v2.0.1 (baseline)`

### `parse`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: |
| valid              |   78.31 ns |        -90.31% |  249.83 ns |        -80.62% |
| invalid local part |   22.36 ns |        -94.65% |   84.66 ns |        -84.58% |
| invalid domain     |   32.23 ns |        -94.46% |   86.94 ns |        -88.35% |
| unicode            |   79.18 ns |        -90.93% |  383.55 ns |        -74.88% |
| long               |  193.00 ns |        -93.69% |  426.86 ns |        -91.46% |
| obs                |  134.00 ns |        -94.31% |  491.26 ns |        -83.20% |

### `is_valid`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: |
| valid              |   29.76 ns |        -96.71% |   84.42 ns |        -91.80% |
| invalid local part |   21.18 ns |        -95.11% |   78.43 ns |        -85.67% |
| invalid domain     |   28.18 ns |        -95.39% |   87.18 ns |        -88.16% |
| unicode            |   31.34 ns |        -96.27% |  165.79 ns |        -86.93% |
| long               |  150.24 ns |        -95.13% |  232.52 ns |        -95.10% |
| obs                |   83.77 ns |        -95.87% |  341.07 ns |        -87.38% |

### `new`

| Case               | Rust (avg) | Rust Δ vs prev | WASM (avg) | WASM Δ vs prev |
| ------------------ | ---------: | -------------: | ---------: | -------------: |
| valid              |  143.02 ns |        -84.83% |  359.64 ns |        -74.83% |
| invalid local part |  128.79 ns |        -78.66% |        N/A |            N/A |
| invalid domain     |  223.84 ns |        -76.31% |        N/A |            N/A |
| unicode            |  145.35 ns |        -85.74% |  582.50 ns |        -66.96% |
| long               |  293.24 ns |        -91.10% |  573.90 ns |        -88.85% |
| obs                |  133.90 ns |        -80.44% |  655.59 ns |        -76.16% |

## v2.0.1 (baseline)

### `parse`

| Case               | Rust (avg) | WASM (avg) |
| ------------------ | ---------: | ---------: |
| valid              |  807.84 ns |   1.289 µs |
| invalid local part |  417.78 ns |  549.05 ns |
| invalid domain     |  582.01 ns |  746.24 ns |
| unicode            |  872.69 ns |   1.527 µs |
| long               |   3.059 µs |   5.001 µs |
| obs                |   2.356 µs |   2.925 µs |

### `is_valid`

| Case               | Rust (avg) | WASM (avg) |
| ------------------ | ---------: | ---------: |
| valid              |  905.19 ns |   1.029 µs |
| invalid local part |  433.34 ns |  547.25 ns |
| invalid domain     |  611.00 ns |  736.42 ns |
| unicode            |  841.13 ns |   1.268 µs |
| long               |   3.087 µs |   4.741 µs |
| obs                |   2.029 µs |   2.703 µs |

### `new`

| Case               | Rust (avg) | WASM (avg) |
| ------------------ | ---------: | ---------: |
| valid              |  942.73 ns |   1.429 µs |
| invalid local part |  603.48 ns |        N/A |
| invalid domain     |  944.73 ns |        N/A |
| unicode            |   1.019 µs |   1.763 µs |
| long               |   3.295 µs |   5.147 µs |
| obs                |  684.61 ns |   2.750 µs |
