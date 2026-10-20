// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FALL_GRAVITY,
  GROUND_Y,
  JUMP_FORCE,
  PLAYER_HEIGHT,
  PLAYER_X,
  createInitialState,
  pressAction,
  pressJump,
  releaseJump,
  startGame,
  updateGameSimulation,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin-course";
import { EMPTY_PROPS } from "@/lib/garmin-props";
import { FULL_PACE_JUMP_FORCE } from "@/lib/garmin-cape";
import {
  BASE_HEIGHT,
  BUFF_HEIGHT,
  DAMAGE_GRACE_MS,
  damageTier,
  playerHeightFor,
  collectTier,
  emergePickup,
  blockReward,
  stepPickups,
  SUIT_FLOAT_Y,
  type Pickup,
} from "@/lib/garmin-powerups";
import {
  SUIT_GRAVITY_SCALE,
  SUIT_LAND_JUMP_VY,
  SUIT_STROKE_MS,
  SUIT_STROKE_VY,
  SUIT_SWIM_PACE,
  SWIM_GRAVITY,
  SWIM_SURFACE_Y,
  SWIM_PACE,
  SWIM_STROKE_MS,
  SWIM_STROKE_VY,
} from "@/lib/garmin-swim";

// The Tri Suit power tier (#1993): swims, sinks slowly, hops lower on land.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 6_500_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A running session with no spawns, on `course`. */
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

