import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  createInitialState,
  paceMeters,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  stagePoleX,
  stageStartX,
} from "@/lib/garmin-course";
import {
  FOE_SIZE,
  REPMAX_GRACE_MS,
  damageFoe,
  makeFoe,
  stompFoe,
  type Foe,
} from "@/lib/garmin-foes";
import { PLAN_SEED, type PlanRun } from "@/lib/garmin-plan";
import { EMPTY_PROPS } from "@/lib/garmin-props";
import { startSecondWind } from "@/lib/garmin-second-wind";
import {
  BRICK_VX,
  WALL_CHARGE_END_X,
  WALL_ENTER_X,
  WALL_HOLD_X,
  WALL_HP,
  WALL_PATTERN,
  WALL_SPAWN_LEAD,
  brickTimes,
  findWall,
  spawnWall,
  stepRaceDay,
  stepWall,
  wallBannerText,
  wallPhase,
} from "@/lib/garmin-raceday";

// Race Day and The Wall (#1994): workouts on one stage in the engine, the
// steady race pace, The Wall's three-hit pattern, and the finish it holds
// back until it is beaten.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 9_400_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const TEMPO: PlanRun = { stage: 2, seed: PLAN_SEED, raceDay: false };
const RACE_DAY: PlanRun = { stage: 5, seed: PLAN_SEED, raceDay: true };

/** A workout started on `run`, past the GPS lock, with nothing spawning. */
function workout(
  run: PlanRun,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix",
      undefined,
      undefined,
      run
    ),
    gpsMs: 0,
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** The camera x a state shows. */
const cameraOf = (s: GameEngineState) => s.distanceMeters * PX_PER_METER;

/** Race Day with the runner `lead` world pixels short of The Wall's spawn point, on a bare lane. */
function nearWall(lead = 0): GameEngineState {
  const runnerX = stagePoleX(5) - WALL_SPAWN_LEAD - lead;
  return workout(RACE_DAY, {
    distanceMeters: (runnerX - PLAYER_X) / PX_PER_METER,
    foes: [],
    course: {
      ...EMPTY_COURSE,
      poles: [{ x: stagePoleX(5), stage: 5 }],
    },
  });
}

describe("Training Plan workouts in the engine (#1994)", () => {
  it("start on their stage of the plan's course, the same every time", () => {
    const a = workout(TEMPO);
    const b = workout(TEMPO);
    expect(a.plan).toEqual(TEMPO);
    expect(a.stage).toBe(2);
    expect(a.courseSeed).toBe(PLAN_SEED);
    expect(a.distanceMeters).toBe(stageStartX(2) / PX_PER_METER);
    expect(a.course).toEqual(b.course);
    expect(a.foes).toEqual(b.foes);
  });

  it("leave other runs as they were", () => {
    const run = startGame(createInitialState("fenix", 0, []), "fenix");
    expect(run.plan).toBeUndefined();
    expect(run.stage).toBe(1);
    expect(run.distanceMeters).toBe(0);
  });

  it("end at their own pole, while a Training Run goes on to the next stage", () => {
    const atPole = (s: GameEngineState): GameEngineState => ({
      ...s,
      distanceMeters:
        (stagePoleX(2) - PLAYER_X - PLAYER_WIDTH + 4) / PX_PER_METER,
      playerY: GROUND_Y - PLAYER_HEIGHT,
      isGrounded: true,
      foes: [],
      course: { ...EMPTY_COURSE, poles: [{ x: stagePoleX(2), stage: 2 }] },
    });
    const done = updateGameSimulation(atPole(workout(TEMPO)), FRAME);
    expect(done.gameState).toBe("summary");
    expect(done.lapSplits).toHaveLength(1);
    const training = updateGameSimulation(
      atPole({ ...workout(TEMPO), plan: null }),
      FRAME
    );
    expect(training.gameState).toBe("playing");
    expect(training.stage).toBe(3);
  });

  it("measure pace from the start of the stage", () => {
    const s = workout(TEMPO);
    expect(paceMeters(s)).toBe(0);
    expect(paceMeters({ ...s, distanceMeters: s.distanceMeters + 120 })).toBe(
      120
    );
    expect(paceMeters({ distanceMeters: 120 })).toBe(120);
  });

  it("hold Race Day at a steady race pace, whatever the pace keys say", () => {
    const run = (plan: PlanRun, runInput: -1 | 0 | 1) => {
      let s = workout(plan, { foes: [], runInput });
      const start = s.distanceMeters;
      for (let i = 0; i < 30; i++) s = updateGameSimulation(s, FRAME);
      return s.distanceMeters - start;
    };
    expect(run(RACE_DAY, 1)).toBeCloseTo(run(RACE_DAY, 0), 6);
    expect(run(RACE_DAY, -1)).toBeCloseTo(run(RACE_DAY, 0), 6);
    expect(run(TEMPO, 1)).toBeGreaterThan(run(TEMPO, 0));
  });
});

