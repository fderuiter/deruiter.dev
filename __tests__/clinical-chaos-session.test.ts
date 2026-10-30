import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useClinicalChaosSession } from "@/components/clinical-trial-chaos/useClinicalChaosSession";

/**
 * The Clinical Trial Chaos session hook on its own (#3438): the shift clock
 * stops under pause, and the queue fills on the shift clock, without
 * rendering the game. The test steps the animation frames and the wall
 * clock itself.
 */

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playSuccess: vi.fn(), muted: true }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: () => Promise.resolve(true) }),
}));
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

/** A desktop cabinet: no touch, full motion. */
const DESKTOP = {
  touch: false,
  readReducedMotion: () => false,
  readCalmMotion: () => false,
};

let frames: FrameRequestCallback[] = [];
let wallClock = 0;

/** Runs `seconds` of play as 50 ms frames, advancing the wall clock with them. */
function play(seconds: number) {
  for (let elapsed = 0; elapsed < seconds * 1000; elapsed += 50) {
    wallClock += 50;
    vi.setSystemTime(wallClock);
    const pending = frames;
    frames = [];
    act(() => {
      for (const frame of pending) frame(wallClock);
    });
  }
}

/** A campaign shift with calibration skipped, so the clocks run. */
function startShift() {
  const hook = renderHook(() => useClinicalChaosSession(DESKTOP));
  act(() => hook.result.current.startGame("campaign", 1));
  if (hook.result.current.calibrationActive) {
    act(() => hook.result.current.skipCalibration());
  }
  return hook;
}

beforeEach(() => {
  window.localStorage.clear();
  frames = [];
  wallClock = Date.parse("2026-10-30T12:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(wallClock);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    })
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useClinicalChaosSession", () => {
  it("starts a shift playing and unpaused, with the opening subjects queued", () => {
    const { result } = startShift();
    expect(result.current.playState).toBe("playing");
    expect(result.current.isPaused).toBe(false);
    expect(result.current.calibrationActive).toBe(false);
    expect(result.current.conveyorSubjects.length).toBeGreaterThan(0);
  });

  it("queues another subject on the conveyor once the shift clock has run", () => {
    const { result } = startShift();
    const opening = result.current.conveyorSubjects.map((s) => s.id);
    play(30);
    const queued = result.current.conveyorSubjects.filter(
      (s) => !opening.includes(s.id)
    );
    expect(queued.length).toBeGreaterThan(0);
  });

  it("holds the shift clock under pause, so nothing queues until it resumes", () => {
    const { result } = startShift();
    const opening = result.current.conveyorSubjects;
    act(() => result.current.togglePause());
    expect(result.current.isPaused).toBe(true);

    play(30);
    expect(result.current.conveyorSubjects).toEqual(opening);
    expect(result.current.isPaused).toBe(true);

    act(() => result.current.togglePause());
    expect(result.current.isPaused).toBe(false);
    play(30);
    const ids = opening.map((s) => s.id);
    expect(
      result.current.conveyorSubjects.some((s) => !ids.includes(s.id))
    ).toBe(true);
  });

  it("leaves a queued subject's deadline where it was while paused", () => {
    const { result } = startShift();
    play(30);
    const [first] = result.current.conveyorSubjects;
    expect(first).toBeDefined();

    act(() => result.current.togglePause());
    const before = result.current.conveyorSubjects.find(
      (s) => s.id === first.id
    );
    play(10);
    const after = result.current.conveyorSubjects.find(
      (s) => s.id === first.id
    );
    expect(after).toEqual(before);
  });
});
