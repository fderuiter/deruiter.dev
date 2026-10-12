import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  createInitialState,
  startGame,
  throwBolt,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_X,
  PLAYER_WIDTH,
  FLASH_STORAGE_KEY,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin-engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  type CourseLayout,
} from "@/lib/garmin-course";
import {
  BASE_HEIGHT,
  BOLT_BOUNCE_VY,
  BOLT_COOLDOWN_MS,
  BOLT_DEFEAT_SCORE,
  BOLT_SIZE,
  BOLT_SPEED,
  BUFF_HEIGHT,
  DAMAGE_GRACE_MS,
  MAX_BOLTS,
  PICKUP_SIZE,
  POWERUP_SCORE,
  START_LIVES,
  blockReward,
  canThrowBolt,
  collectTier,
  damageTier,
  emergePickup,
  playerHeightFor,
  spawnBolt,
  stepBolts,
  type Bolt,
  type Pickup,
} from "@/lib/garmin-powerups";

import { GAME_MANUALS } from "@/lib/game-manuals";

// The Heat Map tier and heat bolts in Monkey C Mayhem (#1989).

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

/** A Heat Map runner standing on the lane. */
function heatRun(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return run(course, {
    power: "heatmap",
    playerY: GROUND_Y - BUFF_HEIGHT,
    ...overrides,
  });
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
  return s;
}

