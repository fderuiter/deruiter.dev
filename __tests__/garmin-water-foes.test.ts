import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  createInitialState,
  spinCape,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_WIDTH,
  PLAYER_X,
  FLASH_STORAGE_KEY,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  STAGE_COUNT,
  type CourseLayout,
} from "@/lib/garmin-course";
import { BUFF_HEIGHT } from "@/lib/garmin-powerups";
import {
  FOE_DEFEAT_SCORE,
  FOE_STOMP_SCORE,
  GOGGLES_SINK,
  JELLYFISH_BOB,
  WATER_FOE_TABLE,
  WATER_TOP_Y,
  damageFoe,
  generateFoes,
  kickShell,
  makeFoe,
  runnerContact,
  shellSweep,
  stepFoes,
  stompFoe,
  type Box,
  type Foe,
  type FoeKind,
  type FoeShot,
} from "@/lib/garmin-foes";

const WATER_KINDS: readonly FoeKind[] = ["jellyfish", "goggles"];
const FRAME = 1000 / 60;
const SEEDS = [0, 1, 7, 42, 99];
/** The runner's world left edge one frame into a run, as in garmin-foes.test. */
const RUNNER_LEFT = 2.5 + PLAYER_X;
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

/** Steps foes on an empty course with the camera at `cameraX`. */
function stepAt(foes: Foe[], shots: FoeShot[] = [], cameraX = 0, runnerX = 62) {
  return stepFoes(
    foes,
    shots,
    EMPTY_COURSE,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    FRAME,
    runnerX,
    1
  );
}

/** A runner box with its top at `top`, over the middle of the lane. */
const runnerBox = (top: number): Box => ({
  left: 100,
  right: 116,
  top,
  bottom: top + 22,
});

