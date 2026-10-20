// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_X,
  PLAYER_WIDTH,
  createInitialState,
  pressJump,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  PX_PER_METER,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin/course";
import { EMPTY_PROPS } from "@/lib/garmin/props";
import { makeFoe, type Foe } from "@/lib/garmin/foes";
import { MEDAL_SCORE, MEDALS_PER_STAGE, medalId } from "@/lib/garmin/medals";
import {
  HILL_WAVELENGTH,
  SECOND_WIND_EVENTS,
  SECOND_WIND_MS,
  hillSpeedScale,
  startSecondWind,
  type SecondWind,
} from "@/lib/garmin/second-wind";
import { DAMAGE_GRACE_MS, START_LIVES } from "@/lib/garmin/powerups";
import { SYNC_BLOCK_SCORE, KUDOS_SCORE } from "@/lib/garmin/engine";

// The Second Wind in the engine (#2026): a wind Sync Block starts an event,
// each event's rule changes the run while it lasts, its goal pays its medal,
// and everything snaps back when the time is up, a life is lost or a stage
// is cleared.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_800_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run on stage 1 with no spawns, on `course` and `props`. */
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

/** A grounded runner at Base height on the lane. */
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

/** The number of popups with the text `text`. */
function toasts(state: GameEngineState, text: string): number {
  return (state.popups ?? []).filter((p) => p.text === text).length;
}

/** A wind Sync Block at the runner's head, rising into it from below. */
function windBlock(extra: Partial<CourseBlock> = {}): CourseBlock {
  return {
    id: 1,
    x: PLAYER_X,
    y: 150,
    kind: "sync",
    contents: "wind",
    used: false,
    medalId: medalId(1, 1),
    windKind: "hills",
    ...extra,
  };
}

/** A runner rising into `block` from below, ready to bump it. */
function bumping(
  block: CourseBlock,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return run(
    {
      playerY: 150 + BLOCK_SIZE + 2,
      playerVy: -8,
      isGrounded: false,
      ...overrides,
    },
    { ...EMPTY_COURSE, blocks: [block] }
  );
}

/** A walking kettlebell touching the runner on the lane. */
function kettlebell(x = PLAYER_X + 2, id = 3): Foe {
  return makeFoe(id, "kettlebell", x, GROUND_Y);
}

/** A Rep Max standing on the lane, touching the runner. */
function repMax(x = PLAYER_X + 2, id = 4): Foe {
  return makeFoe(id, "repmax", x, GROUND_Y);
}

/** A Second Wind event `kind` on stage 1, with `progress` towards its goal. */
function wind(
  kind: SecondWind["kind"],
  progress = 0,
  medal?: number
): SecondWind {
  return { ...startSecondWind(kind, 1, medal), progress };
}

/** The height a jump from the lane rises, and the frames it stays in the air. */
function jumpArc(state: GameEngineState): { height: number; frames: number } {
  let s = pressJump(state);
  let peak = s.playerY;
  let frames = 0;
  while (frames < 200) {
    s = step(s);
    frames += 1;
    peak = Math.min(peak, s.playerY);
    if (s.isGrounded && frames > 1) break;
  }
  return { height: state.playerY - peak, frames };
}

describe("Second Wind: starting it from a Sync Block", () => {
  it("a wind block is used up, pays Sync Block score and starts its event with a banner", () => {
    const s = step(bumping(windBlock()));
    expect(s.course?.blocks[0].used).toBe(true);
    expect(s.secondWind?.kind).toBe("hills");
    expect(s.secondWind?.stage).toBe(1);
    expect(s.secondWind?.medalId).toBe(medalId(1, 1));
    expect(s.banner?.text).toBe(
      `${SECOND_WIND_EVENTS.hills.name} · ${SECOND_WIND_EVENTS.hills.goalText}`
    );
    expect(s.banner?.tone).toBe("good");
    expect(s.banner?.ttlMs).toBe(2200);
    expect(s.score).toBeGreaterThanOrEqual(SYNC_BLOCK_SCORE);
  });

  it("never emerges a pickup or Kudos from a wind block", () => {
    const s = step(bumping(windBlock({ windKind: "taper" })));
    expect(s.pickups ?? []).toEqual([]);
    expect(s.kudos ?? 0).toBe(0);
    expect(s.secondWind?.kind).toBe("taper");
  });

  it("falls back to Taper Week when the block names no event", () => {
    const s = step(bumping(windBlock({ windKind: undefined })));
    expect(s.secondWind?.kind).toBe("taper");
  });

  it("starts no second event while one runs, and keeps the block for later", () => {
    const running = wind("taper");
    const s = step(bumping(windBlock(), { secondWind: running }));
    expect(s.course?.blocks[0].used).toBe(false);
    expect(s.secondWind?.kind).toBe("taper");
  });

  it("starts the event with no medal when that medal is already found", () => {
    const s = step(bumping(windBlock(), { medalsFound: [medalId(1, 1)] }));
    expect(s.secondWind?.kind).toBe("hills");
    expect(s.secondWind?.medalId).toBeUndefined();
  });

  it("a spinning cape bumps a wind block from the side and starts its event", () => {
    const block = windBlock({
      x: PLAYER_X + PLAYER_WIDTH + 2,
      y: GROUND_Y - PLAYER_HEIGHT,
    });
    const s = step(
      run(
        {
          power: "cape",
          playerY: GROUND_Y - PLAYER_HEIGHT,
          isGrounded: true,
          spinMs: 300,
        },
        { ...EMPTY_COURSE, blocks: [block] }
      )
    );
    expect(s.course?.blocks[0].used).toBe(true);
    expect(s.secondWind?.kind).toBe("hills");
  });
});

