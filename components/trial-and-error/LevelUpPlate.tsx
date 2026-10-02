"use client";

import React, { useState } from "react";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { clamp } from "@/lib/game-utils";
import { HAND_NAMES, type LevelUp } from "@/lib/trial-and-error";
import { LOUD_PRESETS } from "@/components/trial-and-error/LoudLayer";

interface LevelUpPlateProps {
  levelUp: LevelUp;
  /** Numbers land at once instead of ticking. */
  reducedMotion: boolean;
  /** The cabinet allows loud effects (≥768px, no reduced motion). */
  loud: boolean;
}

const TICK_MS = 600;

/**
 * The level-up moment (T&E-UX-05): the hand's plate steps up a level while
 * its base Chips and +Mult tick from the old values to the new. The values
 * come from the domain's `LevelUp`; the plate only animates between them.
 * Remount it (key on the event) to replay.
 */
export function LevelUpPlate({
  levelUp,
  reducedMotion,
  loud,
}: LevelUpPlateProps) {
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);
  // A change to reducedMotion restarts the tick from zero, as the effect
  // this replaced did when it re-ran.
  const [tickedFor, setTickedFor] = useState(reducedMotion);
  if (tickedFor !== reducedMotion) {
    setTickedFor(reducedMotion);
    setProgress(0);
  }

  // Wall-clock time since the first frame drives the tick, so delta clamping
  // is off; the loop stops once the numbers land.
  useAnimationFrame(
    (_deltaMs, elapsedMs) => setProgress(clamp(elapsedMs / TICK_MS, 0, 1)),
    { isActive: !reducedMotion && progress < 1, maxDeltaMs: Infinity }
  );

  const shown = reducedMotion ? 1 : progress;
  const tween = (from: number, to: number) =>
    Math.round(from + (to - from) * shown);

  return (
    <div
      className={`border border-amber-400/70 bg-amber-500/10 px-3 py-2 ${loud ? LOUD_PRESETS.levelUp : ""}`}
      data-testid="level-up"
    >
      <p className="text-[10px] uppercase tracking-wider text-amber-300 break-words">
        {levelUp.guidanceName} · level up
      </p>
      <p className="mt-1 font-bold uppercase tracking-wider break-words">
        {HAND_NAMES[levelUp.handType]}{" "}
        <span className="text-zinc-400">Lv.{levelUp.from.level}</span> →{" "}
        <span className="text-amber-300">Lv.{levelUp.to.level}</span>
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums" aria-hidden="true">
        <span className="text-[color:var(--te-chips)]">
          [{tween(levelUp.from.chips, levelUp.to.chips)}]
        </span>{" "}
        ×{" "}
        <span className="text-[color:var(--te-plus-mult)]">
          [{tween(levelUp.from.mult, levelUp.to.mult)}]
        </span>
      </p>
    </div>
  );
}
