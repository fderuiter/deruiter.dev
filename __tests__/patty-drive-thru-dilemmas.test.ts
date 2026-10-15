import { describe, expect, it } from "vitest";
import {
  DILEMMAS,
  DILEMMA_IDS,
  DILEMMA_WINDOW_LONG_SEC,
  DILEMMA_WINDOW_SEC,
  SOLIDARITY_START,
  TILL_SHORT_PER_EXPIRED_CENTS,
  applyAction,
  carryMeters,
  computePayStub,
  createShift,
  createWeek,
  getChoiceEnding,
  getDilemmaDiaryLines,
  getDilemmaPlan,
  getShiftEnding,
  getWeekDayConfig,
  getWeekDayDiaryLines,
  getWeekEnding,
  parseWeekSave,
  recordWeekDay,
  replayShift,
  stepShift,
  summarizeWeekDay,
  type DilemmaId,
  type ShiftAction,
  type ShiftConfig,
  type ShiftEvent,
  type ShiftState,
  type WeekDayResult,
} from "@/lib/patty-drive-thru";

const STEP = 0.25;

/**
 * A full three-minute shift that cannot fail on its meters: expired cars
 * cost nothing and the player wipes every three seconds, so only the
 * dilemmas move SOS, Dignity and Solidarity.
 */
const SAFE: Partial<ShiftConfig> = {
  seed: "dilemma-1",
  durationSec: 180,
  sosLossExpired: 0,
};

/** A shift nobody plays that still reaches close: no yells, no lost cars. */
const CALM: Partial<ShiftConfig> = { ...SAFE, idleRatePerSec: 0 };

/** Steps until a dilemma is open, failing rather than looping forever. */
function untilOpen(start: ShiftState, events: ShiftEvent[] = []): ShiftState {
  let state = start;
  while (!state.dilemma) {
    if (state.outcome !== "playing") throw new Error("shift ended first");
    const result = stepShift(state, STEP);
    state = result.state;
    events.push(...result.events);
  }
  return state;
}

type Picker = (id: DilemmaId) => string | null;

interface Played {
  state: ShiftState;
  events: ShiftEvent[];
  timeline: { at: number; action: ShiftAction }[];
}

/** Plays a shift headless, answering each dilemma with `pick` (null waits). */
function play(config: Partial<ShiftConfig>, pick: Picker): Played {
  let state = createShift(config);
  const events: ShiftEvent[] = [];
  const timeline: Played["timeline"] = [];
  const doAction = (action: ShiftAction) => {
    const result = applyAction(state, action);
    if (result.state !== state) timeline.push({ at: state.time, action });
    state = result.state;
    events.push(...result.events);
  };
  while (state.outcome === "playing") {
    const result = stepShift(state, STEP);
    state = result.state;
    events.push(...result.events);
    if (state.outcome !== "playing") break;
    if (state.dilemma) {
      const optionId = pick(state.dilemma.dilemmaId);
      if (optionId) doAction({ type: "chooseDilemma", optionId });
    }
    if (state.time >= state.wipeReadyAt) doAction({ type: "wipe" });
  }
  return { state, events, timeline };
}

/** The answer that stands with the crew for each dilemma. */
const WITH_CREW = sideOf((a, b) => a > b);

/** The answer that sides with management for each dilemma. */
const WITH_MANAGEMENT = sideOf((a, b) => a < b);

/** Each dilemma's option whose Solidarity wins the comparison. */
function sideOf(
  better: (a: number, b: number) => boolean
): Record<DilemmaId, string> {
  return Object.fromEntries(
    Object.values(DILEMMAS).map((dilemma) => {
      const [first, second] = dilemma.options;
      const pick = better(first.solidarity, second.solidarity) ? first : second;
      return [dilemma.id, pick.id];
    })
  ) as Record<DilemmaId, string>;
}

