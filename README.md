# Tiny OCaml → Wasm

*Tiny OCaml → WebAssembly in the browser. Algorithm W type inference. Benchmark toggle vs a naïve JS AST interpreter.*

## How to Run

```bash
pnpm i && pnpm dev
```

## Language Subset & Grammar

```bnf
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

## Architecture

`source → AST → W(typecheck) → IR(closure) → WAT → wasm (wabt.js) → run`

## Benchmarks

Runs benchmark programs in both JS and Wasm engines. Each test warms both engines, uses a sample size of ten iterations, randomizes run order, and reports median, min, mean, and stdev. "Run all benchmarks" reproduces results with a JS vs Wasm speedup chart and table.

