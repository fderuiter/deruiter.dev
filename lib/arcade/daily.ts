/**
 * Arcade Daily (#2113): one shared daily seed across the games that take a
 * run seed, with a local best per game and a streak counter.
 *
 * Every seed here is a pure function of a UTC date and a game id, so the same
 * day gives the same seed in every browser and a new UTC day rolls them all.
 * Nothing reads the clock except where a caller passes the time in, and
 * nothing draws an unseeded random number. This file is pure; the record
 * is read and written in this browser's storage by `daily-store.ts`, with no
 * network or database.
 */

import { fnv1a } from "../utils/prng";
import { isPhoneGated } from "./registry";

/**
 * The games with seeded runs, in the order the daily panel lists them. A unit
 * test keeps this set equal to the registry entries marked `daily`.
 */
export const ARCADE_DAILY_GAME_IDS = [
  "trial-and-error",
  "for-better-or-bulk",
  "study-director",
  "patty-drive-thru",
  "protocol-drift",
] as const;

/** A game that takes part in the Arcade Daily. */
export type ArcadeDailyGameId = (typeof ARCADE_DAILY_GAME_IDS)[number];

/** How the hub lists a game's daily. */
export interface ArcadeDailyGame {
  readonly id: ArcadeDailyGameId;
  readonly title: string;
  /** The game's page, without any daily parameter. */
  readonly route: string;
  /** What the daily best measures, e.g. "best hand". */
  readonly scoreLabel: string;
  /** Still behind the desktop-only gate on phones, read from the registry. */
  readonly desktopOnly: boolean;
}

