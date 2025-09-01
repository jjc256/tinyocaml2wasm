export type Ident = string;

export type BinOp = "+" | "-" | "*" | "=" | "<" | "<=";

export type Expr =
  | { tag: "Int"; value: number }
  | { tag: "Bool"; value: boolean }
  | { tag: "Unit" }
  | { tag: "Var"; name: Ident }
  | { tag: "Let"; name: Ident; value: Expr; body: Expr }
  | { tag: "LetRec"; name: Ident; param: Ident; body: Expr; inExpr: Expr }
  | { tag: "Fun"; param: Ident; body: Expr }
  | { tag: "App"; callee: Expr; arg: Expr }
  | { tag: "If"; cond: Expr; then_: Expr; else_: Expr }
  | { tag: "Prim"; op: BinOp; left: Expr; right: Expr }
  | { tag: "Tuple"; elts: Expr[] };
