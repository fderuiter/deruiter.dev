// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  METER_START,
  POS_MENU,
  RUSH_GAP_SCALE,
  WEEK_BAD_DAY_PENALTY,
  WEEK_CARRY_FLOOR,
  WEEK_DAYS,
  applyAction,
  carryMeters,
  createShift,
  createWeek,
  getArrivalGapScale,
  getKdsTickets,
  getWeekDay,
  getWeekDayConfig,
  getWeekDayDiaryLines,
  getWeekDaySeed,
  getWeekNetCents,
  isAgeLocked,
  isOrderReady,
  isShiftOver,
  isStandardScenario,
  isWeekOver,
  parseWeekSave,
  recordWeekDay,
  replayShift,
  scoreShift,
  scoreWeek,
  stepShift,
  summarizeWeekDay,
  type ShiftAction,
  type ShiftConfig,
  type ShiftEvent,
  type ShiftState,
  type WeekDayResult,
  type WeekState,
} from "@/lib/patty-drive-thru";

type Timeline = { at: number; action: ShiftAction }[];

/** The POS path to each item's leaf, from the home screen. */
function pathTo(nodeId: string): string[] {
  const walk = (node: typeof POS_MENU, trail: string[]): string[] | null => {
    for (const child of node.children ?? []) {
      const next = [...trail, child.id];
      if (child.id === nodeId) return next;
      const found = walk(child, next);
      if (found) return found;
    }
    return null;
  };
  return walk(POS_MENU, []) ?? [];
}

/**
 * The next action a steady player would take: pick the oldest order, ring
 * its next line, re-enter dropped drinks, flag the coworker for coffee they
 * cannot brew, and bump it when it is done. With `tryLocked`, rings coffee
 * without flagging first, to show where the lockout bites.
 */
function nextAction(state: ShiftState, tryLocked: boolean): ShiftAction | null {
  const order = state.orders[0];
  if (!order) return { type: "wipe" };
  if (state.pos.activeOrderId !== order.id)
    return { type: "selectOrder", orderId: order.id };
  if (isOrderReady(order)) return { type: "bump", orderId: order.id };
  if (order.items.some((it) => it.dropped))
    return { type: "reenterDrink", orderId: order.id };
  const pending = order.items.find((it) => it.rung && !it.modifierDone);
  let target: string | null = pending ? "no-pickles" : null;
  if (!target) {
    const item = order.items.find((it) => !it.rung);
    if (!item) return null;
    if (isAgeLocked(item.itemId, state.config) && !tryLocked) {
      if (order.coworkerReadyAt === null)
        return { type: "flagCoworker", orderId: order.id };
      if (state.time < order.coworkerReadyAt) return null;
    }
    target = item.itemId;
  }
  const path = pathTo(target);
  const depth = state.pos.path.length;
  const onPath = state.pos.path.every((id, i) => path[i] === id);
  if (!onPath) return { type: "posHome" };
  return { type: "posTap", nodeId: path[depth] };
}

/** Plays a whole shift with the bot, a move every 0.6 s; returns the timeline. */
function playShift(
  config: Partial<ShiftConfig>,
  tryLocked = false
): { state: ShiftState; timeline: Timeline; events: ShiftEvent[] } {
  let state = createShift(config);
  const timeline: Timeline = [];
  const events: ShiftEvent[] = [];
  let guard = 0;
  while (!isShiftOver(state) && guard++ < 5000) {
    const stepped = stepShift(state, 0.6);
    state = stepped.state;
    events.push(...stepped.events);
    if (isShiftOver(state)) break;
    const action = nextAction(state, tryLocked);
    if (!action) continue;
    const acted = applyAction(state, action);
    if (acted.state !== state) {
      timeline.push({ at: state.time, action });
      events.push(...acted.events);
      state = acted.state;
    }
  }
  return { state, timeline, events };
}

function count(events: readonly ShiftEvent[], type: ShiftEvent["type"]) {
  return events.filter((e) => e.type === type).length;
}

