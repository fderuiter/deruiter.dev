/**
 * Arcade Achievement Registry & High Score System
 *
 * Provides event-driven, client-side progress tracking, trophy definitions,
 * legacy storage key auto-migration, and SafeStorageAdapter persistence
 * for all Arcade mini-games.
 */

import {
  safeGetItem,
  safeSetItem,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { emitAppEvent } from "@/lib/event-bus";

/** Unified storage key for arcade progress envelope. */
export const ARCADE_UNIFIED_PROGRESS_KEY = "arcade_unified_progress_v1";

/** Individual game storage key map. */
export const ARCADE_STORAGE_KEYS: Record<string, string> = {
  "working-with-duck": "working_with_duck_high_score",
  "laser-loon": "laser_loon_high_score",
  "quasi-puzzler": "quasi_perfect_puzzler_progress_v1",
  "garmin-watch": "garmin_simulator_high_score",
  "clinical-chaos": "clinical_chaos_highscore",
  "trial-and-error": "trial_and_error_high_score",
  "study-director": "study_director_high_score",
  "retro-labyrinth": "retro_labyrinth_highscore",
  "meme-vault": "unlocked_meme_vault",
};

/** Legacy storage key migration mapping. */
export const ARCADE_LEGACY_KEY_MAP: Record<string, string> = {
  working_duck_high_score: "working_with_duck_high_score",
  garmin_runner_high_score: "garmin_simulator_high_score",
  clinical_chaos_high_score: "clinical_chaos_highscore",
  quasi_puzzle_high_score: "quasi_perfect_puzzler_progress_v1",
};

/** Trophy definition structure. */
export interface ArcadeTrophy {
  id: string;
  gameId: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "gameplay" | "milestone" | "mastery" | "cross_game";
  targetScore?: number;
  conditionDescription: string;
}

/** Complete Arcade Trophy Registry. */
export const ARCADE_TROPHIES: ArcadeTrophy[] = [
  // Working With Duck
  {
    id: "duck_first_sprint",
    gameId: "working-with-duck",
    title: "Deadline Met",
    subtitle: "Working With Duck",
    description: "Complete a work sprint while keeping Duck happy.",
    icon: "Bone",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Reach 100+ points in Working With Duck",
  },
  {
    id: "duck_master",
    gameId: "working-with-duck",
    title: "Puppy Whisperer",
    subtitle: "Working With Duck",
    description: "Balance deadlines and treats with elite multitasking skills.",
    icon: "Heart",
    category: "mastery",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Working With Duck",
  },

  // Laser Loon
  {
    id: "laser_loon_novice",
    gameId: "laser-loon",
    title: "Flag Defender",
    subtitle: "Laser Loon",
    description: "Blast through red tape and defend the state flag design.",
    icon: "Crosshair",
    category: "gameplay",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Laser Loon",
  },
  {
    id: "laser_loon_ace",
    gameId: "laser-loon",
    title: "Capitol Flight Ace",
    subtitle: "Laser Loon",
    description: "Master raycast optics and defeat rival flag submissions.",
    icon: "Sparkles",
    category: "mastery",
    targetScore: 2000,
    conditionDescription: "Reach 2,000+ points in Laser Loon",
  },

  // Quasi-Perfect Puzzler
  {
    id: "quasi_first_proof",
    gameId: "quasi-puzzler",
    title: "First Q.E.D.",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Apply Lean 4 tactics to complete your first AST proof.",
    icon: "Brain",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Complete at least 1 proof goal",
  },
  {
    id: "quasi_master_prover",
    gameId: "quasi-puzzler",
    title: "Formal Verifier",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Complete all formal logic proofs in the suite.",
    icon: "ShieldCheck",
    category: "mastery",
    targetScore: 500,
    conditionDescription: "Complete all 5 proof challenges",
  },

  // Garmin Watch Simulator
  {
    id: "garmin_survivor",
    gameId: "garmin-watch",
    title: "32KB RAM Survivor",
    subtitle: "Monkey C Mayhem",
    description: "Keep the watch app active without triggering an OOM crash.",
    icon: "Cpu",
    category: "gameplay",
    targetScore: 300,
    conditionDescription: "Reach 300+ points in Garmin Watch",
  },
  {
    id: "garmin_gc_master",
    gameId: "garmin-watch",
    title: "Garbage Collector",
    subtitle: "Monkey C Mayhem",
    description: "Wipe display fog and manage heap pressure like a pro.",
    icon: "Sparkles",
    category: "mastery",
    targetScore: 1000,
    conditionDescription: "Reach 1,000+ points in Garmin Watch",
  },

  // Clinical Trial Chaos
  {
    id: "clinical_auditor_pass",
    gameId: "clinical-chaos",
    title: "Clean FDA Audit",
    subtitle: "Clinical Trial Chaos",
    description: "Sort SDTM domain tables and pass audit inspection.",
    icon: "ClipboardCheck",
    category: "gameplay",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Clinical Trial Chaos",
  },
  {
    id: "clinical_cdisc_pro",
    gameId: "clinical-chaos",
    title: "CDISC Champion",
    subtitle: "Clinical Trial Chaos",
    description:
      "Maintain maximum throughput under extreme regulatory pressure.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 2000,
    conditionDescription: "Reach 2,000+ points in Clinical Trial Chaos",
  },

  // Trial & Error
  {
    id: "trial_error_first_blind",
    gameId: "trial-and-error",
    title: "Blind Cleared",
    subtitle: "Trial & Error",
    description: "Play Chips x Mult hands to satisfy the SAP review blind.",
    icon: "Cards",
    category: "gameplay",
    targetScore: 200,
    conditionDescription: "Reach 200+ points in Trial & Error",
  },
  {
    id: "trial_error_csr_lock",
    gameId: "trial-and-error",
    title: "CSR Lock Mastery",
    subtitle: "Trial & Error",
    description: "Guide a candidate compound through all trial phases to lock.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 1000,
    conditionDescription: "Reach 1,000+ points in Trial & Error",
  },

  // Study Director
  {
    id: "study_director_kickoff",
    gameId: "study-director",
    title: "Study Kickoff",
    subtitle: "Study Director",
    description: "Allocate daily attention points to keep sites operational.",
    icon: "ClipboardCheck",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Reach 100+ points in Study Director",
  },
  {
    id: "study_director_closeout",
    gameId: "study-director",
    title: "FDA Replay Approved",
    subtitle: "Study Director",
    description:
      "Complete study closeout with zero unmanaged documentation debt.",
    icon: "ShieldCheck",
    category: "mastery",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Study Director",
  },

  // Retro Labyrinth
  {
    id: "retro_labyrinth_crawler",
    gameId: "retro-labyrinth",
    title: "Dungeon Crawler",
    subtitle: "Retro Labyrinth",
    description: "Navigate shifting maze walls and defeat legacy code bugs.",
    icon: "DeviceGamepad2",
    category: "gameplay",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Retro Labyrinth",
  },
  {
    id: "retro_labyrinth_boss",
    gameId: "retro-labyrinth",
    title: "FaceForge Slayer",
    subtitle: "Retro Labyrinth",
    description:
      "Vanquish the 3D Wireframe Normal Boss at the end of the dungeon.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 2000,
    conditionDescription: "Reach 2,000+ points in Retro Labyrinth",
  },

  // Meme Vault
  {
    id: "meme_vault_explorer",
    gameId: "meme-vault",
    title: "Soundboard Operator",
    subtitle: "Meme Vault",
    description:
      "Trigger soundbites and discover easter eggs in the Meme Vault.",
    icon: "Sparkles",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Unlock easter eggs in Meme Vault",
  },

  // Cross-Game Meta Achievements
  {
    id: "arcade_triathlon",
    gameId: "cross_game",
    title: "Arcade Triathlete",
    subtitle: "Portfolio Meta",
    description: "Score personal bests in at least 3 distinct mini-games.",
    icon: "Trophy",
    category: "cross_game",
    conditionDescription: "Score in 3 or more games",
  },
  {
    id: "arcade_completionist",
    gameId: "cross_game",
    title: "Portfolio Veteran",
    subtitle: "Portfolio Meta",
    description: "Participate and set high scores in 6 or more mini-games.",
    icon: "Trophy",
    category: "cross_game",
    conditionDescription: "Score in 6 or more games",
  },
  {
    id: "arcade_legend",
    gameId: "cross_game",
    title: "Hall of Famer",
    subtitle: "Portfolio Meta",
    description:
      "Accumulate a total cumulative score of 5,000+ across all games.",
    icon: "Sparkles",
    category: "cross_game",
    conditionDescription: "Earn 5,000+ total cumulative score",
  },
];

/** Persistent Arcade Progress Schema. */
export interface ArcadeProgress {
  /** Map of gameId -> best numeric score recorded */
  highScores: Record<string, number>;
  /** Map of trophyId -> timestamp unlocked */
  unlockedTrophies: Record<string, number>;
  /** Timestamp of last update */
  updatedAt: number;
}

/** Returns default initial arcade progress object. */
export function getDefaultArcadeProgress(): ArcadeProgress {
  return {
    highScores: {},
    unlockedTrophies: {},
    updatedAt: Date.now(),
  };
}

/**
 * Parses a raw storage value into a clean number.
 */
export function parseScoreValue(
  raw: string | null | number | undefined
): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;

  try {
    const trimmed = raw.trim();
    // Handles raw numeric string e.g. "1250"
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    // Handles JSON envelope or complex progress object
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "number") return parsed;
    if (parsed && typeof parsed.value === "number") return parsed.value;
    if (parsed && typeof parsed.score === "number") return parsed.score;
    if (parsed && parsed.completedLevels) {
      // Quasi-puzzler format
      return Object.keys(parsed.completedLevels).length * 100;
    }
    if (Array.isArray(parsed)) {
      // Meme Vault unlocked array format
      return parsed.length * 100;
    }
  } catch {
    // Return 0 if non-parsable
  }

  return 0;
}

