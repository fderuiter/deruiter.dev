/**
 * Par times and personal best times for For Better or Bulk (#2056). The board
 * score stays the placement count, which tops out quickly; a finish time
 * gives a player who already has every star a reason to plan a faster route.
 *
 * Everything here is a pure function over plain data. The page owns the
 * storage; it hands this module the raw stored string and saves the string
 * this module gives back. A best time is a game record about play speed. It
 * is shown apart from the receipt and never grades the wedding (ADR 0060).
 */

import { clamp } from "@/lib/game-utils";
import {
  DEFAULT_SETUP,
  LEVEL_SECONDS,
  RELAXED_LEVEL_SECONDS,
} from "../presets";
import type { BestTimeRecord, BestTimes, Setup } from "../types";

/** The browser storage key that holds every best time, as one JSON object. */
export const BEST_TIMES_STORAGE_KEY = "fbb_best_times";

/**
 * Par for the default plan on the standard day, in level seconds, by timer.
 *
 * Calibrated against the scripted solo player in the assist tests (the solo
 * helper's goal policy at full pace, pressing interact once per press, Abbi
 * idle, no helper, staying when the brothers call). On the default plan with
 * seed 0 it finishes at 110.9 s on the standard clock and 110.3 s on the
 * relaxed clock: the work takes the same real seconds, the relaxed clock just
 * has more of them. That player never hesitates, so its time is close to the
 * best a person can do alone.
 *
 * The standard par is that time rounded up to the next 10 s: 120 s, which
 * reads 1:12 on the clock and leaves about 9 s of slack for a person's
 * reaction time. The relaxed clock is for players who asked for more time, so
 * its par is half again the scripted time, rounded up to the next 10 s: 170 s,
 * which reads 12:36 on the longer clock.
 *
 * A pair in co-op, or a solo player with the helper, can beat either par
 * comfortably. The par is set for one person playing alone.
 */
export const PAR_SECONDS: Readonly<Record<"standard" | "relaxed", number>> = {
  standard: 120,
  relaxed: 170,
};

/** Clock minutes in a level: 9:00 to 4:00. */
const LEVEL_MINUTES = 7 * 60;

/** Level minutes from 9:00, floored the same way `clockLabel` floors them. */
function clockMinutes(time: number, duration: number): number {
  const clamped = clamp(time, 0, duration);
  return Math.floor((clamped / duration) * LEVEL_MINUTES + 1e-9);
}

/** Whether two plans buy the same things and build the same features. */
function samePlan(a: Setup, b: Setup): boolean {
  return (
    a.cart.roses === b.cart.roses &&
    a.cart.food === b.cart.food &&
    a.cart.lanterns === b.cart.lanterns &&
    planFeatures(a) === planFeatures(b)
  );
}

/** The chosen features in a stable order, so the same pair always keys alike. */
function planFeatures(setup: Setup): string {
  return [...setup.capabilities].sort().join("+");
}

/**
 * The par for a setup, in level seconds, or null when it has none. Only the
 * default plan on the standard day (seed 0) has a par, because that is the
 * day it was calibrated on: another cart changes the amount of work, and a
 * seeded shower or rush changes when it can be done.
 */
export function parFor(setup: Setup): number | null {
  if ((setup.seed ?? 0) !== 0) return null;
  if (!samePlan(setup, DEFAULT_SETUP)) return null;
  return setup.relaxed ? PAR_SECONDS.relaxed : PAR_SECONDS.standard;
}

/**
 * The key a setup's best time is kept under. Each timer has its own best,
 * each seeded day has its own best, and each plan has its own, so a lighter
 * cart never sets a time a heavier one is measured against. The helper and
 * the controls are not part of the key: helper days do not set a best.
 */
export function bestTimeKey(setup: Setup): string {
  const timer = setup.relaxed ? "relaxed" : "standard";
  const seed = setup.seed ?? 0;
  const { roses, food, lanterns } = setup.cart;
  const plan = `${roses}.${food}.${lanterns ? "lanterns" : "no-lanterns"}.${planFeatures(setup)}`;
  return `${timer}:seed-${seed}:${plan}`;
}

/** The longest level a stored time can belong to; anything past it is junk. */
const MAX_TIME = Math.max(LEVEL_SECONDS, RELAXED_LEVEL_SECONDS);

/**
 * Reads the stored best times. Anything that is not a JSON object of finite,
 * in-range times is dropped: a malformed string gives no best times at all,
 * and a malformed entry is skipped while the others are kept.
 */
export function parseBestTimes(raw: string | null): BestTimes {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const times: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= MAX_TIME
    ) {
      times[key] = value;
    }
  }
  return times;
}

/** The string to store for a set of best times. */
export function serializeBestTimes(times: BestTimes): string {
  return JSON.stringify(times);
}

/** The best time for a setup, in level seconds, or null when there is none yet. */
export function bestTimeFor(times: BestTimes, setup: Setup): number | null {
  return times[bestTimeKey(setup)] ?? null;
}

/** Whether a finish time beats the previous best. A tie is not a new best. */
export function isNewBestTime(previous: number | null, time: number): boolean {
  return previous === null || time < previous;
}

/**
 * Records a finished day's time against the stored bests. The returned times
 * hold the new best when the day beat the old one, and are the same object
 * otherwise, so a caller can skip the write.
 */
export function recordBestTime(
  times: BestTimes,
  setup: Setup,
  finishedAt: number
): { readonly times: BestTimes; readonly record: BestTimeRecord } {
  const previous = bestTimeFor(times, setup);
  const isNew = isNewBestTime(previous, finishedAt);
  const best = isNew ? finishedAt : (previous ?? finishedAt);
  return {
    times: isNew ? { ...times, [bestTimeKey(setup)]: finishedAt } : times,
    record: { time: finishedAt, previous, best, isNew },
  };
}

/**
 * How far a finish was from par, in clock minutes: positive when it was
 * under par, negative when over, zero when on par. Both times are read the
 * way the clock shows them, so the gap always matches the two labels.
 */
export function minutesUnderPar(
  time: number,
  par: number,
  duration: number
): number {
  return clockMinutes(par, duration) - clockMinutes(time, duration);
}
