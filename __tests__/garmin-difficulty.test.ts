import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
  jettisonOldestVariable,
  triggerGarbageCollection,
  getDifficultyRamp,
  getCooldownRemainingMs,
  DIFFICULTY_RAMP_METERS,
  JETTISON_COOLDOWN_MS,
  GC_COOLDOWN_MS,
  GC_BATTERY_COST,
  MEM_TOKEN_SCORE,
  FLASH_TOKEN_SCORE,
  PLAYER_X,
  GROUND_Y,
  DEVICE_PROFILES,
  FLASH_STORAGE_KEY,
  type DeviceTarget,
  type GameEngineState,
} from "@/lib/garmin-engine";

// #1320: obstacle speed capped 7 seconds in, the allocation pace never
// changed, pops and GCs were free points, and tokens only cost memory, so a
// bot that jumped perfectly and popped above 70% RAM never died.

// Deterministic Math.random and wall clock for the headless runs.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let clock = 0;
beforeEach(() => {
  // Collected NV tokens persist to localStorage; each run starts with empty
  // flash so one test's tokens cannot fill the next test's storage.
  if (typeof window.localStorage?.removeItem === "function") {
    window.localStorage.removeItem(FLASH_STORAGE_KEY);
  }
  clock = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.spyOn(Math, "random").mockImplementation(mulberry32(1320));
});
afterEach(() => {
  vi.restoreAllMocks();
});

const isBug = (type: string) =>
  type === "null_pointer" || type === "watchdog" || type === "stack_overflow";

/**
 * Runs a bot that never touches a bug (they are removed before they can
 * reach it) and never jumps, so it collects no tokens either. It frees memory
 * according to `manage`. Returns the seconds survived and how the run ended.
 */
function survive(
  device: DeviceTarget,
  manage: (s: GameEngineState) => GameEngineState,
  maxSeconds: number
) {
  const stepMs = 50;
  let state: GameEngineState = {
    ...startGame(createInitialState(device, 0, []), device),
    lastAllocTime: clock,
    lastObstacleTime: clock,
  };
  let elapsed = 0;
  while (state.gameState === "playing" && elapsed < maxSeconds * 1000) {
    clock += stepMs;
    elapsed += stepMs;
    state = updateGameSimulation(
      { ...state, obstacles: state.obstacles.filter((o) => !isBug(o.type)) },
      stepMs
    );
    if (state.gameState === "playing") state = manage(state);
  }
  return {
    seconds: elapsed / 1000,
    ended: state.crashReport?.errorType ?? state.gameState,
  };
}

describe("Garmin difficulty ramp (#1320)", () => {
  it("ramps from 0 to 1 over the ramp distance and holds there", () => {
    expect(getDifficultyRamp(0)).toBe(0);
    expect(getDifficultyRamp(DIFFICULTY_RAMP_METERS / 2)).toBeCloseTo(0.5);
    expect(getDifficultyRamp(DIFFICULTY_RAMP_METERS * 3)).toBe(1);
    expect(getDifficultyRamp(Number.NaN)).toBe(0);
  });

  it("spawns faster bugs later in the run", () => {
    const spawnSpeed = (distanceMeters: number) => {
      const run = {
        ...startGame(createInitialState("fenix", 0, []), "fenix"),
        distanceMeters,
        obstacles: [],
        lastObstacleTime: 0,
        lastAllocTime: clock,
      };
      return updateGameSimulation(run, 16).obstacles[0].speed;
    };
    const early = spawnSpeed(100);
    const at30s = spawnSpeed(450);
    const late = spawnSpeed(DIFFICULTY_RAMP_METERS);
    expect(at30s).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(at30s + 1.5);
  });

  it("a perfect dodger who never frees memory runs out on Edge within 8 minutes", () => {
    const run = survive("edge", (s) => s, 8 * 60);
    expect(run.ended).toBe("Out Of Memory");
  });

  it("popping alone can't keep up on Fēnix once the ramp tops out", () => {
    const popAbove70 = (s: GameEngineState) =>
      s.allocatedRamKb / DEVICE_PROFILES.fenix.ramLimitKb > 0.7
        ? jettisonOldestVariable(s).state
        : s;
    const run = survive("fenix", popAbove70, 12 * 60);
    expect(run.ended).toBe("Out Of Memory");
    expect(run.seconds).toBeGreaterThan(180);
  });

  it("adding GC to the pops buys a Fēnix run more time", () => {
    const limit = DEVICE_PROFILES.fenix.ramLimitKb;
    const popOnly = (s: GameEngineState) =>
      s.allocatedRamKb / limit > 0.7 ? jettisonOldestVariable(s).state : s;
    const popAndGc = (s: GameEngineState) => {
      if (s.allocatedRamKb / limit <= 0.7) return s;
      const gc = triggerGarbageCollection(s);
      return gc.freedKb > 0 ? gc.state : jettisonOldestVariable(s).state;
    };
    const a = survive("fenix", popOnly, 12 * 60);
    clock = 1_000_000;
    vi.spyOn(Math, "random").mockImplementation(mulberry32(1320));
    const b = survive("fenix", popAndGc, 12 * 60);
    expect(b.seconds).toBeGreaterThan(a.seconds);
  });
});

