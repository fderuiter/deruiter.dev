// @vitest-environment jsdom
//
// #2085: the Cyberdeck profile's firmware tiers and class unlocks used to be
// saved and never read. These cover the pure rules behind the Firmware Bay
// and the class milestones, and that old saves still load.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  BASE_AOE_RADIUS,
  CLASS_UNLOCK_MILESTONES,
  aoeRadiusBonus,
  CYBERDECK_CLASSES,
  DEFAULT_CYBERDECK_PROFILE,
  DEFAULT_WEAPONS,
  FIRMWARE_MAX_TIER,
  FIRMWARE_UPGRADES,
  STORAGE_KEY_PROFILE,
  cyberdeckStartingStats,
  fireWeapon,
  firmwareBonuses,
  firmwareTierCost,
  generateHexMatrixPuzzle,
  isCyberdeckClassUnlocked,
  loadCyberdeckProfile,
  purchaseFirmwareTier,
  recordCyberdeckMilestone,
  saveCyberdeckProfile,
  type CyberdeckProfile,
  type Enemy,
} from "@/lib/dungeon";

function profileWith(over: Partial<CyberdeckProfile>): CyberdeckProfile {
  return { ...DEFAULT_CYBERDECK_PROFILE, ...over };
}

describe("firmware cost table (#2085)", () => {
  it("has four tracks of three rising tiers", () => {
    expect(FIRMWARE_UPGRADES.map((u) => u.id)).toEqual([
      "maxRamTier",
      "scanSpeedTier",
      "exploitRadiusTier",
      "startChipsTier",
    ]);
    expect(FIRMWARE_MAX_TIER).toBe(3);
    for (const upgrade of FIRMWARE_UPGRADES) {
      expect(upgrade.costs).toEqual([300, 700, 1200]);
    }
  });

  it("prices the next tier and nothing past the top", () => {
    const firmware = {
      ...DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades,
      scanSpeedTier: 2,
      startChipsTier: 3,
    };
    expect(firmwareTierCost(firmware, "maxRamTier")).toBe(300);
    expect(firmwareTierCost(firmware, "scanSpeedTier")).toBe(1200);
    expect(firmwareTierCost(firmware, "startChipsTier")).toBeNull();
  });
});

describe("purchaseFirmwareTier (#2085)", () => {
  it("spends crypto and raises the tier without changing the input", () => {
    const before = profileWith({ totalCrypto: 1000 });
    const after = purchaseFirmwareTier(before, "maxRamTier");
    expect(after?.totalCrypto).toBe(700);
    expect(after?.firmwareUpgrades.maxRamTier).toBe(1);
    expect(before.totalCrypto).toBe(1000);
    expect(before.firmwareUpgrades.maxRamTier).toBe(0);
  });

  it("refuses a tier the profile cannot afford", () => {
    expect(
      purchaseFirmwareTier(profileWith({ totalCrypto: 299 }), "maxRamTier")
    ).toBeNull();
  });

  it("refuses a track already at its top tier", () => {
    const maxed = profileWith({
      totalCrypto: 99999,
      firmwareUpgrades: {
        ...DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades,
        exploitRadiusTier: 3,
      },
    });
    expect(purchaseFirmwareTier(maxed, "exploitRadiusTier")).toBeNull();
  });

  it("buys a whole track for 2,200 crypto", () => {
    let profile: CyberdeckProfile | null = profileWith({ totalCrypto: 2200 });
    for (let i = 0; i < 3; i++) {
      profile = purchaseFirmwareTier(profile!, "startChipsTier");
    }
    expect(profile?.totalCrypto).toBe(0);
    expect(profile?.firmwareUpgrades.startChipsTier).toBe(3);
  });
});

