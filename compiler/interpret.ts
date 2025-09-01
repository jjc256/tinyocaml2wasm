import { Expr, BinOp } from "./ast";

export type Val =
  | { tag: "VInt"; v: number }
  | { tag: "VBool"; v: boolean }
  | { tag: "VUnit" }
  | { tag: "VClosure"; param: string; body: Expr; env: Env }
  | { tag: "VTuple"; elts: Val[] }
  | { tag: "VBuiltin"; fn: (arg: Val, host: Host) => Val };

export type Env = Map<string, Val>;

export type Host = {
  print_int(n: number): void;
  print_bool(b: boolean): void;
  print_unit(): void;
  now_ms(): number;
};

function initialEnv(host: Host): Env {
  const env: Env = new Map();
  env.set("print_int", {
    tag: "VBuiltin",
    fn(arg, h) {
      if (arg.tag !== "VInt") throw new Error("print_int expects int");
      h.print_int(arg.v);
      return { tag: "VUnit" };
    }
  });
  env.set("print_bool", {
    tag: "VBuiltin",
    fn(arg, h) {
      if (arg.tag !== "VBool") throw new Error("print_bool expects bool");
      h.print_bool(arg.v);
      return { tag: "VUnit" };
    }
  });
  env.set("print_unit", {
    tag: "VBuiltin",
    fn(arg, h) {
      if (arg.tag !== "VUnit") throw new Error("print_unit expects unit");
      h.print_unit();
      return { tag: "VUnit" };
    }
  });
  env.set("now_ms", {
    tag: "VBuiltin",
    fn(arg, h) {
      if (arg.tag !== "VUnit") throw new Error("now_ms expects unit");
      return { tag: "VInt", v: h.now_ms() };
    }
  });
  return env;
}

export function evalExpr(e: Expr, host: Host): Val {
  const env = initialEnv(host);
  return evalExprEnv(e, env, host);
}

function evalExprEnv(e: Expr, env: Env, host: Host): Val {
  switch (e.tag) {
    case "Int":
      return { tag: "VInt", v: e.value };
    case "Bool":
      return { tag: "VBool", v: e.value };
    case "Unit":
      return { tag: "VUnit" };
    case "Var": {
      const v = env.get(e.name);
      if (!v) throw new Error(`Unbound variable ${e.name}`);
      return v;
    }
    case "Let": {
      const val = evalExprEnv(e.value, env, host);
      const newEnv = new Map(env);
      newEnv.set(e.name, val);
      return evalExprEnv(e.body, newEnv, host);
    }
    case "LetRec": {
      const newEnv = new Map(env);
      const clo: Val = {
        tag: "VClosure",
        param: e.param,
        body: e.body,
        env: newEnv
      };
      newEnv.set(e.name, clo);
      return evalExprEnv(e.inExpr, newEnv, host);
    }
    case "Fun":
      return { tag: "VClosure", param: e.param, body: e.body, env };
    case "App": {
      const fnVal = evalExprEnv(e.callee, env, host);
      const argVal = evalExprEnv(e.arg, env, host);
      if (fnVal.tag === "VClosure") {
        const callEnv = new Map(fnVal.env);
        callEnv.set(fnVal.param, argVal);
        return evalExprEnv(fnVal.body, callEnv, host);
      } else if (fnVal.tag === "VBuiltin") {
        return fnVal.fn(argVal, host);
      }
      throw new Error("Attempt to call non-function");
    }
    case "If": {
      const cond = evalExprEnv(e.cond, env, host);
      if (cond.tag !== "VBool") throw new Error("if condition not boolean");
      return cond.v
        ? evalExprEnv(e.then_, env, host)
        : evalExprEnv(e.else_, env, host);
    }
    case "Prim": {
      const l = evalExprEnv(e.left, env, host);
      const r = evalExprEnv(e.right, env, host);
      return evalPrim(e.op, l, r);
    }
    case "Tuple":
      return { tag: "VTuple", elts: e.elts.map((x) => evalExprEnv(x, env, host)) };
  }
}

function evalPrim(op: BinOp, l: Val, r: Val): Val {
  switch (op) {
    case "+":
      if (l.tag === "VInt" && r.tag === "VInt")
        return { tag: "VInt", v: l.v + r.v };
      break;
    case "-":
      if (l.tag === "VInt" && r.tag === "VInt")
        return { tag: "VInt", v: l.v - r.v };
      break;
    case "*":
      if (l.tag === "VInt" && r.tag === "VInt")
        return { tag: "VInt", v: l.v * r.v };
      break;
    case "=":
      if (l.tag === r.tag) {
        switch (l.tag) {
          case "VInt":
            return { tag: "VBool", v: l.v === (r as any).v };
          case "VBool":
            return { tag: "VBool", v: l.v === (r as any).v };
          case "VUnit":
            return { tag: "VBool", v: true };
          case "VTuple": {
            const rT = r as any;
            if (l.elts.length !== rT.elts.length) throw new Error("tuple arity mismatch");
            for (let i = 0; i < l.elts.length; i++) {
              const res = evalPrim("=", l.elts[i], rT.elts[i]);
              if (res.tag !== "VBool" || !res.v) return { tag: "VBool", v: false };
            }
            return { tag: "VBool", v: true };
          }
        }
      }
      break;
    case "<":
      if (l.tag === "VInt" && r.tag === "VInt")
        return { tag: "VBool", v: l.v < r.v };
      break;
    case "<=":
      if (l.tag === "VInt" && r.tag === "VInt")
        return { tag: "VBool", v: l.v <= r.v };
      break;
  }
  throw new Error(`invalid operands for ${op}`);
}
