"use client";

import React, { useEffect, useEffectEvent, useState } from "react";
import { motion } from "framer-motion";
import { HAND_NAMES, type TimelineStep } from "@/lib/trial-and-error";
import {
  LOUD_PRESETS,
  MAX_SHAKE_PX,
  shakeAmplitude,
} from "@/components/trial-and-error/LoudLayer";

/** Total budget for a hand's steps at 1×, before the closing hold. */
const STEP_BUDGET_MS = 3300;
/** No single step lingers longer than this at 1×, however short the hand. */
const STEP_CEILING_MS = 450;
/** How long the final state (flame, CLEARED) holds at 1× before input returns. */
const FINAL_HOLD_MS = 600;

interface PlaybackOptions {
  speed: number;
  reducedMotion: boolean;
  onStep?: (step: TimelineStep, index: number) => void;
}

interface Playback {
  /** Steps revealed so far, 0 to steps.length. */
  shown: number;
  /** True from the moment a hand is played until its timeline resolves. */
  playing: boolean;
  /** Jumps to the resolved state. */
  skip: () => void;
}

/**
 * Paces a hand's score timeline. A new `playKey` (the played hand's
 * identity) starts playback; under reduced motion it resolves at once. The
 * whole hand stays under about 4 s at 1× because per-step durations shrink
 * under a fixed budget as the step count grows.
 */
export function useScorePlayback(
  steps: TimelineStep[] | null,
  playKey: object | null,
  { speed, reducedMotion, onStep }: PlaybackOptions
): Playback {
  const total = steps?.length ?? 0;
  // `shown === total + 1` means resolved: the closing hold has elapsed.
  const [progress, setProgress] = useState<{
    key: object | null;
    shown: number;
  }>({
    key: null,
    shown: 0,
  });
  const fresh = progress.key !== playKey;
  const position = fresh ? (reducedMotion ? total + 1 : 0) : progress.shown;
  const playing = playKey !== null && total > 0 && position <= total;
  const delay =
    position >= total
      ? FINAL_HOLD_MS / speed
      : Math.min(STEP_CEILING_MS, STEP_BUDGET_MS / total) / speed;

  const emitStep = useEffectEvent((index: number) => {
    const step = steps?.[index];
    if (step) onStep?.(step, index);
  });

  useEffect(() => {
    if (playing && position > 0 && position <= total) emitStep(position - 1);
  }, [playing, position, total]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setProgress({ key: playKey, shown: position + 1 }),
      delay
    );
    return () => clearTimeout(timer);
  }, [playing, playKey, position, total, delay]);

  return {
    shown: Math.min(position, total),
    playing,
    skip: () => setProgress({ key: playKey, shown: total + 1 }),
  };
}

interface ScorePlayerProps {
  steps: TimelineStep[];
  shown: number;
  /** Played cards in played order, for the lift row. */
  cards: { id: string; number: string }[];
  loudEffectsEnabled: boolean;
  onSkip: () => void;
  skipRef?: React.Ref<HTMLButtonElement>;
}

/** How hard a step shakes the plate: 0 for calm steps, the cap for ×0. */
const shakeIntensity = (step: TimelineStep | undefined): number => {
  if (step?.kind === "ZERO_RULE") return MAX_SHAKE_PX;
  if (step?.kind === "X_MULT" && step.factor !== 1) return 2 + step.factor;
  return 0;
};

/**
 * The scoring spectacle (T&E-UX-02). Displays the score timeline up to the
 * `shown` step; every number comes from the step's running totals, so the
 * player never computes a score. Loud layers are CSS classes that only take
 * effect inside a cabinet with `data-te-loud="on"`.
 */
