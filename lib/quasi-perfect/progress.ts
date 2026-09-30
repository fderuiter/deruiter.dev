import type { GameProgressState, LevelScore, PuzzlerLevelDef } from "./types";

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
 * Parse stored campaign progress without throwing. Malformed JSON, a
 * non-object value or a non-object `completedLevels` all become empty
 * progress. `currentLevelIndex` is passed through as stored, so
 * `resolveResumeLevelIndex` can tell a missing index from a corrupt one.
 *
 * @param raw - The stored string, or null when nothing is stored.
 * @returns Progress that is safe to read and to spread into a new save.
 */
export function parseGameProgress(raw: string | null): GameProgressState {
  const empty: GameProgressState = {
    completedLevels: {},
    currentLevelIndex: 0,
  };
  if (!raw) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return empty;
  }
  const record = parsed as Record<string, unknown>;
  const completed = record.completedLevels;
  return {
    ...(record as Partial<GameProgressState>),
    completedLevels:
      completed && typeof completed === "object" && !Array.isArray(completed)
        ? (completed as GameProgressState["completedLevels"])
        : {},
    currentLevelIndex: record.currentLevelIndex as number,
  };
}

/**
 * Choose the level the campaign reopens on.
 *
 * A saved index of 1 or more that names a real level is used as is. An
 * index of 0, or no index at all, is what saves written before the index
 * was recorded contain, so the first unsolved level is chosen instead
 * (Level 1 when nothing or everything is solved). Any other value, such as
 * an out-of-range, fractional or non-numeric index, falls back to Level 1.
 *
 * @param progress - Parsed campaign progress.
 * @param levels - The campaign's levels, in order.
 * @returns A valid index into `levels`.
 */
export function resolveResumeLevelIndex(
  progress: Partial<GameProgressState> | null | undefined,
  levels: ReadonlyArray<Pick<PuzzlerLevelDef, "id">>
): number {
  if (levels.length === 0) return 0;
  const saved: unknown = progress?.currentLevelIndex;
  if (saved === undefined || saved === 0) {
    const completed = progress?.completedLevels ?? {};
    const firstUnsolved = levels.findIndex(
      (lvl) => !completed[lvl.id]?.completed
    );
    return firstUnsolved === -1 ? 0 : firstUnsolved;
  }
  if (
    typeof saved === "number" &&
    Number.isInteger(saved) &&
    saved > 0 &&
    saved < levels.length
  ) {
    return saved;
  }
  return 0;
}
