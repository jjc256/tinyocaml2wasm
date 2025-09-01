import { Scheme, Ty } from "./types";
import { ftvEnv, ftvTy, applyTy, freshTVar, Subst } from "./subst";

export type TyEnv = Map<string, Scheme>;

export function envEmpty(): TyEnv {
  return new Map();
}

export function envExtend(env: TyEnv, x: string, sc: Scheme): TyEnv {
  const newEnv = new Map(env);
  newEnv.set(x, sc);
  return newEnv;
}

export function generalize(env: TyEnv, ty: Ty): Scheme {
  const envVars = ftvEnv(env);
  const tyVars = ftvTy(ty);
  for (const v of envVars) tyVars.delete(v);
  return { forAll: Array.from(tyVars), ty };
}

export function instantiate(sc: Scheme): Ty {
  const subst: Subst = new Map();
  for (const id of sc.forAll) {
    subst.set(id, freshTVar());
  }
  return applyTy(subst, sc.ty);
}
