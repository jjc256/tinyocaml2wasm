import { Expr } from "./ast";
import { IR, IRFun, IRModule, Temp } from "./ir";

// Free variable analysis
function freeVars(e: Expr): Set<string> {
  switch (e.tag) {
    case "Int":
    case "Bool":
    case "Unit":
      return new Set();
    case "Var":
      return new Set([e.name]);
    case "Let": {
      const fv = freeVars(e.value);
      const bodyFv = freeVars(e.body);
      bodyFv.delete(e.name);
      return new Set([...fv, ...bodyFv]);
    }
    case "LetRec": {
      const bodyFv = freeVars(e.body);
      bodyFv.delete(e.name);
      const inFv = freeVars(e.inExpr);
      inFv.delete(e.name);
      return new Set([...bodyFv, ...inFv]);
    }
    case "Fun": {
      const fv = freeVars(e.body);
      fv.delete(e.param);
      return fv;
    }
    case "App": {
      const a = freeVars(e.callee);
      const b = freeVars(e.arg);
      return new Set([...a, ...b]);
    }
    case "If": {
      const c = freeVars(e.cond);
      const t = freeVars(e.then_);
      const el = freeVars(e.else_);
      return new Set([...c, ...t, ...el]);
    }
    case "Prim": {
      const l = freeVars(e.left);
      const r = freeVars(e.right);
      return new Set([...l, ...r]);
    }
    case "Tuple": {
      const sets = e.elts.map(freeVars);
      return sets.reduce((acc, s) => {
        s.forEach((x) => acc.add(x));
        return acc;
      }, new Set<string>());
    }
  }
}

let nextTemp = 0;
let nextFun = 0;

function freshTemp(): Temp {
  return nextTemp++;
}

export function toIR(e: Expr): IRModule {
  nextTemp = 0;
  nextFun = 0;
  const funs: IRFun[] = [];

  function lower(expr: Expr, env: Map<string, Temp>): IR {
    switch (expr.tag) {
      case "Int":
        return { tag: "ConstI", n: expr.value };
      case "Bool":
        return { tag: "ConstB", b: expr.value };
      case "Unit":
        return { tag: "Unit" };
      case "Var": {
        const t = env.get(expr.name);
        if (t === undefined) throw new Error(`Unbound variable ${expr.name}`);
        return { tag: "Var", id: t };
      }
      case "Let": {
        const id = freshTemp();
        const env2 = new Map(env);
        env2.set(expr.name, id);
        return {
          tag: "Let",
          id,
          value: lower(expr.value, env),
          body: lower(expr.body, env2)
        };
      }
      case "LetRec": {
        const id = freshTemp();
        const env2 = new Map(env);
        env2.set(expr.name, id);
        const clo = lowerFun(expr.name, expr.param, expr.body, env2);
        return {
          tag: "Let",
          id,
          value: clo,
          body: lower(expr.inExpr, env2)
        };
      }
      case "Fun":
        return lowerFun(undefined, expr.param, expr.body, env);
      case "App": {
        const closId = freshTemp();
        const argId = freshTemp();
        return {
          tag: "Let",
          id: closId,
          value: lower(expr.callee, env),
          body: {
            tag: "Let",
            id: argId,
            value: lower(expr.arg, env),
            body: { tag: "Call", clos: closId, arg: argId }
          }
        };
      }
      case "If":
        return {
          tag: "If",
          cond: lower(expr.cond, env),
          then_: lower(expr.then_, env),
          else_: lower(expr.else_, env)
        };
      case "Prim":
        return {
          tag: "Prim",
          op: expr.op,
          a: lower(expr.left, env),
          b: lower(expr.right, env)
        };
      case "Tuple": {
        const temps: Temp[] = new Array(expr.elts.length);
        let body: IR = { tag: "Tuple", elts: temps };
        for (let i = expr.elts.length - 1; i >= 0; i--) {
          const t = freshTemp();
          temps[i] = t;
          body = {
            tag: "Let",
            id: t,
            value: lower(expr.elts[i], env),
            body
          };
        }
        return body;
      }
    }
  }

  function lowerFun(name: string | undefined, param: string, body: Expr, env: Map<string, Temp>): IR {
    const index = nextFun++;
    const free = Array.from(freeVars(body));
    const paramTemp = freshTemp();
    const envTemp = freshTemp();
    const envForBody = new Map<string, Temp>();
    envForBody.set(param, paramTemp);
    const sortedFree = free.filter((x) => x !== param);
    sortedFree.sort();
    sortedFree.forEach((fv) => {
      const t = freshTemp();
      envForBody.set(fv, t);
    });
    let bodyIR = lower(body, envForBody);
    for (let i = sortedFree.length - 1; i >= 0; i--) {
      const fv = sortedFree[i];
      const t = envForBody.get(fv)!;
      bodyIR = {
        tag: "Let",
        id: t,
        value: { tag: "Proj", tuple: envTemp, index: i },
        body: bodyIR
      };
    }
    funs.push({ index, param: paramTemp, env: envTemp, body: bodyIR, freeLayout: sortedFree });
    const freeTemps = sortedFree.map((fv) => {
      const t = env.get(fv);
      if (t === undefined) throw new Error(`Unbound free var ${fv}`);
      return t;
    });
    return { tag: "MakeClosure", funIndex: index, free: freeTemps };
  }

  const main = lower(e, new Map());
  return { main, funs, nextTemp };
}
