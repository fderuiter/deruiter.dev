import type { FormFactor } from "../form-factor";

/** Trophy definition structure. */
export interface ArcadeTrophy {
  id: string;
  gameId: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "gameplay" | "milestone" | "mastery" | "cross_game";
  targetScore?: number;
  /**
   * A named moment in play (an act cleared, every level proven) that unlocks
   * this trophy through recordArcadeMilestone. A trophy with a milestone and
   * no targetScore unlocks only from play, never from a score (#2047).
   */
  milestone?: string;
  conditionDescription: string;
}

/** One finished run, as a game reports it to the arcade (#2371). */
export interface ArcadeRun {
  /** The run's score; the best one is kept. */
  score: number;
  /** The view the run was played in (ADR 0062), for launch telemetry. */
  view: FormFactor;
  /** The game's mode, e.g. "campaign" or "daily". */
  mode?: string;
  /** How long the run took, in milliseconds. */
  durationMs?: number;
}
