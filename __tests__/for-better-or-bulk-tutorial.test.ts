// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useForBetterOrBulkSession } from "@/components/for-better-or-bulk/useForBetterOrBulkSession";
import type { CabinetTutorialValue } from "@/components/arcade/tutorial";
import {
  DEFAULT_SETUP,
  FOR_BETTER_OR_BULK_TUTORIAL_SIGNALS as S,
  IDLE_FRAME,
  IDLE_INPUT,
  TICK_SECONDS,
  TUTORIAL_SETUP,
  bulkTutorialSignals,
  createLevel,
  holdTutorialClock,
  stepGame,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { safeClear } from "@/lib/safe-storage";

/**
 * For Better or Bulk's guided tutorial (#3456): a practice day whose clock
 * stands still, the signals the player's own actions send, and the plan
 * screen handed back as it was.
 */

const TICK_MS = TICK_SECONDS * 1000;

beforeEach(() => safeClear());
afterEach(() => cleanup());

describe("the practice day's clock", () => {
  it("stands still, so no call, text or 4:00 ever comes", () => {
    let state = createLevel(TUTORIAL_SETUP);
    const start = state.time;
    // A whole day's worth of ticks: past every call, the text and 4:00.
    const ticks = Math.ceil(state.duration / TICK_SECONDS) + 10;
    for (let i = 0; i < ticks; i++) {
      state = holdTutorialClock(state, stepGame(state, IDLE_FRAME).state);
    }
    expect(state.time).toBe(start);
    expect(state.phase).toBe("playing");
    expect(state.brothersAt).toBeNull();
    expect(state.interruptions).toHaveLength(0);
  });

  it("leaves a day that is not playing as it is", () => {
    const state = createLevel(TUTORIAL_SETUP);
    const done = { ...state, phase: "done" as const, time: 10 };
    expect(holdTutorialClock(state, done)).toBe(done);
  });

  it("runs on the default plan with no helper", () => {
    expect(TUTORIAL_SETUP).toEqual({ ...DEFAULT_SETUP, assist: false });
  });
});

describe("bulkTutorialSignals", () => {
  it("sends move when the person at the keys walks, not the other one", () => {
    const before = createLevel(TUTORIAL_SETUP);
    const frame = (who: "fred" | "abbi") => ({
      inputs: { ...IDLE_FRAME.inputs, [who]: { ...IDLE_INPUT, moveX: 1 } },
    });
    const abbi = stepGame(before, frame("abbi"));
    expect(
      bulkTutorialSignals(before, abbi.state, abbi.events, "abbi")
    ).toEqual([S.move]);
    const fred = stepGame(before, frame("fred"));
    expect(
      bulkTutorialSignals(before, fred.state, fred.events, "abbi")
    ).toEqual([]);
  });

  it("sends pick-up, put-down and work for the active person's events", () => {
    const state = createLevel(TUTORIAL_SETUP);
    const signals = bulkTutorialSignals(
      state,
      state,
      [
        { type: "picked-up", player: "abbi", item: "roses" },
        { type: "put-down", player: "abbi", item: "roses" },
        { type: "crafted", player: "abbi", item: "arrangement" },
        { type: "picked-up", player: "fred", item: "chairs" },
      ],
      "abbi"
    );
    expect(signals).toEqual([S.pickUp, S.putDown, S.work]);
  });
});

function renderSession(tutorial: { current: CabinetTutorialValue }) {
  const boundaryRef = { current: null };
  const setup: Setup = { ...DEFAULT_SETUP, seed: 7, assist: true };
  return renderHook(() =>
    useForBetterOrBulkSession({
      initialSetup: setup,
      initialMode: "coop",
      loud: false,
      touch: false,
      boundaryRef,
      tutorial: tutorial.current,
    })
  );
}

describe("useForBetterOrBulkSession with the tutorial", () => {
  it("plays a still-clock practice day, signals the player's actions, then hands back the plan", () => {
    const signal = vi.fn();
    const tutorial = {
      current: { active: false, stepId: null, signal } as CabinetTutorialValue,
    };
    const { result, rerender } = renderSession(tutorial);
    expect(result.current.phase).toBe("setup");

    tutorial.current = { active: true, stepId: "move", signal };
    rerender();
    expect(result.current.phase).toBe("playing");
    expect(result.current.mode).toBe("solo");
    expect(result.current.setup).toEqual(TUTORIAL_SETUP);

    act(() => result.current.touchKey("KeyD", true));
    act(() => {
      for (let i = 0; i < 20; i++) result.current.advanceFrame(TICK_MS);
    });
    expect(result.current.view?.time).toBe(0);
    expect(result.current.view?.tick).toBeGreaterThan(0);
    expect(signal).toHaveBeenCalledWith(S.move);

    act(() => result.current.swapActive());
    expect(signal).toHaveBeenCalledWith(S.swap);

    tutorial.current = { active: false, stepId: null, signal };
    rerender();
    expect(result.current.phase).toBe("setup");
    expect(result.current.mode).toBe("coop");
    expect(result.current.setup.assist).toBe(true);
    expect(result.current.receipt).toBeNull();
  });
});
