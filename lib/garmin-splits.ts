/**
 * Lap timing for Monkey C Mayhem: clock and pace formatting, the lap toasts,
 * and merging a run into the best total and best split per lap. Storage lives
 * in lib/garmin-bests-store.ts so the standalone engine bundle stays free of it. Times are game
 * milliseconds, the sum of simulation deltas, so they do not depend on the
 * wall clock.
 */

/**
 * A lap faster than this (game ms) is world-record pace for the game's scale.
 * A clean sprint lap takes about 44 s, so only the best laps get under it.
 */
export const WORLD_RECORD_SPLIT_MS = 43_000;
/** Laps in a full run. */
export const LAPS_PER_RUN = 5;

const HOUR_MS = 3_600_000;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Below this distance in metres pace is too noisy to show. */
export const MIN_PACE_METERS = 50;

/**
 * "m:ss.cc", e.g. 64380 becomes "1:04.38". Hours are shown as "h:mm:ss.cc" at
 * 3,600,000 ms and over. Negative or non-finite values become "0:00.00".
 * Hundredths are truncated, never rounded up.
 */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00.00";
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  if (ms >= HOUR_MS) {
    const hours = Math.floor(totalMin / 60);
    return `${hours}:${pad2(totalMin % 60)}:${pad2(sec)}.${pad2(cs)}`;
  }
  return `${totalMin}:${pad2(sec)}.${pad2(cs)}`;
}

/**
 * Seconds per kilometre from elapsed game ms and metres, or null when the
 * metres are zero or negative or either input is non-finite.
 */
export function paceSecondsPerKm(ms: number, meters: number): number | null {
  if (
    !Number.isFinite(ms) ||
    !Number.isFinite(meters) ||
    meters < MIN_PACE_METERS
  ) {
    return null;
  }
  return ms / meters;
}

/**
 * "m:ss/km" from seconds per kilometre, flooring the seconds. Null, negative
 * or non-finite input becomes "--:--/km".
 */
export function formatPace(secondsPerKm: number | null): string {
  if (
    secondsPerKm === null ||
    !Number.isFinite(secondsPerKm) ||
    secondsPerKm < 0
  ) {
    return "--:--/km";
  }
  const total = Math.floor(secondsPerKm);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}/km`;
}

/**
 * Signed difference from a best: "-0:01.20" when faster, "+0:00.45" when
 * slower, and "" when there is no finite best or the time is not finite.
 */
export function formatDelta(ms: number, best: number | undefined): string {
  if (best === undefined || !Number.isFinite(best) || !Number.isFinite(ms)) {
    return "";
  }
  const diff = ms - best;
  // Under a hundredth either way reads as level.
  return diff <= -10 ? `-${formatClock(-diff)}` : `+${formatClock(diff)}`;
}

/** True when there is no best yet, or ms is strictly less than best. */
export function beatsBest(ms: number, best: number | undefined): boolean {
  return best === undefined || !Number.isFinite(best) || ms < best;
}

/** True when there are at least two splits and every split is strictly faster than the one before. */
export function isNegativeSplit(splits: readonly number[]): boolean {
  if (splits.length < 2) return false;
  return splits.every((split, i) => i === 0 || split < splits[i - 1]);
}

/**
 * The toast for the lap just recorded (the last element of splits):
 * "WORLD RECORD PACE" when it is under WORLD_RECORD_SPLIT_MS. Otherwise, with
 * a previous lap, "NEGATIVE SPLIT" when it is faster than that lap, or
 * "POSITIVE SPLIT · EASE UP" when it is more than 5% slower. Anything else,
 * including an empty list, gives null.
 */
export function splitToast(splits: readonly number[]): string | null {
  const count = splits.length;
  if (count === 0) return null;
  const last = splits[count - 1];
  if (last < WORLD_RECORD_SPLIT_MS) return "WORLD RECORD PACE";
  if (count < 2) return null;
  const previous = splits[count - 2];
  if (last < previous) return "NEGATIVE SPLIT";
  if (last > previous * 1.05) return "POSITIVE SPLIT · EASE UP";
  return null;
}

/** Best total time and best split per lap for one device tier. */
export interface GarminBests {
  totalMs?: number;
  splits: number[];
}

/** Bests before any run has been recorded. */
export const EMPTY_BESTS: GarminBests = { splits: [] };

function isValidMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** The leading run of valid splits, stopping at the first invalid entry and capped at LAPS_PER_RUN. */
function validSplitPrefix(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const prefix: number[] = [];
  for (const entry of value.slice(0, LAPS_PER_RUN)) {
    if (!isValidMs(entry)) break;
    prefix.push(entry);
  }
  return prefix;
}

/** Coerces untrusted stored data into a GarminBests, dropping anything malformed. */
export function normalizeBests(value: unknown): GarminBests {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { splits: [] };
  }
  const record = value as Record<string, unknown>;
  const splits = validSplitPrefix(record.splits);
  const totalMs = record.totalMs;
  return isValidMs(totalMs) ? { totalMs, splits } : { splits };
}

/**
 * Merges a run into the bests and returns a new object. Each lap's split
 * replaces that lap's best when faster, or fills the lap when it has no best
 * yet, in order, so a lap can only be filled after the laps before it. The
 * total replaces the best total only when the run is finished and the total
 * is faster or there is none. Non-finite or non-positive inputs are ignored.
 */
export function mergeBests(
  bests: GarminBests,
  splits: readonly number[],
  totalMs: number,
  finished: boolean
): GarminBests {
  const merged = bests.splits.slice(0, LAPS_PER_RUN);
  splits.slice(0, LAPS_PER_RUN).forEach((split, lap) => {
    if (!isValidMs(split)) return;
    if (lap < merged.length) {
      if (split < merged[lap]) merged[lap] = split;
    } else if (lap === merged.length) {
      merged.push(split);
    }
  });

  const currentTotal = bests.totalMs;
  const takesTotal =
    finished &&
    isValidMs(totalMs) &&
    (currentTotal === undefined || totalMs < currentTotal);
  const total = takesTotal ? totalMs : currentTotal;
  return total === undefined
    ? { splits: merged }
    : { totalMs: total, splits: merged };
}
