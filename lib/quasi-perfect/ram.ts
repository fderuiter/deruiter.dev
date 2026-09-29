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

/** Player-facing description of one mode's RAM rules. */
export interface ModeRuleCopy {
  /** Mode name followed by a colon, for example "Story Mode:". */
  heading: string;
  /** How large the budget is. */
  budget: string;
  /** What a failed tactic costs. */
  failure: string;
  /** What happens at 0 GB. */
  exhaustion: string;
  /** How stars are graded. */
  scoring: string;
}

/**
 * Single source of truth for the RAM rules shown in the HUD, the Theory
 * Briefing and the manual. Both modes behave identically apart from the
 * starting budget: a failed tactic costs RAM, and 0 GB stops the session.
 *
 * @param mode - Story or Hacker mode.
 * @param level - When given, the budget names the exact starting GB.
 * @returns The copy for that mode.
 */
export function describeModeRules(
  mode: GameMode,
  level?: Pick<PuzzlerLevelDef, "initialRam">
): ModeRuleCopy {
  const exhaustion =
    "At 0 GB the simulated tactic session stops and the level must be reset, in either mode.";
  const scoring =
    "Stars grade RAM used against the Hacker targets in both modes, so the larger Story budget makes a level harder to fail, not easier to three-star.";
  if (mode === "story") {
    const gb = level
      ? ` (${getStartingRam(level, mode)} GB on this level)`
      : "";
    return {
      heading: "Story Mode:",
      budget: `${STORY_RAM_MULTIPLIER}× RAM budget${gb}.`,
      failure: "Failed tactics still cost RAM.",
      exhaustion,
      scoring,
    };
  }
  const gb = level ? ` (${getStartingRam(level, mode)} GB on this level)` : "";
  return {
    heading: "Hacker Mode:",
    budget: `base RAM budget${gb}.`,
    failure: "Failed tactics cost RAM.",
    exhaustion,
    scoring,
  };
}
