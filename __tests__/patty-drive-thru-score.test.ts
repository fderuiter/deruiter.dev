// @vitest-environment node
// The skill score (#2057): fast bumps, the clean-order streak and the Dignity
// kept to close all add to the points per car, so a fast, clean shift beats
// a sloppy one by a clear margin.
import { describe, it, expect } from "vitest";
import {
  applyAction,
  createShift,
  describeShiftScore,
  getShiftScoreBreakdown,
  scoreShift,
  SCORE_COMPLETED_BONUS,
  SCORE_DIGNITY_PER_POINT,
  SCORE_FAST_BUMP_BONUS,
  SCORE_LATE_PENALTY,
  SCORE_PER_SERVED,
  SCORE_STREAK_MAX_LINKS,
  SCORE_STREAK_STEP,
  type MenuItemId,
  type Order,
  type ShiftAction,
  type ShiftState,
} from "@/lib/patty-drive-thru";

function makeOrder(id: number, arrivedAt: number, items: MenuItemId[]): Order {
  return {
    id,
    arrivedAt,
    coworkerReadyAt: null,
    items: items.map((itemId) => ({
      itemId,
      modifier: null,
      rung: false,
      modifierDone: true,
      dropped: false,
    })),
  };
}

/**
 * A long shift at `time` holding only the given orders, with arrivals pushed
 * out of the way.
 */
function withOrders(orders: Order[], time = 0): ShiftState {
  return {
    ...createShift({ seed: "score", durationSec: 3600 }),
    time,
    lastActionAt: time,
    orders,
    nextArrivalAt: 1_000,
  };
}

function run(state: ShiftState, actions: ShiftAction[]): ShiftState {
  return actions.reduce((s, action) => applyAction(s, action).state, state);
}

/** Rings fries on order `id` and bumps it, optionally after a wrong tap. */
function serveFries(id: number, wrongFirst = false): ShiftAction[] {
  return [
    { type: "selectOrder", orderId: id },
    ...(wrongFirst
      ? ([
          { type: "posTap", nodeId: "sides" },
          { type: "posTap", nodeId: "nuggets" },
        ] as ShiftAction[])
      : []),
    { type: "posTap", nodeId: "sides" },
    { type: "posTap", nodeId: "fries" },
    { type: "bump", orderId: id },
  ];
}

/**
 * Serves orders one to `count` (each holding fries) at `ageSec` old, with a
 * wrong tap before each when `sloppy`, and closes the shift.
 */
function shiftOf(count: number, ageSec: number, sloppy: boolean): ShiftState {
  let state = withOrders([], 0);
  for (let id = 1; id <= count; id += 1) {
    const at = id * 60;
    state = {
      ...state,
      time: at,
      lastActionAt: at,
      orders: [makeOrder(id, at - ageSec, ["fries"])],
    };
    state = run(state, serveFries(id, sloppy));
  }
  return { ...state, outcome: "completed" };
}

describe("fast-bump bonus (#2057)", () => {
  it("counts an order bumped while its ticket is green", () => {
    const green = run(withOrders([makeOrder(1, 0, ["fries"])], 10), [
      ...serveFries(1),
    ]);
    expect(green.tallies.fastBumps).toBe(1);
    expect(getShiftScoreBreakdown(green).speed).toBe(SCORE_FAST_BUMP_BONUS);
  });

  it.each([40, 60])("pays nothing extra at %i seconds old", (age) => {
    const slow = run(withOrders([makeOrder(1, 0, ["fries"])], age), [
      ...serveFries(1),
    ]);
    expect(slow.tallies.served).toBe(1);
    expect(slow.tallies.fastBumps).toBe(0);
    expect(getShiftScoreBreakdown(slow).speed).toBe(0);
  });
});

