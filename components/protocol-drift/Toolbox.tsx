"use client";

import React, { useEffect, useRef, useState } from "react";
import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
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
  // On the touch cabinet the toolbox stays open: it is a row of chips in a
  // narrow cabinet and a column in a wide one, so it never collapses.
  const touch = useCabinetTouch();
  const navRef = useRef<HTMLElement | null>(null);
  const more = useScrollMore(touch ? navRef : null);

  const nav = (
    <nav
      ref={navRef}
      aria-label="Chip toolbox"
      // A scrollable strip on touch needs a keyboard stop of its own (axe).
      tabIndex={touch ? 0 : undefined}
      className={`flex min-h-0 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-zinc-800 bg-[#13151a] p-2 font-mono ${
        compact ? "w-14" : "w-[232px]"
      }${touch ? " pd-touch-toolbox" : ""}`}
    >
      {touch ? (
        <span className="shrink-0 self-center px-1 text-xs text-zinc-300 whitespace-nowrap">
          Chips ({TOOLBOX_ORDER.length})
        </span>
      ) : null}
      {touch ? null : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!compact}
          className="min-h-8 border border-zinc-700 px-1 text-[11px] text-zinc-200 hover:border-amber-500"
        >
          {compact ? "Chips" : "Collapse"}
        </button>
      )}
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
            onClick={() => void placeChip(kind, { touch })}
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
                <span className="pd-chip-summary mt-0.5 block break-words text-[10px] leading-snug text-zinc-300">
                  {spec.summary}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );

  if (!touch) return nav;
  // On touch an edge fade shows where the strip scrolls on (#2045).
  return (
    <div className="relative flex min-h-0 min-w-0 shrink-0">
      {nav}
      {more.axis === "x" && more.before ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8"
          style={{
            background: "linear-gradient(to right, #13151a, transparent)",
          }}
        />
      ) : null}
      {more.axis === "x" && more.after ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8"
          style={{
            background: "linear-gradient(to left, #13151a, transparent)",
          }}
        />
      ) : null}
      {more.axis === "y" && more.before ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-8"
          style={{
            background: "linear-gradient(to bottom, #13151a, transparent)",
          }}
        />
      ) : null}
      {more.axis === "y" && more.after ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{
            background: "linear-gradient(to top, #13151a, transparent)",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Which edges of a scroll box have more content, along the axis it scrolls.
 * One passive scroll listener, with the update frame-throttled (#2045).
 */
function useScrollMore(ref: React.RefObject<HTMLElement | null> | null): {
  axis: "x" | "y" | null;
  before: boolean;
  after: boolean;
} {
  const [more, setMore] = useState<{
    axis: "x" | "y" | null;
    before: boolean;
    after: boolean;
  }>({ axis: null, before: false, after: false });
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const overX = el.scrollWidth - el.clientWidth > 2;
      const overY = el.scrollHeight - el.clientHeight > 2;
      const axis = overX ? "x" : overY ? "y" : null;
      const pos = axis === "x" ? el.scrollLeft : el.scrollTop;
      const span =
        axis === "x"
          ? el.scrollWidth - el.clientWidth
          : el.scrollHeight - el.clientHeight;
      setMore({
        axis,
        before: axis !== null && pos > 2,
        after: axis !== null && pos < span - 2,
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
  return more;
}
