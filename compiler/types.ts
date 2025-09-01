export type TVarId = number;

export type Ty =
  | { tag: "TInt" }
  | { tag: "TBool" }
  | { tag: "TUnit" }
  | { tag: "TFun"; from: Ty; to: Ty }
  | { tag: "TTuple"; elts: Ty[] }
  | { tag: "TVar"; id: TVarId };

export type Scheme = { forAll: TVarId[]; ty: Ty };

export function tInt(): Ty {
  return { tag: "TInt" };
}

export function tBool(): Ty {
  return { tag: "TBool" };
}

export function tUnit(): Ty {
  return { tag: "TUnit" };
}

export function tFun(a: Ty, b: Ty): Ty {
  return { tag: "TFun", from: a, to: b };
}

let nextTVarId = 0;

export function tVar(id?: TVarId): Ty {
  return { tag: "TVar", id: id ?? nextTVarId++ };
}

export function tTuple(elts: Ty[]): Ty {
  return { tag: "TTuple", elts };
}
