"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  RELIC_PHASE_LABELS,
  relicPhase,
  type AccessRecord,
  type HandLevelRow,
  type Relic,
  type RunOrigin,
} from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { SeedShare } from "@/components/trial-and-error/SeedShare";

interface RunInfoProps {
  /** The run's hand table at current levels, from the domain view. */
  rows: readonly HandLevelRow[];
  seed: string;
  /** How the seed was chosen; a Daily Protocol run shows its date. */
  origin?: RunOrigin;
  /** Offers "New run…", which opens the New Run dialog (#1528). */
  onNewRun?: () => void;
  /** How many relic slots the rack has. */
  relicSlots: number;
  /** The relics the run has equipped. */
  relics?: readonly Relic[];
  /**
   * The Blind's DMC access history, shown when the Blind has a DMC or any
   * access was logged.
   */
  accessLog?: readonly AccessRecord[];
  /** The Blind has a chartered DMC. */
  dmc?: boolean;
  onClose: () => void;
}

/**
 * Run Info (T&E-UX-05): a focus-trapped dialog with the run's hand table
 * (level, base Chips, base +Mult, times played), the equipped relics and the
 * run seed, with Copy seed, Copy challenge link and New run (#1528). It renders the domain's rows and never adds a level bonus
 * itself. Escape or Close dismisses it and focus returns to the trigger.
 */
export function RunInfo({
  rows,
  seed,
  origin = { kind: "RANDOM" },
  onNewRun,
  relicSlots,
  relics = [],
  accessLog = [],
  dmc = false,
  onClose,
}: RunInfoProps) {
  const ref = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });
  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-info-heading"
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="run-info"
      >
        <h2
          id="run-info-heading"
          className="text-sm font-bold uppercase tracking-wider"
        >
          Run Info
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-0 border-collapse text-xs tabular-nums">
            <caption className="mb-1 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              Hand levels this run
            </caption>
            <thead>
              <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <th scope="col" className="py-1 pr-2 font-normal">
                  Hand
                </th>
                <th scope="col" className="px-2 py-1 text-right font-normal">
                  Level
                </th>
                <th scope="col" className="px-2 py-1 text-right font-normal">
                  Chips
                </th>
                <th scope="col" className="px-2 py-1 text-right font-normal">
                  Mult
                </th>
                <th scope="col" className="py-1 pl-2 text-right font-normal">
                  Played
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.handType}
                  className="border-b border-zinc-800"
                  data-testid="run-info-hand"
                >
                  <th
                    scope="row"
                    className="py-1 pr-2 text-left font-normal break-words"
                  >
                    {row.name}
                  </th>
                  <td
                    className={`px-2 py-1 text-right ${row.level > 1 ? "font-bold text-amber-300" : ""}`}
                  >
                    Lv.{row.level}
                  </td>
                  <td className="px-2 py-1 text-right text-[color:var(--te-chips)]">
                    {row.chips}
                  </td>
                  <td className="px-2 py-1 text-right text-[color:var(--te-plus-mult)]">
                    +{row.mult}
                  </td>
                  <td className="py-1 pl-2 text-right">{row.playedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Relics
        </h3>
        {relics.length === 0 ? (
          <p
            className="text-xs text-zinc-300 break-words"
            data-testid="run-info-relics"
          >
            None equipped (0 of {relicSlots} slots). Relics arrive with the
            Procurement Shop and Boss rewards.
          </p>
        ) : (
          <ul className="text-xs text-zinc-300" data-testid="run-info-relics">
            <li className="text-zinc-400">
              {relics.length} of {relicSlots} slots
            </li>
            {relics.map((relic) => (
              <li key={relic.id} className="break-words">
                <span className="font-bold text-emerald-300">{relic.name}</span>{" "}
                <span className="text-zinc-400">
                  ({RELIC_PHASE_LABELS[relicPhase(relic)]})
                </span>
                : {relic.description}
              </li>
            ))}
          </ul>
        )}
        {(dmc || accessLog.length > 0) && (
          <>
            <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              DMC access history
            </h3>
            {accessLog.length === 0 ? (
              <p className="text-xs text-zinc-300 break-words">
                No access to blinded outputs this Blind.
              </p>
            ) : (
              <ol className="space-y-1 text-xs" data-testid="access-history">
                {accessLog.map((entry) => (
                  <li
                    key={entry.seq}
                    data-testid="access-entry"
                    data-authorized={entry.authorized ? "" : undefined}
                    className={`border-l-2 pl-2 break-words ${entry.authorized ? "border-zinc-600 text-zinc-300" : "border-rose-400 text-rose-200"}`}
                  >
                    <span className="tabular-nums text-zinc-400">
                      #{entry.seq} ·{" "}
                      {entry.session === "OPEN" ? "Open" : "Closed"} session
                      ·{" "}
                    </span>
                    {entry.authorized ? "" : "Violation: "}
                    {entry.text}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Seed
        </h3>
        <div className="mt-1">
          <SeedShare seed={seed} origin={origin} />
        </div>
        {onNewRun && (
          <button
            type="button"
            onClick={onNewRun}
            className="mt-4 min-h-[48px] w-full border border-amber-500 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 touch-manipulation hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            data-testid="run-info-new-run"
          >
            New run…
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[48px] w-full border border-zinc-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
        >
          Close [Esc]
        </button>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