/** The hub's daily list. A game joins once its runs take a seed. */
export const ARCADE_DAILY_GAMES: readonly ArcadeDailyGame[] = [
  {
    id: "trial-and-error",
    title: "Trial & Error",
    route: "/arcade/trial-and-error",
    scoreLabel: "best hand",
    desktopOnly: isPhoneGated("trial-and-error"),
  },
  {
    id: "for-better-or-bulk",
    title: "For Better or Bulk",
    route: "/arcade/for-better-or-bulk",
    scoreLabel: "spots set",
    desktopOnly: isPhoneGated("for-better-or-bulk"),
  },
  {
    id: "study-director",
    title: "Study Director",
    route: "/arcade/study-director",
    scoreLabel: "grade",
    desktopOnly: isPhoneGated("study-director"),
  },
  {
    id: "patty-drive-thru",
    title: "Patty's Drive-Thru",
    route: "/arcade/patty-drive-thru",
    scoreLabel: "shift score",
    desktopOnly: isPhoneGated("patty-drive-thru"),
  },
  {
    id: "protocol-drift",
    title: "Protocol Drift",
    route: "/protocol-drift",
    scoreLabel: "lock score",
    desktopOnly: isPhoneGated("protocol-drift"),
  },
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** The largest numeric daily seed: a positive 31-bit integer. */
export const ARCADE_DAILY_MAX_SEED = 0x7fffffff;

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isArcadeDailyDate(date: string): boolean {
  const match = ISO_DATE.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  return new Date(time).toISOString().slice(0, 10) === date;
}

/** The UTC calendar date of an instant, `YYYY-MM-DD`. */
export function arcadeDailyDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** The date `days` after `date` (negative goes back), both `YYYY-MM-DD`. */
function shiftDate(date: string, days: number): string {
  return arcadeDailyDate(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
}

function assertDate(date: string): void {
  if (!isArcadeDailyDate(date)) {
    throw new RangeError(`Arcade Daily needs a YYYY-MM-DD date, got ${date}`);
  }
}

/**
 * The text a game's daily seed is derived from. Each game has its own salt so
 * every game's daily differs. Trial & Error and For Better or Bulk keep the
 * salts their dailies used before the Arcade Daily, so their past and future
 * daily links still give the same seeds.
 */
export function arcadeDailyKey(date: string, game: ArcadeDailyGameId): string {
  assertDate(date);
  switch (game) {
    case "trial-and-error":
      return `daily-protocol:${date}`;
    case "for-better-or-bulk":
      return `for-better-or-bulk:${date}`;
    default:
      return `arcade-daily:${game}:${date}`;
  }
}

/**
 * The shared Arcade Daily seed for a game on a UTC date: an unsigned 32-bit
 * integer, the same in every browser. Throws a RangeError on anything but a
 * real date.
 */
export function arcadeDailySeed(date: string, game: ArcadeDailyGameId): number {
  return fnv1a(arcadeDailyKey(date, game));
}

/**
 * The daily seed as a whole number from 1 to {@link ARCADE_DAILY_MAX_SEED},
 * for games whose seeds are positive integers. Never 0, which some games
 * keep for their standard, unseeded run.
 */
export function arcadeDailyNumber(
  date: string,
  game: ArcadeDailyGameId
): number {
  return (arcadeDailySeed(date, game) % ARCADE_DAILY_MAX_SEED) + 1;
}

/**
 * The daily seed as text, for games whose seeds are strings, e.g.
 * `daily-2026-10-14-1x9k2a`. The date is part of the seed, so a run started
 * from it is known to be a daily wherever the seed travels.
 */
export function arcadeDailyTag(date: string, game: ArcadeDailyGameId): string {
  return `daily-${date}-${arcadeDailySeed(date, game).toString(36)}`;
}

const TAG = /^daily-(\d{4}-\d{2}-\d{2})-[0-9a-z]{1,7}$/;

/** The date of a game's daily tag, or null when `seed` is not one. */
export function parseArcadeDailyTag(
  seed: string,
  game: ArcadeDailyGameId
): string | null {
  const match = TAG.exec(seed);
  if (!match || !isArcadeDailyDate(match[1])) return null;
  return arcadeDailyTag(match[1], game) === seed ? match[1] : null;
}

/**
 * The date whose daily number `seed` is, checked against today and
 * yesterday at `now`, or null. Yesterday counts so a run started just before
 * midnight UTC still counts when it ends after.
 */
export function arcadeDailyDateOfNumber(
  seed: number,
  game: ArcadeDailyGameId,
  now: number
): string | null {
  const today = arcadeDailyDate(now);
  for (const date of [today, shiftDate(today, -1)]) {
    if (arcadeDailyNumber(date, game) === seed) return date;
  }
  return null;
}

/**
 * The link that starts a game's daily for a date. Each game reads it the way
 * it already reads a shared seed: a hash for Trial & Error and Study
 * Director, a query for the others.
 */
export function arcadeDailyHref(game: ArcadeDailyGameId, date: string): string {
  assertDate(date);
  switch (game) {
    case "trial-and-error":
      return `/arcade/trial-and-error#daily=${date}`;
    case "study-director":
      return `/arcade/study-director#mode=desk&seed=${arcadeDailyTag(date, game)}`;
    case "patty-drive-thru":
      return `/arcade/patty-drive-thru?seed=${arcadeDailyTag(date, game)}`;
    case "for-better-or-bulk":
      return `/arcade/for-better-or-bulk?daily=${date}`;
    case "protocol-drift":
      return `/protocol-drift?daily=${date}`;
  }
}

/**
 * The `daily` date in a query or hash string (`?daily=…` or `#daily=…`), or
 * null when it is missing or not a real date.
 */
export function readArcadeDailyParam(text: string): string | null {
  try {
    const date = new URLSearchParams(text.replace(/^[?#]/, "")).get("daily");
    return date !== null && isArcadeDailyDate(date) ? date : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Daily bests and the streak
// ---------------------------------------------------------------------------

/** Storage key for the Arcade Daily record. */
export const ARCADE_DAILY_STORAGE_KEY = "arcade_daily_v1";

/** Days of per-game bests kept; older days are dropped. */
const BEST_DAYS_KEPT = 31;
/** Played days kept for the streak; the longest streak is kept as a number. */
const PLAYED_DAYS_KEPT = 400;
/** Longest label a game may store beside a score. */
const MAX_LABEL = 40;

/** One game's best daily result for one day. */
export interface ArcadeDailyResult {
  /** Higher is better. */
  readonly score: number;
  /** How the game words the score, e.g. "Grade A, 4 stars". */
  readonly label?: string;
}

/** Everything the Arcade Daily keeps in this browser. */
export interface ArcadeDailyProgress {
  readonly version: 1;
  /** Best result per game per UTC date. */
  readonly bests: Readonly<
    Partial<
      Record<ArcadeDailyGameId, Readonly<Record<string, ArcadeDailyResult>>>
    >
  >;
  /** UTC dates with at least one daily played, oldest first, no repeats. */
  readonly played: readonly string[];
  /** The longest streak ever reached, in days. */
  readonly longest: number;
}

/** The current and longest streak of days with a daily played. */
export interface ArcadeDailyStreak {
  readonly current: number;
  readonly longest: number;
}

/** A record with nothing played. */
export function emptyArcadeDailyProgress(): ArcadeDailyProgress {
  return { version: 1, bests: {}, played: [], longest: 0 };
}

function isResult(value: unknown): value is ArcadeDailyResult {
  if (typeof value !== "object" || value === null) return false;
  const { score, label } = value as Record<string, unknown>;
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    (label === undefined || typeof label === "string")
  );
}

/**
 * A stored record, checked field by field. Anything damaged is dropped
 * rather than trusted, and a record that is not one at all reads as empty.
 */
export function parseArcadeDailyProgress(raw: unknown): ArcadeDailyProgress {
  if (typeof raw !== "object" || raw === null) {
    return emptyArcadeDailyProgress();
  }
  const record = raw as Record<string, unknown>;
  const bests: Partial<
    Record<ArcadeDailyGameId, Record<string, ArcadeDailyResult>>
  > = {};
  const rawBests =
    typeof record.bests === "object" && record.bests !== null
      ? (record.bests as Record<string, unknown>)
      : {};
  for (const game of ARCADE_DAILY_GAME_IDS) {
    const days = rawBests[game];
    if (typeof days !== "object" || days === null) continue;
    const kept: Record<string, ArcadeDailyResult> = {};
    for (const [date, result] of Object.entries(days)) {
      if (isArcadeDailyDate(date) && isResult(result)) {
        kept[date] = {
          score: result.score,
          ...(result.label !== undefined && {
            label: result.label.slice(0, MAX_LABEL),
          }),
        };
      }
    }
    if (Object.keys(kept).length > 0) bests[game] = kept;
  }
  const played = Array.isArray(record.played)
    ? [
        ...new Set(
          record.played.filter(
            (d): d is string => typeof d === "string" && isArcadeDailyDate(d)
          )
        ),
      ].sort()
    : [];
  const longest =
    typeof record.longest === "number" &&
    Number.isInteger(record.longest) &&
    record.longest >= 0
      ? record.longest
      : 0;
  return { version: 1, bests, played, longest };
}

/** Consecutive played days ending on `last`, counting back. */
function runEndingOn(played: ReadonlySet<string>, last: string): number {
  let count = 0;
  let date = last;
  while (played.has(date)) {
    count += 1;
    date = shiftDate(date, -1);
  }
  return count;
}

/**
 * The streak on `today`: consecutive days with a daily played, ending today,
 * or ending yesterday while today is still unplayed (so the streak lives
 * until a whole UTC day is missed). `longest` is the best ever, at least the
 * current streak.
 */
export function arcadeDailyStreak(
  progress: Pick<ArcadeDailyProgress, "played" | "longest">,
  today: string
): ArcadeDailyStreak {
  assertDate(today);
  const played = new Set(progress.played);
  const current = played.has(today)
    ? runEndingOn(played, today)
    : runEndingOn(played, shiftDate(today, -1));
  return { current, longest: Math.max(progress.longest, current) };
}

/**
 * The record with a game's daily result added. Only today's or yesterday's
 * daily counts, so an old daily link replays its seed without changing the
 * streak or the bests. A result below the day's best keeps the best but
 * still marks the day played. Pure; returns the same record when nothing
 * counts.
 */
export function withArcadeDailyResult(
  progress: ArcadeDailyProgress,
  game: ArcadeDailyGameId,
  date: string,
  result: ArcadeDailyResult,
  today: string
): ArcadeDailyProgress {
  assertDate(today);
  if (!isArcadeDailyDate(date) || !Number.isFinite(result.score)) {
    return progress;
  }
  if (date !== today && date !== shiftDate(today, -1)) return progress;

  const oldestBest = shiftDate(today, -(BEST_DAYS_KEPT - 1));
  const days = { ...(progress.bests[game] ?? {}) };
  const previous = days[date];
  if (previous === undefined || result.score > previous.score) {
    days[date] = {
      score: result.score,
      ...(result.label !== undefined && {
        label: result.label.slice(0, MAX_LABEL),
      }),
    };
  }
  const bests: Partial<
    Record<ArcadeDailyGameId, Record<string, ArcadeDailyResult>>
  > = {};
  for (const id of ARCADE_DAILY_GAME_IDS) {
    const source = id === game ? days : progress.bests[id];
    if (!source) continue;
    const kept = Object.fromEntries(
      Object.entries(source).filter(([d]) => d >= oldestBest)
    );
    if (Object.keys(kept).length > 0) bests[id] = kept;
  }

  const oldestPlayed = shiftDate(today, -(PLAYED_DAYS_KEPT - 1));
  const played = [...new Set([...progress.played, date])]
    .filter((d) => d >= oldestPlayed)
    .sort();
  const { longest } = arcadeDailyStreak(
    { played, longest: progress.longest },
    today
  );
  return { version: 1, bests, played, longest };
}

/** A game's best daily result on a date, or null when it was not played. */
export function arcadeDailyBest(
  progress: ArcadeDailyProgress,
  game: ArcadeDailyGameId,
  date: string
): ArcadeDailyResult | null {
  return progress.bests[game]?.[date] ?? null;
}
