import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MockStorage } from "../vitest.setup";
import { safeClear } from "@/lib/safe-storage";
import * as safeStorage from "@/lib/safe-storage";
import { raceSetup, type RaceSetup } from "@/lib/garmin/race";
import {
  GHOST_FLAG,
  GHOST_SAMPLE_MS,
  type GhostTrack,
} from "@/lib/garmin/ghost";
import {
  GHOST_ON_KEY,
  GHOST_STORE_KEY,
  GHOST_TARGET_KEY,
  MAX_GHOSTS,
  loadGhost,
  readGhostOn,
  readGhostTarget,
  saveGhost,
} from "@/lib/garmin/ghost-store";

// Virtual Partner storage (#2020): one ghost per race, the cap and eviction,
// corrupt ghosts and the ghost options.

const DAY = new Date(2026, 9, 14, 8);
const SATURDAY: RaceSetup = raceSetup("saturday5k", "any", DAY);
let mockStorage = new MockStorage();

beforeEach(() => {
  mockStorage = new MockStorage();
  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  safeClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A short ghost finishing at `timeMs`. */
function ghost(timeMs: number): GhostTrack {
  return {
    intervalMs: GHOST_SAMPLE_MS,
    samples: [0, 1, 2].map((d) => ({
      d,
      y: 181,
      stage: 1,
      power: "base",
      flags: GHOST_FLAG.grounded,
    })),
    lapEndsMs: [timeMs],
    timeMs,
  };
}

/** The `i`th race of a run of different seeds. */
const raceN = (i: number): RaceSetup => ({ ...SATURDAY, seed: 1000 + i });

/** The stored ghosts, as stored. */
function stored(): Record<string, { at: string }> {
  return JSON.parse(mockStorage.getItem(GHOST_STORE_KEY) ?? "{}");
}

describe("ghost storage (#2020)", () => {
  it("has no ghost until one is saved", () => {
    expect(loadGhost(SATURDAY)).toBeNull();
  });

  it("saves a ghost and reads it back for the same race only", () => {
    expect(saveGhost(SATURDAY, ghost(250_000), DAY)).toBe(true);
    expect(loadGhost(SATURDAY)?.timeMs).toBe(250_000);
    expect(loadGhost({ ...SATURDAY, category: "nogear" })).toBeNull();
    expect(loadGhost(raceSetup("daily", "any", DAY))).toBeNull();
  });

  it("replaces the ghost of a race with the newer best", () => {
    saveGhost(SATURDAY, ghost(250_000), DAY);
    saveGhost(SATURDAY, ghost(240_000), new Date(2026, 9, 15));
    expect(loadGhost(SATURDAY)?.timeMs).toBe(240_000);
    expect(Object.keys(stored())).toHaveLength(1);
  });

  it(`keeps at most ${MAX_GHOSTS} ghosts, dropping the oldest`, () => {
    for (let i = 0; i <= MAX_GHOSTS; i++) {
      saveGhost(raceN(i), ghost(200_000 + i), new Date(2026, 9, 1 + i));
    }
    expect(Object.keys(stored())).toHaveLength(MAX_GHOSTS);
    expect(loadGhost(raceN(0))).toBeNull();
    expect(loadGhost(raceN(MAX_GHOSTS))?.timeMs).toBe(200_000 + MAX_GHOSTS);
  });

  it("drops older ghosts when storage is too full for the new one", () => {
    for (let i = 0; i < 3; i++) {
      saveGhost(raceN(i), ghost(200_000 + i), new Date(2026, 9, 1 + i));
    }
    // Storage now only takes a write holding two ghosts.
    const real = safeStorage.safeSetRawItem;
    vi.spyOn(safeStorage, "safeSetRawItem").mockImplementation(
      (key, raw, options) =>
        Object.keys(JSON.parse(raw)).length <= 2 && real(key, raw, options)
    );
    expect(saveGhost(raceN(9), ghost(199_000), new Date(2026, 9, 9))).toBe(
      true
    );
    const keys = Object.keys(stored());
    expect(keys).toHaveLength(2);
    // The newest older ghost stays with the new one.
    expect(loadGhost(raceN(2))?.timeMs).toBe(200_002);
    expect(loadGhost(raceN(9))?.timeMs).toBe(199_000);
  });

  it("drops ghosts that can no longer be raced before live ones", () => {
    const yesterday = new Date(2026, 9, 13, 8);
    saveGhost(SATURDAY, ghost(250_000), new Date(2026, 9, 1));
    saveGhost(raceSetup("daily", "any", yesterday), ghost(90_000), yesterday);
    // A ghost from an older course version, written straight to storage.
    const withOld = JSON.stringify({
      ...stored(),
      "saturday5k:nogear:5205000:v0": {
        timeMs: 1,
        at: new Date(2026, 9, 12).toISOString(),
        data: "g1:2s:0::m1,0/0",
      },
    });
    safeClear();
    mockStorage.setItem(GHOST_STORE_KEY, withOld);
    expect(Object.keys(stored())).toHaveLength(3);
    const today = raceSetup("daily", "nogear", DAY);
    expect(saveGhost(today, ghost(95_000), DAY)).toBe(true);
    const keys = Object.keys(stored());
    // The Saturday ghost is older than both, yet it is the one kept.
    expect(keys).toHaveLength(2);
    expect(loadGhost(SATURDAY)?.timeMs).toBe(250_000);
    expect(loadGhost(today)?.timeMs).toBe(95_000);
  });

  it("reports a ghost storage will not take", () => {
    vi.spyOn(safeStorage, "safeSetRawItem").mockReturnValue(false);
    expect(saveGhost(SATURDAY, ghost(250_000), DAY)).toBe(false);
  });

  it("reads a corrupt ghost, entry or store as no ghost", () => {
    saveGhost(SATURDAY, ghost(250_000), DAY);
    const all = stored();
    const key = Object.keys(all)[0];
    const corrupt = (raw: string) => {
      safeClear();
      mockStorage.setItem(GHOST_STORE_KEY, raw);
      return loadGhost(SATURDAY);
    };
    expect(
      corrupt(JSON.stringify({ [key]: { ...all[key], data: "g1:broken" } }))
    ).toBeNull();
    expect(corrupt(JSON.stringify({ [key]: 42 }))).toBeNull();
    expect(corrupt("not json")).toBeNull();
    expect(corrupt("[1, 2]")).toBeNull();
  });

  it("keeps a race's ghost apart from another seed and course version", () => {
    saveGhost(SATURDAY, ghost(250_000), DAY);
    expect(loadGhost({ ...SATURDAY, seed: SATURDAY.seed + 1 })).toBeNull();
    const key = Object.keys(stored())[0];
    expect(key).toContain(`:${SATURDAY.seed}:v`);
  });
});

describe("ghost options (#2020)", () => {
  it("is on, against your PR, until set otherwise", () => {
    expect(readGhostOn()).toBe(true);
    expect(readGhostTarget()).toBe("pr");
  });

  it("reads the stored options, ignoring unknown targets", () => {
    mockStorage.setItem(GHOST_ON_KEY, "0");
    mockStorage.setItem(GHOST_TARGET_KEY, "cr");
    expect(readGhostOn()).toBe(false);
    expect(readGhostTarget()).toBe("cr");
    safeClear();
    mockStorage.setItem(GHOST_TARGET_KEY, "rival");
    expect(readGhostTarget()).toBe("pr");
  });
});
