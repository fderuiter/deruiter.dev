// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BOOTH_CREW,
  CLOSING_NOTE,
  COMPANION_POST_PATH,
  DIARY_INTRO,
  EVENT_CAPTIONS,
  HEADSET_LINES,
  LOOK_PITCH_MAX,
  LOOK_PITCH_MIN,
  LOOK_PRESETS,
  LOOK_YAW_LIMIT,
  MANAGER_LINES,
  SCORE_COMPLETED_BONUS,
  SCORE_LATE_PENALTY,
  SCORE_PER_SERVED,
  aimLook,
  applyAction,
  createLook,
  createShift,
  describeOrder,
  formatCents,
  formatClock,
  getFacing,
  getHeadsetLine,
  getKdsTicket,
  getKdsTickets,
  getManagerLine,
  getPosBreadcrumb,
  getShiftEnding,
  getTimeLeft,
  isLookSettled,
  scoreShift,
  stepLook,
  stepShift,
  type LookState,
  type Order,
  type ShiftState,
} from "@/lib/patty-drive-thru";

const SEED = "e2e-4";

/** A shift on a fixed seed, run until its first car has ordered. */
function shiftWithFirstOrder(seed = SEED): ShiftState {
  let state = createShift({ seed });
  for (let i = 0; i < 100 && state.orders.length === 0; i++) {
    state = stepShift(state, 0.1).state;
  }
  return state;
}

function withOrders(state: ShiftState, orders: Order[]): ShiftState {
  return { ...state, orders };
}

const ORDER: Order = {
  id: 7,
  arrivedAt: 0,
  coworkerReadyAt: null,
  items: [
    {
      itemId: "burger",
      modifier: "no-pickles",
      rung: false,
      modifierDone: false,
      dropped: false,
    },
    {
      itemId: "soda",
      modifier: null,
      rung: true,
      modifierDone: true,
      dropped: true,
    },
    {
      itemId: "coffee",
      modifier: null,
      rung: false,
      modifierDone: true,
      dropped: false,
    },
  ],
};

describe("Patty's Drive-Thru kitchen display view (#1813)", () => {
  it("shows a ticket's lines with their status, oldest order first", () => {
    const base = createShift({ seed: SEED });
    const state = withOrders({ ...base, time: 40 }, [ORDER]);
    const ticket = getKdsTicket(state, ORDER);
    expect(ticket.orderId).toBe(7);
    expect(ticket.ageSec).toBe(40);
    expect(ticket.ready).toBe(false);
    expect(ticket.active).toBe(false);
    expect(ticket.needsCoworker).toBe(true);
    expect(ticket.coworkerReadyIn).toBeNull();
    expect(ticket.lines.map((line) => line.status)).toEqual([
      "to-ring",
      "dropped",
      "locked",
    ]);
    expect(ticket.lines[0]).toMatchObject({
      label: "Burger",
      modifier: "no-pickles",
      modifierPending: true,
    });
    expect(getKdsTickets(state)).toEqual([ticket]);
  });

  it("shows the coffee brewing, then ready to ring, once Dale is flagged", () => {
    const base = createShift({ seed: SEED });
    const flagged: Order = { ...ORDER, coworkerReadyAt: 50 };
    const brewing = getKdsTicket(
      withOrders({ ...base, time: 45 }, [flagged]),
      flagged
    );
    expect(brewing.lines[2].status).toBe("brewing");
    expect(brewing.coworkerReadyIn).toBe(5);
    expect(brewing.needsCoworker).toBe(false);
    const ready = getKdsTicket(
      withOrders({ ...base, time: 50 }, [flagged]),
      flagged
    );
    expect(ready.lines[2].status).toBe("ready-to-ring");
    expect(ready.coworkerReadyIn).toBeNull();
  });

  it("marks rung lines and the active order", () => {
    const state = shiftWithFirstOrder();
    const [order] = state.orders;
    const selected = applyAction(state, {
      type: "selectOrder",
      orderId: order.id,
    }).state;
    const [ticket] = getKdsTickets(selected);
    expect(ticket.active).toBe(true);
    expect(ticket.lines.every((line) => line.status === "to-ring")).toBe(true);

    const rung = applyAction(
      applyAction(selected, { type: "posTap", nodeId: "sides" }).state,
      { type: "posTap", nodeId: "fries" }
    ).state;
    expect(getKdsTickets(rung)[0].lines[0].status).toBe("rung");
    expect(getKdsTickets(rung)[0].ready).toBe(true);
  });
});

