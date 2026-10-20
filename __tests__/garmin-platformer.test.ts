import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
  pressJump,
  releaseJump,
  setRunInput,
  paceFor,
  GROUND_Y,
  PLAYER_X,
  PLAYER_HEIGHT,
  COYOTE_MS,
  JUMP_FORCE,
  STOMP_SCORE,
  KUDOS_SCORE,
  STAGE_CLEAR_SCORE,
  FLASH_STORAGE_KEY,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin/engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  STAGE_COUNT,
  STAGE_LENGTH_METERS,
  generateStage,
  isFootingOverGap,
  poleBonus,
  stagePoleX,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin/course";

// The platformer layer of Monkey C Mayhem (#1950).

const FRAME = 1000 / 60;
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

/** A running Fēnix session with no spawns, no allocations and `course`. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0, []), "fenix"),
    course,
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = updateGameSimulation(s, FRAME);
  }
  return s;
}

/** Peak height above the lane reached by a jump released after `holdFrames`. */
function jumpPeak(holdFrames: number): number {
  let s = pressJump(run());
  let peak = 0;
  for (let i = 0; i < 80; i++) {
    if (i === holdFrames) s = releaseJump(s);
    s = step(s);
    peak = Math.max(peak, GROUND_Y - (s.playerY + PLAYER_HEIGHT));
    if (s.isGrounded && i > 2) break;
  }
  return peak;
}

function bug(x: number, overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    id: 1,
    x,
    y: GROUND_Y - 20,
    width: 16,
    height: 20,
    type: "null_pointer",
    label: "NULL",
    speed: 0,
    ...overrides,
  };
}

describe("Garmin platformer jump feel (#1950)", () => {
  it("a held jump goes much higher than a tap", () => {
    const tap = jumpPeak(1);
    const hold = jumpPeak(60);
    expect(hold).toBeGreaterThan(80);
    expect(tap).toBeLessThan(40);
    expect(hold).toBeGreaterThan(tap * 2);
  });

  it("still jumps just after running off an edge (coyote time)", () => {
    const airborne = run(EMPTY_COURSE, {
      isGrounded: false,
      playerVy: 1,
      coyoteMs: COYOTE_MS / 2,
    });
    expect(pressJump(airborne).playerVy).toBe(JUMP_FORCE);

    const late = { ...airborne, coyoteMs: COYOTE_MS + 1 };
    expect(pressJump(late).playerVy).toBe(1);
  });

  it("remembers a press just before landing and jumps on touchdown", () => {
    const falling = run(EMPTY_COURSE, {
      isGrounded: false,
      coyoteMs: 999,
      playerY: GROUND_Y - PLAYER_HEIGHT - 4,
      playerVy: 6,
    });
    const buffered = pressJump(falling);
    expect(buffered.playerVy).toBe(6);
    const landed = step(buffered);
    expect(landed.playerVy).toBe(JUMP_FORCE);
    expect(landed.isGrounded).toBe(false);
  });

  it("sprinting covers more ground than braking", () => {
    expect(paceFor(1)).toBeGreaterThan(paceFor(0));
    expect(paceFor(-1)).toBeLessThan(paceFor(0));
    const sprint = step(setRunInput(run(), 1), 60).distanceMeters;
    const brake = step(setRunInput(run(), -1), 60).distanceMeters;
    expect(sprint).toBeGreaterThan(brake * 2);
  });
});

describe("Garmin stomps and hits (#1950)", () => {
  it("landing on a bug squashes it, scores and bounces", () => {
    const above = run(EMPTY_COURSE, {
      isGrounded: false,
      playerY: GROUND_Y - 20 - PLAYER_HEIGHT,
      playerVy: 6,
      obstacles: [bug(PLAYER_X)],
    });
    const next = step(above);
    expect(next.gameState).toBe("playing");
    expect(next.obstacles).toHaveLength(0);
    expect(next.playerVy).toBeLessThan(0);
    expect(next.score).toBeGreaterThanOrEqual(above.score + STOMP_SCORE);
  });

  it("chained stomps double the points", () => {
    const first = step(
      run(EMPTY_COURSE, {
        isGrounded: false,
        playerY: GROUND_Y - 20 - PLAYER_HEIGHT,
        playerVy: 6,
        obstacles: [bug(PLAYER_X)],
      })
    );
    expect(first.stompChain).toBe(1);
    const second = step({
      ...first,
      playerVy: 6,
      playerY: GROUND_Y - 20 - PLAYER_HEIGHT,
      obstacles: [bug(PLAYER_X, { id: 2 })],
    });
    expect(second.stompChain).toBe(2);
    expect(second.score - first.score).toBeGreaterThanOrEqual(STOMP_SCORE * 2);
  });

  it("a spiked stack overflow can't be stomped", () => {
    const next = step(
      run(EMPTY_COURSE, {
        lives: 1,
        isGrounded: false,
        playerY: GROUND_Y - 24 - PLAYER_HEIGHT,
        playerVy: 6,
        obstacles: [
          bug(PLAYER_X, {
            type: "stack_overflow",
            y: GROUND_Y - 24,
            height: 24,
            width: 18,
          }),
        ],
      })
    );
    expect(next.gameState).toBe("crashed");
    expect(next.crashReport?.errorType).toBe("Stack Overflow");
  });

  it("running into a bug on the last life crashes the run", () => {
    const bare = step(
      run(EMPTY_COURSE, { lives: 1, obstacles: [bug(PLAYER_X + 4)] })
    );
    expect(bare.gameState).toBe("crashed");
    expect(bare.crashReport?.errorType).toBe("Null Pointer");
  });
});

