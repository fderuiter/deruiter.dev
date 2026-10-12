"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createHoldRepeater,
  type HoldRepeater,
} from "@/components/arcade/mobile/holdRepeat";

/** The press and release a hold-repeat control exposes to its button. */
export interface HoldControl {
  start: () => void;
  stop: () => void;
}

/**
 * Binds a hold-repeat controller to a component. The tick always runs the
 * latest `tick` the component rendered, so a repeat after a state change moves
 * from the new position. The hold stops on unmount.
 *
 * @param tick - Called once per step while held.
 * @returns A stable `start` and `stop`, for the button's press and release.
 */
export function useHoldRepeat(tick: () => void): HoldControl {
  const tickRef = useRef(tick);
  const repeaterRef = useRef<HoldRepeater | null>(null);

  useEffect(() => {
    tickRef.current = tick;
  });
  useEffect(() => {
    return () => repeaterRef.current?.stop();
  }, []);

  return useMemo<HoldControl>(
    () => ({
      start() {
        if (!repeaterRef.current) {
          repeaterRef.current = createHoldRepeater(() => tickRef.current());
        }
        repeaterRef.current.start();
      },
      stop() {
        repeaterRef.current?.stop();
      },
    }),
    []
  );
}
