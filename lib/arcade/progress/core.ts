/**
 * The `arcade.core` slice (#2548): every game's best score and every
 * unlocked trophy, in `arcade_unified_progress_v1` with the bytes it has
 * always had. This is the one home of a high score; games no longer get a
 * per-game mirror key written for them.
 */

import { z } from "zod";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { ARCADE_PROGRESS_CATALOG } from "./catalog";
import { defineSlice } from "./slice";

/** Storage key of the `arcade.core` slice. */
export const ARCADE_UNIFIED_PROGRESS_KEY = "arcade_unified_progress_v1";

/** Persistent Arcade Progress Schema. */
export interface ArcadeProgress {
  /** Map of gameId -> best numeric score recorded */
  highScores: Record<string, number>;
  /** Map of trophyId -> timestamp unlocked */
  unlockedTrophies: Record<string, number>;
  /** Timestamp of last update */
  updatedAt: number;
  /**
   * When the per-game and legacy score keys were folded in, once. Unset
   * until then.
   */
  migratedAt?: number;
}

/**
 * Parses a raw storage value into a clean number.
 *
 * @param raw - A stored score: a bare number, a JSON envelope, a Quasi
 *   Puzzler save or a Meme Vault trophy list.
 * @returns The score, or 0 when there is none.
 */
export function parseScoreValue(
  raw: string | null | number | undefined
): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;

  try {
    const trimmed = raw.trim();
    // Handles raw numeric string e.g. "1250"
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    // Handles JSON envelope or complex progress object
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "number") return parsed;
    if (parsed && typeof parsed.value === "number") return parsed.value;
    if (parsed && typeof parsed.score === "number") return parsed.score;
    if (parsed && parsed.completedLevels) {
      // Quasi-puzzler format: only honest proofs score. A level closed with
      // `sorry` is saved with usedSorry and zero stars (#1939).
      const levels: unknown[] = Object.values(parsed.completedLevels);
      const proven = levels.filter((lvl) => {
        if (!lvl) return false;
        if (typeof lvl !== "object") return true;
        const score = lvl as { usedSorry?: unknown; stars?: unknown };
        return score.usedSorry !== true && score.stars !== 0;
      });
      return proven.length * 100;
    }
    if (Array.isArray(parsed)) {
      // Meme Vault unlocked array format
      return parsed.length * 100;
    }
  } catch {
    // Return 0 if non-parsable
  }

  return 0;
}

/** Finite numbers only; anything else in the map is dropped, not trusted. */
const numberMap = z.record(z.string(), z.unknown()).transform((record) => {
  const kept: Record<string, number> = {};
  for (const [id, value] of Object.entries(record)) {
    if (typeof value === "number" && Number.isFinite(value)) kept[id] = value;
  }
  return kept;
});

const arcadeProgressSchema = z.object({
  highScores: numberMap,
  unlockedTrophies: numberMap.catch({}),
  updatedAt: z.number().catch(0),
  migratedAt: z.number().optional().catch(undefined),
});

/** Keeps `migratedAt` out of a value that has none. */
function withoutUndefined(progress: ArcadeProgress): ArcadeProgress {
  if (progress.migratedAt !== undefined) return progress;
  return {
    highScores: progress.highScores,
    unlockedTrophies: progress.unlockedTrophies,
    updatedAt: progress.updatedAt,
  };
}

/**
 * The `arcade.core` join (design §5): the higher best per game, the union
 * of trophies keeping the earliest unlock, the later update. Commutative,
 * associative and idempotent, and it never lowers a best.
 *
 * @param a - One copy.
 * @param b - The other copy.
 * @returns The merged progress.
 */
export function mergeArcadeProgress(
  a: ArcadeProgress,
  b: ArcadeProgress
): ArcadeProgress {
  const highScores: Record<string, number> = { ...a.highScores };
  for (const [game, score] of Object.entries(b.highScores)) {
    highScores[game] = Math.max(highScores[game] ?? score, score);
  }
  const unlockedTrophies: Record<string, number> = { ...a.unlockedTrophies };
  for (const [id, at] of Object.entries(b.unlockedTrophies)) {
    unlockedTrophies[id] = Math.min(unlockedTrophies[id] ?? at, at);
  }
  const migrated = [a.migratedAt, b.migratedAt].filter(
    (at): at is number => at !== undefined
  );
  return withoutUndefined({
    highScores,
    unlockedTrophies,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    migratedAt: migrated.length > 0 ? Math.max(...migrated) : undefined,
  });
}

/**
 * Folds the per-game mirror keys and their legacy names into the slice
 * once, with `max`, and marks it done with `migratedAt`. The keys are left
 * in place for a release, so a rollback loses nothing. A legacy name's
 * score is also copied to the game's current key when that key is a bare
 * best the game itself reads, as the old migration did.
 */
function foldLegacyScores(
  progress: ArcadeProgress,
  stored: boolean
): ArcadeProgress | null {
  if (progress.migratedAt !== undefined) return null;
  const highScores: Record<string, number> = { ...progress.highScores };
  let folded = false;
  for (const game of ARCADE_PROGRESS_CATALOG) {
    if (!game.scoreKey) continue;
    let best = parseScoreValue(safeGetRawItem(game.scoreKey));
    for (const legacyKey of game.legacyScoreKeys ?? []) {
      const legacy = parseScoreValue(safeGetRawItem(legacyKey));
      if (legacy > best && !game.scoreKeyIsSave) {
        safeSetRawItem(game.scoreKey, String(legacy));
      }
      best = Math.max(best, legacy);
    }
    if (best > (highScores[game.slug] ?? 0)) {
      highScores[game.slug] = best;
      folded = true;
    }
  }
  // A visitor with nothing stored and nothing to fold keeps nothing.
  if (!stored && !folded) return null;
  const now = Date.now();
  return { ...progress, highScores, updatedAt: now, migratedAt: now };
}

/** Bests and trophies for every game: `arcade_unified_progress_v1`. */
export const arcadeCoreSlice = defineSlice<ArcadeProgress>({
  id: "arcade.core",
  key: ARCADE_UNIFIED_PROGRESS_KEY,
  class: "profile",
  // Today's value carries no version, so it is v0 and stays v0.
  version: 0,
  schema: {
    safeParse: (value) => {
      const result = arcadeProgressSchema.safeParse(value);
      return result.success
        ? { success: true, data: withoutUndefined(result.data) }
        : { success: false, error: result.error };
    },
  },
  merge: mergeArcadeProgress,
  empty: () => ({ highScores: {}, unlockedTrophies: {}, updatedAt: 0 }),
  // safe-storage's setItem wrote this key in its envelope.
  format: "envelope",
  upgrade: foldLegacyScores,
});
