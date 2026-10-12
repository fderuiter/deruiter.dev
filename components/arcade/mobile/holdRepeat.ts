/**
 * Timers a hold-repeat controller needs. Injected so the controller can be
 * driven by fake timers in tests and by the browser in the game.
 */
export interface HoldRepeatTimers {
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface HoldRepeatOptions extends Partial<HoldRepeatTimers> {
  /** Time before the first repeat after the press. Default 220ms. */
  delayMs?: number;
  /** Time between repeats while held. Default 140ms, close to a keyboard's auto-repeat. */
  intervalMs?: number;
}

/** A press-and-hold repeater. Each `start` fires one tick at once. */
export interface HoldRepeater {
  /** Starts a hold: ticks now, then again after the delay and at each interval. */
  start(): void;
  /** Ends the hold. Safe to call when nothing is held. */
  stop(): void;
  /** Whether a hold is in progress. */
  readonly active: boolean;
}

export const HOLD_REPEAT_DELAY_MS = 220;
export const HOLD_REPEAT_INTERVAL_MS = 140;

/**
 * Builds a hold-repeat controller. A quick tap, released before the delay,
 * produces exactly one tick: the immediate one from `start`. A longer hold
 * keeps ticking at the interval until `stop`, so one press never double-moves.
 *
 * @param tick - Called once per step while held.
 * @param options - Delay, interval and optional timer injection.
 * @returns A controller that starts and stops one hold at a time.
 */
export function createHoldRepeater(
  tick: () => void,
  options: HoldRepeatOptions = {}
): HoldRepeater {
  const delayMs = options.delayMs ?? HOLD_REPEAT_DELAY_MS;
  const intervalMs = options.intervalMs ?? HOLD_REPEAT_INTERVAL_MS;
  const setTimer =
    options.setTimer ??
    ((callback: () => void, ms: number) => globalThis.setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) =>
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));

  let handle: unknown = null;
  let active = false;

  const schedule = (ms: number) => {
    handle = setTimer(() => {
      if (!active) return;
      tick();
      schedule(intervalMs);
    }, ms);
  };

  return {
    start() {
      if (active) return;
      active = true;
      tick();
      schedule(delayMs);
    },
    stop() {
      if (!active) return;
      active = false;
      if (handle !== null) clearTimer(handle);
      handle = null;
    },
    get active() {
      return active;
    },
  };
}