function dayConfig(day: number, seed = "week-test"): ShiftConfig {
  let week = createWeek(seed);
  for (let i = 0; i < day; i++) {
    const config = getWeekDayConfig(week)!;
    week = recordWeekDay(week, playShift(config).state);
  }
  return getWeekDayConfig(week)!;
}

function result(overrides: Partial<WeekDayResult> = {}): WeekDayResult {
  return {
    day: "monday",
    seed: "s:monday",
    outcome: "completed",
    score: 100,
    netCents: 1000,
    served: 10,
    late: 1,
    expired: 0,
    drinksDropped: 2,
    yells: 0,
    endMeters: { sos: 100, dignity: 90 },
    ...overrides,
  };
}

describe("week mode days (#2086)", () => {
  it("has five days, Monday to Friday, each with its own seed", () => {
    expect(WEEK_DAYS.map((d) => d.id)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]);
    const week = createWeek("abc");
    expect(getWeekDayConfig(week)?.seed).toBe(getWeekDaySeed("abc", "monday"));
    expect(getWeekDaySeed("abc", "friday")).toBe("abc:friday");
  });

  it("gives Wednesday two rushes and Monday one", () => {
    const monday = playShift(dayConfig(0));
    const wednesday = playShift(dayConfig(2));
    expect(count(monday.events, "rush-started")).toBe(1);
    expect(count(wednesday.events, "rush-started")).toBe(2);
  });

  it("drops more drinks on Tuesday than on Monday", () => {
    let monday = 0;
    let tuesday = 0;
    for (const seed of ["a", "b", "c", "d"]) {
      const mondayConfig = { ...dayConfig(0, seed), startMeters: undefined };
      const tuesdayConfig = { ...dayConfig(1, seed), startMeters: undefined };
      // Same arrivals, so only the dispenser differs.
      monday += playShift({ ...mondayConfig, seed }).state.tallies
        .drinksDropped;
      tuesday += playShift({ ...tuesdayConfig, seed }).state.tallies
        .drinksDropped;
    }
    expect(tuesday).toBeGreaterThan(monday);
  });

  it("lifts the coffee lockout on Thursday and keeps it lifted Friday", () => {
    expect(dayConfig(2).ageUnlocked).toBeUndefined();
    expect(dayConfig(3).ageUnlocked).toBe(true);
    expect(dayConfig(4).ageUnlocked).toBe(true);
    expect(isAgeLocked("coffee")).toBe(true);
    expect(isAgeLocked("coffee", { ageUnlocked: true })).toBe(false);

    const seed = "coffee-check";
    const wednesday = playShift({ ...dayConfig(2), seed }, true);
    const thursday = playShift({ ...dayConfig(3), seed }, true);
    expect(wednesday.state.tallies.lockedAttempts).toBeGreaterThan(0);
    expect(thursday.state.tallies.lockedAttempts).toBe(0);
    expect(count(thursday.events, "locked")).toBe(0);
  });

  it("shows no coffee as locked on the kitchen display on Thursday", () => {
    let state = createShift({ ...dayConfig(3), seed: "kds" });
    let guard = 0;
    while (
      !state.orders.some((o) => o.items.some((i) => i.itemId === "coffee")) &&
      guard++ < 400
    ) {
      state = stepShift(state, 0.5).state;
    }
    const tickets = getKdsTickets(state);
    expect(tickets.some((t) => t.needsCoworker)).toBe(false);
    expect(
      tickets.flatMap((t) => t.lines).some((l) => l.status === "locked")
    ).toBe(false);
  });

  it("makes Friday the busiest day", () => {
    const monday = playShift(dayConfig(0));
    const friday = playShift(dayConfig(4));
    expect(count(friday.events, "order-arrived")).toBeGreaterThan(
      count(monday.events, "order-arrived")
    );
  });

  it("does not count a week day as a standard shift", () => {
    for (let day = 0; day < 5; day++) {
      expect(isStandardScenario(dayConfig(day))).toBe(false);
    }
  });
});

