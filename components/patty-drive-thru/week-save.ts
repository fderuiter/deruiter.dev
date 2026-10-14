/**
 * Keeps a half-finished week of shifts in the browser between days (#2086),
 * so a visitor can stop after Tuesday and come back for Wednesday. Only the
 * finished days are saved; a day stopped part way is worked again from the
 * start. Storage goes through `safeRawStorage`, and every read and write is
 * guarded, so the game works without it.
 */

import { useSyncExternalStore } from "react";
import { parseWeekSave, type WeekState } from "@/lib/patty-drive-thru";
import { safeRawStorage } from "@/lib/safe-storage";

const WEEK_SAVE_KEY = "patty-drive-thru:week:v1";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedWeek: WeekState | null = null;

function notify() {
  for (const listener of listeners) listener();
}

/** The saved week, or null when there is none or it cannot be read. */
function loadWeekSave(): WeekState | null {
  let raw: string | null = null;
  try {
    raw = safeRawStorage.getItem(WEEK_SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedWeek;
  cachedRaw = raw;
  try {
    cachedWeek = raw ? parseWeekSave(JSON.parse(raw)) : null;
  } catch {
    cachedWeek = null;
  }
  return cachedWeek;
}

/** Saves the week as it stands; a week with no days worked clears the save. */
export function saveWeek(week: WeekState): void {
  try {
    if (week.days.length === 0) safeRawStorage.removeItem(WEEK_SAVE_KEY);
    else safeRawStorage.setItem(WEEK_SAVE_KEY, JSON.stringify(week));
  } catch {
    // Storage full or blocked: the week still plays, it just will not resume.
  }
  notify();
}

/** Forgets the saved week, once it is finished or the player starts over. */
export function clearWeekSave(): void {
  try {
    safeRawStorage.removeItem(WEEK_SAVE_KEY);
  } catch {
    // Nothing to do: the save is unreadable anyway.
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved week, kept current as it is saved and cleared. */
export function useWeekSave(): WeekState | null {
  return useSyncExternalStore(subscribe, loadWeekSave, () => null);
}

const WEEK_BEST_KEY = "patty-drive-thru:week-best:v1";

/**
 * The best week total this browser has seen, or null. The week total is kept
 * here rather than on the arcade board, where each day's own score goes, so
 * single shifts and week days compete on the same terms (#2086).
 */
function loadWeekBest(): number | null {
  try {
    const raw = safeRawStorage.getItem(WEEK_BEST_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Records a finished week's total as the best week if it beats the old one,
 * and returns the best from before this week, or null if there was none.
 */
export function recordWeekBest(total: number): number | null {
  const previous = loadWeekBest();
  if (Number.isFinite(total) && total > (previous ?? -1)) {
    try {
      safeRawStorage.setItem(WEEK_BEST_KEY, String(Math.round(total)));
    } catch {
      // Storage full or blocked: the week still ends, the best is not kept.
    }
  }
  return previous;
}
