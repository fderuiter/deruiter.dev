// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  applyAction,
  computePayStub,
  createShift,
  getKdsBand,
  getPosScreen,
  isOrderReady,
  replayShift,
  stepShift,
  DEFAULT_SHIFT_CONFIG,
  MAX_OPEN_ORDERS,
  METER_START,
  type MenuItemId,
  type ModifierId,
  type Order,
  type ShiftAction,
  type ShiftState,
} from "@/lib/patty-drive-thru";

function makeOrder(
  id: number,
  arrivedAt: number,
  items: [MenuItemId, ModifierId | null][]
): Order {
  return {
    id,
    arrivedAt,
    coworkerReadyAt: null,
    items: items.map(([itemId, modifier]) => ({
      itemId,
      modifier,
      rung: false,
      modifierDone: modifier === null,
      dropped: false,
    })),
  };
}

/** A shift at `time` holding only the given orders, with arrivals pushed out of the way. */
function withOrders(orders: Order[], time = 0, seed = "test"): ShiftState {
  return {
    ...createShift({ seed }),
    time,
    lastActionAt: time,
    orders,
    nextArrivalAt: 1_000,
  };
}

function run(state: ShiftState, actions: ShiftAction[]) {
  let current = state;
  const events = [];
  for (const action of actions) {
    const result = applyAction(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function advance(state: ShiftState, seconds: number) {
  let current = state;
  const events = [];
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(0.5, left);
    const result = stepShift(current, dt);
    current = result.state;
    events.push(...result.events);
    left -= dt;
  }
  return { state: current, events };
}

const tap = (nodeId: string): ShiftAction => ({ type: "posTap", nodeId });

describe("createShift", () => {
  it("starts a fresh shift with the default config and starting meters", () => {
    const state = createShift();
    expect(state.config).toEqual(DEFAULT_SHIFT_CONFIG);
    expect(state.time).toBe(0);
    expect(state.outcome).toBe("playing");
    expect(state.meters).toEqual(METER_START);
    expect(state.orders).toEqual([]);
    expect(state.pos).toEqual({ path: [], activeOrderId: null, taps: 0 });
  });

  it("falls back to safe values for a bad seed or duration", () => {
    expect(createShift({ seed: "" }).config.seed).toBe(
      DEFAULT_SHIFT_CONFIG.seed
    );
    expect(createShift({ durationSec: Number.NaN }).config.durationSec).toBe(
      DEFAULT_SHIFT_CONFIG.durationSec
    );
    expect(createShift({ durationSec: -5 }).config.durationSec).toBe(10);
    expect(createShift({ durationSec: 1e9 }).config.durationSec).toBe(3600);
  });
});

describe("getKdsBand", () => {
  it("turns yellow after 25 seconds and red after 50", () => {
    expect(getKdsBand(0)).toBe("green");
    expect(getKdsBand(25)).toBe("green");
    expect(getKdsBand(25.5)).toBe("yellow");
    expect(getKdsBand(50)).toBe("yellow");
    expect(getKdsBand(50.5)).toBe("red");
  });

  it("treats a non-number age as a fresh order", () => {
    expect(getKdsBand(Number.NaN)).toBe("green");
  });
});

describe("stepShift", () => {
  it("brings in the first order two seconds into the shift", () => {
    const { state, events } = advance(createShift({ seed: "a" }), 2);
    expect(events).toContainEqual({ type: "order-arrived", orderId: 1 });
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].items.length).toBeGreaterThanOrEqual(1);
    expect(state.orders[0].items.length).toBeLessThanOrEqual(4);
  });

  it("replays the same shift from the same seed", () => {
    const a = advance(createShift({ seed: "same" }), 60).state;
    const b = advance(createShift({ seed: "same" }), 60).state;
    expect(a).toEqual(b);
  });

  it("draws different orders from different seeds", () => {
    const orders = (seed: string) =>
      advance(createShift({ seed }), 120).state.orders.map((o) => o.items);
    expect(orders("one")).not.toEqual(orders("two"));
  });

  it("ignores a zero, negative or non-finite step", () => {
    const state = createShift();
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = stepShift(state, dt);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
  });

  it("never simulates more than half a second per step", () => {
    expect(stepShift(createShift(), 30).state.time).toBe(0.5);
  });

  it("keeps at most six orders open at once", () => {
    let state = createShift({ seed: "rush" });
    let most = 0;
    while (state.outcome === "playing") {
      state = stepShift(state, 0.5).state;
      most = Math.max(most, state.orders.length);
    }
    expect(most).toBeLessThanOrEqual(MAX_OPEN_ORDERS);
  });

  it("expires an order after 75 seconds and docks the SOS meter", () => {
    const start = {
      ...withOrders([makeOrder(100, 0, [["fries", null]])], 74.5),
      pos: { path: [], activeOrderId: 100, taps: 0 },
    };
    const { state, events } = advance(start, 0.5);
    expect(events).toContainEqual({ type: "order-expired", orderId: 100 });
    expect(state.orders).toEqual([]);
    expect(state.meters.sos).toBe(METER_START.sos - 15);
    expect(state.tallies.expired).toBe(1);
    expect(state.pos.activeOrderId).toBeNull();
  });

  it("lets the manager yell at a player who stands idle", () => {
    const { state, events } = advance(withOrders([]), 14.5);
    expect(events).toContainEqual({ type: "manager-yell" });
    expect(state.meters.dignity).toBe(METER_START.dignity - 10);
    expect(state.tallies.yells).toBe(1);
    expect(state.meters.idle).toBeLessThan(100);
  });

  it("ends the shift as completed when the clock runs out", () => {
    const { state, events } = advance(createShift({ durationSec: 10 }), 10);
    expect(state.outcome).toBe("completed");
    expect(events).toContainEqual({
      type: "shift-ended",
      outcome: "completed",
    });
    expect(stepShift(state, 0.5).state).toBe(state);
    expect(applyAction(state, { type: "wipe" }).state).toBe(state);
  });

  it("ends the shift as docked when the SOS meter hits zero", () => {
    const start = {
      ...withOrders([makeOrder(100, 0, [["fries", null]])], 74.5),
      meters: { sos: 10, dignity: 50, idle: 0 },
    };
    expect(advance(start, 0.5).state.outcome).toBe("docked");
  });
});

