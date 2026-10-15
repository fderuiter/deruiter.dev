/**
 * Badges and run history for Monkey C Mayhem (#2021).
 *
 * - Every run that ends goes into the history: its day, mode, finish time or
 *   DNF, distance, best Training Effect and Kudos. The last
 *   {@link HISTORY_SIZE} runs are kept.
 * - Badges are earned once and kept in a badge case. Most are judged when a
 *   run ends; Rep Max Slayer and Never Skip Leg Day are noted during the run
 *   by {@link stepBadgeRun}, which runs after each engine step so the
 *   standalone engine bundle stays unchanged.
 * - A day counts toward the Daily Workout Streak when any run is finished on
 *   it: the 5K, a race or a Training Plan workout.
 *
 * Everything here is pure; lib/garmin-badge-store.ts keeps the save.
 */

import { PX_PER_METER, STAGE_COUNT } from "./garmin-course";
import { GROUND_Y, type BadgeRun, type GameEngineState } from "./garmin-engine";
import { REPMAX_SCORE } from "./garmin-foes";
import {
  formatRaceTime,
  isNegativeSplit,
  judgeRace,
  localDay,
  raceOutcomeOf,
} from "./garmin-race";

export type { BadgeRun };

/** The badges, in the order the badge case lists them. */
export const BADGE_IDS = [
  "first5k",
  "sub5",
  "negsplit",
  "repmax",
  "allkudos",
  "nogear",
  "streak3",
  "streak7",
  "couch",
  "legday",
] as const;

/** A badge's id. */
export type BadgeId = (typeof BADGE_IDS)[number];

/** A badge's name, and how it is earned. */
export interface BadgeInfo {
  name: string;
  rule: string;
}

/** Every badge's name and rule. */
export const BADGES: Readonly<Record<BadgeId, BadgeInfo>> = {
  first5k: { name: "First 5K", rule: "Finish the 5K." },
  sub5: {
    name: "Sub-5 Minute Race",
    rule: "Finish a race in Race Mode in under 5:00 with a time that counts.",
  },
  negsplit: {
    name: "Negative Splitter",
    rule: "Finish the 5K with every lap faster than the one before it.",
  },
  repmax: { name: "Rep Max Slayer", rule: "Beat a Rep Max." },
  allkudos: {
    name: "All Kudos",
    rule: "Finish a race in Race Mode without missing a Kudos.",
  },
  nogear: {
    name: "No Gear Finisher",
    rule: "Finish a race in Race Mode without taking any gear.",
  },
  streak3: {
    name: "Daily Workout Streak: 3 Days",
    rule: "Finish a run on 3 days in a row.",
  },
  streak7: {
    name: "Daily Workout Streak: 7 Days",
    rule: "Finish a run on 7 days in a row.",
  },
  couch: {
    name: "Couch to 5K",
    rule: "Finish the 5K on a day you already took a DNF.",
  },
  legday: {
    name: "Never Skip Leg Day",
    rule: "Clear a stage without sprinting.",
  },
};

/**
 * Badges that match an arcade trophy's milestone: earning the badge records
 * the milestone too (lib/arcade-achievements.ts).
 */
export const BADGE_MILESTONES: Readonly<Partial<Record<BadgeId, string>>> = {
  first5k: "run_complete",
};

/** Runs the history keeps, newest first. */
export const HISTORY_SIZE = 20;

/** The modes a run is recorded under. */
export type HistoryMode = "training" | "race" | "plan";

/** Each mode's name, as the history shows it. */
export const HISTORY_MODE_NAMES: Readonly<Record<HistoryMode, string>> = {
  training: "Training",
  race: "Race",
  plan: "Training Plan",
};

/** One run in the history. */
export interface RunEntry {
  /** The local day the run ended, as `YYYY-MM-DD`. */
  day: string;
  mode: HistoryMode;
  /** The run reached its finish: the 5K, or a Training Plan workout. */
  finished: boolean;
  /** Run clock at the end, in ms. */
  timeMs: number;
  /** Whole metres run. */
  meters: number;
  /** Best Training Effect of a stage cleared, or null. */
  te: number | null;
  kudos: number;
}

/** The days in a row with a finished run. */
export interface Streak {
  /** The last day with a finished run, or null before the first. */
  lastDay: string | null;
  /** Days in a row ending on `lastDay`. */
  days: number;
}

