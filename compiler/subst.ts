import { Ty, TVarId, Scheme, tVar } from "./types";
import type { TyEnv } from "./tyenv";

export type Subst = Map<TVarId, Ty>;

export function emptySubst(): Subst {
  return new Map();
}

export function applyTy(s: Subst, t: Ty): Ty {
  switch (t.tag) {
    case "TVar": {
      const ty = s.get(t.id);
      return ty ? applyTy(s, ty) : t;
    }
    case "TFun":
      return { tag: "TFun", from: applyTy(s, t.from), to: applyTy(s, t.to) };
    case "TTuple":
      return { tag: "TTuple", elts: t.elts.map((el) => applyTy(s, el)) };
    default:
      return t;
  }
}

export function applyScheme(s: Subst, sc: Scheme): Scheme {
  const filtered = new Map(s);
  for (const id of sc.forAll) {
    filtered.delete(id);
  }
  return { forAll: sc.forAll, ty: applyTy(filtered, sc.ty) };
}

export function compose(s2: Subst, s1: Subst): Subst {
  const result: Subst = new Map();
  for (const [v, ty] of s1.entries()) {
    result.set(v, applyTy(s2, ty));
  }
  for (const [v, ty] of s2.entries()) {
    result.set(v, ty);
  }
  return result;
}

export function ftvTy(t: Ty): Set<TVarId> {
  switch (t.tag) {
    case "TInt":
    case "TBool":
    case "TUnit":
      return new Set();
    case "TVar":
      return new Set([t.id]);
    case "TFun": {
      const s = ftvTy(t.from);
      for (const v of ftvTy(t.to)) s.add(v);
      return s;
    }
    case "TTuple": {
      const s = new Set<TVarId>();
      for (const el of t.elts) {
        for (const v of ftvTy(el)) s.add(v);
      }
      return s;
    }
  }
}

export function ftvScheme(sc: Scheme): Set<TVarId> {
  const vars = ftvTy(sc.ty);
  for (const id of sc.forAll) vars.delete(id);
  return vars;
}

export function ftvEnv(env: TyEnv): Set<TVarId> {
  const s = new Set<TVarId>();
  for (const [, sc] of env.entries()) {
    for (const v of ftvScheme(sc)) s.add(v);
  }
  return s;
}

export function freshTVar(): Ty {
  return tVar();
}