describe("the POS terminal", () => {
  it("walks into submenus and back out", () => {
    const deep = run(createShift(), [
      tap("modifiers"),
      tap("toppings"),
      tap("pickles"),
    ]).state;
    expect(deep.pos.path).toEqual(["modifiers", "toppings", "pickles"]);
    expect(getPosScreen(deep).id).toBe("pickles");
    expect(deep.pos.taps).toBe(3);

    const back = applyAction(deep, { type: "posBack" }).state;
    expect(back.pos.path).toEqual(["modifiers", "toppings"]);
    const home = applyAction(back, { type: "posHome" }).state;
    expect(home.pos.path).toEqual([]);
  });

  it("ignores a tap on a button that is not on screen", () => {
    const state = createShift();
    expect(applyAction(state, tap("pickles")).state).toBe(state);
    expect(applyAction(state, tap("nonsense")).state).toBe(state);
    expect(applyAction(state, { type: "posBack" }).state).toBe(state);
    expect(applyAction(state, { type: "posHome" }).state).toBe(state);
  });

  it("falls back to the home screen when the path no longer matches", () => {
    const state = {
      ...createShift(),
      pos: { path: ["gone"], activeOrderId: null, taps: 0 },
    };
    expect(getPosScreen(state).id).toBe("home");
  });

  it("rings an item onto the selected order and returns home", () => {
    const start = withOrders([makeOrder(100, 0, [["burger", null]])]);
    const { state, events } = run(start, [
      { type: "selectOrder", orderId: 100 },
      tap("burgers"),
      tap("burger"),
    ]);
    expect(events).toContainEqual({
      type: "item-rung",
      orderId: 100,
      itemId: "burger",
    });
    expect(state.orders[0].items[0].rung).toBe(true);
    expect(state.pos.path).toEqual([]);
    expect(isOrderReady(state.orders[0])).toBe(true);
  });

  it("costs dignity to ring an item the customer did not order", () => {
    const start = withOrders([makeOrder(100, 0, [["burger", null]])]);
    const { state, events } = run(start, [
      { type: "selectOrder", orderId: 100 },
      tap("sides"),
      tap("fries"),
    ]);
    expect(events).toContainEqual({ type: "wrong-entry", nodeId: "fries" });
    expect(state.meters.dignity).toBe(METER_START.dignity - 4);
    expect(state.tallies.wrongEntries).toBe(1);
  });

  it("costs dignity to ring anything with no order selected", () => {
    const start = withOrders([makeOrder(100, 0, [["fries", null]])]);
    const { events } = run(start, [tap("sides"), tap("fries")]);
    expect(events).toContainEqual({ type: "wrong-entry", nodeId: "fries" });
  });

  it("buries no pickles four taps deep and needs the burger rung first", () => {
    const start = {
      ...withOrders([makeOrder(100, 0, [["burger", "no-pickles"]])]),
      pos: { path: [], activeOrderId: 100, taps: 0 },
    };
    const early = run(start, [
      tap("modifiers"),
      tap("toppings"),
      tap("pickles"),
      tap("no-pickles"),
    ]);
    expect(early.events).toContainEqual({
      type: "wrong-entry",
      nodeId: "no-pickles",
    });

    const done = run(start, [
      tap("burgers"),
      tap("burger"),
      tap("modifiers"),
      tap("toppings"),
      tap("pickles"),
      tap("no-pickles"),
    ]).state;
    expect(done.orders[0].items[0].modifierDone).toBe(true);
    expect(isOrderReady(done.orders[0])).toBe(true);
  });
});

