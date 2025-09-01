
# Tiny OCaml → Wasm (with JS baseline) — Implementation Plan

## Legend for LLM legibility

* **Files**: exact paths you should create.
* **Exports**: function signatures the file must expose.
* **Tasks**: ordered TODOs with small diffs.
* **Tests**: concrete examples to validate behavior.
* **Done**: pass conditions to move on.

---

# Milestone 1 — AST & Parser (no types yet)

### Files

* `compiler/ast.ts`
* `compiler/parser.ts`
* `compiler/ast_printer.ts`
* `compiler/tests/parser.spec.ts`

### AST (compiler/ast.ts)

```ts
export type Ident = string;

export type BinOp = "+" | "-" | "*" | "=" | "<" | "<=";

export type Expr =
  | { tag: "Int"; value: number }
  | { tag: "Bool"; value: boolean }
  | { tag: "Unit" }
  | { tag: "Var"; name: Ident }
  | { tag: "Let"; name: Ident; value: Expr; body: Expr }
  | { tag: "LetRec"; name: Ident; param: Ident; body: Expr; inExpr: Expr } // only function rec
  | { tag: "Fun"; param: Ident; body: Expr }
  | { tag: "App"; callee: Expr; arg: Expr }
  | { tag: "If"; cond: Expr; then_: Expr; else_: Expr }
  | { tag: "Prim"; op: BinOp; left: Expr; right: Expr }
  | { tag: "Tuple"; elts: Expr[] };
```

### Parser (compiler/parser.ts)

**Exports**

```ts
export function parse(input: string): Expr;
```

**Tasks**

1. Tokenizer: ints, `true/false`, `()`, identifiers, keywords, symbols `let`, `rec`, `in`, `fun`, `->`, `if/then/else`, parens, commas, operators.
2. Pratt/precedence parser: `*` > `+ -` > comparisons.
3. Function application: left-associative (`e1 e2 e3` → `(e1 e2) e3`).
4. Parenthesized tuples: `(e1, e2, ...)` vs grouping `(e)`. Treat `( )` → `Unit`.

### AST pretty printer (compiler/ast\_printer.ts)

**Exports**

```ts
export function showAST(e: Expr): string;  // stable, single-line JSON-ish
```

### Tests (compiler/tests/parser.spec.ts)

* `let x = 1 in x+2`
* `let rec f n = if n<=1 then n else (f (n-1)) + (f (n-2)) in f 5`
* `(1, (2, 3))`
* `fun x -> x * 2`
* `f x y` parses as `(f x) y`

**Done**: `parse()` returns correct AST for fixtures; `showAST()` stable output.

---

# Milestone 2 — **Types & Algorithm W** (Option B)

### Files

* `compiler/types.ts`
* `compiler/subst.ts`
* `compiler/tyenv.ts`
* `compiler/algw.ts`
* `compiler/tests/types.spec.ts`

### Core type machinery (compiler/types.ts)

```ts
export type TVarId = number;
export type Ty =
  | { tag: "TInt" }
  | { tag: "TBool" }
  | { tag: "TUnit" }
  | { tag: "TFun"; from: Ty; to: Ty }
  | { tag: "TVar"; id: TVarId };

export type Scheme = { forAll: TVarId[]; ty: Ty };

export function tInt(): Ty;
export function tBool(): Ty;
export function tUnit(): Ty;
export function tFun(a: Ty, b: Ty): Ty;
export function tVar(id?: TVarId): Ty; // if id omitted, use fresh
```

### Substitutions & TVar supply (compiler/subst.ts)

```ts
export type Subst = Map<TVarId, Ty>; // mapping tvar -> type

export function emptySubst(): Subst;
export function compose(s2: Subst, s1: Subst): Subst; // apply s1 then s2
export function applyTy(s: Subst, t: Ty): Ty;
export function applyScheme(s: Subst, sc: Scheme): Scheme;
export function ftvTy(t: Ty): Set<TVarId>;
export function ftvScheme(sc: Scheme): Set<TVarId>;
export function ftvEnv(env: TyEnv): Set<TVarId>;
export function freshTVar(): Ty; // monotone counter
```

### Type environment (compiler/tyenv.ts)

