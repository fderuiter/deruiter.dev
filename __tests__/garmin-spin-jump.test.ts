import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_X,
  createInitialState,
  pressAction,
  pressJump,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin/course";
import { EMPTY_PROPS, PR_BOARD_SCORE } from "@/lib/garmin/props";
import { FOE_STOMP_SCORE, makeFoe, type Foe } from "@/lib/garmin/foes";
import { MOVE_TOASTS, SPIN_JUMP_VY } from "@/lib/garmin/moves";

// The Spin Jump (#2023): the action key in the air is a floatier jump that
// bounces off spiky foes, but breaks no blocks.

const FRAME = 1000 / 60;
const STOMP_BOUNCE_VY = -7;
/** World x of the runner's feet at the start of a run, where test foes and bricks sit. */
const FOOT_X = PLAYER_X + 5;
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
  for (let i = 0; i < 90 && !s.isGrounded; i++) {
    s = step(s);
  }
  return s;
}

/** Popups with the text of `text`. */
function toasts(state: GameEngineState, text: string): number {
  return (state.popups ?? []).filter((p) => p.text === text).length;
}

describe("Spin Jump: the action key", () => {
  it("spins a base runner in the air: spinJump is set, with no extra lift", () => {
    const spun = pressAction(airborne());
    expect(spun.spinJump).toBe(true);
    expect(spun.playerVy).toBe(0);
  });

  it("is not a second jump: a falling runner keeps falling", () => {
    const falling = airborne({ playerVy: 4 });
    expect(pressAction(falling).playerVy).toBe(4);
  });

  it("leaves a rising runner's rise as it is", () => {
    const rising = airborne({ playerVy: -10 });
    expect(pressAction(rising).playerVy).toBe(-10);
  });

  it("does nothing on the ground with the base tier", () => {
    const grounded = run({
      isGrounded: true,
      playerY: GROUND_Y - PLAYER_HEIGHT,
    });
    expect(pressAction(grounded)).toBe(grounded);
  });

  it("does not start a second spin while one is in the air", () => {
    const first = pressAction(airborne());
    expect(pressAction(first)).toBe(first);
  });

  it("does not spin underwater", () => {
    const pool = airborne({ stage: 2, playerY: 120 });
    expect(pressAction(pool).spinJump).toBeFalsy();
  });

  it("still throws a heat bolt for a Heat Map runner", () => {
    const heat = pressAction(airborne({ power: "heatmap" }));
    expect(heat.spinJump).toBeFalsy();
    expect(heat.bolts).toHaveLength(1);
  });

  it("still spins the Compression Cape for a Cape runner", () => {
    const cape = pressAction(airborne({ power: "cape" }));
    expect(cape.spinJump).toBeFalsy();
    expect(cape.spinMs ?? 0).toBeGreaterThan(0);
  });

  it("works for a Buff runner as well", () => {
    const buff = pressAction(airborne({ power: "buff" }));
    expect(buff.spinJump).toBe(true);
  });
});

describe("Spin Jump: the flight", () => {
  it("falls more slowly than a normal jump does, over the same frames", () => {
    const frames = 5;
    const normal = step(airborne({ playerY: 40 }), frames);
    const spun = step(pressAction(airborne({ playerY: 40 })), frames);
    expect(spun.playerVy).toBeGreaterThan(0);
    expect(spun.playerVy).toBeLessThan(normal.playerVy);
    expect(spun.playerY).toBeLessThan(normal.playerY);
    expect(spun.spinJump).toBe(true);
  });

  it("rises exactly as a normal jump does: the float is on the way down", () => {
    const normal = step(airborne({ playerVy: -6 }));
    const spun = step(airborne({ playerVy: -6, spinJump: true }));
    expect(spun.playerVy).toBe(normal.playerVy);
    expect(spun.playerY).toBe(normal.playerY);
  });

  it("peaks no higher than the same jump without the spin", () => {
    const takeOff = run({
      playerY: GROUND_Y - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
    });
    const peak = (spin: boolean): number => {
      let s = step(pressJump(takeOff));
      if (spin) s = pressAction(s);
      expect(s.spinJump === true).toBe(spin);
      let top = s.playerY;
      for (let i = 0; i < 90 && !s.isGrounded; i++) {
        s = step(s);
        top = Math.min(top, s.playerY);
      }
      return top;
    };
    expect(peak(true)).toBe(peak(false));
  });

  it("clears spinJump on landing", () => {
    const spinning = run({
      playerY: GROUND_Y - PLAYER_HEIGHT - 5,
      playerVy: 5,
      isGrounded: false,
      spinJump: true,
    });
    const landed = untilLanded(spinning);
    expect(landed.isGrounded).toBe(true);
    expect(landed.spinJump).toBe(false);
  });

  it("toasts SPIN JUMP! once per run", () => {
    const first = pressAction(airborne());
    expect(first.movesUsed).toEqual(["spin"]);
    expect(toasts(first, MOVE_TOASTS.spin)).toBe(1);

    const landed = untilLanded(first);
    const again = pressAction(
      airborne({ movesUsed: landed.movesUsed, popups: landed.popups })
    );
    expect(again.spinJump).toBe(true);
    expect(toasts(again, MOVE_TOASTS.spin)).toBe(1);
  });
});