describe("the under-18 coffee lockout", () => {
  const start = {
    ...withOrders([makeOrder(100, 0, [["coffee", null]])]),
    pos: { path: [], activeOrderId: 100, taps: 0 },
  };

  it("refuses to brew coffee and costs dignity", () => {
    const { state, events } = run(start, [tap("drinks"), tap("coffee")]);
    expect(events).toContainEqual({ type: "locked", orderId: 100 });
    expect(state.meters.dignity).toBe(METER_START.dignity - 3);
    expect(state.tallies.lockedAttempts).toBe(1);
    expect(state.orders[0].items[0].rung).toBe(false);
  });

  it("lets a flagged coworker brew it after four seconds", () => {
    const flagged = applyAction(start, {
      type: "flagCoworker",
      orderId: 100,
    }).state;
    expect(flagged.orders[0].coworkerReadyAt).toBe(4);

    const tooSoon = run(flagged, [tap("drinks"), tap("coffee")]);
    expect(tooSoon.events).toContainEqual({ type: "locked", orderId: 100 });

    const waited = advance(flagged, 4);
    expect(waited.events).toContainEqual({
      type: "coworker-ready",
      orderId: 100,
    });
    const brewed = run(waited.state, [tap("drinks"), tap("coffee")]).state;
    expect(brewed.orders[0].items[0].rung).toBe(true);
  });

  it("does nothing when flagging an order with no coffee, or twice", () => {
    const noCoffee = withOrders([makeOrder(100, 0, [["fries", null]])]);
    expect(
      applyAction(noCoffee, { type: "flagCoworker", orderId: 100 }).state
    ).toBe(noCoffee);
    const once = applyAction(start, {
      type: "flagCoworker",
      orderId: 100,
    }).state;
    expect(
      applyAction(once, { type: "flagCoworker", orderId: 100 }).state
    ).toBe(once);
  });
});

describe("the drink dispenser", () => {
  function ringSoda(seed: string) {
    const start = {
      ...withOrders([makeOrder(100, 0, [["soda", null]])], 0, seed),
      pos: { path: [], activeOrderId: 100, taps: 0 },
    };
    return run(start, [tap("drinks"), tap("soda")]);
  }

  const seeds = Array.from({ length: 50 }, (_, i) => `drink-${i}`);
  const droppingSeed = seeds.find((s) =>
    ringSoda(s).events.some((e) => e.type === "drink-dropped")
  );
  const cleanSeed = seeds.find(
    (s) => !ringSoda(s).events.some((e) => e.type === "drink-dropped")
  );

  it("sometimes drops a drink, and sometimes does not", () => {
    expect(droppingSeed).toBeDefined();
    expect(cleanSeed).toBeDefined();
    const clean = ringSoda(cleanSeed as string).state;
    expect(isOrderReady(clean.orders[0])).toBe(true);
  });

  it("blocks the bump until the dropped drink is re-entered", () => {
    const dropped = ringSoda(droppingSeed as string).state;
    expect(dropped.orders[0].items[0].dropped).toBe(true);
    expect(dropped.tallies.drinksDropped).toBe(1);

    const blocked = applyAction(dropped, { type: "bump", orderId: 100 });
    expect(blocked.events).toContainEqual({
      type: "wrong-entry",
      nodeId: "bump",
    });
    expect(blocked.state.orders).toHaveLength(1);

    const fixed = applyAction(dropped, { type: "reenterDrink", orderId: 100 });
    expect(fixed.events).toContainEqual({
      type: "drink-reentered",
      orderId: 100,
    });
    expect(isOrderReady(fixed.state.orders[0])).toBe(true);
    expect(
      applyAction(fixed.state, { type: "reenterDrink", orderId: 100 }).state
    ).toBe(fixed.state);
  });
});

