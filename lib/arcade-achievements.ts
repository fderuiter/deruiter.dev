/**
 * Arcade Achievement Registry & High Score System
 *
 * Re-exports the achievement registry and score/milestone API grouped by game
 * under `lib/arcade/achievements/` (#3489).
 */

export {
  ARCADE_TROPHIES,
  ARCADE_UNIFIED_PROGRESS_KEY,
  HALL_OF_FAME_TROPHY_COUNT,
  evaluateTrophies,
  getArcadeProgress,
  getDefaultArcadeProgress,
  parseScoreValue,
  recordArcadeMilestone,
  recordArcadeScore,
  recordRun,
  saveArcadeProgress,
  unlockArcadeTrophies,
  type ArcadeProgress,
  type ArcadeRun,
  type ArcadeTrophy,
} from "@/lib/arcade";
