/**
 * Burpee Slam, Spin Jump and Wall Jump for Monkey C Mayhem (#2023).
 *
 * The Burpee Slam drops the fitness runner straight down; landing it stomps
 * the foe below and breaks the board under the feet. The Spin Jump is a
 * floatier mid-air jump from the action key that bounces off spiky foes. The
 * Wall Jump lets the runner jump once off the side of a station or plyo box.
 *
 * This module holds the tuning constants, the move names and their toasts.
 * It imports no engine code and no Node-only module, so the engine and the
 * standalone bundle can use it. The engine in `lib/garmin-engine.ts` applies
 * the rules to the run.
 */
import type { FoeKind } from "./garmin-foes";

/** Downward speed of a Burpee Slam, in px per 60 Hz frame. It is also the cap while slamming. */
export const SLAM_VY = 14;

/** Fitness Body Battery spent on each slam landing. */
export const SLAM_BATTERY_COST = 3;

/** How close a foe's bottom must sit to the landing surface to be slammed, in px. */
export const SLAM_REACH = 8;

/** The bounce a Spin Jump takes off a spiky foe it lands on. The spin itself adds no lift. */
export const SPIN_JUMP_VY = -6;

/** Downward pull while a Spin Jump falls: lighter than a normal fall, so the descent floats. */
export const SPIN_GRAVITY = 0.35;

/** Fastest a Spin Jump falls, in px per frame. */
export const SPIN_MAX_FALL = 5;

/** Upward speed of a Wall Jump off a station or plyo side. */
export const WALL_JUMP_VY = -10.5;

/** Fastest the runner slides down a wall while pressed against it, in px per frame. */
export const WALL_SLIDE_MAX_VY = 2.5;

/**
 * The moves that toast the first time they are used in a run, and the course
 * pieces named the first time the runner meets them (#2022).
 */
export type MoveName = "slam" | "wall" | "spin" | "plyo" | "belt" | "current";

/** The popup line for each move's first use in a run, or the banner for a course piece's first meeting. */
export const MOVE_TOASTS: Record<MoveName, string> = {
  slam: "BURPEE SLAM!",
  wall: "WALL JUMP!",
  spin: "SPIN JUMP!",
  plyo: "PLYO BOX · HOLD JUMP TO GO HIGHER",
  belt: "TREADMILL BELT · RIDE IT ACROSS",
  current: "CURRENT · SWIM WITH THE FLOW",
};

/**
 * Whether a foe is spiky: a Spin Jump bounces off it instead of stomping it.
 * The Move Alert and the Jellyfish are spiky.
 */
export function isSpikyFoe(kind: FoeKind): boolean {
  return kind === "alert" || kind === "jellyfish";
}
