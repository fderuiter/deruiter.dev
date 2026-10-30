/**
 * Arcade Achievement Registry & High Score System
 *
 * Trophy definitions grouped by game (#3489) and the score and milestone API
 * every arcade game reports to. Bests and trophies live in the `arcade.core`
 * progress slice (`lib/arcade/progress`, #2548), which keeps the bytes of
 * `arcade_unified_progress_v1`.
 */

import { emitAppEvent } from "@/lib/event-bus";
import {
  ARCADE_UNIFIED_PROGRESS_KEY,
  arcadeCoreSlice,
  parseScoreValue,
  read,
  write,
  type ArcadeProgress,
} from "../progress";
import type { RunTags } from "../run-tags";
import { CLINICAL_CHAOS_TROPHIES } from "./clinical-chaos";
import { CROSS_GAME_TROPHIES } from "./cross-game";
import { FOR_BETTER_OR_BULK_TROPHIES } from "./for-better-or-bulk";
import { GARMIN_WATCH_TROPHIES } from "./garmin-watch";
import { LASER_LOON_TROPHIES } from "./laser-loon";
import { MEME_VAULT_TROPHIES } from "./meme-vault";
import { PATTY_DRIVE_THRU_TROPHIES } from "./patty-drive-thru";
import { PROTOCOL_DRIFT_TROPHIES } from "./protocol-drift";
import { QUASI_PUZZLER_TROPHIES } from "./quasi-puzzler";
import { RETRO_LABYRINTH_TROPHIES } from "./retro-labyrinth";
import { STUDY_DIRECTOR_TROPHIES } from "./study-director";
import { TRIAL_AND_ERROR_TROPHIES } from "./trial-and-error";
import type { ArcadeRun, ArcadeTrophy } from "./types";
import { WORKING_WITH_DUCK_TROPHIES } from "./working-with-duck";

export { ARCADE_UNIFIED_PROGRESS_KEY, parseScoreValue };
export type { ArcadeProgress, ArcadeRun, ArcadeTrophy };

/** Complete Arcade Trophy Registry. */
export const ARCADE_TROPHIES: ArcadeTrophy[] = [
  ...WORKING_WITH_DUCK_TROPHIES,
  ...LASER_LOON_TROPHIES,
  ...QUASI_PUZZLER_TROPHIES,
  ...GARMIN_WATCH_TROPHIES,
  ...CLINICAL_CHAOS_TROPHIES,
  ...TRIAL_AND_ERROR_TROPHIES,
  ...STUDY_DIRECTOR_TROPHIES,
  ...PATTY_DRIVE_THRU_TROPHIES,
  ...FOR_BETTER_OR_BULK_TROPHIES,
  ...PROTOCOL_DRIFT_TROPHIES,
  ...RETRO_LABYRINTH_TROPHIES,
  ...MEME_VAULT_TROPHIES,
  ...CROSS_GAME_TROPHIES,
];

/** Returns default initial arcade progress object. */
export function getDefaultArcadeProgress(): ArcadeProgress {
  return {
    highScores: {},
    unlockedTrophies: {},
    updatedAt: Date.now(),
  };
}

function copyProgress(progress: ArcadeProgress): ArcadeProgress {
  return {
    ...progress,
    highScores: { ...progress.highScores },
    unlockedTrophies: { ...progress.unlockedTrophies },
    ...(progress.bestTags ? { bestTags: { ...progress.bestTags } } : {}),
  };
}

/**
 * Reads the current Arcade progress from the `arcade.core` slice. The
 * first read after an upgrade folds the old per-game score keys in once.
 * Returns a copy the caller may change and pass to saveArcadeProgress.
 */
export function getArcadeProgress(): ArcadeProgress {
  if (typeof window === "undefined") return getDefaultArcadeProgress();
  return copyProgress(read(arcadeCoreSlice));
}

/**
 * Saves Arcade progress to the `arcade.core` slice, in the same envelope
 * format as before.
 */
export function saveArcadeProgress(progress: ArcadeProgress): boolean {
  if (typeof window === "undefined") return false;
  progress.updatedAt = Date.now();
  return write(arcadeCoreSlice, progress);
}

/** Game trophies (not cross-game ones) Hall of Famer counts toward. */
export const HALL_OF_FAME_TROPHY_COUNT = 15;

/**
 * Evaluates and unlocks any earned trophies based on current high scores.
 */
export function evaluateTrophies(progress: ArcadeProgress): ArcadeTrophy[] {
  const newlyUnlocked: ArcadeTrophy[] = [];
  const now = Date.now();

  const gamesPlayedCount = Object.values(progress.highScores).filter(
    (val) => val > 0
  ).length;

  // Scores differ wildly between games (a Trial & Error hand is worth
  // thousands, a For Better or Bulk day about 20), so the meta trophy counts
  // trophies instead of summing scores (#2047).
  // Counted when reached, after this pass's game trophies (listed first).
  const gameTrophyCount = () =>
    ARCADE_TROPHIES.filter(
      (t) => t.category !== "cross_game" && progress.unlockedTrophies[t.id]
    ).length;

  for (const trophy of ARCADE_TROPHIES) {
    if (progress.unlockedTrophies[trophy.id]) {
      continue; // Already unlocked
    }

    let isUnlocked = false;

    if (trophy.category === "cross_game") {
      if (trophy.id === "arcade_triathlon" && gamesPlayedCount >= 3) {
        isUnlocked = true;
      } else if (
        trophy.id === "arcade_completionist" &&
        gamesPlayedCount >= 6
      ) {
        isUnlocked = true;
      } else if (
        trophy.id === "arcade_legend" &&
        gameTrophyCount() >= HALL_OF_FAME_TROPHY_COUNT
      ) {
        isUnlocked = true;
      }
    } else {
      const gameScore = progress.highScores[trophy.gameId] || 0;
      if (trophy.targetScore && gameScore >= trophy.targetScore) {
        isUnlocked = true;
      }
    }

    if (isUnlocked) {
      progress.unlockedTrophies[trophy.id] = now;
      newlyUnlocked.push(trophy);
    }
  }

  return newlyUnlocked;
}

