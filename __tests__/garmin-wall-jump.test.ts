// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  createInitialState,
  pressJump,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { EMPTY_COURSE, type CourseLayout } from "@/lib/garmin-course";
import {
  EMPTY_PROPS,
  type CourseProps,
  type CourseStation,
} from "@/lib/garmin-props";
import {
  MOVE_TOASTS,
  SLAM_VY,
  WALL_JUMP_VY,
  WALL_SLIDE_MAX_VY,
} from "@/lib/garmin-moves";

// The Wall Jump (#2023): a runner falling against a station's side slides
// down slowly and can jump off it once per wall contact.

const FRAME = 1000 / 60;
let clock = 0;

/**
 * A Water Station whose left side is where a runner at camera 0 has its right
 * edge. Tall, so the runner stays beside it through a jump's first frame.
 */
const STATION: CourseStation = {
  id: 1,
  x: 69,
  width: 30,
  height: 80,
  enterable: true,
  exitX: 400,
};

const WITH_STATION: CourseProps = { ...EMPTY_PROPS, stations: [STATION] };

beforeEach(() => {
  clock = 6_500_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run on stage 1 with no spawns, on `course`, with `props`. */
function run(
  overrides: Partial<GameEngineState> = {},
  props: CourseProps = WITH_STATION,
  course: CourseLayout = EMPTY_COURSE
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

/** A runner falling beside the station, its feet below the station's top. */
function fallingBeside(
  overrides: Partial<GameEngineState> = {},
  props: CourseProps = WITH_STATION
): GameEngineState {
  return run(
    {
      playerY: 160,
      playerVy: 8,
      isGrounded: false,
      ...overrides,
    },
    props
  );
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = updateGameSimulation(s, FRAME);
  }
  return s;
}

/** Popups with the text of `text`. */
function toasts(state: GameEngineState, text: string): number {
  return (state.popups ?? []).filter((p) => p.text === text).length;
}

describe("Wall Jump: sliding down a wall", () => {
  it("a runner falling against a station side is on the wall and slides slowly", () => {
    const sliding = step(fallingBeside());
    expect(sliding.wallSide).toBe(true);
    expect(sliding.playerVy).toBeLessThanOrEqual(WALL_SLIDE_MAX_VY);
  });

  it("a runner falling in open air is not on a wall and falls at full speed", () => {
    const open = step(fallingBeside({}, EMPTY_PROPS));
    expect(open.wallSide).toBe(false);
    expect(open.playerVy).toBeGreaterThan(WALL_SLIDE_MAX_VY);
  });

  it("a runner on the ground beside a station is not on a wall", () => {
    const grounded = step(
      run({ playerY: GROUND_Y - PLAYER_HEIGHT, playerVy: 0, isGrounded: true })
    );
    expect(grounded.wallSide).toBe(false);
  });
});

describe("Wall Jump: the jump", () => {
  it("a press on the wall sets the wall jump's lift once", () => {
    const onWall = step(fallingBeside());
    const jumped = pressJump(onWall);
    expect(jumped.playerVy).toBe(WALL_JUMP_VY);
    expect(jumped.wallJumpReady).toBe(false);
    expect(jumped.movesUsed).toEqual(["wall"]);
  });

  it("a second press without leaving the wall does nothing extra", () => {
    const jumped = pressJump(step(fallingBeside()));
    const again = pressJump(jumped);
    expect(again.playerVy).toBe(jumped.playerVy);
    expect(again.movesUsed).toEqual(["wall"]);
    expect(toasts(again, MOVE_TOASTS.wall)).toBe(1);
  });

  it("a second press after a frame on the wall still does not wall jump", () => {
    const jumped = pressJump(step(fallingBeside()));
    const rising = step(jumped);
    expect(rising.wallSide).toBe(true);
    const again = pressJump(rising);
    expect(again.playerVy).toBe(rising.playerVy);
  });

  it("is not a wall jump while rising: the wall can't extend a jump", () => {
    const rising = run({
      playerY: 160,
      playerVy: -4,
      isGrounded: false,
      wallSide: true,
      wallJumpReady: true,
    });
    const pressed = pressJump(rising);
    expect(pressed.playerVy).not.toBe(WALL_JUMP_VY);
    expect(pressed.movesUsed ?? []).not.toContain("wall");
  });

  it("a Burpee Slam beside a wall is not slowed by it", () => {
    const slamming = step(
      fallingBeside({ slamming: true, playerVy: SLAM_VY, playerY: 120 })
    );
    expect(slamming.playerVy).toBe(SLAM_VY);
  });

  it("is not a wall jump on the ground: the ordinary jump applies", () => {
    const grounded = run({
      playerY: GROUND_Y - PLAYER_HEIGHT,
      playerVy: 0,
      isGrounded: true,
      wallSide: true,
      wallJumpReady: true,
    });
    const pressed = pressJump(grounded);
    expect(pressed.playerVy).not.toBe(WALL_JUMP_VY);
    expect(pressed.movesUsed ?? []).not.toContain("wall");
  });

  it("works in Dev Mode too", () => {
    const dev = { ...fallingBeside(), rules: "dev" as const };
    const jumped = pressJump(step(dev));
    expect(jumped.playerVy).toBe(WALL_JUMP_VY);
  });
});

describe("Wall Jump: re-arming", () => {
  it("is re-armed after landing: a fresh wall contact jumps again", () => {
    const jumped = pressJump(step(fallingBeside()));
    // Land on the lane, then fall back against the wall.
    let landed = jumped;
    for (let i = 0; i < 120 && !landed.isGrounded; i++) {
      landed = step(landed);
    }
    expect(landed.isGrounded).toBe(true);
    expect(landed.wallJumpReady).toBe(false);
    const back = step(
      fallingBeside({ isGrounded: false, playerY: 160, playerVy: 8 })
    );
    expect(back.wallJumpReady).toBe(true);
    expect(pressJump(back).playerVy).toBe(WALL_JUMP_VY);
  });

  it("is re-armed after leaving the wall: contact again jumps again", () => {
    const jumped = pressJump(step(fallingBeside()));
    // Away from the station, the contact ends and the jump is not ready.
    const away = step({ ...jumped, playerY: 40, playerVy: 0 }, 2);
    const awayProps = { ...away, props: EMPTY_PROPS };
    expect(step(awayProps).wallSide).toBe(false);
    const back = step(fallingBeside({}, WITH_STATION));
    expect(back.wallJumpReady).toBe(true);
    expect(pressJump(back).playerVy).toBe(WALL_JUMP_VY);
  });
});

describe("Wall Jump: toast", () => {
  it("pushes WALL JUMP! once per run, across separate wall contacts", () => {
    const first = pressJump(step(fallingBeside()));
    expect(toasts(first, MOVE_TOASTS.wall)).toBe(1);

    // A second contact, after the runner has left the wall once.
    const away = step({
      ...first,
      props: EMPTY_PROPS,
      playerY: 40,
      playerVy: 0,
    });
    // Back at the station's side: the drift away moved the runner, so reset it.
    const back = step({
      ...away,
      props: WITH_STATION,
      distanceMeters: 0,
      playerY: 160,
      playerVy: 8,
      isGrounded: false,
    });
    const second = pressJump(back);
    expect(second.playerVy).toBe(WALL_JUMP_VY);
    expect(second.movesUsed).toEqual(["wall"]);
    expect(toasts(second, MOVE_TOASTS.wall)).toBe(1);
  });
});
