// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  pauseGame,
  paceMeters,
  setRules,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin/engine";
import { EMPTY_COURSE, PX_PER_METER } from "@/lib/garmin/course";
import { EMPTY_PROPS } from "@/lib/garmin/props";

// The run clock and auto lap splits (#2018): game time while playing, a lap
// per stage clear.

const DT = 16;
let clock = 0;

beforeEach(() => {
  clock = 7_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run past its GPS lock on a bare course. */
function run(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix"),
    course: EMPTY_COURSE,
    props: EMPTY_PROPS,
    foes: [],
    obstacles: [],
    gpsMs: 0,
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A run standing just short of stage `stage`'s finish pole. */
function atPole(stage: number, overrides: Partial<GameEngineState> = {}) {
  const poleX = stage * 10000 - 60;
  return run({
    stage,
    course: { ...EMPTY_COURSE, poles: [{ x: poleX, stage }] },
    distanceMeters: (poleX - PLAYER_X) / PX_PER_METER,
    isGrounded: true,
    playerY: GROUND_Y - PLAYER_HEIGHT,
    ...overrides,
  });
}

describe("run clock (#2018)", () => {
  it("starts at zero and counts game time while playing", () => {
    let s = run();
    expect(s.runClockMs).toBe(0);
    for (let i = 0; i < 10; i++) s = updateGameSimulation(s, DT);
    expect(s.runClockMs).toBe(160);
  });

  it("does not count the GPS hold", () => {
    let s = run({ gpsMs: 1000 });
    s = updateGameSimulation(s, 500);
    expect(s.runClockMs).toBe(0);
  });

  it("stops while paused and after the run ends", () => {
    const paused = pauseGame(run({ runClockMs: 5000 }), clock);
    expect(updateGameSimulation(paused, 1000).runClockMs).toBe(5000);
    const over = run({ runClockMs: 9000, gameState: "summary" });
    expect(updateGameSimulation(over, 1000).runClockMs).toBe(9000);
  });

  it("keeps the furthest distance when a lost life sets the runner back", () => {
    let s = run({ distanceMeters: 400, furthestMeters: 0 });
    s = updateGameSimulation(s, DT);
    const furthest = s.furthestMeters ?? 0;
    expect(furthest).toBeGreaterThanOrEqual(400);
    s = updateGameSimulation({ ...s, distanceMeters: 100 }, DT);
    expect(s.furthestMeters).toBe(furthest);
  });

  it("measures pace on the furthest distance reached", () => {
    expect(paceMeters({ distanceMeters: 100, furthestMeters: 400 })).toBe(400);
    expect(paceMeters({ distanceMeters: 500, furthestMeters: 400 })).toBe(500);
    expect(paceMeters({ distanceMeters: Number.NaN })).toBe(0);
  });

  it("ignores a bad delta", () => {
    const s = run({ runClockMs: 100 });
    expect(updateGameSimulation(s, Number.NaN).runClockMs).toBe(100);
  });

  it("keeps counting in Dev Mode", () => {
    const dev = {
      ...startGame(createInitialState("fenix", 0), "fenix"),
      course: EMPTY_COURSE,
      props: EMPTY_PROPS,
      foes: [],
      obstacles: [],
      lastObstacleTime: clock + 1e9,
      lastAllocTime: clock + 1e9,
    };
    expect(updateGameSimulation(dev, DT).runClockMs).toBe(DT);
  });
});

describe("auto lap splits (#2018)", () => {
  it("records a split at the stage clear and starts the next lap", () => {
    const s = updateGameSimulation(
      atPole(1, { runClockMs: 64_364, lapStartMs: 0 }),
      DT
    );
    expect(s.stage).toBe(2);
    expect(s.lapSplits).toEqual([64_380]);
    expect(s.lapStartMs).toBe(64_380);
    expect(s.banner?.text).toMatch(/^LAP 1 · 1:04\.38/);
  });

  it("colours the lap banner by the best split for that lap", () => {
    const faster = updateGameSimulation(
      atPole(1, { runClockMs: 60_000, bestSplits: [70_000] }),
      DT
    );
    expect(faster.banner?.tone).toBe("good");
    const slower = updateGameSimulation(
      atPole(1, { runClockMs: 80_000, bestSplits: [70_000] }),
      DT
    );
    expect(slower.banner?.tone).toBe("warn");
  });

  it("calls a negative split when a lap beats the one before", () => {
    const s = updateGameSimulation(
      atPole(2, {
        runClockMs: 130_000,
        lapStartMs: 70_000,
        lapSplits: [70_000],
      }),
      DT
    );
    expect(s.lapSplits).toEqual([70_000, 60_016]);
    expect(s.popups?.map((p) => p.text)).toContain("NEGATIVE SPLIT");
  });

  it("records the last lap when the 5K finishes", () => {
    const s = updateGameSimulation(
      atPole(5, {
        runClockMs: 330_000,
        lapStartMs: 264_000,
        lapSplits: [66_000, 66_000, 66_000, 66_000],
      }),
      DT
    );
    expect(s.gameState).toBe("summary");
    expect(s.lapSplits).toHaveLength(5);
    expect(s.runClockMs).toBe(330_016);
  });
});
