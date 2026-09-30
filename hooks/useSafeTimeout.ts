"use client";

import { useEffect, useState } from "react";

/**
 * Opaque handle for a timeout scheduled through `useSafeTimeout`. Pass it to
 * `clearSafeTimeout`; it is not a native timer id.
 */
export type SafeTimeoutId = number;

/**
 * Scheduling controls returned by `useSafeTimeout`. Every function has a
 * stable identity for the lifetime of the component, so they are safe to use
 * in dependency arrays.
 */
export interface SafeTimeoutControls {
  /**
   * Schedules `fn` to run once after `delayMs` milliseconds. The timeout is
   * tracked and cleared automatically when the component unmounts. Calls made
   * after unmount schedule nothing.
   */
  setSafeTimeout: (fn: () => void, delayMs: number) => SafeTimeoutId;
  /**
   * Cancels a pending timeout. Handles that already fired, were already
   * cleared, or are null or undefined are ignored.
   */
  clearSafeTimeout: (id: SafeTimeoutId | null | undefined) => void;
  /** Cancels every timeout this component still has pending. */
  clearAll: () => void;
  /** Number of timeouts still pending. */
  pendingCount: () => number;
}

interface SafeTimeoutController {
  controls: SafeTimeoutControls;
  activate: () => void;
  dispose: () => void;
}

function createSafeTimeoutController(): SafeTimeoutController {
  const pending = new Map<SafeTimeoutId, ReturnType<typeof setTimeout>>();
  let nextId = 1;
  let disposed = false;

  const clearAll = () => {
    for (const native of pending.values()) clearTimeout(native);
    pending.clear();
  };

  const controls: SafeTimeoutControls = {
    setSafeTimeout: (fn, delayMs) => {
      const id = nextId++;
      if (disposed) return id;
      const native = setTimeout(
        () => {
          pending.delete(id);
          fn();
        },
        Math.max(0, delayMs)
      );
      pending.set(id, native);
      return id;
    },
    clearSafeTimeout: (id) => {
      if (id === null || id === undefined) return;
      const native = pending.get(id);
      if (native === undefined) return;
      clearTimeout(native);
      pending.delete(id);
    },
    clearAll,
    pendingCount: () => pending.size,
  };

  return {
    controls,
    // Strict Mode unmounts and remounts effects once in development, so
    // mounting re-arms a controller that an earlier cleanup disposed.
    activate: () => {
      disposed = false;
    },
    dispose: () => {
      disposed = true;
      clearAll();
    },
  };
}

/**
 * Returns lifecycle-safe replacements for `setTimeout` and `clearTimeout`.
 *
 * Use it for one-shot delays started from event handlers or callbacks, such
 * as dismissing a toast bubble or pausing between scripted steps. Every
 * timeout scheduled through the returned `setSafeTimeout` is tracked and
 * cleared when the component unmounts, so a delayed callback can never update
 * state or play audio for a component that is gone.
 *
 * For repeating work driven by a delay, use `useInterval`. For collapsing
 * bursts of calls, use `useDebouncedCallback` or `useThrottledCallback`.
 */
export function useSafeTimeout(): SafeTimeoutControls {
  const [controller] = useState(createSafeTimeoutController);

  useEffect(() => {
    controller.activate();
    return controller.dispose;
  }, [controller]);

  return controller.controls;
}
