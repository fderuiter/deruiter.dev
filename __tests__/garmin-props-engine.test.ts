import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  enterStation,
  setRules,
  startGame,
  updateGameSimulation,
  FLASH_STORAGE_KEY,
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin/engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  PX_PER_METER,
  type CourseBlock,
  type CourseKudos,
  type CourseLayout,
} from "@/lib/garmin/course";
import {
  BELT_WIDTH,
  EMPTY_PROPS,
  PLYO_HEIGHT,
  PLYO_HELD_VY,
  PLYO_LAUNCH_VY,
  PLYO_WIDTH,
  PR_BOARD_SCORE,
  REST_DAY_MS,
  STATION_WIDTH,
  beltOffset,
  propFootings,
  generateBonusRoom,
  restDaySwap,
  type CourseBelt,
  type CoursePlyo,
  type CourseProps,
  type CourseStation,
  type CourseSwitch,
} from "@/lib/garmin/props";
import { START_LIVES } from "@/lib/garmin/powerups";
import { STALLED_ALERT_MS, STALLED_ALERT_TEXT } from "@/lib/garmin/culture";

// Course props on the Monkey C Mayhem course (#1992): Water Stations and their
// bonus rooms, Plyo Boxes, the Rest Day Switch, Treadmill Belts and PR Boards.

const DT = 16;
let clock = 0;

