"use client";

import React from "react";
import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";
import { CHIP_DRAG_TYPE, placeChip } from "./PipelineCanvas";
import { useProtocolDriftStore } from "./store";

const TOOLBOX_ORDER: ChipKind[] = [
  "SourceIngest",
  "ExtractField",
  "RegexSplit",
  "DateLocaleNormalizer",
  "UnitStandardizer",
  "AmendmentRouter",
  "PivotToObservation",
  "CDISCSink",
  "SnapshotHandoff",
  "PairAndDerive",
];

const LANE_TEXT = {
  TABULATION: "text-slate-300",
  WALL: "text-amber-400",
  ANALYSIS: "text-emerald-400",
} as const;

function initials(kind: ChipKind): string {
  return kind.replace(/[^A-Z]/g, "").slice(0, 3);
}

/** Left toolbox: click, press Enter, or drag a chip onto the canvas. */
export function Toolbox({
  compact,
  onToggle,
}: {
  compact: boolean;
  onToggle: () => void;
}) {
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const editable =
    fsm === "DRAFT" ||
    fsm === "VALIDATE" ||
    fsm === "DEPLOY_READY" ||
    fsm === "PAUSED" ||
    fsm === "WAVE_REVIEW";

  return (
    <nav
      aria-label="Chip toolbox"
      className={`flex min-h-0 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-zinc-800 bg-[#13151a] p-2 font-mono ${
        compact ? "w-14" : "w-[232px]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!compact}
        className="min-h-8 border border-zinc-700 px-1 text-[11px] text-zinc-200 hover:border-amber-500"
      >
        {compact ? "Chips" : "Collapse"}
      </button>
      {TOOLBOX_ORDER.map((kind) => {
        const spec = CHIP_SPECS[kind];
        return (
          <button
            key={kind}
            type="button"
            draggable={editable}
            disabled={!editable}
            onDragStart={(event) => {
              event.dataTransfer.setData(CHIP_DRAG_TYPE, kind);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => placeChip(kind)}
            aria-label={`Add ${kind} chip`}
            title={`${kind}: ${spec.summary}`}
            className={`min-w-0 border border-zinc-800 bg-[#0d0e11] p-1.5 text-left text-[11px] transition-colors hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${
              compact ? "text-center" : ""
            }`}
          >
            {compact ? (
              <span className={`font-semibold ${LANE_TEXT[spec.lane]}`}>
                {initials(kind)}
              </span>
            ) : (
              <>
                <span className="block break-words font-semibold text-zinc-100">
                  {kind}
                </span>
                <span className={`block text-[10px] ${LANE_TEXT[spec.lane]}`}>
                  {spec.lane === "WALL"
                    ? "WALL"
                    : spec.lane === "ANALYSIS"
                      ? "ADaM"
                      : "SDTM"}
                </span>
                <span className="mt-0.5 block break-words text-[10px] leading-snug text-zinc-300">
                  {spec.summary}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
