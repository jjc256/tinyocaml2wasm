import React from "react";

type Props = {
  source: string;
  onChange(src: string): void;
};

export default function EditorPane({ source, onChange }: Props) {
  return (
    <textarea
      value={source}
      onChange={(e) => onChange(e.target.value)}
      style={{ flex: 1, fontFamily: "monospace" }}
    />
  );
}
