/**
 * The week mode for Patty's Drive-Thru (#2086): five shifts, Monday to
 * Friday, each a different day built from scenario dials and a seed derived
 * from the week's seed. Dignity and SOS carry part of the way from one day
 * into the next, and the week's score is the sum of the days' scores.
 *
 * Everything here is pure and plain data, so a week can be saved between
 * days, loaded back after a reload and replayed day by day from its seed.
 */

import { clamp } from "../../game-utils";
import {
  DEFAULT_SHIFT_CONFIG,
  DILEMMAS,
  METER_START,
  SOLIDARITY_START,
  WEEK_BAD_DAY_PENALTY,
  WEEK_CARRY_FLOOR,
  WEEK_CARRY_RECOVERY,
  WEEK_DAYS,
  type WeekDayPreset,
} from "../presets";
import type {
  DayChoice,
  DilemmaId,
  ShiftConfig,
  ShiftEndingId,
  ShiftOutcome,
  ShiftState,
  StartMeters,
  WeekDayResult,
  WeekState,
  WeekdayId,
} from "../types";
import { BOOTH_CREW, CHOICE_ENDINGS, getShiftEnding } from "./diary";
import {
  dealWeekDilemmas,
  getChoiceEnding,
  getDilemmaDiaryLines,
} from "./dilemmas";
import { computePayStub } from "./engine";
import { scoreShift } from "./view";

const WEEKDAY_IDS: readonly WeekdayId[] = WEEK_DAYS.map((day) => day.id);
const ENDED_OUTCOMES: readonly ShiftOutcome[] = [
  "completed",
  "docked",
  "breakdown",
];

/** Starts an empty week. A missing or empty seed falls back to the default. */
export function createWeek(seed?: string): WeekState {
  return {
    version: 1,
    seed:
      typeof seed === "string" && seed.length > 0
        ? seed
        : `${DEFAULT_SHIFT_CONFIG.seed}-week`,
    days: [],
  };
}

/** True once all five days have been worked. */
export function isWeekOver(week: WeekState): boolean {
  return week.days.length >= WEEK_DAYS.length;
}

/** The next day to work, or null once the week is over. */
export function getWeekDay(week: WeekState): WeekDayPreset | null {
  return WEEK_DAYS[week.days.length] ?? null;
}

/** The seed a day of the week plays with, such as "abc:wednesday". */
export function getWeekDaySeed(weekSeed: string, day: WeekdayId): string {
  return `${weekSeed}:${day}`;
}

/**
 * Where one standing meter starts the next day: `WEEK_CARRY_RECOVERY` of the
 * way back from where it ended toward its usual start, less
 * `WEEK_BAD_DAY_PENALTY` after a breakdown or a docked day, and never below
 * `WEEK_CARRY_FLOOR`, so one bad day makes the next one harder but never
 * loses the week.
 */
function carryOne(
  ended: number,
  start: number,
  outcome: WeekDayResult["outcome"]
): number {
  const safe = Number.isFinite(ended) ? clamp(ended, 0, 100) : start;
  const recovered = safe + (start - safe) * WEEK_CARRY_RECOVERY;
  const penalty = outcome === "completed" ? 0 : WEEK_BAD_DAY_PENALTY;
  return Math.round(clamp(recovered - penalty, WEEK_CARRY_FLOOR, 100));
}

/**
 * The Dignity and SOS the next day starts with, given how the day before
 * ended. With no day before, the usual `METER_START`. The hidden Solidarity
 * value carries whole, since it is who you have been all week rather than
 * how tired you are (#2087); a day saved before it existed passes none on.
 */
export function carryMeters(previous: WeekDayResult | null): StartMeters {
  if (!previous) return { sos: METER_START.sos, dignity: METER_START.dignity };
  const solidarity = previous.endMeters.solidarity;
  return {
    sos: carryOne(previous.endMeters.sos, METER_START.sos, previous.outcome),
    dignity: carryOne(
      previous.endMeters.dignity,
      METER_START.dignity,
      previous.outcome
    ),
    ...(finiteNumber(solidarity)
      ? { solidarity: clamp(solidarity, 0, 100) }
      : {}),
  };
}

/**
 * The shift config for the next day of the week: the day's dials, its
 * rushes, the birthday unlock and the meters carried from the day before.
 * Replaying this config with the day's actions gives the same day exactly.
 * Returns null once the week is over.
 */
