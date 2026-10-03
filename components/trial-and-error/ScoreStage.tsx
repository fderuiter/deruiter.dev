"use client";

import React, { useEffect, useRef } from "react";
import { clamp } from "@/lib/game-utils";
import {
  blankFigures,
  padFigures,
  rollValue,
  targetFill,
} from "@/components/trial-and-error/scoring-stage";

/** How long a counter takes to roll to its new value at 1×. */
const ROLL_MS = 320;

/**
 * A number that rolls up to each new value (#1524). React renders the final
 * value; while a roll runs, frames rewrite the same text node, so nothing
 * re-renders and the text always lands on what React holds. Padded with
 * figure spaces to `width`, so its digits never move as they arrive.
 */
function RollingNumber({
  value,
  width,
  roll,
  durationMs,
}: {
  value: number;
  width: number;
  roll: boolean;
  durationMs: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const from = shown.current;
    shown.current = value;
    const node = ref.current?.firstChild;
    if (!roll || !node || from === value) return;
    if (typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      node.nodeValue = padFigures(rollValue(from, value, t), width);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, width, roll, durationMs]);
  return <span ref={ref}>{padFigures(value, width)}</span>;
}

const TONE = {
  chips: {
    box: "border-[color:var(--te-chips)]/50 bg-[#0f1624]",
    text: "text-[color:var(--te-chips)]",
  },
  mult: {
    box: "border-[color:var(--te-plus-mult)]/50 bg-[#1a140a]",
    text: "text-[color:var(--te-plus-mult)]",
  },
  score: {
    box: "border-zinc-700 bg-[color:var(--te-surface-1)]",
    text: "text-[color:var(--te-text)]",
  },
} as const;

function Counter({
  label,
  tone,
  value,
  width,
  roll,
  durationMs,
  muted = false,
  note,
  testId,
}: {
  label: string;
  tone: keyof typeof TONE;
  /** Null holds the counter's space blank, as the score does before TOTAL. */
  value: number | null;
  width: number;
  roll: boolean;
  durationMs: number;
  muted?: boolean;
  /** A small mark beside the label, such as a struck Mult or an xMult. */
  note?: React.ReactNode;
  testId: string;
}) {
  return (
    <span
      className={`relative flex min-w-0 flex-col items-center border px-2 py-1 ${TONE[tone].box}`}
      data-testid={testId}
      data-value={value ?? ""}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      {/* Pinned to the corner, so a mark arriving mid-hand moves nothing. */}
      {note && (
        <span className="absolute -right-1.5 -top-2 flex items-center gap-1 bg-[color:var(--te-surface-0)] text-[10px] font-bold tabular-nums">
          {note}
        </span>
      )}
      <span
        className={`text-xl font-bold leading-none tabular-nums sm:text-2xl ${muted ? "text-zinc-500" : TONE[tone].text}`}
      >
        {value === null ? (
          blankFigures(width)
        ) : (
          <RollingNumber
            value={value}
            width={width}
            roll={roll}
            durationMs={durationMs}
          />
        )}
      </span>
    </span>
  );
}

interface ScoreCountersProps {
  chips: number;
  mult: number;
  /** A product of the hand's ×Mult factors; shown beside Mult when not 1. */
  xMult?: number;
  /** The hand's score, or null while it is still being counted. */
  score: number | null;
  /** Characters each counter holds (see `counterWidth`). */
  width: number;
  /** Values roll up as they change (scoring playback, motion allowed). */
  roll: boolean;
  /** Game speed: rolls finish sooner at 2× and 4×. */
  speed?: number;
  /** Nothing to count yet: the counters show zeros in grey. */
  muted?: boolean;
  /** The Mult before a penalty cut it, struck through beside the label. */
  struckMult?: number | null;
  /** Prefix for the counters' test ids, e.g. "player" or "preview". */
  idPrefix: string;
}

