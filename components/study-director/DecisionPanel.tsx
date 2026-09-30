"use client";

import React from "react";
import { DOCUMENTATION_ATTENTION, type StudyEvent } from "@/lib/study-director";
import { URGENCY_LABELS } from "./labels";
import { URGENCY_TONE } from "./tones";

/**
 * The reading pane: the open message, its options, the documentation
 * toggle, and the day's actions in a footer that never moves.
 */
export const DecisionPanel: React.FC<{
  event: StudyEvent | undefined;
  attention: number;
  documented: boolean;
  onDocumentedChange: (value: boolean) => void;
  onChoose: (event: StudyEvent, optionId: string) => void;
  footer: React.ReactNode;
}> = ({
  event,
  attention,
  documented,
  onDocumentedChange,
  onChoose,
  footer,
}) => (
  <section
    aria-label={event ? `Message: ${event.subject}` : "Decision"}
    className="flex min-h-[320px] min-w-0 flex-col border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)]"
    data-testid="study-decision"
  >
    {event ? (
      <div className="flex-1 space-y-4 p-4 sm:p-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`border px-1.5 py-px font-bold tracking-wide uppercase ${URGENCY_TONE[event.urgency]}`}
            >
              {URGENCY_LABELS[event.urgency]}
            </span>
            <span className="min-w-0 break-words text-[var(--sd-muted)]">
              From {event.from}
            </span>
          </div>
          <h2 className="text-lg leading-snug font-extrabold tracking-[-0.02em] break-words text-[var(--sd-text)] sm:text-xl">
            {event.subject}
          </h2>
        </div>
        <p className="max-w-prose text-sm leading-relaxed break-words text-zinc-200">
          {event.body}
        </p>
        <ul className="grid gap-2">
          {event.options.map((option, index) => {
            const cost =
              option.attentionCost + (documented ? DOCUMENTATION_ATTENTION : 0);
            const blocked = cost > attention;
            return (
              <li key={option.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onChoose(event, option.id)}
                  disabled={blocked}
                  className="group flex min-h-[48px] w-full min-w-0 items-center gap-3 border border-zinc-700 bg-[var(--sd-surface-2)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--sd-amber)] hover:bg-[var(--sd-amber)]/5 focus-visible:border-[var(--sd-amber)] focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-[var(--sd-surface-2)]"
                >
                  <kbd className="mt-px shrink-0 border border-zinc-600 px-1.5 text-[11px] text-zinc-300 group-hover:border-[var(--sd-amber)] group-hover:text-[var(--sd-amber)]">
                    {index + 1}
                  </kbd>
                  <span className="min-w-0 flex-1 break-words text-zinc-100">
                    {option.label}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[var(--sd-amber)] tabular-nums">
                    {cost} attn
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={documented}
            onChange={(e) => onDocumentedChange(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          Document this decision (+{DOCUMENTATION_ATTENTION} attention). Skipped
          documentation is remembered.
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
