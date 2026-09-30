"use client";

import React from "react";
import { phaseForDay, type StudyState } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";
import { PHASE_LABELS } from "./labels";
import { phaseSpans } from "./geometry";

/**
 * The study's life as a track of phases. Days behind are filled, today is
 * a marker, and slip days run past the planned end as a hatched overrun.
 */
export const PhaseTimeline: React.FC<{ state: StudyState }> = ({ state }) => {
  const planned = state.setup.durationDays;
  const total = planned + state.slipDays;
  const day = Math.min(state.day, total);
  const current = phaseForDay(state.day, planned);
  const spans = phaseSpans(planned);
  const width = (days: number) => `${(days / total) * 100}%`;

  return (
    <div
      role="img"
      aria-label={`Study timeline: ${PHASE_LABELS[current]} phase, day ${day} of ${total}${state.slipDays > 0 ? `, ${state.slipDays} days of slip` : ""}.`}
      className="relative border border-[var(--sd-hairline)] bg-[var(--sd-surface)] px-2 pt-1.5 pb-2"
      data-testid="study-phase-timeline"
    >
      <div aria-hidden="true" className="flex w-full gap-px">
        {spans.map((span) => {
          const done = day > span.end;
          const active = span.phase === current;
          const fill = active
            ? `${clamp(((day - span.start + 1) / (span.end - span.start + 1)) * 100, 0, 100)}%`
            : done
              ? "100%"
              : "0%";
          return (
            <div
              key={span.phase}
              className="min-w-0"
              style={{ width: width(span.end - span.start + 1) }}
            >
              <p
                className={`truncate text-[10px] tracking-wide uppercase ${active ? "font-bold text-[var(--sd-amber)]" : done ? "text-zinc-300" : "text-[var(--sd-muted)]"}`}
                title={PHASE_LABELS[span.phase]}
              >
                {PHASE_LABELS[span.phase]}
              </p>
              <div
                className={`mt-1 h-2 overflow-hidden ${active ? "bg-[var(--sd-amber)]/15 ring-1 ring-[var(--sd-amber)]/50" : "bg-zinc-800"}`}
              >
                <div
                  className={`h-full ${active ? "bg-[var(--sd-amber)]" : "bg-[var(--sd-steel)]/70"}`}
                  style={{ width: fill }}
                />
              </div>
            </div>
          );
        })}
        {state.slipDays > 0 ? (
          <div className="min-w-0" style={{ width: width(state.slipDays) }}>
            <p className="truncate text-[10px] tracking-wide text-[var(--sd-red)] uppercase">
              Slip
            </p>
            <div className="mt-1 h-2 bg-[repeating-linear-gradient(135deg,rgba(248,113,113,0.6)_0_3px,transparent_3px_6px)]" />
          </div>
        ) : null}
      </div>
    </div>
  );
};