function enemy(x: number, extra: Partial<Obstacle> = {}): Obstacle {
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

function bolt(extra: Partial<Bolt> = {}): Bolt {
  return {
    id: 1,
    x: 100,
    y: GROUND_Y - BOLT_SIZE,
    vx: BOLT_SPEED,
    vy: 0,
    ...extra,
  };
}

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

/** Steps bolts one frame on an otherwise empty course. */
function stepOne(bolts: Bolt[], course: CourseLayout = EMPTY_COURSE) {
  return stepBolts(bolts, course, GROUND_Y, 0, CANVAS_SIZE, FRAME);
}

describe("Heat Map tier rules", () => {
  it("is as tall as Buff and drops straight to Base on a hit", () => {
    expect(playerHeightFor("heatmap")).toBe(BUFF_HEIGHT);
    expect(damageTier("heatmap")).toEqual({ power: "base", survived: true });
  });

  it("a power block gives a Heat Map to a Buff or Heat Map runner", () => {
    expect(blockReward("power", "buff")).toBe("heatmap");
    expect(blockReward("power", "heatmap")).toBe("heatmap");
    expect(blockReward("power", "base")).toBe("shake");
    expect(blockReward("high", "heatmap")).toBe("high");
  });

  it("collecting a pickup only ever raises the tier", () => {
    expect(collectTier("base", "heatmap")).toBe("heatmap");
    expect(collectTier("buff", "heatmap")).toBe("heatmap");
    expect(collectTier("base", "shake")).toBe("buff");
    expect(collectTier("heatmap", "shake")).toBe("heatmap");
    expect(collectTier(undefined, "shake")).toBe("buff");
    expect(collectTier("buff", "high")).toBe("buff");
  });

  it("a Heat Map stays on its block instead of running off", () => {
    const p = emergePickup(
      "heatmap",
      {
        id: 3,
        x: 100,
        y: 120,
        kind: "sync",
        contents: "power",
        used: true,
      },
      3
    );
    expect(p.vx).toBe(0);
    expect(p.kind).toBe("heatmap");
  });
});

describe("throwing cadence", () => {
  it("needs the Heat Map tier, a spent cooldown and a free slot", () => {
    expect(canThrowBolt("heatmap", [], 0)).toBe(true);
    expect(canThrowBolt("heatmap", undefined, undefined)).toBe(true);
    expect(canThrowBolt("buff", [], 0)).toBe(false);
    expect(canThrowBolt("base", [], 0)).toBe(false);
    expect(canThrowBolt("heatmap", [], 10)).toBe(false);
    expect(canThrowBolt("heatmap", [bolt(), bolt({ id: 2 })], 0)).toBe(false);
    expect(MAX_BOLTS).toBe(2);
  });

  it("throws from the runner's front edge at hand height", () => {
    const s = throwBolt(heatRun());
    expect(s.bolts).toHaveLength(1);
    const b = s.bolts![0];
    expect(b.x).toBe(s.distanceMeters * 10 + PLAYER_X + PLAYER_WIDTH);
    expect(b.y).toBe(GROUND_Y - BUFF_HEIGHT / 2 - BOLT_SIZE / 2);
    expect(b.vx).toBe(BOLT_SPEED);
    expect(s.boltCooldownMs).toBe(BOLT_COOLDOWN_MS);
    expect(s.boltsThrown).toBe(1);
  });

  it("does nothing below the Heat Map tier or outside a run", () => {
    const base = run();
    expect(throwBolt(base)).toBe(base);
    const buff = run(EMPTY_COURSE, { power: "buff" });
    expect(throwBolt(buff)).toBe(buff);
    const paused = heatRun(EMPTY_COURSE, { gameState: "paused" });
    expect(throwBolt(paused)).toBe(paused);
  });

  it("waits out the cooldown between throws", () => {
    const first = throwBolt(heatRun());
    expect(throwBolt(first)).toBe(first);
    // Just short of the cooldown the second throw is still refused.
    const almost = step(first, Math.floor(BOLT_COOLDOWN_MS / FRAME) - 1);
    expect(throwBolt(almost).bolts).toHaveLength(1);
    const ready = step(almost, 2);
    expect(ready.boltCooldownMs).toBe(0);
    expect(throwBolt(ready).bolts).toHaveLength(2);
  });

  it("keeps at most two bolts on the face", () => {
    const full = heatRun(EMPTY_COURSE, {
      bolts: [bolt({ x: 120 }), bolt({ id: 2, x: 150 })],
    });
    expect(throwBolt(full)).toBe(full);
    // Once one is gone, the slot opens again.
    const one = { ...full, bolts: [bolt({ x: 120 })] };
    expect(throwBolt(one).bolts).toHaveLength(2);
  });
});

describe("bolt flight", () => {
  it("travels forward and falls", () => {
    const [b] = stepOne([bolt({ y: 100, vy: 0 })]);
    expect(b.x).toBeCloseTo(100 + BOLT_SPEED, 1);
    expect(b.y).toBeGreaterThan(100);
    expect(b.vy).toBeGreaterThan(0);
  });

  it("bounces off the lane", () => {
    const [b] = stepOne([bolt({ y: GROUND_Y - BOLT_SIZE - 1, vy: 3 })]);
    expect(b.y).toBe(GROUND_Y - BOLT_SIZE);
    expect(b.vy).toBe(BOLT_BOUNCE_VY);
  });

  it("bounces off a ledge and off a block top", () => {
    const ledge: CourseLayout = {
      ...EMPTY_COURSE,
      ledges: [{ x: 80, y: 150, width: 80 }],
    };
    const [onLedge] = stepOne([bolt({ y: 150 - BOLT_SIZE - 1, vy: 3 })], ledge);
    expect(onLedge.y).toBe(150 - BOLT_SIZE);
    expect(onLedge.vy).toBe(BOLT_BOUNCE_VY);

    const blocks: CourseLayout = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: 104,
          y: 150,
          kind: "brick",
          contents: "kudos",
          used: false,
        },
      ],
    };
    const [onBlock] = stepOne(
      [bolt({ y: 150 - BOLT_SIZE - 1, vy: 3 })],
      blocks
    );
    expect(onBlock.y).toBe(150 - BOLT_SIZE);
    expect(onBlock.vy).toBe(BOLT_BOUNCE_VY);
  });

  it("drops through a gap and is gone once below the face", () => {
    const gap: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: 60, width: 200 }],
    };
    let bolts = [bolt({ y: GROUND_Y - BOLT_SIZE - 1, vy: 3 })];
    bolts = stepBolts(bolts, gap, GROUND_Y, 0, CANVAS_SIZE, FRAME);
    expect(bolts[0].y).toBeGreaterThan(GROUND_Y - BOLT_SIZE);
    for (let i = 0; i < 40 && bolts.length > 0; i++) {
      bolts = stepBolts(bolts, gap, GROUND_Y, 0, CANVAS_SIZE, FRAME);
    }
    expect(bolts).toHaveLength(0);
  });

  it("goes out against the side of a block", () => {
    const wall: CourseLayout = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: 108,
          y: GROUND_Y - BLOCK_SIZE,
          kind: "brick",
          contents: "kudos",
          used: false,
        },
      ],
    };
    expect(stepOne([bolt({ y: GROUND_Y - BOLT_SIZE, vy: 0 })], wall)).toEqual(
      []
    );
  });

  it("is gone once it leaves the face ahead of the camera", () => {
    expect(stepOne([bolt({ x: CANVAS_SIZE - 2, y: 100 })])).toEqual([]);
    expect(
      stepBolts(
        [bolt({ x: 400, y: 100 })],
        EMPTY_COURSE,
        GROUND_Y,
        200,
        CANVAS_SIZE,
        FRAME
      )
    ).toHaveLength(1);
  });

  it("spawns centred on the hand", () => {
    const b = spawnBolt(4, 72, 190);
    expect(b).toMatchObject({ id: 4, x: 72, y: 190 - BOLT_SIZE / 2 });
  });
});