describe("Patty's Drive-Thru register breadcrumb", () => {
  it("names each screen from Home to the open one", () => {
    const state = createShift({ seed: SEED });
    expect(getPosBreadcrumb(state)).toEqual(["Home"]);
    const deep = {
      ...state,
      pos: { ...state.pos, path: ["modifiers", "toppings", "pickles"] },
    };
    expect(getPosBreadcrumb(deep)).toEqual([
      "Home",
      "Modifiers",
      "Toppings",
      "Pickles",
    ]);
  });

  it("falls back to Home for a path that does not exist", () => {
    const state = createShift({ seed: SEED });
    expect(
      getPosBreadcrumb({ pos: { ...state.pos, path: ["burgers", "nope"] } })
    ).toEqual(["Home"]);
    expect(
      getPosBreadcrumb({ pos: { ...state.pos, path: ["burgers", "burger"] } })
    ).toEqual(["Home"]);
  });
});

describe("Patty's Drive-Thru formatting and score", () => {
  it("reads an order aloud the way a customer says it", () => {
    expect(describeOrder(ORDER)).toBe("Burger, no pickles; soda; coffee");
  });

  it("formats the clock, rounding up and never negative", () => {
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(0.2)).toBe("0:01");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00");
  });

  it("formats cents as dollars with a sign", () => {
    expect(formatCents(1979)).toBe("$19.79");
    expect(formatCents(-300)).toBe("-$3.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(Number.NaN)).toBe("$0.00");
  });

  it("reports the time left, never below zero", () => {
    const state = createShift({ seed: SEED, durationSec: 60 });
    expect(getTimeLeft({ ...state, time: 20 })).toBe(40);
    expect(getTimeLeft({ ...state, time: 75 })).toBe(0);
  });

  it("scores served cars, docks late ones and adds the close-out bonus", () => {
    const state = createShift({ seed: SEED });
    const tallies = { ...state.tallies, served: 4, late: 1 };
    expect(scoreShift({ ...state, tallies })).toBe(
      4 * SCORE_PER_SERVED - SCORE_LATE_PENALTY
    );
    expect(scoreShift({ ...state, tallies, outcome: "completed" })).toBe(
      4 * SCORE_PER_SERVED - SCORE_LATE_PENALTY + SCORE_COMPLETED_BONUS
    );
    expect(
      scoreShift({ ...state, tallies: { ...tallies, served: 0, late: 3 } })
    ).toBe(0);
  });
});

describe("Patty's Drive-Thru head (look)", () => {
  it("starts at rest on the counter", () => {
    const look = createLook();
    expect(look).toEqual({
      yaw: LOOK_PRESETS.counter.yaw,
      pitch: LOOK_PRESETS.counter.pitch,
      targetYaw: LOOK_PRESETS.counter.yaw,
      targetPitch: LOOK_PRESETS.counter.pitch,
    });
    expect(isLookSettled(look)).toBe(true);
    expect(getFacing(look)).toBe("counter");
  });

  it("clamps a preset outside the booth and ignores non-finite values", () => {
    const look = createLook({ yaw: 9, pitch: Number.NaN });
    expect(look.yaw).toBe(LOOK_YAW_LIMIT);
    expect(look.pitch).toBe(0);
  });

  it("turns toward the window, eases after the target and settles", () => {
    let look = createLook();
    look = stepLook(look, { turn: 1, dragYaw: 0, dragPitch: 0 }, 0.05);
    expect(look.targetYaw).toBeGreaterThan(0);
    expect(look.yaw).toBeGreaterThan(0);
    expect(look.yaw).toBeLessThan(look.targetYaw);
    for (let i = 0; i < 40; i++) {
      look = stepLook(look, { turn: 1, dragYaw: 0, dragPitch: 0 }, 0.05);
    }
    expect(look.targetYaw).toBe(LOOK_YAW_LIMIT);
    for (let i = 0; i < 60; i++) {
      look = stepLook(look, { turn: 0, dragYaw: 0, dragPitch: 0 }, 0.05);
    }
    expect(isLookSettled(look)).toBe(true);
    expect(getFacing(look)).toBe("window");
  });

  it("drags pitch inside its limits and faces the kitchen on the right", () => {
    let look = createLook();
    look = stepLook(look, { turn: 0, dragYaw: -5, dragPitch: 5 }, 1);
    expect(look.targetYaw).toBe(-LOOK_YAW_LIMIT);
    expect(look.targetPitch).toBe(LOOK_PITCH_MAX);
    look = stepLook(look, { turn: 0, dragYaw: 0, dragPitch: -9 }, 0.1);
    expect(look.targetPitch).toBe(LOOK_PITCH_MIN);
    const kitchen = aimLook(createLook(), LOOK_PRESETS.kitchen);
    for (let i = 0; i < 80; i++) {
      Object.assign(
        kitchen,
        stepLook(kitchen, { turn: 0, dragYaw: 0, dragPitch: 0 }, 0.05)
      );
    }
    expect(getFacing(kitchen)).toBe("kitchen");
  });

  it("only applies a drag when the step is not a positive number", () => {
    const look = createLook();
    const dragged = stepLook(look, { turn: 1, dragYaw: 0.2, dragPitch: 0 }, 0);
    expect(dragged.targetYaw).toBeCloseTo(0.2);
    expect(dragged.yaw).toBe(look.yaw);
    const ignored = stepLook(
      look,
      { turn: Number.NaN, dragYaw: Number.NaN, dragPitch: Number.NaN },
      Number.NaN
    );
    expect(ignored).toEqual(look);
  });

  it("keeps aimLook targets inside the booth and ignores non-finite presets", () => {
    const look = createLook();
    const aimed = aimLook(look, { yaw: Number.NaN, pitch: -9 });
    expect(aimed.targetYaw).toBe(look.targetYaw);
    expect(aimed.targetPitch).toBe(LOOK_PITCH_MIN);
    expect(isLookSettled(aimed)).toBe(false);
  });

  it("never leaves the booth's half turn, whatever the input (property)", () => {
    const input = fc.record({
      turn: fc.double({ noNaN: false }),
      dragYaw: fc.double({ noNaN: false }),
      dragPitch: fc.double({ noNaN: false }),
    });
    fc.assert(
      fc.property(fc.array(fc.tuple(input, fc.double())), (steps) => {
        let look: LookState = createLook();
        for (const [frame, dt] of steps) look = stepLook(look, frame, dt);
        for (const value of [look.yaw, look.targetYaw]) {
          expect(Math.abs(value)).toBeLessThanOrEqual(LOOK_YAW_LIMIT);
        }
        for (const value of [look.pitch, look.targetPitch]) {
          expect(value).toBeGreaterThanOrEqual(LOOK_PITCH_MIN);
          expect(value).toBeLessThanOrEqual(LOOK_PITCH_MAX);
        }
      })
    );
  });
});