/**
 * Unlocks named trophies a game awards from a finished run rather than from a
 * score. A trophy already unlocked keeps its first timestamp, and only the
 * newly unlocked ones are returned and announced.
 */
export function unlockArcadeTrophies(
  trophyIds: readonly string[]
): ArcadeTrophy[] {
  const progress = getArcadeProgress();
  const now = Date.now();
  const newlyUnlocked: ArcadeTrophy[] = [];
  for (const trophy of ARCADE_TROPHIES) {
    if (
      !trophyIds.includes(trophy.id) ||
      progress.unlockedTrophies[trophy.id]
    ) {
      continue;
    }
    progress.unlockedTrophies[trophy.id] = now;
    newlyUnlocked.push(trophy);
  }
  if (newlyUnlocked.length === 0) return newlyUnlocked;
  // A named trophy can tip a cross-game count over its line.
  newlyUnlocked.push(...evaluateTrophies(progress));
  saveArcadeProgress(progress);
  for (const trophy of newlyUnlocked) {
    emitAppEvent("arcade_trophy_unlocked", {
      trophyId: trophy.id,
      gameId: trophy.gameId,
      title: trophy.title,
      unlockedAt: now,
    });
  }
  return newlyUnlocked;
}

/**
 * Records a named moment in a game's play (an act cleared, every level
 * proven) and unlocks the trophies that game ties to it. Unknown milestones
 * unlock nothing, so a game can fire them before a trophy exists (#2047).
 */
export function recordArcadeMilestone(
  gameId: string,
  milestone: string
): ArcadeTrophy[] {
  const ids = ARCADE_TROPHIES.filter(
    (t) => t.gameId === gameId && t.milestone === milestone
  ).map((t) => t.id);
  return ids.length > 0 ? unlockArcadeTrophies(ids) : [];
}

/**
 * Core function to record an arcade score, update storage, evaluate achievements,
 * and dispatch typed event-bus events.
 *
 * @param gameId - The game's id.
 * @param score - The run's score.
 * @param metadata - Extra detail for the `arcade_score_updated` event.
 * @param tags - How the run was played (#2547), kept with a new best so
 *   score lists and gates can tell an assisted best from an unassisted one.
 * @returns The saved progress and the trophies this score unlocked.
 */
export function recordArcadeScore(
  gameId: string,
  score: number,
  metadata?: Record<string, unknown>,
  tags?: RunTags
): { progress: ArcadeProgress; newlyUnlocked: ArcadeTrophy[] } {
  const progress = getArcadeProgress();
  const currentBest = progress.highScores[gameId] || 0;
  const isNewBest = score > currentBest;

  // One home for a high score: no per-game mirror key is written (#2548).
  if (isNewBest) {
    progress.highScores[gameId] = score;
    // The record belongs to the best; a best without one drops the old one.
    const bestTags = { ...progress.bestTags };
    if (tags) bestTags[gameId] = tags;
    else delete bestTags[gameId];
    progress.bestTags = bestTags;
    if (Object.keys(bestTags).length === 0) delete progress.bestTags;
  }

  // Check trophy unlock conditions
  const newlyUnlocked = evaluateTrophies(progress);

  // Save progress
  saveArcadeProgress(progress);

  // Emit App Event for score update
  emitAppEvent("arcade_score_updated", { gameId, score, metadata });

  // Emit App Events for unlocked trophies
  for (const trophy of newlyUnlocked) {
    emitAppEvent("arcade_trophy_unlocked", {
      trophyId: trophy.id,
      gameId: trophy.gameId,
      title: trophy.title,
      unlockedAt: progress.unlockedTrophies[trophy.id] || Date.now(),
    });
  }

  return { progress, newlyUnlocked };
}

/**
 * Records a finished run: keeps the best score, checks trophies and tells
 * the hub, as {@link recordArcadeScore} does, with the run's view, mode and
 * duration passed on in the event's metadata.
 *
 * @param gameId - The game's registry slug.
 * @param run - The finished run.
 * @returns The progress after the run and the trophies it unlocked.
 */
export function recordRun(
  gameId: string,
  run: ArcadeRun
): { progress: ArcadeProgress; newlyUnlocked: ArcadeTrophy[] } {
  const metadata: Record<string, unknown> = { view: run.view };
  if (run.mode !== undefined) metadata.mode = run.mode;
  if (run.durationMs !== undefined) metadata.durationMs = run.durationMs;
  return recordArcadeScore(gameId, run.score, metadata);
}
