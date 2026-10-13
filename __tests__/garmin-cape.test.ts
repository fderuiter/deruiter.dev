import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  JUMP_FORCE,
  createInitialState,
  pressAction,
  pressJump,
  setRunInput,
  spinCape,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_X,
  PLAYER_WIDTH,
  FLASH_STORAGE_KEY,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  generateStage,
  type CourseBlock,
  type CourseLayout,
} from "@/lib/garmin-course";
import {
  BUFF_HEIGHT,
  START_LIVES,
  blockReward,
  collectTier,
  damageTier,
  emergePickup,
  playerHeightFor,
  type Pickup,
} from "@/lib/garmin-powerups";
import {
  CAPE_CEILING_Y,
  CAPE_FLAP_VY,
  CAPE_FLIGHT_MS,
  CAPE_GLIDE_VY,
  CAPE_SPIN_COOLDOWN_MS,
  CAPE_SPIN_MS,
  CAPE_SPIN_REACH,
  FULL_PACE_JUMP_FORCE,
  PACE_DRAIN_MS,
  PACE_FILL_MS,
  PACE_SEGMENTS,
  SPIN_DEFEAT_SCORE,
  canSpin,
  glideVy,
  inSpinReach,
  isPaceFull,
  jumpForceFor,
  paceSegments,
  startsFlight,
  stepPaceMeter,
} from "@/lib/garmin-cape";
import { GAME_MANUALS } from "@/lib/game-manuals";

// The pace meter and the Compression Cape in Monkey C Mayhem (#1990).

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

/** A Cape runner standing on the lane. */
function capeRun(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return run(EMPTY_COURSE, {
    power: "cape",
    playerY: GROUND_Y - BUFF_HEIGHT,
    ...overrides,
  });
}

