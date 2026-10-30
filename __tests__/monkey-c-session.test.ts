import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useMonkeyCSession } from "@/components/garmin-watch/useMonkeyCSession";
import { loadBadges } from "@/lib/garmin/badge-store";
import { updateGameSimulation } from "@/lib/garmin/engine";
import { safeClear } from "@/lib/safe-storage";

/**
 * The Garmin Watch (Monkey C) session hook on its own (#3435): the run-mode
 * picker and a badge awarded when a run ends, without rendering the watch.
 * As in garmin-badges-ui.test.tsx, the real engine runs and one step is
 * told to end the run, rather than simulating a whole 5K.
 */

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("@/hooks/useAnimationFrame", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useAnimationFrame")>();
  return {
    ...actual,
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/garmin/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin/engine")>();
  return {
    ...actual,
    updateGameSimulation: vi.fn(actual.updateGameSimulation),
  };
});

/** Runs `n` frames of 1/60 s. */
function frames(n: number) {
  for (let i = 0; i < n; i++) act(() => frame.cb?.(1000 / 60));
}

/** Ends the run on the next engine step: the 5K finished, or out of lives. */
function endNextStep(finished: boolean) {
  vi.mocked(updateGameSimulation).mockImplementationOnce((s) => ({
    ...s,
    gameState: finished ? "summary" : "crashed",
    runClockMs: 280_000,
    distanceMeters: finished ? 5000 : 1200,
    lives: finished ? 2 : 0,
  }));
  frames(1);
}

function renderSession() {
  return renderHook(() => useMonkeyCSession({ prefersReducedMotion: false }));
}

beforeEach(() => {
  frame.cb = null;
  safeClear();
  vi.mocked(updateGameSimulation).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useMonkeyCSession run modes", () => {
  it("switches between a training run, a race and back", () => {
    const { result } = renderSession();
    expect(result.current.raceMode).toBe(false);
    expect(result.current.planMode).toBe(false);

    act(() => result.current.handleSetRunMode("race"));
    expect(result.current.raceMode).toBe(true);
    expect(result.current.planMode).toBe(false);

    act(() => result.current.handleSetRunMode("training"));
    expect(result.current.raceMode).toBe(false);
    expect(result.current.planMode).toBe(false);
  });

  it("switches to the Training Plan with Race Mode off", () => {
    const { result } = renderSession();
    act(() => result.current.handleSetRunMode("plan"));
    expect(result.current.planMode).toBe(true);
    expect(result.current.raceMode).toBe(false);
  });
});

describe("useMonkeyCSession badges", () => {
  it("awards First 5K when a training run finishes, and saves it", () => {
    const { result } = renderSession();
    act(() => result.current.handleStartStop());
    expect(result.current.gameState.gameState).toBe("playing");
    frames(2);
    endNextStep(true);

    expect(result.current.gameState.gameState).toBe("summary");
    expect(result.current.badgeFresh).toContain("first5k");
    expect(result.current.badgeSave?.badges).toHaveProperty("first5k");
    expect(loadBadges().badges).toHaveProperty("first5k");
    expect(loadBadges().runs).toHaveLength(1);
  });

  it("records a crashed run without awarding First 5K", () => {
    const { result } = renderSession();
    act(() => result.current.handleStartStop());
    frames(2);
    endNextStep(false);

    expect(result.current.gameState.gameState).toBe("crashed");
    expect(result.current.badgeFresh).not.toContain("first5k");
    expect(loadBadges().badges).not.toHaveProperty("first5k");
    expect(loadBadges().runs).toHaveLength(1);
  });
});
