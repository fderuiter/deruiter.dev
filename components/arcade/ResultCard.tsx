"use client";

import React, { useEffect, useId, useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type Verdict = "win" | "loss" | "neutral";

interface ResultStat {
  label: string;
  value: number;
  /** Text after the number, e.g. "x" for a combo. */
  suffix?: string;
}

interface ResultAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface ResultCardProps {
  title: string;
  /** Short stamp text, e.g. "Cleared" or "Down". */
  stamp: string;
  verdict: Verdict;
  message?: ReactNode;
  /** Two to four numbers that count up when the card opens. */
  stats: ResultStat[];
  /** The run's score and the best before this run, for the best-score line. */
  score?: number;
  previousBest?: number;
  primary: ResultAction;
  secondary?: ResultAction;
  /** Extra content under the numbers, such as an unlocked reward. */
  children?: ReactNode;
  /** A stable id for the title, when tests or the game refer to it. */
  headingId?: string;
  /** Escape is left to the cabinet unless the game handles it here. */
  onEscape?: () => void;
}

const ROLL_UP_MS = 700;

const STAT_COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

const STAMP_TONE: Record<Verdict, string> = {
  win: "border-emerald-400/70 text-emerald-300",
  loss: "border-rose-400/70 text-rose-300",
  neutral: "border-amber-400/70 text-amber-300",
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A number that counts up from zero once, writing to the DOM directly. */
function RollUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ROLL_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = `${Math.round(value * eased)}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = `${value}${suffix}`;
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${value}${suffix}`}
    </span>
  );
}

function bestLine(score: number, previousBest: number): ReactNode {
  if (score <= 0 && previousBest <= 0) return null;
  if (score > previousBest) {
    return previousBest > 0 ? (
      <span className="text-emerald-300">
        New best, {score - previousBest} over your old record
      </span>
    ) : (
      <span className="text-emerald-300">First score on the board</span>
    );
  }
  if (score === previousBest && score > 0) {
    return <span className="text-zinc-300">Tied your best</span>;
  }
  return (
    <span className="text-zinc-400">
      {previousBest - score} short of your best ({previousBest})
    </span>
  );
}

/**
 * The shared end-of-round card: a title, a verdict stamp, a roll-up of the
 * round's numbers, a best-score line and Replay / Next actions.
 *
 * It is a modal dialog that traps focus and starts on the primary action.
 * Escape is left to the cabinet unless `onEscape` is given. The roll-up and the stamp's entrance are
 * skipped under reduced motion.
 */
export function ResultCard({
  title,
  stamp,
  verdict,
  message,
  stats,
  score,
  previousBest,
  primary,
  secondary,
  children,
  headingId,
  onEscape,
}: ResultCardProps) {
  const generatedId = useId();
  const titleId = headingId ?? generatedId;
  const best =
    score !== undefined && previousBest !== undefined
      ? bestLine(score, previousBest)
      : null;
  const primaryRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: primaryRef,
    onEscape,
  });

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4 select-none">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="arcade-result-card relative my-auto w-full max-w-[28rem] rounded-2xl border border-white/[0.08] bg-[#13151a] p-6 text-left shadow-2xl"
      >
        <span
          aria-hidden="true"
          className={`arcade-result-stamp absolute right-5 top-5 rotate-[-8deg] rounded border-2 px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em] ${STAMP_TONE[verdict]}`}
        >
          {stamp}
        </span>
        <h3
          id={titleId}
          className="pr-24 font-mono text-xl font-bold tracking-[-0.035em] text-[#f4f4f6]"
        >
          {title}
        </h3>
        <span className="sr-only">{stamp}.</span>
        {message && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {message}
          </p>
        )}

        <dl
          className={`mt-5 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] ${
            STAT_COLUMNS[stats.length] ?? "grid-cols-2"
          }`}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#0d0e11] px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {stat.label}
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-bold text-[#f4f4f6]">
                <RollUp
                  key={stat.value}
                  value={stat.value}
                  suffix={stat.suffix}
                />
              </dd>
            </div>
          ))}
        </dl>

        {best && <p className="mt-3 font-mono text-[11px]">{best}</p>}

        {children}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 font-mono text-xs font-bold uppercase tracking-wider">
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 text-zinc-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]"
            >
              {secondary.icon}
              {secondary.label}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={primary.onClick}
            className="arcade-launch-button inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border px-5 text-zinc-950 transition-colors active:scale-[0.98]"
          >
            {primary.icon}
            {primary.label}
          </button>
        </div>
      </div>
    </div>
  );
}
