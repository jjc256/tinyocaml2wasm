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
});
