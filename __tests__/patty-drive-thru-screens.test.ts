import { describe, it, expect, vi } from "vitest";
import {
  applyAction,
  createShift,
  getKdsTickets,
  stepShift,
  type KdsTicket,
  type ShiftEvent,
  type ShiftState,
} from "@/lib/patty-drive-thru";
import {
  drawKds,
  KDS_TEXTURE_HEIGHT,
  KDS_TEXTURE_WIDTH,
} from "@/components/patty-drive-thru/kds-texture";
import {
  drawPos,
  readPosPicture,
} from "@/components/patty-drive-thru/pos-texture";
import {
  HEADSET_PAN,
  KITCHEN_PAN,
  cueFor,
  playShiftEvents,
} from "@/components/patty-drive-thru/booth-audio";

function context(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = KDS_TEXTURE_WIDTH;
  canvas.height = KDS_TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D context");
  vi.mocked(ctx.fillText).mockClear();
  return ctx;
}

function drawnText(ctx: CanvasRenderingContext2D): string[] {
  return vi.mocked(ctx.fillText).mock.calls.map(([text]) => String(text));
}

function firstOrderShift(seed: string): ShiftState {
  let state = createShift({ seed });
  for (let i = 0; i < 40 && state.orders.length === 0; i++) {
    state = stepShift(state, 0.1).state;
  }
  return state;
}

const TICKET: KdsTicket = {
  orderId: 3,
  ageSec: 61,
  band: "red",
  ready: true,
  active: true,
  needsCoworker: false,
  coworkerReadyIn: null,
  lines: [
    {
      itemId: "burger",
      label: "Burger",
      modifier: "no-pickles",
      modifierPending: false,
      status: "rung",
    },
    {
      itemId: "soda",
      label: "Soda",
      modifier: null,
      modifierPending: false,
      status: "dropped",
    },
    {
      itemId: "coffee",
      label: "Coffee",
      modifier: null,
      modifierPending: false,
      status: "locked",
    },
    {
      itemId: "coffee",
      label: "Coffee",
      modifier: null,
      modifierPending: false,
      status: "brewing",
    },
  ],
};

describe("Patty's Drive-Thru kitchen display texture", () => {
  it("says so when there are no orders", () => {
    const ctx = context();
    drawKds(ctx, []);
    expect(drawnText(ctx)).toEqual(["NO ORDERS"]);
  });

  it("draws each ticket with its number, age, lines and modifiers", () => {
    const ctx = context();
    drawKds(ctx, [TICKET]);
    const text = drawnText(ctx);
    expect(text).toEqual(
      expect.arrayContaining([
        "#3",
        "1:01",
        "Burger ✓",
        "  NO PICKLES",
        "Soda DROPPED",
        "Coffee 18+",
        "Coffee brewing",
        "READY",
      ])
    );
    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});

describe("Patty's Drive-Thru register screen texture", () => {
  it("reads the order strip, the menu keys and the breadcrumb", () => {
    const state = firstOrderShift("e2e-4");
    const picture = readPosPicture(state);
    expect(picture.breadcrumb).toBe("Home");
    expect(picture.keys).toEqual([
      "Burgers ›",
      "Sides ›",
      "Drinks ›",
      "Modifiers ›",
    ]);
    expect(picture.tickets).toEqual([
      {
        orderId: 1,
        ready: false,
        active: false,
        needsCoworker: false,
        lines: getKdsTickets(state)[0].lines,
      },
    ]);
    // The picture leaves out the ticking clocks, so it only changes when
    // something on the screen does.
    const later = stepShift(state, 0.5).state;
    expect(readPosPicture(later)).toEqual(picture);
  });

  it("draws an empty register", () => {
    const ctx = context();
    drawPos(ctx, readPosPicture(createShift({ seed: "e2e-4" })));
    const text = drawnText(ctx);
    expect(text).toContain("No cars. Wipe something.");
    expect(text).toContain("Pick an order to ring it up.");
    expect(text).toContain("Burgers ›");
  });

  it("draws the open ticket with each line's status", () => {
    let state = firstOrderShift("e2e-1");
    state = applyAction(state, { type: "selectOrder", orderId: 1 }).state;
    state = applyAction(state, { type: "posTap", nodeId: "sides" }).state;
    const ctx = context();
    drawPos(ctx, readPosPicture(state));
    const text = drawnText(ctx);
    expect(text).toContain("Order #1");
    expect(text).toContain("#1");
    expect(text).toContain("HOME › SIDES");
    expect(text).toContain("Burger · No pickles?");
    expect(text).toContain("to ring");
    expect(text).toContain("Bump order");
  });

  it("draws every line status the register can show", () => {
    const ctx = context();
    drawPos(ctx, {
      breadcrumb: "Home",
      keys: [],
      tickets: [
        {
          orderId: 3,
          ready: true,
          active: true,
          needsCoworker: true,
          lines: [
            ...TICKET.lines,
            {
              itemId: "coffee",
              label: "Coffee",
              modifier: null,
              modifierPending: false,
              status: "ready-to-ring",
            },
          ],
        },
      ],
    });
    const text = drawnText(ctx);
    expect(text).toEqual(
      expect.arrayContaining(["#3 ✓", "rung", "DROPPED", "18+", "brewing"])
    );
  });
});

describe("Patty's Drive-Thru booth audio", () => {
  const EVENTS: ShiftEvent[] = [
    { type: "order-arrived", orderId: 1 },
    { type: "order-expired", orderId: 1 },
    { type: "manager-yell" },
    { type: "drink-dropped", orderId: 1 },
    { type: "coworker-ready", orderId: 1 },
    { type: "locked", orderId: 1 },
    { type: "wrong-entry", nodeId: "bump" },
    { type: "item-rung", orderId: 1, itemId: "fries" },
    { type: "drink-reentered", orderId: 1 },
    { type: "bumped", orderId: 1, band: "red" },
    { type: "bumped", orderId: 2, band: "green" },
    { type: "shift-ended", outcome: "completed" },
  ];

  it("puts the headset on the left and the kitchen on the right", () => {
    expect(cueFor(EVENTS[0])?.every((n) => n.pan === HEADSET_PAN)).toBe(true);
    expect(cueFor(EVENTS[2])?.every((n) => n.pan === KITCHEN_PAN)).toBe(true);
    expect(cueFor(EVENTS[3])).toHaveLength(3);
  });

  it("plays a lower bump for a late car than an on-time one", () => {
    const late = cueFor(EVENTS[9])?.[0].frequency ?? 0;
    const onTime = cueFor(EVENTS[10])?.[0].frequency ?? 0;
    expect(late).toBeLessThan(onTime);
  });

  it("gives every event a cue, a wipe a burst of noise, and touch devices silence", () => {
    const engine = { playSequence: vi.fn(), playNoise: vi.fn() };
    playShiftEvents([...EVENTS, { type: "wiped" }], engine, false);
    expect(engine.playSequence).toHaveBeenCalledTimes(EVENTS.length);
    expect(engine.playNoise).toHaveBeenCalledTimes(1);

    const silent = { playSequence: vi.fn(), playNoise: vi.fn() };
    playShiftEvents(EVENTS, silent, true);
    expect(silent.playSequence).not.toHaveBeenCalled();
  });

  it("leaves the wipe to the noise burst rather than a tone", () => {
    expect(cueFor({ type: "wiped" })).toBeNull();
  });
});
