// Patty's Drive-Thru playtest fixes (#1938): coworker captions name the
// speaker once, P and Escape pause, the register shows its keys, the end
// card explains the score and shows the best, and a lunch rush tightens
// the arrivals.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  BOOTH_CREW,
  EVENT_CAPTIONS,
  RUSH_END_FRACTION,
  RUSH_GAP_SCALE,
  RUSH_START_FRACTION,
  createShift,
  describeShiftScore,
  getArrivalGapScale,
  stepShift,
  type ShiftEvent,
  type ShiftState,
} from "@/lib/patty-drive-thru";
import { createBoothStore } from "@/components/patty-drive-thru/store";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

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

const progress = vi.hoisted(() => ({ best: 0 as number | undefined }));
vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  getArcadeProgress: () => ({
    highScores:
      progress.best === undefined ? {} : { "patty-drive-thru": progress.best },
    unlockedTrophies: {},
    updatedAt: 0,
  }),
  recordArcadeScore: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function BoothSceneStub() {
      return <div data-testid="pdt-booth-canvas" />;
    },
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";

function advance(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    act(() => {
      if (frame.active) frame.callback?.(100);
    });
  }
}

const game = () => screen.getByTestId("pdt-game");
const press = (key: string) => fireEvent.keyDown(game(), { key });
const clockIn = () =>
  fireEvent.click(screen.getByRole("button", { name: "Clock in" }));

beforeEach(() => {
  frame.callback = null;
  frame.active = false;
  progress.best = 0;
  window.history.replaceState(null, "", "/arcade/patty-drive-thru");
});

afterEach(() => {
  cleanup();
});

/** Runs a shift in half-second steps until it ends, keeping its events. */
function playOut(shift: ShiftState): { end: ShiftState; events: ShiftEvent[] } {
  let state = shift;
  const events: ShiftEvent[] = [];
  for (let i = 0; i < 2000 && state.outcome === "playing"; i++) {
    const step = stepShift(state, 0.5);
    state = step.state;
    events.push(...step.events);
  }
  return { end: state, events };
}

describe("coworker captions (#1938)", () => {
  it("show the coworker's lines without a second speaker label", () => {
    const store = createBoothStore({ seed: "e2e-5", durationSec: 180 });
    store.getState().clockIn();
    for (let i = 0; i < 25; i++) store.getState().tick(0.1);
    store.getState().act({ type: "flagCoworker", orderId: 1 });
    const caption = store.getState().caption;
    expect(caption?.speaker).toBe("booth");
    expect(caption?.text).toBe(EVENT_CAPTIONS.coworkerFlagged);
    expect(
      EVENT_CAPTIONS.coworkerReady.split(BOOTH_CREW.coworker)
    ).toHaveLength(2);
  });
});

describe("pause and keys (#1938)", () => {
  it("pauses on P and on Escape, and the clock stops while paused", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    clockIn();
    advance(1);
    const clock = () => screen.getByTestId("pdt-clock").textContent;
    press("p");
    expect(screen.getByTestId("pdt-paused")).toBeTruthy();
    expect(frame.active).toBe(false);
    const held = clock();
    advance(3);
    expect(clock()).toBe(held);
    press("w");
    expect(screen.getByTestId("pdt-caption").textContent).not.toContain(
      EVENT_CAPTIONS.wiped
    );
    press("P");
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
    expect(frame.active).toBe(true);

    press("Escape");
    expect(screen.getByTestId("pdt-paused")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume shift" }));
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("shows the register's keys and a key legend in flat view", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    clockIn();
    const caps = screen.getAllByTestId("pdt-key-cap").map((k) => k.textContent);
    expect(caps).toEqual(expect.arrayContaining(["R", "C", "B"]));
    // The cap is decoration; the button's name stays the action.
    expect(screen.getByRole("button", { name: /^Bump order$/ })).toBeTruthy();
    expect(screen.getByTestId("pdt-key-legend").textContent).toMatch(
      /B bump.*R re-enter drink.*C flag.*P or Esc pause/
    );
  });
});

describe("end card (#1938)", () => {
  it("explains the score and shows the best before this shift", () => {
    progress.best = 300;
    render(
      <PattyDriveThruGame
        config={{ seed: "e2e-4", durationSec: 10 }}
        initialView="flat"
      />
    );
    clockIn();
    advance(10.5);
    expect(screen.getByTestId("pdt-score").textContent).toMatch(
      /cars? x 10.*\+ 50 for closing/
    );
    expect(screen.getByTestId("pdt-best").textContent).toBe("Best: 300.");
  });

  it("describes late cars and a missed close", () => {
    const shift = createShift({ seed: "s", durationSec: 60 });
    const tallied: ShiftState = {
      ...shift,
      outcome: "docked",
      tallies: { ...shift.tallies, served: 3, late: 2 },
    } as ShiftState;
    expect(describeShiftScore(tallied)).toBe("3 cars x 10 - 2 late x 5");
  });
});

describe("lunch rush (#1938)", () => {
  it("halves the arrival gap in the middle of the shift only", () => {
    expect(getArrivalGapScale(10, 100)).toBe(1);
    expect(getArrivalGapScale(RUSH_START_FRACTION * 100, 100)).toBe(
      RUSH_GAP_SCALE
    );
    expect(getArrivalGapScale(RUSH_END_FRACTION * 100, 100)).toBe(1);
  });

  it("announces the rush once", () => {
    // No one serves, so keep the idle player on the clock past the rush.
    const calm = { idleGraceSec: 1000, sosLossExpired: 0 };
    const { end, events } = playOut(
      createShift({ seed: "rush", durationSec: 180, ...calm })
    );
    expect(end.time).toBeGreaterThan(180 * RUSH_START_FRACTION);
    expect(events.filter((e) => e.type === "rush-started")).toHaveLength(1);
  });

  it("leaves a practice scenario's own arrival gaps alone", () => {
    const { events } = playOut(
      createShift({
        seed: "rush",
        durationSec: 180,
        arrivalGapMinSec: 7,
        arrivalGapMaxSec: 15,
        idleGraceSec: 1000,
        sosLossExpired: 0,
      })
    );
    expect(events.some((e) => e.type === "rush-started")).toBe(false);
  });
});