describe("firmware effects at run start (#2085)", () => {
  const tiers = (n: number) => ({
    maxRamTier: n,
    scanSpeedTier: n,
    exploitRadiusTier: n,
    startChipsTier: n,
  });

  it("adds nothing at tier 0 and scales per tier", () => {
    expect(firmwareBonuses(tiers(0))).toEqual({
      maxRam: 0,
      hexBufferSlots: 0,
      aoeRadius: 0,
      startChips: 0,
    });
    expect(firmwareBonuses(tiers(3))).toEqual({
      maxRam: 24,
      hexBufferSlots: 3,
      aoeRadius: 1.5,
      startChips: 3,
    });
  });

  it("clamps out-of-range tiers", () => {
    expect(firmwareBonuses(tiers(9)).maxRam).toBe(24);
    expect(firmwareBonuses(tiers(-2)).startChips).toBe(0);
  });

  it("raises a class's starting RAM and chips", () => {
    const base = CYBERDECK_CLASSES.script_kiddie;
    expect(cyberdeckStartingStats("script_kiddie", tiers(0))).toEqual({
      hp: base.baseHp,
      ram: base.baseRam,
      bypassChips: base.startBypassChips,
    });
    expect(cyberdeckStartingStats("script_kiddie", tiers(2))).toEqual({
      hp: base.baseHp,
      ram: base.baseRam + 16,
      bypassChips: base.startBypassChips + 2,
    });
  });

  it("widens the hex terminal buffer", () => {
    const plain = generateHexMatrixPuzzle(2);
    const scanned = generateHexMatrixPuzzle(2, 2);
    expect(scanned.maxBufferSize).toBe(plain.maxBufferSize + 2);
  });

  it("stacks the APT Specialist's +25% radius with firmware", () => {
    const none = tiers(0);
    expect(aoeRadiusBonus("script_kiddie", none)).toBe(0);
    expect(aoeRadiusBonus("script_kiddie", tiers(2))).toBe(1);
    // 4.5 x 1.25 = 5.625 tiles.
    expect(aoeRadiusBonus("apt_specialist", none)).toBeCloseTo(
      BASE_AOE_RADIUS * 0.25
    );
    // (4.5 + 1.5) x 1.25 = 7.5 tiles.
    expect(BASE_AOE_RADIUS + aoeRadiusBonus("apt_specialist", tiers(3))).toBe(
      7.5
    );
  });

  it("widens the AoE exploit radius", () => {
    // A daemon 5 tiles away is outside the base 4.5-tile npm install blast
    // and inside it with +1 tile of Payload Amplifier.
    const enemy: Enemy = {
      id: "far",
      type: "drone",
      name: "Far Drone",
      x: 5,
      y: 0,
      hp: 999,
      maxHp: 999,
      state: "patrol",
      patrolDir: "right",
      symbol: "D",
      color: "#fff",
    };
    const fire = (bonus: number) =>
      fireWeapon(
        "npm_install",
        DEFAULT_WEAPONS,
        0,
        0,
        80,
        80,
        [enemy],
        undefined,
        0,
        999,
        bonus
      ).updatedEnemies[0].hp;
    expect(fire(0)).toBe(999);
    expect(fire(1)).toBeLessThan(999);
    // The APT Specialist's passive alone reaches the 5-tile daemon.
    expect(fire(aoeRadiusBonus("apt_specialist", tiers(0)))).toBeLessThan(999);
  });
});

describe("class milestones (#2085)", () => {
  it("opens with Script Kiddie and Cryptanalyst only", () => {
    const profile = DEFAULT_CYBERDECK_PROFILE;
    expect(isCyberdeckClassUnlocked(profile, "script_kiddie")).toBe(true);
    expect(isCyberdeckClassUnlocked(profile, "cryptanalyst")).toBe(true);
    expect(isCyberdeckClassUnlocked(profile, "apt_specialist")).toBe(false);
    expect(isCyberdeckClassUnlocked(profile, "hardware_hacker")).toBe(false);
  });

  it("names a milestone for every locked class", () => {
    expect(CLASS_UNLOCK_MILESTONES.apt_specialist?.milestone).toBe(
      "faceforge_cleared"
    );
    expect(CLASS_UNLOCK_MILESTONES.hardware_hacker?.milestone).toBe(
      "run_completed"
    );
  });

  it("unlocks the class its milestone opens, once", () => {
    const first = recordCyberdeckMilestone(
      DEFAULT_CYBERDECK_PROFILE,
      "faceforge_cleared"
    );
    expect(first.unlocked).toEqual(["apt_specialist"]);
    expect(isCyberdeckClassUnlocked(first.profile, "apt_specialist")).toBe(
      true
    );
    expect(isCyberdeckClassUnlocked(first.profile, "hardware_hacker")).toBe(
      false
    );

    const again = recordCyberdeckMilestone(first.profile, "faceforge_cleared");
    expect(again.unlocked).toEqual([]);
    expect(again.profile).toBe(first.profile);

    const run = recordCyberdeckMilestone(first.profile, "run_completed");
    expect(run.unlocked).toEqual(["hardware_hacker"]);
    expect(run.profile.unlockedClasses).toEqual([
      "script_kiddie",
      "cryptanalyst",
      "apt_specialist",
      "hardware_hacker",
    ]);
  });
});

