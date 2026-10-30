import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RUN_SAVE_KEY,
  RUN_SAVE_VERSION,
  clearRun,
  loadRun,
  saveRun,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import { safeStorage } from "@/lib/safe-storage";

/**
 * The versioned Retro Labyrinth run save (#3460): one record under
 * `retro_labyrinth_run_v1` that round-trips, and that reads as no save,
 * never as an exception, whenever it cannot be trusted.
 */

const RUN: Omit<RetroLabyrinthRunSave, "version"> = {
  seed: "LAB-3F9K2Q",
  route: [0, 4, 2],
  roomIndex: 2,
  hp: 7,
  maxHp: 10,
  ram: 24,
  maxRam: 48,
  crypto: 130,
  ammo: { npm_install: 3, zero_day: 1 },
  loadout: { bonusWeapons: ["zero_day"], passives: ["ram_bank"] },
  classId: "cryptanalyst",
  activeWeaponId: "zero_day",
  firmware: {
    maxRamTier: 1,
    scanSpeedTier: 0,
    exploitRadiusTier: 2,
    startChipsTier: 0,
  },
  score: 4200,
  elapsedMs: 183_500,
};

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(RUN_SAVE_KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
  safeStorage.clearCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  safeStorage.clearCache();
});

describe("retro labyrinth run save", () => {
  it("round-trips every field under the versioned key", () => {
    expect(RUN_SAVE_KEY).toBe("retro_labyrinth_run_v1");
    expect(saveRun(RUN)).toBe(true);
    expect(stored().version).toBe(RUN_SAVE_VERSION);
    expect(loadRun()).toEqual({ version: RUN_SAVE_VERSION, ...RUN });
  });

  it("has no save before one is written and after it is cleared", () => {
    expect(loadRun()).toBeNull();
    saveRun(RUN);
    clearRun();
    expect(loadRun()).toBeNull();
    expect(window.localStorage.getItem(RUN_SAVE_KEY)).toBeNull();
  });

  it("treats another schema version as no save", () => {
    saveRun(RUN);
    window.localStorage.setItem(
      RUN_SAVE_KEY,
      JSON.stringify({ ...stored(), version: RUN_SAVE_VERSION + 1 })
    );
    expect(loadRun()).toBeNull();
  });

  it("treats corrupt JSON as no save", () => {
    window.localStorage.setItem(RUN_SAVE_KEY, "{not json");
    expect(() => loadRun()).not.toThrow();
    expect(loadRun()).toBeNull();
  });

  it.each([
    "seed",
    "route",
    "roomIndex",
    "hp",
    "maxHp",
    "ram",
    "maxRam",
    "crypto",
    "ammo",
    "loadout",
    "classId",
    "activeWeaponId",
    "firmware",
    "score",
    "elapsedMs",
  ])("treats a save missing %s as no save", (field) => {
    saveRun(RUN);
    const saved = stored();
    delete saved[field];
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(saved));
    expect(loadRun()).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ["an unknown class", { classId: "wizard" }],
    ["an unknown active weapon", { activeWeaponId: "laser" }],
    [
      "an unknown loadout weapon",
      { loadout: { bonusWeapons: ["laser"], passives: [] } },
    ],
    [
      "an unknown passive",
      { loadout: { bonusWeapons: [], passives: ["luck"] } },
    ],
    ["ammo for an unknown weapon", { ammo: { laser: 1 } }],
    ["negative HP", { hp: -1 }],
    ["a room index outside the route", { roomIndex: 3 }],
    ["a fractional route step", { route: [0, 1.5] }],
    [
      "a firmware tier that is not a number",
      { firmware: { ...RUN.firmware, maxRamTier: "1" } },
    ],
    ["a JSON array", { __replaceWith: [] }],
  ])("treats a save with %s as no save", (_label, change) => {
    saveRun(RUN);
    const next =
      "__replaceWith" in change
        ? change.__replaceWith
        : { ...stored(), ...change };
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(next));
    expect(loadRun()).toBeNull();
  });

  it("falls back to no save when storage is blocked, without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(saveRun(RUN)).toBe(false);
    expect(loadRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
  });
});
