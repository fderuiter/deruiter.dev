/**
 * The personal best times, remembered in this browser under
 * `fbb_best_times` (#2056). Storage goes through `lib/safe-storage`, which
 * handles server rendering and blocked storage; anything unreadable or
 * malformed reads as no best times, and a write that cannot be kept is
 * dropped, so a blocked browser plays on without a best.
 */

import {
  BEST_TIMES_STORAGE_KEY,
  parseBestTimes,
  recordBestTime,
  serializeBestTimes,
  type BestTimeRecord,
  type BestTimes,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { safeRawStorage } from "@/lib/safe-storage";

/** The stored best times, or none when storage is empty, blocked or malformed. */
export function readBestTimes(): BestTimes {
  try {
    return parseBestTimes(safeRawStorage.getItem(BEST_TIMES_STORAGE_KEY));
  } catch {
    return {};
  }
}

/**
 * Records a finished day's time and saves it when it is a new best. Returns
 * the comparison either way, so the receipt can show it.
 */
export function saveBestTime(setup: Setup, finishedAt: number): BestTimeRecord {
  const before = readBestTimes();
  const { times, record } = recordBestTime(before, setup, finishedAt);
  if (times !== before) {
    try {
      safeRawStorage.setItem(BEST_TIMES_STORAGE_KEY, serializeBestTimes(times));
    } catch {
      // The best is a convenience: this receipt still shows it.
    }
  }
  return record;
}