describe("The Wall as a foe (#1994)", () => {
  const wall = (): Foe => ({ ...makeFoe(1, "wall", 0, GROUND_Y), hp: WALL_HP });

  it("loses one hit point to a stomp or any other hit, with a grace after", () => {
    const stomped = stompFoe(wall(), 0).foe;
    expect(stomped?.hp).toBe(WALL_HP - 1);
    expect(stomped?.graceMs).toBe(REPMAX_GRACE_MS);
    expect(damageFoe(stomped as Foe, 99)).toEqual({ foe: stomped, score: 0 });
    const bolted = damageFoe(wall(), 99).foe;
    expect(bolted?.hp).toBe(WALL_HP - 1);
  });

  it("falls on its last hit point", () => {
    expect(damageFoe({ ...wall(), hp: 1 }, 1).foe).toBeNull();
  });

  it("is hit by a runner landing on it in the engine", () => {
    const foe = { ...wall(), x: PLAYER_X - 1 + stageStartX(5) };
    const s = workout(RACE_DAY, {
      foes: [foe],
      playerY: foe.y - PLAYER_HEIGHT + 4,
      playerVy: 2,
      isGrounded: false,
    });
    const next = updateGameSimulation(
      { ...s, distanceMeters: stageStartX(5) / PX_PER_METER },
      FRAME
    );
    expect(findWall(next.foes)?.hp).toBe(WALL_HP - 1);
    expect(next.playerVy).toBeLessThan(0);
    expect(next.lives).toBe(s.lives);
  });

  it("is never a Fun Run high five", () => {
    const foe = { ...wall(), x: PLAYER_X - 1 + stageStartX(5) };
    const s = workout(RACE_DAY, {
      foes: [foe],
      secondWind: startSecondWind("funrun", 5),
      distanceMeters: stageStartX(5) / PX_PER_METER,
    });
    const next = updateGameSimulation(s, FRAME);
    // Touching it costs a life, as it would without the Fun Run.
    expect(next.lives).toBe((s.lives ?? 3) - 1);
    expect(next.popups?.some((p) => p.text === "HIGH FIVE!")).toBeFalsy();
  });
});

