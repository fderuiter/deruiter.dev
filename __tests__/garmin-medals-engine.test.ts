// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  STAGE_CLEAR_SCORE,
  createInitialState,
  enterStation,
  pressAction,
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
  generateStage,
  stageStartX,
  type CourseBlock,
  type CourseLayout,
  type CourseMedal,
} from "@/lib/garmin/course";
import {
  BONUS_ROOM_LENGTH,
  EMPTY_PROPS,
  PR_BOARD_SCORE,
  generateStageProps,
  propFootings,
  type CourseProps,
  type CourseStation,
} from "@/lib/garmin/props";
import {
  CHECKPOINT_BANNER,
  CHECKPOINT_TOAST,
  MEDAL_SCORE,
  ROOM_MEDAL_DX,
  SECRET_EXIT_BANNER,
  SECRET_POLE_INSET,
  hideFoundMedals,
  medalStage,
  placeStageExtras,
} from "@/lib/garmin/medals";
import { generateFoes, type Foe } from "@/lib/garmin/foes";
import { SLAM_VY } from "@/lib/garmin/moves";
import { START_LIVES } from "@/lib/garmin/powerups";
import { themeForStage } from "@/lib/garmin/themes";

// Finisher Medals, the Aid Station and secret exits in the engine (#2025):
// the pickups and their points, the three ways a PR Board gives up its medal,
// bonus room medals and secret poles, checkpoints and the lost-life restart.

const FRAME = 1000 / 60;
const SEED = 4242;
let clock = 7_100_000;

