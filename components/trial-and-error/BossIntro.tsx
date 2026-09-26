"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { BossIntroView } from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface BossIntroProps {
  /** The Boss Blind being entered, from the view. */
  intro: BossIntroView;
  onDismiss: () => void;
}

/**
 * The boss intro card (T&E-09, #1083): entering any Boss Blind names the
 * boss, its debuff, the quota and CPU, and each stage when the encounter is
 * staged, the deadline and questions of an FDA Information Request (#921),
 * or CSR Lock's five sequence slots (#922), before the first card is played. It renders the view's fields
 * only. Enter, Escape or the button dismisses it; the table then focuses the
 * hand.
 */
export function BossIntro({ intro, onDismiss }: BossIntroProps) {
  // The table moves focus to the hand on dismiss: whatever had focus before
  // (the previous Blind's controls) is usually gone.
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onDismiss,
    returnFocus: false,
  });
  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="boss-intro-heading"
        aria-describedby="boss-intro-debuff"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-rose-400/60 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="boss-intro"
      >
        <p className="text-[10px] uppercase tracking-wider text-rose-300">
          Boss Blind
        </p>
        <h2
          id="boss-intro-heading"
          className="text-sm font-bold uppercase tracking-wider break-words"
        >
          {intro.title}
        </h2>
        <p
          id="boss-intro-debuff"
          className="mt-2 border border-rose-400/60 p-2 text-xs text-rose-200 break-words"
          data-testid="boss-intro-debuff"
        >
          <span className="block font-bold uppercase tracking-wider">
            Boss: {intro.bossName}
          </span>
          {intro.debuff}
        </p>
        <p
          className="mt-2 text-xs text-zinc-300 tabular-nums"
          data-testid="boss-intro-terms"
        >
          Quota {intro.quota} · {intro.startingCpu} CPU
          {intro.dueHours !== null && <> · due in {intro.dueHours} hours</>}
        </p>
        {intro.questions.length > 0 && (
          <ol
            aria-label="The FDA's questions"
            className="mt-2 list-decimal space-y-1 pl-5 text-xs text-zinc-300"
            data-testid="boss-intro-questions"
          >
            {intro.questions.map((question) => (
              <li key={question} className="break-words">
                {question}
              </li>
            ))}
          </ol>
        )}
        {intro.csrSlots.length > 0 && (
          <ol
            aria-label="The CSR Straight's slots, in order"
            className="mt-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-zinc-300"
            data-testid="boss-intro-slots"
          >
            {intro.csrSlots.map((slot, i) => (
              <li key={slot} className="border border-zinc-600 px-1.5 py-0.5">
                {i + 1}. {slot}
              </li>
            ))}
          </ol>
        )}
        {intro.stages.length > 0 && (
          <ol
            className="mt-2 space-y-1 text-xs text-zinc-300 tabular-nums"
            data-testid="boss-intro-stages"
          >
            {intro.stages.map((stage) => (
              <li key={stage.name} className="break-words">
                {stage.name}: {stage.session.toLowerCase()} session, quota{" "}
                {stage.quota}
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 min-h-[48px] w-full border border-rose-400 bg-rose-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-rose-300 touch-manipulation hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          data-testid="boss-intro-start"
        >
          Take the seat [Enter]
        </button>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
