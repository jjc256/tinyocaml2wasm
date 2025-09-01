import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { showAST } from "../ast_printer";
import { Expr } from "../ast";

describe("parser", () => {
  it("let x = 1 in x+2", () => {
    const ast = parse("let x = 1 in x+2");
    const expected: Expr = {
      tag: "Let",
      name: "x",
      value: { tag: "Int", value: 1 },
      body: {
        tag: "Prim",
        op: "+",
        left: { tag: "Var", name: "x" },
        right: { tag: "Int", value: 2 }
      }
    };
    expect(showAST(ast)).toEqual(showAST(expected));
  });

  it("let rec f n = if n<=1 then n else (f (n-1)) + (f (n-2)) in f 5", () => {
    const src = "let rec f n = if n<=1 then n else (f (n-1)) + (f (n-2)) in f 5";
    const ast = parse(src);
    const expected: Expr = {
      tag: "LetRec",
      name: "f",
      param: "n",
      body: {
        tag: "If",
        cond: {
          tag: "Prim",
          op: "<=",
          left: { tag: "Var", name: "n" },
          right: { tag: "Int", value: 1 }
        },
        then_: { tag: "Var", name: "n" },
        else_: {
          tag: "Prim",
          op: "+",
          left: {
            tag: "App",
            callee: { tag: "Var", name: "f" },
            arg: {
              tag: "Prim",
              op: "-",
              left: { tag: "Var", name: "n" },
              right: { tag: "Int", value: 1 }
            }
          },
          right: {
            tag: "App",
            callee: { tag: "Var", name: "f" },
            arg: {
              tag: "Prim",
              op: "-",
              left: { tag: "Var", name: "n" },
              right: { tag: "Int", value: 2 }
            }
          }
        }
      },
      inExpr: {
        tag: "App",
        callee: { tag: "Var", name: "f" },
        arg: { tag: "Int", value: 5 }
      }
    };
    expect(showAST(ast)).toEqual(showAST(expected));
  });

  it("(1, (2, 3))", () => {
    const ast = parse("(1, (2, 3))");
    const expected: Expr = {
      tag: "Tuple",
      elts: [
        { tag: "Int", value: 1 },
        {
          tag: "Tuple",
          elts: [
            { tag: "Int", value: 2 },
            { tag: "Int", value: 3 }
          ]
        }
      ]
    };
    expect(showAST(ast)).toEqual(showAST(expected));
  });

  it("fun x -> x * 2", () => {
    const ast = parse("fun x -> x * 2");
    const expected: Expr = {
      tag: "Fun",
      param: "x",
      body: {
        tag: "Prim",
        op: "*",
        left: { tag: "Var", name: "x" },
        right: { tag: "Int", value: 2 }
      }
    };
    expect(showAST(ast)).toEqual(showAST(expected));
  });

  it("f x y parses as (f x) y", () => {
    const ast = parse("f x y");
    const expected: Expr = {
      tag: "App",
      callee: {
        tag: "App",
        callee: { tag: "Var", name: "f" },
        arg: { tag: "Var", name: "x" }
      },
      arg: { tag: "Var", name: "y" }
    };
    expect(showAST(ast)).toEqual(showAST(expected));
  });
});