```ts
import { Scheme, Ty } from "./types";

export type TyEnv = Map<string, Scheme>;

export function envEmpty(): TyEnv;
export function envExtend(env: TyEnv, x: string, sc: Scheme): TyEnv;

export function generalize(env: TyEnv, ty: Ty): Scheme; // Forall(ftv(ty) - ftv(env))
export function instantiate(sc: Scheme): Ty;            // replace quantified vars with fresh
```

### Unification + occurs check (in `algw.ts` or a separate `unify.ts`)

```ts
export function unify(t1: Ty, t2: Ty): Subst; // throws on mismatch/occurs
```

### Algorithm W (compiler/algw\.ts)

**Exports**

```ts
import { Expr } from "./ast";
import { Ty, Scheme } from "./types";
import { TyEnv } from "./tyenv";

export type InferResult = { subst: Subst; ty: Ty };

export function infer(env: TyEnv, e: Expr): InferResult;   // Algorithm W
export function typeOf(e: Expr): Ty;                        // infer in empty env + builtins
```

**Algorithm W sketch (LLM-friendly)**

* `infer(env, Int)` → `{[], TInt}`
* `infer(env, Bool)` → `{[], TBool}`
* `infer(env, Unit)` → `{[], TUnit}`
* `infer(env, Var x)`:

  * lookup `Scheme` in env, `instantiate` → `Ty`
* `infer(env, Prim(op,a,b))`:

  * for `+,-,*`: both `TInt` → `TInt`
  * for `=,<,<=`: operands same type (here use `TInt`), result `TBool`
  * unify as needed; compose substitutions left→right
* `infer(env, If c t e)`:

  * `c` \~ `TBool`; unify `type(t)` and `type(e)` → τ; result τ
* `infer(env, Fun x -> body)`:

  * α = fresh; infer under env\[x ↦ Forall(\[], α)] → τ
  * result `α -> τ` (apply accumulated subst to α, τ)
* `infer(env, App f a)`:

  * infer f → τ\_f, a → τ\_a
  * β = fresh; unify τ\_f with (τ\_a -> β); result β
* `infer(env, Let x = e1 in e2)`:

  * infer e1 → τ1 with s1
  * sc = generalize(s1(env), τ1)
  * infer e2 under s1(env)\[x ↦ sc]; compose s2∘s1
* `infer(env, LetRec f x = body in e2)` (function-only recursion):

  * α, β fresh; env1 = env ∪ { f ↦ Forall(\[], α→β), x ↦ Forall(\[], α) }
  * infer body in env1 → τ\_body; unify β \~ τ\_body
  * sc\_f = generalize(applied env, α→β)
  * infer e2 in env ∪ { f ↦ sc\_f }; compose

**Builtins**

* Add to the initial env:

  * `print_int : int -> unit`
  * `print_bool : bool -> unit`
  * `print_unit : unit -> unit`
  * `now_ms : unit -> int`

### Tests (compiler/tests/types.spec.ts)

```ts
// 1) Simple
typeOf(parse("1 + 2")) === TInt
typeOf(parse("if true then 1 else 2")) === TInt

// 2) Higher-order
typeOf(parse("let id = fun x -> x in id 3")) === TInt
typeOf(parse("let id = fun x -> x in id true")) === TBool

// 3) Let-generalization
typeOf(parse("let id = fun x -> x in (id 1, id true)")) === TTuple[Int,Bool]

// 4) Recursion
typeOf(parse("let rec f n = if n<=1 then n else f (n-1) in f 10")) === TInt
```

*(You may encode tuple type as `TTuple(Ty[])` if you keep tuples; otherwise drop tuple tests.)*

**Done**: All tests pass; type errors throw with helpful messages (unbound var, mismatch, occurs).

---

# Milestone 3 — Naïve JS Interpreter (baseline)

### Files

* `compiler/interpret.ts`
* `compiler/tests/interpret.spec.ts`

### Runtime value model (JS side)

```ts
export type Val =
  | { tag: "VInt"; v: number }
  | { tag: "VBool"; v: boolean }
  | { tag: "VUnit" }
  | { tag: "VClosure"; param: string; body: Expr; env: Env };

export type Env = Map<string, Val>;
```

**Exports**

```ts
export type Host = {
  print_int(n: number): void;
  print_bool(b: boolean): void;
  print_unit(): void;
  now_ms(): number;
};

export function evalExpr(e: Expr, host: Host): Val; // throws on runtime mismatch
```

**Tasks**

1. Evaluate per AST constructors.
2. Closures capture `env` at `Fun`.
3. Application: evaluate callee → VClosure, argument → Val, bind param, eval body.
4. Builtins: install as pre-populated `Env`.

