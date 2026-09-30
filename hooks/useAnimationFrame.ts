"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Default ceiling on a single frame's delta, in milliseconds. */
export const DEFAULT_MAX_DELTA_MS = 100;

/**
 * Slack subtracted from the `fpsLimit` frame interval so that ordinary vsync
 * jitter (a 60 Hz frame landing at 16.4 ms instead of 16.67 ms) does not make
 * a limit equal to the display rate drop every other frame.
 */
const FPS_LIMIT_TOLERANCE_MS = 1;

/**
 * Per-frame callback for {@link useAnimationFrame}.
 *
 * @param deltaMs - Milliseconds since the previous invocation, clamped to
 *   `maxDeltaMs`. The first invocation after the loop starts receives 0.
 * @param elapsedMs - Sum of every clamped `deltaMs` since the loop last
 *   started. It is a simulation clock: a hidden tab adds at most `maxDeltaMs`
 *   to it, never the wall-clock gap.
 */
export type AnimationFrameCallback = (
  deltaMs: number,
  elapsedMs: number
) => void;

/** Options for {@link useAnimationFrame}. */
export interface UseAnimationFrameOptions {
  /**
   * Whether the loop runs. Defaults to true. Setting it to false cancels the
   * pending frame immediately; setting it back to true starts a fresh loop,
   * so the first frame again receives a delta of 0 and `elapsedMs` restarts.
   */
  isActive?: boolean;
  /**
   * Ceiling on a single frame's delta, in milliseconds. Defaults to 100.
   * Browsers pause or throttle animation frames in hidden tabs, so the first
   * frame after the tab returns would otherwise report the whole time away.
   * Pass `Infinity` to disable clamping. Zero, negative and NaN values fall
   * back to the default.
   */
  maxDeltaMs?: number;
  /**
   * Optional upper bound on invocations per second. Frames that arrive sooner
   * than the interval are skipped, and their time is carried into the next
   * delivered delta, so a limited loop still sees the full elapsed time.
   * Omit, or pass zero, a negative number or NaN, to run on every frame.
   */
  fpsLimit?: number;
  /**
   * Any value whose change restarts the loop. When it differs from the
   * previous render's value (compared with `Object.is`), the pending frame is
   * cancelled and a fresh loop starts, exactly as if `isActive` had toggled:
   * the first frame receives a delta of 0 and `elapsedMs` restarts. Use it
   * for inputs that should begin a new clock, such as a swapped simulation
   * engine. Callback closures do not need it; they are always read fresh.
   */
  restartKey?: unknown;
}

function resolveMaxDelta(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return DEFAULT_MAX_DELTA_MS;
  }
  return value;
}

function resolveMinInterval(fpsLimit: number | undefined): number {
  if (fpsLimit === undefined || Number.isNaN(fpsLimit) || fpsLimit <= 0) {
    return 0;
  }
  return Math.max(0, 1000 / fpsLimit - FPS_LIMIT_TOLERANCE_MS);
}

/**
 * Runs a callback on every animation frame while active, with delta-time
 * clamping and cancellation handled in one place.
 *
 * The loop is keyed only on `isActive` and `restartKey`. The callback and the
 * other options are read through refs, so passing a new closure on every
 * render never tears the loop down or resets its clock. The pending frame is cancelled synchronously
 * when the component unmounts or `isActive` becomes false, so a callback never
 * runs against an unmounted tree. On the server, and anywhere
 * `requestAnimationFrame` is unavailable, the hook does nothing.
 *
 * @example
 * ```ts
 * useAnimationFrame((deltaMs) => {
 *   engine.step(deltaMs / 1000);
 *   engine.render(ctx);
 * }, { isActive: !isPaused });
 * ```
 *
 * @param callback - Invoked once per delivered frame with the clamped delta
 *   and the accumulated simulation time, both in milliseconds.
 * @param options - Activity flag, delta ceiling, optional frame-rate cap and
 *   restart key.
 */
export function useAnimationFrame(
  callback: AnimationFrameCallback,
  options: UseAnimationFrameOptions = {}
): void {
  const { isActive = true, maxDeltaMs, fpsLimit, restartKey } = options;

  const callbackRef = useRef(callback);
  const maxDeltaRef = useRef(resolveMaxDelta(maxDeltaMs));
  const minIntervalRef = useRef(resolveMinInterval(fpsLimit));

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
    maxDeltaRef.current = resolveMaxDelta(maxDeltaMs);
    minIntervalRef.current = resolveMinInterval(fpsLimit);
  });

  useEffect(() => {
    if (
      !isActive ||
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }

    let frameId: number | null = null;
    let lastTimestamp: number | null = null;
    let elapsedMs = 0;
    let cancelled = false;

    const onFrame = (timestamp: number) => {
      if (cancelled) return;
      frameId = window.requestAnimationFrame(onFrame);

      let deltaMs = 0;
      if (lastTimestamp !== null) {
        const rawDelta = timestamp - lastTimestamp;
        // A timestamp can step backwards (a mocked or reset clock); treat that
        // as no time passing and re-anchor, rather than rewinding the clock.
        if (rawDelta >= 0) {
          if (rawDelta < minIntervalRef.current) return;
          deltaMs = Math.min(rawDelta, maxDeltaRef.current);
        }
      }
      lastTimestamp = timestamp;
      elapsedMs += deltaMs;
      callbackRef.current(deltaMs, elapsedMs);
    };

    frameId = window.requestAnimationFrame(onFrame);

    return () => {
      cancelled = true;
      if (
        frameId !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(frameId);
      }
    };
    // restartKey is deliberately a dependency the effect body never reads:
    // changing it is what tears the loop down and starts a fresh one.
  }, [isActive, restartKey]);
}
