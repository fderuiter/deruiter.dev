"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { ActIntroView } from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ActIntroProps {
  /** The act being entered, from the run view. */
  intro: ActIntroView;
  /** The cabinet allows loud effects: the act card slams in. */
  loud: boolean;
  onDismiss: () => void;
}

/**
 * The act card (#924): entering a new act names the study, the Boss it drew
 * and waits at its end, what the new study started over and what the run
 * carried into it, before the first card is played. It renders the view's
 * fields only. Enter, Escape or the button dismisses it; the table then
 * focuses the hand.
 */
export function ActIntro({ intro, loud, onDismiss }: ActIntroProps) {
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onDismiss,
    returnFocus: false,
  });
  return createPortal(
    <div
      data-te-cabinet=""
      data-te-loud={loud ? "on" : "off"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="act-intro-heading"
        aria-describedby="act-intro-boss"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-amber-400/60 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="act-intro"
      >
        <p className="text-[10px] uppercase tracking-wider text-amber-300 tabular-nums">
          Study {intro.act.index + 1} of {intro.act.count} · a new study
        </p>
        <h2
          id="act-intro-heading"
          className={`mt-1 text-base font-bold uppercase tracking-wider break-words ${loud ? "te-loud-act" : ""}`}
        >
          {intro.act.title}
        </h2>
        <p
          id="act-intro-boss"
          className="mt-2 border border-rose-400/60 p-2 text-xs text-rose-200 break-words"
          data-testid="act-intro-boss"
        >
          <span className="block font-bold uppercase tracking-wider">
            Boss waiting: {intro.bossTitle}
          </span>
          {intro.bossIntro}
        </p>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <section aria-labelledby="act-intro-reset" className="min-w-0">
            <h3
              id="act-intro-reset"
              className="text-[10px] uppercase tracking-wider text-zinc-400"
            >
              Starts over
            </h3>
            <ul
              className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-300"
              data-testid="act-intro-reset-list"
            >
              {intro.reset.map((line) => (
                <li key={line} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="act-intro-kept" className="min-w-0">
            <h3
              id="act-intro-kept"
              className="text-[10px] uppercase tracking-wider text-zinc-400"
            >
              Carried over
            </h3>
            <ul
              className="mt-1 list-disc space-y-0.5 pl-4 text-emerald-200"
              data-testid="act-intro-kept-list"
            >
              {intro.kept.map((line) => (
                <li key={line} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 min-h-[48px] w-full border border-amber-400 bg-amber-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 touch-manipulation hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          data-testid="act-intro-start"
        >
          Start the study [Enter]
        </button>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