**Tests**

* Run `fib`, `sum_to`, HOFs, `print_*`.

**Done**: Programs run and print; matches expectations.

---

# Milestone 4 — IR + Closure Conversion

### Files

* `compiler/ir.ts`
* `compiler/closure.ts`
* `compiler/tests/closure.spec.ts`

### IR (minimal)

```ts
export type Temp = number;

export type IR =
  | { tag: "ConstI"; n: number }
  | { tag: "ConstB"; b: boolean }
  | { tag: "Unit" }
  | { tag: "Let"; id: Temp; value: IR; body: IR }
  | { tag: "Var"; id: Temp }
  | { tag: "If"; cond: IR; then_: IR; else_: IR }
  | { tag: "Prim"; op: BinOp; a: IR; b: IR }
  | { tag: "MakeClosure"; funIndex: number; free: Temp[] }   // address at runtime
  | { tag: "Call"; clos: Temp; arg: Temp }                    // arg + clos
  | { tag: "Tuple"; elts: Temp[] }
  | { tag: "Proj"; tuple: Temp; index: number };

// Also keep a function table:
export type IRFun = {
  index: number;
  param: Temp;   // runtime arg
  env: Temp;     // runtime env pointer
  body: IR;
  freeLayout: string[]; // names->slots for free vars (debug)
};

export type IRModule = { main: IR; funs: IRFun[]; nextTemp: number };
```

**Exports**

```ts
export function toIR(e: Expr): IRModule; // does: naming, closure-conv, building fun table
```

**Tasks**

1. Convert named AST to temps (alpha-rename).
2. Compute free vars per function; introduce `MakeClosure`.
3. Calls carry `(arg, env)` at codegen time.

**Tests**

* `fun x -> fun y -> x+y` creates closure with `x` in env.
* `let rec f x = ...` closure refers to its own code index.

**Done**: IR text is stable (snapshot tests).

---

# Milestone 5 — Wasm Backend (Linear Memory, no GC)

### Files

* `compiler/codegen_wat.ts`
* `compiler/runtime_layout.ts`
* `compiler/tests/codegen.spec.ts`

### Runtime layout (compiler/runtime\_layout.ts)

```ts
export const TAG_TUPLE = 0;
export const TAG_CLOSURE = 1;

export const HEAP_BASE = 0x100; // bump pointer starts here

// Closure memory layout (i32 words):
// [ size | tag=1 | code_index | env_len | env0 | env1 | ... ]
// Tuple memory layout:
// [ size | tag=0 | f0 | f1 | ... ]
```

### Codegen (compiler/codegen\_wat.ts)

**Exports**

```ts
import { IRModule } from "./ir";

export type WasmText = string;

export function emitWAT(m: IRModule): WasmText; // deterministic
```

**Module template (conceptual)**

```wat
(module
  (import "host" "print_int" (func $print_int (param i32)))
  (import "host" "print_bool" (func $print_bool (param i32)))
  (import "host" "print_unit" (func $print_unit))
  (import "host" "now_ms" (func $now_ms (result i32)))

  (memory (export "mem") 2)
  (global $hp (mut i32) (i32.const 256)) ;; bump ptr

  (table funcref (elem $f0 $f1 ...))     ;; generated

  ;; helpers: alloc(nWords, tag) -> ptr
  (func $alloc (param $n i32) (param $tag i32) (result i32)
    ;; hp in words; store [size, tag]; advance; return ptr
  )

  ;; generated functions (type (param i32 i32) (result i32)) ;; (arg, env) -> result

  (func (export "main") (result i32)
    ;; evaluate IR 'main': build closures, call entry, return int (or 0)
  )
)
```

**Tasks**

1. Generate function table and wrapper signatures `(param i32 i32) (result i32)`.
2. Emit code for each IR node:

   * `ConstI/B/Unit` → push immediate (i32; bool as 0/1; unit as 0).
   * `MakeClosure` → call `$alloc`, fill words, return ptr (i32).
   * `Call` → load `code_index`, `call_indirect` with (arg, clos\_ptr).
   * `Prim` → numeric ops on i32.
   * `Tuple/Proj` → allocate & load offsets.
3. Allocate locals for temps; map temps to locals.
4. Ensure deterministic WAT (stable ordering).

**Tests**

