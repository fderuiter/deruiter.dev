/**
 * Whether the coach strip is hidden, remembered in this browser under
 * `fbb_hide_tips`. Storage goes through `lib/safe-storage`, which handles
 * server rendering and blocked storage. When storage cannot keep the choice,
 * it is kept for this page session only, so Hide still works until reload.
 */

import { safeRawStorage } from "@/lib/safe-storage";

const KEY = "fbb_hide_tips";
const listeners = new Set<() => void>();

/** The choice made while storage could not keep it; null until one is made. */
let sessionChoice: boolean | null = null;

/**
 * The choice to show: the session's choice while storage could not keep one,
 * otherwise the saved choice. A stale saved value never overrides a choice
 * the reader just made.
 */
export function readHideTips(): boolean {
  if (sessionChoice !== null) return sessionChoice;
  try {
    const stored = safeRawStorage.getItem(KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // Unreadable storage falls through to the default.
  }
  return false;
}

/** Saves the choice and tells every mounted strip to re-read it. */
export function writeHideTips(hidden: boolean): void {
  try {
    safeRawStorage.setItem(KEY, hidden ? "1" : "0");
    // Saved, so the stored value is the truth again.
    sessionChoice = null;
  } catch {
    sessionChoice = hidden;
  }
  for (const listener of listeners) listener();
}

/** Subscribes to changes made with writeHideTips; for useSyncExternalStore. */
export function subscribeHideTips(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
