"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CHIP_SPECS, type ChipLane } from "@/lib/protocol-drift";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import { clamp } from "@/lib/game-utils";
import {
  CHIP_WIDTH,
  PIN_LAYOUT,
  TOUCH_TITLE_PX,
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

/** Width of a monospace glyph, as a share of the font size. */
const MONO_GLYPH_EM = 0.6;
/** Room for the title inside the chip header's padding. */
const TITLE_ROOM_PX = CHIP_WIDTH - 16;

/** The largest title size, 12px to 15px, at which the whole name fits. */
function desktopTitlePx(name: string): number {
  const fit = TITLE_ROOM_PX / (name.length * MONO_GLYPH_EM);
  return clamp(Math.floor(fit), 12, TOUCH_TITLE_PX);
}

/** One chip on the pipeline canvas, with a labelled pin per port. */
export function ChipNodeView({ data, selected }: NodeProps<ChipNode>) {
  const spec = CHIP_SPECS[data.kind];
  const style = LANE_STYLE[spec.lane];
  const rows = Math.max(spec.inputs.length, spec.outputs.length);
  const pinTop = (index: number) =>
    PIN_LAYOUT.headerPx + index * PIN_LAYOUT.rowPx + PIN_LAYOUT.rowPx / 2;
  // On touch a drag that starts on a chip moves the chip, never the world:
  // the nopan class stops the canvas from panning under it (#2045).
  const touch = useCabinetTouch();

  return (
    <div
      data-chip-kind={data.kind}
      style={{ width: CHIP_WIDTH, height: chipHeight(data.kind) }}
      className={`relative border bg-[#13151a] font-mono text-zinc-100 ${style.border} ${
        selected ? "ring-1 ring-amber-500" : ""
      }${touch ? " nopan" : ""}`}
    >
      <div
        className="flex items-center justify-between gap-1 border-b border-zinc-800 px-2"
        style={{ height: PIN_LAYOUT.headerPx }}
      >
        <span
          className="min-w-0 truncate text-[11px] font-semibold"
          title={data.kind}
          // Touch keeps the 15px title its zoom floor is built on (#2045).
          // On desktop the lane tag gives way and a long name steps down to
          // as little as 12px, so the whole name shows (#2276).
          style={{
            fontSize: touch ? TOUCH_TITLE_PX : desktopTitlePx(data.kind),
          }}
        >
          {data.kind}
        </span>
        {touch ? (
          <span className={`shrink-0 text-[9px] ${style.tag}`}>
            {LANE_TAG[spec.lane]}
          </span>
        ) : null}
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
