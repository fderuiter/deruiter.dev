// @vitest-environment node
// Patty's Drive-Thru 10/10 re-audit, second pass: the shift ramps up to a
// dinner rush (#2138), and a week deals its dilemmas without repeats, with
// rush calls and mid-week day pages that fit the day (#2139).
import { describe, expect, it } from "vitest";
import {
  ARRIVAL_GAP_MIN_SEC,
  CLOSING_RUSH,
  DILEMMAS,
  DILEMMA_IDS,
  EVENT_CAPTIONS,
  SHIFT_RAMP,
  STANDARD_RUSH,
  WEEK_DAYS,
  WEEK_DAY_DILEMMAS,
  applyAction,
  createShift,
  createWeek,
  dealWeekDilemmas,
  getDilemmaPlan,
  getRushCaption,
  getRushWindows,
  getShiftRamp,
  getWeekDayConfig,
  getWeekDayDiaryLines,
  scenarioDialsFor,
  stepShift,
  type ShiftState,
  type WeekDayResult,
} from "@/lib/patty-drive-thru";
import { createBoothStore } from "@/components/patty-drive-thru/store";

/** Arrival times of a shift nobody serves, while under the open-order cap. */
function arrivalTimes(shift: ShiftState, seconds: number): number[] {
  let state = shift;
  const times: number[] = [];
  for (let t = 0; t < seconds && state.outcome === "playing"; t += 0.25) {
    // Bump nothing; drop the oldest order so the cap never stops arrivals.
    if (state.orders.length >= 5) state = { ...state, orders: [] };
    const step = stepShift(state, 0.25);
    state = step.state;
    for (const event of step.events)
      if (event.type === "order-arrived") times.push(state.time);
  }
  return times;
}

const CALM = { idleRatePerSec: 0, sosLossExpired: 0, durationSec: 180 };

describe("the shift ramp (#2138)", () => {
  it("shrinks the arrival gap steadily from clock-in to close", () => {
    expect(getShiftRamp(0, 180)).toBe(1);
    expect(getShiftRamp(90, 180)).toBeCloseTo(1 - SHIFT_RAMP / 2);
    expect(getShiftRamp(180, 180)).toBeCloseTo(1 - SHIFT_RAMP);
    expect(getShiftRamp(500, 180)).toBeCloseTo(1 - SHIFT_RAMP);
  });

  it("closes a standard shift on a dinner rush after the lunch rush", () => {
    expect(getRushWindows(createShift({}).config)).toEqual([
      STANDARD_RUSH,
      CLOSING_RUSH,
    ]);
  });

  it("brings more cars in the last third of a shift than the first", () => {
    let early = 0;
    let late = 0;
    for (const seed of ["ramp-1", "ramp-2", "ramp-3", "ramp-4", "ramp-5"]) {
      const times = arrivalTimes(createShift({ seed, ...CALM }), 180);
      early += times.filter((t) => t < 60).length;
      late += times.filter((t) => t >= 120).length;
    }
    expect(late).toBeGreaterThan(early);
  });

  it("keeps a practice scenario's own gaps exactly, with no ramp or rush", () => {
    const dials = scenarioDialsFor("lunchRush");
    const config = createShift({ seed: "own", ...dials, ...CALM }).config;
    expect(getRushWindows(config)).toEqual([]);
    const times = arrivalTimes(createShift(config), 180);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    // Every gap is at least the scenario's minimum, less one step of slack.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(
      (dials.arrivalGapMinSec ?? ARRIVAL_GAP_MIN_SEC) - 0.25
    );
  });
});

describe("dilemmas that can reach every ending (#2139)", () => {
  it.each(Object.keys(DILEMMAS))(
    "%s has an answer for the crew and one for management",
    (id) => {
      const values = DILEMMAS[id as keyof typeof DILEMMAS].options.map(
        (option) => option.solidarity
      );
      expect(Math.max(...values)).toBeGreaterThanOrEqual(10);
      expect(Math.min(...values)).toBeLessThanOrEqual(-10);
    }
  );

  it("moves Solidarity only for an answer, never for the clock", () => {
    let shift = createShift({ seed: "quiet", ...CALM });
    const plan = getDilemmaPlan(shift.config);
    while (shift.outcome === "playing" && shift.time < plan[0].at + 20)
      shift = stepShift(shift, 0.5).state;
    expect(shift.dilemmaChoices[0]?.timedOut).toBe(true);
    expect(shift.solidarity).toBe(50);
  });

  it("keeps the day's own dilemmas out of a single shift", () => {
    for (const id of Object.values(WEEK_DAY_DILEMMAS))
      expect(DILEMMA_IDS).not.toContain(id);
  });
});

const days = WEEK_DAYS.map((day) => day.id);