describe("loading old and damaged profiles (#2085)", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {},
      },
    });
  });

  afterEach(() => {
    store = {};
  });

  it("starts a fresh profile with two classes", () => {
    const profile = loadCyberdeckProfile();
    expect(profile.unlockedClasses).toEqual(["script_kiddie", "cryptanalyst"]);
    expect(isCyberdeckClassUnlocked(profile, "apt_specialist")).toBe(false);
  });

  it("keeps all four classes for a save from before the locks", () => {
    // What the old code wrote: the whole default profile, two classes listed
    // but every class pickable.
    store[STORAGE_KEY_PROFILE] = JSON.stringify({
      totalCrypto: 850,
      highScore: 4200,
      runsCompleted: 3,
      unlockedClasses: ["script_kiddie", "cryptanalyst"],
      selectedClass: "script_kiddie",
      firmwareUpgrades: {
        maxRamTier: 0,
        scanSpeedTier: 0,
        exploitRadiusTier: 0,
        startChipsTier: 0,
      },
    });
    const profile = loadCyberdeckProfile();
    expect(profile.totalCrypto).toBe(850);
    expect(profile.runsCompleted).toBe(3);
    expect(profile.unlockedClasses).toEqual(Object.keys(CYBERDECK_CLASSES));
    expect(profile.firmwareUpgrades).toEqual(
      DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades
    );
    // Saved back, it stays a four-class profile.
    saveCyberdeckProfile(profile);
    expect(loadCyberdeckProfile().unlockedClasses).toHaveLength(4);
  });

  it("keeps all four classes for a minimal old save", () => {
    store[STORAGE_KEY_PROFILE] = JSON.stringify({ totalCrypto: 5 });
    expect(loadCyberdeckProfile().unlockedClasses).toHaveLength(4);
  });

  it("keeps a partial firmware record and fills the rest", () => {
    store[STORAGE_KEY_PROFILE] = JSON.stringify({
      totalCrypto: 10,
      firmwareUpgrades: { maxRamTier: 2 },
      unlockedClasses: ["hardware_hacker"],
      classUnlockRules: 1,
    });
    const profile = loadCyberdeckProfile();
    expect(profile.firmwareUpgrades).toEqual({
      maxRamTier: 2,
      scanSpeedTier: 0,
      exploitRadiusTier: 0,
      startChipsTier: 0,
    });
    expect(profile.unlockedClasses).toEqual([
      "script_kiddie",
      "cryptanalyst",
      "hardware_hacker",
    ]);
  });

  it("clamps garbage tiers, crypto and class ids", () => {
    store[STORAGE_KEY_PROFILE] = JSON.stringify({
      totalCrypto: "lots",
      firmwareUpgrades: { maxRamTier: 99, scanSpeedTier: -1 },
      unlockedClasses: ["root_kit", 7],
      classUnlockRules: 1,
    });
    const profile = loadCyberdeckProfile();
    expect(profile.totalCrypto).toBe(0);
    expect(profile.firmwareUpgrades.maxRamTier).toBe(3);
    expect(profile.firmwareUpgrades.scanSpeedTier).toBe(0);
    expect(profile.unlockedClasses).toEqual(["script_kiddie", "cryptanalyst"]);
  });

  it("round-trips a purchase and an unlock through storage", () => {
    const bought = purchaseFirmwareTier(
      profileWith({ totalCrypto: 500 }),
      "scanSpeedTier"
    )!;
    const unlocked = recordCyberdeckMilestone(bought, "run_completed").profile;
    saveCyberdeckProfile(unlocked);
    const loaded = loadCyberdeckProfile();
    expect(loaded.totalCrypto).toBe(200);
    expect(loaded.firmwareUpgrades.scanSpeedTier).toBe(1);
    expect(isCyberdeckClassUnlocked(loaded, "hardware_hacker")).toBe(true);
  });
});
