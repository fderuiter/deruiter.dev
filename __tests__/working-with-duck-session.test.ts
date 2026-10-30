import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useDuckSession } from "@/components/working-with-duck/useDuckSession";
import { getArcadeProgress } from "@/lib/arcade-achievements";
import {
  createInitialDuckGameState,
  enterBathtub,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { safeClear, safeGetRawItem } from "@/lib/safe-storage";

/**
 * The Working With Duck session hook on its own (#3430): the fixed 60 Hz
 * step, a scene change and a trophy written when a sprint ships, without
 * the canvas or the room.
 */

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const STEP_MS = 1000 / 60;

function renderSession(initialState?: WorkingWithDuckState) {
  return renderHook(() => useDuckSession({ initialState }));
}

beforeEach(() => safeClear());
afterEach(() => cleanup());

describe("useDuckSession fixed step", () => {
  it("does not step the engine before the sprint starts", () => {
    const { result } = renderSession();
    act(() => result.current.advanceClock(0, () => {}));
    act(() => result.current.advanceClock(1000, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(0);
  });

  it("steps once on the first frame, then by whole fixed steps of real time", () => {
    const { result } = renderSession();
    act(() => result.current.startSprint());
    expect(result.current.uiState.status).toBe("running");

    act(() => result.current.advanceClock(1000, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(1);

    // Three steps of time, plus a fraction carried to the next frame.
    act(() => result.current.advanceClock(1000 + STEP_MS * 3.5, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(4);
    act(() => result.current.advanceClock(1000 + STEP_MS * 4, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(5);
  });

  it("replays at most eight steps after a long gap, however long", () => {
    const ticksAfterGap = (gapMs: number) => {
      const { result, unmount } = renderSession();
      act(() => result.current.startSprint());
      act(() => result.current.advanceClock(0, () => {}));
      act(() => result.current.advanceClock(gapMs, () => {}));
      const ticks = result.current.gameStateRef.current.ticks;
      unmount();
      return ticks;
    };
    const replayed = ticksAfterGap(5000) - 1;
    expect(replayed).toBeGreaterThan(1);
    expect(replayed).toBeLessThanOrEqual(8);
    expect(ticksAfterGap(60_000)).toBe(ticksAfterGap(5000));
  });

  it("counts the frame after resetClock as one step", () => {
    const { result } = renderSession();
    act(() => result.current.startSprint());
    act(() => result.current.advanceClock(0, () => {}));
    act(() => result.current.resetClock());
    act(() => result.current.advanceClock(STEP_MS * 6, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(2);
  });

  it("stops stepping while paused", () => {
    const { result } = renderSession();
    act(() => result.current.startSprint());
    act(() => result.current.advanceClock(0, () => {}));
    act(() => result.current.toggleManualPause());
    expect(result.current.isManuallyPaused).toBe(true);
    act(() => result.current.advanceClock(STEP_MS * 4, () => {}));
    expect(result.current.gameStateRef.current.ticks).toBe(1);
  });
});

describe("useDuckSession scene", () => {
  it("moves from the office to the bath", () => {
    const { result } = renderSession();
    expect(result.current.touchScene).toBe("office");
    act(() => {
      result.current.applyTransition(enterBathtub);
    });
    expect(result.current.touchScene).toBe("bath");
    expect(result.current.gameStateRef.current.inBathtub).toBe(true);
  });
});

describe("useDuckSession trophies", () => {
  it("writes the sprint trophy and sprint best when a sprint ships", () => {
    renderSession({
      ...createInitialDuckGameState(1),
      status: "won",
      workProgress: 100,
      totalScore: 1500,
    });

    expect(getArcadeProgress().unlockedTrophies).toHaveProperty(
      "duck_first_sprint"
    );
    expect(
      JSON.parse(safeGetRawItem("working_with_duck_sprint_bests") ?? "{}")
    ).toEqual({ 1: 1500 });
  });

  it("writes nothing for a sprint still running", () => {
    renderSession({ ...createInitialDuckGameState(1), totalScore: 1500 });
    expect(getArcadeProgress().unlockedTrophies).not.toHaveProperty(
      "duck_first_sprint"
    );
  });
});
