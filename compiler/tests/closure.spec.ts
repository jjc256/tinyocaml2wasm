import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { toIR } from "../closure";

function getMakeClosure(ir: any): any {
  if (ir.tag === "MakeClosure") return ir;
  if (ir.tag === "Let") return getMakeClosure(ir.value);
  return undefined;
}

describe("closure conversion", () => {
  it("captures free vars", () => {
    const mod = toIR(parse("fun x -> fun y -> x + y"));
    expect(mod.funs.length).toBe(2);
    const inner = mod.funs[0];
    expect(inner.freeLayout).toEqual(["x"]);
    const outerBody = mod.funs[1].body as any;
    const mk = getMakeClosure(outerBody)!;
    expect(mk.funIndex).toBe(inner.index);
    expect(mk.free.length).toBe(1);
  });

  it("let rec closure has stable index", () => {
    const mod = toIR(parse("let rec f x = x in f"));
    const funIndex = mod.funs[0].index;
    const mk = getMakeClosure(mod.main)!;
    expect(mk.funIndex).toBe(funIndex);
  });

  it("handles nested let rec with multiple params", () => {
    const src = `
      let rec outer n acc =
        let rec inner k acc2 =
          if k <= 0 then acc2 else inner (k - 1) (acc2 + k)
        in
        inner 10 acc
      in
      outer 5 0
    `;
    expect(() => toIR(parse(src))).not.toThrow();
  });

  it("does not capture its own name in recursive helpers", () => {
    const src = `
      let rec loop n =
        fun acc ->
          if n <= 0 then acc else (loop (n - 1)) (acc + 1)
      in
      (loop 3) 0
    `;
    const mod = toIR(parse(src));
    expect(mod.funs[0].freeLayout).toContain("loop");
    expect(mod.funs[1].freeLayout).not.toContain("loop");
  });
});