describe("Patty's Drive-Thru diary (#1814)", () => {
  const REAL_NAMES = /brittney|heather|\bmo\b|mcdonald/i;

  it("renames everyone and never names the real chain", () => {
    const copy = [
      DIARY_INTRO.title,
      DIARY_INTRO.dateline,
      ...DIARY_INTRO.paragraphs,
      ...HEADSET_LINES,
      ...MANAGER_LINES,
      ...Object.values(EVENT_CAPTIONS),
      ...CLOSING_NOTE,
      ...Object.values(BOOTH_CREW),
    ].join("\n");
    expect(copy).not.toMatch(REAL_NAMES);
    expect(BOOTH_CREW).toEqual({
      player: "Fred",
      manager: "Bo",
      generalManager: "Heidi",
      coworker: "Dale",
    });
  });

  it("links the closing pages to the companion post", () => {
    expect(COMPANION_POST_PATH).toBe("/blog/notes-from-my-first-job");
  });

  it("picks the same headset and manager lines for the same seed", () => {
    expect(getHeadsetLine("a", 3)).toBe(getHeadsetLine("a", 3));
    expect(HEADSET_LINES).toContain(getHeadsetLine("a", 3));
    expect(MANAGER_LINES).toContain(getManagerLine("a", 1));
    expect(MANAGER_LINES).toContain(getManagerLine("a", -2));
    expect(HEADSET_LINES).toContain(getHeadsetLine("a", 1.5));
    const lines = new Set(
      Array.from({ length: 30 }, (_, i) => getHeadsetLine("spread", i))
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it("writes each ending from the shift's tallies", () => {
    const state = createShift({ seed: SEED });
    const tallies = { ...state.tallies, served: 1, late: 0, expired: 2 };
    expect(getShiftEnding({ ...state, tallies, outcome: "completed" })).toEqual(
      {
        outcome: "completed",
        title: "Made it to close",
        summary:
          "Shift over. 1 car served, 0 of them late, 2 gave up and drove off.",
      }
    );
    expect(
      getShiftEnding({ ...state, tallies: { ...tallies, served: 3 } }).summary
    ).toContain("3 cars served");
    expect(getShiftEnding({ ...state, outcome: "docked" })).toMatchObject({
      outcome: "docked",
      title: "Pulled off the window",
    });
    expect(getShiftEnding({ ...state, outcome: "breakdown" })).toMatchObject({
      outcome: "breakdown",
      title: "The walk-in cooler",
    });
  });
});
