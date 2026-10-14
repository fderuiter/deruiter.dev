"use client";

import React from "react";
import { BOOTH_CREW, getDilemma } from "@/lib/patty-drive-thru";
import { useBooth } from "./hooks";
import { DILEMMA_KEYS, type BoothStore } from "./store";

const SPEAKER_LABEL = {
  manager: BOOTH_CREW.manager,
  coworker: BOOTH_CREW.coworker,
  customer: "Headset",
} as const;

/**
 * The dilemma waiting for an answer (#2087): the prompt, its two answers and
 * how long is left before the default is taken. Nothing pauses while it is
 * open. The booth's live region announces it, Q and E answer it from the
 * keyboard, and each answer is a 44px touch target. The countdown bar moves
 * in whole steps with no transition, so it is calm under reduced motion.
 */
export function DilemmaPrompt({
  store,
  className = "",
}: {
  store: BoothStore;
  className?: string;
}) {
  const open = useBooth(store, (s) =>
    s.phase === "shift" ? s.shift.dilemma : null
  );
  // Whole seconds, so the prompt only re-renders once a second.
  const secondsLeft = useBooth(store, (s) =>
    s.shift.dilemma
      ? Math.max(0, Math.ceil(s.shift.dilemma.closesAt - s.shift.time))
      : 0
  );
  if (!open) return null;
  const dilemma = getDilemma(open.dilemmaId);
  const total = Math.max(1, Math.round(open.closesAt - open.offeredAt));
  const titleId = `pdt-dilemma-${open.dilemmaId}`;
  const act = store.getState().act;

  return (
    <section
      aria-labelledby={titleId}
      data-testid="pdt-dilemma"
      data-dilemma={open.dilemmaId}
      className={`pointer-events-auto w-full min-w-0 rounded-md border-2 border-[var(--pdt-bump-edge)] bg-[var(--pdt-hud-bg)] p-3 font-mono text-[var(--pdt-hud-text)] ${className}`}
    >
      <p id={titleId} className="min-w-0 break-words text-sm leading-snug">
        <span className="font-bold text-[var(--pdt-hud-dim)]">
          {SPEAKER_LABEL[dilemma.speaker]}:{" "}
        </span>
        {dilemma.prompt}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--pdt-hud-dim)]">
        <div
          role="meter"
          aria-label="Time to decide"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={secondsLeft}
          aria-valuetext={`${secondsLeft} seconds left`}
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-[var(--pdt-hud-track)]"
        >
          <div
            className="h-full origin-left bg-[var(--pdt-hud-alert)]"
            style={{ transform: `scaleX(${Math.min(1, secondsLeft / total)})` }}
          />
        </div>
        <span className="shrink-0 tabular-nums" data-testid="pdt-dilemma-time">
          {secondsLeft}s
        </span>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
        {dilemma.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            onClick={() => act({ type: "chooseDilemma", optionId: option.id })}
            aria-keyshortcuts={DILEMMA_KEYS[index]}
            className="min-h-11 min-w-0 break-words rounded border border-[var(--pdt-hud-rule)] bg-[var(--pdt-hud-button)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--pdt-hud-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
          >
            <span aria-hidden="true" className="mr-1 text-[var(--pdt-hud-dim)]">
              {DILEMMA_KEYS[index]}
            </span>
            {option.label}
            {option.id === dilemma.defaultOptionId ? (
              <span className="block text-[10px] font-normal normal-case tracking-normal text-[var(--pdt-hud-dim)]">
                if you say nothing
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