describe("The Wall's pattern (#1994)", () => {
  it("charges faster and throws more bricks after each hit", () => {
    expect(wallPhase(3)).toBe(WALL_PATTERN[3]);
    expect(wallPhase(9)).toBe(WALL_PATTERN[3]);
    expect(wallPhase(0)).toBe(WALL_PATTERN[1]);
    expect(WALL_PATTERN[2].chargeSpeed).toBeGreaterThan(
      WALL_PATTERN[3].chargeSpeed
    );
    expect(WALL_PATTERN[1].chargeSpeed).toBeGreaterThan(
      WALL_PATTERN[2].chargeSpeed
    );
    expect([3, 2, 1].map((hp) => wallPhase(hp).bricks)).toEqual([0, 1, 2]);
    expect(brickTimes(WALL_PATTERN[1]).map(Math.round)).toEqual([733, 367]);
  });

  it("walks in to its hold, holds, charges past the runner and comes back in", () => {
    let w = spawnWall(0);
    expect(w.x).toBe(WALL_ENTER_X);
    expect(w.hp).toBe(WALL_HP);
    const modes: string[] = [];
    let shotId = 0;
    let shots = 0;
    for (let i = 0; i < 600; i++) {
      const stepped = stepWall(w, 0, FRAME, shotId);
      shotId = stepped.nextShotId;
      shots += stepped.shots.length;
      w = stepped.wall;
      if (modes.at(-1) !== w.mode) modes.push(w.mode);
      expect(w.y).toBe(GROUND_Y - FOE_SIZE.wall.height);
      expect(w.x).toBeGreaterThanOrEqual(WALL_CHARGE_END_X - 4);
      expect(w.x).toBeLessThanOrEqual(WALL_ENTER_X);
    }
    // Hold, charge, back in to hold, charge again...
    expect(modes.slice(0, 4)).toEqual(["idle", "walk", "idle", "walk"]);
    expect(shots).toBe(0);
  });

  it("throws its bricks low, at the runner, while it holds", () => {
    const count = (hp: number) => {
      let w: Foe = { ...spawnWall(0), hp, x: WALL_HOLD_X };
      w = { ...w, timerMs: wallPhase(hp).holdMs };
      const thrown = [];
      while (w.mode === "idle") {
        const stepped = stepWall(w, 0, FRAME, thrown.length);
        thrown.push(...stepped.shots);
        w = stepped.wall;
      }
      return thrown;
    };
    expect(count(3)).toHaveLength(0);
    expect(count(2)).toHaveLength(1);
    const bricks = count(1);
    expect(bricks).toHaveLength(2);
    for (const b of bricks) {
      expect(b.kind).toBe("brick");
      expect(b.vx).toBe(BRICK_VX);
      // Low enough to jump: its top is under a standing runner's head.
      expect(b.y).toBeGreaterThan(GROUND_Y - PLAYER_HEIGHT);
    }
    expect(new Set(bricks.map((b) => b.id)).size).toBe(2);
  });

  it("keeps its place on the face as the camera moves", () => {
    const w = { ...spawnWall(0), x: 500 + WALL_HOLD_X, timerMs: 1000 };
    expect(stepWall(w, 500, FRAME, 0).wall.x).toBe(500 + WALL_HOLD_X);
  });
});

