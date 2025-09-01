import { IR, IRFun, IRModule } from "./ir";
import { HEAP_BASE, TAG_CLOSURE, TAG_TUPLE } from "./runtime_layout";

export type WasmText = string;

const builtinWrappers = [
  { name: "print_int", importName: "print_int", kind: "print_int" },
  { name: "print_bool", importName: "print_bool", kind: "print_bool" },
  { name: "print_unit", importName: "print_unit", kind: "print_unit" },
  { name: "now_ms", importName: "now_ms", kind: "now_ms" }
];

export function emitWAT(m: IRModule): WasmText {
  const lines: string[] = [];
  lines.push("(module");
  lines.push(
    "  (import \"host\" \"print_int\" (func $print_int (param i32)))"
  );
  lines.push(
    "  (import \"host\" \"print_bool\" (func $print_bool (param i32)))"
  );
  lines.push("  (import \"host\" \"print_unit\" (func $print_unit))");
  lines.push(
    "  (import \"host\" \"now_ms\" (func $now_ms (result i32)))"
  );
  lines.push("  (memory (export \"mem\") 2)");
  lines.push(
    `  (global $hp (mut i32) (i32.const ${HEAP_BASE}))`
  );
  lines.push("  (type $fn (func (param i32 i32) (result i32)))");
  const tableElems = [
    "$wrap_print_int",
    "$wrap_print_bool",
    "$wrap_print_unit",
    "$wrap_now_ms",
    ...m.funs.map((f) => `$f${f.index}`)
  ];
  lines.push(`  (table funcref (elem ${tableElems.join(" ")}))`);
  emitAlloc(lines);
  emitBuiltinWrappers(lines);
  m.funs
    .sort((a, b) => a.index - b.index)
    .forEach((f) => emitFun(f, lines, m.nextTemp));
  emitMain(lines, m.main, m.nextTemp);
  lines.push(")");
  return lines.join("\n");
}

function emitAlloc(lines: string[]) {
  lines.push(
    "  (func $alloc (param $n i32) (param $tag i32) (result i32)"
  );
  lines.push("    (local $p i32)");
  lines.push("    global.get $hp");
  lines.push("    local.tee $p");
  lines.push("    local.get $n");
  lines.push("    i32.store");
  lines.push("    local.get $p");
  lines.push("    i32.const 4");
  lines.push("    i32.add");
  lines.push("    local.get $tag");
  lines.push("    i32.store");
  lines.push("    global.get $hp");
  lines.push("    local.get $n");
  lines.push("    i32.const 4");
  lines.push("    i32.mul");
  lines.push("    i32.add");
  lines.push("    global.set $hp");
  lines.push("    local.get $p");
  lines.push("  )");
}

function emitBuiltinWrappers(lines: string[]) {
  for (const w of builtinWrappers) {
    lines.push(
      `  (func $wrap_${w.importName} (type $fn) (param i32 i32) (result i32)`
    );
    switch (w.importName) {
      case "print_int":
      case "print_bool":
        lines.push("    local.get 0");
        lines.push(`    call $${w.importName}`);
        lines.push("    i32.const 0");
        break;
      case "print_unit":
        lines.push(`    call $${w.importName}`);
        lines.push("    i32.const 0");
        break;
      case "now_ms":
        lines.push(`    call $${w.importName}`);
        break;
    }
    lines.push("  )");
  }
}

function emitFun(f: IRFun, lines: string[], nTemps: number) {
  lines.push(
    `  (func $f${f.index} (type $fn) (param $arg i32) (param $env i32) (result i32)`
  );
  emitLocals(lines, nTemps);
  lines.push(`    local.get $arg`);
  lines.push(`    local.set $t${f.param}`);
  lines.push(`    local.get $env`);
  lines.push(`    local.set $t${f.env}`);
  emitIR(f.body, lines, "    ");
  lines.push("  )");
}

function emitMain(lines: string[], main: IR, nTemps: number) {
  lines.push("  (func (export \"main\") (result i32)");
  emitLocals(lines, nTemps);
  emitBuiltinInits(lines);
  emitIR(main, lines, "    ");
  lines.push("  )");
}

function emitLocals(lines: string[], n: number) {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(`(local $t${i} i32)`);
  parts.push("(local $tmp i32)");
  lines.push(`    ${parts.join(" ")}`);
}

function emitBuiltinInits(lines: string[]) {
  for (let i = 0; i < builtinWrappers.length; i++) {
    lines.push("    i32.const 4");
    lines.push(`    i32.const ${TAG_CLOSURE}`);
    lines.push("    call $alloc");
    lines.push(`    local.set $t${i}`);
    lines.push(`    local.get $t${i}`);
    lines.push("    i32.const 8");
    lines.push("    i32.add");
    lines.push(`    i32.const ${i}`);
    lines.push("    i32.store");
    lines.push(`    local.get $t${i}`);
    lines.push("    i32.const 12");
    lines.push("    i32.add");
    lines.push("    i32.const 0");
    lines.push("    i32.store");
  }
}