/**
 * The scoring stage's big Chips × Mult = Score counters (#1524): blue Chips,
 * amber Mult, as the card table's suits and tokens define them. Every value
 * comes from the caller; nothing here computes a score.
 */
export function ScoreCounters({
  chips,
  mult,
  xMult = 1,
  score,
  width,
  roll,
  speed = 1,
  muted = false,
  struckMult = null,
  idPrefix,
}: ScoreCountersProps) {
  const durationMs = ROLL_MS / Math.max(1, speed);
  const shared = { width, roll, durationMs, muted };
  return (
    <span
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      data-testid={`${idPrefix}-counters`}
      data-chips={chips}
      data-mult={mult}
      data-xmult={xMult}
      data-score={score ?? ""}
    >
      <Counter
        {...shared}
        label="Chips"
        tone="chips"
        value={chips}
        testId={`${idPrefix}-chips`}
      />
      <span aria-hidden="true" className="text-lg font-bold text-zinc-500">
        ×
      </span>
      <Counter
        {...shared}
        label="Mult"
        tone="mult"
        value={mult}
        testId={`${idPrefix}-mult`}
        note={
          (struckMult !== null || xMult !== 1) && (
            <>
              {struckMult !== null && (
                <s className="text-zinc-400 decoration-rose-400 decoration-2">
                  {struckMult}
                </s>
              )}
              {xMult !== 1 && (
                <span
                  className="border border-[color:var(--te-x-mult)]/60 px-0.5 text-[color:var(--te-x-mult)]"
                  data-testid={`${idPrefix}-xmult`}
                >
                  ×{xMult}
                </span>
              )}
            </>
          )
        }
      />
      <span aria-hidden="true" className="text-lg font-bold text-zinc-500">
        =
      </span>
      <Counter
        {...shared}
        label="Score"
        tone="score"
        value={score}
        testId={`${idPrefix}-score`}
      />
    </span>
  );
}

interface TargetBarProps {
  /** The Blind's round score shown now (held at its old value mid-playback). */
  score: number;
  target: number;
  /** The target is crossed: the bar turns emerald and reads CLEARED. */
  cleared: boolean;
  /** The CLEARED stamp slams on (a loud moment, cabinet-scoped CSS). */
  slam: boolean;
}

/**
 * The Blind's running score against its target (#1524): a bar that fills
 * toward the target (a transform, so the table never reflows) and slams
 * CLEARED when the hand crosses it.
 */
export function TargetBar({ score, target, cleared, slam }: TargetBarProps) {
  const fill = targetFill(score, target);
  const ceiling = Math.max(0, target);
  const width = String(target).length + 1;
  return (
    <div className="min-w-0 flex-1" data-testid="target-bar">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[10px] uppercase tracking-wider text-zinc-400">
        <span className="min-w-0 tabular-nums break-words">
          Round{" "}
          <span className="font-bold text-[color:var(--te-text)]">
            {padFigures(score, width)}
          </span>{" "}
          / <span className="text-[color:var(--te-plus-mult)]">{target}</span>
        </span>
        <span
          aria-hidden="true"
          className={`inline-block w-[8ch] shrink-0 text-right font-bold text-emerald-300 ${slam ? "te-loud-target-slam" : ""}`}
          data-testid="target-cleared"
        >
          {cleared ? "Cleared" : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Round score toward the Blind target"
        aria-valuemin={0}
        aria-valuemax={ceiling}
        aria-valuenow={clamp(score, 0, ceiling)}
        aria-valuetext={`${score} of ${target}`}
        className="relative mt-1 h-2.5 overflow-hidden border border-zinc-700 bg-[color:var(--te-surface-0)]"
      >
        <span
          className={`te-target-fill absolute inset-0 origin-left ${cleared ? "bg-emerald-400" : "bg-[color:var(--te-plus-mult)]"}`}
          style={{ transform: `scaleX(${fill})` }}
          data-fill={fill}
        />
      </div>
    </div>
  );
}
