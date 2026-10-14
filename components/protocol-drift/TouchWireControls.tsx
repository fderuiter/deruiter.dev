"use client";

import React, { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { IconX } from "@tabler/icons-react";
import { TouchSheet } from "./TouchSheet";
import {
  canRewire,
  groupTouchWirePairs,
  pickTouchWire,
  touchWirePairs,
  type WirePair,
} from "./touch-wire";
import { touchZoomFloor } from "./graph-model";
import { useProtocolDriftStore } from "./store";

const ACTION =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border border-amber-500 bg-[#0d0e11]/95 px-3 font-mono text-xs text-amber-400 active:scale-[0.98]";
const PLAIN =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center border border-zinc-600 bg-[#0d0e11]/95 px-3 font-mono text-xs text-zinc-100 active:scale-[0.98]";

const DISABLED =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border border-zinc-700 bg-[#0d0e11]/95 px-3 font-mono text-xs text-zinc-500 cursor-not-allowed";

/** The pair list: same-name pairs first, the rest behind a Show all toggle. */
function PairList({
  pairs,
  onPick,
}: {
  pairs: WirePair[];
  onPick: (pair: WirePair) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const { matching, other } = groupTouchWirePairs(pairs);
  const pairButton = (pair: WirePair) => (
    <li key={`${pair.sourceHandle}-${pair.targetHandle}`}>
      <button
        type="button"
        onClick={() => onPick(pair)}
        className="flex min-h-11 w-full items-center justify-start border border-zinc-700 bg-[#0d0e11] px-3 text-left font-mono text-xs text-zinc-100 active:scale-[0.98]"
      >
        {pair.sourceHandle} to {pair.targetHandle}
      </button>
    </li>
  );
  return (
    <div className="flex flex-col gap-3">
      {matching.length > 0 ? (
        <section aria-labelledby="touch-wire-matching">
          <h3
            id="touch-wire-matching"
            className="pb-1 font-mono text-xs font-semibold text-zinc-300"
          >
            Matching fields
          </h3>
          <ul className="flex flex-col gap-2">{matching.map(pairButton)}</ul>
        </section>
      ) : null}
      {other.length > 0 ? (
        <section aria-labelledby="touch-wire-other">
          <h3
            id="touch-wire-other"
            className="pb-1 font-mono text-xs font-semibold text-zinc-300"
          >
            Other pairs
          </h3>
          <button
            type="button"
            onClick={() => setShowAll((open) => !open)}
            aria-expanded={showAll}
            className="flex min-h-11 w-full items-center justify-between border border-zinc-700 bg-[#0d0e11] px-3 font-mono text-xs text-zinc-100 active:scale-[0.98]"
          >
            <span>Show all</span>
            <span className="text-zinc-400" aria-hidden="true">
              {showAll ? "Hide" : `${other.length} more`}
            </span>
          </button>
          {showAll ? (
            <ul className="mt-2 flex flex-col gap-2">
              {other.map(pairButton)}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Tap-to-wire controls on the touch canvas (#2045). A tap selects a chip, a
 * "Wire from" action starts a wire from it, and a second tap finishes it. A
 * fit button frames the whole pipeline. Only the touch cabinet renders this.
 */
export function TouchWireControls() {
  const nodes = useProtocolDriftStore((s) => s.nodes);
  const wireFrom = useProtocolDriftStore((s) => s.wireFrom);
  const wireSheet = useProtocolDriftStore((s) => s.wireSheet);
  const setWireFrom = useProtocolDriftStore((s) => s.setWireFrom);
  const setWireSheet = useProtocolDriftStore((s) => s.setWireSheet);
  const notify = useProtocolDriftStore((s) => s.notify);
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const flow = useReactFlow();
  const editable = canRewire(fsm);

  const selected = nodes.find((n) => n.selected);
  const source = wireFrom ? nodes.find((n) => n.id === wireFrom) : undefined;
  const sheetSource = wireSheet
    ? nodes.find((n) => n.id === wireSheet.source)
    : undefined;
  const sheetTarget = wireSheet
    ? nodes.find((n) => n.id === wireSheet.target)
    : undefined;

  const cancelWire = () => {
    setWireFrom(null);
    notify("info", "Wiring cancelled.");
  };
  const closeSheet = () => {
    setWireSheet(null);
    setWireFrom(null);
  };
  const pick = (pair: WirePair) => {
    if (!wireSheet) return;
    void pickTouchWire(wireSheet.source, wireSheet.target, pair);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {source ? (
            <>
              <span className="pointer-events-none min-w-0 truncate bg-[#0d0e11]/95 px-2 py-1 font-mono text-xs text-zinc-100">
                Wiring from {source.data.kind}: tap a target chip
              </span>
              <button
                type="button"
                onClick={cancelWire}
                aria-label="Cancel wiring"
                className={PLAIN}
              >
                <IconX className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : selected && editable ? (
            <button
              type="button"
              onClick={() => {
                setWireFrom(selected.id);
                notify(
                  "info",
                  `Wiring from ${selected.data.kind}. Tap a target chip.`
                );
              }}
              className={ACTION}
            >
              Wire from {selected.data.kind}
            </button>
          ) : selected ? (
            <>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className={DISABLED}
              >
                Wire from {selected.data.kind}
              </button>
              <span
                aria-live="polite"
                className="pointer-events-none min-w-0 truncate bg-[#0d0e11]/95 px-2 py-1 font-mono text-xs text-amber-300"
              >
                Pause the clock to rewire
              </span>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            void flow.fitView({
              padding: 0.06,
              duration: 0,
              minZoom: touchZoomFloor(),
              maxZoom: 1,
            })
          }
          className={PLAIN}
        >
          Fit
        </button>
      </div>
      {wireSheet && sheetSource && sheetTarget ? (
        <TouchSheet
          title={`Wire ${sheetSource.data.kind} to ${sheetTarget.data.kind}`}
          testId="touch-wire-sheet"
          onClose={closeSheet}
        >
          <PairList
            pairs={touchWirePairs(sheetSource.data.kind, sheetTarget.data.kind)}
            onPick={pick}
          />
        </TouchSheet>
      ) : null}
    </>
  );
}
