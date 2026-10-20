/**
 * Race Mode for Monkey C Mayhem (#2019): seeded race courses, categories,
 * the fixed simulation step, a local top-5 leaderboard and share text.
 *
 * A Training Run lays a random course every time. A race runs the same
 * course every attempt, so times can be compared:
 *
 * - Saturday 5K: a fixed seed that never changes.
 * - Daily Workout: the seed is today's local date, so it changes at midnight.
 *
 * This module is pure. The engine imports only its types; the leaderboard's
 * storage lives in `lib/garmin/race-store.ts`, away from the standalone
 * watch bundle.
 */

/**
 * The race courses. Race Day is the Training Plan's last workout (#1994): it
 * keeps its own board, and is entered from the map rather than picked.
 */
export type RaceCourse = "saturday5k" | "daily" | "raceday";

/** The race categories, picked before the start. */
export type RaceCategory =
  "any" | "allkudos" | "nogear" | "negsplit" | "allmedals";

/** Every course the race picker offers, in picker order. */
export const RACE_COURSES: readonly RaceCourse[] = ["saturday5k", "daily"];

/** Every category, in picker order. */
export const RACE_CATEGORIES: readonly RaceCategory[] = [
  "any",
  "allkudos",
  "nogear",
  "negsplit",
  "allmedals",
];

/** Display names of the courses. */
export const RACE_COURSE_NAMES: Record<RaceCourse, string> = {
  saturday5k: "Saturday 5K",
  daily: "Daily Workout",
  raceday: "Race Day",
};

/** Display names of the categories, and the rule each one sets. */
export const RACE_CATEGORY_INFO: Record<
  RaceCategory,
  { name: string; short: string; rule: string }
> = {
  any: { name: "5K Any%", short: "ANY%", rule: "Finish as fast as you can." },
  allkudos: {
    name: "All Kudos",
    short: "ALL KUDOS",
    rule: "Collect every Kudos on the lane.",
  },
  nogear: {
    name: "No Gear",
    short: "NO GEAR",
    rule: "Finish at Base: no power-ups, Runner's High or training buddy. Sync Blocks pay Kudos instead.",
  },
  negsplit: {
    name: "Negative Split",
    short: "NEG SPLIT",
    rule: "Every lap must beat the lap before it.",
  },
  allmedals: {
    name: "All Medals",
    short: "ALL MEDALS",
    rule: "Find all 15 Finisher Medals.",
  },
};

/** The Saturday 5K's seed. It never changes. */
export const SATURDAY_SEED = 5_205_000;

/**
 * The version of the course generator. Bump it when a change moves anything
 * on a seeded course, so old times are kept on their own board instead of
 * being compared with a different course.
 */
export const COURSE_VERSION = 2;

/**
 * The coach's time on the Saturday 5K (#2022): the balance pass's best
 * playtest run of the course, sprinting the whole way through three bonks.
 * Beating it is the race's stretch goal.
 */
export const COACH_SATURDAY_MS = 317_430;

/** The simulation step a race runs at, in ms. */
export const FIXED_STEP_MS = 1000 / 60;

/** At most this many fixed steps run in one frame, so a stall can't spiral. */
export const MAX_STEPS_PER_FRAME = 5;

/** How many results a board keeps. */
export const BOARD_SIZE = 5;

/** A race as the engine runs it. */
export interface RaceSetup {
  course: RaceCourse;
  category: RaceCategory;
  /** The course seed: {@link SATURDAY_SEED}, or {@link dailySeed} for the day. */
  seed: number;
}

/** The local calendar day of `date`, as `YYYY-MM-DD`. */
export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * The Daily Workout seed for `date`: a hash of its local calendar day, so it
 * is the same all day and changes at local midnight. Never the Saturday seed.
 */
export function dailySeed(date: Date): number {
  const day = localDay(date);
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  }
  const seed = (h >>> 0) % 1_000_000_000;
  return seed === SATURDAY_SEED ? seed + 1 : seed;
}

/** The race for `course` and `category` on `date`. */
export function raceSetup(
  course: RaceCourse,
  category: RaceCategory,
  date: Date
): RaceSetup {
  return {
    course,
    category,
    seed: course === "saturday5k" ? SATURDAY_SEED : dailySeed(date),
  };
}

/**
 * Splits a frame's `deltaMs` into fixed steps. Returns how many
 * {@link FIXED_STEP_MS} steps to run and the time carried to the next frame.
 * A frame never runs more than {@link MAX_STEPS_PER_FRAME}; the excess is
 * dropped, not carried, so a long stall can't run the race on its own.
 */
export function fixedSteps(
  carryMs: number,
  deltaMs: number
): { steps: number; carryMs: number } {
  const dt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  const carry = Number.isFinite(carryMs) ? Math.max(0, carryMs) : 0;
  let total = carry + dt;
  // Snap float residue, so 60 frames of 1000 / 60 ms make 60 steps.
  let steps = Math.floor(total / FIXED_STEP_MS + 1e-9);
  total = Math.max(0, total - steps * FIXED_STEP_MS);
  if (steps > MAX_STEPS_PER_FRAME) {
    steps = MAX_STEPS_PER_FRAME;
    total = 0;
  }
  return { steps, carryMs: total < 1e-6 ? 0 : total };
}