describe("the dilemma plan (#2087)", () => {
  it("puts three different dilemmas into a standard shift, in order, each closing before the end", () => {
    const plan = getDilemmaPlan({ seed: "plan", durationSec: 180 });
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((slot) => slot.dilemmaId)).size).toBe(3);
    for (const slot of plan) {
      expect(DILEMMA_IDS).toContain(slot.dilemmaId);
      expect(slot.at + DILEMMA_WINDOW_SEC).toBeLessThan(180);
    }
    expect(plan.map((s) => s.at)).toEqual(
      [...plan.map((s) => s.at)].sort((a, b) => a - b)
    );
  });

  it("is drawn from the seed alone", () => {
    expect(getDilemmaPlan({ seed: "same", durationSec: 180 })).toEqual(
      getDilemmaPlan({ seed: "same", durationSec: 180 })
    );
    const plans = new Set(
      Array.from({ length: 12 }, (_, i) =>
        JSON.stringify(getDilemmaPlan({ seed: `seed-${i}`, durationSec: 180 }))
      )
    );
    expect(plans.size).toBeGreaterThan(1);
  });

  it("gives short shifts fewer dilemmas and test shifts none", () => {
    expect(getDilemmaPlan({ seed: "s", durationSec: 10 })).toEqual([]);
    expect(getDilemmaPlan({ seed: "s", durationSec: 60 })).toHaveLength(1);
    expect(getDilemmaPlan({ seed: "s", durationSec: 0 })).toEqual([]);
  });

  it("keeps the longer window inside the shift too", () => {
    const plan = getDilemmaPlan({
      seed: "long",
      durationSec: 60,
      dilemmaWindowSec: 30,
    });
    expect(plan[0].at + 30).toBeLessThan(60);
  });
});

describe("dilemmas in the shift (#2087)", () => {
  it("leaves the order stream exactly as it was", () => {
    let short = createShift({ seed: "orders", durationSec: 180 });
    let long = createShift({
      seed: "orders",
      durationSec: 180,
      dilemmaWindowSec: 30,
    });
    for (let i = 0; i < 400; i++) {
      short = stepShift(short, STEP).state;
      long = stepShift(long, STEP).state;
    }
    expect(long.orders).toEqual(short.orders);
    expect(long.draws).toBe(short.draws);
  });

  it("starts with no dilemma and the usual Solidarity, and clamps the window", () => {
    const state = createShift({ seed: "s" });
    expect(state.solidarity).toBe(SOLIDARITY_START);
    expect(state.dilemma).toBeNull();
    expect(state.dilemmaChoices).toEqual([]);
    expect(createShift({ dilemmaWindowSec: 999 }).config.dilemmaWindowSec).toBe(
      30
    );
    expect(
      createShift({ dilemmaWindowSec: Number.NaN }).config.dilemmaWindowSec
    ).toBeUndefined();
  });

  it("offers each dilemma at its time and keeps the orders coming while it is open", () => {
    const config = { ...CALM, seed: "open" };
    const [first] = getDilemmaPlan(createShift(config).config);
    const offered: ShiftEvent[] = [];
    let state = untilOpen(createShift(config), offered);
    expect(offered).toContainEqual({
      type: "dilemma-offered",
      dilemmaId: first.dilemmaId,
    });
    expect(state.time).toBeGreaterThanOrEqual(first.at);
    expect(state.dilemma).toMatchObject({
      dilemmaId: first.dilemmaId,
      closesAt: state.time + DILEMMA_WINDOW_SEC,
    });

    // The booth runs on while the question is open.
    const ordersBefore = state.nextOrderId;
    const during: ShiftEvent[] = [];
    while (state.dilemma && state.outcome === "playing") {
      const result = stepShift(state, STEP);
      state = result.state;
      during.push(...result.events);
    }
    expect(state.nextOrderId).toBeGreaterThan(ordersBefore);
    expect(during.some((e) => e.type === "order-arrived")).toBe(true);
    // Nobody answered, so the default was taken.
    expect(during).toContainEqual({
      type: "dilemma-resolved",
      dilemmaId: first.dilemmaId,
      optionId: DILEMMAS[first.dilemmaId].defaultOptionId,
      timedOut: true,
    });
    expect(state.dilemmaChoices).toHaveLength(1);
    expect(state.dilemmaChoices[0].timedOut).toBe(true);
  });

  it("applies an answer's meters and Solidarity, and ignores answers that do not fit", () => {
    let state = createShift({ ...CALM, seed: "answer" });
    expect(
      applyAction(state, { type: "chooseDilemma", optionId: "serve" }).state
    ).toBe(state);
    state = untilOpen(state);
    const dilemma = DILEMMAS[state.dilemma!.dilemmaId];
    expect(
      applyAction(state, { type: "chooseDilemma", optionId: "nonsense" }).state
    ).toBe(state);

    const option = dilemma.options[1];
    const result = applyAction(state, {
      type: "chooseDilemma",
      optionId: option.id,
    });
    expect(result.events).toContainEqual({
      type: "dilemma-resolved",
      dilemmaId: dilemma.id,
      optionId: option.id,
      timedOut: false,
    });
    expect(result.state.dilemma).toBeNull();
    expect(result.state.solidarity).toBe(SOLIDARITY_START + option.solidarity);
    expect(result.state.meters.dignity).toBe(
      Math.min(100, Math.max(0, state.meters.dignity + option.dignity))
    );
    expect(result.state.meters.sos).toBe(
      Math.min(100, Math.max(0, state.meters.sos + option.sos))
    );
    expect(result.state.dilemmaChoices).toEqual([
      {
        dilemmaId: dilemma.id,
        optionId: option.id,
        at: state.time,
        timedOut: false,
      },
    ]);
  });

  it("replays the same seed and answers to the same shift", () => {
    const played = play({ ...SAFE, seed: "replay" }, (id) => WITH_CREW[id]);
    const replayed = replayShift({ ...SAFE, seed: "replay" }, played.timeline);
    // Step the replay to close, as the live run did.
    let state = replayed;
    while (state.outcome === "playing") state = stepShift(state, STEP).state;
    expect(state.dilemmaChoices).toEqual(played.state.dilemmaChoices);
    expect(state.solidarity).toBe(played.state.solidarity);
    expect(state.meters).toEqual(played.state.meters);
  });

  it("takes a covered till out of the pay stub", () => {
    const base = createShift({ seed: "pay" });
    const covered = {
      ...base,
      dilemmaChoices: [
        {
          dilemmaId: "short-till" as const,
          optionId: "cover",
          at: 40,
          timedOut: false,
        },
      ],
      tallies: { ...base.tallies, expired: 1 },
    };
    expect(computePayStub(covered).tillShortCents).toBe(
      800 + TILL_SHORT_PER_EXPIRED_CENTS
    );
  });
});

