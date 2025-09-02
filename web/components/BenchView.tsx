import React, { useState } from "react";
import { runBench } from "../lib/timing";

type Engine = "js" | "wasm";
type Stats = { min: number; median: number; mean: number; stdev: number };
type BenchResult = { js: Stats; wasm: Stats; speedup: number };

// Import benchmark sources as raw strings so Vite bundles them.
import fibRec from "../../bench/programs/fib_rec.tiny?raw";
import sumTail from "../../bench/programs/sum_tail.tiny?raw";
import hofMapFold from "../../bench/programs/hof_map_fold.tiny?raw";
import tupleProj from "../../bench/programs/tuple_proj.tiny?raw";

const programs: { name: string; src: string }[] = [
  { name: "fib_rec", src: fibRec },
  { name: "sum_tail", src: sumTail },
  { name: "hof_map_fold", src: hofMapFold },
  { name: "tuple_proj", src: tupleProj }
];

export default function BenchView() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, BenchResult>>({});

  async function runAll() {
    setRunning(true);
    const out: Record<string, BenchResult> = {};
    for (const p of programs) {
      const src = p.src;
      const order: Engine[] = ["js", "wasm"];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const stats: Record<Engine, Stats> = {
        js: { min: 0, median: 0, mean: 0, stdev: 0 },
        wasm: { min: 0, median: 0, mean: 0, stdev: 0 }
      };
      for (const eng of order) {
        stats[eng] = await runBench(src, {
          engine: eng,
          iterations: 2,
          warmup: 1
        });
      }
      const wasmTime =
        stats.wasm.median > 0 ? stats.wasm.median : stats.wasm.mean;
      const speedup =
        wasmTime > 0 ? stats.js.median / wasmTime : NaN;
      out[p.name] = { js: stats.js, wasm: stats.wasm, speedup };
    }
    setResults(out);
    setRunning(false);
  }

  const engines: Engine[] = ["js", "wasm"];

  return (
    <div
      style={{
        width: "300px",
        borderLeft: "1px solid #ccc",
        padding: "4px",
        overflowY: "auto"
      }}
    >
      <h3>Benchmarks</h3>
      <button onClick={runAll} disabled={running} style={{ marginBottom: "8px" }}>
        {running ? "Running..." : "Run all benchmarks"}
      </button>
      {Object.entries(results).map(([name, r]) => {
        const max = Math.max(r.js.median, r.wasm.median);
        return (
          <div key={name} style={{ marginBottom: "12px" }}>
            <div style={{ fontWeight: "bold" }}>{name}</div>
            <div style={{ display: "flex", height: "8px", margin: "4px 0" }}>
              <div
                style={{
                  background: "#f99",
                  width: `${(r.js.median / max) * 100}%`,
                  marginRight: "2px"
                }}
              />
              <div
                style={{
                  background: "#9cf",
                  width: `${(r.wasm.median / max) * 100}%`
                }}
              />
            </div>
            <div style={{ fontSize: "12px" }}>
              Speedup:{" "}
              {Number.isFinite(r.speedup) ? `${r.speedup.toFixed(2)}x` : "N/A"}
            </div>
            <table
              style={{
                width: "100%",
                fontSize: "10px",
                borderCollapse: "collapse",
                marginTop: "4px"
              }}
            >
              <thead>
                <tr>
                  <th></th>
                  <th>min</th>
                  <th>median</th>
                  <th>mean</th>
                  <th>stdev</th>
                </tr>
              </thead>
              <tbody>
                {engines.map((e) => (
                  <tr key={e}>
                    <td>{e}</td>
                    <td>{r[e].min.toFixed(4)}</td>
                    <td>{r[e].median.toFixed(4)}</td>
                    <td>{r[e].mean.toFixed(4)}</td>
                    <td>{r[e].stdev.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
