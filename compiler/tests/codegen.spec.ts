import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { toIR } from "../closure";
import { emitWAT } from "../codegen_wat";
import wabt from "wabt";

async function runWat(src: string, hostImpl?: any) {
  const ir = toIR(parse(src));
  const wat = emitWAT(ir);
  const wabtMod = await wabt();
  const mod = wabtMod.parseWat("test.wat", wat);
  const { buffer } = mod.toBinary({}) as { buffer: Uint8Array };
  const host = hostImpl || {};
  const imports = {
    host: {
      print_int(n: number) {
        host.print_int?.(n);
      },
      print_bool(b: number) {
        host.print_bool?.(!!b);
      },
      print_unit() {
        host.print_unit?.();
      },
      now_ms() {
        return host.now_ms ? host.now_ms() : 0;
      }
    }
  };
  const { instance } = (await WebAssembly.instantiate(
    buffer,
    imports
  )) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
  const res = (instance.exports.main as Function)();
  return { res, host };
}

describe("codegen_wat", () => {
  it("sum_to", async () => {
    const src = "let rec sum n = if n<=0 then 0 else n + (sum (n-1)) in sum 5";
    const { res } = await runWat(src);
    expect(res).toBe(15);
  });

  it("builtins", async () => {
    const logs: any[] = [];
    const host = {
      print_int: (n: number) => logs.push(n),
      print_bool: (b: boolean) => logs.push(b),
      print_unit: () => logs.push("unit"),
      now_ms: () => 123
    };
    const src =
      "let _ = print_int 41 in let _ = print_bool false in let _ = print_unit () in now_ms ()";
    const { res } = await runWat(src, host);
    expect(logs).toEqual([41, false, "unit"]);
    expect(res).toBe(123);
  });
});
