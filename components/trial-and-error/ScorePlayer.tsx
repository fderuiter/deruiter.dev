"use client";

import React, {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  HAND_NAMES,
  type PopulationType,
  type TimelineStep,
} from "@/lib/trial-and-error";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import { LOUD_PRESETS } from "@/components/trial-and-error/LoudLayer";
import { ScoreCounters } from "@/components/trial-and-error/ScoreStage";
import {
  counterWidth,
  scoredChips,
  travelFrom,
} from "@/components/trial-and-error/scoring-stage";
import { CardFlip } from "@/components/trial-and-error/cards/CardFlip";
import { SUIT_BORDER } from "@/components/trial-and-error/cards/CardFace";

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

/** A played card as the scoring stage shows it. */
interface PlayedCardInfo {
  id: string;
  number: string;
  /** The card's suit, for its coloured edge. */
  population?: PopulationType;
  /** Table, Listing, Figure or Token, printed small on the face. */
  kind?: string;
}

interface ScorePlayerProps {
  steps: TimelineStep[];
  shown: number;
  /** Played cards in played order, for the play zone. */
  cards: PlayedCardInfo[];
  /**
   * Slots in the play zone (the Blind's selection limit). Unused slots stay
   * as dashed outlines, so the zone keeps the shape it had during selection.
   */
  slots?: number;
  loudEffectsEnabled: boolean;
  /** Cards travel in and flip (no reduced motion). */
  animate?: boolean;
  /** Game speed: travel and roll-ups run faster at 2× and 4×. */
  speed?: number;
  /**
   * Where a played card left the hand, so it can travel from there into the
   * play zone. Null (or an unmeasured box) skips the trip.
   */
  originOf?: (cardId: string) => DOMRect | null;
  onSkip: () => void;
}

/** How hard a step shakes the stage, in px: 0 for calm steps, 6 for ×0. */
const shakeIntensity = (step: TimelineStep | undefined): number => {
  if (step?.kind === "ZERO_RULE") return 6;
  if (step?.kind === "X_MULT" && step.factor !== 1) return 2 + step.factor;
  return 0;
};

/** Travel time into the play zone at 1×, and the stagger between cards. */
const TRAVEL_MS = 380;
const TRAVEL_STAGGER_MS = 60;

/**
 * One played card in the play zone. It travels in from where it left the
 * hand (a transform from its old box, so nothing reflows) and flips over to
 * its Chips once its CARD_SCORED step lands.
 */
