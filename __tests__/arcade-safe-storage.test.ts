// @vitest-environment jsdom
//
// #1507: arcade game storage now goes through lib/safe-storage. These tests
// pin the on-disk format. A value saved before the migration must still
// load, and every write must produce the exact bytes the old direct
// localStorage calls produced: plain JSON.stringify output or a bare string,
// never the safeStorage metadata envelope.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  safeStorage,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import {
  CRT_CALIBRATION_STORAGE_KEY,
  DEFAULT_CRT_CALIBRATION,
  loadCRTCalibration,
  saveCRTCalibration,
  type CRTCalibrationConfig,
} from "@/lib/arcade";
import {
  DEFAULT_CYBERDECK_PROFILE,
  RETRO_LABYRINTH_HIGH_SCORE_KEY,
  STORAGE_KEY_PROFILE,
  loadCyberdeckProfile,
  saveCyberdeckProfile,
  type CyberdeckProfile,
} from "@/lib/dungeon";
import {
  MEME_STORAGE_KEYS,
  getUnlockedAchievements,
  isVaultUnlocked,
  setVaultUnlocked,
  unlockAchievement,
} from "@/lib/meme-data";
import {
  getSavedSetupConfig,
  saveSetupConfig,
  type GameSetupConfig,
} from "@/components/arcade/PreGameSetupWizard";

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

const originalDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage"
);
let storage: MockStorage;

beforeEach(() => {
  storage = new MockStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  safeStorage.clearCache();
});

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(window, "localStorage", originalDescriptor);
  }
  safeStorage.clearCache();
  vi.restoreAllMocks();
});

describe("CRT calibration storage (lib/arcade/crt-pipeline)", () => {
  const saved: CRTCalibrationConfig = {
    ...DEFAULT_CRT_CALIBRATION,
    scanlinesEnabled: false,
    scanlineIntensity: 0.4,
    phosphorMask: "shadow-mask",
    curvature: 0.2,
  };

  it("loads a calibration saved in the pre-migration plain JSON format", () => {
    storage.setItem(CRT_CALIBRATION_STORAGE_KEY, JSON.stringify(saved));
    expect(loadCRTCalibration()).toEqual(saved);
  });

  it("writes exactly JSON.stringify(config), with no envelope", () => {
    saveCRTCalibration(saved);
    expect(storage.getItem(CRT_CALIBRATION_STORAGE_KEY)).toBe(
      JSON.stringify(saved)
    );
  });

  it("still announces a successful save", () => {
    const listener = vi.fn();
    window.addEventListener("crt-calibration-changed", listener);
    saveCRTCalibration(saved);
    window.removeEventListener("crt-calibration-changed", listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default for malformed or non-object values", () => {
    for (const raw of ["{not json", "null", "[1,2]", "42", ""]) {
      storage.setItem(CRT_CALIBRATION_STORAGE_KEY, raw);
      expect(loadCRTCalibration()).toEqual(DEFAULT_CRT_CALIBRATION);
    }
  });
});

describe("Cyberdeck profile storage (lib/dungeon/metaprogression)", () => {
  const saved: CyberdeckProfile = {
    ...DEFAULT_CYBERDECK_PROFILE,
    totalCrypto: 900,
    highScore: 15400,
    runsCompleted: 3,
    firmwareUpgrades: {
      ...DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades,
      maxRamTier: 2,
    },
  };

  it("loads a profile saved in the pre-migration plain JSON format", () => {
    storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(saved));
    expect(loadCyberdeckProfile()).toEqual(saved);
  });

  it("writes exactly JSON.stringify(profile), with no envelope", () => {
    saveCyberdeckProfile(saved);
    expect(storage.getItem(STORAGE_KEY_PROFILE)).toBe(JSON.stringify(saved));
  });

  it("falls back to the default for malformed or non-object values", () => {
    for (const raw of ["{not json", "null", "[1,2]", '"text"']) {
      storage.setItem(STORAGE_KEY_PROFILE, raw);
      expect(loadCyberdeckProfile()).toEqual(DEFAULT_CYBERDECK_PROFILE);
    }
  });
});

