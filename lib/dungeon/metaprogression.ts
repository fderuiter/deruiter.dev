/**
 * Cyberdeck Archetypes, Meta-Progression & CRT Theme Presets
 */

import {
  CRTThemeConfig,
  CRTThemeId,
  CyberdeckClass,
  CyberdeckClassId,
  CyberdeckProfile,
  DarknetItem,
} from "./types";
import { BASE_AOE_RADIUS } from "./weapons";
import { safeGetItem, safeSetRawItem } from "@/lib/safe-storage";

export const CYBERDECK_CLASSES: Record<CyberdeckClassId, CyberdeckClass> = {
  script_kiddie: {
    id: "script_kiddie",
    name: "Script Kiddie",
    role: "Rapid Infiltrator",
    description:
      "Equipped with automated exploit toolkits and hardware bypass chips for swift breaches.",
    passiveBonus: "Starts with 2 extra Bypass Chips and +15% Movement Evasion.",
    baseHp: 80,
    baseRam: 24,
    ramRegen: 3,
    startBypassChips: 2,
    starterWeapons: ["npm_install", "port_scan", "emp_blast"],
    color: "#38bdf8",
    icon: "⚡",
  },
  cryptanalyst: {
    id: "cryptanalyst",
    name: "Cryptanalyst",
    role: "Cipher Specialist",
    description:
      "Decodes encrypted mainframe keys and extracts maximum crypto bounties from breach targets.",
    passiveBonus:
      "+50% Crypto harvest from Terminals and 2x Critical Strike damage on Exposed CVEs.",
    baseHp: 100,
    baseRam: 32,
    ramRegen: 2,
    startBypassChips: 1,
    starterWeapons: ["port_scan", "zero_day", "npm_install"],
    color: "#a855f7",
    icon: "🔑",
  },
  apt_specialist: {
    id: "apt_specialist",
    name: "APT Specialist",
    role: "Advanced Persistent Threat",
    description:
      "Elite Red Team operator wielding high-tier memory corruption and packet spoofing exploits.",
    passiveBonus: "Starts with 48 GB RAM and +25% AoE Exploit Blast Radius.",
    baseHp: 110,
    baseRam: 48,
    ramRegen: 2,
    startBypassChips: 1,
    starterWeapons: ["buffer_overflow", "mitm_spoof", "port_scan"],
    color: "#ef4444",
    icon: "💀",
  },
  hardware_hacker: {
    id: "hardware_hacker",
    name: "Hardware Hacker",
    role: "Physical Jumper & EMP Titan",
    description:
      "Armored physical infiltrator with fortified cyberdeck chassis and high-yield EMP surges.",
    passiveBonus:
      "High Health (+40 Max HP) and Immune to Scrambled Controls / Glitch Lag.",
    baseHp: 140,
    baseRam: 28,
    ramRegen: 2,
    startBypassChips: 1,
    starterWeapons: ["emp_blast", "ransomware_lock", "npm_install"],
    color: "#10b981",
    icon: "🛡️",
  },
};

export const CRT_THEMES: Record<CRTThemeId, CRTThemeConfig> = {
  emerald: {
    id: "emerald",
    name: "Emerald Phosphor (VT220)",
    primaryColor: "#10b981",
    accentColor: "#34d399",
    bgDark: "#02120a",
    glowColor: "rgba(16, 185, 129, 0.4)",
    textColor: "#6ee7b7",
    scanlineAlpha: 0.15,
  },
  amber: {
    id: "amber",
    name: "Amber Hacker (IBM 3270)",
    primaryColor: "#f59e0b",
    accentColor: "#fbbf24",
    bgDark: "#150a00",
    glowColor: "rgba(245, 158, 11, 0.4)",
    textColor: "#fde68a",
    scanlineAlpha: 0.18,
  },
  matrix: {
    id: "matrix",
    name: "Matrix Rain (Kernel Terminal)",
    primaryColor: "#22c55e",
    accentColor: "#4ade80",
    bgDark: "#000803",
    glowColor: "rgba(34, 197, 94, 0.5)",
    textColor: "#86efac",
    scanlineAlpha: 0.22,
  },
};