/** Everything kept between runs. */
export interface BadgeSave {
  /** The last runs, newest first. */
  runs: RunEntry[];
  /** Each badge earned, and the day it was earned. */
  badges: Partial<Record<BadgeId, string>>;
  streak: Streak;
  /** The last day a run ended in a DNF, for Couch to 5K. */
  lastDnfDay: string | null;
}

/** A save with no runs and no badges. */
export function newBadgeSave(): BadgeSave {
  return {
    runs: [],
    badges: {},
    streak: { lastDay: null, days: 0 },
    lastDnfDay: null,
  };
}

/** Whether `value` is a badge id. */
export function isBadgeId(value: unknown): value is BadgeId {
  return BADGE_IDS.some((id) => id === value);
}

/** Days since the epoch of a `YYYY-MM-DD` day, or null if it is not one. */
function dayNumber(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Reject days that roll over, e.g. 2026-02-30.
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(ms / 86_400_000);
}

/**
 * Whole calendar days from `from` to `to` (both `YYYY-MM-DD`), or null if
 * either is not a day. Counted on calendar dates, so a clock change or a
 * month end never moves it.
 */
export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

/** Whether `value` is a real `YYYY-MM-DD` day. */
export function isDay(value: unknown): value is string {
  return typeof value === "string" && dayNumber(value) !== null;
}

/** The streak after a run is finished on `day`. */
export function streakAfter(streak: Streak, day: string): Streak {
  const gap = streak.lastDay === null ? null : daysBetween(streak.lastDay, day);
  if (gap === 0) return { lastDay: day, days: Math.max(1, streak.days) };
  if (gap === 1) return { lastDay: day, days: streak.days + 1 };
  // A first run, a missed day, or a clock set back starts over.
  return { lastDay: day, days: 1 };
}

/** What a run that has just ended did, read from its final state. */
export interface RunFacts {
  mode: HistoryMode;
  /** The run reached its finish. */
  finished: boolean;
  timeMs: number;
  meters: number;
  kudos: number;
  te: number | null;
  lapSplits: readonly number[];
  /** A race in Race Mode finished with a time that counts. */
  raceTimed: boolean;
  /** Kudos a race left on the lane. */
  kudosMissed: number;
  /** A race took gear. */
  gearTaken: boolean;
  repMax: boolean;
  legDay: boolean;
}

/** The facts of the run `state` ended. */
export function runFactsOf(state: GameEngineState): RunFacts {
  const mode: HistoryMode = state.plan
    ? "plan"
    : state.race
      ? "race"
      : "training";
  const finished = state.gameState === "summary";
  const outcome = raceOutcomeOf(state);
  const run = state.badgeRun;
  return {
    mode,
    finished,
    timeMs: Math.max(0, state.runClockMs ?? 0),
    meters: Math.max(0, Math.round(state.distanceMeters)),
    kudos: state.kudos ?? 0,
    te: run?.peakTe ?? null,
    lapSplits: outcome.lapSplits,
    raceTimed:
      mode === "race" &&
      !!state.race &&
      judgeRace(state.race.category, outcome).result === "time",
    kudosMissed: outcome.kudosMissed,
    gearTaken: outcome.gearTaken,
    repMax: run?.repMax ?? false,
    legDay: run?.legDay ?? false,
  };
}

/** Five minutes, the Sub-5 Minute Race's limit. */
export const SUB5_MS = 5 * 60_000;

/** The badges `facts` meet on `day`, given the save before this run. */
export function badgesMet(
  facts: RunFacts,
  save: BadgeSave,
  day: string
): BadgeId[] {
  const full5k = facts.finished && facts.mode !== "plan";
  const race = full5k && facts.mode === "race";
  const streak = facts.finished ? streakAfter(save.streak, day).days : 0;
  const met: Record<BadgeId, boolean> = {
    first5k: full5k,
    sub5: race && facts.raceTimed && facts.timeMs < SUB5_MS,
    negsplit:
      full5k &&
      facts.lapSplits.length >= STAGE_COUNT &&
      isNegativeSplit(facts.lapSplits),
    repmax: facts.repMax,
    allkudos: race && facts.kudosMissed === 0,
    nogear: race && !facts.gearTaken,
    streak3: streak >= 3,
    streak7: streak >= 7,
    couch: full5k && save.lastDnfDay === day,
    legday: facts.legDay,
  };
  return BADGE_IDS.filter((id) => met[id]);
}

/** A run recorded: the new save and the badges earned for the first time. */
export interface RunRecorded {
  save: BadgeSave;
  earned: BadgeId[];
}

