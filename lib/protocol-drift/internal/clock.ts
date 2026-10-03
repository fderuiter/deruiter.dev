/**
 * The deterministic simulation clock. Time is an integer minute counted from
 * Trial Day 0, 08:00 (2025-11-01T08:00:00Z). Speeds scale how many simulated
 * minutes pass per real millisecond; they never change which minutes exist.
 */
import type { SimSpeed } from "../types";

/** Minutes between midnight of Day 0 and the clock's origin at 08:00. */
export const CLOCK_ORIGIN_OFFSET_MINUTES = 480;
/** Epoch milliseconds of 2025-11-01T00:00:00Z, the start of Trial Day 0. */
export const TRIAL_DAY0_EPOCH_MS = Date.UTC(2025, 10, 1, 0, 0, 0);
/** One step of the N key: exactly one simulated hour. */
export const STEP_MINUTES = 60;
/** Simulated minutes per real second at 1x. */
export const SIM_MINUTES_PER_REAL_SECOND = 60;
/** Minutes in a day. */
export const MINUTES_PER_DAY = 1440;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** The trial day a clock minute falls on. */
export function trialDayOf(minute: number): number {
  return Math.floor((minute + CLOCK_ORIGIN_OFFSET_MINUTES) / MINUTES_PER_DAY);
}

/** The clock minute of a given trial day and time of day. */
export function minuteAt(day: number, hour = 0, min = 0): number {
  return day * MINUTES_PER_DAY + hour * 60 + min - CLOCK_ORIGIN_OFFSET_MINUTES;
}

/** Formats a clock minute as "Day N HH:MM". */
export function formatClock(minute: number): string {
  const abs = minute + CLOCK_ORIGIN_OFFSET_MINUTES;
  const day = Math.floor(abs / MINUTES_PER_DAY);
  const rem = abs - day * MINUTES_PER_DAY;
  return `Day ${day} ${pad2(Math.floor(rem / 60))}:${pad2(rem % 60)}`;
}

/** The ISO 8601 timestamp of a clock minute. */
export function minuteToIso(minute: number): string {
  const ms =
    TRIAL_DAY0_EPOCH_MS + (minute + CLOCK_ORIGIN_OFFSET_MINUTES) * 60_000;
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

/** The clock minute of an ISO 8601 timestamp (floored to the minute). */
export function isoToMinute(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO timestamp: ${iso}`);
  }
  return (
    Math.floor((ms - TRIAL_DAY0_EPOCH_MS) / 60_000) -
    CLOCK_ORIGIN_OFFSET_MINUTES
  );
}

/** The ISO calendar date (YYYY-MM-DD) of a trial day. */
export function trialDayDate(day: number): string {
  return new Date(TRIAL_DAY0_EPOCH_MS + day * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Converts real elapsed time into whole simulated minutes. The carry is kept
 * in thousandths of a minute so any split of the same real time yields the
 * same total minutes.
 */
export function accumulateRealTime(
  carry: number,
  realMs: number,
  speed: SimSpeed
): { minutes: number; carry: number } {
  if (!Number.isFinite(realMs) || realMs < 0) {
    throw new RangeError(`realMs must be a non-negative number, got ${realMs}`);
  }
  const total =
    carry + Math.floor(realMs) * speed * SIM_MINUTES_PER_REAL_SECOND;
  return { minutes: Math.floor(total / 1000), carry: total % 1000 };
}
