import { Expr } from "./ast";
import { Ty, Scheme, tInt, tBool, tUnit, tFun } from "./types";
import { TyEnv, envEmpty, envExtend, generalize, instantiate } from "./tyenv";
import {
  Subst,
  emptySubst,
  compose,
  applyTy,
  applyScheme,
  ftvTy,
  freshTVar,
} from "./subst";

export type InferResult = { subst: Subst; ty: Ty };

function applyEnv(s: Subst, env: TyEnv): TyEnv {
  const newEnv = new Map<string, Scheme>();
  for (const [k, sc] of env.entries()) {
    newEnv.set(k, applyScheme(s, sc));
  }
  return newEnv;
}

function showTy(t: Ty): string {
  switch (t.tag) {
    case "TInt":
      return "int";
    case "TBool":
      return "bool";
    case "TUnit":
      return "unit";
    case "TFun":
      return `(${showTy(t.from)}->${showTy(t.to)})`;
    case "TTuple":
      return `(${t.elts.map(showTy).join(",")})`;
    case "TVar":
      return `'${t.id}`;
  }
}

function bind(id: number, ty: Ty): Subst {
  if (ty.tag === "TVar" && ty.id === id) return emptySubst();
  if (ftvTy(ty).has(id)) {
    throw new Error(`OccursCheck(tvar=${id}, in=${showTy(ty)})`);
  }
  const s: Subst = new Map();
  s.set(id, ty);
  return s;
}

function unify(t1: Ty, t2: Ty, ctx: string): Subst {
  if (t1.tag === "TFun" && t2.tag === "TFun") {
    const s1 = unify(t1.from, t2.from, ctx);
    const s2 = unify(applyTy(s1, t1.to), applyTy(s1, t2.to), ctx);
    return compose(s2, s1);
  }
  if (t1.tag === "TTuple" && t2.tag === "TTuple") {
    if (t1.elts.length !== t2.elts.length) {
      throw new Error(`Mismatch(expected=${showTy(t1)}, actual=${showTy(t2)}, context=${ctx})`);
    }
    let s = emptySubst();
    for (let i = 0; i < t1.elts.length; i++) {
      const s1 = unify(applyTy(s, t1.elts[i]), applyTy(s, t2.elts[i]), ctx);
      s = compose(s1, s);
    }
    return s;
  }
  if (t1.tag === "TVar") return bind(t1.id, t2);
  if (t2.tag === "TVar") return bind(t2.id, t1);
  if (t1.tag === t2.tag) return emptySubst();
  throw new Error(`Mismatch(expected=${showTy(t1)}, actual=${showTy(t2)}, context=${ctx})`);
}

export function infer(env: TyEnv, e: Expr): InferResult {
  switch (e.tag) {
    case "Int":
      return { subst: emptySubst(), ty: tInt() };
    case "Bool":
      return { subst: emptySubst(), ty: tBool() };
    case "Unit":
      return { subst: emptySubst(), ty: tUnit() };
    case "Var": {
      const sc = env.get(e.name);
      if (!sc) throw new Error(`UnboundVariable(name=${e.name})`);
      return { subst: emptySubst(), ty: instantiate(sc) };
    }
    case "Prim": {
      const r1 = infer(env, e.left);
      const env1 = applyEnv(r1.subst, env);
      const r2 = infer(env1, e.right);
      let subst = compose(r2.subst, r1.subst);
      try {
        const s3 = unify(applyTy(r2.subst, r1.ty), tInt(), "prim left");
        const s4 = unify(applyTy(s3, r2.ty), tInt(), "prim right");
        subst = compose(s4, compose(s3, subst));
      } catch (_err) {
        const lTy = applyTy(subst, r1.ty);
        const rTy = applyTy(subst, r2.ty);
        throw new Error(`PrimOpType(op=${e.op}, left=${showTy(lTy)}, right=${showTy(rTy)})`);
      }
      const resultTy = e.op === "+" || e.op === "-" || e.op === "*" ? tInt() : tBool();
      return { subst, ty: applyTy(subst, resultTy) };
    }
    case "If": {
      const rc = infer(env, e.cond);
      const sBool = unify(rc.ty, tBool(), "if condition");
      const env1 = applyEnv(compose(sBool, rc.subst), env);
      const rt = infer(env1, e.then_);
      const env2 = applyEnv(rt.subst, env1);
      const re = infer(env2, e.else_);
      const s3 = unify(applyTy(re.subst, rt.ty), re.ty, "if branches");
      const subst = compose(s3, compose(re.subst, compose(rt.subst, compose(sBool, rc.subst))));
      return { subst, ty: applyTy(subst, rt.ty) };
    }
    case "Fun": {
      const a = freshTVar();
      const env1 = envExtend(env, e.param, { forAll: [], ty: a });
      const r = infer(env1, e.body);
      return { subst: r.subst, ty: tFun(applyTy(r.subst, a), r.ty) };
    }
    case "App": {
      const r1 = infer(env, e.callee);
      const env1 = applyEnv(r1.subst, env);
      const r2 = infer(env1, e.arg);
      const b = freshTVar();
      const s3 = unify(applyTy(r2.subst, r1.ty), tFun(r2.ty, b), "application");
      const subst = compose(s3, compose(r2.subst, r1.subst));
      return { subst, ty: applyTy(subst, b) };
    }
    case "Let": {
      const r1 = infer(env, e.value);
      const env1 = applyEnv(r1.subst, env);
      const sc = generalize(env1, r1.ty);
      const env2 = envExtend(env1, e.name, sc);
      const r2 = infer(env2, e.body);
      const subst = compose(r2.subst, r1.subst);
      return { subst, ty: applyTy(r1.subst, r2.ty) };
    }
    case "LetRec": {
      const a = freshTVar();
      const b = freshTVar();
      const env1 = envExtend(env, e.name, { forAll: [], ty: tFun(a, b) });
      const env2 = envExtend(env1, e.param, { forAll: [], ty: a });
      const r1 = infer(env2, e.body);
      const s2 = unify(r1.ty, b, "let rec body");
      const s1 = compose(s2, r1.subst);
      const env3 = applyEnv(s1, env);
      const scf = generalize(env3, applyTy(s1, tFun(a, b)));
      const env4 = envExtend(env3, e.name, scf);
      const r2 = infer(env4, e.inExpr);
      const subst = compose(r2.subst, s1);
      return { subst, ty: applyTy(subst, r2.ty) };
    }
    case "Tuple": {
      let subst = emptySubst();
      let env1 = env;
      const tysRaw: Ty[] = [];
      for (const elt of e.elts) {
        const r = infer(env1, elt);
        subst = compose(r.subst, subst);
        env1 = applyEnv(r.subst, env1);
        tysRaw.push(r.ty);
      }
      return { subst, ty: { tag: "TTuple", elts: tysRaw.map(t => applyTy(subst, t)) } };
    }
  }
}

function initialEnv(): TyEnv {
  let env = envEmpty();
  env = envExtend(env, "print_int", { forAll: [], ty: tFun(tInt(), tUnit()) });
  env = envExtend(env, "print_bool", { forAll: [], ty: tFun(tBool(), tUnit()) });
  env = envExtend(env, "print_unit", { forAll: [], ty: tFun(tUnit(), tUnit()) });
  env = envExtend(env, "now_ms", { forAll: [], ty: tFun(tUnit(), tInt()) });
  return env;
}

export function typeOf(e: Expr): Ty {
  const { ty } = infer(initialEnv(), e);
  return ty;
}