describe("Pre-game setup storage (components/arcade/PreGameSetupWizard)", () => {
  const key = "pregame_setup_working-with-duck";
  const saved: GameSetupConfig = {
    difficulty: "hard",
    loadout: "agility",
    screenShake: "none",
    crtFilter: "scanlines",
    bezelStyle: "neon",
  };

  it("loads a setup saved in the pre-migration plain JSON format", () => {
    storage.setItem(key, JSON.stringify(saved));
    expect(getSavedSetupConfig("working-with-duck")).toEqual(saved);
  });

  it("writes exactly JSON.stringify(config), with no envelope", () => {
    saveSetupConfig("working-with-duck", saved);
    expect(storage.getItem(key)).toBe(JSON.stringify(saved));
  });

  it("falls back to the default for malformed values", () => {
    storage.setItem(key, "{not json");
    expect(getSavedSetupConfig("working-with-duck").difficulty).toBe("normal");
  });
});

describe("Meme achievements and vault storage (lib/meme-data)", () => {
  it("loads achievements saved as a plain JSON array", () => {
    storage.setItem(
      MEME_STORAGE_KEYS.ACHIEVEMENTS,
      JSON.stringify(["konami", "vault"])
    );
    expect(getUnlockedAchievements()).toEqual(["konami", "vault"]);
  });

  it("returns an empty list for malformed or non-array values", () => {
    for (const raw of ["{not json", '{"a":1}', "7"]) {
      storage.setItem(MEME_STORAGE_KEYS.ACHIEVEMENTS, raw);
      expect(getUnlockedAchievements()).toEqual([]);
    }
  });

  it("appends to the stored array and writes plain JSON", () => {
    storage.setItem(MEME_STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(["konami"]));
    expect(unlockAchievement("vault")).toBe(true);
    expect(storage.getItem(MEME_STORAGE_KEYS.ACHIEVEMENTS)).toBe(
      JSON.stringify(["konami", "vault"])
    );
    expect(unlockAchievement("vault")).toBe(false);
  });

  it('writes the vault flag as a bare "true"/"false" string', () => {
    setVaultUnlocked(true);
    expect(storage.getItem(MEME_STORAGE_KEYS.VAULT_UNLOCKED)).toBe("true");
    setVaultUnlocked(false);
    expect(storage.getItem(MEME_STORAGE_KEYS.VAULT_UNLOCKED)).toBe("false");
  });
});

describe("High score raw writes (RetroLabyrinth, WorkingWithDuck)", () => {
  it("safeSetRawItem keeps a bare numeric high score byte-identical", () => {
    safeSetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY, (15400).toString());
    expect(storage.getItem(RETRO_LABYRINTH_HIGH_SCORE_KEY)).toBe("15400");
    safeSetRawItem("working_with_duck_high_score", String(1200));
    expect(storage.getItem("working_with_duck_high_score")).toBe("1200");
  });
});

describe("Bare-string reads (safeGetRawItem)", () => {
  it("returns a legacy bare high score as the exact stored string", () => {
    storage.setItem("laser_loon_high_score", "1200");
    expect(safeGetRawItem("laser_loon_high_score")).toBe("1200");
  });

  it("does not turn a vault flag into a boolean", () => {
    storage.setItem(MEME_STORAGE_KEYS.VAULT_UNLOCKED, "true");
    expect(safeGetRawItem(MEME_STORAGE_KEYS.VAULT_UNLOCKED)).toBe("true");
    expect(isVaultUnlocked()).toBe(true);
  });

  it("returns null for a missing key", () => {
    expect(safeGetRawItem("working_with_duck_high_score")).toBeNull();
  });

  it("falls back to the in-memory value when storage throws", () => {
    safeSetRawItem("laser_loon_high_score", "900");
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(safeGetRawItem("laser_loon_high_score")).toBe("900");
  });
});