describe("week mode replay (#2086)", () => {
  it("replays every day of a week exactly from its seed and actions", () => {
    let week = createWeek("replay-week");
    let replayed = createWeek("replay-week");
    while (!isWeekOver(week)) {
      const config = getWeekDayConfig(week)!;
      const played = playShift(config);
      const again = replayShift(getWeekDayConfig(replayed)!, played.timeline);
      // Run the clock out after the last action, as the booth does.
      let finished = again;
      while (!isShiftOver(finished)) finished = stepShift(finished, 0.5).state;
      expect(finished.tallies).toEqual(played.state.tallies);
      expect(finished.meters).toEqual(played.state.meters);
      expect(scoreShift(finished)).toBe(scoreShift(played.state));
      week = recordWeekDay(week, played.state);
      replayed = recordWeekDay(replayed, finished);
    }
    expect(replayed).toEqual(week);
    expect(scoreWeek(week)).toBeGreaterThan(0);
  });
});

describe("week meter carry-over (#2086)", () => {
  it("starts Monday from METER_START", () => {
    expect(carryMeters(null)).toEqual({
      sos: METER_START.sos,
      dignity: METER_START.dignity,
    });
    expect(createShift(getWeekDayConfig(createWeek("m"))!).meters).toEqual(
      METER_START
    );
  });

  it("carries a good day halfway back toward the usual start", () => {
    expect(
      carryMeters(result({ endMeters: { sos: 100, dignity: 90 } }))
    ).toEqual({ sos: 90, dignity: 80 });
    expect(
      carryMeters(result({ endMeters: { sos: 40, dignity: 30 } }))
    ).toEqual({ sos: 60, dignity: 50 });
  });

  it("starts the day after a breakdown or docked day worse, never lost", () => {
    const breakdown = carryMeters(
      result({ outcome: "breakdown", endMeters: { sos: 70, dignity: 0 } })
    );
    expect(breakdown.dignity).toBe(
      Math.max(WEEK_CARRY_FLOOR, METER_START.dignity / 2 - WEEK_BAD_DAY_PENALTY)
    );
    expect(breakdown.sos).toBe(75 - WEEK_BAD_DAY_PENALTY);
    const docked = carryMeters(
      result({ outcome: "docked", endMeters: { sos: 0, dignity: 50 } })
    );
    expect(docked.sos).toBe(METER_START.sos / 2 - WEEK_BAD_DAY_PENALTY);
    expect(docked.sos).toBeGreaterThanOrEqual(WEEK_CARRY_FLOOR);
    expect(docked.sos).toBeLessThan(METER_START.sos);
  });

  it("starts the next shift from the carried meters", () => {
    let week = createWeek("carry");
    week = { ...week, days: [result({ endMeters: { sos: 20, dignity: 10 } })] };
    const config = getWeekDayConfig(week)!;
    expect(config.startMeters).toEqual({ sos: 50, dignity: 40 });
    const shift = createShift(config);
    expect(shift.meters).toEqual({ sos: 50, dignity: 40, idle: 0 });
  });

  it("holds carried meters between 1 and 100 and ignores bad input", () => {
    expect(
      createShift({ startMeters: { sos: -5, dignity: 500 } }).meters
    ).toEqual({ sos: 1, dignity: 100, idle: 0 });
    const garbage = createShift({
      startMeters: { sos: Number.NaN, dignity: 3 },
      rushWindows: "nope" as never,
      ageUnlocked: "yes" as never,
    });
    expect(garbage.meters).toEqual(METER_START);
    expect(garbage.config.rushWindows).toBeUndefined();
    expect(garbage.config.ageUnlocked).toBeUndefined();
    expect(
      createShift({
        rushWindows: [
          [0.5, 0.2],
          [-1, 0.3],
          [0.4, Number.POSITIVE_INFINITY],
        ],
      }).config.rushWindows
    ).toEqual([[0, 0.3]]);
  });

  it("scales arrival gaps only inside the given rushes", () => {
    const windows = [
      [0.1, 0.2],
      [0.5, 0.6],
    ] as const;
    expect(getArrivalGapScale(15, 100, windows)).toBe(RUSH_GAP_SCALE);
    expect(getArrivalGapScale(30, 100, windows)).toBe(1);
    expect(getArrivalGapScale(55, 100, windows)).toBe(RUSH_GAP_SCALE);
    expect(getArrivalGapScale(55, 100, [])).toBe(1);
  });
});