describe("endings by choice (#2087)", () => {
  it("reaches the Walkout by standing with the crew", () => {
    for (const seed of ["walk-1", "walk-2", "walk-3"]) {
      const { state } = play({ ...SAFE, seed }, (id) => WITH_CREW[id]);
      expect(state.outcome).toBe("completed");
      expect(state.dilemmaChoices).toHaveLength(3);
      expect(getShiftEnding(state)).toMatchObject({
        outcome: "completed",
        ending: "walkout",
        title: "Walkout",
      });
    }
  });

  it("reaches the Company Man by siding with management", () => {
    for (const seed of ["co-1", "co-2", "co-3"]) {
      const { state } = play({ ...SAFE, seed }, (id) => WITH_MANAGEMENT[id]);
      expect(state.outcome).toBe("completed");
      expect(getShiftEnding(state)).toMatchObject({
        ending: "company-man",
        title: "Company man",
      });
    }
  });

  it("reaches the Silent Exit by never answering", () => {
    for (const seed of ["quiet-1", "quiet-2", "quiet-3", "quiet-4"]) {
      const { state } = play({ ...SAFE, seed }, () => null);
      expect(state.dilemmaChoices.every((c) => c.timedOut)).toBe(true);
      expect(getShiftEnding(state).ending).toBe("silent-exit");
    }
  });

  it("lets meter failures win over any choice", () => {
    const state = { ...createShift({ seed: "fail" }), solidarity: 100 };
    expect(getShiftEnding({ ...state, outcome: "docked" }).ending).toBe(
      "docked"
    );
    expect(getShiftEnding({ ...state, outcome: "breakdown" }).ending).toBe(
      "breakdown"
    );
  });

  it("needs Dignity left for a walkout", () => {
    expect(getChoiceEnding(90, 50)).toBe("walkout");
    expect(getChoiceEnding(90, 10)).toBe("silent-exit");
    expect(getChoiceEnding(30, 90)).toBe("company-man");
    expect(getChoiceEnding(50, 50)).toBe("silent-exit");
  });

  it("writes one diary line per answer", () => {
    const { state } = play({ ...SAFE, seed: "diary" }, (id) =>
      id === "stale-fries" ? null : WITH_CREW[id]
    );
    const lines = getDilemmaDiaryLines(state.dilemmaChoices);
    expect(lines).toHaveLength(3);
    for (const choice of state.dilemmaChoices) {
      const dilemma = DILEMMAS[choice.dilemmaId];
      const option = dilemma.options.find((o) => o.id === choice.optionId)!;
      expect(lines).toContain(
        choice.timedOut ? dilemma.timeoutDiary : option.diary
      );
    }
    expect(
      getDilemmaDiaryLines([
        { dilemmaId: "toString" as DilemmaId, optionId: "x", timedOut: false },
      ])
    ).toEqual([]);
  });
});

