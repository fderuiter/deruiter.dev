import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_OPEN_ORDERS, type ShiftConfig } from "@/lib/patty-drive-thru";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));
const scores = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: (
    callback: (deltaMs: number) => void,
    options: { isActive?: boolean } = {}
  ) => {
    frame.callback = callback;
    frame.active = options.isActive ?? true;
  },
}));
vi.mock("@/lib/audio/sound-engine", () => ({
  getSoundEngine: () => ({
    playSequence: vi.fn(),
    playNoise: vi.fn(),
    stopAll: vi.fn(),
  }),
}));
vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="pdt-booth-canvas" />,
}));

import { DiaryIntroPage } from "@/components/patty-drive-thru/DiaryPages";
import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";

function renderIntro() {
  const onClockIn = vi.fn();
  const onClockInCustom = vi.fn<(setup: Partial<ShiftConfig>) => void>();
  render(
    <DiaryIntroPage onClockIn={onClockIn} onClockInCustom={onClockInCustom} />
  );
  fireEvent.click(screen.getByRole("radio", { name: /Custom shift/ }));
  return { onClockIn, onClockInCustom };
}

const dial = (key: string) =>
  screen.getByTestId(`pdt-dial-${key}`) as HTMLInputElement;

/** Types a value one keystroke at a time, the way a player does. */
function typeInto(input: HTMLInputElement, value: string) {
  for (let i = 1; i <= value.length; i++)
    fireEvent.change(input, { target: { value: value.slice(0, i) } });
}

function clockIn() {
  fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
}

