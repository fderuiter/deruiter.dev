import { themeForStage } from "@/lib/garmin-themes";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_X,
  PLAYER_HEIGHT,
  FLASH_STORAGE_KEY,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin-engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  PX_PER_METER,
  generateStage,
  stageStartX,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin-course";
import { generateStageProps } from "@/lib/garmin-props";
import {
  BASE_HEIGHT,
  BUFF_HEIGHT,
  DAMAGE_GRACE_MS,
  HIGH_DEFEAT_SCORE,
  HIGH_MS,
  KUDOS_PER_LIFE,
  MAX_LIVES,
  PICKUP_EMERGE_MS,
  PICKUP_SIZE,
  POWERUP_SCORE,
  START_LIVES,
  addLives,
  blockReward,
  damageTier,
  emergePickup,
  livesEarned,
  playerHeightFor,
  stepPickups,
  type Pickup,
} from "@/lib/garmin-powerups";

// Power tiers, Runner's High and lives in Monkey C Mayhem (#1988).

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
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
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

function block(extra: Partial<CourseBlock> = {}): CourseBlock {
  return {
    id: 7,
    x: 100,
    y: GROUND_Y - 72,
    kind: "sync",
    contents: "power",
    used: false,
    ...extra,
  };
}

/** A pickup resting on the lane right under the runner. */
function pickupAtRunner(kind: Pickup["kind"]): Pickup {
  return {
    id: 1,
    kind,
    x: PLAYER_X + 4,
    y: GROUND_Y - PICKUP_SIZE,
    vx: 0,
    vy: 0,
    emergeMs: 0,
  };
}

describe("power tier rules", () => {
  it("a Buff runner is taller than a Base one", () => {
    expect(playerHeightFor("base")).toBe(BASE_HEIGHT);
    expect(playerHeightFor(undefined)).toBe(BASE_HEIGHT);
    expect(playerHeightFor("buff")).toBe(BUFF_HEIGHT);
    expect(BASE_HEIGHT).toBe(PLAYER_HEIGHT);
  });

  it("a power block gives a Shake at Base and a Heat Map once Buff", () => {
    expect(blockReward("power", "base")).toBe("shake");
    expect(blockReward("power", undefined)).toBe("shake");
    expect(blockReward("power", "buff")).toBe("heatmap");
    expect(blockReward("high", "buff")).toBe("high");
    expect(blockReward("kudos", "base")).toBe("kudos");
  });

  it("a hit drops Buff to Base, and ends a Base runner", () => {
    expect(damageTier("buff")).toEqual({ power: "base", survived: true });
    expect(damageTier("base")).toEqual({ power: "base", survived: false });
    expect(damageTier(undefined).survived).toBe(false);
  });

  it("earns one life per hundred Kudos crossed, up to the cap", () => {
    expect(livesEarned(98, 99)).toBe(0);
    expect(livesEarned(99, 100)).toBe(1);
    expect(livesEarned(199, 301)).toBe(2);
    expect(livesEarned(100, 100)).toBe(0);
    expect(livesEarned(Number.NaN, 200)).toBe(0);
    expect(addLives(3, 1)).toBe(4);
    expect(addLives(undefined, 1)).toBe(2);
    expect(addLives(MAX_LIVES, 5)).toBe(MAX_LIVES);
    expect(addLives(2, -3)).toBe(2);
  });
});