describe("bolt hits", () => {
  /** A bolt about to reach an enemy standing at screen x 150. */
  function shot(type: Obstacle["type"]) {
    return heatRun(EMPTY_COURSE, {
      obstacles: [enemy(150, { type })],
      bolts: [bolt({ x: 150, y: GROUND_Y - 12, vy: 0 })],
    });
  }

  it("defeats a bug for 200 and is spent", () => {
    const before = shot("null_pointer");
    const s = step(before);
    expect(s.obstacles).toHaveLength(0);
    expect(s.bolts).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(before.score + BOLT_DEFEAT_SCORE);
    expect(s.popups?.some((p) => p.text === `+${BOLT_DEFEAT_SCORE}`)).toBe(
      true
    );
  });

  it("defeats a watchdog too", () => {
    const s = step(shot("watchdog"));
    expect(s.obstacles).toHaveLength(0);
    expect(s.bolts).toHaveLength(0);
  });

  it("fizzles on a spiked stack overflow, which stays", () => {
    const before = shot("stack_overflow");
    const s = step(before);
    expect(s.obstacles).toHaveLength(1);
    expect(s.bolts).toHaveLength(0);
    expect(s.score).toBeLessThan(before.score + BOLT_DEFEAT_SCORE);
  });

  it("passes through memory and NV tokens", () => {
    for (const type of ["mem_token", "flash_token"] as const) {
      const s = step(shot(type));
      expect(s.obstacles).toHaveLength(1);
      expect(s.bolts).toHaveLength(1);
    }
  });

  it("one bolt defeats only one enemy", () => {
    const s = step(
      heatRun(EMPTY_COURSE, {
        obstacles: [enemy(150), enemy(152, { id: 2 })],
        bolts: [bolt({ x: 150, y: GROUND_Y - 12, vy: 0 })],
      })
    );
    expect(s.obstacles).toHaveLength(1);
    expect(s.bolts).toHaveLength(0);
  });
});

describe("Heat Map in a run", () => {
  it("collecting a Heat Map while Buff makes a Heat Map runner", () => {
    const before = run(EMPTY_COURSE, {
      power: "buff",
      playerY: GROUND_Y - BUFF_HEIGHT,
      pickups: [pickupAtRunner("heatmap")],
    });
    const s = step(before);
    expect(s.power).toBe("heatmap");
    expect(s.pickups).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(before.score + POWERUP_SCORE);
    expect(s.banner?.text).toBe("HEAT MAP · X THROWS");
  });

  it("a Base runner grows straight to Heat Map, feet on the lane", () => {
    const s = step(
      run(EMPTY_COURSE, {
        playerY: GROUND_Y - BASE_HEIGHT,
        pickups: [pickupAtRunner("heatmap")],
      })
    );
    expect(s.power).toBe("heatmap");
    expect(s.playerY + BUFF_HEIGHT).toBeCloseTo(GROUND_Y, 5);
  });

  it("a Protein Shake doesn't knock a Heat Map runner down to Buff", () => {
    const s = step(
      heatRun(EMPTY_COURSE, { pickups: [pickupAtRunner("shake")] })
    );
    expect(s.power).toBe("heatmap");
  });

  it("a hit drops a Heat Map runner to Base and keeps the life", () => {
    const s = step(heatRun(EMPTY_COURSE, { obstacles: [enemy(PLAYER_X + 4)] }));
    expect(s.gameState).toBe("playing");
    expect(s.power).toBe("base");
    expect(s.lives).toBe(START_LIVES);
    expect(s.invulnerableMs).toBe(DAMAGE_GRACE_MS);
    expect(throwBolt(s)).toBe(s);
  });

  it("a lost life clears the bolts on the face", () => {
    const gap: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: 0, width: 400 }],
    };
    const s = step(
      heatRun(gap, {
        playerY: CANVAS_SIZE - 2,
        playerVy: 8,
        isGrounded: false,
        bolts: [bolt({ x: 120, y: 100 })],
        boltCooldownMs: 100,
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.bolts).toEqual([]);
    expect(s.boltCooldownMs).toBe(0);
  });

  it("an old snapshot with no bolt fields still steps", () => {
    const s = heatRun();
    delete s.bolts;
    delete s.boltCooldownMs;
    delete s.boltsThrown;
    const next = step(s);
    expect(next.bolts).toEqual([]);
    expect(throwBolt(next).bolts).toHaveLength(1);
  });
});

describe("manual", () => {
  it("lists the throw control on X", () => {
    const throwControl = GAME_MANUALS["garmin-watch"].controls.find(
      (c) => c.action === "Action (Heat Map & Cape)"
    );
    expect(throwControl?.key).toBe("X / Backspace / G");
  });
});