describe("clean-order streak (#2057)", () => {
  const three = () =>
    withOrders(
      [
        makeOrder(1, 0, ["fries"]),
        makeOrder(2, 0, ["fries"]),
        makeOrder(3, 0, ["fries"]),
      ],
      5
    );

  it("grows with each clean order and pays per earlier link", () => {
    const state = run(three(), [
      ...serveFries(1),
      ...serveFries(2),
      ...serveFries(3),
    ]);
    expect(state.tallies.cleanStreak).toBe(3);
    expect(state.tallies.bestStreak).toBe(3);
    // The first order starts the streak, the second earns one link, the third two.
    expect(state.tallies.streakPoints).toBe(SCORE_STREAK_STEP * (0 + 1 + 2));
    expect(getShiftScoreBreakdown(state).streak).toBe(SCORE_STREAK_STEP * 3);
  });

  it("resets on a wrong ring-up", () => {
    const state = run(three(), [
      ...serveFries(1),
      ...serveFries(2),
      ...serveFries(3, true),
    ]);
    expect(state.tallies.wrongEntries).toBe(1);
    expect(state.tallies.cleanStreak).toBe(1);
    expect(state.tallies.bestStreak).toBe(2);
    expect(state.tallies.streakPoints).toBe(SCORE_STREAK_STEP);
  });

  it("resets when an unfinished order is bumped", () => {
    const state = run(three(), [
      ...serveFries(1),
      { type: "bump", orderId: 2 },
    ]);
    expect(state.tallies.cleanStreak).toBe(0);
    expect(state.tallies.bestStreak).toBe(1);
  });

  it("survives a re-entered drink, which the dispenser forced", () => {
    const soda = makeOrder(2, 0, ["soda"]);
    const dropped: Order = {
      ...soda,
      items: [{ ...soda.items[0], rung: true, dropped: true }],
    };
    const before = run(
      withOrders([makeOrder(1, 0, ["fries"]), dropped], 5),
      serveFries(1)
    );
    expect(before.tallies.cleanStreak).toBe(1);
    const after = run(before, [
      { type: "reenterDrink", orderId: 2 },
      { type: "bump", orderId: 2 },
    ]);
    expect(after.tallies.cleanStreak).toBe(2);
    expect(after.tallies.bestStreak).toBe(2);
    expect(after.tallies.streakPoints).toBe(SCORE_STREAK_STEP);
  });

  it("caps what a single order can earn", () => {
    const long = shiftOf(SCORE_STREAK_MAX_LINKS + 5, 5, false);
    const links = Array.from({ length: SCORE_STREAK_MAX_LINKS + 5 }, (_, i) =>
      Math.min(i, SCORE_STREAK_MAX_LINKS)
    ).reduce((a, b) => a + b, 0);
    expect(long.tallies.streakPoints).toBe(SCORE_STREAK_STEP * links);
  });
});

describe("Dignity bonus at close (#2057)", () => {
  it("scales with the Dignity left when the shift reaches close", () => {
    const state = createShift({ seed: "score" });
    const high = {
      ...state,
      outcome: "completed",
      meters: { ...state.meters, dignity: 70 },
    } as ShiftState;
    const low = { ...high, meters: { ...high.meters, dignity: 20 } };
    expect(getShiftScoreBreakdown(high).dignity).toBe(
      70 * SCORE_DIGNITY_PER_POINT
    );
    expect(getShiftScoreBreakdown(low).dignity).toBe(
      20 * SCORE_DIGNITY_PER_POINT
    );
    expect(scoreShift(high) - scoreShift(low)).toBe(
      50 * SCORE_DIGNITY_PER_POINT
    );
  });

  it("pays nothing for a shift that ended early", () => {
    const state = createShift({ seed: "score" });
    const docked = { ...state, outcome: "docked" } as ShiftState;
    const breakdown = getShiftScoreBreakdown(docked);
    expect(breakdown.dignity).toBe(0);
    expect(breakdown.closing).toBe(0);
  });
});

describe("the whole score (#2057)", () => {
  it("adds every part and never goes below zero", () => {
    const state = createShift({ seed: "score" });
    const tallied = {
      ...state,
      outcome: "completed",
      meters: { ...state.meters, dignity: 40 },
      tallies: {
        ...state.tallies,
        served: 5,
        late: 1,
        fastBumps: 3,
        streakPoints: 12,
      },
    } as ShiftState;
    expect(scoreShift(tallied)).toBe(
      5 * SCORE_PER_SERVED -
        SCORE_LATE_PENALTY +
        3 * SCORE_FAST_BUMP_BONUS +
        12 +
        SCORE_COMPLETED_BONUS +
        40 * SCORE_DIGNITY_PER_POINT
    );
    expect(describeShiftScore(tallied)).toBe(
      "5 cars x 10 - 1 late x 5 + 3 fast x 5 + 12 streak + 50 for closing + 40 Dignity"
    );
    expect(
      scoreShift({
        ...state,
        tallies: { ...state.tallies, late: 4 },
      })
    ).toBe(0);
  });

  it("is deterministic: the same shift always scores the same", () => {
    expect(scoreShift(shiftOf(6, 5, false))).toBe(
      scoreShift(shiftOf(6, 5, false))
    );
  });

  it("scores a sloppy shift clearly lower than a fast, clean one", () => {
    const clean = shiftOf(10, 5, false);
    const sloppy = shiftOf(10, 40, true);
    // Both served every car, so the old formula could not tell them apart.
    expect(clean.tallies.served).toBe(sloppy.tallies.served);
    expect(sloppy.tallies.late).toBe(0);
    expect(scoreShift(clean)).toBeGreaterThan(scoreShift(sloppy) * 1.5);
  });
});