export function getWeekDayConfig(
  week: WeekState,
  durationSec: number = DEFAULT_SHIFT_CONFIG.durationSec
): ShiftConfig | null {
  const day = getWeekDay(week);
  if (!day) return null;
  return {
    seed: getWeekDaySeed(week.seed, day.id),
    durationSec,
    ...day.dials,
    ...(day.rushWindows ? { rushWindows: day.rushWindows } : {}),
    ...(day.ageUnlocked ? { ageUnlocked: true } : {}),
    startMeters: carryMeters(week.days.at(-1) ?? null),
    // The week deals each day its own dilemmas, so none repeats (#2139).
    dilemmaDeck: dealWeekDilemmas(week.seed, WEEKDAY_IDS)[week.days.length],
  };
}

/** What a finished shift leaves behind as a day of the week. */
export function summarizeWeekDay(
  day: WeekdayId,
  shift: ShiftState
): WeekDayResult {
  const outcome = shift.outcome === "playing" ? "completed" : shift.outcome;
  return {
    day,
    seed: shift.config.seed,
    outcome,
    score: scoreShift(shift),
    netCents: computePayStub(shift).netCents,
    served: shift.tallies.served,
    late: shift.tallies.late,
    expired: shift.tallies.expired,
    drinksDropped: shift.tallies.drinksDropped,
    yells: shift.tallies.yells,
    endMeters: {
      sos: shift.meters.sos,
      dignity: shift.meters.dignity,
      solidarity: shift.solidarity,
    },
    ending: getShiftEnding(shift).ending,
    choices: shift.dilemmaChoices.map(({ dilemmaId, optionId, timedOut }) => ({
      dilemmaId,
      optionId,
      timedOut,
    })),
  };
}

/**
 * Adds a finished shift to the week as its next day. A shift still playing,
 * or one added after Friday, leaves the week unchanged.
 */
export function recordWeekDay(week: WeekState, shift: ShiftState): WeekState {
  const day = getWeekDay(week);
  if (!day || shift.outcome === "playing") return week;
  return { ...week, days: [...week.days, summarizeWeekDay(day.id, shift)] };
}

/** The week's arcade score: the sum of each day's `scoreShift` result. */
export function scoreWeek(week: WeekState): number {
  return week.days.reduce((sum, day) => sum + day.score, 0);
}

/** The week's take-home pay, in cents. */
export function getWeekNetCents(week: WeekState): number {
  return week.days.reduce((sum, day) => sum + day.netCents, 0);
}

/** How a mid-week day that reached close leans, by its ending (#2139). */
const DAY_LEANS = {
  walkout: `${BOOTH_CREW.coworker} saved me a seat on break. The crew is starting to talk about Friday.`,
  "company-man": `${BOOTH_CREW.manager} nodded at me on the way out. ${BOOTH_CREW.coworker} didn't.`,
} as const;

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * One or two lines for a day's diary page: how the day went, and what made
 * it that day.
 */
export function getWeekDayDiaryLines(result: WeekDayResult): string[] {
  const lines: string[] = [];
  if (result.outcome === "docked") {
    lines.push(
      `Pulled off the window after ${count(result.served, "car", "cars")}. I start tomorrow on the wrong foot.`
    );
  } else if (result.outcome === "breakdown") {
    lines.push(
      `Ended up in the walk-in cooler after ${count(result.served, "car", "cars")}. Tomorrow starts heavier.`
    );
  } else {
    lines.push(
      `Made it to close. ${count(result.served, "car", "cars")}, ${result.late} late, ${result.expired} drove off.`
    );
  }
  switch (result.day) {
    case "tuesday":
      lines.push(
        `The dispenser dropped ${count(result.drinksDropped, "drink", "drinks")}.`
      );
      break;
    case "wednesday":
      lines.push("Two rushes. My feet hurt.");
      break;
    case "thursday":
      lines.push("Eighteen today. I brewed the coffee myself.");
      break;
    case "friday":
      lines.push(
        `${BOOTH_CREW.player}'s fresh fries on Friday. The week is done.`
      );
      break;
    default:
      if (result.yells > 0) {
        lines.push(
          `${BOOTH_CREW.manager} yelled ${count(result.yells, "time", "times")}.`
        );
      }
      break;
  }
  // What the player chose that day, one line per dilemma (#2087).
  lines.push(...getDilemmaDiaryLines(result.choices ?? []));
  // Mid-week, a closed day leans toward an ending rather than reaching one
  // (#2139): the week has only one walkout or promotion, on Friday.
  if (result.outcome === "completed" && result.day !== "friday") {
    const lean = DAY_LEANS[result.ending as keyof typeof DAY_LEANS];
    if (lean) lines.push(lean);
  }
  return lines;
}

/**
 * How the week ends (#2087): from the Solidarity and Dignity Friday ended
 * with, as a shift at close would. A bad Friday does not decide the week, so
 * the meter failures are not endings here. A week saved before Solidarity
 * existed reads from the usual starting value.
 */
