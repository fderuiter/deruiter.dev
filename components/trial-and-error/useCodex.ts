"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseCodex, serializeCodex, type Codex } from "@/lib/trial-and-error";

/**
 * Browser storage for the Codex and run history (#1529). The pure core
 * records, checks and migrates the document; this adapter only reads and
 * writes the string. Every access is guarded and wrapped, so a private
 * window, blocked site data, a full quota or a corrupt value leaves an empty
 * Codex and a game that plays exactly as it does without one.
 */

/** The localStorage key the Codex document lives under. */
export const CODEX_KEY = "te:codex";
const CODEX_CHANGE_EVENT = "te:codex-change";

function readRaw(): string | null {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.localStorage?.getItem !== "function"
    ) {
      return null;
    }
    return window.localStorage.getItem(CODEX_KEY);
  } catch {
    return null;
  }
}

function notify(): void {
  try {
    window.dispatchEvent(new Event(CODEX_CHANGE_EVENT));
  } catch {
    // No window to notify.
  }
}

/**
 * Applies a pure update to the stored Codex and writes it back when it
 * changed. Returns true when the write landed. A Codex written by a newer
 * build is left alone, and a failed write (quota, blocked storage) is
 * dropped quietly: the Codex is a keepsake, never a reason to break a run.
 */
export function updateCodex(update: (codex: Codex) => Codex): boolean {
  const read = parseCodex(readRaw());
  if (read.status === "NEWER") return false;
  const next = update(read.codex);
  if (next === read.codex) return false;
  try {
    if (typeof window.localStorage?.setItem !== "function") return false;
    window.localStorage.setItem(CODEX_KEY, serializeCodex(next));
  } catch {
    return false;
  }
  notify();
  return true;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CODEX_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CODEX_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CODEX_CHANGE_EVENT, callback);
  };
}

const noCodex = () => null;

/**
 * The stored Codex, or an empty one: storage unavailable, nothing stored, or
 * a value that no longer parses. Hydration-safe (`useSyncExternalStore`,
 * with nothing on the server), per AGENTS.md §4. Other tabs' writes arrive
 * through the `storage` event.
 */
export function useCodex(enabled: boolean): Codex {
  const raw = useSyncExternalStore(
    subscribe,
    () => (enabled ? readRaw() : null),
    noCodex
  );
  return useMemo(() => parseCodex(raw).codex, [raw]);
}