describe("dilemmas in the week (#2087)", () => {
  it("keeps the day's answers, ending and Solidarity, and carries Solidarity into the next day", () => {
    const week = createWeek("wk");
    const config = { ...getWeekDayConfig(week)!, sosLossExpired: 0 };
    const { state } = play(config, (id) => WITH_CREW[id]);
    const result = summarizeWeekDay("monday", state);
    expect(result.ending).toBe("walkout");
    expect(result.choices).toHaveLength(3);
    expect(result.endMeters.solidarity).toBe(state.solidarity);

    const next = recordWeekDay(week, state);
    const tuesday = getWeekDayConfig(next)!;
    expect(tuesday.startMeters?.solidarity).toBe(state.solidarity);
    expect(createShift(tuesday).solidarity).toBe(state.solidarity);

    const lines = getWeekDayDiaryLines(result);
    for (const line of getDilemmaDiaryLines(state.dilemmaChoices))
      expect(lines).toContain(line);
    expect(getWeekEnding(next).ending).toBe("walkout");
  });

  it("loads a week saved before dilemmas and drops malformed answers", () => {
    const old: WeekDayResult = {
      day: "monday",
      seed: "old:monday",
      outcome: "completed",
      score: 120,
      netCents: 2000,
      served: 9,
      late: 1,
      expired: 0,
      drinksDropped: 2,
      yells: 0,
      endMeters: { sos: 70, dignity: 60 },
    };
    const parsed = parseWeekSave(
      JSON.parse(JSON.stringify({ version: 1, seed: "old", days: [old] }))
    );
    expect(parsed?.days[0]).toEqual(old);
    expect(carryMeters(parsed!.days[0])).toEqual({ sos: 75, dignity: 65 });
    expect(createShift(getWeekDayConfig(parsed!)!).solidarity).toBe(
      SOLIDARITY_START
    );
    expect(getWeekEnding(parsed!).ending).toBe("silent-exit");
    expect(getWeekDayDiaryLines(parsed!.days[0])).toHaveLength(1);

    const withJunk = parseWeekSave({
      version: 1,
      seed: "new",
      days: [
        {
          ...old,
          ending: "nonsense",
          endMeters: { sos: 70, dignity: 60, solidarity: 250 },
          choices: [
            { dilemmaId: "short-till", optionId: "cover", timedOut: false },
            { dilemmaId: "__proto__", optionId: "x" },
            { dilemmaId: "stale-fries", optionId: "eat-them" },
            null,
          ],
        },
      ],
    });
    expect(withJunk?.days[0].ending).toBeUndefined();
    expect(withJunk?.days[0].endMeters.solidarity).toBe(100);
    expect(withJunk?.days[0].choices).toEqual([
      { dilemmaId: "short-till", optionId: "cover", timedOut: false },
    ]);
  });

  it("gives every day of the week its own dilemmas, with the longer window when asked", () => {
    let week = createWeek("plans");
    const plans: string[] = [];
    for (let day = 0; day < 5; day++) {
      const config = getWeekDayConfig(week)!;
      plans.push(JSON.stringify(getDilemmaPlan(config)));
      const long = createShift({
        ...config,
        dilemmaWindowSec: DILEMMA_WINDOW_LONG_SEC,
      });
      expect(long.config.dilemmaWindowSec).toBe(DILEMMA_WINDOW_LONG_SEC);
      let state = createShift(config);
      while (state.outcome === "playing") state = stepShift(state, 0.5).state;
      week = recordWeekDay(week, state);
    }
    expect(new Set(plans).size).toBeGreaterThan(1);
    expect(week.days.every((day) => day.ending !== undefined)).toBe(true);
  });
});
