/**
 * Types & Domain Models for the Roguelike Repository Graveyard & Cyberpunk Netrunner Crawler
 */

export type TileType =
  "#" | " " | "E" | "D" | "T" | "B" | "S" | "W" | "@" | "H" | "V";

export type RoomThemeId =
  | "classic_1"
  | "classic_2"
  | "tsp"
  | "faceforge"
  | "blinkbrowse"
  | "billable_hours"
  | "dmz_gateway"
  | "active_directory"
  | "zero_trust_core"
  | "darknet_vault"
  | "neural_warden";

export interface ThemedRoomMeta {
  id: RoomThemeId;
  name: string;
  repo: string;
  description: string;
  mechanic: string;
  badge: string;
  boss?: boolean;
}

export type CVEType =
  | "WEAK_SSH"
  | "BUFFER_OVERFLOW"
  | "DEFAULT_CREDS"
  | "ZERO_DAY"
  | "OUTDATED_TLS"
  | "UNAUTHENTICATED_RCE";

export type WeaponId =
  | "npm_install"
  | "git_force_push"
  | "stack_overflow"
  | "emp_blast"
  | "port_scan"
  | "buffer_overflow"
  | "zero_day"
  | "mitm_spoof"
  | "ransomware_lock";

export interface Weapon {
  id: WeaponId;
  name: string;
  keyLabel: string;
  ammo: number;
  maxAmmo: number;
  damage: number;
  cooldownMs: number;
  description: string;
  sideEffect: string;
  iconChar: string;
  ramCost?: number;
  cveSynergy?: CVEType;
}

export type ItemId =
  | "coffee"
  | "node_modules"
  | "todo_shield"
  | "commit_token"
  | "hotfix_key"
  | "git_stash"
  | "ram_expansion"
  | "zero_day_payload"
  | "bypass_chip"
  | "crypto_stash"
  | "firmware_patch";

export interface ItemPickup {
  id: string;
  itemId: ItemId;
  name: string;
  x: number;
  y: number;
  symbol: string;
  color: string;
  collected: boolean;
}

export type EnemyType =
  | "zombie"
  | "drone"
  | "slime"
  | "boss_face"
  | "mesh_projectile"
  | "sentinel_daemon"
  | "kerberos_warden"
  | "kernel_titan"
  | "neural_warden";

export type EnemyState =
  "patrol" | "chase" | "attack" | "stunned" | "confused" | "frozen";

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  patrolDir: "left" | "right" | "up" | "down";
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  stunTimerMs?: number;
  symbol: string;
  color: string;
  name: string;
  lastAttackMs?: number;
  speedMs?: number;
  cve?: CVEType;
  cveExposed?: boolean;
  confusedMs?: number;
  frozenMs?: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Edge3D {
  p1: number;
  p2: number;
}

export interface WireframeMesh {
  vertices: Vec3[];
  edges: Edge3D[];
  rotation: Vec3;
  rotSpeed: Vec3;
  color: string;
  scale: number;
}

export interface BossState {
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  x: number; // grid coords
  y: number;
  mesh: WireframeMesh;
  projectiles: MeshProjectile[];
  lastSalvoTime: number;
  attackIntervalMs: number;
  defeated: boolean;
  name: string;
  shieldActive?: boolean;
  phaseTitle?: string;
}

export interface MeshProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mesh: WireframeMesh;
  damage: number;
  alive: boolean;
}

export interface ActiveSideEffect {
  type:
    | "lag_spike"
    | "scrambled_keys"
    | "history_rewritten"
    | "cursor_drift"
    | "memory_leak";
  title: string;
  description: string;
  expiresAt: number;
}

export interface TSPNode {
  id: number;
  x: number;
  y: number;
  visited: boolean;
}

export interface TSPMovingWall {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  active: boolean;
}

export interface DungeonRoom {
  id: RoomThemeId;
  index: number;
  title: string;
  repo: string;
  mechanic: string;
  badge: string;
  width: number;
  height: number;
  grid: string[][];
  startX: number;
  startY: number;
  exitX: number;
  exitY: number;
  enemies: Enemy[];
  items: ItemPickup[];
  boss?: BossState;
  tspNodes?: TSPNode[];
  tspMovingWalls?: TSPMovingWall[];
  chestOpened?: boolean;
  securityTier?: number;
  hasTerminal?: boolean;
  terminalHacked?: boolean;
  darknetVendor?: boolean;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  radius: number;
  char?: string;
}

export interface FloatingNotification {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

// ----------------------------------------------------
// Cybersecurity Hacking Minigame Models
// ----------------------------------------------------

export interface HexCell {
  row: number;
  col: number;
  byte: string;
  selected: boolean;
}

export interface HexMatrixPuzzle {
  grid: HexCell[][];
  targetSequence: string[];
  currentInput: string[];
  maxBufferSize: number;
  timeRemainingSeconds: number;
  activeAxis: "row" | "col";
  activeIndex: number;
  solved: boolean;
  failed: boolean;
  rewardCrypto: number;
  rewardBypassChips: number;
}

// ----------------------------------------------------
// Cyberdeck Archetypes & Meta-Progression Models
// ----------------------------------------------------

export type CyberdeckClassId =
  "script_kiddie" | "cryptanalyst" | "apt_specialist" | "hardware_hacker";

export interface CyberdeckClass {
  id: CyberdeckClassId;
  name: string;
  role: string;
  description: string;
  passiveBonus: string;
  baseHp: number;
  baseRam: number;
  ramRegen: number;
  startBypassChips: number;
  starterWeapons: WeaponId[];
  color: string;
  icon: string;
}

export interface CyberdeckProfile {
  totalCrypto: number;
  highScore: number;
  runsCompleted: number;
  unlockedClasses: CyberdeckClassId[];
  selectedClass: CyberdeckClassId;
  firmwareUpgrades: {
    maxRamTier: number;
    scanSpeedTier: number;
    exploitRadiusTier: number;
    startChipsTier: number;
  };
}

export interface DarknetItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  category: "ram" | "weapon" | "chip" | "heal" | "firmware";
  icon: string;
}

/**
 * Phosphor themes for the board. Emerald is the default; synthwave pink was
 * dropped in #1522 (AGENTS.md section 20 rules out purple and pink on dark).
 */
export type CRTThemeId = "emerald" | "amber" | "matrix";

export interface CRTThemeConfig {
  id: CRTThemeId;
  name: string;
  primaryColor: string;
  accentColor: string;
  bgDark: string;
  glowColor: string;
  textColor: string;
  scanlineAlpha: number;
}
