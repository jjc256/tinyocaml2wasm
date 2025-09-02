import { parse } from "../../compiler/parser";
import { evalExpr } from "../../compiler/interpret";
import { toIR } from "../../compiler/closure";
import { emitWAT } from "../../compiler/codegen_wat";
import { assembleWAT, runWasm } from "./wasmHost";

export async function runBench(
  source: string,
  opts: { engine: "js" | "wasm"; iterations: number; warmup: number }
): Promise<{ min: number; median: number; mean: number; stdev: number }> {
  const times: number[] = [];
  const total = opts.warmup + opts.iterations;

  if (opts.engine === "js") {
    const ast = parse(source);
    const host = {
      print_int(_n: number) {},
      print_bool(_b: boolean) {},
      print_unit() {},
      now_ms() {
        return Date.now();
      }
    };
    for (let i = 0; i < total; i++) {
      const t0 = performance.now();
      evalExpr(ast, host);
      const t1 = performance.now();
      if (i >= opts.warmup) times.push(t1 - t0);
    }
  } else {
    const ast = parse(source);
    const ir = toIR(ast);
    const wat = emitWAT(ir);
    const mod = await assembleWAT(wat);
    const imports = {
      host: {
        print_int(_n: number) {},
        print_bool(_b: number) {},
        print_unit() {},
        now_ms() {
          return Date.now();
        }
      }
    };
    for (let i = 0; i < total; i++) {
      const t0 = performance.now();
      await runWasm(mod, imports);
      const t1 = performance.now();
      if (i >= opts.warmup) times.push(t1 - t0);
    }
  }

  times.sort((a, b) => a - b);
  const min = times[0];
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const stdev = Math.sqrt(
    times.reduce((a, b) => a + (b - mean) * (b - mean), 0) / times.length
  );
  return { min, median, mean, stdev };
}
