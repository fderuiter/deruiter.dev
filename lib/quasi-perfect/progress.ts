import type { LevelScore } from "./types";

/**
 * Decide which score a level keeps after a run finishes.
 *
 * Ordering, strongest first: an honest proof always beats a `sorry`
 * admission; then more stars; then more remaining RAM; then the score
 * already saved (an equal replay never rewrites history). A `sorry` run
 * therefore never upgrades or erases an honest score.
 *
 * @param existing - The score currently saved for the level, if any.
 * @param incoming - The score of the run that just finished.
 * @returns The score the campaign should retain.
 */
export function mergeLevelScore(
  existing: LevelScore | undefined,
  incoming: LevelScore
): LevelScore {
  if (!existing || !existing.completed) return incoming;
  if (!incoming.completed) return existing;
  if (existing.usedSorry !== incoming.usedSorry) {
    return incoming.usedSorry ? existing : incoming;
  }
  if (incoming.stars !== existing.stars) {
    return incoming.stars > existing.stars ? incoming : existing;
  }
  if (incoming.remainingRam > existing.remainingRam) return incoming;
  return existing;
}

/**
 * Choose the level index the puzzler opens on from saved progress.
 *
 * A saved integer index inside the campaign is restored. A missing index
 * opens the first level that is not yet completed (Level 1 when none is
 * done, or when every level is). A corrupt or out-of-range index, or
 * progress that is not an object, opens Level 1. It never throws.
 *
 * @param progress - The parsed saved progress, of unknown shape.
 * @param levels - The campaign levels in order; only `id` is read.
 * @returns A valid index into `levels`.
 */
export function resolveSavedLevelIndex(
  progress: unknown,
  levels: ReadonlyArray<{ id: string | number }>
): number {
  if (!progress || typeof progress !== "object") return 0;
  const { currentLevelIndex, completedLevels } = progress as {
    currentLevelIndex?: unknown;
    completedLevels?: unknown;
  };
  if (currentLevelIndex !== undefined) {
    return typeof currentLevelIndex === "number" &&
      Number.isInteger(currentLevelIndex) &&
      currentLevelIndex >= 0 &&
      currentLevelIndex < levels.length
      ? currentLevelIndex
      : 0;
  }
  if (!completedLevels || typeof completedLevels !== "object") return 0;
  const done = completedLevels as Record<string, { completed?: unknown }>;
  const firstOpen = levels.findIndex(
    (l) => done[String(l.id)]?.completed !== true
  );
  return firstOpen === -1 ? 0 : firstOpen;
}
