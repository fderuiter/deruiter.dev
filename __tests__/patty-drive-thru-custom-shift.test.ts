import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_OPEN_ORDERS,
  createShift,
  isShiftOver,
  isStandardScenario,
  stepShift,
  type CustomOrderTemplate,
  type ShiftConfig,
  type ShiftState,
} from "@/lib/patty-drive-thru";

/** Steps a shift in quarter seconds, collecting every order that arrived. */
function play(shift: ShiftState, seconds: number) {
  let state = shift;
  const arrived: string[][] = [];
  for (let i = 0; i < Math.round(seconds / 0.25) && !isShiftOver(state); i++) {
    const { state: next, events } = stepShift(state, 0.25);
    for (const event of events) {
      if (event.type !== "order-arrived") continue;
      const order = next.orders.find((o) => o.id === event.orderId);
      arrived.push(
        (order?.items ?? []).map(
          (item) => `${item.itemId}${item.modifier ? `:${item.modifier}` : ""}`
        )
      );
    }
    state = next;
  }
  return { state, arrived };
}

const TWO_ORDERS: CustomOrderTemplate[] = [
  {
    items: [
      { itemId: "burger", modifier: "no-pickles" },
      { itemId: "soda", modifier: null },
    ],
  },
  { items: [{ itemId: "coffee" }] },
];

// One car a second, so the queue loops quickly; nobody serves, so stay
// under the six-order cap.
const FAST: Partial<ShiftConfig> = {
  seed: "custom-1",
  firstArrivalSec: 1,
  arrivalGapMinSec: 1,
  arrivalGapMaxSec: 1,
};

describe("Patty's Drive-Thru custom shift engine (#2519)", () => {
  it("plays the templates in order and loops back to the first", () => {
    const { arrived } = play(
      createShift({ ...FAST, customOrders: TWO_ORDERS }),
      5.5
    );
    expect(arrived).toEqual([
      ["burger:no-pickles", "soda"],
      ["coffee"],
      ["burger:no-pickles", "soda"],
      ["coffee"],
      ["burger:no-pickles", "soda"],
    ]);
  });

  it("marks a templated modifier as still to be rung up", () => {
    const { state } = play(
      createShift({ ...FAST, customOrders: TWO_ORDERS }),
      1
    );
    const [burger, soda] = state.orders[0].items;
    expect(burger.modifierDone).toBe(false);
    expect(soda.modifierDone).toBe(true);
  });

  it("leaves the seeded draw to the arrival gaps alone", () => {
    const custom = play(
      createShift({ ...FAST, customOrders: TWO_ORDERS }),
      1
    ).state;
    const drawn = play(createShift(FAST), 1).state;
    // The template consumed no draws; only the next gap did.
    expect(custom.draws).toBe(1);
    expect(drawn.draws).toBeGreaterThan(1);
    expect(custom.nextArrivalAt).toBe(drawn.nextArrivalAt);
  });

  it("replays the same custom shift the same way twice", () => {
    const config = {
      seed: "custom-twice",
      arrivalGapMinSec: 2,
      arrivalGapMaxSec: 9,
      customOrders: TWO_ORDERS,
    };
    const first = play(createShift(config), 60);
    const second = play(createShift(config), 60);
    expect(second.arrived).toEqual(first.arrived);
    expect(second.state).toEqual(first.state);
  });

  it("caps the templates and their items", () => {
    const many: CustomOrderTemplate[] = Array.from(
      { length: MAX_OPEN_ORDERS + 3 },
      () => ({
        items: Array.from({ length: MAX_ITEMS_PER_ORDER + 2 }, () => ({
          itemId: "fries" as const,
        })),
      })
    );
    const orders = createShift({ customOrders: many }).config.customOrders;
    expect(orders).toHaveLength(MAX_OPEN_ORDERS);
    for (const order of orders ?? [])
      expect(order.items).toHaveLength(MAX_ITEMS_PER_ORDER);
  });

  it("rejects items off the menu and modifiers that do not exist or do not fit", () => {
    const orders = createShift({
      customOrders: fromAny([
        {
          items: [
            { itemId: "pizza" },
            { itemId: "burger", modifier: "extra-onions" },
            { itemId: "fries", modifier: "no-pickles" },
            { itemId: "cheeseburger", modifier: "no-pickles" },
            null,
          ],
        },
        { items: [{ itemId: "lobster" }] },
        { items: "burger" },
        null,
      ]),
    }).config.customOrders;
    expect(orders).toEqual([
      {
        items: [
          { itemId: "burger", modifier: null },
          { itemId: "fries", modifier: null },
          { itemId: "cheeseburger", modifier: "no-pickles" },
        ],
      },
    ]);
  });

  it("draws orders as usual when the list is empty or nothing in it is valid", () => {
    const empty = createShift({ ...FAST, customOrders: [] });
    const invalid = createShift({
      ...FAST,
      customOrders: fromAny([{ items: [{ itemId: "pizza" }] }]),
    });
    expect(empty.config.customOrders).toBeUndefined();
    expect(invalid.config.customOrders).toBeUndefined();
    expect(play(empty, 3).state).toEqual(play(createShift(FAST), 3).state);
    expect(isStandardScenario(createShift({ customOrders: [] }).config)).toBe(
      true
    );
  });

  it("never counts a custom shift toward the score", () => {
    const shift = createShift({ seed: "x", customOrders: TWO_ORDERS });
    expect(isStandardScenario(shift.config)).toBe(false);
    expect(isStandardScenario({ customOrders: TWO_ORDERS })).toBe(false);
  });
});
