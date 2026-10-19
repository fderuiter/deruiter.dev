import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  GROUND_Y,
  JUMP_FORCE,
  PLAYER_HEIGHT,
  PLAYER_X,
  PLAYER_WIDTH,
  createInitialState,
  enterStation,
  pressJump,
  setRunInput,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin/engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  PX_PER_METER,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin/course";
import {
  BUDDY_EAT_SCORE,
  BUDDY_JUMP_BONUS_VY,
  BUDDY_RUNAWAY_LEAD,
  BUDDY_RUNAWAY_MS,
  BUDDY_RUNAWAY_SPEED,
  BUDDY_TOASTS,
} from "@/lib/garmin/buddy";
import {
  BUFF_HEIGHT,
  DAMAGE_GRACE_MS,
  PICKUP_SIZE,
  POWERUP_SCORE,
  START_LIVES,
  type Pickup,
} from "@/lib/garmin/powerups";
import {
  EMPTY_PROPS,
  STATION_WIDTH,
  type CourseProps,
  type CourseStation,
} from "@/lib/garmin/props";
import { makeFoe, type Foe } from "@/lib/garmin/foes";

// The Running Buddy (#2024) in the engine: hatching, mounting, the jump bonus,
// eating small foes, the hit rules, recapture, expiry, stations and stages.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_700_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run on stage 1 with no spawns, on `course` and `props`. */
function run(
  overrides: Partial<GameEngineState> = {},
  course: CourseLayout = EMPTY_COURSE,
  props: CourseProps = EMPTY_PROPS
): GameEngineState {
  return {
    ...startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix"
    ),
    course,
    props,
    foes: [],
    obstacles: [],
    gpsMs: 0,
    stage: 1,
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A grounded runner at Base height on the lane, riding `riding`. */
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

/** A buddy pickup lying in the runner's reach on the lane. */
function buddyPickup(extra: Partial<Pickup> = {}): Pickup {
  return {
    id: 50,
    kind: "buddy",
    x: PLAYER_X + 2,
    y: GROUND_Y - PICKUP_SIZE,
    vx: 0,
    vy: 0,
    emergeMs: 0,
    ...extra,
  };
}

/** A runaway buddy: a buddy pickup with its time left, ahead of the runner. */
function runaway(extra: Partial<Pickup> = {}): Pickup {
  return buddyPickup({
    x: PLAYER_X + 200,
    vx: BUDDY_RUNAWAY_SPEED,
    ttlMs: BUDDY_RUNAWAY_MS,
    ...extra,
  });
}

/** A sync block holding a Running Buddy. */
function buddyBlock(extra: Partial<CourseBlock> = {}): CourseBlock {
  return {
    id: 1,
    x: PLAYER_X,
    y: 150,
    kind: "sync",
    contents: "buddy",
    used: false,
    ...extra,
  };
}

/** A walking kettlebell with its feet on the lane at world `x`. */
function kettlebell(x: number, id = 3): Foe {
  return makeFoe(id, "kettlebell", x, GROUND_Y);
}

/** A Rep Max standing on the lane at world `x`. */
function repMax(x: number, id = 4): Foe {
  return makeFoe(id, "repmax", x, GROUND_Y);
}

function station(extra: Partial<CourseStation> = {}): CourseStation {
  return {
    id: 9,
    x: 200,
    width: STATION_WIDTH,
    height: 20,
    enterable: true,
    exitX: 900,
    ...extra,
  };
}

describe("Running Buddy: hatching and mounting", () => {
  it("a buddy block hatches a buddy pickup when a jump bumps it from below", () => {
    const rising = run(
      {
        playerY: 150 + BLOCK_SIZE + 2,
        playerVy: -8,
        isGrounded: false,
      },
      { ...EMPTY_COURSE, blocks: [buddyBlock()] }
    );
    const s = step(rising);
    expect(s.course?.blocks[0].used).toBe(true);
    expect(s.pickups?.map((p) => p.kind)).toEqual(["buddy"]);
    expect(s.pickups?.[0].emergeMs).toBeGreaterThan(0);
    expect(s.riding).toBeFalsy();
  });

  it("a hatched buddy hops ahead, waits on the lane and is caught by the running runner", () => {
    const rising = run(
      {
        playerY: 150 + BLOCK_SIZE + 2,
        playerVy: -8,
        isGrounded: false,
      },
      { ...EMPTY_COURSE, blocks: [buddyBlock()] }
    );
    const hatched = step(rising);
    expect(hatched.course?.blocks[0].used).toBe(true);
    // The buddy lands ahead of the runner and sits still there.
    const { state: resting } = stepUntil(
      hatched,
      (s) =>
        (s.pickups ?? []).some(
          (p) => p.kind === "buddy" && p.emergeMs <= 0 && p.vx === 0
        ),
      300
    );
    const dog = resting.pickups?.find((p) => p.kind === "buddy");
    expect(dog?.vx).toBe(0);
    expect(dog?.y).toBe(GROUND_Y - PICKUP_SIZE);
    const runnerFront =
      resting.distanceMeters * PX_PER_METER + PLAYER_X + PLAYER_WIDTH;
    expect(dog?.x ?? 0).toBeGreaterThan(runnerFront);
    // Running on with no input, the runner reaches it and mounts.
    const { state: mounted, frames } = stepUntil(
      resting,
      (s) => s.riding === true,
      300
    );
    expect(frames).toBeLessThan(300);
    expect(mounted.riding).toBe(true);
    expect(mounted.pickups?.some((p) => p.kind === "buddy")).toBe(false);
    expect(toasts(mounted, BUDDY_TOASTS.mount)).toBe(1);
    expect(toasts(mounted, `+${POWERUP_SCORE}`)).toBe(1);
  });

  it("touching a hatched buddy mounts it: Good boy!, +1000 and riding", () => {
    const s = step(onLane({ pickups: [buddyPickup()] }));
    expect(s.riding).toBe(true);
    expect(s.pickups).toEqual([]);
    expect(toasts(s, BUDDY_TOASTS.mount)).toBe(1);
    expect(toasts(s, `+${POWERUP_SCORE}`)).toBe(1);
  });

  it("a second hatched buddy while already riding scores but does not mount again", () => {
    const s = step(onLane({ riding: true, pickups: [buddyPickup()] }));
    expect(s.riding).toBe(true);
    expect(toasts(s, `+${POWERUP_SCORE}`)).toBe(1);
    expect(toasts(s, BUDDY_TOASTS.mount)).toBe(0);
  });

  it("a runaway buddy caught again gives Good boy! and no points", () => {
    const s = step(onLane({ pickups: [runaway({ x: PLAYER_X + 2, vx: 0 })] }));
    expect(s.riding).toBe(true);
    expect(toasts(s, BUDDY_TOASTS.mount)).toBe(1);
    expect(toasts(s, `+${POWERUP_SCORE}`)).toBe(0);
    // Exactly one frame of running time and nothing else: no points.
    expect(s.score).toBe(1);
  });

  it("a buddy pickup still in its hatch rise cannot be caught yet", () => {
    const s = step(onLane({ pickups: [buddyPickup({ emergeMs: 300 })] }));
    expect(s.riding).toBeFalsy();
    expect(s.pickups?.some((p) => p.kind === "buddy")).toBe(true);
  });
});

describe("Running Buddy: jumping", () => {
  it("a rider takes off higher than a non-rider", () => {
    const rider = pressJump(onLane({ riding: true }));
    const walker = pressJump(onLane());
    expect(rider.playerVy).toBeCloseTo(JUMP_FORCE + BUDDY_JUMP_BONUS_VY, 6);
    expect(walker.playerVy).toBe(JUMP_FORCE);
    expect(rider.playerVy).toBeCloseTo(-11.5, 6);
  });

  it("a rider rises higher than a non-rider over the same frames", () => {
    const rider = step(pressJump(onLane({ riding: true })), 12);
    const walker = step(pressJump(onLane()), 12);
    expect(rider.playerY).toBeLessThan(walker.playerY);
  });

  it("a buffered jump that fires on landing is boosted for a rider", () => {
    const falling = {
      playerY: GROUND_Y - PLAYER_HEIGHT - 3,
      playerVy: 3,
      isGrounded: false,
      jumpBufferMs: 100,
    };
    const rider = step(onLane({ ...falling, riding: true }));
    const walker = step(onLane({ ...falling }));
    expect(rider.isGrounded).toBe(false);
    expect(rider.playerVy).toBeCloseTo(JUMP_FORCE + BUDDY_JUMP_BONUS_VY, 6);
    expect(walker.playerVy).toBe(JUMP_FORCE);
  });
});

describe("Running Buddy: eating and stomping", () => {
  it("a rider eats a small foe it runs into from the side, with no harm", () => {
    const s = step(onLane({ riding: true, foes: [kettlebell(PLAYER_X + 5)] }));
    expect(s.foes).toEqual([]);
    expect(toasts(s, `+${BUDDY_EAT_SCORE}`)).toBe(1);
    // One frame of time plus the eaten foe, and nothing lost.
    expect(s.score).toBe(BUDDY_EAT_SCORE + 1);
    expect(s.lives).toBe(START_LIVES);
    expect(s.invulnerableMs ?? 0).toBe(0);
    expect(s.riding).toBe(true);
  });

  it("without a buddy the same side contact is a hit that costs a life", () => {
    const s = step(onLane({ foes: [kettlebell(PLAYER_X + 5)] }));
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.riding).toBeFalsy();
  });

  it("a stomp from above still works while riding and keeps the buddy", () => {
    const foe = kettlebell(PLAYER_X);
    const s = step(
      run({
        riding: true,
        playerY: foe.y - PLAYER_HEIGHT + 4,
        playerVy: 2,
        isGrounded: false,
        foes: [foe],
      })
    );
    expect(s.foes?.[0].mode).toBe("shell");
    expect(toasts(s, "+100")).toBe(1);
    expect(s.riding).toBe(true);
    expect(s.lives).toBe(START_LIVES);
  });
});

