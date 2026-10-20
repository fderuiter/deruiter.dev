/**
 * Every arcade game's progress, by game (#2548, design §4). It is kept apart
 * from `ARCADE_REGISTRY`, which the hub imports and should stay small; a
 * unit test keeps the two in step.
 *
 * Per-game slices are added by each game's ADR 0062 session-seam issue.
 * Until then an entry names only the key its best score was kept under
 * before `arcade.core`, which the core slice folds in once.
 */

import type { ArcadeSliceInfo } from "./slice";

/** One game's progress. */
export interface ArcadeCatalogEntry {
  /** The game's registry slug. */
  readonly slug: string;
  /** The game's own slices. */
  readonly slices: readonly ArcadeSliceInfo[];
  /**
   * The key the game's best score was kept under before `arcade.core`.
   * Read once by the core slice's upgrade and left in place.
   */
  readonly scoreKey?: string;
  /** Older names of `scoreKey`, folded in once as well. */
  readonly legacyScoreKeys?: readonly string[];
  /**
   * True when `scoreKey` holds the game's own save or unlock list rather
   * than a bare best, so it is read but never written.
   */
  readonly scoreKeyIsSave?: boolean;
}

/** Every game, in registry order. */
export const ARCADE_PROGRESS_CATALOG: readonly ArcadeCatalogEntry[] = [
  {
    slug: "working-with-duck",
    slices: [],
    scoreKey: "working_with_duck_high_score",
    legacyScoreKeys: ["working_duck_high_score"],
  },
  { slug: "laser-loon", slices: [], scoreKey: "laser_loon_high_score" },
  {
    slug: "quasi-puzzler",
    slices: [],
    scoreKey: "quasi_perfect_puzzler_progress_v1",
    legacyScoreKeys: ["quasi_puzzle_high_score"],
    scoreKeyIsSave: true,
  },
  {
    slug: "garmin-watch",
    slices: [],
    scoreKey: "garmin_simulator_high_score",
    legacyScoreKeys: ["garmin_runner_high_score"],
  },
  {
    slug: "clinical-chaos",
    slices: [],
    scoreKey: "clinical_chaos_highscore",
    legacyScoreKeys: ["clinical_chaos_high_score"],
  },
  {
    slug: "trial-and-error",
    slices: [],
    scoreKey: "trial_and_error_high_score",
  },
  {
    slug: "study-director",
    slices: [],
    scoreKey: "study_director_high_score",
  },
  {
    slug: "patty-drive-thru",
    slices: [],
    scoreKey: "patty_drive_thru_high_score",
  },
  {
    slug: "for-better-or-bulk",
    slices: [],
    scoreKey: "for_better_or_bulk_high_score",
  },
  {
    slug: "retro-labyrinth",
    slices: [],
    scoreKey: "retro_labyrinth_highscore",
  },
  {
    // The vault's score counts its trophies, so the trophy list is read.
    slug: "meme-vault",
    slices: [],
    scoreKey: "meme_achievements_unlocked",
    scoreKeyIsSave: true,
  },
  {
    slug: "protocol-drift",
    slices: [],
    scoreKey: "protocol_drift_high_score",
  },
];

/**
 * A game's catalog entry, or undefined for a slug the arcade does not know.
 *
 * @param slug - The game's registry slug.
 * @returns The entry.
 */
export function getArcadeCatalogEntry(
  slug: string
): ArcadeCatalogEntry | undefined {
  return ARCADE_PROGRESS_CATALOG.find((entry) => entry.slug === slug);
}
