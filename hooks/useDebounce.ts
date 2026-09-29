"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Edge configuration shared by the debounced and throttled callback hooks.
 */
export interface TimingEdgeOptions {
  /** Invoke on the leading edge of a burst. */
  leading?: boolean;
  /** Invoke on the trailing edge of a burst with the most recent arguments. */
  trailing?: boolean;
}

/**
 * A rate-limited wrapper around a callback. Calling it schedules or invokes the
 * underlying callback; its identity is stable for the lifetime of the component.
 */
export interface TimedCallback<Args extends unknown[]> {
  (...args: Args): void;
  /** Drop any pending trailing invocation. */
  cancel: () => void;
  /** Invoke a pending trailing invocation immediately, if one is queued. */
  flush: () => void;
  /** Whether a trailing invocation is currently queued. */
  isPending: () => boolean;
}

interface DebounceController<Args extends unknown[]> {
  callback: TimedCallback<Args>;
  configure: (
    fn: (...args: Args) => unknown,
    delayMs: number,
    leading: boolean,
    trailing: boolean
  ) => void;
}

function createDebounceController<Args extends unknown[]>(
  initialFn: (...args: Args) => unknown,
  initialDelayMs: number,
  initialLeading: boolean,
  initialTrailing: boolean
): DebounceController<Args> {
  let fn = initialFn;
  let delayMs = initialDelayMs;
  let leading = initialLeading;
  let trailing = initialTrailing;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onTimeout = () => {
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    if (trailing && args) fn(...args);
  };

  const call = (...args: Args) => {
    const startsBurst = timer === null;
    clear();

    if (startsBurst && leading) {
      pendingArgs = null;
      fn(...args);
    } else {
      pendingArgs = args;
    }
    timer = setTimeout(onTimeout, Math.max(0, delayMs));
  };

  const callback = Object.assign(call, {
    cancel: () => {
      clear();
      pendingArgs = null;
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
    configure: (nextFn, nextDelayMs, nextLeading, nextTrailing) => {
      fn = nextFn;
      delayMs = nextDelayMs;
      leading = nextLeading;
      trailing = nextTrailing;
    },
  };
}

/**
 * Returns `value` once it has stopped changing for `delayMs` milliseconds.
 *
 * A delay of zero or less passes the value through unchanged on the same
 * render, which lets callers bypass the debounce for specific values (for
 * example, clearing a search field) by passing a zero delay for them.
 *
 * The pending timer is cleared on every change and on unmount.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const immediate = !(delayMs > 0);

  // Keep stored state aligned with pass-through values so that switching back
  // to a positive delay resumes from the latest value, not a stale one. This
  // is React's supported "adjust state while rendering" pattern.
  if (immediate && !Object.is(debounced, value)) {
    setDebounced(value);
  }

  useEffect(() => {
    if (immediate) return;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, immediate]);

  return immediate ? value : debounced;
}

/**
 * Returns a stable debounced wrapper around `fn`. The wrapper always invokes
 * the latest `fn`, so it never captures stale props or state.
 *
 * Defaults to trailing-edge only. With `leading: true` the first call of a
 * burst runs immediately; the trailing call then runs only if further calls
 * arrived during the burst. The pending timer is cancelled on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  delayMs: number,
  options: TimingEdgeOptions = {}
): TimedCallback<Args> {
  const { leading = false, trailing = true } = options;
  const [controller] = useState(() =>
    createDebounceController(fn, delayMs, leading, trailing)
  );

  useLayoutEffect(() => {
    controller.configure(fn, delayMs, leading, trailing);
  }, [controller, fn, delayMs, leading, trailing]);

  useEffect(() => controller.callback.cancel, [controller]);

  return controller.callback;
}
