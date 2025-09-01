import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { evalExpr, Host, Val } from "../interpret";

function makeHost() {
  const out: any[] = [];
  const host: Host = {
    print_int(n: number) {
      out.push(n);
    },
    print_bool(b: boolean) {
      out.push(b);
    },
    print_unit() {
      out.push("unit");
    },
    now_ms() {
      return 123;
    }
  };
  return { host, out };
}

describe("interpret", () => {
  it("fib", () => {
    const { host } = makeHost();
    const src = "let rec fib n = if n<=1 then n else (fib (n-1)) + (fib (n-2)) in fib 5";
    const v = evalExpr(parse(src), host);
    expect(v).toEqual({ tag: "VInt", v: 5 });
  });

  it("sum_to", () => {
    const { host } = makeHost();
    const src = "let rec sum n = if n<=0 then 0 else n + (sum (n-1)) in sum 5";
    const v = evalExpr(parse(src), host);
    expect(v).toEqual({ tag: "VInt", v: 15 });
  });

  it("higher-order closures", () => {
    const { host } = makeHost();
    const src = "let add = fun x -> fun y -> x + y in let add5 = add 5 in add5 3";
    const v = evalExpr(parse(src), host);
    expect(v).toEqual({ tag: "VInt", v: 8 });
  });

  it("builtins", () => {
    const { host, out } = makeHost();
    const src =
      "let _ = print_int 41 in let _ = print_bool false in let _ = print_unit () in now_ms ()";
    const v = evalExpr(parse(src), host);
    expect(out).toEqual([41, false, "unit"]);
    expect(v).toEqual({ tag: "VInt", v: 123 });
  });
});