function swimmer(
  power: GameEngineState["power"],
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return run(EMPTY_COURSE, {
    stage: 2,
    power,
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

/** Peak height above the lane of a land jump held for `holdFrames`. */
function landPeak(power: GameEngineState["power"], holdFrames: number): number {
  let s = pressJump(run(EMPTY_COURSE, { power }));
  let peak = 0;
  for (let i = 0; i < 90; i++) {
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

describe("Tri Suit swimming (#1993)", () => {
  it("the Tri Suit swims faster than Base", () => {
    const suit = step(swimmer("trisuit"));
    const base = step(swimmer("base"));
    expect(suit.distanceMeters).toBeGreaterThan(base.distanceMeters);
    expect(suit.distanceMeters).toBeCloseTo(0.25 * SUIT_SWIM_PACE, 2);
    expect(base.distanceMeters).toBeCloseTo(0.25 * SWIM_PACE, 2);
  });

  it("the Tri Suit sinks more slowly than Base", () => {
    const start = run(EMPTY_COURSE, { stage: 2, playerY: 100 });
    const suit = step({ ...start, power: "trisuit" }, 5);
    const base = step(start, 5);
    expect(suit.playerVy).toBeLessThan(base.playerVy);
    expect(suit.playerY).toBeLessThan(base.playerY);
    expect(suit.playerVy).toBeCloseTo(SWIM_GRAVITY * SUIT_GRAVITY_SCALE * 5, 2);
  });

  it("the Tri Suit strokes harder and more often", () => {
    const s = pressJump(swimmer("trisuit"));
    expect(s.playerVy).toBe(SUIT_STROKE_VY);
    expect(s.strokeCooldownMs).toBe(SUIT_STROKE_MS);
    expect(SUIT_STROKE_VY).toBeLessThan(SWIM_STROKE_VY);
    expect(SUIT_STROKE_MS).toBeLessThan(SWIM_STROKE_MS);
  });
});

describe("Tri Suit on land (#1993)", () => {
  it("the Tri Suit's land hop peaks lower than a held Base jump", () => {
    const suitPeak = landPeak("trisuit", 60);
    const basePeak = landPeak("base", 60);
    expect(suitPeak).toBeGreaterThan(35);
    expect(suitPeak).toBeLessThan(45);
    expect(basePeak).toBeGreaterThan(80);
    expect(suitPeak).toBeLessThan(basePeak);
  });

  it("the Tri Suit's rise has no float", () => {
    const s = step(pressJump(run(EMPTY_COURSE, { power: "trisuit" })));
    expect(s.playerVy).toBeCloseTo(SUIT_LAND_JUMP_VY + FALL_GRAVITY, 2);
  });

  it("the Tri Suit ignores the full pace meter's jump bonus", () => {
    const suit = pressJump(
      run(EMPTY_COURSE, { power: "trisuit", paceMeter: 1 })
    );
    expect(suit.playerVy).toBe(SUIT_LAND_JUMP_VY);
    const base = pressJump(run(EMPTY_COURSE, { paceMeter: 1 }));
    expect(base.playerVy).toBe(FULL_PACE_JUMP_FORCE);
  });

  it("a buffered jump on landing uses the Tri Suit hop", () => {
    const landing = run(EMPTY_COURSE, {
      power: "trisuit",
      playerY: GROUND_Y - PLAYER_HEIGHT - 1,
      playerVy: 3,
      isGrounded: false,
      jumpBufferMs: 100,
    });
    expect(step(landing).playerVy).toBe(SUIT_LAND_JUMP_VY);
    const baseLanding = { ...landing, power: "base" as const };
    expect(step(baseLanding).playerVy).toBe(JUMP_FORCE);
  });

  it("the Tri Suit's action key does nothing", () => {
    const s = run(EMPTY_COURSE, { power: "trisuit" });
    expect(pressAction(s)).toBe(s);
  });
});

describe("Tri Suit pickups, tiers and damage (#1993)", () => {
  const block: CourseBlock = {
    id: 3,
    x: 120,
    y: 150,
    kind: "sync",
    contents: "suit",
    used: false,
  };

  it("a suit block gives the suit", () => {
    expect(blockReward("suit", "base")).toBe("suit");
    expect(blockReward("suit", "buff")).toBe("suit");
    expect(blockReward("suit", "heatmap")).toBe("suit");
  });

  it("a suit pickup makes a Base or Buff runner a Tri Suit runner", () => {
    expect(collectTier("base", "suit")).toBe("trisuit");
    expect(collectTier("buff", "suit")).toBe("trisuit");
    expect(collectTier(undefined, "suit")).toBe("trisuit");
  });

  it("a suit pickup leaves a Heat Map or Cape runner as it is", () => {
    expect(collectTier("heatmap", "suit")).toBe("heatmap");
    expect(collectTier("cape", "suit")).toBe("cape");
    expect(collectTier("trisuit", "suit")).toBe("trisuit");
  });

  it("a suit pickup stays on its block, like a cape", () => {
    expect(emergePickup("suit", block, 9).vx).toBe(0);
  });

  it("the Tri Suit is Base height", () => {
    expect(playerHeightFor("trisuit")).toBe(BASE_HEIGHT);
    expect(playerHeightFor("buff")).toBe(BUFF_HEIGHT);
  });

  it("a hit drops the Tri Suit to Base and it survives", () => {
    expect(damageTier("trisuit")).toEqual({ power: "base", survived: true });
  });

  it("collecting the suit in play gives a Tri Suit runner and a banner", () => {
    const s = step(
      run(EMPTY_COURSE, {
        stage: 2,
        playerY: GROUND_Y - PLAYER_HEIGHT,
        isGrounded: true,
        pickups: [
          {
            id: 1,
            kind: "suit",
            x: PLAYER_X + 2,
            y: GROUND_Y - PLAYER_HEIGHT,
            vx: 0,
            vy: 0,
            emergeMs: 0,
          },
        ],
      })
    );
    expect(s.power).toBe("trisuit");
    expect(s.banner?.text).toBe("TRI SUIT · SWIM");
  });

  it("a hit on the Tri Suit drops it to Base without costing a life", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "trisuit",
        lives: 3,
        obstacles: [bug(PLAYER_X + 2)],
      })
    );
    expect(s.power).toBe("base");
    expect(s.lives).toBe(3);
    expect(s.invulnerableMs).toBeGreaterThan(DAMAGE_GRACE_MS - 20);
  });
});

describe("Tri Suit transition (#1993)", () => {
  /** A suited runner standing just short of stage `stage`'s finish pole. */
  function suitedAtPole(stage: number): GameEngineState {
    const poleX = stage * 10000 - 60;
    return run(
      { ...EMPTY_COURSE, poles: [{ x: poleX, stage }] },
      {
        stage,
        power: "trisuit",
        distanceMeters: (poleX - PLAYER_X) / PX_PER_METER,
        isGrounded: true,
        playerY: GROUND_Y - PLAYER_HEIGHT,
      }
    );
  }

  it("comes off when the next stage is on land", () => {
    expect(updateGameSimulation(suitedAtPole(4), 16).power).toBe("base");
    expect(updateGameSimulation(suitedAtPole(2), 16).power).toBe("base");
  });

  it("stays on into the next water stage", () => {
    const s = updateGameSimulation(suitedAtPole(3), 16);
    expect(s.stage).toBe(4);
    expect(s.power).toBe("trisuit");
  });
});

describe("Tri Suit pickup (#1993)", () => {
  it("floats up to the swim surface and waits there", () => {
    expect(SUIT_FLOAT_Y).toBe(SWIM_SURFACE_Y);
    let pickups: Pickup[] = [
      { id: 1, kind: "suit", x: 400, y: 150, vx: 0, vy: 0, emergeMs: 0 },
    ];
    for (let i = 0; i < 200; i++) {
      pickups = stepPickups(pickups, EMPTY_COURSE, GROUND_Y, 0, 240, 16.666);
    }
    expect(pickups).toHaveLength(1);
    expect(pickups[0].y).toBe(SWIM_SURFACE_Y);
    expect(pickups[0].x).toBe(400);
  });
});
