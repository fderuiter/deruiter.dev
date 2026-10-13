import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CAPE_SPIN_MS, PACE_FILL_MS } from "@/lib/garmin-cape";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  createInitialState,
  pressAction,
  setRules,
  setRunInput,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  type CourseBlock,
  type CourseLayout,
  type CourseMedBall,
} from "@/lib/garmin-course";
import { EMPTY_PROPS, PR_BOARD_SCORE } from "@/lib/garmin-props";
import {
  BUFF_HEIGHT,
  DAMAGE_GRACE_MS,
  START_LIVES,
} from "@/lib/garmin-powerups";
import { makeFoe, type Foe } from "@/lib/garmin-foes";
import {
  MEDBALL_FILL_SCALE,
  MEDBALL_KO_SCORE,
  MEDBALL_SIZE,
  MEDBALL_THROW_VX,
  MEDBALL_THROW_VY,
  MEDBALL_TOAST,
  throwBall,
} from "@/lib/garmin-medball";

// The Medicine Ball (#2024) in the engine: picking it up in reach, throwing it,
// the flight that knocks out a foe or breaks a brick, the pace meter while
// carrying, and the hit rules that drop it.

const FRAME = 1000 / 60;
let clock = 6_800_000;

beforeEach(() => {
  clock = 6_800_000;
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

/** A grounded Base runner standing on the lane at the start of the course. */
function onLane(
  overrides: Partial<GameEngineState> = {},
  course: CourseLayout = EMPTY_COURSE
): GameEngineState {
  return run(
    {
      playerY: GROUND_Y - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
      ...overrides,
    },
    course
  );
}

/** A medicine ball resting on the lane in reach of the start-of-course runner. */
function ballInReach(
  id = 7,
  extra: Partial<CourseMedBall> = {}
): CourseMedBall {
  return { id, x: PLAYER_X + 22, y: GROUND_Y - MEDBALL_SIZE, ...extra };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
  return s;
}

/** Steps until `done` holds, returning the state and the frames it took. */
function stepUntil(
  state: GameEngineState,
  done: (s: GameEngineState) => boolean,
  maxFrames: number
): { state: GameEngineState; frames: number } {
  let s = state;
  for (let frames = 1; frames <= maxFrames; frames++) {
    s = updateGameSimulation(s, FRAME);
    if (done(s)) return { state: s, frames };
  }
  return { state: s, frames: maxFrames };
}

/** The popups with the text `text`. */
function toasts(state: GameEngineState, text: string): number {
  return (state.popups ?? []).filter((p) => p.text === text).length;
}

/** A foe standing on the lane at world `x`, of the given kind. */
function foeAt(kind: "kettlebell" | "repmax", x: number, id: number): Foe {
  return makeFoe(id, kind, x, GROUND_Y);
}

/** A brick (not a Kudos in disguise) hanging over the lane at world `x`. */
function brick(x: number, y: number, id = 2): CourseBlock {
  return { id, x, y, kind: "brick", contents: "kudos", used: false };
}

describe("Medicine ball: picking it up", () => {
  it("a grounded runner picks up a ball in reach: carrying, the id kept, and Med ball!", () => {
    const s = pressAction(
      onLane({}, { ...EMPTY_COURSE, medBalls: [ballInReach(7)] })
    );
    expect(s.carrying).toBe(true);
    expect(s.carryingId).toBe(7);
    expect(s.course?.medBalls).toEqual([]);
    expect(toasts(s, MEDBALL_TOAST)).toBe(1);
    expect(s.medBallToasted).toBe(true);
  });

  it("a ball out of reach is not picked up, and the action key does what it did", () => {
    const far = { id: 7, x: PLAYER_X + 40, y: GROUND_Y - MEDBALL_SIZE };
    const s = pressAction(onLane({}, { ...EMPTY_COURSE, medBalls: [far] }));
    expect(s.carrying).toBeFalsy();
    expect(s.course?.medBalls).toEqual([far]);
    // On the ground a Base runner's action does nothing, as before.
    expect(s.spinJump).toBeFalsy();
  });

  it("a runner in the air is not picked up, even hovering over the ball", () => {
    const hovering = run(
      {
        playerY: GROUND_Y - PLAYER_HEIGHT,
        playerVy: -2,
        isGrounded: false,
      },
      { ...EMPTY_COURSE, medBalls: [ballInReach(7)] }
    );
    const s = pressAction(hovering);
    expect(s.carrying).toBeFalsy();
    expect(s.course?.medBalls).toHaveLength(1);
    // The air action is the Spin Jump, as before.
    expect(s.spinJump).toBe(true);
  });

  it("Med ball! shows once per run: a second pickup later is silent", () => {
    const first = pressAction(
      onLane({}, { ...EMPTY_COURSE, medBalls: [ballInReach(7)] })
    );
    const thrown = pressAction(first);
    expect(thrown.thrownBall).not.toBeNull();
    const second = pressAction({
      ...thrown,
      thrownBall: null,
      course: {
        ...(thrown.course ?? EMPTY_COURSE),
        medBalls: [ballInReach(8)],
      },
    });
    expect(second.carrying).toBe(true);
    expect(second.carryingId).toBe(8);
    // Still the one toast from the first pickup.
    expect(toasts(second, MEDBALL_TOAST)).toBe(1);
  });

  it("a Heat Map runner next to a ball picks it up before a bolt is thrown", () => {
    const s = pressAction(
      onLane(
        { power: "heatmap", playerY: GROUND_Y - BUFF_HEIGHT },
        { ...EMPTY_COURSE, medBalls: [ballInReach(7)] }
      )
    );
    expect(s.carrying).toBe(true);
    expect(s.bolts ?? []).toHaveLength(0);
  });
});

describe("Medicine ball: throwing", () => {
  it("throwing sends the ball from the hand and empties the hands", () => {
    const carrying = onLane({ carrying: true, carryingId: 7 });
    const s = pressAction(carrying);
    expect(s.carrying).toBe(false);
    expect(s.thrownBall).not.toBeNull();
    expect(s.thrownBall?.id).toBe(7);
    // Released from the runner's front, at hand height, moving forward and up.
    expect(s.thrownBall?.x).toBe(PLAYER_X + PLAYER_WIDTH);
    expect(s.thrownBall?.y).toBe(
      GROUND_Y - PLAYER_HEIGHT + 8 - MEDBALL_SIZE / 2
    );
    expect(s.thrownBall?.vx).toBe(MEDBALL_THROW_VX);
    expect(s.thrownBall?.vy).toBe(MEDBALL_THROW_VY);
    expect(s.thrownBall).toEqual(
      throwBall(7, PLAYER_X + PLAYER_WIDTH, GROUND_Y - PLAYER_HEIGHT + 8)
    );
  });

  it("a runner in the air can throw too", () => {
    const s = pressAction(
      run({
        carrying: true,
        carryingId: 7,
        playerY: 150,
        playerVy: -2,
        isGrounded: false,
      })
    );
    expect(s.carrying).toBe(false);
    expect(s.thrownBall?.id).toBe(7);
  });

  it("a second throw while one is in flight leaves the state as it is", () => {
    const flying = run({
      carrying: true,
      carryingId: 8,
      thrownBall: throwBall(7, PLAYER_X + PLAYER_WIDTH, GROUND_Y - 16),
    });
    const s = pressAction(flying);
    expect(s).toBe(flying);
  });
});

describe("Medicine ball: flight and what it hits", () => {
  it("a thrown ball knocks out the first foe it hits and only that one", () => {
    const near = foeAt("kettlebell", PLAYER_X + 90, 3);
    const far = foeAt("kettlebell", PLAYER_X + 130, 4);
    const thrown = pressAction(
      onLane({ carrying: true, carryingId: 7, foes: [near, far] })
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(frames).toBeLessThan(120);
    expect(s.foes?.map((f) => f.id)).toEqual([far.id]);
    expect(s.stageFoes).toBe(1);
    expect(toasts(s, `+${MEDBALL_KO_SCORE}`)).toBe(1);
  });

  it("the knock-out pays MEDBALL_KO_SCORE on top of the frames run", () => {
    const foe = foeAt("kettlebell", PLAYER_X + 90, 3);
    const thrown = pressAction(
      onLane({ carrying: true, carryingId: 7, foes: [foe] })
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(s.foes).toEqual([]);
    // One point per frame at 60 Hz, plus the knock-out.
    expect(s.score).toBe(MEDBALL_KO_SCORE + frames);
  });

  it("a Rep Max takes two hit points from a thrown ball and stays", () => {
    const boss = foeAt("repmax", PLAYER_X + 90, 4);
    const thrown = pressAction(
      onLane({ carrying: true, carryingId: 7, foes: [boss] })
    );
    const { state: s } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(s.foes).toHaveLength(1);
    expect(s.foes?.[0].kind).toBe("repmax");
    expect(s.foes?.[0].hp).toBe(4);
    expect(s.thrownBall).toBeNull();
  });

  it("a thrown ball breaks a brick and pays the PR Board reward", () => {
    const block = brick(PLAYER_X + 50, GROUND_Y - 27);
    const thrown = pressAction(
      onLane(
        { carrying: true, carryingId: 7 },
        { ...EMPTY_COURSE, blocks: [block] }
      )
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(s.course?.blocks ?? []).toEqual([]);
    expect(toasts(s, "NEW PR!")).toBe(1);
    expect(s.score).toBe(PR_BOARD_SCORE + frames);
  });

  it("a sync block stops the ball without breaking it or paying", () => {
    const sync: CourseBlock = {
      id: 3,
      x: PLAYER_X + 50,
      y: GROUND_Y - 27,
      kind: "sync",
      contents: "kudos",
      used: false,
    };
    const thrown = pressAction(
      onLane(
        { carrying: true, carryingId: 7 },
        { ...EMPTY_COURSE, blocks: [sync] }
      )
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(s.thrownBall).toBeNull();
    expect(s.course?.blocks).toHaveLength(1);
    expect(toasts(s, "NEW PR!")).toBe(0);
    expect(s.score).toBe(frames);
  });

  it("a ball that lands rests on the lane and can be picked up again", () => {
    const thrown = pressAction(onLane({ carrying: true, carryingId: 7 }));
    const { state: landed } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    const rest = landed.course?.medBalls ?? [];
    expect(rest).toHaveLength(1);
    expect(rest[0].id).toBe(7);
    expect(rest[0].y).toBe(GROUND_Y - MEDBALL_SIZE);
    // Walk the runner up to it (the course is just a stub here) and pick it up.
    const near = {
      ...landed,
      distanceMeters: (rest[0].x - PLAYER_X - 5) / PX_PER_METER,
      playerY: GROUND_Y - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
    };
    const again = pressAction(near);
    expect(again.carrying).toBe(true);
    expect(again.carryingId).toBe(7);
    expect(again.course?.medBalls).toEqual([]);
  });

  it("a ball that drops through a gap is lost", () => {
    const thrown = pressAction(
      onLane(
        { carrying: true, carryingId: 7 },
        { ...EMPTY_COURSE, gaps: [{ x: PLAYER_X + 80, width: 200 }] }
      )
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 200);
    expect(frames).toBeLessThan(200);
    expect(s.thrownBall).toBeNull();
    expect(s.course?.medBalls ?? []).toEqual([]);
  });
});

describe("Medicine ball: the pace meter while carrying", () => {
  /** Sprints `frames` frames on the lane, returning the pace meter. */
  function sprint(state: GameEngineState, frames: number): number {
    let s = setRunInput(state, 1);
    for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
    return s.paceMeter ?? 0;
  }

  it("a carried ball fills the pace meter at the scaled rate", () => {
    const plain = sprint(onLane(), 60);
    const carried = sprint(onLane({ carrying: true, carryingId: 7 }), 60);
    expect(plain).toBeCloseTo((60 * FRAME) / PACE_FILL_MS, 6);
    expect(carried).toBeCloseTo(plain * MEDBALL_FILL_SCALE, 6);
    expect(carried).toBeLessThan(plain);
  });
});

describe("Medicine ball: a hit while carrying", () => {
  it("a hit that costs a tier drops the ball at the runner's feet", () => {
    const repmax = foeAt("repmax", PLAYER_X, 4);
    const s = step(
      run({
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        carrying: true,
        carryingId: 7,
        foes: [repmax],
      })
    );
    expect(s.power).toBe("base");
    expect(s.carrying).toBe(false);
    expect(s.invulnerableMs).toBe(DAMAGE_GRACE_MS);
    const dropped = (s.course?.medBalls ?? []).find((b) => b.id === 7);
    expect(dropped).toBeDefined();
    expect(dropped?.y).toBe(GROUND_Y - MEDBALL_SIZE);
    // Over the runner's middle, from the runner's position this frame.
    expect(dropped?.x).toBeCloseTo(
      s.distanceMeters * PX_PER_METER +
        PLAYER_X +
        PLAYER_WIDTH / 2 -
        MEDBALL_SIZE / 2,
      6
    );
  });

  it("a hit the buddy takes also drops the ball", () => {
    const repmax = foeAt("repmax", PLAYER_X, 4);
    const s = step(
      onLane({
        riding: true,
        carrying: true,
        carryingId: 7,
        foes: [repmax],
      })
    );
    expect(s.riding).toBe(false);
    expect(s.carrying).toBe(false);
    expect((s.course?.medBalls ?? []).map((b) => b.id)).toEqual([7]);
    expect(s.lives).toBe(START_LIVES);
  });

  it("losing the life takes the ball, and the Med ball toast stays used", () => {
    const repmax = foeAt("repmax", PLAYER_X, 4);
    const s = step(
      onLane({
        carrying: true,
        carryingId: 7,
        medBallToasted: true,
        foes: [repmax],
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.carrying).toBe(false);
    expect(s.thrownBall).toBeNull();
    expect(s.medBallToasted).toBe(true);
  });

  it("a ball dropped with the runner over a gap is lost", () => {
    const repmax = foeAt("repmax", PLAYER_X, 4);
    const s = step(
      run(
        {
          power: "buff",
          // In the air, but with its box still level with the Rep Max.
          playerY: 160,
          playerVy: 0,
          isGrounded: false,
          carrying: true,
          carryingId: 7,
          foes: [repmax],
        },
        { ...EMPTY_COURSE, gaps: [{ x: PLAYER_X - 12, width: 60 }] }
      )
    );
    expect(s.power).toBe("base");
    expect(s.carrying).toBe(false);
    expect(s.course?.medBalls ?? []).toEqual([]);
  });
});

describe("Medicine ball: the old action still works with no ball involved", () => {
  it("a Heat Map runner throws a bolt when no ball is in reach", () => {
    const s = pressAction(
      onLane(
        { power: "heatmap" },
        {
          ...EMPTY_COURSE,
          medBalls: [{ id: 7, x: PLAYER_X + 40, y: GROUND_Y - MEDBALL_SIZE }],
        }
      )
    );
    expect(s.bolts).toHaveLength(1);
    expect(s.carrying).toBeFalsy();
  });

  it("a Cape runner spins when no ball is in reach", () => {
    const s = pressAction(onLane({ power: "cape" }));
    expect(s.spinMs).toBe(CAPE_SPIN_MS);
    expect(s.carrying).toBeFalsy();
  });

  it("a Base runner in the air still starts a Spin Jump", () => {
    const s = pressAction(
      run({ playerY: 150, playerVy: -2, isGrounded: false })
    );
    expect(s.spinJump).toBe(true);
    expect(s.carrying).toBeFalsy();
  });

  it("a ball out of reach does not change a Cape runner's spin", () => {
    const far = { id: 7, x: PLAYER_X + 60, y: GROUND_Y - MEDBALL_SIZE };
    const s = pressAction(
      onLane({ power: "cape" }, { ...EMPTY_COURSE, medBalls: [far] })
    );
    expect(s.spinMs).toBe(CAPE_SPIN_MS);
    expect(s.course?.medBalls).toEqual([far]);
  });
});

describe("Medicine ball: long frames and props", () => {
  it("a long frame can't carry a thrown ball through a foe", () => {
    // A 100 ms frame moves the ball 30 px: in one jump it would pass clean
    // over a 16 px kettlebell that sits 12 px ahead of it.
    const ball = {
      id: 7,
      x: 150,
      y: GROUND_Y - 12,
      vx: MEDBALL_THROW_VX,
      vy: 0,
    };
    const foe = { ...foeAt("kettlebell", 162, 5), vx: 0 };
    const s = updateGameSimulation(
      onLane({ thrownBall: ball, foes: [foe] }),
      100
    );
    expect(s.lives).toBe(START_LIVES);
    expect(s.foes?.some((f) => f.id === 5)).toBe(false);
    expect(s.thrownBall).toBeNull();
  });

  it("a ball that comes down inside a Water Station is lost", () => {
    const stationX = PLAYER_X + 40;
    const s = step(
      onLane({
        props: {
          ...EMPTY_PROPS,
          stations: [
            {
              id: 9,
              x: stationX,
              width: 30,
              height: 20,
              enterable: false,
              exitX: 0,
            },
          ],
        },
        thrownBall: {
          id: 7,
          x: stationX + 10,
          y: GROUND_Y - MEDBALL_SIZE - 2,
          vx: 0,
          vy: 4,
        },
      }),
      3
    );
    expect(s.thrownBall ?? null).toBeNull();
    expect(s.course?.medBalls ?? []).toEqual([]);
  });
});

describe("Medicine ball: rolling and dropping (playtest)", () => {
  it("a ball that lands short of a foe rolls on along the lane and knocks it out", () => {
    // Already on the lane and rolling: nothing in the air to hit.
    const ball = {
      id: 7,
      x: 140,
      y: GROUND_Y - MEDBALL_SIZE,
      vx: MEDBALL_THROW_VX,
      vy: 0,
    };
    const foe = { ...foeAt("kettlebell", 200, 5), vx: 0 };
    const { state: s } = stepUntil(
      onLane({ thrownBall: ball, foes: [foe] }),
      (st) => !st.thrownBall,
      120
    );
    expect(s.foes?.some((f) => f.id === 5)).toBe(false);
    expect(s.course?.medBalls ?? []).toEqual([]);
  });

  it("a rolling ball slows down and comes to rest on the lane", () => {
    const ball = {
      id: 7,
      x: 140,
      y: GROUND_Y - MEDBALL_SIZE,
      vx: MEDBALL_THROW_VX,
      vy: 0,
    };
    const { state: s, frames } = stepUntil(
      onLane({ thrownBall: ball }),
      (st) => !st.thrownBall,
      200
    );
    expect(frames).toBeGreaterThan(20);
    const rested = s.course?.medBalls?.find((b) => b.id === 7);
    expect(rested?.y).toBe(GROUND_Y - MEDBALL_SIZE);
    expect(rested?.x ?? 0).toBeGreaterThan(200);
  });

  it("a ball dropped in mid-air by a hit is lost", () => {
    const repmax = foeAt("repmax", PLAYER_X, 4);
    const s = step(
      run({
        power: "buff",
        playerY: 160,
        playerVy: 0,
        isGrounded: false,
        carrying: true,
        carryingId: 7,
        foes: [repmax],
      })
    );
    expect(s.power).toBe("base");
    expect(s.carrying).toBe(false);
    expect(s.course?.medBalls ?? []).toEqual([]);
  });

  it("the final life lost leaves no ball in the hands or the air", () => {
    const s = step(
      run({
        lives: 1,
        playerY: GROUND_Y - PLAYER_HEIGHT,
        isGrounded: true,
        carrying: true,
        carryingId: 7,
        thrownBall: throwBall(8, 300, GROUND_Y - 40),
        foes: [foeAt("repmax", PLAYER_X, 4)],
      })
    );
    expect(s.gameState).toBe("crashed");
    expect(s.carrying).toBe(false);
    expect(s.thrownBall ?? null).toBeNull();
  });
});