/** A Cape runner in the air, `above` pixels over the lane. */
function airborne(
  overrides: Partial<GameEngineState> = {},
  above = 80
): GameEngineState {
  return capeRun({
    playerY: GROUND_Y - BUFF_HEIGHT - above,
    playerVy: 0,
    isGrounded: false,
    coyoteMs: 1000,
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

function pickupAtRunner(kind: Pickup["kind"]): Pickup {
  return {
    id: 1,
    kind,
    x: PLAYER_X + 4,
    y: GROUND_Y - 12,
    vx: 0,
    vy: 0,
    emergeMs: 0,
  };
}

describe("pace meter rules", () => {
  it("fills while sprinting on footing, in PACE_FILL_MS from empty", () => {
    expect(stepPaceMeter(0, true, true, PACE_FILL_MS / 2)).toBeCloseTo(0.5);
    expect(stepPaceMeter(0, true, true, PACE_FILL_MS)).toBe(1);
    expect(stepPaceMeter(0.9, true, true, PACE_FILL_MS)).toBe(1);
  });

  it("drains while not sprinting on footing", () => {
    expect(stepPaceMeter(1, true, false, PACE_DRAIN_MS / 2)).toBeCloseTo(0.5);
    expect(stepPaceMeter(0.1, true, false, PACE_DRAIN_MS)).toBe(0);
  });

  it("holds in the air and ignores bad input", () => {
    expect(stepPaceMeter(0.4, false, true, 500)).toBe(0.4);
    expect(stepPaceMeter(0.4, false, false, 500)).toBe(0.4);
    expect(stepPaceMeter(undefined, true, true, 0)).toBe(0);
    expect(stepPaceMeter(Number.NaN, true, true, 100)).toBeCloseTo(
      100 / PACE_FILL_MS
    );
    expect(stepPaceMeter(0.4, true, true, Number.NaN)).toBe(0.4);
  });

  it("lights segments in sixths and is full only at the top", () => {
    expect(PACE_SEGMENTS).toBe(6);
    expect(paceSegments(0)).toBe(0);
    expect(paceSegments(0.5)).toBe(3);
    expect(paceSegments(0.99)).toBe(5);
    expect(paceSegments(1)).toBe(6);
    expect(paceSegments(undefined)).toBe(0);
    expect(isPaceFull(1)).toBe(true);
    expect(isPaceFull(0.99)).toBe(false);
  });

  it("a full meter jumps higher, and takes off only with the Cape", () => {
    expect(jumpForceFor(1, JUMP_FORCE)).toBe(FULL_PACE_JUMP_FORCE);
    expect(jumpForceFor(0.5, JUMP_FORCE)).toBe(JUMP_FORCE);
    expect(FULL_PACE_JUMP_FORCE).toBeLessThan(JUMP_FORCE);
    expect(startsFlight("cape", 1)).toBe(true);
    expect(startsFlight("cape", 0.5)).toBe(false);
    expect(startsFlight("heatmap", 1)).toBe(false);
  });
});

describe("Cape rules", () => {
  it("is a Buff-height tier from cape blocks that drops to Base", () => {
    expect(playerHeightFor("cape")).toBe(BUFF_HEIGHT);
    expect(blockReward("cape", "buff")).toBe("cape");
    expect(blockReward("cape", "heatmap")).toBe("cape");
    expect(blockReward("cape", "base")).toBe("shake");
    expect(blockReward("power", "cape")).toBe("heatmap");
    expect(collectTier("buff", "cape")).toBe("cape");
    expect(collectTier("cape", "shake")).toBe("cape");
    expect(collectTier("cape", "heatmap")).toBe("heatmap");
    expect(damageTier("cape")).toEqual({ power: "base", survived: true });
  });

  it("a Cape sits on its block", () => {
    const block: CourseBlock = {
      id: 2,
      x: 100,
      y: 120,
      kind: "sync",
      contents: "cape",
      used: true,
    };
    expect(emergePickup("cape", block, 2).vx).toBe(0);
  });

  it("caps the fall while jump is held, never the rise", () => {
    expect(glideVy(8, "cape", true)).toBe(CAPE_GLIDE_VY);
    expect(glideVy(8, "cape", false)).toBe(8);
    expect(glideVy(8, "buff", true)).toBe(8);
    expect(glideVy(-6, "cape", true)).toBe(-6);
  });

  it("spins only with the Cape and the cooldown spent", () => {
    expect(canSpin("cape", 0)).toBe(true);
    expect(canSpin("cape", undefined)).toBe(true);
    expect(canSpin("cape", 10)).toBe(false);
    expect(canSpin("heatmap", 0)).toBe(false);
  });

  it("reaches CAPE_SPIN_REACH beyond either side, level with the body", () => {
    const runner = { left: 50, right: 70, top: 100, bottom: 130 };
    const box = (left: number, top = 105) => ({
      left,
      right: left + 10,
      top,
      bottom: top + 10,
    });
    expect(inSpinReach(runner, box(70 + CAPE_SPIN_REACH - 1))).toBe(true);
    expect(inSpinReach(runner, box(70 + CAPE_SPIN_REACH))).toBe(false);
    expect(inSpinReach(runner, box(50 - CAPE_SPIN_REACH - 9))).toBe(true);
    expect(inSpinReach(runner, box(50 - CAPE_SPIN_REACH - 10))).toBe(false);
    expect(inSpinReach(runner, box(72, 60))).toBe(false);
  });

  it("each stage has at most one cape block, after its power block", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (let stage = 1; stage <= 5; stage++) {
        const blocks = generateStage(stage, seed, GROUND_Y).blocks;
        const capes = blocks.filter((b) => b.contents === "cape");
        expect(capes.length).toBeLessThanOrEqual(1);
        if (capes.length === 1) {
          const power = blocks.find((b) => b.contents === "power");
          expect(power).toBeDefined();
          expect(power!.x).toBeLessThan(capes[0].x);
          expect(capes[0].kind).toBe("sync");
        }
      }
    }
  });
});

describe("pace meter in a run", () => {
  it("sprinting on the lane fills it; running drains it", () => {
    const sprinting = setRunInput(run(), 1);
    const full = step(sprinting, Math.ceil(PACE_FILL_MS / FRAME) + 1);
    expect(full.paceMeter).toBe(1);
    const easing = step(setRunInput(full, 0), 30);
    expect(easing.paceMeter).toBeLessThan(1);
    expect(easing.paceMeter).toBeGreaterThan(0);
  });

  it("a full meter jumps higher", () => {
    const s = pressJump(run(EMPTY_COURSE, { paceMeter: 1 }));
    expect(s.playerVy).toBe(FULL_PACE_JUMP_FORCE);
    expect(s.flightMs ?? 0).toBe(0);
    expect(pressJump(run()).playerVy).toBe(JUMP_FORCE);
  });

  it("holds in the air", () => {
    const s = step(
      setRunInput(
        run(EMPTY_COURSE, {
          paceMeter: 0.5,
          playerY: 100,
          isGrounded: false,
          playerVy: -2,
        }),
        1
      )
    );
    expect(s.paceMeter).toBe(0.5);
  });
});

describe("gliding and flight", () => {
  it("a Cape runner holding jump glides down", () => {
    const held = step(airborne({ jumpHeld: true, playerVy: 4 }), 10);
    expect(held.playerVy).toBeLessThanOrEqual(CAPE_GLIDE_VY);
    const loose = step(airborne({ jumpHeld: false, playerVy: 4 }), 10);
    expect(loose.playerVy).toBeGreaterThan(CAPE_GLIDE_VY);
    expect(held.playerY).toBeLessThan(loose.playerY);
  });

  it("a full meter takes off, and presses climb during the flight", () => {
    const takeoff = pressJump(capeRun({ paceMeter: 1 }));
    expect(takeoff.playerVy).toBe(FULL_PACE_JUMP_FORCE);
    expect(takeoff.flightMs).toBe(CAPE_FLIGHT_MS);
    const falling = step(takeoff, 12);
    expect(falling.isGrounded).toBe(false);
    expect(falling.flightMs).toBeGreaterThan(0);
    expect(falling.paceMeter).toBe(1);
    const flap = pressJump(falling);
    expect(flap.playerVy).toBe(CAPE_FLAP_VY);
    expect(flap.jumpBufferMs).toBe(0);
  });

  it("a press after the flight ends only buffers, and the meter empties", () => {
    const flying = airborne({ flightMs: FRAME / 2, paceMeter: 1 });
    const ended = step(flying);
    expect(ended.flightMs).toBe(0);
    expect(ended.paceMeter).toBe(0);
    const press = pressJump(ended);
    expect(press.playerVy).toBe(ended.playerVy);
    expect(press.jumpBufferMs).toBeGreaterThan(0);
  });

  it("landing ends the flight", () => {
    const s = step(
      capeRun({
        playerY: GROUND_Y - BUFF_HEIGHT - 2,
        playerVy: 3,
        isGrounded: false,
        flightMs: 2000,
        paceMeter: 1,
      })
    );
    expect(s.isGrounded).toBe(true);
    expect(s.flightMs).toBe(0);
    expect(s.paceMeter).toBe(0);
  });

  it("flight stops at the ceiling", () => {
    const s = step(
      airborne({ playerVy: -8, flightMs: 2000 }, GROUND_Y - BUFF_HEIGHT - 41)
    );
    expect(s.playerY).toBe(CAPE_CEILING_Y);
    expect(s.playerVy).toBeGreaterThanOrEqual(0);
  });

  it("losing the Cape mid-flight stops the climbing", () => {
    const s = airborne({ power: "buff", flightMs: 2000 });
    expect(pressJump(s).playerVy).toBe(s.playerVy);
  });
});

describe("cape spin", () => {
  it("starts only with the Cape, then waits out its cooldown", () => {
    const base = run();
    expect(spinCape(base)).toBe(base);
    const spun = spinCape(capeRun());
    expect(spun.spinMs).toBe(CAPE_SPIN_MS);
    expect(spun.spinCooldownMs).toBe(CAPE_SPIN_COOLDOWN_MS);
    expect(spinCape(spun)).toBe(spun);
    const later = step(spun, Math.ceil(CAPE_SPIN_COOLDOWN_MS / FRAME) + 1);
    expect(later.spinMs).toBe(0);
    expect(spinCape(later).spinMs).toBe(CAPE_SPIN_MS);
  });

  it("the action key spins with the Cape and throws with a Heat Map", () => {
    expect(pressAction(capeRun()).spinMs).toBe(CAPE_SPIN_MS);
    const heat = pressAction(capeRun({ power: "heatmap" }));
    expect(heat.bolts).toHaveLength(1);
    const buff = capeRun({ power: "buff" });
    expect(pressAction(buff)).toBe(buff);
  });

  it("defeats a bug beside the runner for 200", () => {
    const before = spinCape(
      capeRun({ obstacles: [enemy(PLAYER_X + PLAYER_WIDTH + 4)] })
    );
    const s = step(before);
    expect(s.obstacles).toHaveLength(0);
    expect(s.power).toBe("cape");
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBeGreaterThanOrEqual(before.score + SPIN_DEFEAT_SCORE);
  });

  it("reaches behind as well", () => {
    const s = step(spinCape(capeRun({ obstacles: [enemy(PLAYER_X - 20)] })));
    expect(s.obstacles).toHaveLength(0);
  });

  it("leaves a spiked stack overflow alone", () => {
    const s = step(
      spinCape(
        capeRun({
          obstacles: [
            enemy(PLAYER_X + PLAYER_WIDTH + 6, { type: "stack_overflow" }),
          ],
        })
      )
    );
    expect(s.obstacles).toHaveLength(1);
  });

  it("does nothing to a bug out of reach", () => {
    const s = step(
      spinCape(
        capeRun({
          obstacles: [enemy(PLAYER_X + PLAYER_WIDTH + CAPE_SPIN_REACH + 8)],
        })
      )
    );
    expect(s.obstacles).toHaveLength(1);
  });

  it("bumps a Sync Block beside the runner", () => {
    const camera = 0.25 * 10;
    const block: CourseBlock = {
      id: 9,
      x: camera + PLAYER_X + PLAYER_WIDTH + 2,
      y: GROUND_Y - BUFF_HEIGHT,
      kind: "sync",
      contents: "power",
      used: false,
    };
    const withBlock = step(
      spinCape(
        run(
          { ...EMPTY_COURSE, blocks: [block] },
          {
            power: "cape",
            playerY: GROUND_Y - BUFF_HEIGHT,
          }
        )
      )
    );
    expect(withBlock.course?.blocks[0].used).toBe(true);
    expect(withBlock.pickups?.map((p) => p.kind)).toEqual(["heatmap"]);
    // Without a spin the same block stays put.
    const still = step(
      run(
        { ...EMPTY_COURSE, blocks: [block] },
        {
          power: "cape",
          playerY: GROUND_Y - BUFF_HEIGHT,
        }
      )
    );
    expect(still.course?.blocks[0].used).toBe(false);
  });
});

describe("Cape in a run", () => {
  it("collecting a Cape while Buff makes a Cape runner", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        pickups: [pickupAtRunner("cape")],
      })
    );
    expect(s.power).toBe("cape");
    expect(s.banner?.text).toBe("COMPRESSION CAPE · X SPINS");
  });

  it("a lost life empties the meter and ends any flight", () => {
    const gap: CourseLayout = { ...EMPTY_COURSE, gaps: [{ x: 0, width: 400 }] };
    const s = step(
      airborne(
        {
          course: gap,
          playerY: CANVAS_SIZE - 2,
          playerVy: 8,
          flightMs: 1000,
          paceMeter: 1,
          spinMs: 100,
        },
        0
      )
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.paceMeter).toBe(0);
    expect(s.flightMs).toBe(0);
    expect(s.spinMs).toBe(0);
  });

  it("an old snapshot without the new fields still steps", () => {
    const s = capeRun();
    delete s.paceMeter;
    delete s.flightMs;
    delete s.spinMs;
    delete s.spinCooldownMs;
    const next = step(s);
    expect(next.paceMeter).toBe(0);
    expect(next.flightMs).toBe(0);
  });

  it("the manual lists the cape controls", () => {
    const actions = GAME_MANUALS["garmin-watch"].controls.map((c) => c.action);
    expect(actions).toContain("Action (Heat Map & Cape)");
    expect(actions).toContain("Glide & Take Off (Compression Cape)");
  });
});
