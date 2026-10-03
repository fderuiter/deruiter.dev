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
    description: "Permanently increases Cyberdeck RAM capacity by +16 GB.",
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
    return {
      ...DEFAULT_CYBERDECK_PROFILE,
      ...parsed,
      firmwareUpgrades: {
        ...DEFAULT_CYBERDECK_PROFILE.firmwareUpgrades,
        ...(parsed.firmwareUpgrades || {}),
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