export const DARKNET_VENDOR_CATALOG: DarknetItem[] = [
  {
    id: "ram_boost_16",
    name: "Overclocked 16GB DDR5 RAM",
    cost: 300,
    description:
      "Increases Cyberdeck RAM capacity by +16 GB for the rest of this run.",
    category: "ram",
    icon: "💾",
  },
  {
    id: "bypass_hardware_chip",
    name: "Hardware Jumper Bypass Chip",
    cost: 200,
    description:
      "Instantly solves any locked Hex Matrix terminal or security vault.",
    category: "chip",
    icon: "🔌",
  },
  {
    id: "zero_day_payload",
    name: "Airgap 0-Day Exploit Injector",
    cost: 450,
    description:
      "Grants 2 rounds of Zero-Day Piercer ammunition with firewall penetration.",
    category: "weapon",
    icon: "💥",
  },
  {
    id: "kernel_patch",
    name: "Kernel Memory Hotfix Patch",
    cost: 150,
    description: "Restores +50 HP and clears active memory leak / lag debuffs.",
    category: "heal",
    icon: "💉",
  },
  {
    id: "firmware_cve_database",
    name: "Real-Time CVE Threat Feed",
    cost: 350,
    description:
      "Exposes CVE tags on all hostile daemons now and on every room entry for the rest of the run.",
    category: "firmware",
    icon: "📡",
  },
];

export const DEFAULT_CYBERDECK_PROFILE: CyberdeckProfile = {
  totalCrypto: 0,
  highScore: 0,
  runsCompleted: 0,
  unlockedClasses: ["script_kiddie", "cryptanalyst"],
  classUnlockRules: 1,
  selectedClass: "script_kiddie",
  firmwareUpgrades: {
    maxRamTier: 0,
    scanSpeedTier: 0,
    exploitRadiusTier: 0,
    startChipsTier: 0,
  },
};

export const STORAGE_KEY_PROFILE = "retro_cyberdeck_profile";

/**
 * The one localStorage key for the Retro Labyrinth high score. The game and
 * the arcade hub both read and write it, and the manual and arcade catalogue
 * name it (#1322).
 */
export const RETRO_LABYRINTH_HIGH_SCORE_KEY = "retro_labyrinth_highscore";

/**
 * Loads the persistent Cyberdeck profile from browser storage.
 */
export function loadCyberdeckProfile(): CyberdeckProfile {
  if (typeof window === "undefined") return DEFAULT_CYBERDECK_PROFILE;
  try {
    // Stored as plain JSON.stringify output; malformed JSON comes back as a
    // string from safeGetItem and falls through to the default.
    const stored = safeGetItem<unknown>(STORAGE_KEY_PROFILE);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return DEFAULT_CYBERDECK_PROFILE;
    }
    const parsed = stored as Partial<CyberdeckProfile>;
    const merged: CyberdeckProfile = {
      ...DEFAULT_CYBERDECK_PROFILE,
      ...parsed,
      firmwareUpgrades: {
        ...DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades,
        ...(parsed.firmwareUpgrades || {}),
      },
    };
    // A save from before firmware and class milestones (#2085) may hold
    // anything in these fields; clamp them so the shop and picker can trust
    // them. A save written before classes locked keeps all four: the picker
    // used to offer every class, so returning players lose none.
    const legacySave = parsed.classUnlockRules === undefined;
    return {
      ...merged,
      totalCrypto: wholeNumber(merged.totalCrypto),
      unlockedClasses: legacySave
        ? (Object.keys(CYBERDECK_CLASSES) as CyberdeckClassId[])
        : sanitizeUnlockedClasses(merged.unlockedClasses),
      classUnlockRules: DEFAULT_CYBERDECK_PROFILE.classUnlockRules,
      firmwareUpgrades: {
        maxRamTier: clampTier(merged.firmwareUpgrades.maxRamTier),
        scanSpeedTier: clampTier(merged.firmwareUpgrades.scanSpeedTier),
        exploitRadiusTier: clampTier(merged.firmwareUpgrades.exploitRadiusTier),
        startChipsTier: clampTier(merged.firmwareUpgrades.startChipsTier),
      },
    };
  } catch {
    return DEFAULT_CYBERDECK_PROFILE;
  }
}