/** A running Fenix session with no spawns and only the foes a test gives it. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0, []), "fenix"),
    course,
    obstacles: [],
    foes: [],
    foeShots: [],
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

describe("water theme foe layout", () => {
  it("pool and open-water stages place only water kinds", () => {
    for (const seed of SEEDS) {
      const pool = generateFoes(2, seed, EMPTY_COURSE, GROUND_Y, "pool");
      const water = generateFoes(4, seed, EMPTY_COURSE, GROUND_Y, "open-water");
      expect(pool.length).toBeGreaterThan(0);
      expect(water.length).toBeGreaterThan(0);
      for (const f of [...pool, ...water]) {
        expect(WATER_KINDS).toContain(f.kind);
      }
    }
  });

  it("each water theme draws only from its own table", () => {
    for (const seed of SEEDS) {
      for (const f of generateFoes(2, seed, EMPTY_COURSE, GROUND_Y, "pool")) {
        expect(WATER_FOE_TABLE.pool).toContain(f.kind);
      }
      for (const f of generateFoes(
        4,
        seed,
        EMPTY_COURSE,
        GROUND_Y,
        "open-water"
      )) {
        expect(WATER_FOE_TABLE["open-water"]).toContain(f.kind);
      }
    }
  });

  it("track stages produce no water kinds by default", () => {
    for (const seed of SEEDS) {
      for (let stage = 1; stage <= STAGE_COUNT; stage++) {
        for (const f of generateFoes(stage, seed, EMPTY_COURSE, GROUND_Y)) {
          expect(WATER_KINDS).not.toContain(f.kind);
        }
      }
    }
  });

  it("the track theme is identical to the default call", () => {
    for (const seed of SEEDS) {
      for (let stage = 1; stage <= STAGE_COUNT; stage++) {
        expect(
          generateFoes(stage, seed, EMPTY_COURSE, GROUND_Y, "track")
        ).toEqual(generateFoes(stage, seed, EMPTY_COURSE, GROUND_Y));
      }
    }
  });

  it("goggles come in pairs at the same x, phases 0 and pi, on one line", () => {
    let pairs = 0;
    for (const seed of SEEDS) {
      const goggles = generateFoes(
        4,
        seed,
        EMPTY_COURSE,
        GROUND_Y,
        "open-water"
      ).filter((f) => f.kind === "goggles");
      const byX = new Map<number, Foe[]>();
      for (const g of goggles) byX.set(g.x, [...(byX.get(g.x) ?? []), g]);
      for (const pair of byX.values()) {
        pairs++;
        expect(pair).toHaveLength(2);
        expect(pair.map((g) => g.phase).sort()).toEqual([0, Math.PI]);
        expect(pair[0].baseY).toBe(pair[1].baseY);
        expect(pair.every((g) => g.mode === "fly")).toBe(true);
      }
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it("jellyfish float in the water column above the track", () => {
    let seen = 0;
    for (const seed of SEEDS) {
      for (const f of generateFoes(2, seed, EMPTY_COURSE, GROUND_Y, "pool")) {
        if (f.kind !== "jellyfish") continue;
        seen++;
        expect(f.mode).toBe("drift");
        expect(f.vx).toBeLessThan(0);
        expect(f.phase).toBe(0);
        expect(f.baseY).toBeGreaterThanOrEqual(WATER_TOP_Y + 10);
        expect(f.baseY).toBeLessThanOrEqual(GROUND_Y - 30);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("some water foes reach down to a runner wading on the bottom", () => {
    // A Base runner standing on the bottom has its head at this height.
    const waderTop = GROUND_Y - 24;
    let low = 0;
    for (const seed of SEEDS) {
      for (const theme of ["pool", "open-water"] as const) {
        for (const f of generateFoes(2, seed, EMPTY_COURSE, GROUND_Y, theme)) {
          const wave = f.kind === "goggles" ? GOGGLES_SINK : JELLYFISH_BOB;
          if ((f.baseY ?? f.y) + wave + f.height > waderTop) low++;
        }
      }
    }
    expect(low).toBeGreaterThan(0);
  });
});

describe("water foe contact", () => {
  it("a jellyfish is never stompable: landing on it hurts", () => {
    const jelly = makeFoe(1, "jellyfish", 100, GROUND_Y, { waterY: 150 });
    expect(jelly.mode).toBe("drift");
    expect(runnerContact(jelly, runnerBox(jelly.y - 18), jelly.y - 2, 3)).toBe(
      "hurt"
    );
    expect(stompFoe(jelly, 50)).toEqual({ foe: jelly, score: 0 });
  });

  it("goggles are stompable for the normal stomp score", () => {
    const goggles = makeFoe(2, "goggles", 100, GROUND_Y, { waterY: 150 });
    expect(
      runnerContact(goggles, runnerBox(goggles.y - 18), goggles.y - 2, 3)
    ).toBe("stomp");
    expect(stompFoe(goggles, 50)).toEqual({
      foe: null,
      score: FOE_STOMP_SCORE,
    });
  });
});

describe("water foe motion", () => {
  it("a jellyfish drifts left with its bob within JELLYFISH_BOB of its line", () => {
    let foes = [makeFoe(1, "jellyfish", 200, GROUND_Y, { waterY: 150 })];
    const xs: number[] = [];
    const offsets: number[] = [];
    for (let i = 0; i < 300 && foes.length > 0; i++) {
      foes = stepAt(foes).foes;
      if (foes.length === 0) break;
      xs.push(foes[0].x);
      offsets.push(foes[0].y - 150);
    }
    expect(xs.length).toBeGreaterThan(100);
    expect(xs[xs.length - 1]).toBeLessThan(200);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(JELLYFISH_BOB + 1e-9);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-JELLYFISH_BOB - 1e-9);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(
      JELLYFISH_BOB
    );
  });

  it("a goggles pair sinks while its partner rises", () => {
    const sinker = makeFoe(1, "goggles", 200, GROUND_Y, {
      waterY: 150,
      phase: 0,
    });
    const riser = makeFoe(2, "goggles", 200, GROUND_Y, {
      waterY: 150,
      phase: Math.PI,
    });
    const moved = stepAt([sinker, riser]).foes;
    const down = moved.find((f) => f.id === 1)!;
    const up = moved.find((f) => f.id === 2)!;
    expect(down.y).toBeGreaterThan(150);
    expect(up.y).toBeLessThan(150);
  });

  it("goggles keep their bob within GOGGLES_SINK of their line", () => {
    let foes = [
      makeFoe(1, "goggles", 200, GROUND_Y, { waterY: 150, phase: 0 }),
    ];
    const offsets: number[] = [];
    for (let i = 0; i < 200 && foes.length > 0; i++) {
      foes = stepAt(foes).foes;
      if (foes.length === 0) break;
      offsets.push(foes[0].y - 150);
    }
    expect(offsets.length).toBeGreaterThan(100);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(GOGGLES_SINK + 1e-9);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-GOGGLES_SINK - 1e-9);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(
      GOGGLES_SINK
    );
  });

  it("drifting and bobbing foes stay in the water column over many steps", () => {
    for (const seed of SEEDS) {
      const placed = generateFoes(
        4,
        seed,
        EMPTY_COURSE,
        GROUND_Y,
        "open-water"
      );
      for (const start of placed) {
        // Camera set so the foe is on the face for the whole run.
        const cameraX = start.x - 60;
        let foes = [start];
        for (let i = 0; i < 240 && foes.length > 0; i++) {
          foes = stepAt(foes, [], cameraX).foes;
          for (const f of foes) {
            expect(f.y).toBeGreaterThanOrEqual(WATER_TOP_Y);
            expect(f.y + f.height).toBeLessThan(GROUND_Y);
          }
        }
      }
    }
  });
});

describe("water foe defeat", () => {
  it("damage from heat bolts, cape spins, shells or Runner's High defeats both kinds", () => {
    for (const kind of WATER_KINDS) {
      const foe = makeFoe(1, kind, 150, GROUND_Y, { waterY: 150 });
      expect(damageFoe(foe, 1)).toEqual({ foe: null, score: FOE_DEFEAT_SCORE });
      expect(damageFoe(foe, 2)).toEqual({ foe: null, score: FOE_DEFEAT_SCORE });
    }
  });

  it("a kicked shell flattens a drifting jellyfish and a pair of goggles it touches", () => {
    const shell = {
      ...kickShell(
        stompFoe(makeFoe(1, "kettlebell", 100, GROUND_Y), 0).foe!,
        0
      ),
      graceMs: 0,
    };
    const jelly = makeFoe(2, "jellyfish", shell.x + 2, GROUND_Y, {
      waterY: shell.y,
    });
    const goggles = makeFoe(3, "goggles", 400, GROUND_Y, { waterY: 150 });
    const sweep = shellSweep([shell, jelly, goggles]);
    expect(sweep.foes.map((f) => f.id)).toEqual([1, 3]);
    expect(sweep.hits).toEqual([{ foe: jelly, score: FOE_DEFEAT_SCORE }]);
  });

  it("a heat bolt in the water column defeats a jellyfish", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "heatmap",
        playerY: GROUND_Y - BUFF_HEIGHT,
        foes: [makeFoe(9, "jellyfish", 160, GROUND_Y, { waterY: 150 })],
        bolts: [{ id: 1, x: 155, y: 150, vx: 7, vy: 0 }],
      })
    );
    expect(s.foes).toEqual([]);
    expect(s.bolts).toEqual([]);
  });

  it("a cape spin beside the runner defeats a goggles foe at its height", () => {
    const s = step(
      spinCape(
        run(EMPTY_COURSE, {
          power: "cape",
          playerY: GROUND_Y - BUFF_HEIGHT,
          foes: [
            makeFoe(9, "goggles", RUNNER_LEFT + PLAYER_WIDTH + 4, GROUND_Y, {
              waterY: GROUND_Y - BUFF_HEIGHT,
              phase: 0,
            }),
          ],
        })
      )
    );
    expect(s.foes).toEqual([]);
  });
});
