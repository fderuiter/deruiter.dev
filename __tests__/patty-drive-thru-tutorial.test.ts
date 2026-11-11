// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PATTY_TUTORIAL_DILEMMA,
  PATTY_TUTORIAL_SHIFT,
  applyAction,
  createShift,
  getDilemmaOption,
  getKdsTickets,
  offerDilemma,
  stepShift,
} from "@/lib/patty-drive-thru";
import { createBoothStore } from "@/components/patty-drive-thru/store";

/**
 * The guided tutorial's practice shift (#3451): one car ordering fries, a
 * dilemma offered on demand, and a store practice clock-in that leaves the
 * next real shift's config alone.
 */
describe("offerDilemma (#3451)", () => {
  it("opens the dilemma now, with the usual answer window", () => {
    const shift = createShift({ seed: "t", durationSec: 600 });
    const { state, events } = offerDilemma(shift, "ice-machine");
    expect(events).toEqual([
      { type: "dilemma-offered", dilemmaId: "ice-machine" },
    ]);
    expect(state.dilemma?.dilemmaId).toBe("ice-machine");
    expect(state.dilemma?.offeredAt).toBe(0);
    expect(state.dilemma!.closesAt).toBeGreaterThan(0);
  });

  it("changes nothing while a dilemma is open or for an unknown id", () => {
    const shift = createShift({ seed: "t", durationSec: 600 });
    const open = offerDilemma(shift, "ice-machine").state;
    expect(offerDilemma(open, "stale-fries").state).toBe(open);
    expect(
      offerDilemma(shift, "nope" as typeof PATTY_TUTORIAL_DILEMMA).state
    ).toBe(shift);
  });

  it("is answered like any dilemma", () => {
    const open = offerDilemma(
      createShift({ seed: "t", durationSec: 600 }),
      PATTY_TUTORIAL_DILEMMA
    ).state;
    const option = getDilemmaOption(PATTY_TUTORIAL_DILEMMA, "towel")!;
    const { state, events } = applyAction(open, {
      type: "chooseDilemma",
      optionId: option.id,
    });
    expect(state.dilemma).toBeNull();
    expect(events).toContainEqual({
      type: "dilemma-resolved",
      dilemmaId: PATTY_TUTORIAL_DILEMMA,
      optionId: "towel",
      timedOut: false,
    });
  });
});

describe("the practice shift (#3451)", () => {
  it("brings one car ordering fries within its first seconds", () => {
    let shift = createShift(PATTY_TUTORIAL_SHIFT);
    for (let i = 0; i < 8 && shift.orders.length === 0; i++) {
      shift = stepShift(shift, 0.25).state;
    }
    expect(shift.orders).toHaveLength(1);
    expect(shift.orders[0].items.map((item) => item.itemId)).toEqual([
      "fries",
    ]);
    expect(getKdsTickets(shift)).toHaveLength(1);
  });

  it("clocks in without changing the next real shift's config", () => {
    const store = createBoothStore({ seed: "real", durationSec: 120 });
    store.getState().clockInPractice(PATTY_TUTORIAL_SHIFT);
    expect(store.getState().phase).toBe("shift");
    expect(store.getState().shift.config.customOrders).toHaveLength(1);
    store.getState().clockIn();
    expect(store.getState().shift.config.seed).toBe("real");
    expect(store.getState().shift.config.durationSec).toBe(120);
    expect(store.getState().shift.config.customOrders).toBeUndefined();
  });

  it("offers the tutorial dilemma through the store", () => {
    const store = createBoothStore({ seed: "real", durationSec: 120 });
    store.getState().clockInPractice(PATTY_TUTORIAL_SHIFT);
    store.getState().offerDilemma(PATTY_TUTORIAL_DILEMMA);
    expect(store.getState().shift.dilemma?.dilemmaId).toBe(
      PATTY_TUTORIAL_DILEMMA
    );
  });
});
