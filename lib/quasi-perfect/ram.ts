import type { GameMode, PuzzlerLevelDef } from "./types";

/** Story Mode starts each level with this multiple of its Hacker Mode RAM. */
export const STORY_RAM_MULTIPLIER = 2;

/**
 * RAM a level starts with in the given mode. Story Mode is the forgiving
 * default: a real budget, but twice the Hacker Mode allowance.
 */
export function getStartingRam(
  level: Pick<PuzzlerLevelDef, "initialRam">,
  mode: GameMode
): number {
  return mode === "story"
    ? level.initialRam * STORY_RAM_MULTIPLIER
    : level.initialRam;
}

/**
 * Stars for a solved level: 0 for a proof admitted with sorry, otherwise
 * 1 to 3 by how little RAM the proof used. Both modes grade the RAM used
 * against the same gold and silver targets, so Story Mode's larger budget
 * makes a level harder to crash but not easier to three-star.
 */
export function computeLevelStars(
  level: Pick<
    PuzzlerLevelDef,
    "initialRam" | "goldRamTarget" | "silverRamTarget"
  >,
  mode: GameMode,
  remainingRam: number,
  usedSorry: boolean
): number {
  if (usedSorry) return 0;
  const ramUsed = getStartingRam(level, mode) - remainingRam;
  const hackerEquivalentRemaining = level.initialRam - ramUsed;
  if (hackerEquivalentRemaining >= level.goldRamTarget) return 3;
  if (hackerEquivalentRemaining >= level.silverRamTarget) return 2;
  return 1;
}
