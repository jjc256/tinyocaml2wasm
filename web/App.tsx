import React, { useState } from "react";
import { parse } from "../compiler/parser";
import { showAST } from "../compiler/ast_printer";
import { toIR } from "../compiler/closure";
import { emitWAT } from "../compiler/codegen_wat";
import { evalExpr, Val } from "../compiler/interpret";
import { assembleWAT, runWasm } from "./lib/wasmHost";
import EditorPane from "./components/EditorPane";
import OutputTabs from "./components/OutputTabs";
import Toolbar from "./components/Toolbar";
import BenchView from "./components/BenchView";

function showVal(v: Val): string {
  switch (v.tag) {
    case "VInt":
      return v.v.toString();
    case "VBool":
      return v.v.toString();
    case "VUnit":
      return "()";
    case "VTuple":
      return "(" + v.elts.map(showVal).join(", ") + ")";
    case "VClosure":
      return "<fun>";
    case "VBuiltin":
      return "<builtin>";
  }
}

export default function App() {
  const [source, setSource] = useState<string>("let x = 1 in x + 2");
  const [ast, setAst] = useState<string>("");
  const [ir, setIr] = useState<string>("");
  const [wat, setWat] = useState<string>("");
  const [consoleOut, setConsoleOut] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    try {
      const e = parse(source);
      setAst(showAST(e));
      const irm = toIR(e);
      setIr(JSON.stringify(irm, null, 2));
      const watText = emitWAT(irm);
      setWat(watText);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    }
  }

  function handleRunJS() {
    try {
      const e = parse(source);
      const logs: string[] = [];
      const host = {
        print_int(n: number) {
          logs.push(String(n));
        },
        print_bool(b: boolean) {
          logs.push(String(b));
        },
        print_unit() {
          logs.push("()");
        },
        now_ms() {
          return Date.now();
        }
      };
      const res = evalExpr(e, host);
      logs.push("=> " + showVal(res));
      setConsoleOut(logs);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    }
  }

  async function handleCompileWAT() {
    await handleParse();
  }

  async function handleRunWasm() {
    try {
      const e = parse(source);
      const irm = toIR(e);
      const watText = emitWAT(irm);
      setWat(watText);
      const mod = await assembleWAT(watText);
      const logs: string[] = [];
      const imports = {
        host: {
          print_int(n: number) {
            logs.push(String(n));
          },
          print_bool(b: number) {
            logs.push(String(!!b));
          },
          print_unit() {
            logs.push("()");
          },
          now_ms() {
            return Date.now();
          }
        }
      };
      const res = await runWasm(mod, imports);
      logs.push("=> " + String(res));
      setConsoleOut(logs);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    }
  }

  return (
    <div style={{ display: "flex", flex: 1 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Toolbar
          onParse={handleParse}
          onRunJS={handleRunJS}
          onCompileWAT={handleCompileWAT}
          onRunWasm={handleRunWasm}
        />
        <div style={{ flex: 1, display: "flex" }}>
          <EditorPane source={source} onChange={setSource} />
          <OutputTabs ast={ast} ir={ir} wat={wat} console={consoleOut} />
        </div>
        {error && (
          <div style={{ color: "red", padding: "4px" }}>{error}</div>
        )}
      </div>
      <BenchView />
    </div>
  );
}
