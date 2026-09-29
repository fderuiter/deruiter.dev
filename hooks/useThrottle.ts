"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { TimedCallback, TimingEdgeOptions } from "./useDebounce";

export type { TimedCallback, TimingEdgeOptions } from "./useDebounce";

interface ThrottleController<Args extends unknown[]> {
  callback: TimedCallback<Args>;
  configure: (
    fn: (...args: Args) => unknown,
    intervalMs: number,
    leading: boolean,
    trailing: boolean
  ) => void;
}

function createThrottleController<Args extends unknown[]>(
  initialFn: (...args: Args) => unknown,
  initialIntervalMs: number,
  initialLeading: boolean,
  initialTrailing: boolean
): ThrottleController<Args> {
  let fn = initialFn;
  let intervalMs = initialIntervalMs;
  let leading = initialLeading;
  let trailing = initialTrailing;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;
  let windowStart: number | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const invoke = (args: Args) => {
    windowStart = Date.now();
    pendingArgs = null;
    fn(...args);
  };

  const onTimeout = () => {
    timer = null;
    const args = pendingArgs;
    if (trailing && args) invoke(args);
    else pendingArgs = null;
  };

  const call = (...args: Args) => {
    const now = Date.now();
    const elapsed = windowStart === null ? Infinity : now - windowStart;
    // A clock that moved backwards (system time change) also closes the window.
    const windowClosed =
      elapsed >= intervalMs || elapsed < 0 || intervalMs <= 0;

    if (timer === null && windowClosed) {
      // A new window opens with this call.
      if (leading) {
        invoke(args);
        return;
      }
      windowStart = now;
      pendingArgs = args;
      if (trailing) timer = setTimeout(onTimeout, Math.max(0, intervalMs));
      return;
    }

    // Inside an open window: remember the latest call for the trailing edge.
    pendingArgs = args;
    if (trailing && timer === null) {
      timer = setTimeout(onTimeout, Math.max(0, intervalMs - elapsed));
    }
  };

  const callback = Object.assign(call, {
    cancel: () => {
      clear();
      pendingArgs = null;
      windowStart = null;
    },
    flush: () => {
      if (timer === null) return;
      clear();
      onTimeout();
    },
    isPending: () => timer !== null && pendingArgs !== null,
  });

  return {
    callback,
    configure: (nextFn, nextIntervalMs, nextLeading, nextTrailing) => {
      fn = nextFn;
      intervalMs = nextIntervalMs;
      leading = nextLeading;
      trailing = nextTrailing;
    },
  };
}

/**
 * Returns a stable throttled wrapper around `fn` that invokes it at most once
 * per `intervalMs`. The wrapper always invokes the latest `fn`, so it never
 * captures stale props or state.
 *
 * Defaults to both edges: the first call of a window runs immediately and the
 * last call made during the window runs when it closes. Pass
 * `trailing: false` to drop calls inside the window instead. An interval of
 * zero or less invokes on every call. The pending timer is cancelled on
 * unmount.
 *
 * This is a wall-clock throttle. Work that should coalesce to the display
 * refresh, such as pointer raycasting, belongs in requestAnimationFrame.
 */
export function useThrottledCallback<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  intervalMs: number,
  options: TimingEdgeOptions = {}
): TimedCallback<Args> {
  const { leading = true, trailing = true } = options;
  const [controller] = useState(() =>
    createThrottleController(fn, intervalMs, leading, trailing)
  );

  useLayoutEffect(() => {
    controller.configure(fn, intervalMs, leading, trailing);
  }, [controller, fn, intervalMs, leading, trailing]);

  useEffect(() => controller.callback.cancel, [controller]);

  return controller.callback;
}

/**
 * Returns `value`, updated at most once per `intervalMs`. A change that lands
 * inside the current window is applied when the window closes, so the latest
 * value is never lost. An interval of zero or less passes every change through.
 * The pending timer is cleared on unmount.
 */
export function useThrottle<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const update = useThrottledCallback(
    (next: T) => setThrottled(() => next),
    intervalMs
  );

  useEffect(() => {
    update(value);
  }, [value, update]);

  return throttled;
}
