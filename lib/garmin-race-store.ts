/**
 * Race Mode storage for Monkey C Mayhem (#2019): the local top-5 board for
 * each course and category, the picked run mode, course and category, and the
 * race outcome helpers the watch and the simulator share. Kept apart from
 * lib/garmin-race.ts, which stays pure, and from the engine bundle. Every read
 * and write is guarded, so unreadable storage reads as an empty board.
 */

import {
  BOARD_SIZE,
  COURSE_VERSION,
  RACE_CATEGORIES,
  RACE_COURSES,
  boardKey,
  formatRaceTime,
  insertResult,
  liveEntries,
  type BoardEntry,
  type RaceCategory,
  type RaceCourse,
  type RaceOutcome,
  type RaceSetup,
  type RaceVerdict,
} from "./garmin-race";
import { safeGetRawItem, safeSetRawItem } from "./safe-storage";

/** localStorage key holding every board, as one JSON object of board key to entries. */
export const RACE_BOARDS_KEY = "garmin_race_boards";
/** localStorage key: "1" when Race Mode is picked, otherwise a Training Run. */
export const RACE_MODE_KEY = "garmin_race_mode";
/** localStorage key holding the picked race course. */
export const RACE_COURSE_KEY = "garmin_race_course";
/** localStorage key holding the picked race category. */
export const RACE_CATEGORY_KEY = "garmin_race_category";

/** Every board, or an empty object when storage is unreadable or not an object. */
function readAllBoards(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      safeGetRawItem(RACE_BOARDS_KEY) ?? "null"
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Unreadable storage or JSON: treat as no boards.
  }
  return {};
}

/** True for a stored entry with every field a board needs. */
function isBoardEntry(value: unknown): value is BoardEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.timeMs === "number" &&
    Number.isFinite(e.timeMs) &&
    e.timeMs >= 0 &&
    typeof e.at === "string" &&
    typeof e.seed === "number" &&
    Number.isFinite(e.seed) &&
    typeof e.version === "number" &&
    Number.isFinite(e.version)
  );
}

/** The stored entries of one board, with malformed entries dropped. */
function readBoard(key: string): BoardEntry[] {
  try {
    const all = readAllBoards();
    if (!Object.prototype.hasOwnProperty.call(all, key)) return [];
    const raw = all[key];
    return Array.isArray(raw) ? raw.filter(isBoardEntry) : [];
  } catch {
    return [];
  }
}

/** Saves one board, keeping every other board. Returns whether it reached storage. */
function writeBoard(key: string, entries: readonly BoardEntry[]): boolean {
  try {
    const all = readAllBoards();
    return safeSetRawItem(
      RACE_BOARDS_KEY,
      JSON.stringify({ ...all, [key]: entries })
    );
  } catch {
    return false;
  }
}

/**
 * The local board for a course, category and seed, fastest first. Only
 * entries for this seed at the current {@link COURSE_VERSION} count. Never throws.
 */
export function loadBoard(
  course: RaceCourse,
  category: RaceCategory,
  seed: number
): BoardEntry[] {
  return liveEntries(readBoard(boardKey(course, category)), seed)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, BOARD_SIZE);
}

/**
 * Adds a judged time to its board and returns the new board with the result's
 * place (1-based, or 0 when it missed the top {@link BOARD_SIZE}). Never throws.
 */
export function saveResult(
  setup: RaceSetup,
  timeMs: number,
  date: Date
): { board: BoardEntry[]; place: number } {
  const key = boardKey(setup.course, setup.category);
  const entry: BoardEntry = {
    timeMs,
    at: date.toISOString(),
    seed: setup.seed,
    version: COURSE_VERSION,
  };
  const { board, place } = insertResult(readBoard(key), entry);
  writeBoard(key, board);
  return { board, place };
}

/**
 * The record a result earns on its board, which holds this device's times
 * only: PR when it beats the board's best before it (a new personal record,
 * which is also the course record), CR when it sets the first record on an
 * empty board, otherwise null.
 */
export function raceRecordOf(
  place: number,
  timeMs: number,
  priorBestMs: number | null
): "CR" | "PR" | null {
  if (place !== 1) return null;
  return priorBestMs !== null && timeMs < priorBestMs ? "PR" : "CR";
}

/**
 * The announcement that ends a race: its time or DNF / DNQ, and the place.
 * e.g. "Race over: 4:12.33, place 1 on this board, course record."
 */
export function raceOverText(
  verdict: RaceVerdict,
  outcome: RaceOutcome,
  place: number,
  record: "CR" | "PR" | null
): string {
  if (verdict.result !== "time") {
    const label = verdict.result.toUpperCase();
    return `Race over: ${label}, ${verdict.reason}.`;
  }
  const where =
    place === 0
      ? "off the board"
      : `place ${place} on this board${record === "CR" ? ", course record" : record === "PR" ? ", new personal record" : ""}`;
  return `Race over: ${formatRaceTime(outcome.timeMs)}, ${where}.`;
}

/** The race mode the player picked, false for a Training Run. */
export function readRaceMode(): boolean {
  try {
    return safeGetRawItem(RACE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

/** The picked race course, the Saturday 5K when none is stored. */
export function readRaceCourse(): RaceCourse {
  try {
    const raw = safeGetRawItem(RACE_COURSE_KEY);
    return RACE_COURSES.find((c) => c === raw) ?? "saturday5k";
  } catch {
    return "saturday5k";
  }
}

/** The picked race category, Any% when none is stored. */
export function readRaceCategory(): RaceCategory {
  try {
    const raw = safeGetRawItem(RACE_CATEGORY_KEY);
    return RACE_CATEGORIES.find((c) => c === raw) ?? "any";
  } catch {
    return "any";
  }
}

/** Writes one race preference raw. Returns whether it reached storage. Never throws. */
export function writeRacePref(key: string, value: string): boolean {
  try {
    return safeSetRawItem(key, value);
  } catch {
    return false;
  }
}