function emitMakeClosure(
  ir: { funIndex: number; free: number[] },
  lines: string[],
  indent: string,
  self?: number
) {
  const nWords = ir.free.length + 4;
  lines.push(`${indent}i32.const ${nWords}`);
  lines.push(`${indent}i32.const ${TAG_CLOSURE}`);
  lines.push(`${indent}call $alloc`);
  if (self !== undefined) {
    lines.push(`${indent}local.set $t${self}`);
    lines.push(`${indent}local.get $t${self}`);
  } else {
    lines.push(`${indent}local.tee $tmp`);
  }
  lines.push(`${indent}i32.const 8`);
  lines.push(`${indent}i32.add`);
  lines.push(`${indent}i32.const ${ir.funIndex}`);
  lines.push(`${indent}i32.store`);
  if (self !== undefined) {
    lines.push(`${indent}local.get $t${self}`);
  } else {
    lines.push(`${indent}local.get $tmp`);
  }
  lines.push(`${indent}i32.const 12`);
  lines.push(`${indent}i32.add`);
  lines.push(`${indent}i32.const ${ir.free.length}`);
  lines.push(`${indent}i32.store`);
  for (let i = 0; i < ir.free.length; i++) {
    if (self !== undefined) {
      lines.push(`${indent}local.get $t${self}`);
    } else {
      lines.push(`${indent}local.get $tmp`);
    }
    lines.push(`${indent}i32.const ${16 + i * 4}`);
    lines.push(`${indent}i32.add`);
    if (self !== undefined && ir.free[i] === self) {
      lines.push(`${indent}local.get $t${self}`);
    } else {
      lines.push(`${indent}local.get $t${ir.free[i]}`);
    }
    lines.push(`${indent}i32.store`);
  }
  if (self !== undefined) {
    lines.push(`${indent}local.get $t${self}`);
  } else {
    lines.push(`${indent}local.get $tmp`);
  }
}

function emitIR(ir: IR, lines: string[], indent: string) {
  switch (ir.tag) {
    case "ConstI":
      lines.push(`${indent}i32.const ${ir.n}`);
      break;
    case "ConstB":
      lines.push(`${indent}i32.const ${ir.b ? 1 : 0}`);
      break;
    case "Unit":
      lines.push(`${indent}i32.const 0`);
      break;
    case "Var":
      lines.push(`${indent}local.get $t${ir.id}`);
      break;
    case "Let":
      if (ir.value.tag === "MakeClosure") {
        emitMakeClosure(ir.value, lines, indent, ir.id);
      } else {
        emitIR(ir.value, lines, indent);
      }
      lines.push(`${indent}local.set $t${ir.id}`);
      emitIR(ir.body, lines, indent);
      break;
    case "If":
      emitIR(ir.cond, lines, indent);
      lines.push(`${indent}if (result i32)`);
      emitIR(ir.then_, lines, indent + "  ");
      lines.push(`${indent}else`);
      emitIR(ir.else_, lines, indent + "  ");
      lines.push(`${indent}end`);
      break;
    case "Prim":
      emitIR(ir.a, lines, indent);
      emitIR(ir.b, lines, indent);
      switch (ir.op) {
        case "+":
          lines.push(`${indent}i32.add`);
          break;
        case "-":
          lines.push(`${indent}i32.sub`);
          break;
        case "*":
          lines.push(`${indent}i32.mul`);
          break;
        case "=":
          lines.push(`${indent}i32.eq`);
          break;
        case "<":
          lines.push(`${indent}i32.lt_s`);
          break;
        case "<=":
          lines.push(`${indent}i32.le_s`);
          break;
      }
      break;
    case "MakeClosure":
      emitMakeClosure(ir, lines, indent);
      break;
    case "Call":
      lines.push(`${indent}local.get $t${ir.arg}`);
      lines.push(`${indent}local.get $t${ir.clos}`);
      lines.push(`${indent}local.get $t${ir.clos}`);
      lines.push(`${indent}i32.load offset=8`);
      lines.push(`${indent}call_indirect (type $fn)`);
      break;
    case "Tuple": {
      const nWords = ir.elts.length + 2;
      lines.push(`${indent}i32.const ${nWords}`);
      lines.push(`${indent}i32.const ${TAG_TUPLE}`);
      lines.push(`${indent}call $alloc`);
      lines.push(`${indent}local.tee $tmp`);
      for (let i = 0; i < ir.elts.length; i++) {
        lines.push(`${indent}local.get $tmp`);
        lines.push(`${indent}i32.const ${8 + i * 4}`);
        lines.push(`${indent}i32.add`);
        lines.push(`${indent}local.get $t${ir.elts[i]}`);
        lines.push(`${indent}i32.store`);
      }
      lines.push(`${indent}local.get $tmp`);
      break;
    }
    case "Proj":
      lines.push(`${indent}local.get $t${ir.tuple}`);
      lines.push(`${indent}local.get $t${ir.tuple}`);
      lines.push(`${indent}i32.load offset=4`); // tag
      lines.push(`${indent}i32.const 8`);
      lines.push(`${indent}i32.mul`);
      lines.push(`${indent}i32.const ${8 + ir.index * 4}`);
      lines.push(`${indent}i32.add`);
      lines.push(`${indent}i32.add`);
      lines.push(`${indent}i32.load`);
      break;
  }
}
