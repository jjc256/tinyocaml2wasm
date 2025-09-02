import { Expr, BinOp } from "./ast";

class ParseError extends Error {
  constructor(public line: number, public col: number, msg: string) {
    super(`ParseError(line=${line}, col=${col}, msg="${msg}")`);
  }
}

function formatToken(t: Token): string {
  switch (t.type) {
    case "int":
      return String(t.value);
    case "bool":
      return String(t.value);
    case "ident":
    case "keyword":
    case "symbol":
      return t.value;
    case "eof":
      return "<eof>";
  }
}

type Token =
  | { type: "int"; value: number; line: number; col: number }
  | { type: "bool"; value: boolean; line: number; col: number }
  | { type: "ident"; value: string; line: number; col: number }
  | { type: "keyword"; value: string; line: number; col: number }
  | { type: "symbol"; value: string; line: number; col: number }
  | { type: "eof"; line: number; col: number };

const keywords = new Set(["let", "rec", "in", "fun", "if", "then", "else"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = input.length;
  while (i < len) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\r") {
      i++; col++;
      continue;
    }
    if (c === "\n") {
      i++; line++; col = 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const startCol = col;
      let j = i;
      while (j < len && /[0-9]/.test(input[j])) j++;
      const num = Number(input.slice(i, j));
      tokens.push({ type: "int", value: num, line, col: startCol });
      col += j - i;
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const startCol = col;
      let j = i;
      while (j < len && /[a-zA-Z0-9_]/.test(input[j])) j++;
      const word = input.slice(i, j);
      if (word === "true" || word === "false") {
        tokens.push({ type: "bool", value: word === "true", line, col: startCol });
      } else if (keywords.has(word)) {
        tokens.push({ type: "keyword", value: word, line, col: startCol });
      } else {
        tokens.push({ type: "ident", value: word, line, col: startCol });
      }
      col += j - i;
      i = j;
      continue;
    }
    const startCol = col;
    // multi-char symbols
    if (c === "<" && input[i + 1] === "=") {
      tokens.push({ type: "symbol", value: "<=", line, col: startCol });
      i += 2; col += 2; continue;
    }
    if (c === "-" && input[i + 1] === ">") {
      tokens.push({ type: "symbol", value: "->", line, col: startCol });
      i += 2; col += 2; continue;
    }
    // single-char symbols
    if ("()+-*=<>,".includes(c)) {
      tokens.push({ type: "symbol", value: c, line, col: startCol });
      i++; col++; continue;
    }
    throw new ParseError(line, col, `'${c}' unexpected`);
  }
  tokens.push({ type: "eof", line, col });
  return tokens;
}

