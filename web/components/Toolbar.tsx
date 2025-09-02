import React from "react";

type Props = {
  onParse(): void;
  onRunJS(): void;
  onCompileWAT(): void;
  onRunWasm(): void;
};

export default function Toolbar({ onParse, onRunJS, onCompileWAT, onRunWasm }: Props) {
  const btn = {
    marginRight: "4px",
  } as React.CSSProperties;
  return (
    <div style={{ padding: "4px", borderBottom: "1px solid #ccc" }}>
      <button style={btn} onClick={onParse}>
        Parse/Typecheck
      </button>
      <button style={btn} onClick={onRunJS}>
        Run (JS)
      </button>
      <button style={btn} onClick={onCompileWAT}>
        Compile (WAT)
      </button>
      <button style={btn} onClick={onRunWasm}>
        Run (Wasm)
      </button>
    </div>
  );
}
