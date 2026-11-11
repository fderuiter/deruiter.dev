// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  setRules,
  setRunInput,
  startGame,
  updateGameSimulation,
  pressJump,
  type GameEngineState,
} from "@/lib/garmin/engine";
import { START_LIVES } from "@/lib/garmin/powerups";
import {
  GARMIN_TUTORIAL,
  GARMIN_TUTORIAL_SIGNALS,
  TUTORIAL_BODY_BATTERY_FLOOR,
  keepTutorialRunSafe,
} from "@/lib/garmin/tutorial";
import { validateTutorialScript } from "@/lib/arcade";

// Monkey C Mayhem's guided tutorial (#3452): a practice run that nothing can
// end, and a script that practises only the signals the watch sends.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 5_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function freshRun(seed = 7): GameEngineState {
  const started = startGame(
    setRules(createInitialState("fenix", 0, []), "fitness"),
    "fenix"
  );
  // A fixed seed's stage, so the course has gaps and foes to clear.
  return { ...started, courseSeed: seed };
}

describe("Monkey C Mayhem tutorial run", () => {
  it("leaves a watch that is not running alone", () => {
    const idle = createInitialState("fenix", 0, []);
    expect(keepTutorialRunSafe(idle)).toBe(idle);
  });

  it("returns the same state when there is nothing to clear", () => {
    const safe = keepTutorialRunSafe(freshRun());
    expect(keepTutorialRunSafe(safe)).toBe(safe);
  });

  it("clears gaps, racks, bugs and foes, and tops up Body Battery and lives", () => {
    const run = freshRun();
    const risky: GameEngineState = {
      ...run,
      lives: 1,
      bodyBattery: { value: 3, bonked: true },
      course: {
        ...run.course!,
        gaps: [{ x: 300, width: 40 }] as never,
        ceilings: [{ x: 400, width: 40 }] as never,
      },
      obstacles: [{ type: "null_pointer" }] as never,
      foes: [{ kind: "kettlebell" }] as never,
      foeShots: [{ kind: "kettlebell" }] as never,
    };
    const safe = keepTutorialRunSafe(risky);
    expect(safe.course?.gaps).toEqual([]);
    expect(safe.course?.ceilings).toEqual([]);
    expect(safe.obstacles).toEqual([]);
    expect(safe.foes).toEqual([]);
    expect(safe.foeShots).toEqual([]);
    expect(safe.lives).toBe(START_LIVES);
    expect(safe.bodyBattery).toEqual({
      value: TUTORIAL_BODY_BATTERY_FLOOR,
      bonked: false,
    });
  });

  it.each([1, 7, 42])(
    "survives a minute of sprinting and jumping on seed %i",
    (seed) => {
      let state = keepTutorialRunSafe(setRunInput(freshRun(seed), 1));
      const startLives = state.lives;
      for (let frame = 0; frame < 60 * 60; frame++) {
        clock += FRAME;
        if (frame % 45 === 0) state = pressJump(state);
        state = keepTutorialRunSafe(updateGameSimulation(state, FRAME));
        expect(state.gameState).toBe("playing");
        expect(state.lives).toBe(startLives);
        expect(state.bodyBattery?.bonked ?? false).toBe(false);
      }
      // The runner went somewhere, so the run was not simply standing still.
      expect(state.distanceMeters).toBeGreaterThan(100);
    }
  );
});

describe("Monkey C Mayhem tutorial script", () => {
  it("is a sound script for the garmin-watch cabinet", () => {
    expect(GARMIN_TUTORIAL.gameId).toBe("garmin-watch");
    expect(validateTutorialScript(GARMIN_TUTORIAL)).toEqual([]);
  });

  it("practises every signal the watch sends", () => {
    const practised = new Set(
      GARMIN_TUTORIAL.steps.flatMap((step) =>
        step.practice ? [step.practice.signal] : []
      )
    );
    expect([...practised].sort()).toEqual(
      Object.values(GARMIN_TUTORIAL_SIGNALS).sort()
    );
  });

  it("teaches the Dev Mode meters in a read step", () => {
    const dev = GARMIN_TUTORIAL.steps.find((step) => step.id === "dev-mode");
    expect(dev?.practice).toBeUndefined();
    expect(dev?.body).toMatch(/heap/);
    expect(dev?.body).toMatch(/flash/i);
    expect(dev?.body).toMatch(/watchdog/);
  });
});
