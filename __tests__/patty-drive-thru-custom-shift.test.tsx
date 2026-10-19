import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  createShift,
  isStandardScenario,
  stepShift,
  SCENARIO_LIMITS,
  type CustomOrderTemplate,
} from "@/lib/patty-drive-thru";
import { createBoothStore } from "@/components/patty-drive-thru/store";
import { DiaryIntroPage } from "@/components/patty-drive-thru/DiaryPages";

describe("Patty's Drive-Thru Custom Order Builder & Scenario Dials", () => {
  it("initializes ShiftConfig with custom dials and custom order queue", () => {
    const customOrders: CustomOrderTemplate[] = [
      {
        items: [
          { itemId: "cheeseburger", modifier: "no-pickles" },
          { itemId: "shake", modifier: null },
        ],
      },
      {
        items: [{ itemId: "nuggets", modifier: null }],
      },
    ];

    const shift = createShift({
      arrivalGapMinSec: 2,
      dispenserFailChance: 0.8,
      customOrders,
    });

    expect(shift.config.arrivalGapMinSec).toBe(2);
    expect(shift.config.dispenserFailChance).toBe(0.8);
    expect(shift.config.customOrders).toHaveLength(2);
    expect(shift.config.customOrders?.[0].items[0]).toEqual({
      itemId: "cheeseburger",
      modifier: "no-pickles",
    });
    expect(isStandardScenario(shift.config)).toBe(false);
  });

  it("clamps custom dials within SCENARIO_LIMITS bounds", () => {
    const shift = createShift({
      arrivalGapMinSec: 100, // max is 30
      dispenserFailChance: -0.5, // min is 0
    });

    expect(shift.config.arrivalGapMinSec).toBe(
      SCENARIO_LIMITS.arrivalGapMinSec[1]
    );
    expect(shift.config.dispenserFailChance).toBe(
      SCENARIO_LIMITS.dispenserFailChance[0]
    );
  });

  it("generates arriving orders according to custom order templates in stepShift", () => {
    const customOrders: CustomOrderTemplate[] = [
      {
        items: [
          { itemId: "coffee", modifier: null },
          { itemId: "fries", modifier: null },
        ],
      },
      {
        items: [{ itemId: "burger", modifier: "no-pickles" }],
      },
    ];

    let shift = createShift({
      firstArrivalSec: 1,
      arrivalGapMinSec: 5,
      arrivalGapMaxSec: 5,
      customOrders,
    });

    // Step 1s (2 steps of 0.5s due to MAX_STEP_SEC) to trigger first order arrival at 1s
    shift = stepShift(shift, 0.5).state;
    shift = stepShift(shift, 0.5).state;

    expect(shift.orders).toHaveLength(1);
    const firstOrder = shift.orders[0];
    expect(firstOrder.items).toHaveLength(2);
    expect(firstOrder.items[0].itemId).toBe("coffee");
    expect(firstOrder.items[1].itemId).toBe("fries");

    // Step 5s more to trigger second order arrival
    for (let i = 0; i < 10; i++) {
      shift = stepShift(shift, 0.5).state;
    }

    expect(shift.orders).toHaveLength(2);
    const secondOrder = shift.orders[1];
    expect(secondOrder.items).toHaveLength(1);
    expect(secondOrder.items[0].itemId).toBe("burger");
    expect(secondOrder.items[0].modifier).toBe("no-pickles");
  });

  it("retains custom scenario dials and custom order queue parameters in store clockIn", () => {
    const store = createBoothStore();
    const customOrders: CustomOrderTemplate[] = [
      {
        items: [{ itemId: "shake", modifier: null }],
      },
    ];

    store.getState().clockIn({
      arrivalGapMinSec: 3,
      dispenserFailChance: 0.75,
      customOrders,
    });

    const shift = store.getState().shift;
    expect(shift.config.arrivalGapMinSec).toBe(3);
    expect(shift.config.dispenserFailChance).toBe(0.75);
    expect(shift.config.customOrders).toEqual(customOrders);
  });

  it("renders custom shift controls and Custom Order Builder drawer in DiaryIntroPage", () => {
    const onClockIn = vi.fn();
    render(<DiaryIntroPage onClockIn={onClockIn} />);

    // Select "Custom shift"
    const customRadio = screen.getByLabelText(/Custom shift/i);
    fireEvent.click(customRadio);

    // Verify custom parameter panel and drawer appear
    expect(screen.getByTestId("pdt-custom-panel")).toBeTruthy();
    expect(screen.getByTestId("pdt-order-builder-drawer")).toBeTruthy();

    // Adjust arrival gap min dial
    const minGapDial = screen.getByTestId("pdt-dial-arrivalGapMinSec");
    fireEvent.change(minGapDial, { target: { value: "4" } });

    // Test adding an order
    const addOrderBtn = screen.getByTestId("pdt-add-order");
    fireEvent.click(addOrderBtn);

    // Verify 3 custom orders now exist
    expect(screen.getByTestId("pdt-custom-order-2")).toBeTruthy();

    // Toggle drawer
    const toggleDrawerBtn = screen.getByTestId("pdt-toggle-drawer");
    expect(toggleDrawerBtn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggleDrawerBtn);
    expect(toggleDrawerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("pdt-order-builder-drawer")).toBeNull();

    // Re-open drawer
    fireEvent.click(toggleDrawerBtn);

    // Clock in
    const clockInBtn = screen.getByRole("button", { name: /Clock in/i });
    fireEvent.click(clockInBtn);

    expect(onClockIn).toHaveBeenCalledWith(
      "custom",
      expect.objectContaining({
        arrivalGapMinSec: 4,
        customOrders: expect.any(Array),
      })
    );
  });
});