describe("Running Buddy: a hit while riding", () => {
  it("keeps the tier, costs no life and drops the buddy", () => {
    const s = step(
      run({
        power: "buff",
        riding: true,
        playerY: GROUND_Y - BUFF_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        foes: [repMax(PLAYER_X)],
      })
    );
    expect(s.power).toBe("buff");
    expect(s.riding).toBe(false);
    expect(s.lives).toBe(START_LIVES);
    expect(s.invulnerableMs).toBe(DAMAGE_GRACE_MS);
    expect(s.banner?.text).toBe(BUDDY_TOASTS.lost);
    // The buddy takes the hit, so no Body Battery toll is paid.
    expect(s.stageHits).toBe(0);
  });

  it("the runaway buddy spawns ahead of the runner, at its speed and time", () => {
    const s = step(
      run({
        power: "buff",
        riding: true,
        playerY: GROUND_Y - BUFF_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        foes: [repMax(PLAYER_X)],
      })
    );
    const buddies = (s.pickups ?? []).filter((p) => p.kind === "buddy");
    expect(buddies).toHaveLength(1);
    const dog = buddies[0];
    const front = s.distanceMeters * PX_PER_METER + PLAYER_X + PLAYER_WIDTH;
    expect(dog.x).toBeCloseTo(front + BUDDY_RUNAWAY_LEAD, 6);
    expect(dog.y).toBeCloseTo(s.playerY + BUFF_HEIGHT - PICKUP_SIZE, 6);
    expect(dog.vx).toBe(BUDDY_RUNAWAY_SPEED);
    expect(dog.ttlMs).toBe(BUDDY_RUNAWAY_MS);
    expect(dog.emergeMs).toBe(0);
  });

  it("a Base rider hit by a Rep Max loses the buddy, not the life", () => {
    const s = step(onLane({ riding: true, foes: [repMax(PLAYER_X)] }));
    expect(s.lives).toBe(START_LIVES);
    expect(s.riding).toBe(false);
    expect(s.gameState).toBe("playing");
    expect(s.pickups?.some((p) => p.kind === "buddy" && p.ttlMs)).toBe(true);
  });

  it("without a buddy the same Rep Max hit costs the life and no buddy appears", () => {
    const s = step(onLane({ foes: [repMax(PLAYER_X)] }));
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.pickups?.some((p) => p.kind === "buddy")).toBeFalsy();
  });

  it("a bug hit while riding costs the buddy and keeps the tier", () => {
    const bug: Obstacle = {
      id: 1,
      x: PLAYER_X + 2,
      y: GROUND_Y - 20,
      width: 16,
      height: 20,
      type: "null_pointer",
      label: "NULL",
      speed: 0,
    };
    const s = step(
      run({
        power: "buff",
        riding: true,
        playerY: GROUND_Y - BUFF_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        obstacles: [bug],
      })
    );
    expect(s.power).toBe("buff");
    expect(s.riding).toBe(false);
    expect(s.lives).toBe(START_LIVES);
    expect((s.pickups ?? []).some((p) => p.kind === "buddy")).toBe(true);
  });

  it("a second bug in the same tick is absorbed by the grace window", () => {
    const bug = (id: number): Obstacle => ({
      id,
      x: PLAYER_X + 2,
      y: GROUND_Y - 20,
      width: 16,
      height: 20,
      type: "null_pointer",
      label: "NULL",
      speed: 0,
    });
    // A Buff runner with no buddy: the first bug drops it to Base, and the
    // second, in the same tick, is inside the grace it just started.
    const s = step(
      run({
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        obstacles: [bug(1), bug(2)],
      })
    );
    expect(s.power).toBe("base");
    expect(s.lives).toBe(START_LIVES);
  });

  it("a rider hit by two bugs in one tick loses the buddy and no life", () => {
    const bug = (id: number): Obstacle => ({
      id,
      x: PLAYER_X + 2,
      y: GROUND_Y - 20,
      width: 16,
      height: 20,
      type: "null_pointer",
      label: "NULL",
      speed: 0,
    });
    const s = step(onLane({ riding: true, obstacles: [bug(1), bug(2)] }));
    expect(s.riding).toBe(false);
    expect(s.lives).toBe(START_LIVES);
    expect(s.gameState).toBe("playing");
  });

  it("losing a life clears the buddy and the runaway dog with it", () => {
    const s = step(
      run(
        {
          riding: true,
          pickups: [runaway()],
          playerY: CANVAS_SIZE - 5,
          playerVy: 10,
          isGrounded: false,
        },
        {
          ...EMPTY_COURSE,
          gaps: [{ x: PLAYER_X - 12, width: 60 }],
        }
      )
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.riding).toBe(false);
    expect(s.pickups).toEqual([]);
  });
});

