/**
 * The Arcade Daily record in this browser's storage (#2113): each game
 * reports a finished daily run here, and the hub reads the bests and the
 * streak back. Storage is guarded, so a blocked or private browser plays the
 * same and simply keeps nothing.
 */

import { safeIsAvailable, safeRawStorage } from "../safe-storage";
import { emitAppEvent } from "../event-bus";
import {
  ARCADE_DAILY_STORAGE_KEY,
  arcadeDailyDate,
  emptyArcadeDailyProgress,
  parseArcadeDailyProgress,
  withArcadeDailyResult,
  type ArcadeDailyGameId,
  type ArcadeDailyProgress,
  type ArcadeDailyResult,
} from "./daily";

/** This browser's Arcade Daily record; empty when storage is blocked. */
export function getArcadeDailyProgress(): ArcadeDailyProgress {
  try {
    if (!safeIsAvailable()) return emptyArcadeDailyProgress();
    const raw = safeRawStorage.getItem(ARCADE_DAILY_STORAGE_KEY);
    return raw
      ? parseArcadeDailyProgress(JSON.parse(raw))
      : emptyArcadeDailyProgress();
  } catch {
    return emptyArcadeDailyProgress();
  }
}

/**
 * Records a finished daily run for a game and tells the hub. Returns false
 * when the run does not count (an old date) or storage is blocked; the game
 * plays the same either way.
 */
export function recordArcadeDailyResult(
  game: ArcadeDailyGameId,
  date: string,
  result: ArcadeDailyResult,
  now: number = Date.now()
): boolean {
  try {
    const current = getArcadeDailyProgress();
    const next = withArcadeDailyResult(
      current,
      game,
      date,
      result,
      arcadeDailyDate(now)
    );
    if (next === current || !safeIsAvailable()) return false;
    safeRawStorage.setItem(ARCADE_DAILY_STORAGE_KEY, JSON.stringify(next));
    emitAppEvent("arcade_daily_updated", { gameId: game, date });
    return true;
  } catch {
    return false;
  }
}

/**
 * The stored record's raw text, or "" when there is none. A string is a
 * stable snapshot for `useSyncExternalStore`; parse it with
 * `parseArcadeDailyProgress`.
 */
export function getArcadeDailySnapshot(): string {
  try {
    if (!safeIsAvailable()) return "";
    return safeRawStorage.getItem(ARCADE_DAILY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
