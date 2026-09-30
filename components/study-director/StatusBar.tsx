"use client";

import React from "react";
import {
  ATTENTION_PER_DAY,
  phaseForDay,
  type StudyState,
} from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";
import { PHASE_LABELS } from "./labels";
import { money } from "./format";

/** Percent of `part` in `whole`, bounded to 0..100. */
const pct = (part: number, whole: number): number =>
  whole > 0 ? clamp((part / whole) * 100, 0, 100) : 0;

const Readout: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className = "" }) => (
  <div className={`min-w-0 px-3 py-2 ${className}`}>
    <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      {label}
    </p>
    {children}
  </div>
);

/**
 * The desk's status bar: which study and phase, how far through the
 * schedule, how much of the budget is gone against how much time is gone,
 * and the attention left today.
 */
export const StatusBar: React.FC<{ state: StudyState }> = ({ state }) => {
  const phase = phaseForDay(state.day, state.setup.durationDays);
  const total = state.setup.durationDays + state.slipDays;
  const day = Math.min(state.day, total);
  const burn = pct(state.spent, state.setup.budget);
  const timeUsed = pct(day, state.setup.durationDays);
  const over = state.spent > state.setup.budget;
  const burnTone = over
    ? "bg-[var(--sd-red)]"
    : burn > timeUsed + 10
      ? "bg-[var(--sd-amber)]"
      : "bg-[var(--sd-emerald)]";
  const burnNote = over
    ? "Over budget"
    : burn > timeUsed + 10
      ? "Spending ahead of schedule"
      : "Spending on pace";

  return (
    <header
      className="grid grid-cols-2 divide-[var(--sd-hairline)] border border-[var(--sd-hairline)] bg-[var(--sd-surface)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:divide-x"
      data-testid="study-status-bar"
    >
      <Readout label={`Study ${state.setup.id}`}>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
          <span className="border border-[var(--sd-amber)]/50 bg-[var(--sd-amber)]/10 px-1.5 py-px text-[11px] font-bold tracking-wide text-[var(--sd-amber)] uppercase">
            {PHASE_LABELS[phase]}
          </span>
          <span className="min-w-0 truncate text-xs text-[var(--sd-text)]">
            {state.setup.sponsor.name}
          </span>
        </p>
      </Readout>

      <Readout label="Schedule">
        <p className="mt-0.5 text-base font-bold text-[var(--sd-text)] tabular-nums">
          Day {day} / {total}
          {state.slipDays > 0 ? (
            <span className="ml-1.5 text-xs font-semibold text-[var(--sd-amber)]">
              +{state.slipDays} slip
            </span>
          ) : null}
        </p>
      </Readout>

      <Readout label="Budget">
        <p className="mt-0.5 text-base font-bold text-[var(--sd-text)] tabular-nums">
          {money(state.spent)}
          <span className="text-xs font-normal text-[var(--sd-muted)]">
            {" "}
            of {money(state.setup.budget)}
          </span>
        </p>
        <div
          role="img"
          aria-label={`${Math.round(burn)}% of budget spent with ${Math.round(timeUsed)}% of the schedule gone. ${burnNote}.`}
          title={burnNote}
          className="relative mt-1 h-1.5 w-full bg-zinc-800"
        >
          <div className={`h-full ${burnTone}`} style={{ width: `${burn}%` }} />
          <div
            aria-hidden="true"
            className="absolute -top-0.5 h-2.5 w-px bg-[var(--sd-text)]"
            style={{ left: `${clamp(timeUsed, 0, 100)}%` }}
          />
        </div>
      </Readout>

      <Readout
        label="Attention today"
        className="col-span-2 border-t border-[var(--sd-hairline)] lg:col-span-1 lg:border-t-0"
      >
        <div
          className="mt-1 flex items-center gap-1"
          role="img"
          aria-label={`${state.attention} of ${ATTENTION_PER_DAY} attention left today${state.routine > 0 ? `, ${state.routine} taken by routine work` : ""}`}
          title={
            state.routine > 0
              ? `${state.routine} attention went to routine work: open queries and unrecorded decisions.`
              : undefined
          }
        >
          {Array.from({ length: ATTENTION_PER_DAY }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              data-pip={
                i < state.attention
                  ? "free"
                  : i >= ATTENTION_PER_DAY - state.routine
                    ? "routine"
                    : "spent"
              }
              className={`h-4 w-4 rounded-[3px] ${
                i < state.attention
                  ? "bg-[var(--sd-amber)]"
                  : i >= ATTENTION_PER_DAY - state.routine
                    ? "border border-dashed border-[var(--sd-steel)]"
                    : "border border-zinc-700 bg-zinc-800"
              }`}
            />
          ))}
          <span className="ml-1.5 text-xs font-bold text-[var(--sd-text)] tabular-nums">
            {state.attention} left
          </span>
        </div>
      </Readout>
    </header>
  );
};