/**
 * Automatically migrates legacy storage keys to standardized keys.
 */
export function migrateLegacyArcadeScores(progress: ArcadeProgress): boolean {
  if (typeof window === "undefined") return false;
  let migrated = false;

  // 1. Check direct legacy keys mapped in ARCADE_LEGACY_KEY_MAP
  for (const [legacyKey, standardKey] of Object.entries(
    ARCADE_LEGACY_KEY_MAP
  )) {
    const legacyRaw = safeGetRawItem(legacyKey);
    if (legacyRaw) {
      const legacyScore = parseScoreValue(legacyRaw);
      const gameId = Object.keys(ARCADE_STORAGE_KEYS).find(
        (id) => ARCADE_STORAGE_KEYS[id] === standardKey
      );

      if (gameId && legacyScore > (progress.highScores[gameId] || 0)) {
        progress.highScores[gameId] = legacyScore;
        migrated = true;
      }

      // Sync to standard storage key as raw string
      const currentStandardRaw = safeGetRawItem(standardKey);
      if (
        !currentStandardRaw ||
        parseScoreValue(currentStandardRaw) < legacyScore
      ) {
        safeSetRawItem(standardKey, legacyScore.toString());
      }
    }
  }

  // 2. Scan all standard storage keys to populate missing values into progress
  for (const [gameId, storageKey] of Object.entries(ARCADE_STORAGE_KEYS)) {
    const rawVal = safeGetRawItem(storageKey);
    if (rawVal) {
      const val = parseScoreValue(rawVal);
      if (val > (progress.highScores[gameId] || 0)) {
        progress.highScores[gameId] = val;
        migrated = true;
      }
    }
  }

  return migrated;
}

