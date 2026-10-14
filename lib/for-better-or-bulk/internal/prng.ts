/**
 * Seeded pseudo-random numbers for For Better or Bulk (ADR 0060). The
 * generator is pure: a seed always yields the same sequence, so a seeded level
 * schedules the same events and replays to the same state. Nothing here reads
 * an unseeded source; the only clock read is the caller's date in `dailySeed`.
 */

import { ARCADE_DAILY_MAX_SEED, arcadeDailyNumber } from "@/lib/arcade/daily";

/** The largest seed a setup may carry: a positive 31-bit integer. */
export const MAX_SEED = ARCADE_DAILY_MAX_SEED;

/** Digits a seed may have in a link before it is ignored. */
const MAX_SEED_DIGITS = 10;

export interface Prng {
  /** The next number, from 0 up to but not including 1. */
  readonly next: () => number;
  /** The next integer from `min` to `max`, both included. */
  readonly int: (min: number, max: number) => number;
}

/** A mulberry32 generator started from `seed`, truncated to 32 bits. */
export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

/**
 * The seed for one calendar day, by UTC date, so everyone who plays on the
 * same day gets the same events. It is always from 1 to MAX_SEED, so a daily
 * seed is never the standard day. Throws a RangeError for an invalid Date.
 *
 * This is the game's Arcade Daily seed (#2113). The shared derivation keeps
 * this game's original salt, so every day's seed is the one it always was.
 */
export function dailySeed(utcDate: Date): number {
  return arcadeDailyNumber(
    utcDate.toISOString().slice(0, 10),
    "for-better-or-bulk"
  );
}

/**
 * Reads a seed from a link's query text. Anything that is not a whole number
 * from 0 to MAX_SEED counts as junk and gives the standard day, seed 0.
 */
export function parseSeed(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const text = raw.trim();
  if (!/^\d+$/.test(text) || text.length > MAX_SEED_DIGITS) return 0;
  const value = Number(text);
  return value <= MAX_SEED ? value : 0;
}