describe("Race Day (#1994)", () => {
  it("leaves any other run alone", () => {
    const tempo = workout(TEMPO);
    expect(stepRaceDay(tempo, tempo, FRAME)).toBe(tempo);
  });

  it("brings The Wall out near the finish, and holds the finish off the face", () => {
    const early = nearWall(20);
    expect(stepRaceDay(early, early, FRAME)).toBe(early);
    const s = nearWall();
    const next = stepRaceDay(s, s, FRAME);
    const wall = findWall(next.foes);
    expect(wall?.hp).toBe(WALL_HP);
    expect(next.banner?.text).toBe(wallBannerText(WALL_HP));
    expect(next.course?.poles[0].x).toBeGreaterThanOrEqual(
      cameraOf(s) + CANVAS_SIZE + 60
    );
    // Once the runner closes in, the finish moves on ahead of them.
    const closer = { ...next, distanceMeters: next.distanceMeters + 30 };
    const held = stepRaceDay(next, closer, FRAME);
    expect(held.course?.poles[0].x).toBe(cameraOf(closer) + CANVAS_SIZE + 60);
  });

  it("starts the next pattern after a hit", () => {
    const s = nearWall();
    const up = stepRaceDay(s, s, FRAME);
    const wall = findWall(up.foes) as Foe;
    const hit = {
      ...up,
      foes: [
        { ...wall, hp: 2, graceMs: REPMAX_GRACE_MS, mode: "walk" as const },
      ],
    };
    const next = stepRaceDay(up, hit, FRAME);
    const after = findWall(next.foes);
    expect(after?.mode).toBe("idle");
    expect(after?.hp).toBe(2);
    expect(after?.timerMs).toBe(WALL_PATTERN[2].holdMs);
    expect(next.banner?.text).toBe("THE WALL · 2 TO GO");
  });

  it("is won when The Wall falls with no life lost, and the finish comes back", () => {
    const s = nearWall();
    const up = stepRaceDay(s, s, FRAME);
    const wall = findWall(up.foes) as Foe;
    const last = { ...up, foes: [{ ...wall, hp: 1 }] };
    const down = stepRaceDay(last, { ...last, foes: [] }, FRAME);
    expect(down.wallDown).toBe(true);
    expect(down.banner?.text).toBe("THE WALL IS DOWN · FINISH!");
    // The finish stops moving, so the runner reaches it.
    const later = { ...down, distanceMeters: down.distanceMeters + 5 };
    expect(stepRaceDay(down, later, FRAME)).toBe(later);
  });

  it("is not beaten when The Wall leaves with hit points to spare", () => {
    const s = nearWall();
    const up = stepRaceDay(s, s, FRAME);
    const gone = stepRaceDay(up, { ...up, foes: [] }, FRAME);
    expect(gone.wallDown).toBeFalsy();
    // It is back on the next step, still standing between the runner and the finish.
    expect(findWall(gone.foes)).not.toBeNull();
  });

  it("leaves a bonus room alone", () => {
    const s = nearWall();
    const up = stepRaceDay(s, s, FRAME);
    const room = {
      ...up,
      bonusRoom: {
        returnCourse: EMPTY_COURSE,
        returnProps: EMPTY_PROPS,
        returnFoes: [],
        returnPickups: [],
        exitX: 0,
        endX: 0,
      },
    };
    expect(stepRaceDay(up, room, FRAME)).toBe(room);
    expect(
      stepRaceDay(room, { ...room, foes: [] }, FRAME).wallDown
    ).toBeFalsy();
  });

  it("stands The Wall up again when a life is lost after it fell", () => {
    const s = { ...nearWall(), wallDown: true };
    const lost = { ...s, lives: (s.lives ?? 3) - 1 };
    expect(stepRaceDay(s, lost, FRAME).wallDown).toBe(false);
  });

  it("brings The Wall back at full strength after a lost life", () => {
    const s = nearWall();
    const up = stepRaceDay(s, s, FRAME);
    const wall = findWall(up.foes) as Foe;
    const hurt = { ...up, foes: [{ ...wall, hp: 1 }] };
    // A lost life re-lays the stage without The Wall and rewinds the runner.
    const lost = {
      ...hurt,
      foes: [],
      lives: (hurt.lives ?? 3) - 1,
      distanceMeters: stageStartX(5) / PX_PER_METER,
    };
    const next = stepRaceDay(hurt, lost, FRAME);
    expect(next.wallDown).toBeFalsy();
    expect(findWall(next.foes)).toBeNull();
    const back = nearWall();
    const again = stepRaceDay(back, { ...back, lives: lost.lives }, FRAME);
    expect(findWall(again.foes)?.hp).toBe(WALL_HP);
  });

  it("plays out in the engine: the finish never comes while The Wall stands", () => {
    let s = nearWall(40);
    let reached = false;
    for (let i = 0; i < 900 && s.gameState === "playing"; i++) {
      // Invulnerable, so the run goes on while The Wall charges through.
      const before: GameEngineState = { ...s, invulnerableMs: 5000 };
      s = stepRaceDay(before, updateGameSimulation(before, FRAME), FRAME);
      if (findWall(s.foes)) reached = true;
    }
    expect(reached).toBe(true);
    expect(s.gameState).toBe("playing");
    expect(s.wallDown).toBeFalsy();
  });
});
