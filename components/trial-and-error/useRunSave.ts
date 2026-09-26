"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  parseRunSave,
  serializeRun,
  type RestoredRun,
  type RunLog,
  type RunPlan,
} from "@/lib/trial-and-error";

/**
 * Browser storage for a resumable run (#1079). The pure core builds and
 * checks the save; this adapter only reads and writes the string. Every
 * access is guarded and wrapped, so a private window, blocked site data or a
 * full quota leaves the game working exactly as it does without saves.
 */

const SAVE_KEY_PREFIX = "te:run-save:";
const SAVE_CHANGE_EVENT = "te:run-save-change";

const keyFor = (actId: string) => `${SAVE_KEY_PREFIX}${actId}`;

function readSave(actId: string): string | null {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.localStorage?.getItem !== "function"
    ) {
      return null;
    }
    return window.localStorage.getItem(keyFor(actId));
  } catch {
    return null;
  }
}

function notify(): void {
  try {
    window.dispatchEvent(new Event(SAVE_CHANGE_EVENT));
  } catch {
    // No window to notify.
  }
}

/**
 * Saves a run log. A log the save format refuses (it outgrew the move cap)
 * clears the save instead, so a stale save is never left behind.
 */
export function writeRunSave(log: RunLog, now: Date = new Date()): void {
  try {
    if (typeof window.localStorage?.setItem !== "function") return;
    window.localStorage.setItem(keyFor(log.actId), serializeRun(log, now));
  } catch {
    clearRunSave(log.actId);
    return;
  }
  notify();
}

/** Removes an act's saved run, if any. */
export function clearRunSave(actId: string): void {
  try {
    if (typeof window.localStorage?.removeItem !== "function") return;
    window.localStorage.removeItem(keyFor(actId));
  } catch {
    // Storage unavailable: nothing to clear.
  }
  notify();
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(SAVE_KEY_PREFIX)) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVE_CHANGE_EVENT, callback);
  };
}

/**
 * The plan's resumable saved run, or null: none saved, storage unavailable,
 * or a save that no longer rebuilds. Hydration-safe (`useSyncExternalStore`,
 * with no save on the server), per AGENTS.md §4.
 */
export function useSavedRun(
  act: RunPlan,
  enabled: boolean
): RestoredRun | null {
  const json = useSyncExternalStore(
    subscribe,
    () => (enabled ? readSave(act.id) : null),
    () => null
  );
  return useMemo(() => parseRunSave(json, [act]), [json, act]);
}