/** What a finished (or abandoned) race needs to be judged. */
export interface RaceOutcome {
  /** The 5K was finished. */
  finished: boolean;
  /** Run clock at the end, in ms. */
  timeMs: number;
  /** Lap splits, in ms. */
  lapSplits: readonly number[];
  /** Free lane Kudos that went by uncollected. */
  kudosMissed: number;
  /** Any power-up, gear or the training buddy was taken. */
  gearTaken: boolean;
  /** Finisher Medals found. */
  medalsFound: number;
}

/**
 * The race outcome of a run, built from its engine state. A run that reached
 * the summary finished; any other end is a DNF.
 */
export function raceOutcomeOf(state: {
  gameState: string;
  runClockMs?: number;
  lapSplits?: readonly number[];
  kudosMissed?: number;
  gearTaken?: boolean;
  medalsFound?: readonly number[];
}): RaceOutcome {
  return {
    finished: state.gameState === "summary",
    timeMs: state.runClockMs ?? 0,
    lapSplits: state.lapSplits ?? [],
    kudosMissed: state.kudosMissed ?? 0,
    gearTaken: state.gearTaken ?? false,
    medalsFound: (state.medalsFound ?? []).length,
  };
}

/** The medals a full run holds (5 stages of 3). */
export const ALL_MEDALS = 15;

/** A judged race: a time that counts, or a DNF / DNQ with its reason. */
export interface RaceVerdict {
  result: "time" | "dnf" | "dnq";
  /** Why it is a DNF or DNQ, in a few words; empty for a time. */
  reason: string;
}

/** True when every lap is faster than the one before it. */
export function isNegativeSplit(lapSplits: readonly number[]): boolean {
  if (lapSplits.length < 2) return false;
  for (let i = 1; i < lapSplits.length; i++) {
    if (!(lapSplits[i] < lapSplits[i - 1])) return false;
  }
  return true;
}

/** Judges `outcome` against the rule of `category`. */
export function judgeRace(
  category: RaceCategory,
  outcome: RaceOutcome
): RaceVerdict {
  if (!outcome.finished) return { result: "dnf", reason: "did not finish" };
  if (category === "allkudos" && outcome.kudosMissed > 0) {
    return { result: "dnq", reason: `${outcome.kudosMissed} Kudos missed` };
  }
  if (category === "nogear" && outcome.gearTaken) {
    return { result: "dnq", reason: "gear taken" };
  }
  if (category === "negsplit" && !isNegativeSplit(outcome.lapSplits)) {
    return { result: "dnq", reason: "a lap was slower" };
  }
  if (category === "allmedals" && outcome.medalsFound < ALL_MEDALS) {
    return {
      result: "dnq",
      reason: `${outcome.medalsFound} of ${ALL_MEDALS} medals`,
    };
  }
  return { result: "time", reason: "" };
}

/** One leaderboard result. */
export interface BoardEntry {
  timeMs: number;
  /** When it was run, as an ISO timestamp. */
  at: string;
  /** The seed it was run on (the Daily seed changes every day). */
  seed: number;
  /** {@link COURSE_VERSION} when it was run. */
  version: number;
}

/** The key of a board: one per course and category. */
export function boardKey(course: RaceCourse, category: RaceCategory): string {
  return `${course}:${category}`;
}

/**
 * The entries of `board` that still count for `seed` at the current
 * {@link COURSE_VERSION}: an older version or another day's Daily seed is a
 * different course, so it starts a fresh board.
 */
export function liveEntries(
  board: readonly BoardEntry[],
  seed: number
): BoardEntry[] {
  return board.filter((e) => e.version === COURSE_VERSION && e.seed === seed);
}

/**
 * Adds `entry` to `board` (after {@link liveEntries}), fastest first, capped
 * at {@link BOARD_SIZE}. Returns the new board and the entry's place (1-based),
 * or 0 when it did not make the board.
 */
export function insertResult(
  board: readonly BoardEntry[],
  entry: BoardEntry
): { board: BoardEntry[]; place: number } {
  const live = liveEntries(board, entry.seed);
  const next = [...live, entry].sort((a, b) => a.timeMs - b.timeMs);
  const capped = next.slice(0, BOARD_SIZE);
  const place = capped.indexOf(entry) + 1;
  return { board: capped, place };
}

/** `m:ss.cc` for a race time. */
export function formatRaceTime(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const cs = Math.floor(safe / 10);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/**
 * The plain-text result a player can share, e.g.
 * `Monkey C Mayhem · Saturday 5K · Any% · 4:12.33 · negative split`.
 */
export function shareText(
  setup: RaceSetup,
  verdict: RaceVerdict,
  outcome: RaceOutcome,
  date: Date
): string {
  const parts = [
    "Monkey C Mayhem",
    setup.course === "daily"
      ? `${RACE_COURSE_NAMES.daily} ${localDay(date)}`
      : RACE_COURSE_NAMES[setup.course],
    RACE_CATEGORY_INFO[setup.category].name.replace("5K ", ""),
    verdict.result === "time"
      ? formatRaceTime(outcome.timeMs)
      : `${verdict.result.toUpperCase()} (${verdict.reason})`,
  ];
  if (verdict.result === "time" && isNegativeSplit(outcome.lapSplits)) {
    parts.push("negative split");
  }
  return parts.join(" · ");
}
