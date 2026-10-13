import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  pressJump,
  releaseJump,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  JUMP_FORCE,
  PLAYER_HEIGHT,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { EMPTY_COURSE, type CourseLayout } from "@/lib/garmin-course";
import { EMPTY_PROPS } from "@/lib/garmin-props";
import {
  SWIM_GRAVITY,
  SWIM_PACE,
  WADE_PACE_SCALE,
  SWIM_SINK_MAX,
  SWIM_STROKE_MS,
  SWIM_STROKE_VY,
  SWIM_SURFACE_Y,
  isUnderwater,
} from "@/lib/garmin-swim";

// Swimming on the pool and open water stages (#1993).

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A running session on `stage` with no spawns and `course`. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0, []), "fenix"),
    course,
    props: EMPTY_PROPS,
    foes: [],
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A swimmer in mid-water on the pool (stage 2). */
function swimmer(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return run(EMPTY_COURSE, {
    stage: 2,
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

describe("swimming rules (#1993)", () => {
  it("only the pool and open water stages are underwater, outside a bonus room", () => {
    expect(isUnderwater({ stage: 1 })).toBe(false);
    expect(isUnderwater({ stage: 2 })).toBe(true);
    expect(isUnderwater({ stage: 3 })).toBe(false);
    expect(isUnderwater({ stage: 4 })).toBe(true);
    expect(isUnderwater({ stage: 5 })).toBe(false);
    expect(isUnderwater({})).toBe(false);
    expect(isUnderwater({ stage: 2, bonusRoom: {} })).toBe(false);
  });

  it("a jump press in the water is a stroke that sets the stroke speed", () => {
    const s = pressJump(swimmer());
    expect(s.playerVy).toBe(SWIM_STROKE_VY);
    expect(s.strokeCooldownMs).toBe(SWIM_STROKE_MS);
    expect(s.isGrounded).toBe(false);
  });

  it("a second press inside the stroke cooldown does not stroke again", () => {
    const after = step(pressJump(swimmer()));
    const pressed = pressJump(after);
    expect(pressed.playerVy).toBe(after.playerVy);
    expect(pressed.playerVy).not.toBe(SWIM_STROKE_VY);
  });

  it("the next stroke comes once the cooldown has run out", () => {
    const waited = step(pressJump(swimmer()), 11);
    expect(waited.strokeCooldownMs).toBe(0);
    expect(pressJump(waited).playerVy).toBe(SWIM_STROKE_VY);
  });

  it("a stroke leaves no jump buffer or coyote time behind", () => {
    const pressed = pressJump(
      swimmer({ isGrounded: false, playerY: 150, strokeCooldownMs: 100 })
    );
    expect(pressed.jumpBufferMs ?? 0).toBe(0);
    expect(pressed.coyoteMs ?? 0).toBe(0);
  });

  it("the sink speed is capped at the swimmer's fall limit", () => {
    const sinking = step(run(EMPTY_COURSE, { stage: 2, playerY: 100 }), 30);
    expect(sinking.playerVy).toBe(SWIM_SINK_MAX);
    expect(sinking.playerY).toBeLessThan(GROUND_Y - PLAYER_HEIGHT);
  });

  it("the surface holds the swimmer's head at the surface line", () => {
    const rising = run(EMPTY_COURSE, {
      stage: 2,
      playerY: SWIM_SURFACE_Y + 2,
      playerVy: -5,
      isGrounded: false,
    });
    const s = step(rising);
    expect(s.playerY).toBe(SWIM_SURFACE_Y);
    expect(s.playerVy).toBeGreaterThanOrEqual(0);
  });

  it("letting go of jump does not clip a stroke", () => {
    expect(releaseJump(pressJump(swimmer())).playerVy).toBe(SWIM_STROKE_VY);
  });

  it("the track and the gym keep the land jump and stroke nothing", () => {
    for (const stage of [1, 3, 5]) {
      const s = pressJump(run(EMPTY_COURSE, { stage }));
      expect(s.playerVy).toBe(JUMP_FORCE);
      expect(s.strokeCooldownMs ?? 0).toBe(0);
    }
  });

  it("a bonus room inside a pool is not underwater", () => {
    const room = swimmer({
      bonusRoom: {
        returnCourse: EMPTY_COURSE,
        returnProps: EMPTY_PROPS,
        returnFoes: [],
        returnPickups: [],
        exitX: 0,
        endX: 1e9,
      },
    });
    expect(pressJump(room).playerVy).toBe(JUMP_FORCE);
  });

  it("swimming progress is stroke-paced", () => {
    const s = step(swimmer());
    expect(s.distanceMeters).toBeCloseTo(0.25 * SWIM_PACE, 2);
  });

  it("wading along the bottom is slower than swimming", () => {
    const wading = step(
      swimmer({ playerY: GROUND_Y - PLAYER_HEIGHT, isGrounded: true })
    );
    expect(wading.distanceMeters).toBeCloseTo(
      0.25 * SWIM_PACE * WADE_PACE_SCALE,
      2
    );
  });

  it("an Open Water current pushes the swimmer forward", () => {
    const flowing = step(
      swimmer({
        course: {
          ...EMPTY_COURSE,
          currents: [{ id: 1, x: PLAYER_X - 10, width: 200, flow: 0.5 }],
        },
      })
    );
    expect(flowing.distanceMeters).toBeGreaterThan(0.5);
  });

  it("a current against the swimmer slows it", () => {
    const against = step(
      swimmer({
        course: {
          ...EMPTY_COURSE,
          currents: [{ id: 1, x: PLAYER_X - 10, width: 200, flow: -0.05 }],
        },
      })
    );
    expect(against.distanceMeters).toBeGreaterThan(0);
    expect(against.distanceMeters).toBeLessThan(0.25 * SWIM_PACE);
  });

  it("a strong current against the swimmer never runs its progress backwards", () => {
    const against = step(
      swimmer({
        course: {
          ...EMPTY_COURSE,
          currents: [{ id: 1, x: PLAYER_X - 10, width: 200, flow: -1 }],
        },
      }),
      10
    );
    expect(against.distanceMeters).toBe(0);
  });

  it("a current the runner is not in does nothing", () => {
    const far = step(
      swimmer({
        course: {
          ...EMPTY_COURSE,
          currents: [{ id: 1, x: 5000, width: 200, flow: 0.5 }],
        },
      })
    );
    expect(far.distanceMeters).toBeCloseTo(0.25 * SWIM_PACE, 2);
  });

  it("gravity while swimming is the swim gravity", () => {
    const s = step(run(EMPTY_COURSE, { stage: 2, playerY: 100 }), 2);
    expect(s.playerVy).toBeCloseTo(SWIM_GRAVITY * 2, 2);
  });
});