* Compile `sum_to` and run in Node (via wabt) returns expected int.
* `print_*` imports invoked correctly (mock host prints captured).

**Done**: WAT builds in Node and browser (via `wabt.js`), `main()` runs.

---

# Milestone 6 — Web App (Editor + Inspectors + Run Buttons)

### Files

* `web/index.html`
* `web/main.tsx`, `web/App.tsx`
* `web/components/EditorPane.tsx`, `OutputTabs.tsx`, `BenchView.tsx`, `Toolbar.tsx`
* `web/lib/wabt.js` (bundled), `web/lib/wasmHost.ts`, `web/lib/timing.ts`

**Public APIs (web/lib/wasmHost.ts)**

```ts
export async function assembleWAT(wat: string): Promise<WebAssembly.Module>;
export async function runWasm(mod: WebAssembly.Module, imports?: any): Promise<number>;
export const defaultHost: any; // print_int/print_bool/print_unit/now_ms -> UI console
```

**UI behaviors**

* Buttons: **Parse/Typecheck**, **Run (JS)**, **Compile (WAT)**, **Run (Wasm)**.
* Tabs: **AST** (from `showAST`), **IR** (pretty printed), **WAT**, **Console**, **Perf**.
* Error panel: show parser/type errors with line/col if available.

**Done**: Paste program → compile → see AST/IR/WAT → run JS vs Wasm.

---

# Milestone 7 — Benchmarks (JS vs Wasm)

### Files

* `bench/programs/*.tiny`
* `web/components/BenchView.tsx`
* `docs/benchmarks.md`

**Programs**

* `fib_rec.tiny` (classic)
* `sum_tail.tiny` (tail recursion)
* `hof_map_fold.tiny` (closure stress, simple numeric loop)
* `tuple_proj.tiny` (loads)

**Harness (web/lib/timing.ts)**

```ts
export async function runBench(
  source: string,
  opts: { engine: "js" | "wasm"; iterations: number; warmup: number; }
): Promise<{ min: number; median: number; mean: number; stdev: number }>;
```

**Rules**

* Warmup both engines.
* Randomize engine order per test run.
* Display **median** bars (JS vs Wasm), plus table with min/mean/stdev.
* **Speedup** = `JS_time / Wasm_time` prominently shown.

**Done**: One click “Run all benchmarks” produces chart + table reproducibly.

---

## Appendix A — Minimal Grammar (for parser LLMs)

```
expr  := letrec | let | if | fun | app
letrec:= "let" "rec" ident ident "=" expr "in" expr
let   := "let" ident "=" expr "in" expr
if    := "if" expr "then" expr "else" expr
fun   := "fun" ident "->" expr
app   := cmp { atom }            // left-assoc application
cmp   := add { ("="|"<"|"<=") add }
add   := mul { ("+"|"-") mul }
mul   := atom { "*" atom }
atom  := INT | "true" | "false" | "()" | ident
       | "(" expr ("," expr)+ ")"   // tuple
       | "(" expr ")"               // grouping

ident := [a-zA-Z_][a-zA-Z0-9_]*
INT   := [0-9]+
```

## Appendix B — Error Messages (uniform & parseable)

* **ParseError**: `ParseError(line=<n>, col=<m>, msg="<token> unexpected after <context>")`
* **TypeError**:

  * `UnboundVariable(name=<id>)`
  * `Mismatch(expected=<Ty>, actual=<Ty>, context=<node>)`
  * `OccursCheck(tvar=<id>, in=<Ty>)`
  * `PrimOpType(op=<op>, left=<Ty>, right=<Ty>)`

## Appendix C — Builtins (initial typing + interpreter hooks)

* Types:

  * `print_int : int -> unit`
  * `print_bool : bool -> unit`
  * `print_unit : unit -> unit`
  * `now_ms : unit -> int`
* Interpreter `Env` binds these to host shims that call the UI console.
* Wasm imports under `"host"` module with matching names.

## Appendix D — What to show in README (copy/paste)

* One-liner: *“Tiny OCaml → WebAssembly in the browser. Algorithm W type inference. Benchmark toggle vs a naïve JS AST interpreter.”*
* How to run: `pnpm i && pnpm dev`.
* Language subset & grammar.
* Architecture diagram (text): `source → AST → W(typecheck) → IR(closure) → WAT → wasm (wabt.js) → run`.
* Bench methodology + reproducibility instructions.
