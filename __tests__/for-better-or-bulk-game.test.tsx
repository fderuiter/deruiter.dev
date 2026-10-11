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
import {
  DEFAULT_SETUP,
  ITEM_LABELS,
  LEFT_LINE,
  createLevel,
  type Frame,
  type GameState,
} from "@/lib/for-better-or-bulk";
import { BrothersDialog } from "@/components/for-better-or-bulk/BrothersDialog";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const scores = vi.hoisted(() => ({ record: vi.fn() }));

/** Lets a test end the level on the next engine step, whatever the plan. */
const engine = vi.hoisted(() => ({
  finishNext: false,
  inputs: [] as Frame[],
}));

vi.mock("@/lib/for-better-or-bulk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/for-better-or-bulk")>();
  return {
    ...actual,
    stepGame: (state: GameState, input: Frame) => {
      engine.inputs.push(input);
      const result = actual.stepGame(state, input);
      if (!engine.finishNext) return result;
      engine.finishNext = false;
      return {
        ...result,
        state: { ...result.state, phase: "done" as const },
      };
    },
  };
});

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
    engine.finishNext = false;
    engine.inputs = [];
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
    // Normal speed: only an unsped run reaches the leaderboard.
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
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

  it("keeps a sped-up run off the leaderboard (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Go with them/,
      })
    );
    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
    expect(screen.getByTestId("fbb-receipt")).toBeTruthy();
    expect(scores.record).not.toHaveBeenCalled();
  });

  it("ends the level when a swap lands on the step that finishes it (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    // An E press has not reached the engine yet when Tab is pressed.
    fireEvent.keyDown(game(), { key: "Enter", code: "Enter" });
    engine.finishNext = true;
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab" });
    expect(screen.getByTestId("fbb-receipt")).toBeTruthy();
  });

  it("ignores held Tab and Escape repeats (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab", repeat: true });
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    fireEvent.keyDown(game(), { key: "Escape", code: "Escape", repeat: true });
    expect(frame.active).toBe(true);
    expect(screen.queryByText(/^Paused at/)).toBeNull();
  });

  it("still moves on a tap shorter than one tick (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.keyDown(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    fireEvent.keyUp(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    engine.inputs = [];
    act(() => frame.callback?.(40));
    expect(engine.inputs[0]?.inputs.abbi.moveX).toBe(-1);
    expect(engine.inputs.slice(1).every((f) => f.inputs.abbi.moveX === 0)).toBe(
      true
    );
  });

  it("pauses with Escape from the Pause button (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const pause = screen.getByRole("button", { name: "Pause" });
    pause.focus();
    fireEvent.keyDown(pause, { key: "Escape", code: "Escape" });
    expect(frame.active).toBe(false);
  });

  it("pauses on a click outside, not when a focused control is removed (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const pause = screen.getByRole("button", { name: "Pause" });
    fireEvent.blur(pause, { relatedTarget: null });
    expect(frame.active).toBe(true);
    fireEvent.blur(game(), { relatedTarget: null });
    expect(frame.active).toBe(false);
  });

  it("keeps focus on the boundary after a mouse pause and resume (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    screen.getByRole("button", { name: "Pause" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(document.activeElement).toBe(game());
    expect(screen.getByRole("region", { name: /^Paused at/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume" })[0]);
    expect(document.activeElement).toBe(game());
    expect(frame.active).toBe(true);
  });

  it("pauses when focus leaves the cabinet (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.blur(game(), { relatedTarget: document.body });
    expect(frame.active).toBe(false);
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
  });

  it("says what Abbi carries and how Fred is, from the level (#1914)", () => {
    const level = createLevel(DEFAULT_SETUP);
    const holding = {
      ...level,
      players: {
        ...level.players,
        abbi: {
          ...level.players.abbi,
          holding: { kind: "roses" as const, madeBy: null },
        },
      },
    };
    const { unmount } = render(
      <BrothersDialog state={holding} onDecide={vi.fn()} />
    );
    expect(
      screen.getByText(new RegExp(`Abbi is carrying ${ITEM_LABELS.roses}`))
    ).toBeTruthy();
    expect(screen.getByText(/Fred is nervous/)).toBeTruthy();
    unmount();

    const free = {
      ...level,
      players: {
        ...level.players,
        fred: { ...level.players.fred, calm: true },
      },
    };
    render(<BrothersDialog state={free} onDecide={vi.fn()} />);
    expect(screen.getByText(/Abbi has her hands free/)).toBeTruthy();
    expect(screen.queryByText(/carrying|chairs/)).toBeNull();
    expect(screen.getByText(/Fred has calmed down/)).toBeTruthy();
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