describe("pickups on the course", () => {
  it("rise out of their block before they move", () => {
    const p = emergePickup("shake", block(), 1);
    expect(p.y).toBe(block().y);
    const half = stepPickups(
      [p],
      EMPTY_COURSE,
      GROUND_Y,
      0,
      280,
      PICKUP_EMERGE_MS / 2
    );
    expect(half[0].x).toBe(p.x);
    expect(half[0].y).toBeCloseTo(p.y - PICKUP_SIZE / 2);
    const out = stepPickups(
      half,
      EMPTY_COURSE,
      GROUND_Y,
      0,
      280,
      PICKUP_EMERGE_MS
    );
    expect(out[0].emergeMs).toBe(0);
    expect(out[0].y).toBeCloseTo(block().y - PICKUP_SIZE);
  });

  it("travel forward, fall and settle on the lane", () => {
    let ps: Pickup[] = [
      { id: 1, kind: "shake", x: 100, y: 120, vx: 1.2, vy: 0, emergeMs: 0 },
    ];
    for (let i = 0; i < 120; i++) {
      ps = stepPickups(ps, EMPTY_COURSE, GROUND_Y, 0, 280, FRAME);
    }
    expect(ps[0].x).toBeGreaterThan(100);
    expect(ps[0].y).toBe(GROUND_Y - PICKUP_SIZE);
    expect(ps[0].vy).toBe(0);
  });

  it("drop through gaps and leave the course", () => {
    const course = { ...EMPTY_COURSE, gaps: [{ x: 50, width: 200 }] };
    let ps: Pickup[] = [
      { id: 1, kind: "shake", x: 100, y: 150, vx: 0, vy: 0, emergeMs: 0 },
    ];
    for (let i = 0; i < 120 && ps.length > 0; i++) {
      ps = stepPickups(ps, course, GROUND_Y, 0, 280, FRAME);
    }
    expect(ps).toHaveLength(0);
  });

  it("a Runner's High bounces when it lands", () => {
    const ps = stepPickups(
      [
        {
          id: 1,
          kind: "high",
          x: 100,
          y: GROUND_Y - PICKUP_SIZE - 1,
          vx: 1.6,
          vy: 2,
          emergeMs: 0,
        },
      ],
      EMPTY_COURSE,
      GROUND_Y,
      0,
      280,
      FRAME
    );
    expect(ps[0].vy).toBeLessThan(0);
  });

  it("are dropped once they scroll behind the camera", () => {
    const ps = stepPickups(
      [{ id: 1, kind: "shake", x: 0, y: 100, vx: 0, vy: 0, emergeMs: 0 }],
      EMPTY_COURSE,
      GROUND_Y,
      500,
      280,
      FRAME
    );
    expect(ps).toHaveLength(0);
  });
});

describe("power-ups in a run", () => {
  it("starts a run at Base with three lives", () => {
    const s = startGame(createInitialState("fenix", 0, []), "fenix");
    expect(s.power).toBe("base");
    expect(s.lives).toBe(START_LIVES);
    expect(s.pickups).toEqual([]);
  });

  it("bumping a power block sends a Shake out, and touching it makes the runner Buff", () => {
    const b = block({ x: PLAYER_X });
    const bumped = step(
      run(
        { ...EMPTY_COURSE, blocks: [b] },
        { isGrounded: false, playerY: b.y + BLOCK_SIZE + 1, playerVy: -6 }
      )
    );
    expect(bumped.pickups).toHaveLength(1);
    expect(bumped.pickups?.[0].kind).toBe("shake");
    expect(bumped.course?.blocks[0].used).toBe(true);

    const s = run(EMPTY_COURSE, { pickups: [pickupAtRunner("shake")] });
    const grown = step(s);
    expect(grown.power).toBe("buff");
    expect(grown.pickups).toHaveLength(0);
    expect(grown.score).toBeGreaterThanOrEqual(POWERUP_SCORE);
    // Growing keeps the feet on the lane.
    expect(grown.playerY + BUFF_HEIGHT).toBe(GROUND_Y);
    expect(grown.banner?.text).toMatch(/PROTEIN SHAKE/);
  });

  it("a Buff runner stands and lands with the taller box", () => {
    let s = run(EMPTY_COURSE, {
      power: "buff",
      isGrounded: false,
      playerY: GROUND_Y - BUFF_HEIGHT - 20,
      playerVy: 2,
    });
    s = step(s, 30);
    expect(s.isGrounded).toBe(true);
    expect(s.playerY).toBe(GROUND_Y - BUFF_HEIGHT);
  });

  it("a power block pops a Heat Map, not Kudos, for a Buff runner", () => {
    const b = block({ x: PLAYER_X });
    const bumped = step(
      run(
        { ...EMPTY_COURSE, blocks: [b] },
        {
          power: "buff",
          isGrounded: false,
          playerY: b.y + BLOCK_SIZE + 1,
          playerVy: -6,
        }
      )
    );
    expect(bumped.pickups?.map((p) => p.kind)).toEqual(["heatmap"]);
    expect(bumped.kudos).toBe(0);
  });

  it("a hit while Buff drops to Base with a grace period, not a lost life", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    expect(s.gameState).toBe("playing");
    expect(s.power).toBe("base");
    expect(s.lives).toBe(START_LIVES);
    expect(s.invulnerableMs).toBe(DAMAGE_GRACE_MS);
    expect(s.playerY + BASE_HEIGHT).toBe(GROUND_Y);
    // During the grace the same bug passes through.
    const later = step(s, 5);
    expect(later.gameState).toBe("playing");
    expect(later.lives).toBe(START_LIVES);
  });

  it("a Runner's High defeats what it touches, spikes included, then wears off", () => {
    const s = run(EMPTY_COURSE, { pickups: [pickupAtRunner("high")] });
    const high = step(s);
    expect(high.starMs).toBeGreaterThan(HIGH_MS - 100);
    const scoreBefore = high.score;
    const smashed = step({
      ...high,
      obstacles: [
        bug(PLAYER_X + 2, {
          type: "stack_overflow",
          y: GROUND_Y - 24,
          height: 24,
          width: 18,
        }),
      ],
    });
    expect(smashed.gameState).toBe("playing");
    expect(smashed.obstacles).toHaveLength(0);
    expect(smashed.score - scoreBefore).toBeGreaterThanOrEqual(
      HIGH_DEFEAT_SCORE
    );

    const worn = step({ ...smashed, starMs: FRAME / 2 });
    expect(worn.starMs).toBe(0);
  });
});