/**
 * Reads the current Arcade progress from SafeStorage.
 */
export function getArcadeProgress(): ArcadeProgress {
  const fallback = getDefaultArcadeProgress();
  if (typeof window === "undefined") return fallback;

  let progress = safeGetItem<ArcadeProgress>(
    ARCADE_UNIFIED_PROGRESS_KEY,
    fallback
  );

  if (!progress || typeof progress !== "object" || !progress.highScores) {
    progress = fallback;
  }

  // Auto-migrate legacy keys if necessary
  const didMigrate = migrateLegacyArcadeScores(progress);
  if (didMigrate) {
    progress.updatedAt = Date.now();
    safeSetItem(ARCADE_UNIFIED_PROGRESS_KEY, progress);
  }

  return progress;
}

/**
 * Saves Arcade progress to SafeStorage using envelope format.
 */
export function saveArcadeProgress(progress: ArcadeProgress): boolean {
  if (typeof window === "undefined") return false;
  progress.updatedAt = Date.now();
  return safeSetItem(ARCADE_UNIFIED_PROGRESS_KEY, progress);
}

/**
 * Evaluates and unlocks any earned trophies based on current high scores.
 */
export function evaluateTrophies(progress: ArcadeProgress): ArcadeTrophy[] {
  const newlyUnlocked: ArcadeTrophy[] = [];
  const now = Date.now();

  const totalScore = Object.values(progress.highScores).reduce(
    (sum, val) => sum + val,
    0
  );
  const gamesPlayedCount = Object.values(progress.highScores).filter(
    (val) => val > 0
  ).length;

  for (const trophy of ARCADE_TROPHIES) {
    if (progress.unlockedTrophies[trophy.id]) {
      continue; // Already unlocked
    }

    let isUnlocked = false;

    if (trophy.category === "cross_game") {
      if (trophy.id === "arcade_triathlon" && gamesPlayedCount >= 3) {
        isUnlocked = true;
      } else if (
        trophy.id === "arcade_completionist" &&
        gamesPlayedCount >= 6
      ) {
        isUnlocked = true;
      } else if (trophy.id === "arcade_legend" && totalScore >= 5000) {
        isUnlocked = true;
      }
    } else {
      const gameScore = progress.highScores[trophy.gameId] || 0;
      if (trophy.targetScore && gameScore >= trophy.targetScore) {
        isUnlocked = true;
      }
    }

    if (isUnlocked) {
      progress.unlockedTrophies[trophy.id] = now;
      newlyUnlocked.push(trophy);
    }
  }

  return newlyUnlocked;
}

