// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_X,
  createInitialState,
  pauseGame,
  pressJump,
  releaseJump,
  resumeGame,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  FIXED_STEP_MS,
  SATURDAY_SEED,
  dailySeed,
  fixedSteps,
  raceSetup,
  type RaceSetup,
} from "@/lib/garmin/race";
import type { Pickup } from "@/lib/garmin/powerups";
import { BLOCK_SIZE, EMPTY_COURSE } from "@/lib/garmin/course";

// The race engine (#2019): seeded determinism, the fixed step, the race
// counters and the race clocks. A Training Run is checked alongside to show it
// keeps its random course and wall clock.

const FRAME = 1000 / 60;
const MORNING = new Date(2026, 9, 14, 8, 15);
const SATURDAY: RaceSetup = raceSetup("saturday5k", "any", MORNING);

afterEach(() => {
  vi.restoreAllMocks();
});

/** A deterministic, varied stand-in for Math.random, started at `offset`. */
function sequence(offset: number): () => number {
  let i = offset;
  return () => {
    i += 1;
    return (i * 0.6180339887) % 1;
  };
}

/** Runs `fn` with the wall clock and Math.random pinned to other values. */
function withWallClock<T>(now: number, offset: number, fn: () => T): T {
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.spyOn(Math, "random").mockImplementation(sequence(offset));
  return fn();
}

/** A race started on `setup`, with the GPS lock already passed. */
function startRace(setup: RaceSetup = SATURDAY): GameEngineState {
  return startGame(
    setRules(createInitialState("fenix", 0, []), "dev"),
    "fenix",
    undefined,
    setup
  );
}

/** Plays `frames` fixed steps with a scripted jump every 45 steps. */
function playScript(setup: RaceSetup, frames: number): GameEngineState {
  let state = startRace(setup);
  for (let step = 0; step < frames; step++) {
    if (step % 45 === 0) state = pressJump(state);
    if (step % 45 === 18) state = releaseJump(state);
    state = updateGameSimulation(state, FIXED_STEP_MS);
  }
  return state;
}

/** Runs `total` fixed steps fed by frames of `frameMs`, with the same script. */
function advanceSteps(total: number, frameMs: number): GameEngineState {
  let state = startRace();
  let carry = 0;
  let done = 0;
  while (done < total) {
    const next = fixedSteps(carry, frameMs);
    carry = next.carryMs;
    for (let i = 0; i < next.steps && done < total; i++) {
      if (done % 45 === 0) state = pressJump(state);
      if (done % 45 === 18) state = releaseJump(state);
      state = updateGameSimulation(state, FIXED_STEP_MS);
      done++;
    }
  }
  return state;
}

/** A state with the GPS lock passed, so the runner moves at once. */
function moving(state: GameEngineState): GameEngineState {
  return { ...state, gpsMs: 0 };
}

describe("startGame with a race", () => {
  it("records the race and zeroes its counters", () => {
    const state = startRace();
    expect(state.race).toEqual(SATURDAY);
    expect(state.simMs).toBe(0);
    expect(state.kudosMissed).toBe(0);
    expect(state.gearTaken).toBe(false);
    expect(state.bonkedMs).toBe(0);
    expect(state.lastObstacleTime).toBe(0);
    expect(state.lastAllocTime).toBe(0);
  });

  it("runs the race's seed and starts at full Body Battery", () => {
    const state = startRace(raceSetup("daily", "any", MORNING));
    expect(state.courseSeed).toBe(dailySeed(MORNING));
    expect(state.bodyBattery?.value).toBe(100);
  });

  it("forces fitness rules even when Dev Mode is set or pending", () => {
    const dev = {
      ...createInitialState("fenix", 0, []),
      rules: "dev" as const,
    };
    expect(startGame(dev, "fenix", undefined, SATURDAY).rules).toBe("fitness");

    const pending = {
      ...createInitialState("fenix", 0, []),
      rules: "fitness" as const,
      pendingRules: "dev" as const,
    };
    expect(startGame(pending, "fenix", undefined, SATURDAY).rules).toBe(
      "fitness"
    );
  });

  it("leaves a Training Run on the random course and wall clock", () => {
    const spy = vi.spyOn(Math, "random");
    vi.spyOn(Date, "now").mockReturnValue(5000);
    const training = startGame(createInitialState("fenix", 0, []), "fenix");
    expect(spy).toHaveBeenCalled();
    expect(training.race).toBeUndefined();
    expect(training.simMs).toBeUndefined();
    expect(training.kudosMissed).toBeUndefined();
    expect(training.lastObstacleTime).toBe(5000);
  });
});

