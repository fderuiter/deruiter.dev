"use client";

import React, { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { IconX } from "@tabler/icons-react";
import { TouchSheet } from "./TouchSheet";
import {
  canRewire,
  groupTouchWirePairs,
  pickTouchWire,
  resolveTouchWire,
  touchWirePairs,
  wireSourcesOf,
  wireTargetsFrom,
  type WirePair,
} from "./touch-wire";
import type { ChipNode } from "./graph-model";
import { frameChips, frameLane, sizeOf } from "./touch-frame";
import { useProtocolDriftStore } from "./store";

const ACTION =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border border-amber-500 bg-[#0d0e11]/95 px-3 font-mono text-xs text-amber-400 active:scale-[0.98]";
const PLAIN =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center border border-zinc-600 bg-[#0d0e11]/95 px-3 font-mono text-xs text-zinc-100 active:scale-[0.98]";

const DISABLED =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border border-zinc-700 bg-[#0d0e11]/95 px-3 font-mono text-xs text-zinc-500 cursor-not-allowed";

/** A chip as a 44px list button: its kind, then its id. */
function ChipChoice({
  chip,
  onPick,
}: {
  chip: ChipNode;
  onPick: (chip: ChipNode) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(chip)}
        className="flex min-h-11 w-full items-center justify-between gap-2 border border-zinc-700 bg-[#0d0e11] px-3 text-left font-mono text-xs text-zinc-100 active:scale-[0.98]"
      >
        <span className="min-w-0 truncate font-semibold">{chip.data.kind}</span>
        <span className="min-w-0 shrink truncate text-zinc-400">{chip.id}</span>
      </button>
    </li>
  );
}

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
 * Tap-to-wire controls on the touch canvas (#2045). Wiring does not depend on
 * what is on screen: "Wire..." lists the chips that can start a wire, and
 * "Choose target" lists the chips a started wire can reach. Tapping chips on
 * the canvas still works. A fit button frames the whole pipeline.
 */
export function TouchWireControls() {
  const nodes = useProtocolDriftStore((s) => s.nodes);
  const wireFrom = useProtocolDriftStore((s) => s.wireFrom);
  const wireSheet = useProtocolDriftStore((s) => s.wireSheet);
  const setWireFrom = useProtocolDriftStore((s) => s.setWireFrom);
  const setWireSheet = useProtocolDriftStore((s) => s.setWireSheet);
  const notify = useProtocolDriftStore((s) => s.notify);
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const pausedReason = useProtocolDriftStore((s) => s.pausedReason);
  const flow = useReactFlow();
  const [sourceListOpen, setSourceListOpen] = useState(false);
  const [targetListOpen, setTargetListOpen] = useState(false);
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
    setTargetListOpen(false);
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
  const startFrom = (chip: ChipNode) => {
    setWireFrom(chip.id);
    setSourceListOpen(false);
    notify("info", `Wiring from ${chip.data.kind}. Choose a target.`);
  };
  const chooseTarget = (chip: ChipNode) => {
    // One pair wires at once; several hand off to the pair sheet.
    setTargetListOpen(false);
    if (source) void resolveTouchWire(source.id, chip.id);
  };
  const sources = wireSourcesOf(nodes);
  const targets = source ? wireTargetsFrom(source.id, nodes) : [];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {pausedReason && fsm !== "RUNNING" ? (
            <span
              aria-live="polite"
              data-testid="pause-reason"
              className="pointer-events-none max-w-full truncate border border-amber-500 bg-[#0d0e11]/95 px-2 py-1 font-mono text-xs text-amber-300"
            >
              {pausedReason}
            </span>
          ) : null}
          {source ? (
            <>
              <span className="pointer-events-none min-w-0 truncate bg-[#0d0e11]/95 px-2 py-1 font-mono text-xs text-zinc-100">
                Wiring from {source.data.kind}: pick a target
              </span>
              <button
                type="button"
                onClick={() => setTargetListOpen(true)}
                className={ACTION}
              >
                Choose target
              </button>
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
              onClick={() => startFrom(selected)}
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
          ) : editable && sources.length > 0 ? (
            <button
              type="button"
              onClick={() => setSourceListOpen(true)}
              className={ACTION}
            >
              Wire…
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            // Fit frames the chips, or the tabulation lane when there are none.
            const size = sizeOf(event.currentTarget.closest(".react-flow"));
            if (nodes.length > 0) frameChips(flow, nodes);
            else frameLane(flow, size);
          }}
          className={PLAIN}
        >
          Fit
        </button>
      </div>
      {sourceListOpen ? (
        <TouchSheet
          title="Wire from a chip"
          testId="wire-source-sheet"
          onClose={() => setSourceListOpen(false)}
        >
          <ul className="flex flex-col gap-2">
            {sources.map((chip) => (
              <ChipChoice key={chip.id} chip={chip} onPick={startFrom} />
            ))}
          </ul>
        </TouchSheet>
      ) : null}
      {targetListOpen && source ? (
        <TouchSheet
          title={`Wire ${source.data.kind} to`}
          testId="wire-target-sheet"
          onClose={() => setTargetListOpen(false)}
        >
          {targets.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {targets.map((chip) => (
                <ChipChoice key={chip.id} chip={chip} onPick={chooseTarget} />
              ))}
            </ul>
          ) : (
            <p className="text-zinc-300">
              No chip can take a wire from {source.data.kind}.
            </p>
          )}
        </TouchSheet>
      ) : null}
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
