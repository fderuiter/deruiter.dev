"use client";

import React, { useId, useMemo, useState } from "react";
import {
  AMENDMENT_GRAPH,
  CHIP_SPECS,
  FULL_GRAPH,
  TRACER_GRAPH,
  WAVE1_GRAPH,
  type PipelineGraph,
} from "@/lib/protocol-drift";
import { toFlowEdges, toFlowNodes } from "./graph-model";
import { useProtocolDriftStore } from "./store";

const REFERENCE_PIPELINES: {
  id: string;
  label: string;
  graph: PipelineGraph;
}[] = [
  { id: "tracer", label: "Tracer: four chips (Site A)", graph: TRACER_GRAPH },
  {
    id: "wave1",
    label: "Wave 1: regex, locale dates, kPa",
    graph: WAVE1_GRAPH,
  },
  {
    id: "amendment",
    label: "Amendment 01: router and standing BP",
    graph: AMENDMENT_GRAPH,
  },
  { id: "full", label: "Full: with the ADaM lane", graph: FULL_GRAPH },
];

/**
 * Accessible text alternative to the canvas: every chip and wire as a list,
 * with keyboard-operable controls to add a wire or remove a chip or wire.
 */
export function PipelineTextView() {
  const nodes = useProtocolDriftStore((s) => s.nodes);
  const edges = useProtocolDriftStore((s) => s.edges);
  const connect = useProtocolDriftStore((s) => s.connect);
  const removeSelection = useProtocolDriftStore((s) => s.removeSelection);
  const loadTemplate = useProtocolDriftStore((s) => s.loadTemplate);
  const [reference, setReference] = useState(REFERENCE_PIPELINES[0].id);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const fromId = useId();
  const toId = useId();
  const refId = useId();

  const outputs = useMemo(
    () =>
      nodes.flatMap((n) =>
        CHIP_SPECS[n.data.kind].outputs.map((p) => ({
          value: `${n.id}::${p.handle}`,
          label: `${n.id}.${p.handle} (${p.type})`,
        }))
      ),
    [nodes]
  );
  const inputs = useMemo(
    () =>
      nodes.flatMap((n) =>
        CHIP_SPECS[n.data.kind].inputs.map((p) => ({
          value: `${n.id}::${p.handle}`,
          label: `${n.id}.${p.handle} (${p.type})`,
        }))
      ),
    [nodes]
  );

  const submit = () => {
    const [source, sourceHandle] = from.split("::");
    const [target, targetHandle] = to.split("::");
    if (!source || !target) return;
    void connect({ source, sourceHandle, target, targetHandle });
  };

  return (
    <details className="border-t border-zinc-800 bg-[#0d0e11] font-mono text-xs text-zinc-300">
      <summary className="min-h-8 cursor-pointer px-3 py-2 text-zinc-200 hover:text-amber-400">
        Pipeline as text ({nodes.length} chips, {edges.length} wires)
      </summary>
      <div className="grid max-h-48 gap-3 overflow-y-auto px-3 pb-3 @2xl:grid-cols-2">
        <section aria-label="Chips" className="min-w-0">
          <h3 className="mb-1 text-zinc-100">Chips</h3>
          {nodes.length === 0 ? (
            <p>No chips yet. Add one from the toolbox.</p>
          ) : (
            <ul className="space-y-1">
              {nodes.map((n) => (
                <li key={n.id} className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 break-words">
                    {n.id}: {n.data.kind},{" "}
                    {CHIP_SPECS[n.data.kind].lane.toLowerCase()} lane, at x
                    {Math.round(n.position.x)} y{Math.round(n.position.y)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeSelection([n.id], [])}
                    className="min-h-8 shrink-0 border border-zinc-700 px-2 hover:border-amber-500"
                    aria-label={`Remove chip ${n.id}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Wires" className="min-w-0">
          <h3 className="mb-1 text-zinc-100">Wires</h3>
          {edges.length === 0 ? (
            <p>No wires yet.</p>
          ) : (
            <ul className="space-y-1">
              {edges.map((e) => (
                <li key={e.id} className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 break-words">
                    {e.source}.{e.sourceHandle} to {e.target}.{e.targetHandle}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeSelection([], [e.id])}
                    className="min-h-8 shrink-0 border border-zinc-700 px-2 hover:border-amber-500"
                    aria-label={`Remove wire ${e.id}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label htmlFor={fromId} className="flex min-w-0 flex-col gap-1">
              From output
              <select
                id={fromId}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="min-h-8 max-w-56 border border-zinc-700 bg-[#13151a] text-zinc-100"
              >
                <option value="">Choose…</option>
                {outputs.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={toId} className="flex min-w-0 flex-col gap-1">
              To input
              <select
                id={toId}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="min-h-8 max-w-56 border border-zinc-700 bg-[#13151a] text-zinc-100"
              >
                <option value="">Choose…</option>
                {inputs.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={!from || !to}
              className="min-h-8 border border-amber-500 px-3 text-amber-400 disabled:border-zinc-700 disabled:text-zinc-400"
            >
              Connect
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-2">
            <label htmlFor={refId} className="flex min-w-0 flex-col gap-1">
              Load a reference pipeline (skips the design puzzle)
              <select
                id={refId}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="min-h-8 max-w-64 border border-zinc-700 bg-[#13151a] text-zinc-100"
              >
                {REFERENCE_PIPELINES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                const pick = REFERENCE_PIPELINES.find(
                  (r) => r.id === reference
                );
                if (pick) {
                  void loadTemplate({
                    nodes: toFlowNodes(pick.graph.nodes),
                    edges: toFlowEdges(pick.graph.edges),
                  });
                }
              }}
              className="min-h-8 border border-zinc-700 px-3 text-zinc-200 hover:border-amber-500"
            >
              Load
            </button>
          </div>
        </section>
      </div>
    </details>
  );
}