describe("Running Buddy: runaway recapture and expiry", () => {
  it("the runaway dog expires after its time, with Bye, buddy!", () => {
    const dog = runaway({ x: PLAYER_X + 200 });
    const start = onLane({ pickups: [dog] });
    const early = step(start, 100);
    expect(early.pickups?.some((p) => p.kind === "buddy")).toBe(true);
    const { state: gone, frames } = stepUntil(
      start,
      (s) => !(s.pickups ?? []).some((p) => p.kind === "buddy"),
      400
    );
    // 3000 ms at 60 Hz is 180 frames.
    expect(frames).toBeGreaterThanOrEqual(179);
    expect(frames).toBeLessThanOrEqual(181);
    expect(toasts(gone, BUDDY_TOASTS.gone)).toBe(1);
    expect(gone.riding).toBeFalsy();
  });
});

describe("Running Buddy: stations and stages", () => {
  it("entering a bonus room leaves a riding buddy outside", () => {
    const door = station();
    const s = enterStation(
      run(
        {
          distanceMeters: 15,
          playerY: GROUND_Y - door.height - PLAYER_HEIGHT,
          playerVy: 0,
          isGrounded: true,
          riding: true,
        },
        EMPTY_COURSE,
        { ...EMPTY_PROPS, stations: [door] }
      )
    );
    expect(s.bonusRoom).not.toBeNull();
    expect(s.riding).toBe(false);
    expect(toasts(s, BUDDY_TOASTS.stay)).toBe(1);
    expect((s.pickups ?? []).some((p) => p.kind === "buddy")).toBe(false);
    expect(
      (s.bonusRoom?.returnPickups ?? []).some((p) => p.kind === "buddy")
    ).toBe(false);
  });

  it("crossing the finish pole clears the buddy", () => {
    const pole = {
      x: PLAYER_X + 8,
      stage: 1,
    };
    const s = step(
      run(
        {
          riding: true,
          playerY: GROUND_Y - PLAYER_HEIGHT,
          isGrounded: true,
          pickups: [runaway()],
        },
        { ...EMPTY_COURSE, poles: [pole] }
      )
    );
    expect(s.stage).toBe(2);
    expect(s.riding).toBe(false);
    expect(s.pickups).toEqual([]);
  });

  it("crossing the finish pole also leaves a carried ball behind", () => {
    const pole = { x: PLAYER_X + 8, stage: 1 };
    const s = step(
      run(
        {
          carrying: true,
          carryingId: 7,
          playerY: GROUND_Y - PLAYER_HEIGHT,
          isGrounded: true,
        },
        { ...EMPTY_COURSE, poles: [pole] }
      )
    );
    expect(s.stage).toBe(2);
    expect(s.carrying).toBe(false);
    expect(s.carryingId).toBeUndefined();
  });

  it("entering a bonus room leaves a carried ball outside too", () => {
    const door = station();
    const s = enterStation(
      run(
        {
          distanceMeters: 15,
          playerY: GROUND_Y - door.height - PLAYER_HEIGHT,
          playerVy: 0,
          isGrounded: true,
          carrying: true,
          carryingId: 7,
        },
        EMPTY_COURSE,
        { ...EMPTY_PROPS, stations: [door] }
      )
    );
    expect(s.bonusRoom).not.toBeNull();
    expect(s.carrying).toBe(false);
    expect(s.carryingId).toBeUndefined();
  });
});