describe("Patty's Drive-Thru custom shift setup (#2519)", () => {
  afterEach(cleanup);

  it("is offered only with a custom clock-in, and says it is practice", () => {
    render(<DiaryIntroPage onClockIn={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: /Custom shift/ })).toBeNull();
    cleanup();

    renderIntro();
    expect(screen.getByTestId("pdt-custom-practice").textContent).toMatch(
      /doesn.t count toward your best score or trophies/
    );
    expect(screen.getByTestId("pdt-custom-practice").textContent).toMatch(
      /link doesn.t carry this setup/
    );
    expect(
      screen.getByText("Time between cars (shortest / longest, seconds)")
    ).toBeTruthy();
    expect(
      screen.getByText(/Speed of service lost per expired order/)
    ).toBeTruthy();
    expect(screen.queryByText(/SOS/)).toBeNull();
  });

  it("starts with the order builder closed", () => {
    renderIntro();
    const toggle = screen.getByTestId("pdt-toggle-orders");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("pdt-order-builder")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("pdt-order-builder")).toBeTruthy();
  });

  it("lets a number be typed and holds it to its range only on blur", () => {
    renderIntro();
    const longest = dial("arrivalGapMaxSec");
    typeInto(longest, "15");
    expect(longest.value).toBe("15");
    fireEvent.blur(longest);
    expect(longest.value).toBe("15");

    const first = dial("firstArrivalSec");
    typeInto(first, "0");
    expect(first.value).toBe("0");
    fireEvent.blur(first);
    expect(first.value).toBe("0");

    typeInto(longest, "999");
    expect(longest.value).toBe("999");
    fireEvent.blur(longest);
    expect(longest.value).toBe("60");
  });

  it("restores an emptied dial on blur", () => {
    renderIntro();
    const grace = dial("idleGraceSec");
    const before = grace.value;
    fireEvent.change(grace, { target: { value: "" } });
    expect(grace.value).toBe("");
    fireEvent.blur(grace);
    expect(grace.value).toBe(before);
  });

  it("keeps the shortest gap at or below the longest", () => {
    renderIntro();
    const shortest = dial("arrivalGapMinSec");
    const longest = dial("arrivalGapMaxSec");
    typeInto(longest, "8");
    fireEvent.blur(longest);
    typeInto(shortest, "20");
    fireEvent.blur(shortest);
    expect(shortest.value).toBe("20");
    expect(longest.value).toBe("20");

    typeInto(longest, "5");
    fireEvent.blur(longest);
    expect(longest.value).toBe("5");
    expect(shortest.value).toBe("5");
  });

  it("asks for the dispenser chance as a percent", () => {
    const { onClockInCustom } = renderIntro();
    const chance = dial("dispenserFailChance");
    expect(chance.value).toBe("40");
    typeInto(chance, "150");
    fireEvent.blur(chance);
    expect(chance.value).toBe("100");
    typeInto(chance, "85");
    clockIn();
    expect(onClockInCustom.mock.calls[0][0].dispenserFailChance).toBe(0.85);
  });

  it("settles every dial when the shift starts, even one still being typed", () => {
    const { onClockIn, onClockInCustom } = renderIntro();
    typeInto(dial("arrivalGapMinSec"), "100");
    clockIn();
    expect(onClockIn).not.toHaveBeenCalled();
    const setup = onClockInCustom.mock.calls[0][0];
    expect(setup.arrivalGapMinSec).toBe(30);
    expect(setup.arrivalGapMaxSec).toBe(30);
    expect(dial("arrivalGapMinSec").value).toBe("30");
  });

  it("adds and removes orders and items, and starts with the queue built", () => {
    const { onClockInCustom } = renderIntro();
    fireEvent.click(screen.getByTestId("pdt-toggle-orders"));
    const addOrder = screen.getByTestId("pdt-add-order") as HTMLButtonElement;
    expect(screen.getAllByTestId(/^pdt-custom-order-/)).toHaveLength(2);

    while (!addOrder.disabled) fireEvent.click(addOrder);
    expect(screen.getAllByTestId(/^pdt-custom-order-/)).toHaveLength(
      MAX_OPEN_ORDERS
    );
    for (let n = MAX_OPEN_ORDERS; n > 2; n--)
      fireEvent.click(
        screen.getByRole("button", { name: `Remove order ${n}` })
      );
    fireEvent.click(screen.getByRole("button", { name: "Remove order 1" }));
    expect(screen.getAllByTestId(/^pdt-custom-order-/)).toHaveLength(1);
    // The last order cannot be removed.
    expect(
      screen.queryByRole("button", { name: /^Remove order \d+$/ })
    ).toBeNull();

    // What was order 2: a cheeseburger and fries.
    const order = screen.getByTestId("pdt-custom-order-0");
    fireEvent.click(
      within(order).getByRole("button", { name: "Add an item to order 1" })
    );
    fireEvent.change(
      within(order).getByRole("combobox", { name: "Item for order 1, item 3" }),
      { target: { value: "shake" } }
    );
    fireEvent.change(
      within(order).getByRole("combobox", {
        name: "Request for order 1, item 1",
      }),
      { target: { value: "no-pickles" } }
    );
    fireEvent.click(
      within(order).getByRole("button", { name: "Remove order 1, item 2" })
    );
    // Fries take no request, so they offer none.
    expect(
      within(order).queryByRole("combobox", {
        name: "Request for order 1, item 2",
      })
    ).toBeNull();

    clockIn();
    expect(onClockInCustom.mock.calls[0][0].customOrders).toEqual([
      {
        items: [
          { itemId: "cheeseburger", modifier: "no-pickles" },
          { itemId: "shake", modifier: null },
        ],
      },
    ]);
  });

  it("drops a burger's request when the item is changed to one that takes none", () => {
    const { onClockInCustom } = renderIntro();
    fireEvent.click(screen.getByTestId("pdt-toggle-orders"));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Item for order 1, item 1" }),
      { target: { value: "nuggets" } }
    );
    clockIn();
    expect(onClockInCustom.mock.calls[0][0].customOrders?.[0].items[0]).toEqual(
      { itemId: "nuggets", modifier: null }
    );
  });

  it("passes the custom config, with every dial, to the clock-in", () => {
    const { onClockInCustom } = renderIntro();
    typeInto(dial("sosLossExpired"), "25");
    clockIn();
    expect(onClockInCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        arrivalGapMinSec: 6,
        arrivalGapMaxSec: 12,
        firstArrivalSec: 2,
        sosLossExpired: 25,
        idleGraceSec: 6,
        dispenserFailChance: 0.4,
        customOrders: [
          {
            items: [
              { itemId: "burger", modifier: "no-pickles" },
              { itemId: "soda", modifier: null },
            ],
          },
          {
            items: [
              { itemId: "cheeseburger", modifier: null },
              { itemId: "fries", modifier: null },
            ],
          },
        ],
      })
    );
  });
});

describe("Patty's Drive-Thru custom shift in the booth (#2519)", () => {
  beforeEach(() => {
    frame.callback = null;
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/arcade/patty-drive-thru");
  });
  afterEach(cleanup);

  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++)
      act(() => {
        if (frame.active) frame.callback?.(100);
      });
  };

  it("plays the custom shift as practice and repeats it", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "custom-game", durationSec: 10 }}
        initialView="flat"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Custom shift/ }));
    clockIn();
    advance(11);
    expect(screen.getByTestId("pdt-end").textContent).toMatch(
      /Practice shift, so the score is not recorded/
    );
    expect(scores.record).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Work another shift" }));
    advance(11);
    expect(screen.getByTestId("pdt-end").textContent).toMatch(/Practice shift/);
    expect(scores.record).not.toHaveBeenCalled();
  });
});
