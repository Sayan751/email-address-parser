# Performance Notes

Average time per operation (baseline `v2.0.0`), consolidated by API.

- Rust: Criterion (`cargo bench --bench benchmarks`)
- WASM: Tinybench (`npm run bench -- --json`)
- This baseline was rerun with an aligned ~1s measurement window: Criterion `--measurement-time 1 --warm-up-time 1`, Tinybench `--time-ms 1000`.
- Results are useful for trend tracking; absolute values depend on machine/runtime/harness.
- `N/A` in WASM `new` invalid cases: currently excluded from the npm benchmark because repeated throwing constructor calls destabilize the shared WASM instance during benchmarking.

<!-- Add performance report for new versions here. --->

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
