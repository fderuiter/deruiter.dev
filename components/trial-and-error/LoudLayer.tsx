import React from "react";

/** Named loud-moment presets for the surfaces that use them. */
export const LOUD_PRESETS = {
  /** The score plate catches fire when a hand crosses the target. */
  scorePlate: "te-loud-fire",
  /** A cleared Blind glows. */
  clearedBlind: "te-loud-glow",
  /** A footnote seal presses onto a card. */
  sealPress: "te-loud-seal",
  /** A crisis card slams onto the table. */
  crisisSlam: "te-loud-crisis",
  /** A Guidance card levels a hand's plate up. */
  levelUp: "te-loud-level",
} as const;

interface LoudLayerProps {
  /** A loud moment is happening (score resolution, a Blind cleared or failed). */
  loud: boolean;
  /** The cabinet allows loud effects (≥768px, no reduced motion). */
  enabled: boolean;
}

/**
 * The CRT and background-swirl overlay for loud moments. It renders nothing
 * at rest, so nothing animates when the table is calm (AGENTS.md §20), and
 * nothing below 768px or under reduced motion. CSS gradients and a mask only:
 * no canvas, no shader, no large blur.
 */
export function LoudLayer({ loud, enabled }: LoudLayerProps) {
  if (!loud || !enabled) return null;
  return (
    <>
      <div
        aria-hidden="true"
        data-te-loud-layer="swirl"
        className="te-loud-swirl pointer-events-none absolute inset-0 z-30 overflow-hidden"
      />
      <div
        aria-hidden="true"
        data-te-loud-layer="crt"
        className="te-loud-crt pointer-events-none absolute inset-0 z-40"
      />
    </>
  );
}
