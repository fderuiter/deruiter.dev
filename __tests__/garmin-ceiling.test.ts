import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  JUMP_FORCE,
  PLAYER_HEIGHT,
  PLAYER_X,
  createInitialState,
  pressJump,
  setRunInput,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin/course";
import { EMPTY_PROPS } from "@/lib/garmin/props";
import { BUFF_HEIGHT, DAMAGE_GRACE_MS } from "@/lib/garmin/powerups";
import { CEILING_BOTTOM } from "@/lib/garmin/swim";

// Basement Gym racks (#1993): a low bar a jump bonks on, that a tall runner
// takes a hit under.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_750_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A running session on stage 3 with no spawns, on `course`. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0, []), "fenix"),
    stage: 3,
    course,
    props: EMPTY_PROPS,
    foes: [],
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A rack over the runner, from `left` for `width` pixels past the runner's box. */
function rack(left: number, width: number): CourseLayout {
  return {
    ...EMPTY_COURSE,
    ceilings: [{ id: 1, x: PLAYER_X + left, width, bottom: CEILING_BOTTOM }],
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = updateGameSimulation(s, FRAME);
  }
  return s;
}

describe("Basement Gym racks (#1993)", () => {
  it("the rack bottom sits just above a standing Base runner's head", () => {
    expect(CEILING_BOTTOM).toBe(GROUND_Y - 24 - 3);
    expect(CEILING_BOTTOM).toBe(178);
  });

  it("a Base runner's jump bonks off a rack", () => {
    const s = step(
      pressJump(
        run(rack(-20, 100), {
          playerY: GROUND_Y - PLAYER_HEIGHT,
          isGrounded: true,
        })
      )
    );
    expect(s.playerY).toBe(CEILING_BOTTOM);
    expect(s.playerVy).toBe(1);
  });

  it("a Base runner walks under a rack without a bonk or a hit", () => {
    const start = run(rack(40, 60), {
      playerY: GROUND_Y - PLAYER_HEIGHT,
      isGrounded: true,
    });
    let s = setRunInput(start, 1);
    for (let i = 0; i < 60; i++) {
      s = step(s);
      expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
    }
    expect(s.power ?? "base").toBe("base");
    expect(s.lives ?? 1).toBe(start.lives);
    expect(s.distanceMeters).toBeGreaterThan(start.distanceMeters + 5);
  });

  it("a Buff runner standing under a rack takes one hit and drops to Base", () => {
    const s = step(
      run(rack(-10, 100), {
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        isGrounded: true,
        lives: 3,
      })
    );
    expect(s.power).toBe("base");
    expect(s.lives).toBe(3);
    expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
    expect(s.invulnerableMs).toBeGreaterThan(DAMAGE_GRACE_MS - 20);
  });

  it("a tall runner is hit at most once per grace window", () => {
    // A long rack, so the walking runner stays under it for the whole test.
    const under = run(rack(-10, 600), {
      power: "buff",
      playerY: GROUND_Y - BUFF_HEIGHT,
      isGrounded: true,
      invulnerableMs: DAMAGE_GRACE_MS,
    });
    const graced = step(under, 80);
    expect(graced.power).toBe("buff");
    const after = step(graced, 15);
    expect(after.power).toBe("base");
  });
});

describe("Basement Gym stage layout (#1993)", () => {
  it("a stage advance into the gym lays racks on the course", () => {
    const s = step(
      run(
        {
          ...EMPTY_COURSE,
          poles: [{ x: PLAYER_X + 10, stage: 2 }],
        },
        { stage: 2, courseSeed: 4242 }
      )
    );
    expect(s.stage).toBe(3);
    expect(s.course?.ceilings?.length ?? 0).toBeGreaterThan(0);
  });

  it("losing a life on stage 3 restarts it with its racks", () => {
    const start = stageStartX(3) / PX_PER_METER;
    const cameraX = start * PX_PER_METER;
    const fallen = run(
      {
        ...EMPTY_COURSE,
        gaps: [{ x: cameraX + PLAYER_X - 20, width: 300 }],
      },
      {
        stage: 3,
        courseSeed: 4242,
        lives: 2,
        distanceMeters: start,
        playerY: GROUND_Y - PLAYER_HEIGHT,
        isGrounded: true,
      }
    );
    let s = fallen;
    for (let i = 0; i < 120 && s.lives === 2; i++) s = step(s);
    expect(s.lives).toBe(1);
    expect(s.stage).toBe(3);
    expect(s.course?.ceilings?.length ?? 0).toBeGreaterThan(0);
  });

  it("the jump key still jumps on the gym's floor", () => {
    expect(pressJump(run(EMPTY_COURSE)).playerVy).toBe(JUMP_FORCE);
  });
});