beforeEach(() => {
  if (typeof window.localStorage?.removeItem === "function") {
    window.localStorage.removeItem(FLASH_STORAGE_KEY);
  }
  clock = 5_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run with no spawns, no GPS hold, no foes and the given course and props. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {},
  props: CourseProps = EMPTY_PROPS
): GameEngineState {
  return {
    ...startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix"),
    course,
    props,
    gpsMs: 0,
    foes: [],
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, DT);
  return s;
}

/** Steps until `done` holds, or the frame cap runs out. */
function stepUntil(
  state: GameEngineState,
  done: (s: GameEngineState) => boolean,
  cap = 600
): GameEngineState {
  let s = state;
  for (let i = 0; i < cap && !done(s); i++) {
    s = updateGameSimulation(s, DT);
  }
  return s;
}

function bug(x: number, extra: Partial<Obstacle> = {}): Obstacle {
  return {
    id: 1,
    x,
    y: GROUND_Y - 20,
    width: 16,
    height: 20,
    type: "null_pointer",
    label: "NULL",
    speed: 0,
    ...extra,
  };
}

function brick(extra: Partial<CourseBlock> = {}): CourseBlock {
  return {
    id: 1,
    x: 300,
    y: GROUND_Y - 72,
    kind: "brick",
    contents: "kudos",
    used: false,
    ...extra,
  };
}

function station(extra: Partial<CourseStation> = {}): CourseStation {
  return {
    id: 1,
    x: 200,
    width: STATION_WIDTH,
    height: 20,
    enterable: false,
    exitX: 900,
    ...extra,
  };
}

function plyo(extra: Partial<CoursePlyo> = {}): CoursePlyo {
  return { id: 2, x: 200, width: PLYO_WIDTH, height: PLYO_HEIGHT, ...extra };
}

function belt(extra: Partial<CourseBelt> = {}): CourseBelt {
  return {
    id: 3,
    x: 200,
    y: GROUND_Y - 30,
    width: BELT_WIDTH,
    axis: "x",
    range: 60,
    periodMs: 2600,
    ...extra,
  };
}

function switchAt(extra: Partial<CourseSwitch> = {}): CourseSwitch {
  return { id: 4, x: 200, pressed: false, ...extra };
}

describe("Water Station sides", () => {
  it("stop a runner on the lane just before the station", () => {
    const wall = station({ x: 200 });
    const props: CourseProps = { ...EMPTY_PROPS, stations: [wall] };
    let s = run(
      EMPTY_COURSE,
      {
        distanceMeters: 10,
        isGrounded: true,
        playerY: GROUND_Y - PLAYER_HEIGHT,
        playerVy: 0,
      },
      props
    );
    s = step(s, 10);
    expect(s.distanceMeters).toBeGreaterThan(10);

    s = step(s, 300);
    // The body's right edge stops at the station's left edge.
    const stopAt = (wall.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER;
    expect(s.distanceMeters).toBeCloseTo(stopAt, 6);
    expect(s.distanceMeters).toBeLessThan(wall.x / PX_PER_METER);

    const held = s.distanceMeters;
    s = step(s, 30);
    expect(s.distanceMeters).toBe(held);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it("scores nothing while it holds the runner, and says to jump (#2232)", () => {
    const wall = station({ x: 200 });
    const props: CourseProps = { ...EMPTY_PROPS, stations: [wall] };
    let s = run(
      EMPTY_COURSE,
      {
        distanceMeters: 10,
        isGrounded: true,
        playerY: GROUND_Y - PLAYER_HEIGHT,
        playerVy: 0,
        banner: null,
      },
      props
    );
    s = step(s, 300);
    const held = { distance: s.distanceMeters, score: s.score };
    s = step(s, 30);
    expect(s.distanceMeters).toBe(held.distance);
    expect(s.score).toBe(held.score);

    let alert = false;
    for (let i = 0; i < Math.ceil(STALLED_ALERT_MS / 16) + 5; i++) {
      s = step(s, 1);
      if (s.banner?.text === STALLED_ALERT_TEXT) alert = true;
    }
    expect(alert).toBe(true);
    expect(s.score).toBe(held.score);
  });

  it("is landed on from above: a falling runner lands on its top", () => {
    const top = GROUND_Y - 20;
    const props: CourseProps = {
      ...EMPTY_PROPS,
      stations: [station({ x: 200, height: 20 })],
    };
    let s = run(
      EMPTY_COURSE,
      {
        distanceMeters: 15,
        // Feet six pixels above the table top, falling.
        playerY: top - 6 - PLAYER_HEIGHT,
        playerVy: 0,
        isGrounded: false,
      },
      props
    );
    s = stepUntil(s, (x) => x.isGrounded, 200);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY + PLAYER_HEIGHT).toBe(GROUND_Y - 20);
    expect(s.playerY).toBe(top - PLAYER_HEIGHT);
  });
});

describe("Plyo Boxes", () => {
  const box = plyo({ x: 200 });
  const top = GROUND_Y - PLYO_HEIGHT;

  function fallingOnto(jumpHeld: boolean): GameEngineState {
    return run(
      EMPTY_COURSE,
      {
        distanceMeters: 14.5,
        playerY: top - 4 - PLAYER_HEIGHT,
        playerVy: 0,
        isGrounded: false,
        jumpHeld,
      },
      { ...EMPTY_PROPS, plyos: [box] }
    );
  }

  it("launch a runner at the tap speed when jump is not held", () => {
    let s = fallingOnto(false);
    s = stepUntil(s, (x) => x.playerVy < 0, 200);
    expect(s.playerVy).toBe(PLYO_LAUNCH_VY);
    expect(s.isGrounded).toBe(false);
    expect(s.playerY).toBe(top - PLAYER_HEIGHT);
  });

  it("launch a runner higher when jump is held", () => {
    let s = fallingOnto(true);
    s = stepUntil(s, (x) => x.playerVy < 0, 200);
    expect(s.playerVy).toBe(PLYO_HELD_VY);
    expect(s.isGrounded).toBe(false);
    expect(s.playerY).toBe(top - PLAYER_HEIGHT);
  });
});

describe("Treadmill Belts", () => {
  it("carry a grounded runner forward along an x belt", () => {
    const b = belt();
    const start = {
      distanceMeters: 14.5,
      playerY: b.y - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
    };
    const carried = updateGameSimulation(
      run(EMPTY_COURSE, start, { ...EMPTY_PROPS, belts: [b] }),
      DT
    );
    const paceOnly = updateGameSimulation(run(EMPTY_COURSE, start), DT);

    const extra = carried.distanceMeters - paceOnly.distanceMeters;
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeCloseTo(beltOffset(b, DT).dx / PX_PER_METER, 9);
    expect(carried.isGrounded).toBe(true);
  });

  it("move a runner's y with a y belt", () => {
    const b = belt({
      x: 200,
      y: GROUND_Y - 64,
      axis: "y",
      range: 34,
      periodMs: 400,
    });
    let s = run(
      EMPTY_COURSE,
      {
        distanceMeters: 14.5,
        playerY: b.y - PLAYER_HEIGHT,
        playerVy: 0,
        isGrounded: true,
      },
      { ...EMPTY_PROPS, belts: [b] }
    );
    s = step(s, 4);
    const top = b.y + beltOffset(b, s.propClockMs ?? 0).dy;
    expect(top).toBeGreaterThan(b.y);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY + PLAYER_HEIGHT).toBeCloseTo(top, 6);
  });
});

describe("Rest Day Switch", () => {
  // A station ahead stops the runner before the bricks and Kudos beyond it, so
  // nothing is collected while the rest day runs. It sits well past the
  // switch, so the runner is back on the lane by the time it reaches it.
  const wall = station({ id: 5, x: 300, height: 20 });
  const kudo: CourseKudos = { id: 2, x: 360, y: GROUND_Y - 30 };
  const outside: CourseLayout = {
    ...EMPTY_COURSE,
    blocks: [brick({ x: 340 })],
    kudos: [kudo],
  };

  it("landing on the switch swaps bricks and Kudos, then reverts when the rest day ends", () => {
    const sw = switchAt({ x: 200 });
    let s = run(
      outside,
      {
        distanceMeters: 14.5,
        // Feet four pixels above the switch top, falling.
        playerY: GROUND_Y - 8 - 4 - PLAYER_HEIGHT,
        playerVy: 0,
        isGrounded: false,
      },
      { ...EMPTY_PROPS, switches: [sw], stations: [wall] }
    );
    s = stepUntil(
      s,
      (x) => (x.props?.switches ?? []).some((z) => z.pressed),
      200
    );
    expect((s.props?.switches ?? []).some((z) => z.pressed)).toBe(true);
    expect(s.restDayMs).toBe(REST_DAY_MS);
    expect(s.banner?.text).toMatch(/REST DAY/);

    // Bricks become Kudos flagged fromBrick; Kudos become bricks flagged fromKudos.
    expect(s.course?.kudos).toEqual([
      { id: 1, x: 347, y: GROUND_Y - 72 + 7, fromBrick: true },
    ]);
    expect(s.course?.blocks).toEqual([
      {
        id: 2,
        x: 360 - 7,
        y: GROUND_Y - 30 - 7,
        kind: "brick",
        contents: "kudos",
        used: true,
        fromKudos: true,
      },
    ]);

    s = stepUntil(s, (x) => x.restDayMs === 0, 700);
    expect(s.restDayMs).toBe(0);
    // The runner was held by the station's side the whole time.
    expect(s.distanceMeters).toBeCloseTo(
      (wall.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER,
      6
    );
    expect(s.course).toEqual(outside);
    expect(s.course).toEqual(restDaySwap(restDaySwap(outside, true), false));
  });

  it("the swap is undone at the door of a Water Station entered during a rest day", () => {
    const swapped = restDaySwap(outside, true);
    const door = station({ id: 6, x: 200, enterable: true, exitX: 900 });
    const s = enterStation(
      run(
        swapped,
        {
          distanceMeters: 15,
          playerY: GROUND_Y - 20 - PLAYER_HEIGHT,
          playerVy: 0,
          isGrounded: true,
          restDayMs: 4000,
        },
        { ...EMPTY_PROPS, stations: [door] }
      )
    );
    expect(s.bonusRoom?.returnCourse).toEqual(outside);
    expect(s.restDayMs).toBe(0);
  });
});

describe("PR Boards", () => {
  const pr = brick({ x: PLAYER_X });

  function rising(power: "base" | "buff"): GameEngineState {
    return run(
      { ...EMPTY_COURSE, blocks: [pr] },
      {
        power,
        isGrounded: false,
        playerY: pr.y + BLOCK_SIZE + 1,
        playerVy: -6,
      }
    );
  }

  it("a Buff runner rising into a brick breaks it and scores PR_BOARD_SCORE", () => {
    const s = step(rising("buff"));
    expect(s.course?.blocks).toEqual([]);
    expect(s.score).toBeGreaterThanOrEqual(PR_BOARD_SCORE);
    expect(s.score).toBeLessThan(PR_BOARD_SCORE + 2);
    expect(s.popups?.map((p) => p.text)).toContain("NEW PR!");
  });

  it("a Base runner rising into a brick only stops, and the brick stays", () => {
    const s = step(rising("base"));
    expect(s.course?.blocks).toEqual([pr]);
    expect(s.playerY).toBe(pr.y + BLOCK_SIZE);
    expect(s.score).toBeLessThan(PR_BOARD_SCORE);
  });

  it("a Rest Day brick never breaks, so its Kudos comes back", () => {
    const disguised = { ...pr, fromKudos: true };
    const s = step(
      run(
        { ...EMPTY_COURSE, blocks: [disguised] },
        {
          power: "buff",
          isGrounded: false,
          playerY: pr.y + BLOCK_SIZE + 1,
          playerVy: -6,
        }
      )
    );
    expect(s.course?.blocks).toEqual([disguised]);
  });
});

describe("enterStation", () => {
  const door = station({ id: 9, x: 200, enterable: true, exitX: 900 });

  function atDoor(
    overrides: Partial<GameEngineState> = {},
    props: CourseProps = { ...EMPTY_PROPS, stations: [door] }
  ): GameEngineState {
    return run(
      EMPTY_COURSE,
      {
        distanceMeters: 15,
        playerY: GROUND_Y - door.height - PLAYER_HEIGHT,
        playerVy: 0,
        isGrounded: true,
        ...overrides,
      },
      props
    );
  }

  it("returns the same object when no enterable station is under the runner", () => {
    const away = run(
      EMPTY_COURSE,
      {
        distanceMeters: 0,
        isGrounded: true,
        playerY: GROUND_Y - PLAYER_HEIGHT,
      },
      { ...EMPTY_PROPS, stations: [door] }
    );
    expect(enterStation(away)).toBe(away);

    const sealed = atDoor(
      {},
      {
        ...EMPTY_PROPS,
        stations: [{ ...door, enterable: false }],
      }
    );
    expect(enterStation(sealed)).toBe(sealed);

    const spent = atDoor(
      {},
      {
        ...EMPTY_PROPS,
        stations: [{ ...door, used: true }],
      }
    );
    expect(enterStation(spent)).toBe(spent);
  });

  it("returns the same object during GPS, when not playing, or already in a room", () => {
    const gps = atDoor({ gpsMs: 500 });
    expect(enterStation(gps)).toBe(gps);

    const idle = atDoor({ gameState: "idle" });
    expect(enterStation(idle)).toBe(idle);

    const room = atDoor({
      bonusRoom: {
        returnCourse: EMPTY_COURSE,
        returnProps: EMPTY_PROPS,
        returnFoes: [],
        returnPickups: [],
        exitX: 900,
        endX: 1000,
      },
    });
    expect(enterStation(room)).toBe(room);
  });

  it("opens the bonus room, marks the station used, and empties the lane", () => {
    const foes =
      startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix")
        .foes ?? [];
    const state = atDoor({ foes, obstacles: [bug(PLAYER_X + 4)] });
    const s = enterStation(state);

    expect(s).not.toBe(state);
    expect(s.bonusRoom).toEqual({
      returnCourse: EMPTY_COURSE,
      returnProps: {
        ...EMPTY_PROPS,
        stations: [{ ...door, used: true }],
      },
      returnFoes: foes,
      returnPickups: [],
      exitX: 900,
      // The room's far wall sits one room length ahead of the runner's feet.
      endX: 150 + PLAYER_X + 640,
    });
    expect(s.bonusRoom?.returnFoes).toBe(foes);
    expect(s.props).toEqual(EMPTY_PROPS);
    expect(s.foes).toEqual([]);
    expect(s.obstacles).toEqual([]);
    expect(s.course).toEqual(generateBonusRoom(150, door.id, GROUND_Y));
    expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
    expect(s.banner?.text).toMatch(/WATER STATION/);
  });

  it("walking to the far wall puts the runner back on the lane at the exit", () => {
    const foes =
      startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix")
        .foes ?? [];
    let s = enterStation(atDoor({ foes }));
    expect(s.bonusRoom).not.toBeNull();

    s = stepUntil(s, (x) => x.bonusRoom === null, 3000);
    expect(s.bonusRoom).toBeNull();
    expect(s.distanceMeters).toBe((900 - PLAYER_X) / PX_PER_METER);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
    // Foes waiting at the exit step aside; the rest come back.
    expect(s.foes).toEqual(
      foes.filter((f) => f.x + f.width < 900 - 40 || f.x > 900 + 160)
    );
  });

  it("clears foes standing at the exit and carries power-ups along", () => {
    const template = (startGame(
      setRules(createInitialState("fenix", 0), "fitness"),
      "fenix"
    ).foes ?? [])[0];
    const atExit = { ...template, id: 1, x: 920 };
    const farAhead = { ...template, id: 2, x: 2000 };
    const entered = enterStation(
      atDoor({
        foes: [atExit, farAhead],
        pickups: [
          {
            id: 7,
            kind: "shake",
            x: 260,
            y: GROUND_Y - 20,
            vx: 0,
            vy: 0,
            emergeMs: 0,
          },
        ],
      })
    );
    expect(entered.bonusRoom?.returnPickups).toHaveLength(1);
    const out = stepUntil(entered, (x) => x.bonusRoom === null, 3000);
    expect(out.foes?.map((f) => f.id)).toEqual([2]);
    // The power-up keeps its place relative to the runner.
    const shift = 900 - (150 + PLAYER_X);
    expect(out.pickups?.[0]?.x).toBeGreaterThan(260 + shift - 20);
  });
});

describe("stage layout with props", () => {
  it("never starts a foe inside a station, box or switch", () => {
    for (let seed = 0; seed < 40; seed++) {
      vi.spyOn(Math, "random").mockReturnValue(seed / 40);
      const s = startGame(
        setRules(createInitialState("fenix", 0), "fitness"),
        "fenix"
      );
      const footings = propFootings(s.props ?? EMPTY_PROPS, 0, GROUND_Y);
      for (const f of s.foes ?? []) {
        expect(
          footings.some((p) => f.x < p.right + 8 && f.x + f.width > p.left - 8)
        ).toBe(false);
      }
      vi.mocked(Math.random).mockRestore();
    }
  });

  it("swaps a stage appended during a Rest Day", () => {
    const base = run(EMPTY_COURSE, {}, EMPTY_PROPS);
    const stage1Pole = 10000 - 60;
    const s = run(
      { ...EMPTY_COURSE, poles: [{ x: stage1Pole, stage: 1 }] },
      {
        stage: 1,
        courseSeed: base.courseSeed,
        distanceMeters: (stage1Pole - PLAYER_X) / PX_PER_METER,
        restDayMs: 5000,
        isGrounded: true,
        playerY: GROUND_Y - PLAYER_HEIGHT,
      }
    );
    const next = updateGameSimulation(s, DT);
    expect(next.stage).toBe(2);
    expect(next.restDayMs).toBeGreaterThan(0);
    const bricks = (next.course?.blocks ?? []).filter(
      (b) => b.kind === "brick" && !b.fromKudos
    );
    expect(bricks).toHaveLength(0);
    expect((next.course?.kudos ?? []).some((k) => k.fromBrick)).toBe(true);
  });
});

describe("losing a life clears the course props state", () => {
  it("a bug in a bonus room costs a life and leaves the room", () => {
    const door = station({ id: 9, x: 200, enterable: true, exitX: 900 });
    const entered = enterStation(
      run(
        EMPTY_COURSE,
        {
          distanceMeters: 15,
          playerY: GROUND_Y - door.height - PLAYER_HEIGHT,
          playerVy: 0,
          isGrounded: true,
        },
        { ...EMPTY_PROPS, stations: [door] }
      )
    );
    expect(entered.bonusRoom).not.toBeNull();

    const s = step({ ...entered, obstacles: [bug(PLAYER_X + 4)] });
    expect(s.gameState).toBe("playing");
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.bonusRoom).toBeNull();
    expect(s.restDayMs).toBe(0);
  });

  it("a bug during a rest day costs a life and ends the rest day", () => {
    const s = step(
      run(EMPTY_COURSE, {
        restDayMs: 4000,
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    expect(s.gameState).toBe("playing");
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.restDayMs).toBe(0);
    expect(s.bonusRoom ?? null).toBeNull();
  });
});
