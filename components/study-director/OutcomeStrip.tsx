"use client";

import React from "react";
import type { Change, DaySummary } from "./consequences";
import { PHASE_BRIEFS, PHASE_LABELS } from "./labels";

export type Outcome =
  | {
      kind: "decision";
      /** Increments per outcome so the strip re-enters each time. */
      seq: number;
      title: string;
      documented: boolean;
      changes: Change[];
    }
  | { kind: "audit"; seq: number; title: string; changes: Change[] }
  | { kind: "overnight"; seq: number; summary: DaySummary };

/** How many chips a strip shows before folding the rest into "+N more". */
const MAX_CHIPS = 6;

const Chips: React.FC<{ changes: Change[]; empty: string }> = ({
  changes,
  empty,
}) => {
  if (changes.length === 0) {
    return <p className="text-[11px] text-[var(--sd-muted)]">{empty}</p>;
  }
  const shown = changes.slice(0, MAX_CHIPS);
  const rest = changes.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What changed">
      {shown.map((change, i) => (
        <li
          key={change.key}
          style={{ animationDelay: `${i * 60}ms` }}
          className={`sd-chip border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${change.good ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-400/40 bg-red-500/10 text-red-300"}`}
        >
          {change.text}
        </li>
      ))}
      {rest > 0 ? (
        <li className="px-1 py-0.5 text-[11px] text-[var(--sd-muted)]">
          +{rest} more
        </li>
      ) : null}
    </ul>
  );
};

/**
 * What the last action did, shown at the top of the reading pane: a
 * decision's consequences, an audit, or the overnight report between days.
 * It appears once per action and never blocks the next one.
 */
export const OutcomeStrip: React.FC<{
  outcome: Outcome;
  onDismiss: () => void;
}> = ({ outcome, onDismiss }) => {
  const overnight = outcome.kind === "overnight" ? outcome.summary : null;
  const heading =
    outcome.kind === "overnight"
      ? outcome.summary.toDay - outcome.summary.fromDay > 1
        ? `Days ${outcome.summary.fromDay} to ${outcome.summary.toDay - 1} passed`
        : `Overnight, day ${outcome.summary.fromDay} to ${outcome.summary.toDay}`
      : outcome.title;

  return (
    <div
      key={outcome.seq}
      className="sd-enter relative border-b border-[var(--sd-hairline)] bg-[var(--sd-bg)]/70 px-4 py-3 sm:px-5"
      data-testid="study-outcome"
      data-outcome={outcome.kind}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
          {outcome.kind === "decision"
            ? "You decided"
            : outcome.kind === "audit"
              ? "Audit"
              : "Overnight report"}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-1 -mr-1 min-h-[28px] min-w-[28px] shrink-0 text-sm text-[var(--sd-muted)] hover:text-[var(--sd-text)]"
        >
          ×
        </button>
      </div>
      <p className="mt-0.5 text-sm font-bold break-words text-[var(--sd-text)]">
        {heading}
        {outcome.kind === "decision" ? (
          <span
            className={`ml-2 border px-1 align-middle text-[10px] font-bold uppercase ${outcome.documented ? "border-emerald-500/50 text-emerald-400" : "border-zinc-600 text-zinc-400"}`}
          >
            {outcome.documented ? "On file" : "Not documented"}
          </span>
        ) : null}
      </p>

      {overnight?.phaseChange ? (
        <div className="sd-enter mt-2 border-l-2 border-[var(--sd-amber)] bg-[var(--sd-amber)]/5 py-1.5 pl-3">
          <p className="text-xs font-bold text-[var(--sd-amber)] uppercase">
            New phase: {PHASE_LABELS[overnight.phaseChange.to]}
          </p>
          <p className="text-[11px] text-zinc-300">
            {PHASE_BRIEFS[overnight.phaseChange.to]}
          </p>
        </div>
      ) : null}

      <div className="mt-2">
        <Chips
          changes={
            outcome.kind === "overnight"
              ? outcome.summary.changes
              : outcome.changes
          }
          empty={
            outcome.kind === "overnight"
              ? "A quiet night. Nothing moved."
              : "No visible effect yet. Some choices land later."
          }
        />
      </div>

      {overnight && overnight.lapsed.length > 0 ? (
        <p className="mt-2 text-[11px] break-words text-red-300">
          Lapsed unanswered:{" "}
          {overnight.lapsed
            .map((l) => l.subject.replace(/[.?!]$/, ""))
            .join("; ")}
          .
        </p>
      ) : null}
      {overnight ? (
        <p className="mt-1 text-[11px] text-[var(--sd-muted)]">
          {overnight.newMessages} message
          {overnight.newMessages === 1 ? "" : "s"} waiting.
          {overnight.routine > 0
            ? ` Routine work takes ${overnight.routine} attention today.`
            : ""}
        </p>
      ) : null}
    </div>
  );
};