describe("Garmin memory actions cost something (#1320)", () => {
  function withGarbage(): GameEngineState {
    const run = startGame(createInitialState("fenix", 0, []), "fenix");
    return {
      ...run,
      variables: [
        ...run.variables,
        { id: 7, name: "a", type: "array", sizeKb: 1.6, allocatedAt: 1 },
        { id: 8, name: "b", type: "array", sizeKb: 1.6, allocatedAt: 2 },
        { id: 9, name: "c", type: "array", sizeKb: 1.6, allocatedAt: 3 },
      ],
      allocatedRamKb: 6.6,
    };
  }

  it("a pop needs to recharge before the next one", () => {
    const first = jettisonOldestVariable(withGarbage(), 10_000);
    expect(first.popped).toBeDefined();
    const second = jettisonOldestVariable(first.state, 10_500);
    expect(second.popped).toBeUndefined();
    expect(second.reason).toMatch(/recharging/i);
    expect(
      jettisonOldestVariable(first.state, 10_000 + JETTISON_COOLDOWN_MS).popped
    ).toBeDefined();
  });

  it("a GC draws battery and needs a longer recharge", () => {
    const run = withGarbage();
    const gc = triggerGarbageCollection(run, 20_000);
    expect(gc.freedKb).toBeGreaterThan(0);
    expect(gc.state.battery).toBe(run.battery - GC_BATTERY_COST);

    const again = triggerGarbageCollection(
      { ...gc.state, isGcActive: false },
      21_000
    );
    expect(again.freedKb).toBe(0);
    expect(again.reason).toMatch(/recharging/i);
    expect(
      getCooldownRemainingMs(gc.state.lastGcAt, GC_COOLDOWN_MS, 21_000)
    ).toBe(GC_COOLDOWN_MS - 1000);
  });
});

describe("Garmin tokens pay for the memory they cost (#1320)", () => {
  function collect(type: "mem_token" | "flash_token") {
    const run = {
      ...startGame(createInitialState("fenix", 0, []), "fenix"),
      lastAllocTime: clock,
      lastObstacleTime: clock + 60_000,
      obstacles: [
        {
          id: 1,
          x: PLAYER_X,
          y: GROUND_Y - 20,
          width: 14,
          height: 14,
          type,
          label: "TOK",
          speed: 0,
          variablePayload: type === "mem_token" ? ("int" as const) : undefined,
        },
      ],
    };
    const next = updateGameSimulation(run, 16);
    return { before: run, after: next };
  }

  it("a memory token scores points and costs RAM", () => {
    const { before, after } = collect("mem_token");
    expect(after.allocatedRamKb).toBeGreaterThan(before.allocatedRamKb);
    expect(after.score - before.score).toBeGreaterThanOrEqual(MEM_TOKEN_SCORE);
  });

  it("an NV token scores points and costs flash", () => {
    const { before, after } = collect("flash_token");
    expect(after.allocatedFlashKb).toBeGreaterThan(before.allocatedFlashKb);
    expect(after.score - before.score).toBeGreaterThanOrEqual(
      FLASH_TOKEN_SCORE
    );
  });
});
