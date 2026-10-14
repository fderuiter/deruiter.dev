"use client";

import React, { useEffect, useRef } from "react";
import {
  IconClockPause,
  IconClockPlus,
  IconFileSearch,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  getCurrentInspectionQuestion,
  getInspectionAnswer,
  INSPECTION_EXTENSION_SECONDS,
  type InspectionOptionOutcome,
  type InspectionRound,
} from "@/lib/clinical-trial-chaos";

/** Seconds left at which the timer warns, once, through the live region. */
const WARNING_SECONDS = 5;
/** How often the timer ticks, in milliseconds. */
const TICK_MS = 250;

interface InspectionRoundDialogProps {
  round: InspectionRound;
  onAnswer: (optionId: string | null) => void;
  onNext: () => void;
  onExtend: () => void;
  onSetTimerEnabled: (enabled: boolean) => void;
  onTick: (seconds: number) => void;
  /** Where focus goes when the dialog closes. */
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

function feedbackFor(
  outcome: InspectionOptionOutcome | "unanswered",
  isSkeleton: boolean
): { title: string; tone: "good" | "bad" } {
  switch (outcome) {
    case "correct":
      return { title: "Matches the audit trail.", tone: "good" };
    case "disclosed":
      return {
        title:
          "You owned it and cited the right rule. The penalty is halved and the finding drops a severity level.",
        tone: "good",
      };
    case "misidentified":
      return {
        title:
          "You owned it, but cited the wrong rule. The full penalty stands.",
        tone: "bad",
      };
    case "evasive":
      return {
        title:
          "The inspector has the email. Deflecting raises the finding a severity level.",
        tone: "bad",
      };
    case "unanswered":
      return {
        title: isSkeleton
          ? "Time ran out. The full penalty stands."
          : "Time ran out before you answered.",
        tone: "bad",
      };
    default:
      return { title: "That is not what the record shows.", tone: "bad" };
  }
}

/**
 * The campaign-finale FDA inspection (#2089): one timed question at a time
 * about the run's locked CRFs and sponsor skeletons. The timer can be
 * extended or turned off (WCAG 2.2.1), and the number keys pick an answer.
 */
export function InspectionRoundDialog({
  round,
  onAnswer,
  onNext,
  onExtend,
  onSetTimerEnabled,
  onTick,
  returnFocusTo,
}: InspectionRoundDialogProps) {
  const question = getCurrentInspectionQuestion(round);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: firstOptionRef,
    returnFocusTo,
  });

  const running = !!question && round.timerEnabled && !round.awaitingNext;
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      onTick((now - last) / 1000);
      last = now;
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, onTick]);

  // Focus follows the round: the first answer on a new question, and the
  // Next button once an answer is in.
  const questionIndex = round.current;
  const awaitingNext = round.awaitingNext;
  useEffect(() => {
    if (awaitingNext) nextButtonRef.current?.focus();
    else firstOptionRef.current?.focus();
  }, [questionIndex, awaitingNext]);

  if (!question) return null;

  const answer = getInspectionAnswer(round, question.id);
  const isSkeleton = question.kind === "skeleton";
  const feedback = answer ? feedbackFor(answer.outcome, isSkeleton) : null;
  const secondsLeft = Math.ceil(round.timeRemaining);
  const total = round.questions.length;
  const isLast = round.current >= total - 1;
  const progress = `Question ${round.current + 1} of ${total}`;

  // Announced only when it changes: a new question, the five-second warning,
  // or the answer's result.
  const liveText = feedback
    ? `${feedback.title} ${question.answerNote}`
    : round.timerEnabled && secondsLeft <= WARNING_SECONDS
      ? `${WARNING_SECONDS} seconds left.`
      : `${progress}. ${question.prompt} ${
          round.timerEnabled
            ? `${question.timeLimitSeconds} seconds.`
            : "Timer off."
        }`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (round.awaitingNext) return;
    const idx = Number.parseInt(e.key, 10) - 1;
    if (idx >= 0 && idx < question.options.length) {
      e.preventDefault();
      e.stopPropagation();
      onAnswer(question.options[idx].id);
    }
  };

  const timerPercent = Math.min(
    100,
    (round.timeRemaining / question.timeLimitSeconds) * 100
  );

  return (
    <div
      data-cc-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-inspection-title"
        aria-describedby="cc-inspection-prompt"
        data-testid="cc-inspection-round"
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-amber-500/50 bg-zinc-950 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <IconFileSearch
              className="h-5 w-5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                id="cc-inspection-title"
                className="text-base font-bold tracking-[-0.02em] text-white"
              >
                FDA inspection: closing interview
              </h2>
              <p className="text-[11px] tabular-nums text-zinc-400">
                {progress}
                {isSkeleton ? " · sponsor correspondence" : ""}
              </p>
            </div>
          </div>
          <div
            role="timer"
            aria-label={
              round.timerEnabled ? `${secondsLeft} seconds left` : "Timer off"
            }
            className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
              !round.timerEnabled
                ? "border-zinc-700 text-zinc-400"
                : secondsLeft <= WARNING_SECONDS
                  ? "border-rose-500/60 text-rose-300"
                  : "border-amber-500/50 text-amber-300"
            }`}
          >
            {round.timerEnabled ? `${secondsLeft}s` : "off"}
          </div>
        </div>

        {round.timerEnabled && (
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded bg-zinc-800"
            aria-hidden="true"
          >
            <div
              className={`h-full transition-[width] duration-200 ease-linear motion-reduce:transition-none ${
                secondsLeft <= WARNING_SECONDS ? "bg-rose-500" : "bg-amber-500"
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
          <span className="block text-[10px] uppercase text-zinc-400">
            {isSkeleton ? "Exhibit: sponsor email" : "Exhibit: locked CRF"}
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-200 break-words">
            {question.exhibit}
          </p>
        </div>

        <p
          id="cc-inspection-prompt"
          className="mt-3 text-sm font-bold text-zinc-100"
        >
          {question.prompt}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {question.options.map((opt, idx) => {
            const picked = answer?.optionId === opt.id;
            const isRight =
              opt.outcome === "correct" || opt.outcome === "disclosed";
            const reveal = !!answer;
            return (
              <button
                key={opt.id}
                ref={idx === 0 ? firstOptionRef : undefined}
                type="button"
                onClick={() => onAnswer(opt.id)}
                disabled={reveal}
                aria-keyshortcuts={idx < 9 ? String(idx + 1) : undefined}
                data-picked={picked ? "true" : undefined}
                className={`flex min-h-[44px] w-full items-start gap-2 rounded-xl border p-2.5 text-left font-mono text-xs transition active:scale-[0.98] ${
                  reveal && isRight
                    ? "border-emerald-500 bg-emerald-950/50 text-emerald-200"
                    : reveal && picked
                      ? "border-rose-500/70 bg-rose-950/40 text-rose-200"
                      : reveal
                        ? "border-zinc-800 bg-zinc-900 text-zinc-500"
                        : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-amber-500/60 hover:bg-zinc-800"
                }`}
              >
                <span
                  className="shrink-0 rounded border border-zinc-700 px-1.5 text-[10px] text-zinc-400"
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 break-words">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            data-testid="cc-inspection-feedback"
            className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
              feedback.tone === "good"
                ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/5 text-rose-200"
            }`}
          >
            <p className="font-bold">{feedback.title}</p>
            <p className="mt-1 text-zinc-300 break-words">
              {question.answerNote}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExtend}
              disabled={!round.timerEnabled || round.awaitingNext}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconClockPlus className="h-4 w-4" aria-hidden="true" />
              More time (+{INSPECTION_EXTENSION_SECONDS}s)
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={!round.timerEnabled}
              onClick={() => onSetTimerEnabled(!round.timerEnabled)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.98]"
            >
              <IconClockPause className="h-4 w-4" aria-hidden="true" />
              Untimed interview
            </button>
          </div>
          {round.awaitingNext && (
            <button
              ref={nextButtonRef}
              type="button"
              onClick={onNext}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-amber-500 px-4 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-amber-400 active:scale-[0.98]"
            >
              {isLast ? "File the inspection report" : "Next question"}
            </button>
          )}
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveText}
        </p>
      </div>
    </div>
  );
}