beforeEach(() => {
  clock = 7_100_000;
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
    courseSeed: SEED,
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

/** A grounded Base runner standing on the lane. */
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
function popupTexts(state: GameEngineState): string[] {
  return (state.popups ?? []).map((p) => p.text);
}

/** A bug on the lane at screen x, that hits a runner standing at PLAYER_X. */
function bug(x: number): Obstacle {
  return {
    id: 1,
    x,
    y: GROUND_Y - 20,
    width: 16,
    height: 20,
    type: "null_pointer",
    label: "NULL",
    speed: 0,
  };
}

/** A runner whose box overlaps a medal at `x` when stood there. */
function distanceToStandAt(worldX: number): number {
  return (worldX - PLAYER_X - 5) / PX_PER_METER;
}

/** A brick (a PR Board when it holds a medal) at world x, y. */
function board(
  x: number,
  y: number,
  extra: Partial<CourseBlock> = {}
): CourseBlock {
  return {
    id: 2,
    x,
    y,
    kind: "brick",
    contents: "kudos",
    used: false,
    ...extra,
  };
}

/** A Water Station the runner can stand on, with its room's medal and exit. */
function station(extra: Partial<CourseStation> = {}): CourseStation {
  return {
    id: 6,
    x: 200,
    width: 60,
    height: 20,
    enterable: true,
    exitX: 900,
    ...extra,
  };
}

/** A grounded runner standing on `door`, ready to press Down. */
function atDoor(
  door: CourseStation,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return run(
    {
      distanceMeters: 15,
      playerY: GROUND_Y - door.height - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
      ...overrides,
    },
    EMPTY_COURSE,
    { ...EMPTY_PROPS, stations: [door] }
  );
}

/** A stage's course and props as the engine lays them out (#2025). */
function laid(stage: number, seed: number) {
  const theme = themeForStage(stage);
  const placed = generateStageProps(
    stage,
    seed,
    GROUND_Y,
    generateStage(stage, seed, GROUND_Y, theme),
    theme
  );
  return placeStageExtras(
    placed.layout,
    placed.props,
    stage,
    seed,
    GROUND_Y,
    theme,
    PLAYER_WIDTH
  );
}

/** The foes a fresh stage starts with, as the engine sets them. */
function freshFoes(stage: number, seed: number): Foe[] {
  const { course, props } = laid(stage, seed);
  const footings = propFootings(props, 0, GROUND_Y);
  return generateFoes(
    stage,
    seed,
    course,
    GROUND_Y,
    themeForStage(stage)
  ).filter(
    (f) =>
      !footings.some((p) => f.x < p.right + 8 && f.x + f.width > p.left - 8)
  );
}

describe("picking up a free medal", () => {
  const medal = (id: number, x: number): CourseMedal => ({
    id,
    stage: 1,
    x,
    y: GROUND_Y - 20,
  });

  it("touching a medal finds it: off the course, its id kept, its points and a MEDAL 1/3 popup", () => {
    const before = onLane(
      {},
      { ...EMPTY_COURSE, medals: [medal(11, PLAYER_X + 6)] }
    );
    const s = step(before);
    expect(s.course?.medals).toEqual([]);
    expect(s.medalsFound).toEqual([11]);
    expect(s.score - before.score).toBeGreaterThanOrEqual(MEDAL_SCORE);
    expect(s.score - before.score).toBeLessThan(MEDAL_SCORE + 2);
    expect(popupTexts(s)).toContain("MEDAL 1/3");
  });

  it("a medal out of reach stays on the course and is not found", () => {
    const s = step(
      onLane({}, { ...EMPTY_COURSE, medals: [medal(11, PLAYER_X + 300)] })
    );
    expect(s.course?.medals).toHaveLength(1);
    expect(s.medalsFound).toEqual([]);
  });

  it("the popup counts the medals already found on the stage", () => {
    const s = step(
      onLane(
        { medalsFound: [12] },
        { ...EMPTY_COURSE, medals: [medal(13, PLAYER_X + 6)] }
      )
    );
    expect(s.medalsFound).toEqual([12, 13]);
    expect(popupTexts(s)).toContain("MEDAL 2/3");
  });

  it("a medal already found is not booked twice", () => {
    const before = onLane(
      { medalsFound: [11] },
      { ...EMPTY_COURSE, medals: [medal(11, PLAYER_X + 6)] }
    );
    const s = step(before);
    expect(s.medalsFound).toEqual([11]);
    expect(s.score - before.score).toBeLessThan(MEDAL_SCORE);
    expect(popupTexts(s).some((t) => t.startsWith("MEDAL "))).toBe(false);
  });
});

describe("PR Board medals", () => {
  it("a Buff runner rising into a PR Board with a medal finds it, with the board's reward", () => {
    const pr = board(PLAYER_X, GROUND_Y - 72, {
      contents: "medal",
      medalId: 13,
    });
    const before = run(
      {
        power: "buff",
        isGrounded: false,
        playerY: pr.y + BLOCK_SIZE + 1,
        playerVy: -6,
      },
      { ...EMPTY_COURSE, blocks: [pr] }
    );
    const s = step(before);
    expect(s.course?.blocks).toEqual([]);
    expect(s.medalsFound).toEqual([13]);
    expect(s.score - before.score).toBeGreaterThanOrEqual(
      PR_BOARD_SCORE + MEDAL_SCORE
    );
    expect(popupTexts(s)).toEqual(
      expect.arrayContaining(["NEW PR!", "MEDAL 1/3"])
    );
  });

  it("a PR Board without a medal pays only the board", () => {
    const pr = board(PLAYER_X, GROUND_Y - 72);
    const s = step(
      run(
        {
          power: "buff",
          isGrounded: false,
          playerY: pr.y + BLOCK_SIZE + 1,
          playerVy: -6,
        },
        { ...EMPTY_COURSE, blocks: [pr] }
      )
    );
    expect(s.course?.blocks).toEqual([]);
    expect(s.medalsFound).toEqual([]);
    expect(s.score).toBeLessThan(PR_BOARD_SCORE + MEDAL_SCORE);
  });

  it("a Burpee Slam landing on a PR Board with a medal finds it", () => {
    const footX = PLAYER_X + 5;
    const pr = board(footX, GROUND_Y - BLOCK_SIZE, {
      contents: "medal",
      medalId: 12,
    });
    const before = run(
      {
        playerY: pr.y - PLAYER_HEIGHT - 5,
        playerVy: SLAM_VY,
        isGrounded: false,
        slamming: true,
      },
      { ...EMPTY_COURSE, blocks: [pr] }
    );
    const landed = step(before);
    expect(landed.isGrounded).toBe(true);
    expect(landed.course?.blocks).toEqual([]);
    expect(landed.medalsFound).toEqual([12]);
  });

  it("a thrown medicine ball that breaks a PR Board with a medal finds it", () => {
    const pr = board(PLAYER_X + 50, GROUND_Y - 27, {
      contents: "medal",
      medalId: 13,
    });
    const thrown = pressAction(
      onLane(
        { carrying: true, carryingId: 7 },
        { ...EMPTY_COURSE, blocks: [pr] }
      )
    );
    const { state: s, frames } = stepUntil(thrown, (x) => !x.thrownBall, 120);
    expect(s.course?.blocks ?? []).toEqual([]);
    expect(s.medalsFound).toEqual([13]);
    expect(s.score).toBe(PR_BOARD_SCORE + MEDAL_SCORE + frames);
  });
});

describe("bonus room medals and secret exits", () => {
  it("entering a station with an unfound medal puts it over the room's second ledge", () => {
    const door = station({ medalId: 13 });
    const s = enterStation(atDoor(door));
    const cameraX = 15 * PX_PER_METER;
    expect(s.course?.medals).toEqual([
      {
        id: 13,
        stage: medalStage(13),
        x: cameraX + ROOM_MEDAL_DX,
        y: GROUND_Y - 80,
      },
    ]);
    expect(s.course?.poles).toEqual([]);
  });

  it("a room medal already found is not offered again", () => {
    const s = enterStation(
      atDoor(station({ medalId: 13 }), { medalsFound: [13] })
    );
    expect(s.course?.medals ?? []).toEqual([]);
  });

  it("a station with a secret exit ends its room at a secret pole on this stage", () => {
    const s = enterStation(atDoor(station({ secretExit: true }), { stage: 2 }));
    const cameraX = 15 * PX_PER_METER;
    expect(s.course?.poles).toEqual([
      {
        x: cameraX + PLAYER_X + BONUS_ROOM_LENGTH - SECRET_POLE_INSET,
        stage: 2,
        secret: true,
      },
    ]);
  });

  it("touching the room medal inside the room finds it", () => {
    const door = station({ medalId: 13 });
    const room = enterStation(atDoor(door));
    const [medal] = room.course?.medals ?? [];
    const s = step({
      ...room,
      distanceMeters: distanceToStandAt(medal.x),
      playerY: medal.y + 2,
      playerVy: 0,
      isGrounded: false,
    });
    expect(s.course?.medals ?? []).toEqual([]);
    expect(s.medalsFound).toEqual([13]);
    expect(s.bonusRoom).not.toBeNull();
  });

  it("running to a secret pole clears the stage it sits in, records the exit and starts the next stage", () => {
    const door = station({ secretExit: true });
    const room = enterStation(atDoor(door));
    const [pole] = room.course?.poles ?? [];
    const before: GameEngineState = {
      ...room,
      distanceMeters: (pole.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER,
      lives: 2,
    };
    const s = step(before);
    expect(s.stage).toBe(2);
    expect(s.gameState).toBe("playing");
    expect(s.secretExits).toEqual([1]);
    expect(s.bonusRoom).toBeNull();
    expect(s.banner?.text).toBe(SECRET_EXIT_BANNER);
    expect(s.banner?.tone).toBe("good");
    expect(popupTexts(s).some((t) => t.startsWith("LAP 1 · "))).toBe(true);
    expect(s.lapSplits).toHaveLength(1);
    expect(s.score - before.score).toBeGreaterThanOrEqual(STAGE_CLEAR_SCORE);
    expect(s.lives).toBe(2);
    expect(s.distanceMeters).toBe(stageStartX(2) / PX_PER_METER);
    expect(s.playerVy).toBe(0);
    expect(s.isGrounded).toBe(true);
    expect(s.riding).toBe(false);
    expect(s.carrying).toBe(false);
    expect(s.thrownBall).toBeNull();
    // The room's own course is left: the stage's normal pole is discarded, so
    // the stage cannot be cleared twice.
    expect(s.course?.poles.some((p) => p.stage === 1)).toBe(false);
    expect(s.course?.poles.some((p) => p.secret)).toBe(false);
    expect(s.course?.poles.some((p) => p.stage === 2)).toBe(true);
  });

  it("in a race, the lane Kudos a secret exit skips count as missed (#2019)", () => {
    const door = station({ secretExit: true });
    const room = enterStation(
      atDoor(door, {
        race: { course: "saturday5k", category: "allkudos", seed: SEED },
        kudosMissed: 0,
      })
    );
    const [pole] = room.course?.poles ?? [];
    const bonusRoom = room.bonusRoom;
    if (!bonusRoom) throw new Error("expected a bonus room");
    const s = step({
      ...room,
      bonusRoom: {
        ...bonusRoom,
        returnCourse: {
          ...bonusRoom.returnCourse,
          kudos: [
            { id: 1, x: 2000, y: GROUND_Y - 70 },
            { id: 2, x: 3000, y: GROUND_Y - 70 },
          ],
        },
      },
      distanceMeters: (pole.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER,
    });
    expect(s.secretExits).toEqual([1]);
    expect(s.kudosMissed).toBe(2);
  });

  it("a secret pole and the room's far wall in one long frame: the secret exit wins", () => {
    const door = station({ secretExit: true });
    const room = enterStation(atDoor(door));
    const [pole] = room.course?.poles ?? [];
    // A sprint over 600 ms carries the runner past both the pole and the far
    // wall, which would otherwise send it back to the station's exit.
    const long = updateGameSimulation(
      {
        ...room,
        distanceMeters:
          (pole.x - PLAYER_X - PLAYER_WIDTH + 3 - 1) / PX_PER_METER,
        runInput: 1,
      },
      600
    );
    expect(long.stage).toBe(2);
    expect(long.secretExits).toEqual([1]);
    expect(long.distanceMeters).toBe(stageStartX(2) / PX_PER_METER);
    expect(long.bonusRoom).toBeNull();
  });

  it("the next stage does not clear again on the following frames, and the exit is recorded once", () => {
    const door = station({ secretExit: true });
    const room = enterStation(atDoor(door));
    const [pole] = room.course?.poles ?? [];
    const cleared = step({
      ...room,
      distanceMeters: (pole.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER,
      secretExits: [1],
    });
    expect(cleared.secretExits).toEqual([1]);
    const later = step({ ...cleared, foes: [], obstacles: [] }, 60);
    expect(later.stage).toBe(2);
    expect(later.lapSplits).toHaveLength(1);
    expect(later.secretExits).toEqual([1]);
    expect(later.gameState).toBe("playing");
  });

  it("the secret pole's next stage hides the medals already found", () => {
    const door = station({ secretExit: true });
    const room = enterStation(atDoor(door));
    const [pole] = room.course?.poles ?? [];
    const s = step({
      ...room,
      distanceMeters: (pole.x - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER,
      medalsFound: [21],
    });
    expect(s.stage).toBe(2);
    const laidOut = laid(2, SEED);
    expect(s.course?.medals ?? []).toEqual(
      hideFoundMedals(laidOut.course, laidOut.props, [21]).course.medals ?? []
    );
  });

  it("a normal finish pole clears the stage without a secret exit, and pays a MEDALS count", () => {
    const pole = { x: PLAYER_X + 6, stage: 1 };
    const before = onLane(
      { checkpoint: { x: 400, stage: 1 }, medalsFound: [11, 12] },
      { ...EMPTY_COURSE, poles: [pole] }
    );
    const s = step(before);
    expect(s.stage).toBe(2);
    expect(s.secretExits).toEqual([]);
    expect(s.checkpoint).toBeNull();
    expect(s.banner?.text).toMatch(/^LAP 1 · /);
    expect(popupTexts(s)).toContain("MEDALS 2/3");
    expect(s.course?.poles.some((p) => p.stage === 2)).toBe(true);
  });
});

describe("Aid Station checkpoints", () => {
  const checkpoint = { x: 900, stage: 1 };

  it("touching the checkpoint marks it, with its banner and toast", () => {
    const before = run(
      { distanceMeters: (checkpoint.x - PLAYER_X - 2) / PX_PER_METER },
      { ...EMPTY_COURSE, checkpoints: [checkpoint] }
    );
    const s = step(before);
    expect(s.checkpoint).toEqual(checkpoint);
    expect(s.banner?.text).toBe(CHECKPOINT_BANNER);
    expect(s.banner?.tone).toBe("good");
    const toast = (s.popups ?? []).find((p) => p.text === CHECKPOINT_TOAST);
    expect(toast?.x).toBe(checkpoint.x);
  });

  it("a checkpoint still ahead of the runner is not touched", () => {
    const s = step(
      run(
        { distanceMeters: (checkpoint.x - PLAYER_X - 200) / PX_PER_METER },
        { ...EMPTY_COURSE, checkpoints: [checkpoint] }
      )
    );
    expect(s.checkpoint ?? null).toBeNull();
  });

  it("a checkpoint of another stage is not touched", () => {
    const s = step(
      run(
        { distanceMeters: (checkpoint.x - PLAYER_X - 2) / PX_PER_METER },
        { ...EMPTY_COURSE, checkpoints: [{ ...checkpoint, stage: 2 }] }
      )
    );
    expect(s.checkpoint ?? null).toBeNull();
  });

  it("inside a bonus room the checkpoint is not touched", () => {
    const room = enterStation(atDoor(station()));
    const s = step({
      ...room,
      course: { ...room.course!, checkpoints: [checkpoint] },
      distanceMeters: (checkpoint.x - PLAYER_X - 2) / PX_PER_METER,
    });
    expect(s.checkpoint ?? null).toBeNull();
  });

  it("a checkpoint already touched is not toasted again", () => {
    const s = step(
      run(
        {
          checkpoint,
          distanceMeters: (checkpoint.x - PLAYER_X - 2) / PX_PER_METER,
        },
        { ...EMPTY_COURSE, checkpoints: [checkpoint] }
      )
    );
    expect(s.checkpoint).toEqual(checkpoint);
    expect(popupTexts(s)).not.toContain(CHECKPOINT_TOAST);
  });

  it("a life lost after touching the checkpoint restarts the stage there", () => {
    const s = step(
      run({
        checkpoint,
        distanceMeters: 300 / PX_PER_METER,
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.distanceMeters).toBe((checkpoint.x - PLAYER_X) / PX_PER_METER);
    expect(s.checkpoint).toEqual(checkpoint);
    expect(s.banner?.text).toMatch(/LIVES 2$/);
  });

  it("the restart leaves out the foes near the Aid Station and keeps the rest of the fresh stage's", () => {
    // Find a seed whose stage 1 has a foe past the start, and put the
    // checkpoint on it, so the window has a foe to drop.
    const seed = Array.from({ length: 300 }, (_, i) => i + 1).find((sd) =>
      freshFoes(1, sd).some((f) => f.x > 400)
    );
    expect(seed).toBeDefined();
    const fresh = freshFoes(1, seed!);
    const target = fresh.find((f) => f.x > 400)!;
    const cp = { x: target.x + 20, stage: 1 };
    const s = step(
      run({
        courseSeed: seed,
        checkpoint: cp,
        distanceMeters: 10 / PX_PER_METER,
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    const kept = fresh.filter(
      (f) => !(f.x + f.width > cp.x - 40 && f.x < cp.x + 160)
    );
    expect(kept.length).toBeLessThan(fresh.length);
    expect(s.foes?.map((f) => f.id)).toEqual(kept.map((f) => f.id));
  });

  it("a life lost before any Aid Station restarts at the stage start", () => {
    const s = step(
      run({
        stage: 2,
        distanceMeters: 300 / PX_PER_METER,
        obstacles: [bug(PLAYER_X + 4)],
        checkpoint: { x: 900, stage: 1 },
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.distanceMeters).toBe(stageStartX(2) / PX_PER_METER);
  });

  it("a medal already found is not offered again after a lost life, and the found ones stay found", () => {
    const seed = SEED;
    const { course, props } = laid(1, seed);
    const ids = [
      ...course.blocks.flatMap((b) =>
        b.medalId === undefined ? [] : [b.medalId]
      ),
      ...props.stations.flatMap((st) =>
        st.medalId === undefined ? [] : [st.medalId]
      ),
      ...(course.medals ?? []).map((m) => m.id),
    ];
    expect(ids).toHaveLength(3);
    const [found] = ids;
    const s = step(
      run({
        courseSeed: seed,
        medalsFound: [found],
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.medalsFound).toEqual([found]);
    const after = [
      ...(s.course?.blocks ?? []).flatMap((b) =>
        b.medalId === undefined ? [] : [b.medalId]
      ),
      ...(s.props?.stations ?? []).flatMap((st) =>
        st.medalId === undefined ? [] : [st.medalId]
      ),
      ...(s.course?.medals ?? []).map((m) => m.id),
    ];
    expect(after).not.toContain(found);
    expect(after).toHaveLength(2);
    expect(after.every((id) => medalStage(id) === 1)).toBe(true);
  });
});

describe("a new run", () => {
  it("startGame starts with no medals, no Aid Station and no secret exits", () => {
    const old = run({
      medalsFound: [11, 22],
      checkpoint: { x: 900, stage: 1 },
      secretExits: [1],
    });
    const fresh = startGame(old, "fenix");
    expect(fresh.medalsFound).toEqual([]);
    expect(fresh.checkpoint).toBeNull();
    expect(fresh.secretExits).toEqual([]);
  });
});
