"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Runs `callback` every `delayMs` milliseconds while the component is mounted.
 *
 * Pass `null` as the delay to pause; passing a number again starts a fresh
 * interval. Changing the delay restarts the interval with the new period. The
 * interval is cleared on unmount.
 *
 * Each tick invokes the latest `callback`, so it reads current props and
 * state without restarting the interval when the callback's identity changes.
 */
export function useInterval(
  callback: () => void,
  delayMs: number | null
): void {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null || Number.isNaN(delayMs)) return;
    const timer = setInterval(
      () => callbackRef.current(),
      Math.max(0, delayMs)
    );
    return () => clearInterval(timer);
  }, [delayMs]);
}
