"use client";

import React from "react";
import {
  DOCUMENTATION_ATTENTION,
  type StudyEvent,
  type StudyState,
} from "@/lib/study-director";
import { URGENCY_LABELS } from "./labels";
import { daysLeft, lapseLabel } from "./messages";
import { SenderAvatar } from "./SenderAvatar";
import { URGENCY_TONE } from "./tones";

/** Attention cost as pips, so it reads at a glance next to the budget. */
const CostPips: React.FC<{ cost: number; blocked: boolean }> = ({
  cost,
  blocked,
}) => (
  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
    {Array.from({ length: cost }, (_, i) => (
      <span
        key={i}
        className={`h-2.5 w-2.5 rounded-[2px] ${blocked ? "border border-red-400/70" : "bg-[var(--sd-amber)]"}`}
      />
    ))}
  </span>
);

/**
 * The reading pane: the open message as a memo, its options with their
 * attention cost, the documentation toggle, and the day's actions in a
 * footer that never moves.
 */
export const DecisionPanel: React.FC<{
  state: StudyState;
  event: StudyEvent | undefined;
  documented: boolean;
  onDocumentedChange: (value: boolean) => void;
  onChoose: (event: StudyEvent, optionId: string) => void;
  /** What the last action did, shown above the message. */
  banner?: React.ReactNode;
  footer: React.ReactNode;
}> = ({
  state,
  event,
  documented,
  onDocumentedChange,
  onChoose,
  banner,
  footer,
}) => {
  const attention = state.attention;
  const left = event ? daysLeft(state, event) : 0;
  // A callback names the earlier decision that brought it here.
  const recalled = event?.recalls
    ? state.log.find((r) => r.eventId === event.recalls)
    : undefined;
  return (
    <section
      aria-label={event ? `Message: ${event.subject}` : "Decision"}
      className="flex min-h-[320px] min-w-0 flex-col border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)]"
      data-testid="study-decision"
    >
      {banner}
      {event ? (
        <div className="flex-1 space-y-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 border-b border-[var(--sd-hairline)] pb-3">
            <SenderAvatar from={event.from} team={state.team} size={40} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span
                  className={`border px-1.5 py-px font-bold tracking-wide uppercase ${URGENCY_TONE[event.urgency]}`}
                >
                  {URGENCY_LABELS[event.urgency]}
                </span>
                <span
                  className={
                    left <= 1
                      ? "font-bold text-red-400"
                      : "text-[var(--sd-muted)]"
                  }
                >
                  {lapseLabel(left)}
                </span>
                {event.wildcard ? (
                  <span className="border border-[var(--sd-steel)]/60 px-1.5 py-px font-bold tracking-wide text-[var(--sd-steel)] uppercase">
                    Wildcard
                  </span>
                ) : null}
              </div>
              <h2 className="text-lg leading-snug font-extrabold tracking-[-0.02em] break-words text-[var(--sd-text)] sm:text-xl">
                {event.subject}
              </h2>
              <p className="text-[11px] break-words text-[var(--sd-muted)]">
                From {event.from} · received day{" "}
                {state.seen[event.id] ?? state.day}
              </p>
            </div>
          </div>
          {recalled ? (
            <p
              className="border-l-2 border-[var(--sd-amber)] bg-[var(--sd-amber)]/5 px-3 py-2 text-xs break-words text-zinc-200"
              data-testid="study-callback"
            >
              <span className="font-bold text-[var(--sd-amber)]">
                Because of day {recalled.day}:
              </span>{" "}
              you chose “{recalled.label}”
              {recalled.documented ? ", and documented it." : "."}
            </p>
          ) : null}
          <p className="max-w-prose text-sm leading-relaxed break-words text-zinc-200">
            {event.body}
          </p>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
              Your call
            </legend>
            <ul className="grid gap-2">
              {event.options.map((option, index) => {
                const cost =
                  option.attentionCost +
                  (documented ? DOCUMENTATION_ATTENTION : 0);
                const blocked = cost > attention;
                return (
                  <li key={option.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onChoose(event, option.id)}
                      disabled={blocked}
                      className="group flex min-h-[48px] w-full min-w-0 items-center gap-3 border border-zinc-700 bg-[var(--sd-surface-2)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--sd-amber)] hover:bg-[var(--sd-amber)]/5 focus-visible:border-[var(--sd-amber)] focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-transparent disabled:hover:bg-transparent"
                    >
                      <kbd className="shrink-0 border border-zinc-600 px-1.5 text-[11px] text-zinc-300 group-hover:border-[var(--sd-amber)] group-hover:text-[var(--sd-amber)] group-disabled:opacity-50">
                        {index + 1}
                      </kbd>
                      <span className="min-w-0 flex-1 break-words text-zinc-100 group-disabled:text-zinc-500">
                        {option.label}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <CostPips cost={cost} blocked={blocked} />
                        <span
                          className={`text-[10px] tabular-nums ${blocked ? "font-bold text-red-400" : cost === 0 ? "font-bold text-emerald-400 uppercase" : "text-[var(--sd-amber)]"}`}
                        >
                          {blocked
                            ? `Needs ${cost}, ${attention} left`
                            : cost === 0
                              ? "Free"
                              : `${cost} attn`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <label
            className={`flex cursor-pointer items-start gap-2.5 border px-3 py-2 text-xs transition-colors ${documented ? "border-[var(--sd-emerald)]/60 bg-[var(--sd-emerald)]/5 text-zinc-100" : "border-dashed border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
          >
            <input
              type="checkbox"
              checked={documented}
              onChange={(e) => onDocumentedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
            />
            <span className="min-w-0 flex-1">
              <span className="font-bold">
                Document this decision (+{DOCUMENTATION_ATTENTION} attention).
              </span>{" "}
              <span className="text-[var(--sd-muted)]">
                {documented
                  ? "Decision and rationale go on file, so an inspector's question about it closes."
                  : "Skipped documentation is remembered, and an inspector may ask."}
              </span>
            </span>
            <kbd
              aria-hidden="true"
              className="shrink-0 border border-zinc-600 px-1.5 text-[11px] text-zinc-400"
            >
              D
            </kbd>
          </label>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-start justify-center gap-1 p-5">
          <h2 className="text-base font-bold text-[var(--sd-text)]">
            Nothing needs an answer right now.
          </h2>
          <p className="max-w-prose text-xs text-[var(--sd-muted)]">
            Spare attention is best spent auditing a site, since the dashboard
            only shows what people report. Or end the day.
          </p>
        </div>
      )}
      <div className="border-t border-[var(--sd-hairline)] bg-[var(--sd-bg)]/60 px-4 py-3 sm:px-5">
        {footer}
      </div>
    </section>
  );
};
