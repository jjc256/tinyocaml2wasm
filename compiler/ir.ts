import { BinOp } from "./ast";

export type Temp = number;

export type IR =
  | { tag: "ConstI"; n: number }
  | { tag: "ConstB"; b: boolean }
  | { tag: "Unit" }
  | { tag: "Let"; id: Temp; value: IR; body: IR }
  | { tag: "Var"; id: Temp }
  | { tag: "If"; cond: IR; then_: IR; else_: IR }
  | { tag: "Prim"; op: BinOp; a: IR; b: IR }
  | { tag: "MakeClosure"; funIndex: number; free: Temp[] }
  | { tag: "Call"; clos: Temp; arg: Temp }
  | { tag: "Tuple"; elts: Temp[] }
  | { tag: "Proj"; tuple: Temp; index: number };

export type IRFun = {
  index: number;
  param: Temp;
  env: Temp;
  body: IR;
  freeLayout: string[];
};

export type IRModule = { main: IR; funs: IRFun[]; nextTemp: number };
