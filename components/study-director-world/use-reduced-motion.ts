import { useSyncExternalStore } from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq =
    typeof window.matchMedia === "function"
      ? window.matchMedia(MOTION_QUERY)
      : null;
  mq?.addEventListener?.("change", onChange);
  return () => mq?.removeEventListener?.("change", onChange);
}

function snapshot(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(MOTION_QUERY).matches
    : false;
}

/** True when the visitor asks the system for less motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