function isAtomStart(t: Token): boolean {
  return t.type === "int" || t.type === "bool" || t.type === "ident" || (t.type === "symbol" && t.value === "(");
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.pos];
  }
  private consume(): Token {
    return this.tokens[this.pos++];
  }
  private matchSymbol(sym: string): boolean {
    const t = this.peek();
    if (t.type === "symbol" && t.value === sym) {
      this.consume();
      return true;
    }
    return false;
  }
  private expectSymbol(sym: string, ctx: string): void {
    if (!this.matchSymbol(sym)) {
      const t = this.peek();
      throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after ${ctx}`);
    }
  }
  private matchKeyword(kw: string): boolean {
    const t = this.peek();
    if (t.type === "keyword" && t.value === kw) {
      this.consume();
      return true;
    }
    return false;
  }
  private expectKeyword(kw: string, ctx: string): void {
    if (!this.matchKeyword(kw)) {
      const t = this.peek();
      throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after ${ctx}`);
    }
  }
  private expectIdent(ctx: string): string {
    const t = this.peek();
    if (t.type === "ident") {
      this.consume();
      return t.value;
    }
    throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after ${ctx}`);
  }

  parseExpr(): Expr {
    if (this.matchKeyword("let")) {
      const isRec = this.matchKeyword("rec");
      const name = this.expectIdent(isRec ? "let rec" : "let");
      const params: string[] = [];
      while (this.peek().type === "ident") {
        params.push(this.expectIdent(isRec ? "let rec parameter" : "let parameter"));
      }
      if (isRec) {
        if (params.length === 0) {
          const t = this.peek();
          throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after let rec`);
        }
        this.expectSymbol("=", "let rec binding");
        let body = this.parseExpr();
        for (let i = params.length - 1; i >= 1; i--) {
          body = { tag: "Fun", param: params[i], body };
        }
        this.expectKeyword("in", "let rec binding");
        const inExpr = this.parseExpr();
        return { tag: "LetRec", name, param: params[0], body, inExpr };
      } else {
        this.expectSymbol("=", "let binding");
        let value = this.parseExpr();
        for (let i = params.length - 1; i >= 0; i--) {
          value = { tag: "Fun", param: params[i], body: value };
        }
        this.expectKeyword("in", "let binding");
        const body = this.parseExpr();
        return { tag: "Let", name, value, body };
      }
    }
    if (this.matchKeyword("if")) {
      const cond = this.parseExpr();
      this.expectKeyword("then","if expression");
      const then_ = this.parseExpr();
      this.expectKeyword("else","if expression");
      const else_ = this.parseExpr();
      return { tag: "If", cond, then_, else_ };
    }
    if (this.matchKeyword("fun")) {
      const param = this.expectIdent("fun");
      this.expectSymbol("->","fun parameter");
      const body = this.parseExpr();
      return { tag: "Fun", param, body };
    }
    return this.parseApp();
  }

  private parseApp(): Expr {
    let expr = this.parseCmp();
    while (isAtomStart(this.peek())) {
      const arg = this.parseAtom();
      expr = { tag: "App", callee: expr, arg };
    }
    return expr;
  }

  private parseCmp(): Expr {
    let expr = this.parseAdd();
    while (true) {
      const t = this.peek();
      if (t.type === "symbol" && (t.value === "=" || t.value === "<" || t.value === "<=")) {
        const op = t.value as BinOp;
        this.consume();
        const right = this.parseAdd();
        expr = { tag: "Prim", op, left: expr, right };
      } else {
        break;
      }
    }
    return expr;
  }

  private parseAdd(): Expr {
    let expr = this.parseMul();
    while (true) {
      const t = this.peek();
      if (t.type === "symbol" && (t.value === "+" || t.value === "-")) {
        const op = t.value as BinOp;
        this.consume();
        const right = this.parseMul();
        expr = { tag: "Prim", op, left: expr, right };
      } else {
        break;
      }
    }
    return expr;
  }

  private parseMul(): Expr {
    let expr = this.parseAtom();
    while (this.matchSymbol("*")) {
      const right = this.parseAtom();
      expr = { tag: "Prim", op: "*", left: expr, right };
    }
    return expr;
  }

  private parseAtom(): Expr {
    const t = this.peek();
    if (t.type === "int") {
      this.consume();
      return { tag: "Int", value: t.value };
    }
    if (t.type === "bool") {
      this.consume();
      return { tag: "Bool", value: t.value };
    }
    if (t.type === "ident") {
      this.consume();
      return { tag: "Var", name: t.value };
    }
    if (t.type === "symbol" && t.value === "(") {
      this.consume();
      if (this.matchSymbol(")")) {
        return { tag: "Unit" };
      }
      const first = this.parseExpr();
      if (this.matchSymbol(",")) {
        const elts: Expr[] = [first];
        do {
          elts.push(this.parseExpr());
        } while (this.matchSymbol(","));
        this.expectSymbol(")","tuple");
        return { tag: "Tuple", elts };
      } else {
        this.expectSymbol(")","grouping");
        return first;
      }
    }
    throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after atom`);
  }
}

export function parse(input: string): Expr {
  const tokens = tokenize(input);
  const p = new Parser(tokens);
  const expr = p.parseExpr();
  const t = p.peek();
  if (t.type !== "eof") {
    throw new ParseError(t.line, t.col, `${formatToken(t)} unexpected after expression`);
  }
  return expr;
}
