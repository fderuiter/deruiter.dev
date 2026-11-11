// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  activeCodeBurst,
  createInitialDuckGameState,
  dragDuckTo,
  performTrick,
  releaseDuck,
  startDraggingDuck,
  stepDuckGame,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import {
  TUTORIAL_WORK_CAP,
  WORKING_WITH_DUCK_TUTORIAL,
  WORKING_WITH_DUCK_TUTORIAL_SIGNALS as S,
  duckTutorialSignals,
  holdTutorialMeters,
} from "@/lib/working-with-duck";
import { validateTutorialScript } from "@/lib/arcade";

// Working With Duck's guided tutorial (#3453): meters frozen while it runs,
// and signals read from the state before and after each move.

afterEach(() => {
  vi.restoreAllMocks();
});

function seedRandom(seed: number) {
  let value = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  });
}

function running(level = 1): WorkingWithDuckState {
  return { ...createInitialDuckGameState(level), status: "running" };
}

describe("Working With Duck tutorial meters", () => {
  it.each([1, 7, 42])(
    "freeze for five minutes of idle play on seed %i",
    (seed) => {
      seedRandom(seed);
      let state = running();
      const start = state;
      for (let t = 0; t < 60 * 300; t++) {
        const before = state;
        state = holdTutorialMeters(before, stepDuckGame(before));
        expect(state.status).toBe("running");
        expect(state.excitement).toBeLessThanOrEqual(before.excitement);
        expect(state.bladder).toBeLessThanOrEqual(before.bladder);
        expect(state.thirst).toBeLessThanOrEqual(before.thirst);
        expect(state.hunger).toBeLessThanOrEqual(before.hunger);
        expect(state.naughtyVsGood).toBeGreaterThanOrEqual(
          before.naughtyVsGood
        );
      }
      expect(state.workProgress).toBe(start.workProgress);
      expect(state.excitement).toBeLessThanOrEqual(start.excitement);
      expect(state.bladder).toBeLessThanOrEqual(start.bladder);
    }
  );

  it("lets code bursts add work, but never enough to ship the sprint", () => {
    let state = running();
    for (let t = 0; t < 60 * 120; t++) {
      if (t % 12 === 0) state = activeCodeBurst(state);
      state = holdTutorialMeters(state, stepDuckGame(state));
      expect(state.status).toBe("running");
    }
    expect(state.workProgress).toBeGreaterThan(0);
    expect(state.workProgress).toBeLessThanOrEqual(
      state.targetWorkProgress * TUTORIAL_WORK_CAP
    );
  });

  it("leaves a sprint that is not running alone", () => {
    const idle = createInitialDuckGameState(1);
    const after = { ...idle, excitement: idle.excitement + 10 };
    expect(holdTutorialMeters(idle, after)).toBe(after);
  });
});

describe("Working With Duck tutorial signals", () => {
  it("hears the clock start", () => {
    const idle = createInitialDuckGameState(1);
    expect(duckTutorialSignals(idle, { ...idle, status: "running" })).toEqual([
      S.start,
    ]);
  });

  it("hears a code burst, a trick and a drop", () => {
    const state = running();
    expect(duckTutorialSignals(state, activeCodeBurst(state))).toEqual([
      S.code,
    ]);
    expect(duckTutorialSignals(state, performTrick(state, "SIT"))).toEqual([
      S.trick,
    ]);
    const carried = dragDuckTo(startDraggingDuck(state), 300, 300);
    expect(duckTutorialSignals(carried, releaseDuck(carried))).toEqual([
      S.drop,
    ]);
  });

  it("hears nothing from a plain step", () => {
    const state = running();
    expect(duckTutorialSignals(state, stepDuckGame(state))).toEqual([]);
  });
});

describe("Working With Duck tutorial script", () => {
  it("is a sound script that practises every signal the game sends", () => {
    expect(WORKING_WITH_DUCK_TUTORIAL.gameId).toBe("working-with-duck");
    expect(validateTutorialScript(WORKING_WITH_DUCK_TUTORIAL)).toEqual([]);
    const practised = new Set(
      WORKING_WITH_DUCK_TUTORIAL.steps.flatMap((step) =>
        step.practice ? [step.practice.signal] : []
      )
    );
    expect([...practised].sort()).toEqual(Object.values(S).sort());
  });
});