export function ScorePlayer({
  steps,
  shown,
  cards,
  loudEffectsEnabled,
  onSkip,
  skipRef,
}: ScorePlayerProps) {
  const revealed = steps.slice(0, shown);
  const current = revealed[revealed.length - 1];
  const running = current?.running ?? { chips: 0, mult: 0, xMult: 1 };
  const base = steps.find((s) => s.kind === "HAND_BASE");
  const zero = revealed.find((s) => s.kind === "ZERO_RULE");
  const total = revealed.find((s) => s.kind === "TOTAL");
  const progress = revealed.find((s) => s.kind === "BLIND_PROGRESS");
  const scored = new Set(
    revealed.flatMap((s) => (s.kind === "CARD_SCORED" ? [s.cardId] : []))
  );
  // An ON_CARD_SCORED relic firing on a card: that card shakes and pops.
  const fired =
    current?.kind === "RELIC" && current.cardId ? current.cardId : null;
  const intensity = shakeIntensity(current);
  const loud = loudEffectsEnabled && intensity > 0;
  const fire = loudEffectsEnabled && progress?.crossed;

  return (
    <div
      className={`relative ${fire ? LOUD_PRESETS.scorePlate : ""}`}
      onClick={onSkip}
      data-testid="score-player"
    >
      <div
        key={loud ? shown : "calm"}
        className={loud ? "te-loud-shake" : ""}
        style={
          loud
            ? ({
                "--te-shake-amp": shakeAmplitude(intensity),
              } as React.CSSProperties)
            : undefined
        }
      >
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">
          {base?.kind === "HAND_BASE" ? HAND_NAMES[base.handType] : "Scoring"}
        </p>
        <ul className="mt-1 flex flex-wrap gap-1" aria-hidden="true">
          {cards.map((card) => (
            <li
              key={fired === card.id ? `${card.id}@${shown}` : card.id}
              data-relic-fired={fired === card.id ? "" : undefined}
              className={`border px-1 text-[10px] transition-transform duration-150 ${
                fired === card.id
                  ? `-translate-y-1 motion-safe:scale-110 border-[color:var(--te-plus-mult)] text-[color:var(--te-plus-mult)] ${loudEffectsEnabled ? "te-loud-shake" : ""}`
                  : scored.has(card.id)
                    ? "-translate-y-1 border-[color:var(--te-chips)] text-[color:var(--te-chips)]"
                    : "border-zinc-700 text-zinc-400"
              }`}
              style={
                fired === card.id && loudEffectsEnabled
                  ? ({
                      "--te-shake-amp": shakeAmplitude(3),
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {card.number}
            </li>
          ))}
        </ul>
        <p
          className="mt-1 text-lg font-bold tabular-nums break-words"
          data-testid="player-counters"
        >
          <motion.span
            key={`c${running.chips}`}
            initial={{ y: -4 }}
            animate={{ y: 0 }}
            className="inline-block text-[color:var(--te-chips)]"
          >
            [{running.chips}]
          </motion.span>{" "}
          × [
          <motion.span
            key={`m${running.mult}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="inline-block text-[color:var(--te-plus-mult)]"
          >
            {running.mult}
          </motion.span>
          ]
          {running.xMult !== 1 && (
            <motion.span
              key={`x${running.xMult}`}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="ml-1 inline-block text-[color:var(--te-x-mult)]"
            >
              ×{running.xMult}
            </motion.span>
          )}
          {total?.kind === "TOTAL" && (
            <span className={fire ? LOUD_PRESETS.clearedBlind : ""}>
              {" "}
              = {total.score}
            </span>
          )}
        </p>
        <p className="mt-1 min-h-[2.5em] text-xs text-zinc-300 break-words">
          {current?.text ?? "Scoring cards…"}
        </p>
        <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
          {zero?.kind === "ZERO_RULE" && (
            <p
              className="-rotate-2 border-2 border-rose-400 px-2 text-sm font-bold uppercase tracking-wider text-rose-300"
              data-testid="zero-slam"
            >
              {zero.label} ×0
            </p>
          )}
          {progress?.kind === "BLIND_PROGRESS" && progress.crossed && (
            <p
              className="text-xs font-bold uppercase tracking-wider text-emerald-300"
              data-testid="player-cleared"
            >
              Cleared
            </p>
          )}
        </div>
      </div>
      <button
        ref={skipRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
        }}
        className="mt-2 min-h-[44px] border border-zinc-600 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        Skip [Space]
      </button>
    </div>
  );
}

/** The resolved hand's steps as text, for readers who want the arithmetic. */
export function ScoreBreakdown({ steps }: { steps: TimelineStep[] }) {
  return (
    <details
      className="mt-2 text-xs text-zinc-300"
      data-testid="score-breakdown"
    >
      <summary className="min-h-[44px] cursor-pointer py-3 text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        Last hand breakdown
      </summary>
      <ol className="list-decimal space-y-1 pl-5 break-words">
        {steps.map((step, i) => (
          <li key={i}>{step.text}</li>
        ))}
      </ol>
    </details>
  );
}