describe("week bookkeeping (#2086)", () => {
  it("adds finished shifts as days and sums their scores", () => {
    let week = createWeek("sum");
    const scores: number[] = [];
    const net: number[] = [];
    while (!isWeekOver(week)) {
      const shift = playShift(getWeekDayConfig(week)!).state;
      scores.push(scoreShift(shift));
      net.push(summarizeWeekDay("monday", shift).netCents);
      week = recordWeekDay(week, shift);
    }
    expect(week.days).toHaveLength(5);
    expect(scoreWeek(week)).toBe(scores.reduce((a, b) => a + b, 0));
    expect(getWeekNetCents(week)).toBe(net.reduce((a, b) => a + b, 0));
    expect(getWeekDay(week)).toBeNull();
    expect(getWeekDayConfig(week)).toBeNull();
    // Nothing is added after Friday.
    expect(recordWeekDay(week, createShift({ durationSec: 10 }))).toBe(week);
  });

  it("ignores a shift that is still playing", () => {
    const week = createWeek("x");
    expect(recordWeekDay(week, createShift())).toBe(week);
  });

  it("falls back to a default seed", () => {
    expect(createWeek("").seed.length).toBeGreaterThan(0);
    expect(createWeek().days).toEqual([]);
  });

  it("writes a diary line or two for every kind of day", () => {
    for (const day of WEEK_DAYS) {
      for (const outcome of ["completed", "docked", "breakdown"] as const) {
        const lines = getWeekDayDiaryLines(
          result({ day: day.id, outcome, yells: 2 })
        );
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(2);
      }
    }
    expect(getWeekDayDiaryLines(result({ day: "thursday" })).join(" ")).toMatch(
      /Eighteen/
    );
    expect(
      getWeekDayDiaryLines(result({ day: "tuesday", drinksDropped: 1 })).join(
        " "
      )
    ).toMatch(/1 drink\b/);
  });
});

describe("week saves (#2086)", () => {
  const saved: WeekState = {
    version: 1,
    seed: "saved",
    days: [result(), result({ day: "tuesday", seed: "saved:tuesday" })],
  };

  it("round-trips through JSON", () => {
    expect(parseWeekSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("rejects anything that is not a valid week", () => {
    expect(parseWeekSave(null)).toBeNull();
    expect(parseWeekSave("week")).toBeNull();
    expect(parseWeekSave({ ...saved, version: 2 })).toBeNull();
    expect(parseWeekSave({ ...saved, seed: "" })).toBeNull();
    expect(parseWeekSave({ ...saved, days: "x" })).toBeNull();
    expect(
      parseWeekSave({ ...saved, days: [result({ day: "tuesday" })] })
    ).toBeNull();
    expect(
      parseWeekSave({ ...saved, days: [{ ...result(), outcome: "playing" }] })
    ).toBeNull();
    expect(
      parseWeekSave({ ...saved, days: [{ ...result(), score: "1" }] })
    ).toBeNull();
    expect(
      parseWeekSave({ ...saved, days: [{ ...result(), endMeters: null }] })
    ).toBeNull();
    expect(
      parseWeekSave({
        ...saved,
        days: [...saved.days, ...saved.days, result()],
      })
    ).toBeNull();
  });

  it("resumes a half-finished week at its next day", () => {
    const week = parseWeekSave(JSON.parse(JSON.stringify(saved)))!;
    expect(getWeekDay(week)?.id).toBe("wednesday");
    expect(getWeekDayConfig(week)?.seed).toBe("saved:wednesday");
  });
});