describe("a week of dilemmas (#2139)", () => {
  it("deals three a day and never repeats one in a week", () => {
    for (const seed of ["w-1", "w-2", "w-3"]) {
      const decks = dealWeekDilemmas(seed, days);
      expect(decks.map((deck) => deck.length)).toEqual([3, 3, 3, 3, 3]);
      const all = decks.flat();
      expect(new Set(all).size).toBe(all.length);
      expect(decks[3]).toContain(WEEK_DAY_DILEMMAS.thursday);
      expect(decks[4]).toContain(WEEK_DAY_DILEMMAS.friday);
    }
  });

  it("puts each day's deal into that day's shift", () => {
    let week = createWeek("deal");
    const decks = dealWeekDilemmas("deal", days);
    for (let index = 0; index < days.length; index += 1) {
      const config = getWeekDayConfig(week, 180)!;
      expect(getDilemmaPlan(config).map((slot) => slot.dilemmaId)).toEqual(
        decks[index]
      );
      const result: WeekDayResult = {
        day: days[index],
        seed: config.seed,
        outcome: "completed",
        score: 0,
        netCents: 0,
        served: 0,
        late: 0,
        expired: 0,
        drinksDropped: 0,
        yells: 0,
        endMeters: { sos: 80, dignity: 70, solidarity: 50 },
        ending: "silent-exit",
        choices: [],
      };
      week = { ...week, days: [...week.days, result] };
    }
  });

  it("ignores a deck of unknown ids rather than inventing dilemmas", () => {
    const config = createShift({
      seed: "x",
      dilemmaDeck: ["nope", 4, "fry-box"] as never,
    }).config;
    expect(config.dilemmaDeck).toEqual(["fry-box"]);
  });

  it("answers a dealt dilemma like any other", () => {
    let shift = createShift({ seed: "fry", ...CALM, dilemmaDeck: ["fry-box"] });
    while (!shift.dilemma && shift.outcome === "playing")
      shift = stepShift(shift, 0.5).state;
    expect(shift.dilemma?.dilemmaId).toBe("fry-box");
    shift = applyAction(shift, {
      type: "chooseDilemma",
      optionId: "sneak",
    }).state;
    expect(shift.solidarity).toBe(60);
  });
});

describe("rush calls and mid-week pages (#2139)", () => {
  it("calls each rush for what it is", () => {
    const standard = [STANDARD_RUSH, CLOSING_RUSH];
    expect(getRushCaption(standard, 0)).toBe(EVENT_CAPTIONS.rushStarted);
    expect(getRushCaption(standard, 1)).toBe(EVENT_CAPTIONS.rushClosing);
    const wednesday = WEEK_DAYS[2].rushWindows!;
    expect(getRushCaption(wednesday, 1, "wednesday")).toBe(
      EVENT_CAPTIONS.rushSchool
    );
    const friday = WEEK_DAYS[4].rushWindows!;
    expect(getRushCaption(friday, 0, "friday")).toBe(EVENT_CAPTIONS.rushFriday);
    expect(getRushCaption(friday, 1, "friday")).toBe(
      EVENT_CAPTIONS.rushClosing
    );
  });

  it("leans toward an ending mid-week instead of reaching one", () => {
    const base: WeekDayResult = {
      day: "monday",
      seed: "s",
      outcome: "completed",
      score: 0,
      netCents: 0,
      served: 3,
      late: 0,
      expired: 0,
      drinksDropped: 0,
      yells: 0,
      endMeters: { sos: 80, dignity: 70, solidarity: 80 },
      ending: "walkout",
      choices: [],
    };
    expect(getWeekDayDiaryLines(base).join(" ")).toMatch(/talk about Friday/);
    const company = getWeekDayDiaryLines({ ...base, ending: "company-man" });
    expect(company.join(" ")).toMatch(/nodded at me/);
    const friday = getWeekDayDiaryLines({ ...base, day: "friday" });
    expect(friday.join(" ")).not.toMatch(/talk about Friday/);
  });

  it("has Bo call Fry Friday in the booth on the week's last day", () => {
    const done = (day: (typeof days)[number]): WeekDayResult => ({
      day,
      seed: day,
      outcome: "completed",
      score: 0,
      netCents: 0,
      served: 0,
      late: 0,
      expired: 0,
      drinksDropped: 0,
      yells: 0,
      endMeters: { sos: 80, dignity: 70, solidarity: 50 },
      ending: "silent-exit",
      choices: [],
    });
    const week = {
      ...createWeek("fry"),
      days: days.slice(0, 4).map(done),
    };
    const store = createBoothStore();
    store.getState().clockInWeek({ week });
    const calls: string[] = [];
    store.getState().onEvents((events) => {
      if (events.some((event) => event.type === "rush-started"))
        calls.push(store.getState().caption?.text ?? "");
    });
    // A week day keeps its own idle rate, so keep busy until the rush.
    for (let i = 0; i < 400 && calls.length === 0; i += 1) {
      if (i % 10 === 0) store.getState().act({ type: "wipe" });
      store.getState().tick(0.5);
    }
    expect(calls[0]).toBe(EVENT_CAPTIONS.rushFriday);
  });
});