describe("lives", () => {
  it("a hit at Base costs a life and restarts the stage", () => {
    const stage = 2;
    const s = step(
      run(EMPTY_COURSE, {
        stage,
        distanceMeters: stageStartX(stage) / PX_PER_METER + 400,
        kudos: 12,
        obstacles: [bug(PLAYER_X + 4)],
      })
    );
    expect(s.gameState).toBe("playing");
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.distanceMeters).toBe(stageStartX(stage) / PX_PER_METER);
    expect(s.obstacles).toHaveLength(0);
    expect(s.kudos).toBe(12);
    expect(s.invulnerableMs).toBe(DAMAGE_GRACE_MS);
    // The stage's course, with any ledge a Treadmill Belt replaces (#1992).
    const fresh = generateStageProps(
      stage,
      s.courseSeed ?? 0,
      GROUND_Y,
      generateStage(stage, s.courseSeed ?? 0, GROUND_Y, themeForStage(stage)),
      themeForStage(stage)
    );
    expect(s.course).toEqual(fresh.layout);
    expect(s.props).toEqual(fresh.props);
    expect(s.banner?.text).toMatch(/NULL POINTER · LIVES 2/);
  });

  it("falling into a gap costs a life", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: PLAYER_X - 30, width: 200 }],
    };
    let s = run(course);
    for (let i = 0; i < 120 && s.lives === START_LIVES; i++) s = step(s);
    expect(s.gameState).toBe("playing");
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.playerY).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it("the last life ends the run with the crash report", () => {
    const s = step(
      run(EMPTY_COURSE, { lives: 1, obstacles: [bug(PLAYER_X + 4)] })
    );
    expect(s.gameState).toBe("crashed");
    expect(s.lives).toBe(0);
    expect(s.crashReport?.errorType).toBe("Null Pointer");
  });

  it("a snapshot from before lives has only the one", () => {
    const s = step(
      run(EMPTY_COURSE, { lives: undefined, obstacles: [bug(PLAYER_X + 4)] })
    );
    expect(s.gameState).toBe("crashed");
  });

  it("the hundredth Kudos is a 1-up", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      kudos: [{ id: 1, x: PLAYER_X + 10, y: GROUND_Y - 12 }],
    };
    const s = step(run(course, { kudos: KUDOS_PER_LIFE - 1 }));
    expect(s.kudos).toBe(KUDOS_PER_LIFE);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.banner?.text).toMatch(/1UP/);
  });

  it("pickups are cleared with the stage at the pole", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 18, stage: 1 }],
    };
    const s = step(
      run(course, {
        pickups: [
          { id: 2, kind: "shake", x: 400, y: 100, vx: 1, vy: 0, emergeMs: 0 },
        ],
      })
    );
    expect(s.stage).toBe(2);
    expect(s.pickups).toEqual([]);
  });
});

describe("stage layout power blocks", () => {
  it("lays out at most two power blocks and one Runner's High a stage", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (let stage = 1; stage <= 5; stage++) {
        const blocks = generateStage(stage, seed, GROUND_Y).blocks;
        const power = blocks.filter((b) => b.contents === "power");
        const high = blocks.filter((b) => b.contents === "high");
        expect(power.length).toBeLessThanOrEqual(2);
        expect(high.length).toBeLessThanOrEqual(1);
        for (const b of [...power, ...high]) expect(b.kind).toBe("sync");
      }
    }
  });

  it("puts at least one power block somewhere in most runs", () => {
    let runsWithPower = 0;
    for (let seed = 0; seed < 40; seed++) {
      const any = [1, 2, 3, 4, 5].some((stage) =>
        generateStage(stage, seed, GROUND_Y).blocks.some(
          (b) => b.contents === "power"
        )
      );
      if (any) runsWithPower++;
    }
    expect(runsWithPower).toBeGreaterThan(30);
  });
});