describe("Garmin course (#1950)", () => {
  it("falling into a gap ends the run as a segfault", () => {
    const cameraAtStart = 0;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: cameraAtStart + PLAYER_X - 30, width: 200 }],
    };
    let s = run(course, { lives: 1 });
    for (let i = 0; i < 120 && s.gameState === "playing"; i++) s = step(s);
    expect(s.gameState).toBe("crashed");
    expect(s.crashReport?.errorType).toBe("Segmentation Fault");
  });

  it("a foot still on the edge keeps the runner up", () => {
    const course = { ...EMPTY_COURSE, gaps: [{ x: 100, width: 40 }] };
    expect(isFootingOverGap(course, 95, 105)).toBe(false);
    expect(isFootingOverGap(course, 105, 115)).toBe(true);
  });

  it("bumping a Sync Block from below pays out once", () => {
    const blockY = GROUND_Y - 72;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: PLAYER_X,
          y: blockY,
          kind: "sync",
          contents: "kudos",
          used: false,
        },
      ],
    };
    // Head just under the block, rising.
    const rising = run(course, {
      isGrounded: false,
      playerY: blockY + 14 + 1,
      playerVy: -6,
    });
    const bumped = step(rising);
    expect(bumped.kudos).toBe(1);
    expect(bumped.course?.blocks[0].used).toBe(true);
    expect(bumped.playerVy).toBeGreaterThan(0);

    const again = step({ ...bumped, playerY: blockY + 15, playerVy: -6 });
    expect(again.kudos).toBe(1);
  });

  it("a power block pops a Protein Shake for a Base runner", () => {
    const blockY = GROUND_Y - 72;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: PLAYER_X,
          y: blockY,
          kind: "sync",
          contents: "power",
          used: false,
        },
      ],
    };
    const bumped = step(
      run(course, { isGrounded: false, playerY: blockY + 15, playerVy: -6 })
    );
    expect(bumped.pickups).toHaveLength(1);
    expect(bumped.pickups?.[0].kind).toBe("shake");
  });

  it("lands on a ledge from above", () => {
    const ledgeY = GROUND_Y - 40;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      ledges: [{ x: PLAYER_X - 20, y: ledgeY, width: 80 }],
    };
    let s = run(course, {
      isGrounded: false,
      playerY: ledgeY - PLAYER_HEIGHT - 10,
      playerVy: 2,
    });
    for (let i = 0; i < 20; i++) s = step(s);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY).toBe(ledgeY - PLAYER_HEIGHT);
  });

  it("collects Kudos on touch", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      kudos: [{ id: 1, x: PLAYER_X + 10, y: GROUND_Y - 12 }],
    };
    const s = step(run(course));
    expect(s.kudos).toBe(1);
    expect(s.course?.kudos).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(KUDOS_SCORE);
  });

  it("grabbing a pole clears the stage and lays out the next", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 18, stage: 1 }],
    };
    const s = step(run(course));
    expect(s.stage).toBe(2);
    expect(s.score).toBeGreaterThanOrEqual(STAGE_CLEAR_SCORE + poleBonus(0));
    expect(s.course?.poles.some((p) => p.stage === 2)).toBe(true);
    // The stage clear is an auto lap (#2018).
    expect(s.banner?.text).toMatch(/^LAP 1 · /);
  });

  it("grabbing the last stage's pole completes the run", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 18, stage: STAGE_COUNT }],
    };
    const s = step(run(course, { stage: STAGE_COUNT }));
    expect(s.gameState).toBe("summary");
  });

  it("pays more for a higher grab", () => {
    expect(poleBonus(1)).toBeGreaterThan(poleBonus(0.5));
    expect(poleBonus(0.5)).toBeGreaterThan(poleBonus(0));
    expect(poleBonus(Number.NaN)).toBe(poleBonus(0));
  });

  it("lays out the same stage for the same seed, with a flat opening", () => {
    const a = generateStage(3, 42, GROUND_Y);
    const b = generateStage(3, 42, GROUND_Y);
    expect(a).toEqual(b);
    const start = stageStartX(3);
    for (const gap of a.gaps) {
      expect(gap.x).toBeGreaterThanOrEqual(start + 450);
      expect(gap.x + gap.width).toBeLessThan(stagePoleX(3) - 300);
    }
    expect(a.poles).toEqual([{ x: stagePoleX(3), stage: 3 }]);
    expect(stagePoleX(1)).toBeLessThan(STAGE_LENGTH_METERS * PX_PER_METER);
  });

  it("starts a run on stage 1 with its course laid out", () => {
    const s = startGame(createInitialState("fenix", 0, []), "fenix");
    expect(s.stage).toBe(1);
    expect(s.course?.poles[0].stage).toBe(1);
  });
});

describe("Garmin spawn grace (#1945)", () => {
  it("puts nothing on the lane in the first frames of a run", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let s = startGame(createInitialState("fenix", 0, []), "fenix");
    for (let i = 0; i < 60; i++) {
      clock += FRAME;
      s = updateGameSimulation(s, FRAME);
    }
    expect(s.obstacles).toHaveLength(0);
  });
});