describe("Second Wind: the timer and the restore", () => {
  it("runs for its full time, then the stage snaps back and says so", () => {
    // Taper Week with no Kudos: its goal is never met, so it ends in a warn.
    const started = step(bumping(windBlock({ windKind: "taper" })));
    const { state: ended, frames } = stepUntil(
      started,
      (s) => s.secondWind === null,
      1000
    );
    expect(frames).toBeGreaterThanOrEqual(
      Math.floor(SECOND_WIND_MS / FRAME) - 1
    );
    expect(frames).toBeLessThanOrEqual(Math.ceil(SECOND_WIND_MS / FRAME) + 1);
    expect(ended.banner?.text).toBe(`${SECOND_WIND_EVENTS.taper.name} OVER`);
    expect(ended.banner?.tone).toBe("warn");
  });

  it("restores the normal jump the tick the event ends", () => {
    const normal = jumpArc(onLane());
    const ended = step(onLane({ secondWind: wind("taper") }), 1);
    const restored = stepUntil(ended, (s) => s.secondWind === null, 1000).state;
    expect(jumpArc(restored)).toEqual(normal);
  });
});

describe("Second Wind: Taper Week", () => {
  it("floats every jump: it rises higher and stays up longer than a normal jump", () => {
    const normal = jumpArc(onLane());
    const taper = jumpArc(onLane({ secondWind: wind("taper") }));
    expect(taper.height).toBeGreaterThan(normal.height);
    expect(taper.frames).toBeGreaterThan(normal.frames);
  });

  it("pays its Kudos goal once Kudos are collected, with the medal", () => {
    const kudosNear = {
      id: 1,
      x: PLAYER_X + 10,
      y: GROUND_Y - PLAYER_HEIGHT + 6,
    };
    const goal = SECOND_WIND_EVENTS.taper.goal;
    const s = step(
      onLane(
        {
          secondWind: { ...wind("taper", goal - 1, medalId(1, 2)) },
        },
        { ...EMPTY_COURSE, kudos: [kudosNear] }
      )
    );
    // The goal is met, so the event is cleared; it runs on until its time is up.
    expect(s.secondWind?.cleared).toBe(true);
    expect(s.medalsFound).toEqual([medalId(1, 2)]);
    expect(toasts(s, "Second Wind!")).toBe(1);
  });
});

describe("Second Wind: Hill Repeats", () => {
  /** The distance one frame covers, from the lane at `distance` metres. */
  const advance = (state: GameEngineState) =>
    updateGameSimulation(state, FRAME).distanceMeters - state.distanceMeters;

  it("scales the run by the hill at the runner's world x, climbing slow and descending fast", () => {
    const hills = wind("hills");
    // Crests and troughs of the lane: world x = wavelength * k + wavelength/4 or 3/4.
    const climbX = HILL_WAVELENGTH / 4;
    const descentX = (3 * HILL_WAVELENGTH) / 4;
    const at = (worldX: number) => (worldX - PLAYER_X) / PX_PER_METER;
    const base = advance(onLane({ distanceMeters: at(climbX) }));
    const up = advance(
      onLane({ distanceMeters: at(climbX), secondWind: hills })
    );
    const downBase = advance(onLane({ distanceMeters: at(descentX) }));
    const down = advance(
      onLane({ distanceMeters: at(descentX), secondWind: hills })
    );
    expect(base).toBeGreaterThan(0);
    expect(up / base).toBeCloseTo(hillSpeedScale(hills, climbX), 5);
    expect(down / downBase).toBeCloseTo(hillSpeedScale(hills, descentX), 5);
    expect(up).toBeLessThan(base);
    expect(down).toBeGreaterThan(downBase);
  });

  it("runs at normal pace again once the event is over", () => {
    const beforeEnd = stepUntil(
      step(bumping(windBlock({ windKind: "hills" }))),
      (s) => s.secondWind === null,
      1000
    ).state;
    const at = beforeEnd.distanceMeters;
    expect(advance(beforeEnd)).toBeCloseTo(
      advance(onLane({ distanceMeters: at })),
      5
    );
  });

  it("counts the metres run towards its goal", () => {
    const s = step(onLane({ secondWind: wind("hills") }), 30);
    expect(s.secondWind?.progress ?? 0).toBeGreaterThan(0);
    expect(s.secondWind?.progress).toBeCloseTo(s.distanceMeters - 0, 3);
  });
});

