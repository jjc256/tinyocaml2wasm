import React, { useState } from "react";

type Props = {
  ast: string;
  ir: string;
  wat: string;
  console: string[];
};

const tabs = ["AST", "IR", "WAT", "Console"] as const;

export default function OutputTabs({ ast, ir, wat, console }: Props) {
  const [active, setActive] = useState<(typeof tabs)[number]>("AST");

  let content = "";
  switch (active) {
    case "AST":
      content = ast;
      break;
    case "IR":
      content = ir;
      break;
    case "WAT":
      content = wat;
      break;
    case "Console":
      content = console.join("\n");
      break;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            style={{
              padding: "4px 8px",
              background: active === t ? "#ddd" : "#f0f0f0",
              border: "none",
              cursor: "pointer"
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <pre style={{ flex: 1, margin: 0, overflow: "auto" }}>{content}</pre>
    </div>
  );
}