describe("Running Buddy: a buffered stomp", () => {
  it("a rider with a jump buffered takes off from a stomp with the buddy's lift", () => {
    const stompFrom = (riding: boolean) =>
      step(
        run({
          riding,
          playerY: GROUND_Y - 40,
          playerVy: 5,
          isGrounded: false,
          jumpBufferMs: 100,
          foes: [kettlebell(PLAYER_X + 8)],
        })
      );
    const plain = stompFrom(false);
    const ridden = stompFrom(true);
    expect(plain.playerVy).toBeLessThan(0);
    expect(ridden.playerVy).toBeCloseTo(plain.playerVy + BUDDY_JUMP_BONUS_VY);
  });
});

describe("Running Buddy: a hatch at a sprint (playtest)", () => {
  it("a buddy hatched by a sprinting runner is still caught", () => {
    const rising = setRunInput(
      run(
        { playerY: 150 + BLOCK_SIZE + 2, playerVy: -8, isGrounded: false },
        { ...EMPTY_COURSE, blocks: [buddyBlock()] }
      ),
      1
    );
    const hatched = step(rising);
    expect(hatched.course?.blocks[0].used).toBe(true);
    // At a sprint the runner reaches the leaping buddy before it settles.
    const { state: mounted, frames } = stepUntil(
      hatched,
      (s) => s.riding === true,
      300
    );
    expect(frames).toBeLessThan(300);
    expect(mounted.riding).toBe(true);
  });
});
