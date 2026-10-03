"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CHIP_SPECS, type ChipLane } from "@/lib/protocol-drift";
import {
  CHIP_WIDTH,
  PIN_LAYOUT,
  chipHeight,
  type ChipNode,
} from "./graph-model";

const LANE_STYLE: Record<ChipLane, { border: string; tag: string }> = {
  TABULATION: { border: "border-slate-400/60", tag: "text-slate-300" },
  WALL: { border: "border-amber-500/70", tag: "text-amber-400" },
  ANALYSIS: { border: "border-emerald-500/60", tag: "text-emerald-400" },
};

const LANE_TAG: Record<ChipLane, string> = {
  TABULATION: "SDTM",
  WALL: "WALL",
  ANALYSIS: "ADaM",
};

/** One chip on the pipeline canvas, with a labelled pin per port. */
export function ChipNodeView({ data, selected }: NodeProps<ChipNode>) {
  const spec = CHIP_SPECS[data.kind];
  const style = LANE_STYLE[spec.lane];
  const rows = Math.max(spec.inputs.length, spec.outputs.length);
  const pinTop = (index: number) =>
    PIN_LAYOUT.headerPx + index * PIN_LAYOUT.rowPx + PIN_LAYOUT.rowPx / 2;

  return (
    <div
      data-chip-kind={data.kind}
      style={{ width: CHIP_WIDTH, height: chipHeight(data.kind) }}
      className={`relative border bg-[#13151a] font-mono text-zinc-100 ${style.border} ${
        selected ? "ring-1 ring-amber-500" : ""
      }`}
    >
      <div
        className="flex items-center justify-between gap-1 border-b border-zinc-800 px-2"
        style={{ height: PIN_LAYOUT.headerPx }}
      >
        <span className="min-w-0 truncate text-[11px] font-semibold">
          {data.kind}
        </span>
        <span className={`shrink-0 text-[9px] ${style.tag}`}>
          {LANE_TAG[spec.lane]}
        </span>
      </div>
      {Array.from({ length: rows }, (_, index) => {
        const input = spec.inputs[index];
        const output = spec.outputs[index];
        return (
          <div
            key={index}
            className="flex items-center justify-between gap-2 px-2 text-[10px] leading-none"
            style={{ height: PIN_LAYOUT.rowPx }}
          >
            <span className="min-w-0 truncate text-zinc-300">
              {input?.handle ?? ""}
            </span>
            <span className="min-w-0 truncate text-right text-zinc-300">
              {output?.handle ?? ""}
            </span>
          </div>
        );
      })}
      {spec.inputs.map((port, index) => (
        <Handle
          key={`in-${port.handle}`}
          id={port.handle}
          type="target"
          position={Position.Left}
          title={`${port.handle} (${port.type})`}
          style={{ top: pinTop(index) }}
          className="!h-2.5 !w-2.5 !border-slate-400 !bg-[#0d0e11]"
        />
      ))}
      {spec.outputs.map((port, index) => (
        <Handle
          key={`out-${port.handle}`}
          id={port.handle}
          type="source"
          position={Position.Right}
          title={`${port.handle} (${port.type})`}
          style={{ top: pinTop(index) }}
          className="!h-2.5 !w-2.5 !border-amber-500 !bg-[#0d0e11]"
        />
      ))}
    </div>
  );
}
