/**
 * The `arcade.daily` slice (#2548): the Arcade Daily bests and played days
 * in `arcade_daily_v1`, with the bytes `daily-store.ts` always wrote.
 */

import {
  ARCADE_DAILY_GAME_IDS,
  ARCADE_DAILY_STORAGE_KEY,
  emptyArcadeDailyProgress,
  parseArcadeDailyProgress,
  type ArcadeDailyGameId,
  type ArcadeDailyProgress,
  type ArcadeDailyResult,
} from "../daily";
import { defineSlice } from "./slice";

/** The better of two results for one game and day; ties broken by label. */
function betterResult(
  a: ArcadeDailyResult,
  b: ArcadeDailyResult
): ArcadeDailyResult {
  if (a.score !== b.score) return a.score > b.score ? a : b;
  return (a.label ?? "") >= (b.label ?? "") ? a : b;
}

/** Days apart of two `YYYY-MM-DD` dates. */
function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** The longest run of consecutive days in a sorted, unique date list. */
function longestRun(played: readonly string[]): number {
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const date of played) {
    const day = dayNumber(date);
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    previous = day;
    longest = Math.max(longest, run);
  }
  return longest;
}

/**
 * The `arcade.daily` join (design §5): per game and date the better result,
 * the union of played dates, and the longest streak as the larger of the
 * stored ones and the one recomputed from the union.
 *
 * @param a - One copy.
 * @param b - The other copy.
 * @returns The merged record.
 */
export function mergeArcadeDailyProgress(
  a: ArcadeDailyProgress,
  b: ArcadeDailyProgress
): ArcadeDailyProgress {
  const bests: Partial<
    Record<ArcadeDailyGameId, Record<string, ArcadeDailyResult>>
  > = {};
  for (const game of ARCADE_DAILY_GAME_IDS) {
    const days: Record<string, ArcadeDailyResult> = {
      ...(a.bests[game] ?? {}),
    };
    for (const [date, result] of Object.entries(b.bests[game] ?? {})) {
      const mine = days[date];
      days[date] = mine ? betterResult(mine, result) : result;
    }
    if (Object.keys(days).length > 0) bests[game] = days;
  }
  const played = [...new Set([...a.played, ...b.played])].sort();
  const longest = Math.max(a.longest, b.longest, longestRun(played));
  return { version: 1, bests, played, longest };
}

/** Arcade Daily bests and played days: `arcade_daily_v1`. */
export const arcadeDailySlice = defineSlice<ArcadeDailyProgress>({
  id: "arcade.daily",
  key: ARCADE_DAILY_STORAGE_KEY,
  class: "profile",
  version: 1,
  schema: {
    // Damaged fields are dropped field by field; only a value that is not
    // a record at all is corrupt.
    safeParse: (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? { success: true, data: parseArcadeDailyProgress(value) }
        : { success: false },
  },
  merge: mergeArcadeDailyProgress,
  empty: emptyArcadeDailyProgress,
  // Readers see only what localStorage holds, as before (#2113).
  retainInMemory: false,
});