describe("Second Wind: Fun Run", () => {
  it("a foe touched is a high five: removed, a Kudos, score and no damage", () => {
    const s = step(
      onLane({
        secondWind: wind("funrun"),
        foes: [kettlebell()],
        lives: START_LIVES,
      })
    );
    expect(s.foes ?? []).toEqual([]);
    expect(s.kudos).toBe(1);
    expect(s.lives).toBe(START_LIVES);
    expect(s.invulnerableMs ?? 0).toBe(0);
    expect(s.gameState).toBe("playing");
    expect(toasts(s, "HIGH FIVE!")).toBe(1);
    expect(s.score).toBeGreaterThanOrEqual(KUDOS_SCORE);
    expect(s.secondWind?.progress).toBe(1);
  });

  it("the same foe hurts a runner with no Second Wind", () => {
    const s = step(onLane({ foes: [kettlebell()], lives: START_LIVES }));
    expect(s.lives).toBe(START_LIVES - 1);
  });

  it("a foe landed on from above is a high five too", () => {
    const falling = run(
      {
        playerY: GROUND_Y - PLAYER_HEIGHT - 16,
        playerVy: 6,
        isGrounded: false,
        secondWind: wind("funrun"),
        foes: [kettlebell(PLAYER_X - 2)],
        lives: START_LIVES,
      },
      EMPTY_COURSE
    );
    const s = step(falling);
    expect(s.foes ?? []).toEqual([]);
    expect(s.lives).toBe(START_LIVES);
    expect(toasts(s, "HIGH FIVE!")).toBe(1);
  });

  it("the Rep Max is not a high five: it still hurts", () => {
    const s = step(
      onLane({
        secondWind: wind("funrun"),
        foes: [repMax()],
        lives: START_LIVES,
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(toasts(s, "HIGH FIVE!")).toBe(0);
  });

  it("clears foe shots and fires none while it runs", () => {
    const lap = makeFoe(7, "lap", PLAYER_X + 220, GROUND_Y);
    const control = onLane({
      foes: [lap],
      lives: START_LIVES,
      lastObstacleTime: clock,
    });
    let peak = 0;
    let s = control;
    for (let i = 0; i < 600; i++) {
      s = step(s);
      peak = Math.max(peak, (s.foeShots ?? []).length);
    }
    expect(peak).toBeGreaterThan(0);
    let fun = onLane({
      foes: [lap],
      lives: START_LIVES,
      secondWind: wind("funrun"),
    });
    let funPeak = 0;
    for (let i = 0; i < 600; i++) {
      fun = step(fun);
      funPeak = Math.max(funPeak, (fun.foeShots ?? []).length);
      if (fun.secondWind === null) break;
    }
    expect(funPeak).toBe(0);
  });

  it("pays its goal medal once when the third high five lands", () => {
    const s = step(
      onLane({
        secondWind: wind(
          "funrun",
          SECOND_WIND_EVENTS.funrun.goal - 1,
          medalId(1, 1)
        ),
        foes: [kettlebell()],
      })
    );
    expect(s.medalsFound).toEqual([medalId(1, 1)]);
    expect(s.score).toBeGreaterThanOrEqual(MEDAL_SCORE);
    expect(toasts(s, "Second Wind!")).toBe(1);
    expect(toasts(s, `MEDAL 1/${MEDALS_PER_STAGE}`)).toBe(1);
    // The popup lives on for a while, but the goal does not pay again.
    const again = step(s, 5);
    expect(again.medalsFound).toEqual([medalId(1, 1)]);
    expect(toasts(again, "Second Wind!")).toBe(1);
    expect(again.score - s.score).toBeLessThan(MEDAL_SCORE);
  });
});

describe("Second Wind: Night Run", () => {
  it("counts a hit that a buff runner survives, and the event keeps going", () => {
    const s = step(
      onLane({
        power: "buff",
        playerY: GROUND_Y - (PLAYER_HEIGHT + 6),
        secondWind: wind("night"),
        foes: [kettlebell()],
        lives: START_LIVES,
      })
    );
    expect(s.lives).toBe(START_LIVES);
    expect(s.power).toBe("base");
    expect(s.secondWind?.progress).toBe(1);
  });

  it("is settled only when the time runs out: no hits pays the medal and a good banner", () => {
    const started = step(
      onLane({ secondWind: wind("night", 0, medalId(1, 3)) })
    );
    const mid = step(started, 60);
    expect(mid.medalsFound ?? []).toEqual([]);
    const { state: ended } = stepUntil(mid, (s) => s.secondWind === null, 1000);
    expect(ended.medalsFound).toEqual([medalId(1, 3)]);
    expect(ended.banner?.text).toBe(`${SECOND_WIND_EVENTS.night.name} OVER`);
    expect(ended.banner?.tone).toBe("good");
  });

  it("a hit taken means no medal and a warn banner at the end", () => {
    const hit = step(
      onLane({
        power: "buff",
        playerY: GROUND_Y - (PLAYER_HEIGHT + 6),
        secondWind: wind("night", 0, medalId(1, 3)),
        foes: [kettlebell()],
        lives: START_LIVES,
      })
    );
    expect(hit.secondWind?.progress).toBe(1);
    const { state: ended } = stepUntil(hit, (s) => s.secondWind === null, 1000);
    expect(ended.medalsFound ?? []).toEqual([]);
    expect(ended.banner?.tone).toBe("warn");
  });
});

describe("Second Wind: how it ends early", () => {
  it("a lost life ends the event", () => {
    const s = step(
      onLane({
        secondWind: wind("taper"),
        foes: [kettlebell()],
        lives: START_LIVES,
        power: "base",
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.secondWind).toBeNull();
  });

  it("the last life lost ends the event with the run", () => {
    const s = step(
      onLane({
        secondWind: wind("taper"),
        foes: [kettlebell()],
        lives: 1,
        power: "base",
      })
    );
    expect(s.gameState).toBe("crashed");
    expect(s.secondWind).toBeNull();
  });

  it("a stage clear ends the event and keeps the stage's own banner", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 5, stage: 1 }],
    };
    const s = step(onLane({ secondWind: wind("hills") }, course));
    expect(s.secondWind).toBeNull();
    expect(s.banner?.text.startsWith("LAP")).toBe(true);
  });

  it("a secret exit ends the event as well", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 5, stage: 1, secret: true }],
    };
    const s = step(onLane({ secondWind: wind("taper") }, course));
    expect(s.secondWind).toBeNull();
  });

  it("starting a new run clears any event", () => {
    const s = startGame({ ...onLane({ secondWind: wind("taper") }) }, "fenix");
    expect(s.secondWind).toBeNull();
  });

  it("damage in the grace window is not a hit for Night Run", () => {
    const s = step(
      onLane({
        secondWind: wind("night"),
        invulnerableMs: DAMAGE_GRACE_MS,
        foes: [kettlebell()],
        lives: START_LIVES,
        power: "buff",
      })
    );
    expect(s.secondWind?.progress).toBe(0);
  });
});