/**
 * Saves the persistent Cyberdeck profile to browser storage.
 */
export function saveCyberdeckProfile(profile: CyberdeckProfile): void {
  if (typeof window === "undefined") return;
  try {
    safeSetRawItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch {
    // Gracefully handle storage quota or privacy mode errors
  }
}

/**
 * One room's result, as the profile banks it.
 */
export interface CyberdeckRoomResult {
  /** Crypto earned in the room; 0 for a lost room. */
  crypto: number;
  /** The run's score when the room ended. */
  score: number;
  /** Whether this result ends the run: the last room cleared, or the run lost. */
  endsRun: boolean;
}

/**
 * Folds one room's result into the persistent Cyberdeck profile. Crypto and the
 * high score bank on every room, but `runsCompleted` counts runs, so it moves
 * only when the result ends one. It used to move on every room exit (#2048).
 *
 * Banked crypto is lifetime earnings, by design: a room banks everything it
 * earned, and spending at the in-run Market does not lower it. The Market
 * spends the run's wallet; the Firmware Bay spends the bank (#2291).
 *
 * @param profile - The profile before the room ended.
 * @param result - What the room earned, and whether the run is over.
 * @returns The updated profile; the input is not changed.
 */
export function recordCyberdeckRoomResult(
  profile: CyberdeckProfile,
  result: CyberdeckRoomResult
): CyberdeckProfile {
  return {
    ...profile,
    totalCrypto: profile.totalCrypto + Math.max(0, result.crypto),
    highScore: Math.max(profile.highScore, result.score),
    runsCompleted: profile.runsCompleted + (result.endsRun ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Firmware upgrades and class milestones (#2085)
// ---------------------------------------------------------------------------

/** One of the four firmware tracks a profile banks between runs. */
export type FirmwareUpgradeId = keyof CyberdeckProfile["firmwareUpgrades"];

/** The tiers on one firmware track, as the profile stores them. */
export type FirmwareTiers = CyberdeckProfile["firmwareUpgrades"];

/** Highest tier on every firmware track. */
export const FIRMWARE_MAX_TIER = 3;

/** A firmware track: what it is called, what each tier adds and what it costs. */
export interface FirmwareUpgrade {
  readonly id: FirmwareUpgradeId;
  readonly name: string;
  readonly icon: string;
  /** What one tier adds, for the shop row. */
  readonly perTier: string;
  /** Crypto for tier 1, 2 and 3, in order. */
  readonly costs: readonly [number, number, number];
}

/**
 * The firmware tracks in shop order. Each costs 300, 700 and 1,200 crypto,
 * 2,200 for the track and 8,800 for all twelve tiers, which is a few cleared
 * runs of banked crypto.
 */
export const FIRMWARE_UPGRADES: readonly FirmwareUpgrade[] = [
  {
    id: "maxRamTier",
    name: "RAM Expansion",
    icon: "💾",
    perTier: "+8 GB max RAM at run start",
    costs: [300, 700, 1200],
  },
  {
    id: "scanSpeedTier",
    name: "Scan Accelerator",
    icon: "📟",
    perTier: "+1 hex terminal buffer slot",
    costs: [300, 700, 1200],
  },
  {
    id: "exploitRadiusTier",
    name: "Payload Amplifier",
    icon: "💥",
    perTier: "+0.5 tile AoE exploit radius",
    costs: [300, 700, 1200],
  },
  {
    id: "startChipsTier",
    name: "Chip Fabricator",
    icon: "🔌",
    perTier: "+1 bypass chip at run start",
    costs: [300, 700, 1200],
  },
];

/** Max RAM, in GB, that each RAM Expansion tier adds. */
export const FIRMWARE_RAM_PER_TIER = 8;
/** Hex terminal buffer slots that each Scan Accelerator tier adds. */
export const FIRMWARE_BUFFER_SLOTS_PER_TIER = 1;
/** AoE radius, in tiles, that each Payload Amplifier tier adds. */
export const FIRMWARE_RADIUS_PER_TIER = 0.5;
/** Bypass chips that each Chip Fabricator tier adds at run start. */
export const FIRMWARE_CHIPS_PER_TIER = 1;

function wholeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function clampTier(value: unknown): number {
  return Math.min(FIRMWARE_MAX_TIER, wholeNumber(value));
}

function sanitizeUnlockedClasses(value: unknown): CyberdeckClassId[] {
  const stored = Array.isArray(value) ? value : [];
  return (Object.keys(CYBERDECK_CLASSES) as CyberdeckClassId[]).filter(
    (id) =>
      DEFAULT_CYBERDECK_PROFILE.unlockedClasses.includes(id) ||
      stored.includes(id)
  );
}

/**
 * The crypto the next tier of a firmware track costs.
 *
 * @param firmware - The profile's firmware tiers.
 * @param id - The track.
 * @returns The cost, or null when the track is at its top tier.
 */
export function firmwareTierCost(
  firmware: FirmwareTiers,
  id: FirmwareUpgradeId
): number | null {
  const upgrade = FIRMWARE_UPGRADES.find((u) => u.id === id);
  const tier = clampTier(firmware[id]);
  if (!upgrade || tier >= FIRMWARE_MAX_TIER) return null;
  return upgrade.costs[tier];
}

/**
 * Buys the next tier of a firmware track with banked crypto.
 *
 * @param profile - The profile before the purchase.
 * @param id - The track to raise.
 * @returns The profile with the tier raised and its cost spent, or null when
 * the track is maxed or the profile cannot afford it. The input is not changed.
 */
export function purchaseFirmwareTier(
  profile: CyberdeckProfile,
  id: FirmwareUpgradeId
): CyberdeckProfile | null {
  const cost = firmwareTierCost(profile.firmwareUpgrades, id);
  if (cost === null || profile.totalCrypto < cost) return null;
  return {
    ...profile,
    totalCrypto: profile.totalCrypto - cost,
    firmwareUpgrades: {
      ...profile.firmwareUpgrades,
      [id]: clampTier(profile.firmwareUpgrades[id]) + 1,
    },
  };
}

/** What a profile's firmware adds to a run. */
export interface FirmwareBonuses {
  /** Extra max RAM, in GB. */
  readonly maxRam: number;
  /** Extra hex terminal buffer slots. */
  readonly hexBufferSlots: number;
  /** Extra AoE exploit radius, in tiles. */
  readonly aoeRadius: number;
  /** Extra bypass chips at run start. */
  readonly startChips: number;
}

/**
 * The run bonuses a profile's firmware tiers grant.
 *
 * @param firmware - The firmware tiers in force for the run.
 * @returns What each track adds.
 */
export function firmwareBonuses(firmware: FirmwareTiers): FirmwareBonuses {
  return {
    maxRam: clampTier(firmware.maxRamTier) * FIRMWARE_RAM_PER_TIER,
    hexBufferSlots:
      clampTier(firmware.scanSpeedTier) * FIRMWARE_BUFFER_SLOTS_PER_TIER,
    aoeRadius: clampTier(firmware.exploitRadiusTier) * FIRMWARE_RADIUS_PER_TIER,
    startChips: clampTier(firmware.startChipsTier) * FIRMWARE_CHIPS_PER_TIER,
  };
}

/** A class's opening vitals once firmware is applied. */
export interface CyberdeckStartingStats {
  readonly hp: number;
  readonly ram: number;
  readonly bypassChips: number;
}

/**
 * A class's starting HP, RAM and bypass chips for a run under the given
 * firmware.
 *
 * @param classId - The Cyberdeck class.
 * @param firmware - The firmware tiers in force for the run.
 * @returns The run's opening vitals.
 */
export function cyberdeckStartingStats(
  classId: CyberdeckClassId,
  firmware: FirmwareTiers
): CyberdeckStartingStats {
  const cls = CYBERDECK_CLASSES[classId] ?? CYBERDECK_CLASSES.script_kiddie;
  const bonus = firmwareBonuses(firmware);
  return {
    hp: cls.baseHp,
    ram: cls.baseRam + bonus.maxRam,
    bypassChips: cls.startBypassChips + bonus.startChips,
  };
}

/** Something a run achieves that unlocks a class. */
export type CyberdeckMilestone = "faceforge_cleared" | "run_completed";

/** The milestone that unlocks each class not unlocked by default. */
export const CLASS_UNLOCK_MILESTONES: Readonly<
  Partial<
    Record<
      CyberdeckClassId,
      { readonly milestone: CyberdeckMilestone; readonly label: string }
    >
  >
> = {
  apt_specialist: {
    milestone: "faceforge_cleared",
    label: "Clear the FaceForge boss room",
  },
  hardware_hacker: {
    milestone: "run_completed",
    label: "Clear the NEURAL_WARDEN to finish a run",
  },
};

/**
 * Whether a profile may pick a class.
 *
 * @param profile - The profile.
 * @param classId - The class.
 * @returns True when the class is unlocked.
 */
export function isCyberdeckClassUnlocked(
  profile: CyberdeckProfile,
  classId: CyberdeckClassId
): boolean {
  return (
    DEFAULT_CYBERDECK_PROFILE.unlockedClasses.includes(classId) ||
    profile.unlockedClasses.includes(classId)
  );
}

/**
 * Records a milestone, unlocking every class it opens.
 *
 * @param profile - The profile before the milestone.
 * @param milestone - What the run achieved.
 * @returns The profile with the classes added (the input is not changed) and
 * the classes this call newly unlocked.
 */
export function recordCyberdeckMilestone(
  profile: CyberdeckProfile,
  milestone: CyberdeckMilestone
): { profile: CyberdeckProfile; unlocked: CyberdeckClassId[] } {
  const unlocked = (
    Object.keys(CLASS_UNLOCK_MILESTONES) as CyberdeckClassId[]
  ).filter(
    (id) =>
      CLASS_UNLOCK_MILESTONES[id]?.milestone === milestone &&
      !isCyberdeckClassUnlocked(profile, id)
  );
  if (unlocked.length === 0) return { profile, unlocked };
  return {
    profile: {
      ...profile,
      unlockedClasses: [...profile.unlockedClasses, ...unlocked],
    },
    unlocked,
  };
}

/**
 * How much each class scales the AoE exploit radius. The APT Specialist's
 * passive promises +25% (#2085).
 */
export const CLASS_AOE_RADIUS_MULTIPLIER: Readonly<
  Partial<Record<CyberdeckClassId, number>>
> = {
  apt_specialist: 1.25,
};

/**
 * The tiles a run adds to the AoE exploit radius: firmware first, then the
 * class multiplier on the whole radius, so the two stack.
 *
 * @param classId - The Cyberdeck class.
 * @param firmware - The firmware tiers in force for the run.
 * @returns Tiles added to the base radius.
 */
export function aoeRadiusBonus(
  classId: CyberdeckClassId,
  firmware: FirmwareTiers
): number {
  const multiplier = CLASS_AOE_RADIUS_MULTIPLIER[classId] ?? 1;
  const radius = BASE_AOE_RADIUS + firmwareBonuses(firmware).aoeRadius;
  return radius * multiplier - BASE_AOE_RADIUS;
}
