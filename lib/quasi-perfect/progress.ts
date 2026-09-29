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