describe("bumping orders off the KDS", () => {
  function readyAt(age: number) {
    const order = makeOrder(100, 0, [["fries", null]]);
    return {
      ...withOrders(
        [{ ...order, items: [{ ...order.items[0], rung: true }] }],
        age
      ),
      pos: { path: [], activeOrderId: 100, taps: 0 },
    };
  }

  it.each([
    [10, "green", 3, 0],
    [40, "yellow", 2, 0],
    [60, "red", -5, 1],
  ] as const)(
    "at %i seconds bumps a %s ticket and moves SOS by %i",
    (age, band, delta, late) => {
      const { state, events } = applyAction(readyAt(age), {
        type: "bump",
        orderId: 100,
      });
      expect(events).toContainEqual({ type: "bumped", orderId: 100, band });
      expect(state.meters.sos).toBe(METER_START.sos + delta);
      expect(state.orders).toEqual([]);
      expect(state.tallies.served).toBe(1);
      expect(state.tallies.late).toBe(late);
      expect(state.pos.activeOrderId).toBeNull();
    }
  );

  it("ignores a bump for an order that is gone", () => {
    const state = readyAt(10);
    expect(applyAction(state, { type: "bump", orderId: 999 }).state).toBe(
      state
    );
  });
});

describe("idle pressure and wiping", () => {
  it("wipes the counter to calm the manager, with a cooldown", () => {
    const tense = {
      ...withOrders([], 20),
      meters: { ...METER_START, idle: 70 },
    };
    const wiped = applyAction(tense, { type: "wipe" });
    expect(wiped.events).toContainEqual({ type: "wiped" });
    expect(wiped.state.meters.idle).toBe(30);
    expect(applyAction(wiped.state, { type: "wipe" }).state).toBe(wiped.state);
    const later = advance(wiped.state, 3).state;
    expect(applyAction(later, { type: "wipe" }).events).toContainEqual({
      type: "wiped",
    });
  });

  it("ends the shift as a breakdown when dignity runs out", () => {
    const start = {
      ...withOrders([makeOrder(100, 0, [["burger", null]])]),
      meters: { sos: 50, dignity: 4, idle: 0 },
      pos: { path: [], activeOrderId: 100, taps: 0 },
    };
    const { state, events } = run(start, [tap("sides"), tap("fries")]);
    expect(state.outcome).toBe("breakdown");
    expect(events).toContainEqual({
      type: "shift-ended",
      outcome: "breakdown",
    });
  });
});

describe("applyAction input hygiene", () => {
  it("ignores unknown actions, unknown orders and malformed payloads", () => {
    const state = withOrders([makeOrder(100, 0, [["fries", null]])]);
    const junk: ShiftAction[] = [
      { type: "selectOrder", orderId: 999 },
      fromAny({ type: "selectOrder", orderId: "100" }),
      fromAny({ type: "posTap", nodeId: 42 }),
      fromAny({ type: "explode" }),
      fromAny(null),
    ];
    for (const action of junk) {
      expect(applyAction(state, action).state).toBe(state);
    }
  });

  it("never mutates the state it is given", () => {
    const state = withOrders([makeOrder(100, 0, [["burger", "no-pickles"]])]);
    const before = structuredClone(state);
    run(state, [
      { type: "selectOrder", orderId: 100 },
      tap("burgers"),
      tap("burger"),
      { type: "bump", orderId: 100 },
    ]);
    advance(state, 20);
    expect(state).toEqual(before);
  });
});

describe("computePayStub", () => {
  it("pays nothing before the shift starts", () => {
    const stub = computePayStub(createShift());
    expect(stub.paidMinutes).toBe(0);
    expect(stub.grossCents).toBe(0);
    expect(stub.netCents).toBe(0);
  });

  it("pays four hours at a full shift, minus the uniform, the break and the till", () => {
    const state = {
      ...createShift(),
      time: DEFAULT_SHIFT_CONFIG.durationSec,
      tallies: { ...createShift().tallies, expired: 2 },
    };
    expect(computePayStub(state)).toEqual({
      paidMinutes: 240,
      grossCents: 2900,
      uniformCents: 300,
      breakAdjustmentCents: 363,
      tillShortCents: 258,
      netCents: 1979,
    });
  });
});

describe("replayShift", () => {
  it("replays a timeline to the same state as playing it live", () => {
    const timeline = [
      { at: 3, action: { type: "selectOrder", orderId: 1 } as ShiftAction },
      { at: 4, action: { type: "wipe" } as ShiftAction },
      { at: 9, action: tap("drinks") },
    ];
    let live = createShift({ seed: "replay" });
    for (const entry of timeline) {
      live = advance(live, entry.at - live.time).state;
      live = applyAction(live, entry.action).state;
    }
    expect(replayShift({ seed: "replay" }, timeline)).toEqual(live);
  });
});
