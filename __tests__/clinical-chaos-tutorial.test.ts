import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useClinicalChaosSession } from "@/components/clinical-trial-chaos/useClinicalChaosSession";
import type { CabinetTutorialValue } from "@/components/arcade/tutorial";
import {
  CLINICAL_CHAOS_TUTORIAL_SIGNALS,
  chargeTutorialLifelines,
  createInitialPowerUpInventory,
} from "@/lib/clinical-trial-chaos";

/**
 * Clinical Trial Chaos's guided tutorial (#3458): starting it clocks in a
 * practice shift with full lifelines and no calibration, its clocks stand
 * still, it hears the player's actions, and ending it clocks out without
 * keeping anything.
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

/** Renders the session under a tutorial whose `active` flag the test sets. */
function renderTutorial() {
  const signal = vi.fn();
  const hook = renderHook(
    ({ active }: { active: boolean }) => {
      const tutorial: CabinetTutorialValue = {
        active,
        stepId: active ? "cycle" : null,
        signal,
      };
      return useClinicalChaosSession({
        touch: false,
        readReducedMotion: () => false,
        readCalmMotion: () => false,
        tutorial,
      });
    },
    { initialProps: { active: false } }
  );
  return { ...hook, signal };
}

beforeEach(() => {
  window.localStorage.clear();
  frames = [];
  wallClock = Date.parse("2026-11-11T12:00:00Z");
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

describe("chargeTutorialLifelines", () => {
  it("fills every lifeline to its full charge", () => {
    const charged = chargeTutorialLifelines(createInitialPowerUpInventory());
    for (const lifeline of Object.values(charged)) {
      expect(lifeline.charge).toBe(lifeline.maxCharge);
    }
  });
});

describe("Clinical Trial Chaos tutorial session", () => {
  it("clocks in a practice shift with full lifelines and no calibration", () => {
    const { result, rerender } = renderTutorial();
    expect(result.current.playState).toBe("idle");

    rerender({ active: true });
    expect(result.current.playState).toBe("playing");
    expect(result.current.calibrationActive).toBe(false);
    for (const lifeline of Object.values(result.current.powerUps)) {
      expect(lifeline.charge).toBe(lifeline.maxCharge);
    }
  });

  it("holds the clocks, so no dossier arrives and no deadline moves", () => {
    const { result, rerender } = renderTutorial();
    rerender({ active: true });
    const opening = result.current.conveyorSubjects;

    play(30);
    expect(result.current.conveyorSubjects.map((s) => s.id)).toEqual(
      opening.map((s) => s.id)
    );
    expect(result.current.conveyorSubjects).toEqual(opening);
  });

  it("hears the player move through the queue", () => {
    const { result, rerender, signal } = renderTutorial();
    rerender({ active: true });
    const [, second] = result.current.conveyorSubjects;
    expect(second).toBeDefined();

    act(() => result.current.setSelectedSubjectId(second.id));
    expect(signal).toHaveBeenCalledWith(CLINICAL_CHAOS_TUTORIAL_SIGNALS.cycle);
  });

  it("hears a lifeline fire", () => {
    const { result, rerender, signal } = renderTutorial();
    rerender({ active: true });

    act(() => result.current.triggerPowerUp("auto-clean"));
    expect(signal).toHaveBeenCalledWith(
      CLINICAL_CHAOS_TUTORIAL_SIGNALS.lifeline
    );
  });

  it("clocks out when it ends and puts the score back", () => {
    const { result, rerender } = renderTutorial();
    const before = result.current.scoreState;
    rerender({ active: true });
    act(() => result.current.triggerPowerUp("auto-clean"));

    rerender({ active: false });
    expect(result.current.playState).toBe("idle");
    expect(result.current.scoreState).toEqual(before);
  });
});