describe("Second Wind: a bonus room", () => {
  it("keeps counting down while the runner is inside the room", () => {
    let s = onLane({
      secondWind: wind("taper"),
      bonusRoom: {
        returnCourse: EMPTY_COURSE,
        returnProps: EMPTY_PROPS,
        returnFoes: [],
        returnPickups: [],
        exitX: 900,
        endX: PLAYER_X + 100_000,
      },
    });
    for (let i = 0; i < 30; i++) s = step(s);
    expect(s.bonusRoom).not.toBeNull();
    expect(s.secondWind?.msLeft).toBeCloseTo(SECOND_WIND_MS - 30 * FRAME, 3);
  });

  it("keeps its clock across the room's far wall, and the event is not cleared there", () => {
    const s = step(
      onLane({
        secondWind: wind("taper"),
        bonusRoom: {
          returnCourse: EMPTY_COURSE,
          returnProps: EMPTY_PROPS,
          returnFoes: [],
          returnPickups: [],
          exitX: 900,
          endX: PLAYER_X,
        },
      })
    );
    // The far wall takes the runner back out onto the lane.
    expect(s.bonusRoom).toBeNull();
    expect(s.secondWind?.kind).toBe("taper");
    expect(s.secondWind?.msLeft).toBeCloseTo(SECOND_WIND_MS - FRAME, 3);
  });
});
