/**
 * The session's seeded random stream (#2544, ADR 0062).
 *
 * A session owns its game's randomness and time, so a seed and an action
 * stream always give the same run, a saved run resumes the same stream, and
 * a replay fixture recorded on `main` still matches after a seam change.
 *
 * Two streams per session:
 *
 * - `session.rng`, made with {@link createRng}, for every draw that changes
 *   game state or score: spawns, drops, rolls, enemy choices.
 * - Cosmetic randomness in views (particles, shake, pulse phases), where
 *   `Math.random` is fine, because views only paint.
 *
 * A session never calls `Math.random` or `Date.now` for game state. DX Doctor
 * flags both calls in files named `use*Session*` and in the engine modules a
 * session owns (`checkSessionDeterminism` in `lib/dx/doctor.ts`).
 *
 * The rule for each game's seam issue: thread an `rng` parameter through the
 * engine first, with `Math.random` as its default so production is
 * unchanged, then extract the seam.
 *
 * ## Recording replay fixtures before a seam
 *
 * A game that still draws from `Math.random` is recorded against today's code
 * on `main`, before its seam is extracted. This is the method the session
 * replay helper (#2365) uses:
 *
 * - Stub `Math.random` with a seeded stream, such as
 *   `vi.spyOn(Math, "random").mockImplementation(createRng(seed).next)`, so
 *   the recording is repeatable without touching the engine.
 * - Fake `requestAnimationFrame` and the clock at a fixed 16.67 ms per
 *   frame (`SESSION_STEP_MS`, one fixed step), so frame-rate-dependent rolls
 *   see the same `dt` on every run.
 * - Feed the action stream, then compare game state only. Leave out cosmetic
 *   fields (particles, shake, pulse phases, flashes), so that moving
 *   cosmetics into a view, which takes their draws off the gameplay stream,
 *   does not break the fixture while gameplay is unchanged.
 *
 * The algorithm is Mulberry32, the same stream as `createSeededRandom` in
 * `lib/arcade/utils.ts` and the Garmin race stream (`courseRandom` in
 * `lib/garmin/course.ts`). Its state is one 32-bit number, so it serialises
 * into the run snapshot as `rngState`.
 *
 * @module
 */

import { fnv1a, mulberry32 } from "../utils/prng";

/** Mulberry32's additive constant: the state moves by this on every draw. */
const MULBERRY32_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 0x100000000;

/** A seed: a number, or a string such as an Arcade Daily key, hashed with FNV-1a. */
export type RngSeed = number | string;

/**
 * A seedable random stream whose whole state is one plain number, so a run
 * snapshot can carry it and a restored run draws the same numbers.
 *
 * Methods do not rely on `this`, so `rng.next` can be passed detached, for
 * example as a `random` parameter or a `Math.random` stub.
 */
export interface SessionRng {
  /** The next value in [0, 1). */
  readonly next: () => number;
  /**
   * An integer in [0, maxExclusive). Throws RangeError unless
   * `maxExclusive` is a positive integer.
   */
  readonly int: (maxExclusive: number) => number;
  /** A number in [min, max). Returns `min` when the two are equal. */
  readonly range: (min: number, max: number) => number;
  /**
   * True with probability `probability`: never at 0 or below (or NaN),
   * always at 1 or above. Always takes exactly one draw, so a branch on the
   * result does not shift the stream.
   */
  readonly chance: (probability: number) => boolean;
  /** One item of a non-empty list. Throws RangeError on an empty list. */
  readonly pick: <T>(items: readonly T[]) => T;
  /** The stream's state, an unsigned 32-bit integer. */
  readonly getState: () => number;
  /**
   * Moves the stream to a state from {@link SessionRng.getState}. Throws
   * RangeError unless `state` is an integer in [0, 2^32).
   */
  readonly setState: (state: number) => void;
}

/**
 * Whether a value is a valid stream state: an integer in [0, 2^32).
 *
 * @param value - The value to check.
 * @returns Whether {@link SessionRng.setState} accepts it.
 */
export function isRngState(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < UINT32_RANGE
  );
}

/**
 * The stream's starting state for a seed. A number is floored and wrapped to
 * 32 bits (a non-finite number counts as 0); a string is hashed.
 *
 * @param seed - The seed.
 * @returns The starting state.
 */
export function rngStateFromSeed(seed: RngSeed): number {
  if (typeof seed === "string") return fnv1a(seed);
  return Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0;
}

/**
 * A seeded Mulberry32 stream. The same seed always gives the same draws, and
 * `setState(getState())` on another stream continues the same sequence.
 *
 * @param seed - The run's seed.
 * @returns The stream.
 */
export function createRng(seed: RngSeed): SessionRng {
  let state = rngStateFromSeed(seed);

  const next = (): number => {
    const value = mulberry32(state);
    state = (state + MULBERRY32_INCREMENT) >>> 0;
    return value / UINT32_RANGE;
  };

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(
        `int needs a positive integer bound, got ${maxExclusive}`
      );
    }
    return Math.floor(next() * maxExclusive);
  };

  const range = (min: number, max: number): number => {
    const value = next();
    return min + value * (max - min);
  };

  // A draw in [0, 1) is below any probability of 1 or more and below none of
  // 0 or less (or NaN), so no clamp is needed.
  const chance = (probability: number): boolean => next() < probability;

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError("pick needs a non-empty list");
    }
    return items[int(items.length)];
  };

  const getState = (): number => state;

  const setState = (nextState: number): void => {
    if (!isRngState(nextState)) {
      throw new RangeError(
        `rng state must be an integer in [0, 2^32), got ${nextState}`
      );
    }
    state = nextState;
  };

  return { next, int, range, chance, pick, getState, setState };
}
