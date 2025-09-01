import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { typeOf } from "../algw";
import { tInt, tBool } from "../types";

describe("types", () => {
  it("simple", () => {
    expect(typeOf(parse("1 + 2"))).toEqual(tInt());
    expect(typeOf(parse("if true then 1 else 2"))).toEqual(tInt());
  });

  it("higher-order", () => {
    expect(typeOf(parse("let id = fun x -> x in id 3"))).toEqual(tInt());
    expect(typeOf(parse("let id = fun x -> x in id true"))).toEqual(tBool());
  });

  it("let-generalization", () => {
    const ty = typeOf(parse("let id = fun x -> x in (id 1, id true)"));
    expect(ty).toEqual({ tag: "TTuple", elts: [tInt(), tBool()] });
  });

  it("recursion", () => {
    const ty = typeOf(
      parse("let rec f n = if n<=1 then n else f (n-1) in f 10")
    );
    expect(ty).toEqual(tInt());
  });
});