/**
 * Core function to record an arcade score, update storage, evaluate achievements,
 * and dispatch typed event-bus events.
 */
export function recordArcadeScore(
  gameId: string,
  score: number,
  metadata?: Record<string, unknown>
): { progress: ArcadeProgress; newlyUnlocked: ArcadeTrophy[] } {
  const progress = getArcadeProgress();
  const currentBest = progress.highScores[gameId] || 0;
  const isNewBest = score > currentBest;

  if (isNewBest) {
    progress.highScores[gameId] = score;

    // Sync individual game storage key
    const storageKey = ARCADE_STORAGE_KEYS[gameId];
    if (storageKey) {
      safeSetRawItem(storageKey, score.toString());
    }
  }

  // Check trophy unlock conditions
  const newlyUnlocked = evaluateTrophies(progress);

  // Save progress
  saveArcadeProgress(progress);

  // Emit App Event for score update
  emitAppEvent("arcade_score_updated", { gameId, score, metadata });

  // Emit App Events for unlocked trophies
  for (const trophy of newlyUnlocked) {
    emitAppEvent("arcade_trophy_unlocked", {
      trophyId: trophy.id,
      gameId: trophy.gameId,
      title: trophy.title,
      unlockedAt: progress.unlockedTrophies[trophy.id] || Date.now(),
    });
  }

  return { progress, newlyUnlocked };
}
