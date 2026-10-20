// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_X,
  canSlam,
  createInitialState,
  pressAction,
  pressSlam,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin-course";
import { EMPTY_PROPS, PR_BOARD_SCORE } from "@/lib/garmin-props";
import { FOE_STOMP_SCORE, makeFoe, type Foe } from "@/lib/garmin-foes";
import { MOVE_TOASTS, SLAM_BATTERY_COST, SLAM_VY } from "@/lib/garmin-moves";

// The Burpee Slam (#2023): a fitness-run ground pound that stomps, breaks and
// costs a little Body Battery on landing.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_500_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run on stage 1 with no spawns, on `course`. */
function run(
  overrides: Partial<GameEngineState> = {},
  course: CourseLayout = EMPTY_COURSE
): GameEngineState {
  return {
    ...startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix"
    ),
    course,
    props: EMPTY_PROPS,
    foes: [],
    obstacles: [],
    gpsMs: 0,
    stage: 1,
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A runner in the air at a comfortable height above the lane. */
function airborne(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return run({
    playerY: 140,
    playerVy: 0,
    isGrounded: false,
    ...overrides,
  });
}

/** A runner one frame above the lane, falling at slam speed. */
function aboutToLand(
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return run({
    playerY: GROUND_Y - PLAYER_HEIGHT - 5,
    playerVy: SLAM_VY,
    isGrounded: false,
    slamming: true,
    ...overrides,
  });
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = updateGameSimulation(s, FRAME);
  }
  return s;
}

/** Steps until the runner stands on something, or gives up after a second. */
function untilLanded(state: GameEngineState): GameEngineState {
  let s = state;
  for (let i = 0; i < 60 && !s.isGrounded; i++) {
    s = step(s);
  }
  return s;
}

/** Popups with the text of `text`. */
function toasts(state: GameEngineState, text: string): number {
  return (state.popups ?? []).filter((p) => p.text === text).length;
}

/** World x of the runner's feet at the start of a run, where the test foes and bricks sit. */
const FOOT_X = PLAYER_X + 5;

describe("Burpee Slam: when it can start", () => {
  it("cannot slam on the ground", () => {
    const grounded = run({
      isGrounded: true,
      playerY: GROUND_Y - PLAYER_HEIGHT,
    });
    expect(canSlam(grounded)).toBe(false);
    expect(pressSlam(grounded)).toBe(grounded);
  });

  it("is off in Dev Mode, which keeps its Down (jettison) behaviour", () => {
    const dev = { ...airborne(), rules: "dev" as const };
    expect(canSlam(dev)).toBe(false);
    expect(pressSlam(dev)).toBe(dev);
  });

  it("is off underwater on a Pool stage", () => {
    const pool = airborne({ stage: 2, playerY: 120 });
    expect(canSlam(pool)).toBe(false);
    expect(pressSlam(pool)).toBe(pool);
  });

  it("does not stack on a slam already falling", () => {
    const falling = airborne({ slamming: true });
    expect(canSlam(falling)).toBe(false);
    expect(pressSlam(falling)).toBe(falling);
  });

  it("can slam in the air on a fitness run", () => {
    expect(canSlam(airborne())).toBe(true);
  });
});

describe("Burpee Slam: the press", () => {
  it("drops the runner at slam speed and marks it slamming", () => {
    const slam = pressSlam(airborne({ playerVy: -4 }));
    expect(slam.slamming).toBe(true);
    expect(slam.playerVy).toBe(SLAM_VY);
  });

  it("ends a Spin Jump in progress", () => {
    const slam = pressSlam(airborne({ spinJump: true }));
    expect(slam.spinJump).toBe(false);
  });

  it("holds its fall at slam speed rather than the normal fall cap", () => {
    // High enough that three frames do not reach the lane.
    const next = step(pressSlam(airborne({ playerY: 40 })), 3);
    expect(next.isGrounded).toBe(false);
    expect(next.playerVy).toBe(SLAM_VY);
  });

  it("is not started by the action key, which only spins in the air", () => {
    const grounded = run({ isGrounded: true });
    expect(pressAction(grounded)).toBe(grounded);
  });
});

