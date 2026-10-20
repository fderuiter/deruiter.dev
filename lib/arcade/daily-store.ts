/**
 * The Arcade Daily record in this browser's storage (#2113): each game
 * reports a finished daily run here, and the hub reads the bests and the
 * streak back. The record is the `arcade.daily` progress slice (#2548), in
 * `arcade_daily_v1` with the bytes it always had. Storage is guarded, so a
 * blocked or private browser plays the same and simply keeps nothing.
 */

import { safeIsAvailable } from "../safe-storage";
import { emitAppEvent } from "../event-bus";
import {
  arcadeDailyDate,
  emptyArcadeDailyProgress,
  withArcadeDailyResult,
  type ArcadeDailyGameId,
  type ArcadeDailyProgress,
  type ArcadeDailyResult,
} from "./daily";
import { arcadeDailySlice, read, write } from "./progress";

/** This browser's Arcade Daily record; empty when storage is blocked. */
export function getArcadeDailyProgress(): ArcadeDailyProgress {
  try {
    if (!safeIsAvailable()) return emptyArcadeDailyProgress();
    return read(arcadeDailySlice);
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
    if (!write(arcadeDailySlice, next)) return false;
    emitAppEvent("arcade_daily_updated", { gameId: game, date });
    return true;
  } catch {
    return false;
  }
}
