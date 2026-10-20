/**
 * The session's fixed-step clock (#2544, ADR 0062).
 *
 * A session advances its game in whole steps of a constant `dt`, never by the
 * frame's variable time, so outcomes do not depend on frame rate. A phone on
 * a throttled frame budget runs more steps per frame, not longer ones, and a
 * replay at a fixed step matches the recording.
 *
 * Spawn and drop chances are per step: roll {@link stepChance} once per
 * step with the session's `rng`, never `Math.random() < rate * frameDt`.
 *
 * @module
 */

/** The session step in seconds: 1/60. */
export const SESSION_STEP_SECONDS: number = 1 / 60;

/** The session step in milliseconds: 1000 / 60, about 16.67. */
export const SESSION_STEP_MS: number = 1000 / 60;

/** Options for {@link createStepClock}. */
export interface StepClockOptions {
  /** The constant step in seconds. Defaults to {@link SESSION_STEP_SECONDS}. */
  readonly dt?: number;
  /**
   * The most frame time one `advance` carries, in seconds, so a long stall
   * does not run hundreds of steps at once. Defaults to 0.25.
   */
  readonly maxFrameSeconds?: number;
  /** The step count to start from, such as a restored run's `step`. */
  readonly step?: number;
}

/**
 * A fixed-step clock. A loop passes each frame's elapsed time to `advance`
 * and runs the game that many steps, each with the constant `dt`.
 *
 * Methods do not rely on `this`.
 */
export interface StepClock {
  /** The constant step, in seconds. */
  readonly dt: number;
  /** Steps run so far in this run. A run snapshot carries it as `step`. */
  readonly getStep: () => number;
  /**
   * Moves the count to a restored run's `step`. Throws RangeError unless
   * `step` is a non-negative integer. Clears any carried partial step.
   */
  readonly setStep: (step: number) => void;
  /**
   * Adds a frame's elapsed time and returns how many whole steps to run now.
   * A negative or non-finite elapsed time counts as 0.
   */
  readonly advance: (elapsedSeconds: number) => number;
  /** Runs exactly one step, for tests, replays and a single-step debugger. */
  readonly tick: () => void;
  /** How far the clock is into the next step, in [0, 1), for interpolation. */
  readonly alpha: () => number;
  /** The run's simulated time in seconds: `getStep() * dt`. */
  readonly elapsedSeconds: () => number;
}

/**
 * Whether a value is a valid step count: a non-negative integer.
 *
 * @param value - The value to check.
 * @returns Whether {@link StepClock.setStep} accepts it.
 */
export function isStepCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * A fixed-step clock with an accumulator.
 *
 * @param options - The step, the stall bound and the starting step.
 * @returns The clock.
 */
export function createStepClock(options: StepClockOptions = {}): StepClock {
  const dt =
    typeof options.dt === "number" &&
    options.dt > 0 &&
    Number.isFinite(options.dt)
      ? options.dt
      : SESSION_STEP_SECONDS;
  const maxFrameSeconds =
    typeof options.maxFrameSeconds === "number" &&
    options.maxFrameSeconds > 0 &&
    Number.isFinite(options.maxFrameSeconds)
      ? options.maxFrameSeconds
      : 0.25;
  let step = isStepCount(options.step) ? options.step : 0;
  let accumulator = 0;

  const setStep = (next: number): void => {
    if (!isStepCount(next)) {
      throw new RangeError(`step must be a non-negative integer, got ${next}`);
    }
    step = next;
    accumulator = 0;
  };

  const advance = (elapsedSeconds: number): number => {
    const elapsed =
      Number.isFinite(elapsedSeconds) && elapsedSeconds > 0
        ? Math.min(elapsedSeconds, maxFrameSeconds)
        : 0;
    accumulator += elapsed;
    // A small tolerance so 1/60 s frames are not lost to float rounding.
    const steps = Math.floor(accumulator / dt + 1e-9);
    accumulator = Math.max(0, accumulator - steps * dt);
    step += steps;
    return steps;
  };

  return {
    dt,
    getStep: () => step,
    setStep,
    advance,
    tick: () => {
      step += 1;
    },
    alpha: () => Math.min(accumulator / dt, 1 - Number.EPSILON),
    elapsedSeconds: () => step * dt,
  };
}

/**
 * The chance of an event in one step, for an event that happens `ratePerSecond`
 * times a second on average: `ratePerSecond * dt`, clamped to [0, 1]. At the
 * default 1/60 s step this matches a `rate * dt` roll at 60 frames a second,
 * so moving a game to per-step rolls keeps its difficulty on a 60 Hz display.
 *
 * @param ratePerSecond - The average events per second.
 * @param dt - The step in seconds. Defaults to {@link SESSION_STEP_SECONDS}.
 * @returns The probability to pass to `rng.chance` once per step.
 */
export function stepChance(
  ratePerSecond: number,
  dt: number = SESSION_STEP_SECONDS
): number {
  const p = ratePerSecond * dt;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(1, p);
}