describe("Spin Jump: foes", () => {
  it("bounces off a Move Alert without harm, and the alert survives", () => {
    // The runner comes down onto the alert's flight line, moving through it.
    const alert = makeFoe(11, "alert", FOOT_X + 3, 196);
    const before = run({
      playerY: 120,
      playerVy: 5,
      isGrounded: false,
      spinJump: true,
      foes: [alert],
    });
    const after = step(before);
    expect(after.gameState).toBe("playing");
    expect(after.lives).toBe(before.lives);
    expect(after.invulnerableMs ?? 0).toBe(0);
    expect(after.playerVy).toBe(SPIN_JUMP_VY);
    const survivor = after.foes?.find((f) => f.id === 11);
    expect(survivor?.kind).toBe("alert");
    expect(survivor?.mode).toBe("fly");
  });

  it("stomps a kettlebell it lands on", () => {
    // The kettlebell rests on the lane; the runner comes down onto it.
    const kettlebell: Foe = {
      ...makeFoe(12, "kettlebell", FOOT_X + 3, GROUND_Y),
      mode: "walk",
      vx: 0,
    };
    const before = run({
      playerY: 170,
      playerVy: 5,
      isGrounded: false,
      spinJump: true,
      foes: [kettlebell],
    });
    const after = step(before);
    const stomped = after.foes?.find((f) => f.id === 12);
    expect(stomped?.mode).toBe("shell");
    expect(after.playerVy).toBe(STOMP_BOUNCE_VY);
    expect(after.score - before.score).toBeGreaterThanOrEqual(FOE_STOMP_SCORE);
  });

  it("bonks a block from below without breaking it or paying out", () => {
    const brick: CourseBlock = {
      id: 21,
      x: FOOT_X,
      y: 150,
      kind: "brick",
      contents: "kudos",
      used: false,
    };
    const sync: CourseBlock = {
      id: 22,
      x: FOOT_X + 40,
      y: 150,
      kind: "sync",
      contents: "kudos",
      used: false,
    };
    const course: CourseLayout = { ...EMPTY_COURSE, blocks: [brick, sync] };
    // Rising into the brick's underside, on a tier that would break a board.
    const rising = {
      playerY: 150 + BLOCK_SIZE,
      playerVy: -8,
      isGrounded: false,
      power: "buff" as const,
      spinJump: true,
    };
    const bumped = step(run({ ...rising }, course));
    expect(bumped.course?.blocks.map((b) => b.id)).toEqual([21, 22]);
    expect(bumped.score).toBeLessThan(PR_BOARD_SCORE);

    // The same bump without the spin breaks the brick: the bonk is the spin's.
    const plain = step(run({ ...rising, spinJump: false }, course));
    expect(plain.course?.blocks.map((b) => b.id)).not.toContain(21);
    expect(plain.score).toBeGreaterThanOrEqual(PR_BOARD_SCORE);
  });

  it("gives no reward for a sync block bumped while spinning", () => {
    const sync: CourseBlock = {
      id: 23,
      x: FOOT_X,
      y: 150,
      kind: "sync",
      contents: "kudos",
      used: false,
    };
    const course: CourseLayout = { ...EMPTY_COURSE, blocks: [sync] };
    const rising = {
      playerY: 150 + BLOCK_SIZE,
      playerVy: -8,
      isGrounded: false,
      spinJump: true,
    };
    const bumped = step(run(rising, course));
    expect(bumped.course?.blocks[0]?.used).toBe(false);
    expect(bumped.kudos ?? 0).toBe(0);

    const plain = step(run({ ...rising, spinJump: false }, course));
    expect(plain.course?.blocks[0]?.used).toBe(true);
  });
});