describe("seeded determinism", () => {
  it("gives the same states for the same race, whatever the clock and random", () => {
    const first = withWallClock(1_000, 3, () => playScript(SATURDAY, 3000));
    const second = withWallClock(9_999_999, 911, () =>
      playScript(SATURDAY, 3000)
    );
    expect(first.lastObstacleTime).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(second.runClockMs).toBe(first.runClockMs);
    expect(second.distanceMeters).toBe(first.distanceMeters);
    expect(second.obstacles).toEqual(first.obstacles);
  });

  it("never reads the wall clock or Math.random during a race", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    playScript(SATURDAY, 1500);
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it("gives a different course for a different seed", () => {
    const saturday = playScript(SATURDAY, 600);
    const daily = playScript(raceSetup("daily", "any", MORNING), 600);
    expect(dailySeed(MORNING)).not.toBe(SATURDAY_SEED);
    expect(daily.course).not.toEqual(saturday.course);
  });

  it("steps identically however the frames were chunked", () => {
    const total = 1200;
    const at60 = advanceSteps(total, FRAME);
    const at30 = advanceSteps(total, 1000 / 30);
    const at144 = advanceSteps(total, 1000 / 144);
    const at6 = advanceSteps(total, 6.94);
    expect(at30).toEqual(at60);
    expect(at144).toEqual(at60);
    expect(at6).toEqual(at60);
  });
});

describe("race counters", () => {
  it("counts a lane Kudos the runner passes uncollected", () => {
    let state = moving(startRace());
    state = {
      ...state,
      course: {
        ...(state.course ?? EMPTY_COURSE),
        kudos: [{ id: 1, x: -200, y: 100 }],
      },
    };
    state = updateGameSimulation(state, FRAME);
    expect(state.kudosMissed).toBe(1);
    expect(state.course?.kudos).toHaveLength(0);
  });

  it("does not count a Kudos the runner collects", () => {
    let state = moving(startRace());
    state = {
      ...state,
      course: {
        ...(state.course ?? EMPTY_COURSE),
        kudos: [{ id: 1, x: PLAYER_X + 5, y: GROUND_Y - PLAYER_HEIGHT / 2 }],
      },
    };
    state = updateGameSimulation(state, FRAME);
    expect(state.kudos).toBe(1);
    expect(state.kudosMissed).toBe(0);
  });

  it("counts a Rest Day brick that was a lane Kudos once it is passed", () => {
    let state = moving(startRace());
    state = {
      ...state,
      course: {
        ...(state.course ?? EMPTY_COURSE),
        kudos: [{ id: 2, x: -200, y: 100, fromBrick: true }],
        blocks: [
          {
            id: 1,
            x: -200,
            y: 100,
            kind: "brick",
            contents: "kudos",
            used: true,
            fromKudos: true,
          },
        ],
      },
    };
    state = updateGameSimulation(state, FRAME);
    // The brick-born Kudos is a Rest Day bonus, not a lane Kudos.
    expect(state.kudosMissed).toBe(1);
  });

  it("re-offers after a lost life only the lane Kudos still to come", () => {
    const fresh = startRace().course ?? EMPTY_COURSE;
    const live = fresh.kudos.slice(-2);
    let state = moving(startRace());
    state = {
      ...state,
      lives: 3,
      invulnerableMs: 0,
      course: { ...fresh, kudos: live },
      obstacles: [
        {
          id: 1,
          x: PLAYER_X + 4,
          y: GROUND_Y - 20,
          width: 16,
          height: 20,
          type: "null_pointer",
          label: "NULL",
          speed: 0,
        },
      ],
    };
    state = updateGameSimulation(state, FRAME);
    expect(state.lives).toBe(2);
    expect(state.course?.kudos.map((k) => k.id)).toEqual(live.map((k) => k.id));
    state = updateGameSimulation(state, FRAME);
    expect(state.kudosMissed).toBe(0);
  });

  it("does not count missed Kudos in a Training Run", () => {
    let state = startGame(createInitialState("fenix", 0, []), "fenix");
    state = {
      ...state,
      gpsMs: 0,
      course: {
        ...(state.course ?? EMPTY_COURSE),
        kudos: [{ id: 1, x: -200, y: 100 }],
      },
    };
    state = updateGameSimulation(state, FRAME);
    expect(state.kudosMissed).toBeUndefined();
  });

  it("pays Kudos for a gear Sync Block in a No Gear race, and pops gear otherwise", () => {
    const bump = (category: RaceSetup["category"]) => {
      const race = moving(startRace({ ...SATURDAY, category }));
      return updateGameSimulation(
        {
          ...race,
          course: {
            ...EMPTY_COURSE,
            blocks: [
              {
                id: 1,
                x: PLAYER_X,
                y: 150,
                kind: "sync",
                contents: "power",
                used: false,
              },
            ],
          },
          playerY: 150 + BLOCK_SIZE + 2,
          playerVy: -8,
          isGrounded: false,
        },
        FIXED_STEP_MS
      );
    };
    const nogear = bump("nogear");
    expect(nogear.course?.blocks[0].used).toBe(true);
    expect(nogear.kudos).toBe(1);
    expect(nogear.pickups ?? []).toHaveLength(0);
    const any = bump("any");
    expect(any.kudos).toBe(0);
    expect(any.pickups ?? []).toHaveLength(1);
  });

  it("sets gearTaken when a power-up is collected", () => {
    let state = moving(startRace());
    const shake: Pickup = {
      id: 1,
      kind: "shake",
      x: PLAYER_X + 2,
      y: GROUND_Y - PLAYER_HEIGHT + 2,
      vx: 0,
      vy: 0,
      emergeMs: 0,
    };
    state = updateGameSimulation({ ...state, pickups: [shake] }, FRAME);
    expect(state.gearTaken).toBe(true);
  });

  it("sets gearTaken when the training buddy joins", () => {
    let state = moving(startRace());
    const buddy: Pickup = {
      id: 2,
      kind: "buddy",
      x: PLAYER_X + 2,
      y: GROUND_Y - PLAYER_HEIGHT + 2,
      vx: 0,
      vy: 0,
      emergeMs: 0,
    };
    state = updateGameSimulation({ ...state, pickups: [buddy] }, FRAME);
    expect(state.riding).toBe(true);
    expect(state.gearTaken).toBe(true);
  });

  it("accumulates bonked time only while bonked", () => {
    let state = moving(startRace());
    state = {
      ...state,
      bodyBattery: { value: 0, bonked: true },
    };
    let expected = 0;
    for (let step = 0; step < 12; step++) {
      if (state.bodyBattery?.bonked) expected += FRAME;
      state = updateGameSimulation(state, FRAME);
    }
    expect(expected).toBeGreaterThan(0);
    expect(state.bonkedMs).toBeCloseTo(expected, 6);
  });
});

describe("race clocks", () => {
  it("advances simMs on playing ticks, GPS lock included, and not the run clock", () => {
    let state = startRace();
    expect(state.gpsMs ?? 0).toBeGreaterThan(0);
    state = updateGameSimulation(state, FRAME);
    expect(state.simMs).toBeCloseTo(FRAME, 9);
    expect(state.runClockMs).toBe(0);
  });

  it("stops simMs while paused", () => {
    let state = updateGameSimulation(startRace(), FRAME);
    state = pauseGame(state, 0);
    const paused = updateGameSimulation(state, FRAME);
    expect(paused.simMs).toBeCloseTo(FRAME, 9);
  });

  it("does not shift a race's timers on resume", () => {
    let state = moving(startRace());
    for (let step = 0; step < 30; step++) {
      state = updateGameSimulation(state, FRAME);
    }
    const { lastObstacleTime, lastAllocTime } = state;
    const paused = pauseGame(state);
    const resumed = resumeGame(paused, 1e12);
    expect(resumed.lastObstacleTime).toBe(lastObstacleTime);
    expect(resumed.lastAllocTime).toBe(lastAllocTime);
  });

  it("shifts a Training Run's timers on resume by the paused time", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const state = startGame(createInitialState("fenix", 0, []), "fenix");
    const paused = pauseGame(state, 20_000);
    const resumed = resumeGame(paused, 23_000);
    expect(resumed.lastObstacleTime).toBe(state.lastObstacleTime + 3000);
  });
});