describe("Burpee Slam: landing", () => {
  it("clears slamming on landing", () => {
    const landed = step(aboutToLand());
    expect(landed.isGrounded).toBe(true);
    expect(landed.slamming).toBe(false);
  });

  it("stomps the foe on the surface under the feet, as a stomp would", () => {
    const kettlebell: Foe = {
      ...makeFoe(7, "kettlebell", FOOT_X + 2, GROUND_Y),
      mode: "walk",
      vx: 0,
    };
    const before = aboutToLand({ foes: [kettlebell] });
    const landed = step(before);
    expect(landed.isGrounded).toBe(true);
    // A stomped kettlebell becomes a shell, just as it does under a jump.
    expect(landed.foes?.find((f) => f.id === 7)?.mode).toBe("shell");
    expect(landed.score - before.score).toBeGreaterThanOrEqual(FOE_STOMP_SCORE);
  });

  it("defeats a grounded Move Alert under the feet", () => {
    const flying = makeFoe(9, "alert", FOOT_X + 2, GROUND_Y);
    const alert: Foe = {
      ...flying,
      mode: "walk",
      vx: 0,
      vy: 0,
      y: GROUND_Y - flying.height,
    };
    const before = aboutToLand({ foes: [alert] });
    const landed = step(before);
    expect(landed.foes?.map((f) => f.id) ?? []).not.toContain(9);
    expect(landed.score - before.score).toBeGreaterThanOrEqual(FOE_STOMP_SCORE);
  });

  it("leaves a foe in the air above the feet alone", () => {
    const alert = makeFoe(8, "alert", FOOT_X + 2, GROUND_Y - 80);
    const landed = step(aboutToLand({ foes: [alert] }));
    expect(landed.foes?.map((f) => f.id)).toContain(8);
  });

  it("breaks a brick under the feet, with the board's reward", () => {
    const brick: CourseBlock = {
      id: 3,
      x: FOOT_X,
      y: GROUND_Y - BLOCK_SIZE,
      kind: "brick",
      contents: "kudos",
      used: false,
    };
    const course: CourseLayout = { ...EMPTY_COURSE, blocks: [brick] };
    // Start above the board's top, so the landing is on the board.
    const before = aboutToLand({
      course,
      playerY: brick.y - PLAYER_HEIGHT - 5,
    });
    const landed = step(before);
    expect(landed.isGrounded).toBe(true);
    expect(landed.course?.blocks).toHaveLength(0);
    expect(landed.score - before.score).toBeGreaterThanOrEqual(PR_BOARD_SCORE);
  });

  it("breaks no brick on a landing that is not a slam", () => {
    const brick: CourseBlock = {
      id: 3,
      x: FOOT_X,
      y: GROUND_Y - BLOCK_SIZE,
      kind: "brick",
      contents: "kudos",
      used: false,
    };
    const course: CourseLayout = { ...EMPTY_COURSE, blocks: [brick] };
    const landed = step(
      aboutToLand({
        course,
        slamming: false,
        playerVy: SLAM_VY,
        playerY: brick.y - PLAYER_HEIGHT - 5,
      })
    );
    expect(landed.isGrounded).toBe(true);
    expect(landed.course?.blocks).toHaveLength(1);
  });

  it("costs Body Battery on landing in a fitness run", () => {
    const seeded = { value: 60, bonked: false };
    const slam = step(aboutToLand({ bodyBattery: seeded }));
    // The same drop without the slam lands in the same frame, costing nothing extra.
    const plain = step(aboutToLand({ bodyBattery: seeded, slamming: false }));
    expect(plain.isGrounded).toBe(true);
    const cost =
      (plain.bodyBattery?.value ?? 0) - (slam.bodyBattery?.value ?? 0);
    expect(cost).toBeCloseTo(SLAM_BATTERY_COST, 5);
  });
});

describe("Burpee Slam: toast", () => {
  it("pushes BURPEE SLAM! once per run", () => {
    const first = pressSlam(airborne());
    expect(first.movesUsed).toEqual(["slam"]);
    expect(toasts(first, MOVE_TOASTS.slam)).toBe(1);

    const landed = untilLanded(first);
    const again = pressSlam(
      airborne({
        movesUsed: landed.movesUsed,
        popups: landed.popups,
      })
    );
    expect(again.movesUsed).toEqual(["slam"]);
    expect(toasts(again, MOVE_TOASTS.slam)).toBe(1);
  });
});
