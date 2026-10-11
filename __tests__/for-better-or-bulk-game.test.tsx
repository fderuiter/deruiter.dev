import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { LEFT_LINE } from "@/lib/for-better-or-bulk";

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

vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
}));

import { ForBetterOrBulkGame } from "@/components/for-better-or-bulk/ForBetterOrBulkGame";

/** Runs the loop in quarter-second frames until a condition holds. */
function runUntil(done: () => boolean, maxFrames = 4000) {
  for (let i = 0; i < maxFrames && !done(); i++) {
    act(() => {
      if (frame.active) frame.callback?.(250);
    });
  }
}

function game(): HTMLElement {
  return screen.getByTestId("fbb-game");
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
}

describe("For Better or Bulk cabinet (#1906)", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    scores.record.mockClear();
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=8");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("starts on the plan screen within budget", () => {
    render(<ForBetterOrBulkGame />);
    expect(screen.getByTestId("fbb-setup")).toBeTruthy();
    expect(screen.getByTestId("fbb-total").textContent).toContain(
      "$2960 of $3400"
    );
    expect(screen.getByRole("button", { name: "Start setup" })).toHaveProperty(
      "disabled",
      false
    );
  });

  it("refuses an over-budget cart and a missing website feature", () => {
    render(<ForBetterOrBulkGame />);
    fireEvent.click(screen.getByRole("radio", { name: /^Yes/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^Lots/ }));
    expect(screen.getByRole("alert").textContent).toContain(
      "over the $3400 budget"
    );
    expect(screen.getByRole("button", { name: "Start setup" })).toHaveProperty(
      "disabled",
      true
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Enough/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^FAQ/ }));
    expect(screen.getByRole("alert").textContent).toContain("Pick exactly 2");
    expect(
      screen.getByRole("checkbox", { name: /^Registry scraper/ })
    ).toHaveProperty("disabled", false);
  });

  it("runs the clock, swaps people with Tab and pauses with Escape", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-canvas")).toBeTruthy();
    expect(screen.getByTestId("fbb-clock").textContent).toBe("9:00");
    runUntil(() => screen.getByTestId("fbb-clock").textContent !== "9:00");
    expect(screen.getByTestId("fbb-clock").textContent).not.toBe("9:00");

    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab" });
    expect(screen.getByTestId("fbb-active").textContent).toContain("Fred");
    expect(screen.getByRole("status").textContent).toBe("Now playing as Fred.");

    fireEvent.keyDown(game(), { key: "Escape", code: "Escape" });
    expect(frame.active).toBe(false);
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume" })[1]);
    expect(frame.active).toBe(true);
  });

  it("walks Abbi to the lantern crate with the arrows and takes one with Enter", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const prompt = () =>
      screen.getByTestId("fbb-prompt-abbi").textContent ?? "";
    fireEvent.keyDown(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    runUntil(() => prompt().includes("Take a paper lantern"), 20);
    fireEvent.keyUp(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    expect(prompt()).toContain("Take a paper lantern");
    fireEvent.keyDown(game(), { key: "Enter", code: "Enter" });
    runUntil(() => prompt().includes("carrying"), 2);
    expect(prompt()).toContain("Abbi is carrying a paper lantern.");
  });

  it("stops for the brothers' text, records the choice and ends on the receipt", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    const dialog = screen.getByRole("dialog", {
      name: "Text from Fred's brothers",
    });
    expect(frame.active).toBe(false);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Go with them/ })
    );
    expect(screen.queryByTestId("fbb-brothers")).toBeNull();

    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
    expect(screen.getByTestId("fbb-title").textContent).toBe("Married Anyway");
    expect(screen.getByTestId("fbb-follow-through").textContent).toContain(
      LEFT_LINE
    );
    expect(scores.record).toHaveBeenCalledWith("for-better-or-bulk", 0, {
      title: "Married Anyway",
    });

    fireEvent.click(screen.getByRole("button", { name: "Change the plan" }));
    expect(screen.getByTestId("fbb-setup")).toBeTruthy();
  });

  it("offers a break only with a promise about work that is in the plan", () => {
    render(<ForBetterOrBulkGame />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Paper lanterns/ }));
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(screen.getByRole("button", { name: /Take a short break/ }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: "The lanterns" })
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "The chairs" }));
    expect(screen.queryByTestId("fbb-brothers")).toBeNull();
    expect(frame.active).toBe(true);
  });
});