/** Records the run `facts` describes, ended at `date`. */
export function recordRun(
  save: BadgeSave,
  facts: RunFacts,
  date: Date
): RunRecorded {
  const day = localDay(date);
  const earned = badgesMet(facts, save, day).filter((id) => !save.badges[id]);
  const badges = { ...save.badges };
  for (const id of earned) badges[id] = day;
  const entry: RunEntry = {
    day,
    mode: facts.mode,
    finished: facts.finished,
    timeMs: facts.timeMs,
    meters: facts.meters,
    te: facts.te,
    kudos: facts.kudos,
  };
  return {
    save: {
      runs: [entry, ...save.runs].slice(0, HISTORY_SIZE),
      badges,
      streak: facts.finished ? streakAfter(save.streak, day) : save.streak,
      lastDnfDay: facts.finished ? save.lastDnfDay : day,
    },
    earned,
  };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** A `YYYY-MM-DD` day as the history shows it, e.g. "Oct 15, 2026". */
export function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m || !isDay(day)) return day;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** A run's result: its finish time, or "DNF". */
export function runResult(entry: RunEntry): string {
  return entry.finished ? formatRaceTime(entry.timeMs) : "DNF";
}

/** A toast for a badge, e.g. "BADGE EARNED · FIRST 5K". */
export function badgeToast(id: BadgeId): string {
  return `BADGE EARNED · ${BADGES[id].name.toUpperCase()}`;
}

/** What a screen reader hears about badges just earned, or "" for none. */
export function badgeNews(earned: readonly BadgeId[]): string {
  if (earned.length === 0) return "";
  const names = earned.map((id) => BADGES[id].name).join(", ");
  return earned.length === 1
    ? `Badge earned: ${names}.`
    : `${earned.length} badges earned: ${names}.`;
}

/** A run's tracking at the start: nothing done yet. */
export function newBadgeRun(): BadgeRun {
  return { sprinted: false, legDay: false, repMax: false, peakTe: null };
}

/**
 * A Rep Max was beaten on this step: one on the face is gone as its points
 * are paid. A Rep Max also leaves when it falls behind the camera or into a
 * gap, when a bonus room is entered or left, and with its stage, so those
 * never count.
 */
function beatRepMax(prev: GameEngineState, next: GameEngineState): boolean {
  if (next.score - prev.score < REPMAX_SCORE) return false;
  if (!!next.bonusRoom !== !!prev.bonusRoom) return false;
  const cameraX = prev.distanceMeters * PX_PER_METER;
  const kept = new Set((next.foes ?? []).map((f) => f.id));
  return (prev.foes ?? []).some(
    (f) =>
      f.kind === "repmax" &&
      !kept.has(f.id) &&
      f.x + f.width >= cameraX &&
      f.y <= GROUND_Y
  );
}

/**
 * The in-run badges at work after each engine step: sprinting on a stage,
 * a stage cleared without it, a Rep Max beaten, and the best Training
 * Effect. Does nothing unless the run started with `badgeRun` set.
 */
export function stepBadgeRun(
  prev: GameEngineState,
  next: GameEngineState
): GameEngineState {
  const run = next.badgeRun;
  if (!run) return next;
  let { sprinted, legDay, repMax, peakTe } = run;
  // Sprint held is a sprint, unless a bonk or Race Day's steady pace holds
  // the runner to a jog.
  if (next.runInput === 1 && !next.bodyBattery?.bonked && !next.plan?.raceDay) {
    sprinted = true;
  }
  // A pole grab adds a lap split: the stage is cleared.
  const cleared = (next.lapSplits?.length ?? 0) > (prev.lapSplits?.length ?? 0);
  if (cleared) {
    if (!sprinted) legDay = true;
    sprinted = false;
  }
  // A cleared stage takes its foes away with it, so that step never counts.
  if (!cleared && beatRepMax(prev, next)) repMax = true;
  const te = next.lastTrainingEffect;
  if (
    te !== undefined &&
    te !== prev.lastTrainingEffect &&
    Number.isFinite(te)
  ) {
    peakTe = peakTe === null ? te : Math.max(peakTe, te);
  }
  if (
    sprinted === run.sprinted &&
    legDay === run.legDay &&
    repMax === run.repMax &&
    peakTe === run.peakTe
  ) {
    return next;
  }
  return { ...next, badgeRun: { sprinted, legDay, repMax, peakTe } };
}
