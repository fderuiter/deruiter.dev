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
  "patty-drive-thru": "patty_drive_thru_high_score",
  "for-better-or-bulk": "for_better_or_bulk_high_score",
  "protocol-drift": "protocol_drift_high_score",
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
  /**
   * A named moment in play (an act cleared, every level proven) that unlocks
   * this trophy through recordArcadeMilestone. A trophy with a milestone and
   * no targetScore unlocks only from play, never from a score (#2047).
   */
  milestone?: string;
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
  {
    id: "duck_graduate",
    gameId: "working-with-duck",
    title: "Good Boy Graduate",
    subtitle: "Working With Duck",
    description: "Ship all five sprints with Duck still on the Good Boy list.",
    icon: "Trophy",
    category: "mastery",
    milestone: "campaign_cleared",
    conditionDescription: "Clear sprint 5 in Working With Duck",
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
  {
    id: "laser_loon_flawless_act",
    gameId: "laser-loon",
    title: "Untouched Plumage",
    subtitle: "Laser Loon",
    description: "Clear a campaign act without losing a single hit.",
    icon: "Heart",
    category: "gameplay",
    milestone: "act_no_hit",
    conditionDescription: "Clear a Laser Loon act without taking a hit",
  },
  {
    id: "laser_loon_campaign",
    gameId: "laser-loon",
    title: "Veto Overridden",
    subtitle: "Laser Loon",
    description: "Beat all four acts and their bosses in one campaign.",
    icon: "Trophy",
    category: "mastery",
    milestone: "campaign_cleared",
    conditionDescription: "Win the Laser Loon campaign",
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
    description: "Prove every Act 1 level honestly, with no sorry.",
    icon: "ShieldCheck",
    category: "mastery",
    milestone: "all_levels_proven",
    conditionDescription: "Prove all 18 Act 1 levels",
  },
  {
    id: "quasi_all_gold",
    gameId: "quasi-puzzler",
    title: "Golden Lemma",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Earn three stars on every Act 1 level.",
    icon: "Sparkles",
    category: "mastery",
    milestone: "all_gold",
    conditionDescription: "Earn gold (3 stars) on all 18 Act 1 levels",
  },

  // Garmin Watch Simulator
  {
    id: "garmin_survivor",
    gameId: "garmin-watch",
    title: "First Split",
    subtitle: "Monkey C Mayhem",
    description: "Reach the finish pole of a 1 km stage.",
    icon: "Cpu",
    category: "gameplay",
    milestone: "stage_cleared",
    conditionDescription: "Clear a stage in Monkey C Mayhem",
  },
  {
    id: "garmin_gc_master",
    gameId: "garmin-watch",
    title: "5K Finisher",
    subtitle: "Monkey C Mayhem",
    description: "Run all five stages and cross the 5K finish line.",
    icon: "Sparkles",
    category: "mastery",
    milestone: "run_complete",
    conditionDescription: "Finish the 5K in Monkey C Mayhem",
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
  {
    id: "clinical_nai_campaign",
    gameId: "clinical-chaos",
    title: "No Action Indicated",
    subtitle: "Clinical Trial Chaos",
    description: "Finish the Phase 3 campaign with an NAI inspection verdict.",
    icon: "ShieldCheck",
    category: "mastery",
    milestone: "nai_campaign",
    conditionDescription:
      "Earn an NAI verdict on Phase 3 in Clinical Trial Chaos",
  },
  {
    id: "clinical_clean_inspection",
    gameId: "clinical-chaos",
    title: "Nothing to Hide",
    subtitle: "Clinical Trial Chaos",
    description:
      "Answer every question in the campaign-finale FDA inspection from your own audit trail, and disclose every sponsor shortcut.",
    icon: "ClipboardCheck",
    category: "mastery",
    milestone: "clean_inspection",
    conditionDescription:
      "Pass the Phase 3 FDA inspection interview without a wrong answer in Clinical Trial Chaos",
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
    milestone: "blind_cleared",
    conditionDescription: "Clear a Blind in Trial & Error",
  },
  {
    id: "trial_error_csr_lock",
    gameId: "trial-and-error",
    title: "CSR Lock Mastery",
    subtitle: "Trial & Error",
    description: "Guide a candidate compound through all trial phases to lock.",
    icon: "Trophy",
    category: "mastery",
    milestone: "run_won",
    conditionDescription: "Win a Trial & Error run at CSR Lock",
  },
  {
    id: "trial_error_act_cleared",
    gameId: "trial-and-error",
    title: "Committee Survived",
    subtitle: "Trial & Error",
    description: "Beat an act's boss Blind and move the study to the next act.",
    icon: "ClipboardCheck",
    category: "gameplay",
    milestone: "act_cleared",
    conditionDescription: "Clear an act's boss Blind in Trial & Error",
  },

  // Study Director
  {
    id: "study_director_kickoff",
    gameId: "study-director",
    title: "Study Kickoff",
    subtitle: "Study Director",
    description:
      "Get through your first weeks: answer the inbox, walk the floor and keep the sites running.",
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
  {
    id: "study_director_grade_a",
    gameId: "study-director",
    title: "Inspection Ready",
    subtitle: "Study Director",
    description: "Close out a study with an A regulatory grade.",
    icon: "Trophy",
    category: "mastery",
    milestone: "grade_a",
    conditionDescription: "Finish a Study Director study with grade A",
  },

  // Patty's Drive-Thru
  {
    id: "patty_drive_thru_first_rush",
    gameId: "patty-drive-thru",
    title: "First Rush",
    subtitle: "Patty's Drive-Thru",
    description: "Keep the line moving with fast, clean orders for one shift.",
    icon: "Headset",
    category: "gameplay",
    targetScore: 400,
    conditionDescription: "Reach 400+ points in Patty's Drive-Thru",
  },
  {
    id: "patty_drive_thru_close",
    gameId: "patty-drive-thru",
    title: "Made It to Close",
    subtitle: "Patty's Drive-Thru",
    description:
      "Work a full shift with most of the board still green when you clock out.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 700,
    conditionDescription: "Reach 700+ points in Patty's Drive-Thru",
  },
  {
    id: "patty_drive_thru_zero_late",
    gameId: "patty-drive-thru",
    title: "Nobody Waited",
    subtitle: "Patty's Drive-Thru",
    description: "Make it to close on a standard shift with zero late orders.",
    icon: "Headset",
    category: "mastery",
    milestone: "zero_late_shift",
    conditionDescription: "Close a standard shift with no late orders",
  },
  {
    id: "patty_drive_thru_full_week",
    gameId: "patty-drive-thru",
    title: "Worked a Full Week",
    subtitle: "Patty's Drive-Thru",
    description:
      "Clock in Monday through Fry Friday and work all five days of a week.",
    icon: "Headset",
    category: "milestone",
    milestone: "full_week",
    conditionDescription: "Finish all five days of a Patty's Drive-Thru week",
  },

  // For Better or Bulk
  {
    id: "for_better_or_bulk_setup_crew",
    gameId: "for-better-or-bulk",
    title: "Setup Crew",
    subtitle: "For Better or Bulk",
    description: "Place a dozen things around the venue before 4:00.",
    icon: "Rings",
    category: "gameplay",
    targetScore: 12,
    conditionDescription: "Place 12+ things in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_everything",
    gameId: "for-better-or-bulk",
    title: "Bought Out the Roses",
    subtitle: "For Better or Bulk",
    description:
      "Buy every rose and place all 27 things the biggest plan asks for: bouquets, centerpieces, petals, chairs, lanterns and the buffet.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 27,
    conditionDescription: "Place 27 things in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_three_stars",
    gameId: "for-better-or-bulk",
    title: "Three for Three",
    subtitle: "For Better or Bulk",
    description:
      "Meet all three game challenges on a finished run of the standard day.",
    icon: "Sparkles",
    category: "mastery",
    conditionDescription:
      "Meet all three game challenges on a standard-day run in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_perfect_day",
    gameId: "for-better-or-bulk",
    title: "A Perfect Day",
    subtitle: "For Better or Bulk",
    description:
      "Meet all three game challenges on a seeded day, the one the whole day shares.",
    icon: "Trophy",
    category: "mastery",
    conditionDescription:
      "Meet all three game challenges on a seeded day in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_nothing_burnt",
    gameId: "for-better-or-bulk",
    title: "Nothing Burnt",
    subtitle: "For Better or Bulk",
    description: "Finish every setup task with no batch burnt on the grill.",
    icon: "Heart",
    category: "gameplay",
    conditionDescription:
      "Finish every setup task with no burnt batches in For Better or Bulk",
  },

  // Protocol Drift
  {
    id: "protocol_drift_locked",
    gameId: "protocol-drift",
    title: "Database Locked",
    subtitle: "Protocol Drift",
    description: "Clear both Database Lock gates for Study PD-101.",
    icon: "ShieldCheck",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Lock the Protocol Drift database",
  },
  {
    id: "protocol_drift_defensible",
    gameId: "protocol-drift",
    title: "Defensible Lock",
    subtitle: "Protocol Drift",
    description:
      "Lock the database and earn all three preventative badges without fabricating data.",
    icon: "Trophy",
    category: "mastery",
    // A milestone since #2054: efficiency points can pass the old 400 mark
    // without all three badges.
    milestone: "all_badges",
    conditionDescription:
      "Earn every Protocol Drift preventative badge at lock",
  },
  {
    id: "protocol_drift_lean_lock",
    gameId: "protocol-drift",
    title: "Lean Pipeline",
    subtitle: "Protocol Drift",
    description:
      "Lock the database with a live pipeline at or under the par chip count.",
    icon: "Cpu",
    category: "milestone",
    milestone: "lock_under_par_chips",
    conditionDescription: "Lock Protocol Drift with no more chips than par",
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
  {
    id: "meme_vault_cleared",
    gameId: "meme-vault",
    title: "Vault Cleared",
    subtitle: "Meme Vault",
    description: "Find all six hidden trophies in and around the Meme Vault.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 600,
    conditionDescription: "Find all 6 Meme Vault easter eggs",
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
    description: "Unlock 15 game trophies across the arcade.",
    icon: "Sparkles",
    category: "cross_game",
    conditionDescription: "Unlock 15 game trophies",
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
      // Quasi-puzzler format: only honest proofs score. A level closed with
      // `sorry` is saved with usedSorry and zero stars (#1939).
      const levels: unknown[] = Object.values(parsed.completedLevels);
      const proven = levels.filter((lvl) => {
        if (!lvl) return false;
        if (typeof lvl !== "object") return true;
        const score = lvl as { usedSorry?: unknown; stars?: unknown };
        return score.usedSorry !== true && score.stars !== 0;
      });
      return proven.length * 100;
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

let cachedProgress: ArcadeProgress | null = null;
let cachedProgressHash: string = "";

function getStorageHash(): string {
  if (typeof window === "undefined") return "";
  const unifiedRaw = safeGetRawItem(ARCADE_UNIFIED_PROGRESS_KEY) || "";
  let individualScores = "";
  for (const key of Object.values(ARCADE_STORAGE_KEYS)) {
    individualScores += `${key}:${safeGetRawItem(key) || ""};`;
  }
  return `${unifiedRaw}|${individualScores}`;
}

/**
 * Reads the current Arcade progress from SafeStorage.
 */
export function getArcadeProgress(): ArcadeProgress {
  const fallback = getDefaultArcadeProgress();
  if (typeof window === "undefined") return fallback;

  const currentHash = getStorageHash();

  if (cachedProgress && cachedProgressHash === currentHash) {
    return cachedProgress;
  }

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

  cachedProgress = progress;
  cachedProgressHash = getStorageHash();

  return progress;
}

/**
 * Saves Arcade progress to SafeStorage using envelope format.
 */
export function saveArcadeProgress(progress: ArcadeProgress): boolean {
  if (typeof window === "undefined") return false;
  progress.updatedAt = Date.now();
  const ok = safeSetItem(ARCADE_UNIFIED_PROGRESS_KEY, progress);
  cachedProgress = progress;
  cachedProgressHash = getStorageHash();
  return ok;
}

/** Game trophies (not cross-game ones) Hall of Famer counts toward. */
export const HALL_OF_FAME_TROPHY_COUNT = 15;

/**
 * Evaluates and unlocks any earned trophies based on current high scores.
 */
export function evaluateTrophies(progress: ArcadeProgress): ArcadeTrophy[] {
  const newlyUnlocked: ArcadeTrophy[] = [];
  const now = Date.now();

  const gamesPlayedCount = Object.values(progress.highScores).filter(
    (val) => val > 0
  ).length;

  // Scores differ wildly between games (a Trial & Error hand is worth
  // thousands, a For Better or Bulk day about 20), so the meta trophy counts
  // trophies instead of summing scores (#2047).
  // Counted when reached, after this pass's game trophies (listed first).
  const gameTrophyCount = () =>
    ARCADE_TROPHIES.filter(
      (t) => t.category !== "cross_game" && progress.unlockedTrophies[t.id]
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
      } else if (
        trophy.id === "arcade_legend" &&
        gameTrophyCount() >= HALL_OF_FAME_TROPHY_COUNT
      ) {
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
 * Unlocks named trophies a game awards from a finished run rather than from a
 * score. A trophy already unlocked keeps its first timestamp, and only the
 * newly unlocked ones are returned and announced.
 */
export function unlockArcadeTrophies(
  trophyIds: readonly string[]
): ArcadeTrophy[] {
  const progress = getArcadeProgress();
  const now = Date.now();
  const newlyUnlocked: ArcadeTrophy[] = [];
  for (const trophy of ARCADE_TROPHIES) {
    if (
      !trophyIds.includes(trophy.id) ||
      progress.unlockedTrophies[trophy.id]
    ) {
      continue;
    }
    progress.unlockedTrophies[trophy.id] = now;
    newlyUnlocked.push(trophy);
  }
  if (newlyUnlocked.length === 0) return newlyUnlocked;
  // A named trophy can tip a cross-game count over its line.
  newlyUnlocked.push(...evaluateTrophies(progress));
  saveArcadeProgress(progress);
  for (const trophy of newlyUnlocked) {
    emitAppEvent("arcade_trophy_unlocked", {
      trophyId: trophy.id,
      gameId: trophy.gameId,
      title: trophy.title,
      unlockedAt: now,
    });
  }
  return newlyUnlocked;
}

/**
 * Records a named moment in a game's play (an act cleared, every level
 * proven) and unlocks the trophies that game ties to it. Unknown milestones
 * unlock nothing, so a game can fire them before a trophy exists (#2047).
 */
export function recordArcadeMilestone(
  gameId: string,
  milestone: string
): ArcadeTrophy[] {
  const ids = ARCADE_TROPHIES.filter(
    (t) => t.gameId === gameId && t.milestone === milestone
  ).map((t) => t.id);
  return ids.length > 0 ? unlockArcadeTrophies(ids) : [];
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
