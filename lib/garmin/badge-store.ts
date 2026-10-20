/**
 * Badge and run history save for Monkey C Mayhem (#2021), kept in
 * localStorage apart from the pure lib/garmin/badges.ts and from the engine
 * bundle. Every read and write is guarded: unreadable storage or a corrupt
 * save reads as an empty one, and malformed runs and badges are dropped one
 * by one.
 */

import {
  HISTORY_SIZE,
  isBadgeId,
  isDay,
  newBadgeSave,
  type BadgeId,
  type BadgeSave,
  type HistoryMode,
  type RunEntry,
  type Streak,
} from "./badges";
import { clamp } from "../game-utils";
import { safeGetRawItem, safeSetRawItem } from "../safe-storage";

/** localStorage key holding the badges and run history, as JSON. */
export const BADGE_STORAGE_KEY = "garmin_badges";

/** The save format; a save in another format reads as an empty one. */
export const BADGE_SAVE_VERSION = 1;

const MODES: readonly HistoryMode[] = ["training", "race", "plan"];

/** A finite number at least 0, or `fallback`. */
function countOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

/** A stored run, or null when it is not one. */
function runOf(raw: unknown): RunEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isDay(r.day) || !MODES.some((m) => m === r.mode)) return null;
  const te =
    typeof r.te === "number" && Number.isFinite(r.te)
      ? clamp(r.te, 0, 5)
      : null;
  return {
    day: r.day,
    mode: r.mode as HistoryMode,
    finished: r.finished === true,
    timeMs: countOf(r.timeMs, 0),
    meters: Math.round(countOf(r.meters, 0)),
    te,
    kudos: Math.round(countOf(r.kudos, 0)),
  };
}

/** The stored streak, or none. */
function streakOf(raw: unknown): Streak {
  if (!raw || typeof raw !== "object") return { lastDay: null, days: 0 };
  const r = raw as Record<string, unknown>;
  if (!isDay(r.lastDay)) return { lastDay: null, days: 0 };
  return {
    lastDay: r.lastDay,
    days: Math.max(1, Math.floor(countOf(r.days, 1))),
  };
}

/** `raw` read back as a save; anything unreadable falls back on its own. */
export function normalizeBadges(raw: unknown): BadgeSave {
  if (!raw || typeof raw !== "object") return newBadgeSave();
  const r = raw as Record<string, unknown>;
  if (r.v !== BADGE_SAVE_VERSION) return newBadgeSave();
  const runs = Array.isArray(r.runs)
    ? r.runs
        .map(runOf)
        .filter((run): run is RunEntry => run !== null)
        .slice(0, HISTORY_SIZE)
    : [];
  const badges: Partial<Record<BadgeId, string>> = {};
  if (r.badges && typeof r.badges === "object") {
    for (const [id, day] of Object.entries(r.badges)) {
      if (isBadgeId(id) && isDay(day)) badges[id] = day;
    }
  }
  return {
    runs,
    badges,
    streak: streakOf(r.streak),
    lastDnfDay: isDay(r.lastDnfDay) ? r.lastDnfDay : null,
  };
}

/** The save on this device, or an empty one. */
export function loadBadges(): BadgeSave {
  try {
    return normalizeBadges(
      JSON.parse(safeGetRawItem(BADGE_STORAGE_KEY) ?? "null")
    );
  } catch {
    return newBadgeSave();
  }
}

/** Writes the save; false when storage refuses it. */
export function saveBadges(save: BadgeSave): boolean {
  try {
    return safeSetRawItem(
      BADGE_STORAGE_KEY,
      JSON.stringify({ v: BADGE_SAVE_VERSION, ...save })
    );
  } catch {
    return false;
  }
}
