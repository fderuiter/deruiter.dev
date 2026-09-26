/**
 * Laser Loon: Quest for the State Flag
 * Type definitions for pure physics engine, narrative campaign, and UI state.
 */

export type LaserMode = "campaign" | "arcade" | "sandbox";

export type LaserType =
  "ruby-laser" | "cyan-pulse" | "aurora-wave" | "ice-cannon";

export type CivicEnemyType =
  // Act 1: Lake Minnetonka
  | "mosquito"
  | "hailstorm"
  | "jetski"
  // Act 2: State Fair Grounds
  | "butter-bomb"
  | "pronto-pup-rogue"
  | "livestock-decoy"
  // Act 3: Redesign Commission Hearings
  | "red-tape"
  | "veto-stamp"
  | "tricolor-rival"
  | "clipboard"
  // Act 4: The Capitol Dome
  | "legislative-amendment"
  | "seal-guardian"
  | "polar-vortex"
  // Bosses
  | "mega-mosquito"
  | "butter-colossus"
  | "starflake-boss"
  | "gavel-sovereign";

// Legacy alias for backwards-compatibility in engine tests
export type TargetBugType = CivicEnemyType;

export interface EnemyTemplate {
  type: CivicEnemyType;
  label: string;
  color: string;
  points: number;
  hp: number;
  radius: number;
  isBoss?: boolean;
  behavior?: "linear" | "sine" | "homing" | "bouncing" | "boss-orbit";
}

// Backwards compatibility alias
export type BugTemplate = EnemyTemplate;

export interface Target {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: CivicEnemyType;
  label: string;
  color: string;
  hp: number;
  maxHp: number;
  points: number;
  pulsePhase: number;
  frozenTimer: number; // >0 indicates target is frozen in ice
  isBoss?: boolean;
  bossPhase?: number;
  shieldAngle?: number;
  specialAttackTimer?: number;
}

export interface IceBlock {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  hp: number;
}

export type PowerUpType = "hotdish" | "pronto-pup" | "north-star";

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: PowerUpType;
  label: string;
  color: string;
  pulsePhase: number;
  durationMs: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  shape?: "circle" | "crystal" | "star" | "smoke";
  rotation?: number;
}

export interface Shockwave {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  color: string;
  alpha: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export interface LoonPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface CampaignAct {
  actNumber: number;
  title: string;
  location: string;
  newspaperHeadline: string;
  newspaperSubheader: string;
  storyIntro: string[];
  bossName: string;
  bossType: CivicEnemyType;
  bossHp: number;
  requiredMinionKills: number;
  victoryQuote: string;
  backgroundTheme: "lake" | "fair" | "hearing" | "capitol";
}

export interface FlagMuseumEntry {
  id: string;
  name: string;
  submissionCode: string;
  creator: string;
  category: "Official Submission" | "Historic Heritage" | "Civic Legend";
  description: string;
  historicalSignificance: string;
  civicImpact: string;
  flagColors: string[];
}

export interface LaserLoonState {
  mode: LaserMode;
  laserType: LaserType;
  gameState: "idle" | "playing" | "story-modal" | "gameover" | "victory";
  currentAct: number;
  actKills: number;
  score: number;
  highScore: number;
  combo: number;
  multiplier: number;
  timeLeft: number;
  gravity: number;
  ultimateMeter: number; // 0 to 100
  activePowerUp: { type: PowerUpType; remainingMs: number } | null;
  targets: Target[];
  iceBlocks: IceBlock[];
  powerUps: PowerUp[];
  particles: Particle[];
  shockwaves: Shockwave[];
  floatingTexts: FloatingText[];
  loonPos: LoonPosition;
  aimPos: { x: number; y: number };
  lastFireTime: number;
  lastComboTime: number;
  nextTargetId: number;
  nextIceId: number;
  nextPowerUpId: number;
  nextShockwaveId: number;
  nextTextId: number;
  shakeIntensity: number;
}