export function getWeekEnding(week: WeekState): {
  readonly ending: Extract<
    ShiftEndingId,
    "company-man" | "silent-exit" | "walkout"
  >;
  readonly title: string;
  readonly summary: string;
} {
  const last = week.days.at(-1);
  const ending = getChoiceEnding(
    last?.endMeters.solidarity ?? SOLIDARITY_START,
    last?.endMeters.dignity ?? METER_START.dignity
  );
  return { ending, ...WEEK_ENDINGS[ending] };
}

const WEEK_ENDINGS: Readonly<
  Record<
    "company-man" | "silent-exit" | "walkout",
    { readonly title: string; readonly summary: string }
  >
> = {
  "company-man": {
    title: CHOICE_ENDINGS["company-man"].title,
    summary: `${BOOTH_CREW.manager} put me up for shift lead. I took it. Nobody on the crew asked me to hang out after.`,
  },
  "silent-exit": {
    title: CHOICE_ENDINGS["silent-exit"].title,
    summary:
      "I put in my two weeks on Friday and nobody made a thing of it. I kept my head down to the end.",
  },
  walkout: {
    title: CHOICE_ENDINGS.walkout.title,
    summary: `On Friday night the whole crew walked out at close. ${BOOTH_CREW.generalManager} came in on Saturday to listen.`,
  },
};

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDay(value: unknown, index: number): WeekDayResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.day !== WEEKDAY_IDS[index]) return null;
  if (typeof raw.seed !== "string") return null;
  if (!ENDED_OUTCOMES.includes(raw.outcome as ShiftOutcome)) return null;
  const numbers = [
    "score",
    "netCents",
    "served",
    "late",
    "expired",
    "drinksDropped",
    "yells",
  ] as const;
  if (!numbers.every((key) => finiteNumber(raw[key]))) return null;
  const meters = raw.endMeters as Record<string, unknown> | null | undefined;
  if (!meters || !finiteNumber(meters.sos) || !finiteNumber(meters.dignity))
    return null;
  // Saves from before #2087 have no Solidarity, ending or choices; they load
  // without them. A value that is there but malformed is dropped.
  const ending = ENDING_IDS.includes(raw.ending as ShiftEndingId)
    ? (raw.ending as ShiftEndingId)
    : undefined;
  const choices = parseChoices(raw.choices);
  return {
    day: WEEKDAY_IDS[index],
    seed: raw.seed,
    outcome: raw.outcome as WeekDayResult["outcome"],
    score: Math.max(0, raw.score as number),
    netCents: raw.netCents as number,
    served: raw.served as number,
    late: raw.late as number,
    expired: raw.expired as number,
    drinksDropped: raw.drinksDropped as number,
    yells: raw.yells as number,
    endMeters: {
      sos: clamp(meters.sos, 0, 100),
      dignity: clamp(meters.dignity, 0, 100),
      ...(finiteNumber(meters.solidarity)
        ? { solidarity: clamp(meters.solidarity, 0, 100) }
        : {}),
    },
    ...(ending ? { ending } : {}),
    ...(choices ? { choices } : {}),
  };
}

const ENDING_IDS: readonly ShiftEndingId[] = [
  "docked",
  "breakdown",
  "company-man",
  "silent-exit",
  "walkout",
];

/** A saved day's dilemma answers, keeping only ones that name a real answer. */
function parseChoices(value: unknown): DayChoice[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const choices: DayChoice[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { dilemmaId, optionId, timedOut } = entry as Record<string, unknown>;
    if (typeof dilemmaId !== "string" || !Object.hasOwn(DILEMMAS, dilemmaId))
      continue;
    const dilemma = DILEMMAS[dilemmaId as DilemmaId];
    if (!dilemma.options.some((option) => option.id === optionId)) continue;
    choices.push({
      dilemmaId: dilemmaId as DilemmaId,
      optionId: optionId as string,
      timedOut: timedOut === true,
    });
  }
  return choices;
}

/**
 * Reads a saved week back, from the parsed JSON of a save. Anything that is
 * not a valid week (an unknown version, days out of order, a missing field)
 * returns null, so a broken save starts a fresh week rather than a broken
 * one.
 */
export function parseWeekSave(value: unknown): WeekState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;
  if (typeof raw.seed !== "string" || raw.seed.length === 0) return null;
  if (!Array.isArray(raw.days) || raw.days.length > WEEK_DAYS.length)
    return null;
  const days: WeekDayResult[] = [];
  for (const [index, entry] of raw.days.entries()) {
    const day = parseDay(entry, index);
    if (!day) return null;
    days.push(day);
  }
  return { version: 1, seed: raw.seed, days };
}
