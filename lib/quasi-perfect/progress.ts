import type { GameProgressState, LevelScore, PuzzlerLevelDef } from "./types";
import { normalizeClearedVariants } from "./variants";

/**
 * Whether a finished run earns the Golfed badge: an honest proof in no more
 * tactics than the level's par (#2059). A run on a level without a par
 * never earns it.
 *
 * @param steps - Tactics the run applied.
 * @param par - The level's step par, or null when it has none.
 * @param usedSorry - Whether the run admitted any goal with `sorry`.
 * @returns True when the run is golfed.
 */
export function isGolfedRun(
  steps: number,
  par: number | null,
  usedSorry: boolean
): boolean {
  return (
    !usedSorry &&
    par !== null &&
    Number.isFinite(steps) &&
    steps > 0 &&
    steps <= par
  );
}

/**
 * Whether a saved score carries the Golfed badge. Only an honest, completed
 * score can; a score saved before the badge existed reads as not golfed.
 *
 * @param score - The saved score, if any.
 * @returns True when the level shows the badge.
 */
export function isLevelGolfed(score: LevelScore | undefined | null): boolean {
  return (
    !!score && score.completed && !score.usedSorry && score.golfed === true
  );
}

function pickLevelScore(
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
 * Decide which score a level keeps after a run finishes.
 *
 * Ordering, strongest first: an honest proof always beats a `sorry`
 * admission; then more stars; then more remaining RAM; then the score
 * already saved (an equal replay never rewrites history). A `sorry` run
 * therefore never upgrades or erases an honest score.
 *
 * The Golfed badge is kept apart from that ordering: once either score
 * earned it honestly, the kept score carries it, so a later run with more
 * stars but more steps does not take the badge away.
 *
 * @param existing - The score currently saved for the level, if any.
 * @param incoming - The score of the run that just finished.
 * @returns The score the campaign should retain.
 */
export function mergeLevelScore(
  existing: LevelScore | undefined,
  incoming: LevelScore
): LevelScore {
  const kept = pickLevelScore(existing, incoming);
  const golfed =
    !kept.usedSorry &&
    kept.completed &&
    (isLevelGolfed(existing) || isLevelGolfed(incoming));
  if ((kept.golfed === true) === golfed) return kept;
  return { ...kept, golfed };
}

function normalizeCompletedLevels(
  completed: Record<string, unknown>
): GameProgressState["completedLevels"] {
  const out: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(completed)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      out[id] = entry;
      continue;
    }
    const score = entry as Record<string, unknown>;
    const badGolfed = "golfed" in score && typeof score.golfed !== "boolean";
    const badSteps =
      "steps" in score &&
      !(typeof score.steps === "number" && Number.isFinite(score.steps));
    if (!badGolfed && !badSteps) {
      out[id] = entry;
      continue;
    }
    const clean = { ...score };
    if (badGolfed) delete clean.golfed;
    if (badSteps) delete clean.steps;
    out[id] = clean;
  }
  return out as GameProgressState["completedLevels"];
}

/**
 * Parse stored campaign progress without throwing. Malformed JSON, a
 * non-object value or a non-object `completedLevels` all become empty
 * progress. A level's `golfed` or `steps` field of the wrong type is
 * dropped, so a save written before the Golfed badge (#2059) loads as it
 * did and simply has no badges. `clearedVariants` is cleaned the same way:
 * a save from before variants (#2090) reads as none cleared. `currentLevelIndex` is passed through as stored, so
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
        ? normalizeCompletedLevels(completed as Record<string, unknown>)
        : {},
    currentLevelIndex: record.currentLevelIndex as number,
    clearedVariants: normalizeClearedVariants(record.clearedVariants),
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

/** The first chapter of Act 2 (#2091). Chapters 1 to 3 are Act 1. */
export const ACT_TWO_FIRST_CHAPTER = 4;

/** The Act 1 capstone, whose honest proof opens Act 2. */
export const ACT_ONE_CAPSTONE_LEVEL_ID = 18;

/**
 * Whether Act 2 is open: the Act 1 capstone has been proved without
 * `sorry`, or the save already records chapter 4 as unlocked. A save from
 * before Act 2 existed needs no migration; its capstone score decides.
 *
 * @param progress - Parsed campaign progress.
 * @returns True once Act 2 can be played.
 */
export function isActTwoUnlocked(
  progress:
    | Pick<GameProgressState, "completedLevels" | "unlockedChapter">
    | null
    | undefined
): boolean {
  const chapter = progress?.unlockedChapter;
  if (
    typeof chapter === "number" &&
    Number.isFinite(chapter) &&
    chapter >= ACT_TWO_FIRST_CHAPTER
  ) {
    return true;
  }
  const capstone = progress?.completedLevels?.[ACT_ONE_CAPSTONE_LEVEL_ID];
  return !!capstone && capstone.completed === true && !capstone.usedSorry;
}

/**
 * Whether a level is still locked. Only Act 2 levels lock; every Act 1 level
 * is open from the start, as it always was.
 *
 * @param progress - Parsed campaign progress.
 * @param level - The level, or anything carrying its chapter.
 * @returns True when the level cannot be played yet.
 */
export function isLevelLocked(
  progress:
    | Pick<GameProgressState, "completedLevels" | "unlockedChapter">
    | null
    | undefined,
  level: Pick<PuzzlerLevelDef, "chapter">
): boolean {
  return level.chapter >= ACT_TWO_FIRST_CHAPTER && !isActTwoUnlocked(progress);
}

/**
 * Record that Act 2 is open once the capstone is proved honestly. Progress
 * that already records it, or does not qualify, comes back unchanged.
 *
 * @param progress - Campaign progress after a run was saved.
 * @returns Progress with `unlockedChapter` raised to Act 2 when earned.
 */
export function withUnlockedChapter(
  progress: GameProgressState
): GameProgressState {
  if (!isActTwoUnlocked(progress)) return progress;
  const chapter = progress.unlockedChapter;
  if (typeof chapter === "number" && chapter >= ACT_TWO_FIRST_CHAPTER) {
    return progress;
  }
  return { ...progress, unlockedChapter: ACT_TWO_FIRST_CHAPTER };
}

/**
 * How many levels the save records as proved honestly: completed with at
 * least one star and no `sorry`. A level admitted with `sorry` is not a
 * proof, so it never counts (#1939, #2198).
 *
 * @param progress - Parsed campaign progress.
 * @returns The number of honestly proved levels.
 */
export function countHonestProofs(
  progress: Pick<GameProgressState, "completedLevels"> | null | undefined
): number {
  return Object.values(progress?.completedLevels ?? {}).filter(
    (score) => !!score && !score.usedSorry && score.stars > 0
  ).length;
}
