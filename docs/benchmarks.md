# Benchmarks

The project includes a tiny harness to compare performance of the JavaScript
interpreter against the generated WebAssembly. Benchmark programs live under
`bench/programs` and can be executed from the **Benchmarks** panel in the web
UI.

## Programs

- `fib_rec.tiny` – naive recursive Fibonacci.
- `sum_tail.tiny` – three nested loops sum ten million numbers while keeping
  recursion depth manageable.
- `hof_map_fold.tiny` – exercises higher‑order functions and closures.
- `tuple_proj.tiny` – compares a tuple to itself ten million times using
  nested loops to avoid deep recursion.

## Running

Open the web app and click **Run all benchmarks**. Each program is run in both
engines with a warm‑up phase and a sample size of ten iterations. The median
execution time for the JS interpreter and the compiled Wasm module are shown
along with min/mean/stdev statistics. Speedup is reported as
`JS_time / Wasm_time`, falling back to the Wasm mean if the median is zero.
Results are shown with additional decimal precision so that even extremely fast
Wasm runs contribute a finite speedup value.