function PlayedCard({
  card,
  index,
  chips,
  fired,
  animate,
  speed,
  originOf,
}: {
  card: PlayedCardInfo;
  index: number;
  /** Chips the card has added so far; undefined until it scores. */
  chips: number | undefined;
  /** A relic fired on this card at the current step. */
  fired: boolean;
  animate: boolean;
  speed: number;
  originOf?: (cardId: string) => DOMRect | null;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const travel = useEffectEvent(() => {
    const el = ref.current;
    if (!animate || !el || typeof el.animate !== "function") return;
    const source = originOf?.(card.id);
    const trip = source ? travelFrom(source, el.getBoundingClientRect()) : null;
    if (!trip) return;
    el.animate(
      [
        {
          transform: `translate(${trip.x}px, ${trip.y}px) scale(${trip.scale})`,
          opacity: 0.6,
        },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      {
        duration: TRAVEL_MS / speed,
        delay: (index * TRAVEL_STAGGER_MS) / speed,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "backwards",
      }
    );
  });
  // Measured before the first paint, so the card never flashes in its slot.
  useLayoutEffect(() => travel(), []);

  const scored = chips !== undefined;
  const edge = card.population
    ? SUIT_BORDER[card.population]
    : "border-l-zinc-500";
  return (
    <li
      ref={ref}
      className="relative z-30 h-[4.5rem] w-12 shrink-0 sm:w-14 [perspective:600px]"
      data-played-card={card.id}
      data-scored={scored ? "" : undefined}
    >
      <span
        data-relic-fired={fired ? "" : undefined}
        className={`block h-full w-full transition-transform duration-150 ${
          fired
            ? "-translate-y-2 motion-safe:scale-110"
            : scored
              ? "-translate-y-1"
              : ""
        }`}
      >
        <CardFlip
          faceUp={!scored}
          animate={animate}
          front={
            <span
              className={`flex h-full flex-col justify-between border border-l-4 border-zinc-700 bg-[color:var(--te-surface-1)] p-1 text-[9px] ${edge}`}
            >
              <span className="uppercase tracking-wider text-zinc-400">
                {card.kind ?? "Card"}
              </span>
              <span className="min-w-0 text-[9px] font-bold sm:text-[10px] leading-tight text-zinc-100 break-words">
                {card.number}
              </span>
            </span>
          }
          back={
            <span
              className={`flex h-full flex-col items-center justify-center gap-0.5 border px-0.5 text-center ${
                fired
                  ? "border-[color:var(--te-plus-mult)] bg-[#1a140a]"
                  : "border-[color:var(--te-chips)] bg-[#0f1624]"
              }`}
            >
              <span className="text-base font-bold leading-none tabular-nums text-[color:var(--te-chips)]">
                +{chips ?? 0}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-zinc-400">
                Chips
              </span>
              <span className="min-w-0 text-[8px] leading-tight text-zinc-300 break-words">
                {card.number}
              </span>
            </span>
          }
        />
      </span>
    </li>
  );
}

/**
 * The scoring stage (T&E-UX-02, #1524). The played cards travel up into the
 * play zone and flip to their Chips as they score, while big Chips and Mult
 * counters roll up beside them. Every number comes from the timeline's
 * running totals, so the player never computes a score. Shake and flash
 * come from the Arcade Kit's `useArcadeFx`, which skips them under reduced
 * motion, below 768px and when the cabinet's Setup turns shake off.
 */
export function ScorePlayer({
  steps,
  shown,
  cards,
  slots = cards.length,
  loudEffectsEnabled,
  animate = false,
  speed = 1,
  originOf,
  onSkip,
}: ScorePlayerProps) {
  const fx = useArcadeFx({ enabled: loudEffectsEnabled });
  const { stageRef, flashRef } = fx;
  const revealed = steps.slice(0, shown);
  const current = revealed[revealed.length - 1];
  const running = current?.running ?? { chips: 0, mult: 0, xMult: 1 };
  const base = steps.find((s) => s.kind === "HAND_BASE");
  const zero = revealed.find((s) => s.kind === "ZERO_RULE");
  const total = revealed.find((s) => s.kind === "TOTAL");
  const progress = revealed.find((s) => s.kind === "BLIND_PROGRESS");
  const chips = scoredChips(revealed);
  // An ON_CARD_SCORED relic firing on a card: that card pops.
  const fired =
    current?.kind === "RELIC" && current.cardId ? current.cardId : null;
  const fire = loudEffectsEnabled && progress?.crossed;
  const width = counterWidth(steps);

  // Each loud step shakes or flashes the stage once, as it lands.
  const land = useEffectEvent((step: TimelineStep) => {
    const intensity = shakeIntensity(step);
    if (intensity > 0) fx.shake(intensity);
    if (step.kind === "ZERO_RULE") fx.flash("#fb7185");
    if (step.kind === "BLIND_PROGRESS" && step.crossed) fx.flash("#34d399");
  });
  useEffect(() => {
    const step = steps[shown - 1];
    if (step) land(step);
  }, [steps, shown]);

  return (
    <div
      className={`relative h-full ${fire ? LOUD_PRESETS.scorePlate : ""}`}
      onClick={onSkip}
      data-testid="score-player"
    >
      <div ref={stageRef} className="relative flex h-full flex-col gap-2">
        <div
          ref={flashRef}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 z-10 opacity-0"
        />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <ul
            className="flex min-w-0 flex-wrap items-end gap-1.5"
            aria-hidden="true"
            data-testid="played-cards"
          >
            {cards.map((card, index) => (
              <PlayedCard
                key={card.id}
                card={card}
                index={index}
                chips={chips.get(card.id)}
                fired={fired === card.id}
                animate={animate}
                speed={speed}
                originOf={originOf}
              />
            ))}
            {Array.from(
              { length: Math.max(0, slots - cards.length) },
              (_, i) => (
                <li
                  key={`open-${i}`}
                  className="h-[4.5rem] w-12 shrink-0 sm:w-14 border border-dashed border-zinc-800"
                />
              )
            )}
          </ul>
          <div className="relative flex min-w-0 flex-col items-end gap-1">
            <ScoreCounters
              chips={running.chips}
              mult={running.mult}
              xMult={running.xMult}
              score={total?.kind === "TOTAL" ? total.score : null}
              width={width}
              roll={animate}
              speed={speed}
              idPrefix="player"
            />
            {zero?.kind === "ZERO_RULE" && (
              <p
                className="absolute -bottom-1 right-0 z-20 -rotate-3 border-2 border-rose-400 bg-[color:var(--te-surface-0)] px-2 text-sm font-bold uppercase tracking-wider text-rose-300"
                data-testid="zero-slam"
              >
                {zero.label} ×0
              </p>
            )}
            {progress?.kind === "BLIND_PROGRESS" && progress.crossed && (
              <span
                className={`absolute -top-3 right-0 border border-emerald-400/70 bg-[color:var(--te-surface-0)] px-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ${fire ? LOUD_PRESETS.clearedBlind : ""}`}
                data-testid="player-cleared"
              >
                Cleared
              </span>
            )}
          </div>
        </div>
        {/* Two lines, always: a longer step never pushes the table. */}
        <p className="line-clamp-2 h-[2.5em] min-w-0 text-[11px] leading-[1.25em] text-zinc-300 break-words">
          <span className="mr-2 font-bold uppercase tracking-wider text-zinc-100">
            {base?.kind === "HAND_BASE" ? HAND_NAMES[base.handType] : "Scoring"}
          </span>
          <span data-testid="player-step">
            {current?.text ?? "Scoring cards…"}
          </span>
        </p>
      </div>
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
