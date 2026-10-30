// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { usePattySession } from "@/components/patty-drive-thru/usePattySession";
import type { ShiftConfig } from "@/lib/patty-drive-thru";
import { safeClear } from "@/lib/safe-storage";

/**
 * The Patty's Drive-Thru session hook on its own (#3439): the shift clock
 * on a fixed 50 ms step, and a dilemma answered, with the booth store as the
 * source of truth and no booth scene.
 */

const STEP_SEC = 0.05;

/**
 * A custom three-minute shift (#2519) that nobody plays and that still
 * cannot fail on its meters, so it runs until a dilemma opens (CALM in
 * patty-drive-thru-dilemmas.test.ts). Clocking in applies a scenario's dials
 * over the store's own, so the dials go in as a custom shift.
 */
const CALM: Partial<ShiftConfig> = {
  durationSec: 180,
  sosLossExpired: 0,
  idleRatePerSec: 0,
};
/** The shortest shift the engine allows. */
const SHORTEST_SEC = 10;

function renderSession() {
  const boundaryRef = { current: null };
  return renderHook(() =>
    usePattySession({
      config: { seed: "dilemma-1" },
      reducedMotion: false,
      boundaryRef,
    })
  );
}

/** Steps the shift clock by `n` fixed 50 ms steps. */
function step(
  result: ReturnType<typeof renderSession>["result"],
  n: number
): void {
  act(() => {
    for (let i = 0; i < n; i++) result.current.store.getState().tick(STEP_SEC);
  });
}

beforeEach(() => safeClear());
afterEach(() => cleanup());

describe("usePattySession shift clock", () => {
  it("clocks in to a shift on the configured seed", () => {
    const { result } = renderSession();
    expect(result.current.phase).not.toBe("shift");
    act(() => result.current.clockIn());
    expect(result.current.phase).toBe("shift");
    expect(result.current.store.getState().shift.config.seed).toBe("dilemma-1");
    expect(result.current.store.getState().shift.time).toBe(0);
  });

  it("advances the shift clock by each fixed 50 ms step", () => {
    const { result } = renderSession();
    act(() => result.current.clockIn());
    step(result, 20);
    expect(result.current.store.getState().shift.time).toBeCloseTo(1, 6);
    step(result, 10);
    expect(result.current.store.getState().shift.time).toBeCloseTo(1.5, 6);
  });

  it("ends the shift when its clock runs out", () => {
    const { result } = renderSession();
    act(() => result.current.clockInCustom({ ...CALM, durationSec: 1 }));
    expect(result.current.store.getState().shift.config.durationSec).toBe(
      SHORTEST_SEC
    );
    step(result, SHORTEST_SEC / STEP_SEC - 1);
    expect(result.current.phase).toBe("shift");
    step(result, 2);
    expect(result.current.phase).toBe("ended");
    expect(result.current.endedShift?.outcome).toBe("completed");
  });

  it("pauses and resumes without repeating a state", () => {
    const { result } = renderSession();
    act(() => result.current.clockIn());
    act(() => result.current.setPaused(true));
    expect(result.current.paused).toBe(true);
    act(() => result.current.setPaused(true));
    expect(result.current.paused).toBe(true);
    act(() => result.current.setPaused(false));
    expect(result.current.paused).toBe(false);
  });
});

describe("usePattySession dilemmas", () => {
  it("answers an open dilemma with its first option", () => {
    const { result } = renderSession();
    act(() => result.current.clockInCustom(CALM));
    expect(result.current.chooseDilemma(0)).toBe(false);

    const state = () => result.current.store.getState();
    for (let i = 0; !state().shift.dilemma; i++) {
      if (i > 180 / STEP_SEC || state().phase !== "shift") {
        throw new Error("no dilemma opened");
      }
      step(result, 1);
    }
    const open = state().shift.dilemma;
    expect(open).not.toBeNull();

    let answered = false;
    act(() => {
      answered = result.current.chooseDilemma(0);
    });
    expect(answered).toBe(true);
    expect(state().shift.dilemma).toBeNull();
    expect(state().shift.dilemmaChoices).toHaveLength(1);
    expect(state().shift.dilemmaChoices[0]).toMatchObject({
      dilemmaId: open?.dilemmaId,
    });
  });
});
