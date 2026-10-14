"use client";

import React from "react";
import { useReactFlow } from "@xyflow/react";
import { IconX } from "@tabler/icons-react";
import { TouchSheet } from "./TouchSheet";
import { pickTouchWire, touchWirePairs } from "./touch-wire";
import { useProtocolDriftStore } from "./store";

const ACTION =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border border-amber-500 bg-[#0d0e11]/95 px-3 font-mono text-xs text-amber-400 active:scale-[0.98]";
const PLAIN =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center border border-zinc-600 bg-[#0d0e11]/95 px-3 font-mono text-xs text-zinc-100 active:scale-[0.98]";

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
  const editable =
    fsm === "DRAFT" ||
    fsm === "VALIDATE" ||
    fsm === "DEPLOY_READY" ||
    fsm === "PAUSED" ||
    fsm === "WAVE_REVIEW";

  const selected = nodes.find((n) => n.selected);
  const source = wireFrom ? nodes.find((n) => n.id === wireFrom) : undefined;
  const sheetSource = wireSheet
    ? nodes.find((n) => n.id === wireSheet.source)
    : undefined;
  const sheetTarget = wireSheet
    ? nodes.find((n) => n.id === wireSheet.target)
    : undefined;
  const pairs =
    sheetSource && sheetTarget
      ? touchWirePairs(sheetSource.data.kind, sheetTarget.data.kind)
      : [];

  const cancelWire = () => {
    setWireFrom(null);
    notify("info", "Wiring cancelled.");
  };
  const closeSheet = () => {
    setWireSheet(null);
    setWireFrom(null);
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
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void flow.fitView({ padding: 0.06, duration: 0 })}
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
          <ul className="flex flex-col gap-2">
            {pairs.map((pair) => (
              <li key={`${pair.sourceHandle}-${pair.targetHandle}`}>
                <button
                  type="button"
                  onClick={() =>
                    void pickTouchWire(wireSheet.source, wireSheet.target, pair)
                  }
                  className="flex min-h-11 w-full items-center justify-start border border-zinc-700 bg-[#0d0e11] px-3 text-left font-mono text-xs text-zinc-100 active:scale-[0.98]"
                >
                  {pair.sourceHandle} to {pair.targetHandle}
                </button>
              </li>
            ))}
          </ul>
        </TouchSheet>
      ) : null}
    </>
  );
}
