/**
 * The Running Buddy for Monkey C Mayhem (#2024): a dog on a leash that
 * hatches from a rare Sync Block on a land stage.
 *
 * The runner rides the buddy. A rider jumps a little higher, and the buddy
 * eats the small foes it runs into. A hit while riding costs the buddy
 * instead of a power tier: it runs off ahead and can be caught again for a
 * short time. The buddy never enters a bonus room and never carries across
 * stages. The engine in `lib/garmin-engine.ts` applies these rules; the
 * hatched and runaway buddy travel the course as a "buddy" pickup.
 */
import type { Foe } from "./garmin-foes";

/**
 * Speed a freshly hatched buddy leaps off its block with, in world px per
 * 60 Hz frame: far past a sprint (3.75), so it lands ahead of the runner who
 * bumped it even at a sprint, then it sits and waits there to be caught.
 */
export const BUDDY_SPEED = 9;
/** Upward speed of a hatched buddy's leap off its block (negative is up). */
export const BUDDY_HOP_VY = -4;
/** Extra take-off speed for a rider, added to the jump (negative is up). */
export const BUDDY_JUMP_BONUS_VY = -1.5;
/** How long a buddy that ran off after a hit can be caught again. */
export const BUDDY_RUNAWAY_MS = 3000;
/**
 * A runaway buddy's speed: faster than a run (2.5 px per frame) and slower
 * than a sprint (3.75), so only a sprint catches it.
 */
export const BUDDY_RUNAWAY_SPEED = 3;
/** How far ahead of the runner's front a runaway buddy starts, in px. */
export const BUDDY_RUNAWAY_LEAD = 24;
/** Points for a foe the buddy eats. */
export const BUDDY_EAT_SCORE = 200;

/** Popup texts for the buddy's moments. */
export const BUDDY_TOASTS = {
  /** Mounting the buddy. */
  mount: "Good boy!",
  /** The buddy runs off after a hit. */
  lost: "Come back!",
  /** A runaway buddy was not caught in time. */
  gone: "Bye, buddy!",
  /** The buddy waits outside a bonus room and is left behind. */
  stay: "Stay!",
} as const;

/**
 * Whether the buddy eats this foe on contact. Small foes are eaten; the Rep
 * Max and the water foes are not.
 */
export function isEdibleFoe(foe: Pick<Foe, "kind" | "mode">): boolean {
  if (foe.mode === "drift") return false;
  return (
    foe.kind === "kettlebell" ||
    foe.kind === "alert" ||
    foe.kind === "box" ||
    foe.kind === "lap"
  );
}
