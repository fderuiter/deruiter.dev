import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const scores = vi.hoisted(() => ({ record: vi.fn(), milestone: vi.fn() }));

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
  recordArcadeMilestone: scores.milestone,
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function BoothSceneStub() {
      return <div data-testid="pdt-booth-canvas" />;
    },
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";

const SAVE_KEY = "patty-drive-thru:week:v1";
const BEST_KEY = "patty-drive-thru:week-best:v1";
const DAY_SEC = 10;

/** Runs the shift loop in tenth-of-a-second frames until the day is over. */
function workTheDay() {
  for (let i = 0; i < DAY_SEC * 10 + 5; i++) {
    act(() => {
      if (frame.active) frame.callback?.(100);
    });
  }
}

function renderGame() {
  return render(
    <PattyDriveThruGame
      config={{ seed: "week-ui", durationSec: DAY_SEC }}
      initialView="flat"
    />
  );
}

function savedDays(): number {
  const raw = window.localStorage.getItem(SAVE_KEY);
  return raw ? (JSON.parse(raw) as { days: unknown[] }).days.length : 0;
}

beforeEach(() => {
  frame.callback = null;
  frame.active = false;
  vi.clearAllMocks();
  window.localStorage.removeItem(SAVE_KEY);
  window.localStorage.removeItem(BEST_KEY);
  window.history.replaceState(null, "", "/arcade/patty-drive-thru");
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(SAVE_KEY);
  window.localStorage.removeItem(BEST_KEY);
});

describe("Patty's Drive-Thru week mode (#2086)", () => {
  it("works Monday, saves the week, and resumes it after a reload", () => {
    const first = renderGame();
    fireEvent.click(screen.getByRole("radio", { name: /A week of shifts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start the week" }));
    expect(screen.getByTestId("pdt-hud-day").textContent).toContain("Monday");
    expect(screen.getByRole("status").textContent).toContain("Monday");

    workTheDay();
    const page = screen.getByTestId("pdt-day-end");
    expect(page.getAttribute("data-day")).toBe("monday");
    expect(screen.getByTestId("pdt-day-lines").textContent).toMatch(
      /Made it to close/
    );
    expect(screen.getByTestId("pdt-carry").textContent).toContain("Tuesday");
    expect(savedDays()).toBe(1);
    // Each day's own shift score goes on the arcade board, like a single
    // shift's.
    expect(scores.record).toHaveBeenCalledTimes(1);
    expect(scores.record.mock.calls[0][0]).toBe("patty-drive-thru");
    expect(scores.record.mock.calls[0][2]).toMatchObject({
      mode: "week",
      day: "monday",
    });

    fireEvent.click(screen.getByTestId("pdt-week-stop"));
    expect(screen.getByTestId("pdt-week-resume").textContent).toContain(
      "Tuesday"
    );

    // A reload: a new mount reads the save back, and records nothing.
    first.unmount();
    renderGame();
    const resume = screen.getByRole("button", {
      name: "Resume the week: Tuesday",
    });
    expect(resume.className).toContain("min-h-12");
    fireEvent.click(resume);
    expect(screen.getByTestId("pdt-hud-day").textContent).toContain("Tuesday");
    expect(scores.record).toHaveBeenCalledTimes(1);
  });

  function workTheWeek() {
    fireEvent.click(screen.getByRole("radio", { name: /A week of shifts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start the week" }));
    const days = ["Tuesday", "Wednesday", "Thursday", "Friday"];
    workTheDay();
    for (const day of days) {
      fireEvent.click(
        screen.getByRole("button", { name: `Clock in for ${day}` })
      );
      expect(screen.getByTestId("pdt-hud-day").textContent).toContain(day);
      workTheDay();
    }
  }

  it("ends Friday on a summary of all five days, a local best week and the trophy", () => {
    renderGame();
    workTheWeek();

    expect(screen.getByTestId("pdt-week-end")).toBeTruthy();
    const list = screen.getByTestId("pdt-week-days");
    expect(list.querySelectorAll("li")).toHaveLength(5);
    expect(list.textContent).toContain("Fry Friday");
    expect(savedDays()).toBe(0);
    // Five day scores on the board; the week total stays local.
    expect(scores.record).toHaveBeenCalledTimes(5);
    const total = scores.record.mock.calls.reduce(
      (sum, call) => sum + (call[1] as number),
      0
    );
    expect(screen.getByTestId("pdt-week-score").textContent).toContain(
      `Week score ${total}.`
    );
    expect(window.localStorage.getItem(BEST_KEY)).toBe(String(total));
    expect(screen.getByTestId("pdt-best").textContent).toMatch(/New best week/);
    expect(scores.milestone).toHaveBeenCalledWith(
      "patty-drive-thru",
      "full_week"
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to the diary" }));
    expect(screen.getByTestId("pdt-intro")).toBeTruthy();
    expect(screen.queryByTestId("pdt-week-resume")).toBeNull();
  });

  it("compares a second week with the best week kept in the browser", () => {
    window.localStorage.setItem(BEST_KEY, "999999");
    renderGame();
    workTheWeek();
    expect(screen.getByTestId("pdt-best").textContent).toBe(
      "Best week: 999999."
    );
    expect(window.localStorage.getItem(BEST_KEY)).toBe("999999");
  });

  it("keeps single shifts available and scored on their own", () => {
    renderGame();
    fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
    expect(screen.queryByTestId("pdt-hud-day")).toBeNull();
    workTheDay();
    expect(screen.getByTestId("pdt-end")).toBeTruthy();
    expect(scores.record).toHaveBeenCalledTimes(1);
  });

  it("starts fresh when the save is unreadable", () => {
    window.localStorage.setItem(SAVE_KEY, "{not json");
    renderGame();
    expect(screen.queryByTestId("pdt-week-resume")).toBeNull();
  });
});
