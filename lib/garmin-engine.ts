/**
 * Garmin Connect IQ (Monkey C) Game Simulation Engine
 * Handles physics, memory allocation lifecycle, GC mechanics,
 * thermal overheating, crash reports, and 16-color pixel canvas rendering.
 */
import type { PlanRun } from "./garmin-plan";
import type { RaceSetup } from "./garmin-race";
import { clamp } from "./game-utils";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  KUDOS_RADIUS,
  POLE_HEIGHT,
  PX_PER_METER,
  STAGE_COUNT,
  appendCourse,
  generateStage,
  isFootingOverGap,
  isOverGap,
  poleBonus,
  pruneCourse,
  courseRandom,
  stageStartX,
  type CourseCheckpoint,
  type CourseLayout,
  type CourseMedal,
  type CourseMedBall,
  type CoursePole,
} from "./garmin-course";
import {
  BONUS_ROOM_LENGTH,
  EMPTY_PROPS,
  PR_BOARD_SCORE,
  REST_DAY_MS,
  SWITCH_WIDTH,
  appendProps,
  beltOffset,
  generateBonusRoom,
  generateStageProps,
  plyoLaunchVy,
  propFootings,
  pruneProps,
  restDaySwap,
  stationUnderFeet,
  wallAhead,
  type CourseProps,
  type CourseStation,
  type PropFooting,
} from "./garmin-props";
import {
  CHECKPOINT_BANNER,
  CHECKPOINT_TOAST,
  MEDAL_SCORE,
  MEDALS_PER_STAGE,
  ROOM_MEDAL_DX,
  ROOM_MEDAL_RISE,
  SECRET_EXIT_BANNER,
  SECRET_POLE_INSET,
  hideFoundMedals,
  medalHit,
  medalStage,
  placeStageExtras,
  stageMedalCount,
} from "./garmin-medals";
import { beatsBest, formatClock, splitToast } from "./garmin-splits";
import {
  SUIT_GRAVITY_SCALE,
  SUIT_LAND_JUMP_VY,
  SUIT_STROKE_MS,
  SUIT_STROKE_VY,
  SUIT_SWIM_PACE,
  SWIM_GRAVITY,
  SWIM_PACE,
  WADE_PACE_SCALE,
  SWIM_SINK_MAX,
  SWIM_STROKE_MS,
  SWIM_STROKE_VY,
  SWIM_SURFACE_Y,
  currentFlow,
  isUnderwater,
} from "./garmin-swim";
import { isWaterTheme, themeForStage } from "./garmin-themes";
import {
  SECOND_WIND_EVENTS,
  SECOND_WIND_GOAL_TOAST,
  hillSpeedScale,
  startSecondWind,
  stepSecondWind,
  windGravityScale,
  type SecondWind,
  type SecondWindTick,
} from "./garmin-second-wind";
import {
  MOVE_TOASTS,
  SLAM_BATTERY_COST,
  SLAM_REACH,
  SLAM_VY,
  SPIN_GRAVITY,
  SPIN_JUMP_VY,
  SPIN_MAX_FALL,
  WALL_JUMP_VY,
  WALL_SLIDE_MAX_VY,
  isSpikyFoe,
  type MoveName,
} from "./garmin-moves";
import {
  BUDDY_EAT_SCORE,
  BUDDY_JUMP_BONUS_VY,
  BUDDY_RUNAWAY_LEAD,
  BUDDY_RUNAWAY_MS,
  BUDDY_RUNAWAY_SPEED,
  BUDDY_TOASTS,
  isEdibleFoe,
} from "./garmin-buddy";
import {
  MEDBALL_FILL_SCALE,
  MEDBALL_KO_SCORE,
  MEDBALL_SIZE,
  MEDBALL_TOAST,
  ballHits,
  ballInReach,
  stepThrownBall,
  throwBall,
  type ThrownBall,
} from "./garmin-medball";
import {
  BOLT_COOLDOWN_MS,
  BOLT_DEFEAT_SCORE,
  DAMAGE_GRACE_MS,
  HIGH_DEFEAT_SCORE,
  HIGH_MS,
  POWERUP_SCORE,
  PICKUP_SIZE,
  START_LIVES,
  addLives,
  blockReward,
  boltHits,
  canThrowBolt,
  collectTier,
  damageTier,
  emergePickup,
  livesEarned,
  playerHeightFor,
  spawnBolt,
  stepBolts,
  stepPickups,
  type Bolt,
  type Pickup,
  type PowerTier,
} from "./garmin-powerups";
import {
  FOE_DEFEAT_SCORE,
  FOE_STOMP_SCORE,
  STOMP_WINDOW,
  damageFoe,
  foeBox,
  generateFoes,
  kickShell,
  overlaps,
  runnerContact,
  shellSweep,
  shotBox,
  stepFoes,
  stompFoe,
  type Foe,
  type FoeKind,
  type FoeShot,
  REPMAX_SCORE,
} from "./garmin-foes";
import {
  CAPE_CEILING_Y,
  CAPE_FLAP_VY,
  CAPE_FLIGHT_MS,
  CAPE_SPIN_COOLDOWN_MS,
  CAPE_SPIN_MS,
  SPIN_DEFEAT_SCORE,
  canSpin,
  glideVy,
  inSpinReach,
  jumpForceFor,
  startsFlight,
  stepPaceMeter,
} from "./garmin-cape";
import {
  BODY_BATTERY_HIT_COST,
  BODY_BATTERY_KUDOS_GAIN,
  BODY_BATTERY_MAX,
  BODY_BATTERY_POWER_GAIN,
  FRESH_BODY_BATTERY,
  adjustBodyBattery,
  effectiveRunInput,
  stepBodyBattery,
  type BodyBattery,
} from "./garmin-body-battery";
import {
  GPS_LOCK_MS,
  MOVE_ALERT_IDLE_MS,
  MOVE_ALERT_TEXT,
  NEW_PR_TEXT,
  gpsBannerText,
  pickToast,
  type ToastEvent,
  trainingEffect,
} from "./garmin-culture";

export type DeviceTarget = "fenix" | "forerunner" | "edge";
export type VariableType = "int" | "float" | "string" | "array";
export type ObstacleType =
  "null_pointer" | "watchdog" | "stack_overflow" | "mem_token" | "flash_token";

export interface DeviceProfile {
  id: DeviceTarget;
  name: string;
  ramLimitKb: number;
  flashLimitKb: number;
  description: string;
  color: string;
}

export const DEVICE_PROFILES: Record<DeviceTarget, DeviceProfile> = {
  fenix: {
    id: "fenix",
    name: "Fēnix 5 (32KB)",
    ramLimitKb: 32.0,
    flashLimitKb: 64.0,
    description: "Hard: Brutal 32KB RAM ceiling & 64KB Flash limit",
    color: "#ef4444",
  },
  forerunner: {
    id: "forerunner",
    name: "Forerunner 245 (64KB)",
    ramLimitKb: 64.0,
    flashLimitKb: 256.0,
    description: "Medium: 64KB memory limit & 256KB Flash capacity",
    color: "#eab308",
  },
  edge: {
    id: "edge",
    name: "Edge 1030 (128KB)",
    ramLimitKb: 128.0,
    flashLimitKb: 512.0,
    description: "Casual: 128KB generous heap & 512KB Flash storage",
    color: "#22c55e",
  },
};

export const VARIABLE_RAM_COSTS: Record<VariableType, number> = {
  int: 0.2,
  float: 0.4,
  string: 0.8,
  array: 1.6,
};

// Authentic 16-color Garmin Chroma Palette
export const CIQ_PALETTE = {
  black: "#000000",
  white: "#FFFFFF",
  lightGray: "#AAAAAA",
  darkGray: "#555555",
  red: "#FF0000",
  darkRed: "#AA0000",
  orange: "#FF5500",
  yellow: "#FFAA00",
  green: "#00AA00",
  brightGreen: "#00FF00",
  blue: "#0000FF",
  darkBlue: "#0000AA",
  cyan: "#00AAAA",
  brightCyan: "#00FFFF",
  purple: "#AA00AA",
  magenta: "#FF00FF",
} as const;

export interface MemoryVariable {
  id: number;
  name: string;
  type: VariableType;
  sizeKb: number;
  allocatedAt: number;
}

export interface FlashVariable {
  id: number;
  name: string;
  sizeKb: number;
  allocatedAt: number;
}

export const FLASH_STORAGE_KEY = "garmin_simulator_flash_storage";

// This module is also bundled on its own into public/garmin-engine.js
// (scripts/build-standalone-engine.ts), so it guards localStorage directly
// instead of importing lib/safe-storage, whose logger pulls in Sentry and
// Next.js server code that a browser IIFE bundle cannot resolve.

/**
 * Reads persisted flash. Returns null when nothing was ever saved (first
 * boot) and an array, possibly empty, once the player has written or
 * cleared flash. The distinction lets a deliberate clear survive a restart
 * instead of re-seeding the default entry (#1210).
 */
function readPersistedFlashStorage(): FlashVariable[] | null {
  if (typeof window === "undefined") return null;
  try {
    if (typeof window.localStorage?.getItem === "function") {
      const raw = window.localStorage.getItem(FLASH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch {
    // Fall back safely when browser local storage is unavailable
  }
  return null;
}

export function loadPersistedFlashStorage(): FlashVariable[] {
  return readPersistedFlashStorage() ?? [];
}

export function savePersistedFlashStorage(flashVars: FlashVariable[]): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.localStorage?.setItem !== "function") {
    throw new Error("localStorage is unavailable");
  }
  window.localStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify(flashVars));
  return true;
}

export interface Obstacle {
  id: number;
  x: number; // 0 - 280
  y: number; // 0 - 280
  width: number;
  height: number;
  type: ObstacleType;
  label: string;
  speed: number;
  variablePayload?: VariableType;
  /** Falling speed once a walker has stepped off the track into a gap. */
  vy?: number;
}

/** A floating score or event label drawn where it happened (world x). */
export interface FacePopup {
  x: number;
  y: number;
  text: string;
  ttlMs: number;
}

/** A short line across the face for a stage start or a warning. */
export interface FaceBanner {
  text: string;
  ttlMs: number;
  tone: "info" | "good" | "warn";
}

export interface CrashReport {
  errorType:
    | "Out Of Memory"
    | "Symbol Not Found"
    | "Watchdog Tripped"
    | "Null Pointer"
    | "Stack Overflow"
    | "Out Of Storage"
    | "Segmentation Fault"
    | "Dropped Kettlebell"
    | "Gym Injury"
    | "Power Loss";
  file: string;
  line: number;
  stackTrace: string[];
  heapUsedKb: number;
  heapLimitKb: number;
  flashUsedKb?: number;
  flashLimitKb?: number;
}

export interface FogPoint {
  x: number;
  y: number;
  radius: number;
}

export type GarminDifficulty = "casual" | "normal" | "hard";
export type GarminLoadout = "standard-ram" | "low-power" | "overclocked";

/**
 * Engine parameters a run is tuned with. Every field is a plain multiplier or
 * constant so the effect of a setup choice is directly testable.
 */
export interface GarminRunTuning {
  /** Multiplies obstacle scroll speed. */
  obstacleSpeedScale: number;
  /** Multiplies the gap between obstacle spawns (larger is easier). */
  obstacleIntervalScale: number;
  /** Multiplies the gap between automatic heap allocations (larger is easier). */
  allocIntervalScale: number;
  /** Multiplies battery drain (base and backlight). */
  batteryDrainScale: number;
  /** Length of the garbage-collection freeze in milliseconds. */
  gcFreezeMs: number;
  /** Extra kilobytes a garbage collection frees on top of its base 2 to 4 KB. */
  gcBonusFreedKb: number;
}

export const DEFAULT_RUN_TUNING: GarminRunTuning = {
  obstacleSpeedScale: 1,
  obstacleIntervalScale: 1,
  allocIntervalScale: 1,
  batteryDrainScale: 1,
  gcFreezeMs: 500,
  gcBonusFreedKb: 0,
};

const DIFFICULTY_TUNING: Record<
  GarminDifficulty,
  Pick<
    GarminRunTuning,
    "obstacleSpeedScale" | "obstacleIntervalScale" | "allocIntervalScale"
  >
> = {
  casual: {
    obstacleSpeedScale: 0.85,
    obstacleIntervalScale: 1.3,
    allocIntervalScale: 1.3,
  },
  normal: {
    obstacleSpeedScale: 1,
    obstacleIntervalScale: 1,
    allocIntervalScale: 1,
  },
  hard: {
    obstacleSpeedScale: 1.2,
    obstacleIntervalScale: 0.8,
    allocIntervalScale: 0.75,
  },
};

const LOADOUT_TUNING: Record<
  GarminLoadout,
  Pick<GarminRunTuning, "batteryDrainScale" | "gcFreezeMs" | "gcBonusFreedKb">
> = {
  "standard-ram": { batteryDrainScale: 1, gcFreezeMs: 500, gcBonusFreedKb: 0 },
  "low-power": { batteryDrainScale: 0.6, gcFreezeMs: 350, gcBonusFreedKb: 0 },
  overclocked: { batteryDrainScale: 1.6, gcFreezeMs: 500, gcBonusFreedKb: 2 },
};

/**
 * Resolves the setup wizard's difficulty and loadout ids to engine
 * parameters. Unknown ids fall back to the Normal / Standard Heap defaults.
 */
export function resolveRunTuning(
  difficulty: string,
  loadout: string
): GarminRunTuning {
  const diff =
    DIFFICULTY_TUNING[difficulty as GarminDifficulty] ??
    DIFFICULTY_TUNING.normal;
  const load =
    LOADOUT_TUNING[loadout as GarminLoadout] ?? LOADOUT_TUNING["standard-ram"];
  return { ...DEFAULT_RUN_TUNING, ...diff, ...load };
}

export interface GameEngineState {
  gameState: "idle" | "playing" | "paused" | "crashed" | "shutdown" | "summary";
  device: DeviceTarget;
  playerY: number; // Y position in 280x280 canvas
  playerVy: number; // Vertical velocity
  isGrounded: boolean;
  score: number;
  highScore: number;
  /** Unrounded distance; round only when displaying. */
  distanceMeters: number;
  /** Fractional score (0 to under 1) carried between ticks. */
  scoreRemainder?: number;
  variables: MemoryVariable[];
  allocatedRamKb: number;
  flashVariables: FlashVariable[];
  flashFiles?: FlashVariable[];
  allocatedFlashKb: number;
  obstacles: Obstacle[];
  isLightOn: boolean;
  battery: number; // 0 - 100%
  lightActiveDurationMs: number;
  fogLevel: number; // 0 (clear) to 1.0 (fully frosted)
  fogWipes: FogPoint[];
  isGcActive: boolean;
  gcTimerMs: number; // 500ms freeze
  heartRate: number;
  thermalStress: number; // Stateful thermal stress level (0.0 to 1.0)
  crashReport: CrashReport | null;
  lastAllocTime: number;
  lastObstacleTime: number;
  /** Wall-clock time the run was paused, so resuming can shift the spawn timers. */
  pausedAt?: number;
  /** Wall-clock time of the last pop, for its cooldown. */
  lastJettisonAt?: number;
  /** Wall-clock time of the last GC, for its cooldown. */
  lastGcAt?: number;
  consecutiveDodges: number;
  /** Setup-derived parameters for this run; absent means defaults. */
  tuning?: GarminRunTuning;
  // ---- Platformer state (#1950). Optional so older snapshots still load.
  /** Live course features: gaps, ledges, blocks, Kudos and finish poles. */
  course?: CourseLayout;
  /** Seed the run's stages are laid out from. */
  courseSeed?: number;
  /** Current stage, 1 to {@link STAGE_COUNT}. */
  stage?: number;
  /** Kudos collected this run. */
  kudos?: number;
  /** Milliseconds of hit immunity left after a hit or a lost life. */
  invulnerableMs?: number;
  // ---- Power-ups and lives (#1988).
  /** Power tier; absent means Base. */
  power?: PowerTier;
  /** Milliseconds of Runner's High (invincibility) left. */
  starMs?: number;
  /** Lives left, counting the current one; absent means this is the last. */
  lives?: number;
  /** Power-ups travelling the course. */
  pickups?: Pickup[];
  // ---- Heat Map (#1989).
  /** Heat bolts on the face. */
  bolts?: Bolt[];
  /** Milliseconds until the next bolt can be thrown. */
  boltCooldownMs?: number;
  /** Bolts thrown this run, for their ids. */
  boltsThrown?: number;
  // ---- Pace meter and Compression Cape (#1990).
  /** Pace meter, 0 (empty) to 1 (full). */
  paceMeter?: number;
  /** Milliseconds left in which a Cape runner's jump presses climb. */
  flightMs?: number;
  /** Milliseconds left in the current cape spin. */
  spinMs?: number;
  /** Milliseconds until the next spin can start. */
  spinCooldownMs?: number;
  // ---- Water and the Tri Suit (#1993).
  /**
   * Milliseconds until the next swimming stroke can start. A jump press
   * while swimming strokes only when this is zero; it counts down with the
   * game clock and resets on a new run and on a lost life.
   */
  strokeCooldownMs?: number;
  // ---- Course foes (#1991).
  /** Foes placed on the course for the current stage. */
  foes?: Foe[];
  /** Shots fired by Auto Laps and the Rep Max. */
  foeShots?: FoeShot[];
  /** Foe shots fired this run, for their ids. */
  foeShotsFired?: number;
  /** The jump key is held: the rise uses the lighter gravity. */
  jumpHeld?: boolean;
  /** Milliseconds since the runner last had footing, for coyote time. */
  coyoteMs?: number;
  /** Milliseconds a jump pressed in the air is still remembered. */
  jumpBufferMs?: number;
  /** Held pace input: 1 sprints, -1 brakes, 0 runs. */
  runInput?: -1 | 0 | 1;
  /** Stomps since the runner last touched footing; each doubles the points. */
  stompChain?: number;
  popups?: FacePopup[];
  banner?: FaceBanner | null;
  // ---- Gameplay first (#2010).
  /**
   * Which rules the run plays by. "fitness" is the default game: no heap,
   * GC, flash, fog or watch battery, with Body Battery instead. "dev" is
   * the original firmware challenge (Dev Mode). Absent means "dev", so
   * snapshots from before #2010 keep the rules they were recorded under.
   */
  rules?: GameRules;
  /** Rules chosen during a run, applied when the next run starts. */
  pendingRules?: GameRules;
  /** Body Battery under the fitness rules. */
  bodyBattery?: BodyBattery;
  /** Milliseconds left of the "Waiting for GPS…" intro; the run holds until it ends. */
  gpsMs?: number;
  /** Milliseconds the runner has been easing or standing on footing, for the move alert. */
  idleMs?: number;
  /** Best score when the run began, so a new PR is announced once. */
  bestAtStart?: number;
  /** A new PR was announced this run. */
  prAnnounced?: boolean;
  /** Foes and bugs defeated this stage, for its Training Effect. */
  stageFoes?: number;
  /** Hits taken this stage, for its Training Effect. */
  stageHits?: number;
  /** Lives lost this stage, for its Training Effect. */
  stageLivesLost?: number;
  /** Training Effect of the last cleared stage. */
  lastTrainingEffect?: number;
  // ---- Course props (#1992).
  /** Water Stations, Plyo Boxes, Treadmill Belts and Rest Day Switches. */
  props?: CourseProps;
  /** Milliseconds of play this run, which drives the Treadmill Belts. */
  propClockMs?: number;
  /** Milliseconds left of a Rest Day, when bricks and Kudos swap. */
  restDayMs?: number;
  /** Set while the runner is in a Water Station's bonus room. */
  bonusRoom?: BonusRoom | null;
  // ---- Run clock and auto lap splits (#2018).
  /**
   * Game time of the run in ms: the sum of simulation steps while playing,
   * after the GPS lock. Pauses and the end of the run stop it.
   */
  runClockMs?: number;
  /** Run clock reading when the current lap began. */
  lapStartMs?: number;
  /** Lap splits so far, one per cleared stage, in ms. */
  lapSplits?: number[];
  /** Best split per lap on this device when the run began, for the lap banner's colour. */
  bestSplits?: number[];
  /**
   * Furthest distance reached this run, in metres. A lost life rewinds
   * `distanceMeters` to the stage start, so pace is measured on this.
   */
  furthestMeters?: number;
  // ---- Burpee Slam, Spin Jump and Wall Jump (#2023).
  /** A Burpee Slam is falling: true from the press until the landing. */
  slamming?: boolean;
  /** A Spin Jump is in the air: true from the mid-air spin until the landing. */
  spinJump?: boolean;
  /** The runner is airborne and pressed against the side of a station or plyo box. */
  wallSide?: boolean;
  /**
   * The current wall contact still has its Wall Jump. True on first contact
   * with a wall; a wall jump uses it up, and it is armed again only after the
   * runner leaves that wall or lands.
   */
  wallJumpReady?: boolean;
  /** Moves already toasted this run, so each toast shows once per run. */
  movesUsed?: MoveName[];

  // ---- Running Buddy and Medicine Ball (#2024).
  /** The runner is riding a Running Buddy. */
  riding?: boolean;
  /** The runner is carrying a medicine ball. */
  carrying?: boolean;
  /** Id of the carried medicine ball, reused when it is thrown and lands. */
  carryingId?: number;
  /** The medicine ball in flight, if any. */
  thrownBall?: ThrownBall | null;
  /** The "Med ball!" toast has shown this run. */
  medBallToasted?: boolean;
  /** Finisher Medal ids found this run; reset by startGame, kept across lost lives and stages (#2025). */
  medalsFound?: number[];
  /** The Aid Station touched on the current stage; reset by startGame, cleared on a stage clear, kept across lost lives (#2025). */
  checkpoint?: CourseCheckpoint | null;
  /** Stages whose secret exit was taken this run; reset by startGame, otherwise kept (#2025). */
  secretExits?: number[];
  /**
   * The Second Wind event running, if any (#2026). Started by a wind Sync
   * Block, ended by its timer, a lost life or a stage clear; null otherwise.
   */
  secondWind?: SecondWind | null;
  /** The race being run (#2019): its course seed and category. Null or absent for a Training Run. */
  race?: RaceSetup | null;
  /** Race game time in ms: advances on every playing tick, GPS lock included, and stops while paused (#2019). */
  simMs?: number;
  /** Free lane Kudos that went by uncollected in this race (#2019). */
  kudosMissed?: number;
  /** A power-up, gear or the training buddy was taken in this race (#2019). */
  gearTaken?: boolean;
  /** Time spent bonked in this race, in ms (#2019). */
  bonkedMs?: number;
  /**
   * The Training Plan workout being run (#1994): the one stage it plays, and
   * whether it is Race Day. Null or absent for any other run.
   */
  plan?: PlanRun | null;
  /** Race Day's boss, The Wall, is beaten this run (#1994). */
  wallDown?: boolean;
  /**
   * Gear packed from the Training Plan's bag that is still to take effect
   * (#1995). The engine carries it untouched; lib/garmin-bag.ts acts on it.
   */
  loadout?: Loadout | null;
}

/** Packed gear still to take effect in a workout (#1995). */
export interface Loadout {
  /** A Runner's High starts as the GPS locks. */
  high: boolean;
  /** An Energy Gel refills Body Battery at the first bonk. */
  gel: boolean;
  /** Milliseconds left of the Pre-Workout's full pace meter, after the GPS lock. */
  preworkoutMs: number;
}

/** A bonus room in progress: the course outside waits to be restored. */
export interface BonusRoom {
  /** The course and props outside the room. */
  returnCourse: CourseLayout;
  returnProps: CourseProps;
  returnFoes: Foe[];
  /** Power-ups that were travelling the course at the door. */
  returnPickups: Pickup[];
  /** World x the runner comes out at. */
  exitX: number;
  /** World x of the room's far wall; reaching it leaves the room. */
  endX: number;
}

/** The rules a run plays by: the fitness game, or Dev Mode's firmware challenge. */
export type GameRules = "fitness" | "dev";

/** Whether a run plays by the fitness rules. */
/**
 * Metres to measure pace on: the furthest point reached this run, so a lost
 * life that rewinds the runner never slows the pace readout. A Training Plan
 * workout counts from the start of its stage (#1994).
 */
export function paceMeters(
  state: Pick<GameEngineState, "distanceMeters" | "furthestMeters" | "plan">
): number {
  const now = Number.isFinite(state.distanceMeters) ? state.distanceMeters : 0;
  const start = state.plan ? stageStartX(state.plan.stage) / PX_PER_METER : 0;
  const reached = Math.max(state.furthestMeters ?? 0, now);
  return Math.max(0, reached - start);
}

export function isFitnessRun(state: Pick<GameEngineState, "rules">): boolean {
  return state.rules === "fitness";
}

/** The clock a state runs on: a race's simulated time (#2019), else wall time. */
function clockNow(state: Pick<GameEngineState, "race" | "simMs">): number {
  return state.race ? (state.simMs ?? 0) : Date.now();
}

/** The random draws of a tick: a race's seeded stream (#2019), else Math.random. */
function randomFor(
  state: Pick<GameEngineState, "race" | "simMs">
): () => number {
  return state.race
    ? courseRandom((state.race.seed ^ Math.floor(state.simMs ?? 0)) >>> 0)
    : Math.random;
}

/** Lane Kudos that have scrolled out behind the runner uncollected (#2019). */
function missedKudos(course: CourseLayout, cameraX: number): number {
  const gone = (x: number) => x <= cameraX - 40;
  return (
    course.kudos.filter((k) => !k.fromBrick && gone(k.x + KUDOS_RADIUS))
      .length +
    course.blocks.filter((b) => b.fromKudos && gone(b.x + BLOCK_SIZE)).length
  );
}

/**
 * A race's freshly laid stage after a lost life keeps only the lane Kudos
 * still to come on `live`, so a Kudos already collected or counted missed is
 * neither offered nor counted again (#2019).
 */
function keepLiveKudos(fresh: CourseLayout, live: CourseLayout): CourseLayout {
  const ids = new Set([
    ...live.kudos.map((k) => k.id),
    ...live.blocks.filter((b) => b.fromKudos).map((b) => b.id),
  ]);
  return { ...fresh, kudos: fresh.kudos.filter((k) => ids.has(k.id)) };
}

/**
 * Sets the rules for the next run. Turning Dev Mode on or off takes effect
 * when a run starts, so a run in progress keeps its rules.
 */
export function setRules(
  state: GameEngineState,
  rules: GameRules
): GameEngineState {
  // Only an idle watch switches at once; a run in progress, or one whose end
  // screen is showing, keeps its rules until the next run starts.
  if (state.gameState !== "idle") {
    if ((state.rules ?? "dev") === rules) {
      return state.pendingRules === undefined
        ? state
        : { ...state, pendingRules: undefined };
    }
    return { ...state, pendingRules: rules };
  }
  if (state.rules === rules && state.pendingRules === undefined) return state;
  return { ...state, rules, pendingRules: undefined };
}

export const CANVAS_SIZE = 280;
export const GROUND_Y = 205;
export const PLAYER_X = 52;
export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 24;
/** Gravity while rising with the jump key held. */
export const GRAVITY = 0.55;
/** Gravity while falling, or rising after the jump key is let go. */
export const FALL_GRAVITY = 0.9;
export const JUMP_FORCE = -10;
/** Letting go of jump early clips the rise to this speed: a short hop. */
export const JUMP_CUT_VY = -4;
/** Fastest the runner falls, in px per 60 Hz frame. */
export const MAX_FALL_VY = 11;
/** A jump still works this long after running off an edge. */
export const COYOTE_MS = 100;
/** A jump pressed this long before landing fires on landing. */
export const JUMP_BUFFER_MS = 120;
/** Upward speed after stomping an enemy. */
export const STOMP_BOUNCE_VY = -7;
/** Pace multipliers for braking, running and sprinting. */
export const PACE = { brake: 0.6, run: 1, sprint: 1.5 } as const;
/** Base points for a stomp; each further stomp before landing doubles it. */
export const STOMP_SCORE = 100;
export const KUDOS_SCORE = 50;
export const SYNC_BLOCK_SCORE = 20;
export const STAGE_CLEAR_SCORE = 1000;

/**
 * Initializes a new fresh game state
 */
export function createInitialState(
  device: DeviceTarget = "fenix",
  highScore = 0,
  initialFlash?: FlashVariable[]
): GameEngineState {
  const persisted = initialFlash ? initialFlash : readPersistedFlashStorage();
  // The default sys_log.dat is seeded only on first boot. A persisted empty
  // array means the player cleared flash, which must survive a restart.
  const defaultFlashVars: FlashVariable[] =
    persisted === null || (initialFlash && persisted.length === 0)
      ? [{ id: 1, name: "sys_log.dat", sizeKb: 4.0, allocatedAt: 0 }]
      : persisted;
  const allocatedFlashKb = Number(
    defaultFlashVars.reduce((acc, v) => acc + v.sizeKb, 0).toFixed(2)
  );

  return {
    gameState: "idle",
    device,
    playerY: GROUND_Y - PLAYER_HEIGHT,
    playerVy: 0,
    isGrounded: true,
    score: 0,
    highScore,
    distanceMeters: 0,
    variables: [
      { id: 1, name: "appCtx", type: "int", sizeKb: 0.2, allocatedAt: 0 },
      { id: 2, name: "displayGfx", type: "array", sizeKb: 1.6, allocatedAt: 0 },
    ],
    allocatedRamKb: 1.8,
    flashVariables: defaultFlashVars,
    flashFiles: defaultFlashVars,
    allocatedFlashKb,
    obstacles: [],
    isLightOn: false,
    battery: 100,
    lightActiveDurationMs: 0,
    fogLevel: 0,
    thermalStress: 0,
    fogWipes: [],
    isGcActive: false,
    gcTimerMs: 0,
    heartRate: 135,
    crashReport: null,
    lastAllocTime: 0,
    lastObstacleTime: 0,
    consecutiveDodges: 0,
    course: EMPTY_COURSE,
    stage: 1,
    kudos: 0,
    invulnerableMs: 0,
    power: "base",
    starMs: 0,
    pickups: [],
    bolts: [],
    boltCooldownMs: 0,
    boltsThrown: 0,
    paceMeter: 0,
    flightMs: 0,
    spinMs: 0,
    spinCooldownMs: 0,
    jumpHeld: false,
    coyoteMs: 0,
    jumpBufferMs: 0,
    runInput: 0,
    stompChain: 0,
    popups: [],
    banner: null,
  };
}

/**
 * Lays out one stage: its course with the props placed on it (#1992). A
 * Treadmill Belt can replace a ledge, so the course comes from the props.
 */
function stageLayout(
  stage: number,
  seed: number
): { course: CourseLayout; props: CourseProps } {
  const theme = themeForStage(stage);
  const placed = generateStageProps(
    stage,
    seed,
    GROUND_Y,
    generateStage(stage, seed, GROUND_Y, theme),
    theme
  );
  // Medals, the Aid Station and any secret exit go on last (#2025).
  return placeStageExtras(
    placed.layout,
    placed.props,
    stage,
    seed,
    GROUND_Y,
    theme,
    PLAYER_WIDTH
  );
}

/**
 * How far the Treadmill Belt under the runner's feet moved between two
 * clock readings, or nothing when they stand on no belt.
 */
function beltCarry(
  props: CourseProps,
  cameraX: number,
  feetBottom: number,
  fromMs: number,
  toMs: number
): { dx: number; dy: number } {
  const footLeft = cameraX + PLAYER_X + 5;
  const footRight = cameraX + PLAYER_X + PLAYER_WIDTH - 5;
  for (const belt of props.belts) {
    const before = beltOffset(belt, fromMs);
    const left = belt.x + before.dx;
    if (
      footRight > left &&
      footLeft < left + belt.width &&
      Math.abs(feetBottom - (belt.y + before.dy)) <= 1
    ) {
      const after = beltOffset(belt, toMs);
      return { dx: after.dx - before.dx, dy: after.dy - before.dy };
    }
  }
  return { dx: 0, dy: 0 };
}

/**
 * Whether the runner's right edge is against the left side of a station or
 * plyo box, with its feet below the box's top. A runner stopped by
 * {@link wallAhead} sits exactly on that side.
 */
function wallContact(
  props: CourseProps,
  groundY: number,
  bodyRight: number,
  feetBottom: number
): boolean {
  const touches = (box: { x: number; height: number }) =>
    Math.abs(bodyRight - box.x) <= 1.5 && feetBottom > groundY - box.height + 1;
  return props.stations.some(touches) || props.plyos.some(touches);
}

/**
 * The bonus room behind `station` (#2025 adds its medal and secret exit): the
 * room's medal floats over its second ledge unless already found, and a
 * secret exit ends the room at a second pole instead of the stage's own.
 * A room with neither is the plain room.
 */
function bonusRoomCourse(
  state: GameEngineState,
  station: CourseStation,
  cameraX: number
): CourseLayout {
  const room = generateBonusRoom(cameraX, station.id, GROUND_Y);
  const found = state.medalsFound ?? [];
  const medals: CourseMedal[] =
    station.medalId !== undefined && !found.includes(station.medalId)
      ? [
          {
            id: station.medalId,
            stage: medalStage(station.medalId),
            x: cameraX + ROOM_MEDAL_DX,
            y: GROUND_Y - ROOM_MEDAL_RISE,
          },
        ]
      : [];
  const poles: CoursePole[] = station.secretExit
    ? [
        {
          x: cameraX + PLAYER_X + BONUS_ROOM_LENGTH - SECRET_POLE_INSET,
          stage: state.stage ?? 1,
          secret: true,
        },
      ]
    : [];
  return {
    ...room,
    ...(medals.length > 0 ? { medals } : {}),
    ...(poles.length > 0 ? { poles } : {}),
  };
}

/**
 * Down on an enterable Water Station takes the runner into its bonus room:
 * a short indoor stretch lined with Kudos that comes out further along the
 * course (#1992). Anywhere else Down does nothing here.
 */
export function enterStation(state: GameEngineState): GameEngineState {
  if (
    state.gameState !== "playing" ||
    !state.isGrounded ||
    state.bonusRoom ||
    (state.gpsMs ?? 0) > 0
  ) {
    return state;
  }
  const props = state.props ?? EMPTY_PROPS;
  const cameraX = state.distanceMeters * PX_PER_METER;
  const h = playerHeightFor(state.power ?? "base");
  const station = stationUnderFeet(
    props,
    cameraX + PLAYER_X + 5,
    cameraX + PLAYER_X + PLAYER_WIDTH - 5,
    state.playerY + h,
    GROUND_Y
  );
  if (!station) return state;
  // A Rest Day in progress ends at the door, so the course outside comes
  // back as it was laid out.
  const outside =
    (state.restDayMs ?? 0) > 0
      ? restDaySwap(state.course ?? EMPTY_COURSE, false)
      : (state.course ?? EMPTY_COURSE);
  // The buddy waits outside a bonus room and is left behind (#2024).
  const stayPopups = state.riding
    ? [
        ...(state.popups ?? []),
        {
          x: cameraX + PLAYER_X + 3,
          y: state.playerY - 14,
          text: BUDDY_TOASTS.stay,
          ttlMs: 1100,
        },
      ]
    : state.popups;
  return {
    ...state,
    riding: false,
    // A carried ball is left at the door with the buddy.
    carrying: false,
    carryingId: undefined,
    thrownBall: null,
    popups: stayPopups,
    bonusRoom: {
      returnCourse: outside,
      returnProps: {
        ...props,
        stations: props.stations.map((s) =>
          s.id === station.id ? { ...s, used: true } : s
        ),
      },
      returnFoes: state.foes ?? [],
      returnPickups: state.pickups ?? [],
      exitX: station.exitX,
      endX: cameraX + PLAYER_X + BONUS_ROOM_LENGTH,
    },
    course: bonusRoomCourse(state, station, cameraX),
    props: EMPTY_PROPS,
    foes: [],
    foeShots: [],
    obstacles: [],
    pickups: [],
    bolts: [],
    restDayMs: 0,
    playerY: GROUND_Y - h,
    playerVy: 0,
    banner: { text: "WATER STATION · GRAB A GEL", ttlMs: 1600, tone: "good" },
  };
}

/**
 * A fresh stage's course, props and foes. Medals in `found` are taken out, so
 * a stage laid out again never offers one twice (#2025).
 */
function stageSetup(
  stage: number,
  seed: number,
  found: readonly number[] | undefined
): { course: CourseLayout; props: CourseProps; foes: Foe[] } {
  const laid = stageLayout(stage, seed);
  const { course, props } = hideFoundMedals(laid.course, laid.props, found);
  // No foe starts inside a station, box or switch.
  const footings = propFootings(props, 0, GROUND_Y);
  const foes = generateFoes(
    stage,
    seed,
    course,
    GROUND_Y,
    themeForStage(stage)
  ).filter(
    (f) =>
      !footings.some((p) => f.x < p.right + 8 && f.x + f.width > p.left - 8)
  );
  return { course, props, foes };
}

/**
 * Start a new game session
 */
export function startGame(
  state: GameEngineState,
  device?: DeviceTarget,
  tuning?: GarminRunTuning,
  race?: RaceSetup,
  plan?: PlanRun
): GameEngineState {
  const targetDevice = device || state.device;
  const initial = createInitialState(targetDevice, state.highScore);
  const runTuning = tuning ?? state.tuning;
  // A race runs its own seed on the simulated clock, under fitness rules (#2019).
  const now = race ? 0 : Date.now();
  const courseSeed =
    race?.seed ?? plan?.seed ?? Math.floor(Math.random() * 1e9);
  // A Training Plan workout plays its one stage (#1994).
  const stage = plan?.stage ?? 1;
  const runRules = race ? "fitness" : (state.pendingRules ?? state.rules);
  const fitness = runRules === "fitness";
  return {
    ...initial,
    ...(runTuning ? { tuning: runTuning } : {}),
    ...(runRules ? { rules: runRules } : {}),
    ...(race
      ? { race, simMs: 0, kudosMissed: 0, gearTaken: false, bonkedMs: 0 }
      : {}),
    ...(fitness
      ? {
          bodyBattery: FRESH_BODY_BATTERY,
          gpsMs: GPS_LOCK_MS,
          idleMs: 0,
          bestAtStart: state.highScore,
          prAnnounced: false,
          stageFoes: 0,
          stageHits: 0,
          stageLivesLost: 0,
        }
      : {}),
    gameState: "playing",
    // The spawn and allocation clocks start now, with a grace before the
    // first bug, so nothing is on the lane at frame one (#1945).
    lastAllocTime: now,
    lastObstacleTime: now,
    courseSeed,
    lives: START_LIVES,
    ...(plan
      ? { plan, stage, distanceMeters: stageStartX(stage) / PX_PER_METER }
      : {}),
    ...stageSetup(stage, courseSeed, []),
    // A new run has found no medals, touched no Aid Station and taken no
    // secret exit (#2025).
    medalsFound: [],
    checkpoint: null,
    secretExits: [],
    secondWind: null,
    foeShots: [],
    propClockMs: 0,
    restDayMs: 0,
    bonusRoom: null,
    strokeCooldownMs: 0,
    runClockMs: 0,
    lapStartMs: 0,
    lapSplits: [],
    furthestMeters: 0,
    slamming: false,
    spinJump: false,
    wallSide: false,
    wallJumpReady: false,
    movesUsed: [],
    riding: false,
    carrying: false,
    carryingId: undefined,
    thrownBall: null,
    medBallToasted: false,
    banner: fitness
      ? { text: gpsBannerText(0), ttlMs: GPS_LOCK_MS + 1800, tone: "info" }
      : { text: "STAGE 1 · GO!", ttlMs: 1800, tone: "info" },
  };
}

/**
 * Pause a running session. Only a playing run can pause.
 */
export function pauseGame(
  state: GameEngineState,
  now: number = clockNow(state)
): GameEngineState {
  if (state.gameState !== "playing") return state;
  return { ...state, gameState: "paused", pausedAt: now };
}

/**
 * Resume a paused session. The allocation and obstacle timers run on wall
 * time, so they shift by the paused duration; otherwise a long pause would
 * fire an allocation and a spawn the moment play resumes (#1216).
 */
export function resumeGame(
  state: GameEngineState,
  now: number = clockNow(state)
): GameEngineState {
  if (state.gameState !== "paused") return state;
  // A race's clock stops while paused, so nothing shifts (#2019).
  const pausedFor = state.race ? 0 : Math.max(0, now - (state.pausedAt ?? now));
  return {
    ...state,
    gameState: "playing",
    pausedAt: undefined,
    lastAllocTime: state.lastAllocTime + pausedFor,
    lastObstacleTime: state.lastObstacleTime + pausedFor,
  };
}

/**
 * A swimming stroke: a push up on the jump press, then a short wait before the
 * next. A Tri Suit strokes harder and more often. A stroke is not remembered
 * when it is pressed during the wait, and it leaves no coyote time behind.
 */
function stroke(state: GameEngineState): GameEngineState {
  if ((state.strokeCooldownMs ?? 0) > 0) {
    return { ...state, jumpHeld: true };
  }
  const suit = state.power === "trisuit";
  return {
    ...state,
    playerVy: suit ? SUIT_STROKE_VY : SWIM_STROKE_VY,
    isGrounded: false,
    jumpHeld: true,
    coyoteMs: 0,
    jumpBufferMs: 0,
    strokeCooldownMs: suit ? SUIT_STROKE_MS : SWIM_STROKE_MS,
  };
}

/**
 * The take-off speed on land. A Tri Suit hops at its own speed and ignores
 * the full pace meter's bonus.
 */
function takeOffVy(
  power: PowerTier | undefined,
  paceMeter: number | undefined,
  riding: boolean = false
): number {
  const base =
    power === "trisuit"
      ? SUIT_LAND_JUMP_VY
      : jumpForceFor(paceMeter, JUMP_FORCE);
  // A Running Buddy under the runner adds a little lift to every take-off (#2024).
  return riding ? base + BUDDY_JUMP_BONUS_VY : base;
}

/**
 * Presses jump. On footing, or within {@link COYOTE_MS} of leaving it, the
 * runner jumps at once, higher with a full pace meter; in the air the press
 * is remembered for {@link JUMP_BUFFER_MS} and fires on landing. Holding the
 * key (until {@link releaseJump}) keeps the rise floaty for a higher jump.
 * A Cape runner with a full meter takes off, and while the flight lasts each
 * press in the air climbs again.
 */
export function pressJump(state: GameEngineState): GameEngineState {
  if (state.gameState !== "playing") return state;
  if (isUnderwater(state)) return stroke(state);
  // The Wall Jump only fires on the way down, so a rise can't be extended.
  if (
    state.wallSide &&
    state.wallJumpReady &&
    !state.isGrounded &&
    state.playerVy > 0
  ) {
    return wallJump(state);
  }
  const canJump = state.isGrounded || (state.coyoteMs ?? 0) < COYOTE_MS;
  if (canJump && state.playerVy >= 0) {
    return {
      ...state,
      playerVy: takeOffVy(state.power, state.paceMeter, state.riding === true),
      isGrounded: false,
      jumpHeld: true,
      // Spent: no second coyote jump from the same edge.
      coyoteMs: COYOTE_MS,
      jumpBufferMs: 0,
      flightMs: startsFlight(state.power, state.paceMeter)
        ? CAPE_FLIGHT_MS
        : (state.flightMs ?? 0),
    };
  }
  if (state.power === "cape" && (state.flightMs ?? 0) > 0) {
    return {
      ...state,
      playerVy: Math.min(state.playerVy, CAPE_FLAP_VY),
      jumpHeld: true,
      jumpBufferMs: 0,
    };
  }
  return { ...state, jumpHeld: true, jumpBufferMs: JUMP_BUFFER_MS };
}

/**
 * Lets go of jump. A runner still rising fast has the rise clipped, so a tap
 * is a short hop and a hold is a full jump.
 */
export function releaseJump(state: GameEngineState): GameEngineState {
  // A stroke is never clipped: the swimmer's push runs its course.
  if (isUnderwater(state)) {
    return state.jumpHeld ? { ...state, jumpHeld: false } : state;
  }
  if (!state.jumpHeld && state.playerVy >= JUMP_CUT_VY) return state;
  return {
    ...state,
    jumpHeld: false,
    playerVy:
      state.gameState === "playing" && state.playerVy < JUMP_CUT_VY
        ? JUMP_CUT_VY
        : state.playerVy,
  };
}

/**
 * Throws a heat bolt forward from the runner's hand. Only a Heat Map runner
 * can throw, at most {@link BOLT_COOLDOWN_MS} apart and with no more than
 * two bolts on the face; otherwise the state is returned unchanged.
 */
export function throwBolt(state: GameEngineState): GameEngineState {
  if (state.gameState !== "playing") return state;
  if (!canThrowBolt(state.power, state.bolts, state.boltCooldownMs)) {
    return state;
  }
  const cameraX = state.distanceMeters * PX_PER_METER;
  const h = playerHeightFor(state.power);
  const id = (state.boltsThrown ?? 0) + 1;
  return {
    ...state,
    bolts: [
      ...(state.bolts ?? []),
      spawnBolt(id, cameraX + PLAYER_X + PLAYER_WIDTH, state.playerY + h / 2),
    ],
    boltCooldownMs: BOLT_COOLDOWN_MS,
    boltsThrown: id,
  };
}

/**
 * Spins the Compression Cape: for {@link CAPE_SPIN_MS} it defeats bugs and
 * watchdogs beside the runner and bumps Sync Blocks from the side. Only a
 * Cape runner can spin, once per {@link CAPE_SPIN_COOLDOWN_MS}.
 */
export function spinCape(state: GameEngineState): GameEngineState {
  if (state.gameState !== "playing") return state;
  if (!canSpin(state.power, state.spinCooldownMs)) return state;
  return {
    ...state,
    spinMs: CAPE_SPIN_MS,
    spinCooldownMs: CAPE_SPIN_COOLDOWN_MS,
  };
}

/**
 * The action key (#2024): a runner carrying a medicine ball throws it, and a
 * grounded runner standing by one picks it up. Returns null when the key
 * means something else for this state.
 */
function medBallAction(state: GameEngineState): GameEngineState | null {
  if (state.gameState !== "playing") return null;
  if (state.carrying) {
    // One ball in flight at a time: a second throw waits for it to land.
    if (state.thrownBall) return state;
    const cameraX = state.distanceMeters * PX_PER_METER;
    return {
      ...state,
      carrying: false,
      carryingId: undefined,
      thrownBall: throwBall(
        state.carryingId ?? 0,
        cameraX + PLAYER_X + PLAYER_WIDTH,
        state.playerY + 8
      ),
    };
  }
  if (!state.isGrounded || isUnderwater(state)) return null;
  const cameraX = state.distanceMeters * PX_PER_METER;
  const ball = ballInReach(
    state.course?.medBalls,
    cameraX + PLAYER_X,
    cameraX + PLAYER_X + PLAYER_WIDTH,
    state.playerY + playerHeightFor(state.power)
  );
  if (!ball) return null;
  const popups = state.popups ?? [];
  const toast = state.medBallToasted !== true;
  return {
    ...state,
    course: {
      ...(state.course ?? EMPTY_COURSE),
      medBalls: (state.course?.medBalls ?? []).filter((b) => b.id !== ball.id),
    },
    carrying: true,
    carryingId: ball.id,
    medBallToasted: true,
    popups: toast
      ? [
          ...popups,
          {
            x: cameraX + PLAYER_X + 3,
            y: state.playerY - 14,
            text: MEDBALL_TOAST,
            ttlMs: 1100,
          },
        ]
      : popups,
  };
}

/**
 * The action key: a runner next to a medicine ball picks it up, or one
 * carrying a ball throws it (#2024). Otherwise a Heat Map runner throws a
 * heat bolt and a Cape runner spins. Any other tier in the air starts a Spin
 * Jump (#2023); on the ground it does nothing.
 */
export function pressAction(state: GameEngineState): GameEngineState {
  const medBall = medBallAction(state);
  if (medBall) return medBall;
  if (state.power === "heatmap") return throwBolt(state);
  if (state.power === "cape") return spinCape(state);
  return startSpinJump(state);
}

/**
 * Toasts a move the first time it is used in the run: a popup over the
 * runner, and the move recorded in `movesUsed`. A repeat use leaves the
 * state as it is.
 */
function toastMove(state: GameEngineState, move: MoveName): GameEngineState {
  const used = state.movesUsed ?? [];
  if (used.includes(move)) return state;
  const cameraX = state.distanceMeters * PX_PER_METER;
  return {
    ...state,
    movesUsed: [...used, move],
    popups: [
      ...(state.popups ?? []),
      {
        x: cameraX + PLAYER_X + 3,
        y: state.playerY - 14,
        text: MOVE_TOASTS[move],
        ttlMs: 1100,
      },
    ],
  };
}

/**
 * Whether the runner can start a Burpee Slam: a fitness run, in the air, on
 * land rather than water, and not already slamming.
 */
export function canSlam(state: GameEngineState): boolean {
  return (
    state.gameState === "playing" &&
    isFitnessRun(state) &&
    !state.isGrounded &&
    !isUnderwater(state) &&
    !state.slamming
  );
}

/**
 * Starts a Burpee Slam: the runner drops straight down at {@link SLAM_VY}
 * until it lands. Only in the air on a fitness run (see {@link canSlam});
 * otherwise the state is returned unchanged.
 */
export function pressSlam(state: GameEngineState): GameEngineState {
  if (!canSlam(state)) return state;
  return toastMove(
    { ...state, slamming: true, spinJump: false, playerVy: SLAM_VY },
    "slam"
  );
}

/**
 * Whether the runner can start a Spin Jump: in the air, not already spinning
 * or slamming, and not underwater. Heat Map and Cape runners never reach
 * this: their action key throws or spins.
 */
function canSpinJump(state: GameEngineState): boolean {
  return (
    state.gameState === "playing" &&
    !state.isGrounded &&
    !isUnderwater(state) &&
    !state.spinJump &&
    !state.slamming
  );
}

/**
 * Starts a Spin Jump: no extra lift, just a floatier fall until the landing,
 * so it can't be used as a second jump in the air.
 */
function startSpinJump(state: GameEngineState): GameEngineState {
  if (!canSpinJump(state)) return state;
  return toastMove({ ...state, spinJump: true }, "spin");
}

/**
 * A Wall Jump: one jump off the side of a station or plyo box, then the
 * contact's jump is spent until the runner leaves the wall.
 */
function wallJump(state: GameEngineState): GameEngineState {
  return toastMove(
    {
      ...state,
      playerVy: WALL_JUMP_VY,
      wallJumpReady: false,
      spinJump: false,
      slamming: false,
      jumpHeld: true,
      jumpBufferMs: 0,
      coyoteMs: COYOTE_MS,
    },
    "wall"
  );
}

/** Sets the held pace input: 1 sprints, -1 brakes, 0 runs. */
export function setRunInput(
  state: GameEngineState,
  input: -1 | 0 | 1
): GameEngineState {
  if ((state.runInput ?? 0) === input) return state;
  return { ...state, runInput: input };
}

/** The pace multiplier for a held run input. */
export function paceFor(input: number | undefined): number {
  if (input === 1) return PACE.sprint;
  if (input === -1) return PACE.brake;
  return PACE.run;
}

/**
 * Names of required app state allocated at boot. These are never collectible:
 * jettison and garbage collection skip them, so the watch stays functional.
 */
export const REQUIRED_VARIABLE_NAMES: readonly string[] = [
  "appCtx",
  "displayGfx",
];

/**
 * Points awarded for a memory action that actually reclaimed heap. Actions that
 * reclaim nothing award no points. Survival ticks are the primary score
 * source; devices differ in RAM limits and allocation pace.
 */
export const JETTISON_SCORE = 5;
export const GC_SCORE = 10;

/**
 * Memory actions cost something, so managing the heap is a choice rather than
 * free points (#1320): a pop needs a short recharge, and a GC needs a longer
 * one and draws battery on top of its freeze and heat.
 */
export const JETTISON_COOLDOWN_MS = 1500;
export const GC_COOLDOWN_MS = 5000;
export const GC_BATTERY_COST = 1;

/**
 * Collecting a floating token is a trade: it costs memory or flash, and pays
 * points. Jumping over it keeps the memory and forgoes the points.
 */
export const MEM_TOKEN_SCORE = 25;
export const FLASH_TOKEN_SCORE = 40;

/**
 * Distance (m) over which the run ramps from its opening pace to full
 * difficulty. The runner covers about 15 m a second, so this is 3 minutes.
 */
export const DIFFICULTY_RAMP_METERS = 2700;

/**
 * How far into the difficulty ramp a run is, from 0 at the start to 1 at
 * {@link DIFFICULTY_RAMP_METERS} and beyond.
 */
export function getDifficultyRamp(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  return Math.min(1, distanceMeters / DIFFICULTY_RAMP_METERS);
}

/**
 * Milliseconds until a memory action recharges, or 0 when it is ready.
 */
export function getCooldownRemainingMs(
  lastUsedAt: number | undefined,
  cooldownMs: number,
  now: number = Date.now()
): number {
  if (lastUsedAt === undefined) return 0;
  return Math.max(0, cooldownMs - (now - lastUsedAt));
}

/**
 * Returns true when a heap variable is collectible garbage rather than required app state.
 */
export function isCollectibleVariable(v: MemoryVariable): boolean {
  return !REQUIRED_VARIABLE_NAMES.includes(v.name);
}

/**
 * Jettison (pop) the oldest collectible variable in the heap.
 * Required app state is never discarded; with nothing collectible the call is
 * a no-op that awards no score and reports a reason.
 */
export function jettisonOldestVariable(
  state: GameEngineState,
  now: number = clockNow(state)
): {
  state: GameEngineState;
  popped?: MemoryVariable;
  reason?: string;
} {
  if (state.gameState !== "playing") {
    return { state };
  }

  const recharge = getCooldownRemainingMs(
    state.lastJettisonAt,
    JETTISON_COOLDOWN_MS,
    now
  );
  if (recharge > 0) {
    return {
      state,
      reason: `Pop recharging: ${(recharge / 1000).toFixed(1)}s`,
    };
  }

  const idx = state.variables.findIndex(isCollectibleVariable);
  if (idx === -1) {
    return { state, reason: "Nothing to jettison: only required app state" };
  }

  const popped = state.variables[idx];
  const rest = state.variables.filter((_, i) => i !== idx);
  const newRam = Math.max(0.2, state.allocatedRamKb - popped.sizeKb);

  return {
    state: {
      ...state,
      variables: rest,
      allocatedRamKb: Number(newRam.toFixed(2)),
      score: state.score + JETTISON_SCORE,
      lastJettisonAt: now,
    },
    popped,
  };
}

/**
 * Force Garbage Collection (GC)
 * Freezes game for 500ms and frees up to 2.0 to 4.0 KB of collectible garbage.
 * With no collectible garbage the call is a no-op: no freeze, no score.
 */
export function triggerGarbageCollection(
  state: GameEngineState,
  now: number = clockNow(state)
): {
  state: GameEngineState;
  freedKb: number;
  reason?: string;
} {
  if (state.gameState !== "playing" || state.isGcActive) {
    return { state, freedKb: 0 };
  }

  const recharge = getCooldownRemainingMs(state.lastGcAt, GC_COOLDOWN_MS, now);
  if (recharge > 0) {
    return {
      state,
      freedKb: 0,
      reason: `GC recharging: ${(recharge / 1000).toFixed(1)}s`,
    };
  }

  if (!state.variables.some(isCollectibleVariable)) {
    return {
      state,
      freedKb: 0,
      reason: "Heap already clean: nothing to collect",
    };
  }

  // Calculate garbage memory to free (2.0 to 4.0 KB, capped by current non-essential variables)
  const tuning = state.tuning ?? DEFAULT_RUN_TUNING;
  const targetFreedKb = Number(
    (2.0 + randomFor(state)() * 2.0 + tuning.gcBonusFreedKb).toFixed(2)
  );
  let accumulatedFreed = 0;
  const remainingVars: MemoryVariable[] = [];

  // Remove collectible variables from oldest to newest until target freed is met
  for (const v of state.variables) {
    if (isCollectibleVariable(v) && accumulatedFreed < targetFreedKb) {
      accumulatedFreed += v.sizeKb;
    } else {
      remainingVars.push(v);
    }
  }

  const newRam = Math.max(
    0.4,
    Number((state.allocatedRamKb - accumulatedFreed).toFixed(2))
  );

  return {
    state: {
      ...state,
      isGcActive: true,
      gcTimerMs: tuning.gcFreezeMs,
      variables: remainingVars,
      allocatedRamKb: newRam,
      score: state.score + GC_SCORE,
      battery: Math.max(0, state.battery - GC_BATTERY_COST),
      lastGcAt: now,
    },
    freedKb: Number(accumulatedFreed.toFixed(2)),
  };
}

/**
 * Allocate a new variable into the heap
 */
export function allocateVariable(
  state: GameEngineState,
  type: VariableType,
  name?: string
): { state: GameEngineState; crashed: boolean } {
  const sizeKb = VARIABLE_RAM_COSTS[type];
  const newRam = Number((state.allocatedRamKb + sizeKb).toFixed(2));
  const ramLimit = DEVICE_PROFILES[state.device].ramLimitKb;

  const newVar: MemoryVariable = {
    id: clockNow(state) + randomFor(state)(),
    name: name || `${type}_${Math.floor(randomFor(state)() * 900 + 100)}`,
    type,
    sizeKb,
    allocatedAt: clockNow(state),
  };

  if (newRam > ramLimit) {
    // Trigger Out Of Memory Crash
    const crashReport: CrashReport = {
      errorType: "Out Of Memory",
      file: "MonkeyC_Alloc.mc",
      line: 12,
      stackTrace: [
        `Failed to allocate ${sizeKb}KB (${type})`,
        `Heap: ${newRam}KB / ${ramLimit}KB`,
        "at Rez.Fonts.drawGlyph() [Rez.mc:88]",
        "at MonkeyC_Mayhem_App.onUpdate() [App.mc:42]",
      ],
      heapUsedKb: newRam,
      heapLimitKb: ramLimit,
    };

    return {
      state: {
        ...state,
        allocatedRamKb: newRam,
        gameState: "crashed",
        crashReport,
      },
      crashed: true,
    };
  }

  return {
    state: {
      ...state,
      variables: [...state.variables, newVar],
      allocatedRamKb: newRam,
    },
    crashed: false,
  };
}

/**
 * Allocate a new persistent variable into Non-Volatile Flash storage
 */
export function allocateFlashVariable(
  state: GameEngineState,
  sizeKb = 4.0,
  name?: string
): { state: GameEngineState; crashed: boolean } {
  const newFlash = Number((state.allocatedFlashKb + sizeKb).toFixed(2));
  const flashLimit = DEVICE_PROFILES[state.device].flashLimitKb;

  const newVar: FlashVariable = {
    id: clockNow(state) + randomFor(state)(),
    name: name || `nv_data_${Math.floor(randomFor(state)() * 900 + 100)}.bin`,
    sizeKb,
    allocatedAt: clockNow(state),
  };

  if (newFlash > flashLimit) {
    const crashReport: CrashReport = {
      errorType: "Out Of Storage",
      file: "FlashNVStorage.mc",
      line: 28,
      stackTrace: [
        `Failed to allocate ${sizeKb}KB to NVRAM Flash`,
        `Out of Storage: ${newFlash}KB / ${flashLimit}KB limit exceeded`,
        "at Application.Storage.setValue() [Storage.mc:104]",
        "at MonkeyC_Mayhem_App.saveState() [App.mc:95]",
      ],
      heapUsedKb: state.allocatedRamKb,
      heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
      flashUsedKb: newFlash,
      flashLimitKb: flashLimit,
    };

    return {
      state: {
        ...state,
        allocatedFlashKb: newFlash,
        gameState: "crashed",
        crashReport,
      },
      crashed: true,
    };
  }

  const nextFlashVars = [...state.flashVariables, newVar];
  try {
    savePersistedFlashStorage(nextFlashVars);
  } catch {
    // Engine in-memory state continues safely even if browser storage write fails
  }

  return {
    state: {
      ...state,
      flashVariables: nextFlashVars,
      flashFiles: nextFlashVars,
      allocatedFlashKb: newFlash,
    },
    crashed: false,
  };
}

/**
 * Clears persistent NV Flash storage and resets local storage
 */
export function clearFlashStorage(state: GameEngineState): GameEngineState {
  try {
    savePersistedFlashStorage([]);
  } catch {
    // Engine in-memory state continues safely even if browser storage write fails
  }
  return {
    ...state,
    flashVariables: [],
    flashFiles: [],
    allocatedFlashKb: 0,
  };
}

/**
 * Adds a wipe trail to defog the screen
 */
export function wipeScreenFog(
  state: GameEngineState,
  x: number,
  y: number,
  radius = 28
): GameEngineState {
  const newWipes = [...state.fogWipes.slice(-15), { x, y, radius }];
  const newFogLevel = Math.max(0, state.fogLevel - 0.22);
  return {
    ...state,
    fogWipes: newWipes,
    fogLevel: newFogLevel,
  };
}

/**
 * Spends a life after a fall or an enemy hit. With lives left the stage
 * restarts from its start at Base, with a moment of hit immunity; on the
 * last life the run ends with `report`.
 */
/**
 * What a hit costs under the fitness rules: Body Battery, and a mark against
 * the stage's Training Effect. Dev Mode runs pay nothing extra.
 */
function hitToll(
  state: GameEngineState
): Pick<GameEngineState, "bodyBattery" | "stageHits"> | null {
  if (!isFitnessRun(state)) return null;
  return {
    bodyBattery: adjustBodyBattery(state.bodyBattery, -BODY_BATTERY_HIT_COST),
    stageHits: (state.stageHits ?? 0) + 1,
  };
}

/** The banner when a hit knocks the runner back to Base. */
function ouchText(state: GameEngineState): string {
  if (!isFitnessRun(state)) return "OUCH · BACK TO BASE";
  return `${pickToast("hit", state.score + (state.stageHits ?? 0))} · BACK TO BASE`;
}

/** The fitness name for what ended a life, keyed by the Dev Mode crash type. */
const FITNESS_CAUSE: Partial<Record<CrashReport["errorType"], string>> = {
  "Null Pointer": "COUCH POTATO",
  "Watchdog Tripped": "SNOOZED",
  "Stack Overflow": "CLIPPED A HURDLE",
  "Segmentation Fault": "MISSED THE CURB",
  "Dropped Kettlebell": "DROPPED KETTLEBELL",
  "Gym Injury": "GYM INJURY",
};

/** The banner name for what ended a life under the run's rules. */
export function causeLabel(
  state: Pick<GameEngineState, "rules">,
  errorType: CrashReport["errorType"]
): string {
  if (isFitnessRun(state)) return FITNESS_CAUSE[errorType] ?? "DNF";
  return errorType.toUpperCase();
}

/**
 * Drops a carried medicine ball at the runner's feet on the lane (#2024), or
 * loses it when the feet are over a gap. The ball is placed by where the
 * runner stands, so a hit that costs a tier or the buddy never leaves the
 * runner holding it.
 */
/** Whether a station, plyo box or switch stands over the lane from `left` to `right`. */
function overlapsProp(
  props: CourseProps,
  left: number,
  right: number
): boolean {
  return (
    props.stations.some((p) => p.x < right && p.x + p.width > left) ||
    props.plyos.some((p) => p.x < right && p.x + p.width > left) ||
    props.switches.some((p) => p.x < right && p.x + SWITCH_WIDTH > left)
  );
}

function dropCarriedBall(
  state: GameEngineState,
  cameraX: number
): GameEngineState {
  if (!state.carrying) return state;
  const course = state.course ?? EMPTY_COURSE;
  const x = cameraX + PLAYER_X + PLAYER_WIDTH / 2 - MEDBALL_SIZE / 2;
  const cleared = { ...state, carrying: false, carryingId: undefined };
  // Dropped in mid-air, the ball is lost; on the ground it rests at the
  // feet, on the lane or a ledge, where it can be picked up again.
  if (!state.isGrounded) return cleared;
  const feetY = state.playerY + playerHeightFor(state.power);
  const onLane = Math.abs(feetY - GROUND_Y) < 1;
  if (onLane && isFootingOverGap(course, x, x + MEDBALL_SIZE)) return cleared;
  // On a station, plyo box or switch there is no lane to drop it on.
  if (overlapsProp(state.props ?? EMPTY_PROPS, x, x + MEDBALL_SIZE)) {
    return cleared;
  }
  const ball: CourseMedBall = {
    id: state.carryingId ?? 0,
    x,
    y: feetY - MEDBALL_SIZE,
  };
  return {
    ...cleared,
    course: { ...course, medBalls: [...(course.medBalls ?? []), ball] },
  };
}

/**
 * A hit taken by a rider (#2024): the buddy takes it instead of the tier.
 * The runner keeps the tier and every life, gets the damage grace, and the
 * buddy runs off ahead as a runaway pickup that can be caught again for
 * {@link BUDDY_RUNAWAY_MS}. A carried ball is dropped as in any hit.
 */
function riderLosesBuddy(
  state: GameEngineState,
  cameraX: number
): GameEngineState {
  const dropped = dropCarriedBall(state, cameraX);
  const pickups = dropped.pickups ?? [];
  const runaway: Pickup = {
    id: Math.max(0, ...pickups.map((p) => p.id)) + 1,
    kind: "buddy",
    x: cameraX + PLAYER_X + PLAYER_WIDTH + BUDDY_RUNAWAY_LEAD,
    y: state.playerY + playerHeightFor(state.power) - PICKUP_SIZE,
    vx: BUDDY_RUNAWAY_SPEED,
    vy: 0,
    emergeMs: 0,
    ttlMs: BUDDY_RUNAWAY_MS,
  };
  return {
    ...dropped,
    riding: false,
    invulnerableMs: DAMAGE_GRACE_MS,
    pickups: [...pickups, runaway],
    banner: { text: BUDDY_TOASTS.lost, ttlMs: 1400, tone: "warn" },
  };
}

/**
 * A Finisher Medal found at world (x, y) (#2025): its id joins `found`, and
 * the caller books the points and popup. A medal already found is not found
 * again, so it books nothing. Shared by the free pickup, a PR Board break and
 * a medicine ball's hit on a PR Board.
 */
function medalFind(
  found: readonly number[] | undefined,
  id: number,
  x: number,
  y: number
): { found: number[]; points: number; popups: FacePopup[] } {
  const ids = found ?? [];
  if (ids.includes(id)) return { found: [...ids], points: 0, popups: [] };
  const next = [...ids, id];
  return {
    found: next,
    points: MEDAL_SCORE,
    popups: [
      {
        x,
        y: y - 6,
        text: `MEDAL ${stageMedalCount(next, medalStage(id))}/${MEDALS_PER_STAGE}`,
        ttlMs: 900,
      },
    ],
  };
}

/**
 * Advances a thrown medicine ball one tick (#2024). The first foe it
 * overlaps is knocked out (a Rep Max takes two hit points, as a stomp does),
 * the first brick it overlaps breaks for the PR Board reward, and a sync
 * block or a fromKudos brick just stops it. Otherwise it flies on, and where
 * it lands it rests on the course as a medicine ball again.
 */
function stepThrownMedBallOnce(
  state: GameEngineState,
  cameraX: number,
  deltaMs: number
): GameEngineState {
  const ball = state.thrownBall;
  if (!ball) return state;
  const course = state.course ?? EMPTY_COURSE;
  const foes = state.foes ?? [];
  const foeIdx = foes.findIndex((f) => {
    const box = foeBox(f);
    return ballHits(ball, box.left, box.top, box.right, box.bottom);
  });
  if (foeIdx !== -1) {
    const foe = foes[foeIdx];
    const hit =
      foe.kind === "repmax"
        ? damageFoe(foe, 2)
        : { foe: null, score: MEDBALL_KO_SCORE };
    const points = hit.score;
    const survivor = hit.foe;
    const nextFoes = survivor
      ? foes.map((f, i) => (i === foeIdx ? survivor : f))
      : foes.filter((_, i) => i !== foeIdx);
    const fitness = isFitnessRun(state);
    return {
      ...state,
      thrownBall: null,
      foes: nextFoes,
      score: state.score + points,
      highScore: Math.max(state.highScore, state.score + points),
      ...(points > 0 && fitness
        ? { stageFoes: (state.stageFoes ?? 0) + 1 }
        : {}),
      popups:
        points > 0
          ? [
              ...(state.popups ?? []),
              {
                x: foe.x,
                y: foe.y - 6,
                text: `+${points}`,
                ttlMs: 800,
              },
            ]
          : state.popups,
    };
  }
  const blockIdx = course.blocks.findIndex((b) =>
    ballHits(ball, b.x, b.y, b.x + BLOCK_SIZE, b.y + BLOCK_SIZE)
  );
  if (blockIdx !== -1) {
    const block = course.blocks[blockIdx];
    if (block.kind !== "brick" || block.fromKudos) {
      return { ...state, thrownBall: null };
    }
    // A PR Board hiding a Finisher Medal gives it up too (#2025).
    const medal =
      block.contents === "medal" && block.medalId !== undefined
        ? medalFind(state.medalsFound, block.medalId, block.x, block.y)
        : null;
    const points = PR_BOARD_SCORE + (medal?.points ?? 0);
    return {
      ...state,
      thrownBall: null,
      course: {
        ...course,
        blocks: course.blocks.filter((_, i) => i !== blockIdx),
      },
      score: state.score + points,
      highScore: Math.max(state.highScore, state.score + points),
      ...(medal ? { medalsFound: medal.found } : {}),
      popups: [
        ...(state.popups ?? []),
        { x: block.x, y: block.y - 6, text: "NEW PR!", ttlMs: 900 },
        ...(medal?.popups ?? []),
      ],
    };
  }
  const stepped = stepThrownBall(
    ball,
    course,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    deltaMs
  );
  if (stepped.landed) {
    const landed = stepped.landed;
    // A ball that comes down inside a station, plyo box or switch is lost.
    const buried = overlapsProp(
      state.props ?? EMPTY_PROPS,
      landed.x,
      landed.x + MEDBALL_SIZE
    );
    return {
      ...state,
      thrownBall: null,
      course: buried
        ? course
        : { ...course, medBalls: [...(course.medBalls ?? []), landed] },
    };
  }
  return { ...state, thrownBall: stepped.ball };
}

/**
 * Moves a thrown medicine ball through `deltaMs` in frame-sized steps, so a
 * long frame can't carry it through a foe or a brick without a hit.
 */
function stepThrownMedBall(
  state: GameEngineState,
  cameraX: number,
  deltaMs: number
): GameEngineState {
  const frameMs = 1000 / 60;
  let next = state;
  let left = deltaMs;
  for (let i = 0; i < 300 && left > 0 && next.thrownBall; i++) {
    const dt = Math.min(frameMs, left);
    next = stepThrownMedBallOnce(next, cameraX, dt);
    left -= dt;
  }
  return next;
}

function loseLife(
  state: GameEngineState,
  report: CrashReport,
  now: number = clockNow(state)
): GameEngineState {
  const lives = (state.lives ?? 1) - 1;
  const toll = hitToll(state);
  const fitnessToll = toll
    ? { ...toll, stageLivesLost: (state.stageLivesLost ?? 0) + 1 }
    : {};
  if (lives <= 0) {
    return {
      ...state,
      ...fitnessToll,
      lives: 0,
      gameState: "crashed",
      crashReport: report,
      riding: false,
      carrying: false,
      carryingId: undefined,
      thrownBall: null,
      secondWind: null,
    };
  }
  const stage = state.stage ?? 1;
  // An Aid Station touched on this stage is where the stage restarts (#2025).
  const cp =
    state.checkpoint && state.checkpoint.stage === stage
      ? state.checkpoint
      : null;
  const fresh = stageSetup(stage, state.courseSeed ?? 0, state.medalsFound);
  // A foe near the Aid Station is left behind, so the restart is safe.
  const foes = cp
    ? fresh.foes.filter((f) => !(f.x + f.width > cp.x - 40 && f.x < cp.x + 160))
    : fresh.foes;
  return {
    ...state,
    ...fitnessToll,
    lives,
    power: "base",
    starMs: 0,
    invulnerableMs: DAMAGE_GRACE_MS,
    // The runner's world left lands on the Aid Station, or the stage start.
    distanceMeters: cp
      ? (cp.x - PLAYER_X) / PX_PER_METER
      : stageStartX(stage) / PX_PER_METER,
    playerY: GROUND_Y - PLAYER_HEIGHT,
    playerVy: 0,
    isGrounded: true,
    jumpHeld: false,
    coyoteMs: 0,
    jumpBufferMs: 0,
    stompChain: 0,
    obstacles: [],
    pickups: [],
    bolts: [],
    boltCooldownMs: 0,
    // A life lost takes the buddy and any ball with it; the moves that
    // were toasted stay toasted (medBallToasted, like movesUsed).
    riding: false,
    carrying: false,
    carryingId: undefined,
    thrownBall: null,
    // A Second Wind ends with the life (#2026).
    secondWind: null,
    paceMeter: 0,
    flightMs: 0,
    spinMs: 0,
    spinCooldownMs: 0,
    strokeCooldownMs: 0,
    // The moves end with the life; movesUsed stays, so a toast shows once per run.
    slamming: false,
    spinJump: false,
    wallSide: false,
    wallJumpReady: false,
    course: state.race
      ? keepLiveKudos(
          fresh.course,
          state.bonusRoom?.returnCourse ?? state.course ?? EMPTY_COURSE
        )
      : fresh.course,
    props: fresh.props,
    foes,
    foeShots: [],
    restDayMs: 0,
    bonusRoom: null,
    lastObstacleTime: now,
    banner: {
      text: `${causeLabel(state, report.errorType)} · LIVES ${lives}`,
      ttlMs: 2200,
      tone: "warn",
    },
  };
}

/** The crash a foe or its shot causes on the runner's last hit. */
function foeCrashReport(
  state: GameEngineState,
  source: FoeKind | FoeShot["kind"]
): CrashReport {
  const names: Record<FoeKind | FoeShot["kind"], string> = {
    kettlebell: "Kettlebell",
    alert: "Move Alert",
    box: "Box Jumper",
    lap: "Auto Lap",
    repmax: "Rep Max",
    jellyfish: "Jellyfish",
    goggles: "Lost Goggles",
    ping: "Auto Lap ping",
    dumbbell: "Rep Max dumbbell",
    wall: "The Wall",
    brick: "Wall brick",
  };
  const dropped = source === "kettlebell";
  return {
    errorType: dropped ? "Dropped Kettlebell" : "Gym Injury",
    file: "MonkeyC_Mayhem_App.mc",
    line: dropped ? 163 : 201,
    stackTrace: dropped
      ? [
          "Dropped Kettlebell: never skip leg day",
          `Runner hit by a ${names[source]}`,
          "at MonkeyC_Mayhem_App.onStep() [App.mc:163]",
        ]
      : [
          "Gym Injury: one rep too many",
          `Runner hit by a ${names[source]}`,
          "at MonkeyC_Mayhem_App.onStep() [App.mc:201]",
        ],
    heapUsedKb: state.allocatedRamKb,
    heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
  };
}

/**
 * Moves the course foes and their shots, then settles everything they touch:
 * sliding shells, heat bolts, cape spins and the Runner's High defeat them,
 * stomps tip, clip or flatten them, and a foe or shot that reaches the
 * runner hurts like any bug. Sliding shells also flatten the drifting bugs
 * in `obstacles` (screen coordinates).
 */
/**
 * Whether a foe is under a Burpee Slam's feet: it overlaps the foot span and
 * its bottom is level with the surface the runner landed on. A drifting
 * Jellyfish floats above that surface and is never slammed.
 */
function slamTarget(
  f: Foe,
  slam: { footLeft: number; footRight: number; top: number }
): boolean {
  if (f.mode === "drift") return false;
  if (!(f.x + f.width > slam.footLeft && f.x < slam.footRight)) return false;
  return Math.abs(f.y + f.height - slam.top) <= SLAM_REACH;
}

/**
 * The popup for a stomp in a chain: the points and the chain count, or under
 * fitness rules from the third stomp on, a running toast.
 */
function chainLabel(
  state: Pick<GameEngineState, "rules">,
  points: number,
  chain: number
): string | undefined {
  if (chain <= 1 || points <= 0) return undefined;
  if (isFitnessRun(state) && chain >= 3) {
    return `${pickToast("stomp-chain", chain)} x${chain}`;
  }
  return `+${points} x${chain}`;
}

function updateCourseFoes(
  state: GameEngineState,
  obstacles: readonly Obstacle[],
  ctx: {
    cameraX: number;
    bodyH: number;
    prevBottom: number;
    spinning: boolean;
    deltaMs: number;
    /** The Burpee Slam landing this step: its foot span and the surface it hit. */
    slam: { footLeft: number; footRight: number; top: number } | null;
  }
): {
  state: GameEngineState;
  obstacles: Obstacle[];
  lost: boolean;
  /** Fun Run high fives this step (#2026). */
  highFives: number;
} {
  const startFoes = state.foes ?? [];
  const startShots = state.foeShots ?? [];
  if (startFoes.length === 0 && startShots.length === 0) {
    return { state, obstacles: obstacles.slice(), lost: false, highFives: 0 };
  }
  const { cameraX, bodyH, prevBottom, spinning, deltaMs, slam } = ctx;
  const spinJumping = state.spinJump === true;
  const runnerX = cameraX + PLAYER_X + PLAYER_WIDTH / 2;
  const stepped = stepFoes(
    startFoes,
    startShots,
    state.course ?? EMPTY_COURSE,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    deltaMs,
    runnerX,
    state.foeShotsFired ?? 0
  );
  let foes = stepped.foes;
  // Fun Run (#2026): no foe shoots, and any shot in the air is cleared.
  const funRun = state.secondWind?.kind === "funrun";
  let shots = funRun ? [] : stepped.shots;
  let score = 0;
  const popups = [...(state.popups ?? [])];
  let defeats = 0;
  let highFives = 0;
  const fitness = isFitnessRun(state);
  const award = (f: Foe, points: number, label = `+${points}`) => {
    if (points <= 0) return;
    defeats += 1;
    score += points;
    // Beating the Rep Max under fitness rules gets a gym toast.
    const text =
      fitness && f.kind === "repmax" && points >= REPMAX_SCORE
        ? pickToast("rep-max", state.score + score)
        : label;
    popups.push({ x: f.x, y: f.y - 6, text, ttlMs: 800 });
  };
  // Hits that wear the foe down; a defeated one is dropped.
  const hitFoe = (f: Foe, amount: number): Foe | null => {
    const hit = damageFoe(f, amount);
    award(f, hit.score);
    return hit.foe;
  };

  // Sliding shells flatten other foes.
  const sweep = shellSweep(foes);
  for (const h of sweep.hits) award(h.foe, h.score);
  foes = sweep.foes;

  // Heat bolts: each is spent on the first foe it touches.
  let bolts = state.bolts ?? [];
  if (bolts.length > 0) {
    const keptBolts: Bolt[] = [];
    for (const b of bolts) {
      const idx = foes.findIndex((f) => {
        const box = foeBox(f);
        return boltHits(b, box.left, box.top, box.right, box.bottom);
      });
      if (idx === -1) {
        keptBolts.push(b);
        continue;
      }
      const left = hitFoe(foes[idx], 1);
      foes = left
        ? foes.map((f, i) => (i === idx ? left : f))
        : foes.filter((_, i) => i !== idx);
    }
    bolts = keptBolts;
  }

  const runnerBox = {
    left: cameraX + PLAYER_X + 2,
    right: cameraX + PLAYER_X + PLAYER_WIDTH - 2,
    top: state.playerY + 2,
    bottom: state.playerY + bodyH - 2,
  };
  // A cape spin hits every foe beside the runner.
  if (spinning) {
    const kept: Foe[] = [];
    for (const f of foes) {
      if (inSpinReach(runnerBox, foeBox(f))) {
        const left = hitFoe(f, 1);
        if (left) kept.push(left);
      } else {
        kept.push(f);
      }
    }
    foes = kept;
  }

  const star = (state.starMs ?? 0) > 0;
  const invulnerable = (state.invulnerableMs ?? 0) > 0;
  let next: GameEngineState = state;
  let hurtBy: FoeKind | FoeShot["kind"] | null = null;
  const kept: Foe[] = [];
  // Every foe is judged against the fall the runner came in with, so a stomp
  // bounce doesn't turn a second foe landed on in the same tick into a hit.
  const landingVy = state.playerVy;
  // Fun Run: a foe the runner touches from any side (a slam included) is a
  // high five, which the Rep Max never is.
  const touching = (f: Foe) =>
    (slam !== null && slamTarget(f, slam)) ||
    runnerContact(f, runnerBox, prevBottom, landingVy) !== "none";
  for (const f of foes) {
    if (funRun && f.kind !== "repmax" && f.kind !== "wall" && touching(f)) {
      highFives += 1;
      score += KUDOS_SCORE;
      popups.push({ x: f.x, y: f.y - 6, text: "HIGH FIVE!", ttlMs: 800 });
      continue;
    }
    // A Burpee Slam landing stomps the foe under the feet, with the same
    // result a stomp has on that foe (a kettlebell rolls, a Rep Max loses a
    // hit point).
    if (slam && slamTarget(f, slam)) {
      const hit = stompFoe(f, runnerX);
      award(f, hit.score);
      if (hit.foe) kept.push(hit.foe);
      continue;
    }
    const contact = runnerContact(f, runnerBox, prevBottom, landingVy);
    // A Spin Jump coming down onto a spiky foe bounces off it: no harm, and
    // the foe is left alone.
    if (
      contact !== "none" &&
      spinJumping &&
      isSpikyFoe(f.kind) &&
      landingVy > 0 &&
      prevBottom <= f.y + STOMP_WINDOW
    ) {
      next = {
        ...next,
        playerY: Math.min(next.playerY, f.y - bodyH),
        playerVy: SPIN_JUMP_VY,
        jumpBufferMs: 0,
      };
      kept.push(f);
      continue;
    }
    if (contact === "stomp") {
      const hit = stompFoe(f, runnerX);
      // A stomp the Rep Max shrugs off during its grace doesn't build the chain.
      const chain = (next.stompChain ?? 0) + (hit.score > 0 ? 1 : 0);
      const points =
        hit.score > 0 ? Math.min(3200, hit.score * 2 ** (chain - 1)) : 0;
      award(f, points, chainLabel(state, points, chain));
      const buffered = (next.jumpBufferMs ?? 0) > 0;
      next = {
        ...next,
        playerY: Math.min(next.playerY, f.y - bodyH),
        playerVy: buffered
          ? JUMP_FORCE + (next.riding ? BUDDY_JUMP_BONUS_VY : 0)
          : STOMP_BOUNCE_VY,
        jumpBufferMs: 0,
        stompChain: chain,
      };
      if (hit.foe) kept.push(hit.foe);
      continue;
    }
    if (contact === "kick") {
      award(f, FOE_STOMP_SCORE);
      kept.push(kickShell(f, runnerX));
      continue;
    }
    if (contact === "hurt") {
      if (star) {
        const left = hitFoe(f, REPMAX_HP_ALL);
        if (left) kept.push(left);
        continue;
      }
      // A rider's buddy eats a small foe it runs into, with no harm (#2024).
      if (next.riding && isEdibleFoe(f)) {
        award(f, BUDDY_EAT_SCORE);
        continue;
      }
      if (!invulnerable && hurtBy === null) hurtBy = f.kind;
    }
    kept.push(f);
  }
  foes = kept;

  // Shots: a Runner's High burns them off; otherwise they hurt.
  shots = shots.filter((sh) => {
    if (!overlaps(runnerBox, shotBox(sh))) return true;
    if (star) return false;
    if (invulnerable) return true;
    if (hurtBy === null) hurtBy = sh.kind;
    return false;
  });

  // Sliding shells flatten drifting bugs too, spiked ones included.
  const shells = foes.filter((f) => f.mode === "kicked");
  let keptObstacles = obstacles.slice();
  if (shells.length > 0) {
    keptObstacles = obstacles.filter((o) => {
      const walker =
        o.type === "null_pointer" ||
        o.type === "watchdog" ||
        o.type === "stack_overflow";
      if (!walker) return true;
      const box = {
        left: cameraX + o.x + 2,
        right: cameraX + o.x + o.width - 2,
        top: o.y + 2,
        bottom: o.y + o.height - 2,
      };
      if (!shells.some((sh) => overlaps(foeBox(sh), box))) return true;
      score += FOE_DEFEAT_SCORE;
      popups.push({
        x: cameraX + o.x,
        y: o.y - 6,
        text: `+${FOE_DEFEAT_SCORE}`,
        ttlMs: 800,
      });
      return false;
    });
  }

  next = {
    ...next,
    foes,
    foeShots: shots,
    foeShotsFired: stepped.nextShotId,
    bolts,
    ...(defeats > 0 && isFitnessRun(next)
      ? { stageFoes: (next.stageFoes ?? 0) + defeats }
      : {}),
    kudos: (next.kudos ?? 0) + highFives,
    score: next.score + score,
    highScore: Math.max(next.highScore, next.score + score),
    popups,
  };

  if (hurtBy !== null) {
    // A rider's buddy takes the hit: the tier and every life are kept (#2024).
    if (next.riding) {
      next = riderLosesBuddy(next, cameraX);
    } else {
      const hit = damageTier(next.power);
      if (!hit.survived) {
        return {
          state: loseLife(
            { ...next, obstacles: keptObstacles },
            foeCrashReport(next, hurtBy)
          ),
          obstacles: [],
          lost: true,
          highFives,
        };
      }
      next = dropCarriedBall(
        {
          ...next,
          ...hitToll(next),
          power: hit.power,
          playerY: next.playerY + bodyH - playerHeightFor(hit.power),
          invulnerableMs: DAMAGE_GRACE_MS,
          banner: { text: ouchText(next), ttlMs: 1400, tone: "warn" },
        },
        cameraX
      );
    }
  }
  return { state: next, obstacles: keptObstacles, lost: false, highFives };
}

/** Enough damage to defeat any foe outright. */
const REPMAX_HP_ALL = 99;

/**
 * Primary Game Physics & Simulation Update Loop (Called by requestAnimationFrame)
 */
export function updateGameSimulation(
  state: GameEngineState,
  deltaMs: number
): GameEngineState {
  const stepped = stepSimulation(state, deltaMs);
  const safeDelta = Number.isFinite(deltaMs) ? clamp(deltaMs, 0, 5000) : 0;
  // A race's own clocks run on every playing tick, GPS lock included (#2019).
  const next: GameEngineState =
    state.race && state.gameState === "playing"
      ? {
          ...stepped,
          simMs: (state.simMs ?? 0) + safeDelta,
          ...(state.bodyBattery?.bonked
            ? { bonkedMs: (state.bonkedMs ?? 0) + safeDelta }
            : {}),
        }
      : stepped;
  // The run clock counts game time while the run is live: not while paused
  // or over, and not while the fitness run waits for GPS (#2018).
  const clockRunning =
    state.gameState === "playing" &&
    !(isFitnessRun(state) && (state.gpsMs ?? 0) > 0);
  if (!clockRunning) return next;
  return {
    ...next,
    runClockMs: (state.runClockMs ?? 0) + safeDelta,
    furthestMeters: Math.max(
      state.furthestMeters ?? 0,
      Number.isFinite(next.distanceMeters) ? next.distanceMeters : 0
    ),
  };
}

/**
 * Advances the Second Wind `wind` one tick on `state` (#2026): its timer and
 * goal, the medal a met goal pays, and the banner when it ends. A stage clear
 * (`stageCleared`) ends it quietly, so the stage's own banner stays.
 */
function tickSecondWind(
  state: GameEngineState,
  wind: SecondWind | null,
  tick: SecondWindTick,
  at: { x: number; y: number },
  stageCleared: boolean
): GameEngineState {
  if (!wind) return state;
  const result = stepSecondWind(wind, tick);
  const cleared = wind.cleared || result.goalMet;
  let medalsFound = state.medalsFound ?? [];
  let score = state.score;
  const popups: FacePopup[] = [...(state.popups ?? [])];
  if (result.goalMet) {
    if (wind.medalId !== undefined) {
      const medal = medalFind(medalsFound, wind.medalId, at.x, at.y);
      medalsFound = medal.found;
      score += medal.points;
      popups.push(...medal.popups);
    }
    popups.push({
      x: at.x,
      y: at.y - 14,
      text: SECOND_WIND_GOAL_TOAST,
      ttlMs: 1400,
    });
  }
  let banner = state.banner ?? null;
  if (result.ended && !stageCleared) {
    banner = {
      text: `${SECOND_WIND_EVENTS[wind.kind].name} OVER`,
      ttlMs: 2200,
      tone: cleared ? "good" : "warn",
    };
  }
  return {
    ...state,
    secondWind: stageCleared ? null : result.wind,
    medalsFound,
    score,
    highScore: Math.max(state.highScore, score),
    popups,
    banner,
  };
}

/** One simulation step; {@link updateGameSimulation} adds the run clock. */
function stepSimulation(
  state: GameEngineState,
  deltaMs: number
): GameEngineState {
  const fitness = isFitnessRun(state);
  const rand = randomFor(state);
  if (state.gameState !== "playing" || (!fitness && state.battery <= 0)) {
    if (state.gameState === "playing" && state.battery <= 0) {
      const penalty = 50;
      const penalizedScore = Math.max(0, state.score - penalty);
      return {
        ...state,
        battery: 0,
        isLightOn: false,
        score: penalizedScore,
        gameState: "shutdown",
        crashReport: {
          errorType: "Power Loss",
          file: "PowerManager.mc",
          line: 1,
          stackTrace: [
            "CRITICAL VOLTAGE BROWNOUT DETECTED",
            "Battery power dropped to 0.0%",
            "Engine updates & physics halted",
            `Power loss penalty applied: -${penalty} PTS`,
          ],
          heapUsedKb: state.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
          flashUsedKb: state.allocatedFlashKb,
          flashLimitKb: DEVICE_PROFILES[state.device].flashLimitKb,
        },
      };
    }
    return state;
  }

  const safeDelta = Number.isFinite(deltaMs) ? clamp(deltaMs, 0, 5000) : 0;
  const tuning = state.tuning ?? DEFAULT_RUN_TUNING;
  const drainScale = tuning.batteryDrainScale;

  // Waiting for GPS: the fitness run holds at the start line until the
  // watch has a lock, then goes.
  if (fitness && (state.gpsMs ?? 0) > 0) {
    const gpsMs = Math.max(0, (state.gpsMs ?? 0) - safeDelta);
    const elapsed = GPS_LOCK_MS - gpsMs;
    return {
      ...state,
      gpsMs,
      banner: {
        text: gpsBannerText(elapsed),
        ttlMs: gpsMs > 0 ? gpsMs + 1800 : 1800,
        tone: gpsMs > 0 ? "info" : "good",
      },
    };
  }

  // Handle GC Freeze (Dev Mode only)
  if (state.isGcActive && !fitness) {
    const remainingGc = state.gcTimerMs - safeDelta;

    // Calculate battery, backlight, thermal stress, fog level updates during GC
    const ramLimit = DEVICE_PROFILES[state.device].ramLimitKb;
    const ramPct = state.allocatedRamKb / ramLimit;

    const baseDrainPerMs = 0.0001;
    const lightDrainPerMs = 0.0003;
    const totalDrain =
      (baseDrainPerMs + (state.isLightOn ? lightDrainPerMs : 0)) *
      safeDelta *
      drainScale;
    const nextBattery = Math.max(0, state.battery - totalDrain);

    let nextLight = state.isLightOn;
    if (nextBattery <= 0) {
      nextLight = false;
    }

    let lightDuration = state.lightActiveDurationMs;
    if (state.isLightOn) {
      lightDuration += safeDelta;
    } else {
      lightDuration = Math.max(0, lightDuration - safeDelta * 0.5);
    }

    const backlightStress = state.isLightOn
      ? Math.min(1.0, lightDuration / 6000)
      : 0;
    const ramStress =
      ramPct > 0.8 ? Math.min(1.0, 0.4 + (ramPct - 0.8) * 3.0) : 0;
    const gcStress = 1.0; // GC is active!

    const targetStress = Math.max(backlightStress, ramStress, gcStress);
    let nextThermalStress = state.thermalStress ?? 0;
    if (targetStress > nextThermalStress) {
      nextThermalStress = Math.min(
        targetStress,
        nextThermalStress + 0.0005 * safeDelta
      );
    } else {
      nextThermalStress = Math.max(
        targetStress,
        nextThermalStress - (1.0 / 14900) * safeDelta
      );
    }

    let nextFogLevel = state.fogLevel;
    if (nextThermalStress > nextFogLevel) {
      nextFogLevel = Math.min(
        nextThermalStress,
        nextFogLevel + 0.0004 * safeDelta
      );
    } else {
      nextFogLevel = Math.max(
        nextThermalStress,
        nextFogLevel - (1.0 / 14900) * safeDelta
      );
    }

    if (nextBattery <= 0) {
      const penalty = 50;
      const penalizedScore = Math.max(0, state.score - penalty);
      return {
        ...state,
        battery: 0,
        isLightOn: false,
        score: penalizedScore,
        gameState: "shutdown",
        isGcActive: false,
        gcTimerMs: 0,
        crashReport: {
          errorType: "Power Loss",
          file: "PowerManager.mc",
          line: 1,
          stackTrace: [
            "CRITICAL VOLTAGE BROWNOUT DETECTED",
            "Battery power dropped to 0.0%",
            "Engine updates & physics halted",
            `Power loss penalty applied: -${penalty} PTS`,
          ],
          heapUsedKb: state.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
          flashUsedKb: state.allocatedFlashKb,
          flashLimitKb: DEVICE_PROFILES[state.device].flashLimitKb,
        },
      };
    }

    if (remainingGc <= 0) {
      return {
        ...state,
        battery: nextBattery,
        isLightOn: nextLight,
        lightActiveDurationMs: lightDuration,
        thermalStress: nextThermalStress,
        fogLevel: nextFogLevel,
        isGcActive: false,
        gcTimerMs: 0,
      };
    }
    return {
      ...state,
      battery: nextBattery,
      isLightOn: nextLight,
      lightActiveDurationMs: lightDuration,
      thermalStress: nextThermalStress,
      fogLevel: nextFogLevel,
      gcTimerMs: remainingGc,
    };
  }

  const dtRatio = safeDelta / 16.666;

  // 1. Battery Drain & Overheating Mechanics
  let nextBattery = state.battery;
  let lightDuration = state.lightActiveDurationMs;

  // Base battery drain: 0.1%/sec; With light: +0.3%/sec (0.4%/sec total).
  // Battery is kept unrounded: a frame drains about 0.0017%, which rounding
  // to two decimals would undo every frame. Round only for display.
  // The fitness rules have no watch battery: Body Battery takes its place.
  const baseDrainPerMs = 0.0001;
  const lightDrainPerMs = 0.0003;
  const totalDrain = fitness
    ? 0
    : (baseDrainPerMs + (state.isLightOn ? lightDrainPerMs : 0)) *
      safeDelta *
      drainScale;
  nextBattery = Math.max(0, nextBattery - totalDrain);

  let nextLight = state.isLightOn;
  if (nextBattery <= 0) {
    nextLight = false;
    nextBattery = 0;
  }

  if (nextBattery <= 0) {
    const penalty = 50;
    const penalizedScore = Math.max(0, state.score - penalty);
    return {
      ...state,
      battery: 0,
      isLightOn: false,
      score: penalizedScore,
      gameState: "shutdown",
      crashReport: {
        errorType: "Power Loss",
        file: "PowerManager.mc",
        line: 1,
        stackTrace: [
          "CRITICAL VOLTAGE BROWNOUT DETECTED",
          "Battery power dropped to 0.0%",
          "Engine updates & physics halted",
          `Power loss penalty applied: -${penalty} PTS`,
        ],
        heapUsedKb: state.allocatedRamKb,
        heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
        flashUsedKb: state.allocatedFlashKb,
        flashLimitKb: DEVICE_PROFILES[state.device].flashLimitKb,
      },
    };
  }

  if (state.isLightOn) {
    lightDuration += safeDelta;
  } else {
    lightDuration = Math.max(0, lightDuration - safeDelta * 0.5);
  }

  const ramLimit = DEVICE_PROFILES[state.device].ramLimitKb;
  const ramPct = state.allocatedRamKb / ramLimit;

  // Calculate combined target stress
  const backlightStress = state.isLightOn
    ? Math.min(1.0, lightDuration / 6000)
    : 0;
  const ramStress =
    ramPct > 0.8 ? Math.min(1.0, 0.4 + (ramPct - 0.8) * 3.0) : 0;
  const gcStress = state.isGcActive ? 0.8 : 0;

  // No heat and no fog under the fitness rules.
  const targetStress = fitness
    ? 0
    : Math.max(backlightStress, ramStress, gcStress);
  let nextThermalStress = fitness ? 0 : (state.thermalStress ?? 0);
  if (targetStress > nextThermalStress) {
    nextThermalStress = Math.min(
      targetStress,
      nextThermalStress + 0.0005 * safeDelta
    );
  } else {
    nextThermalStress = Math.max(
      targetStress,
      nextThermalStress - (1.0 / 14900) * safeDelta
    );
  }

  let nextFogLevel = fitness ? 0 : state.fogLevel;
  if (nextThermalStress > nextFogLevel) {
    nextFogLevel = Math.min(
      nextThermalStress,
      nextFogLevel + 0.0004 * safeDelta
    );
  } else {
    nextFogLevel = Math.max(
      nextThermalStress,
      nextFogLevel - (1.0 / 14900) * safeDelta
    );
  }

  // 2. Pace, camera and platformer physics (#1950). The camera sits at ten
  // world pixels per metre; the runner stays at PLAYER_X on screen.
  // A bonked runner can only jog.
  const runInput = fitness
    ? effectiveRunInput(state.bodyBattery, state.runInput)
    : state.runInput;
  // Race Day scrolls at a steady race pace (#1994).
  const pace = state.plan?.raceDay ? 1 : paceFor(runInput);
  // Body Battery gained or spent this tick by Kudos, power-ups and the pole.
  let bodyBatteryChange = 0;
  // Course props (#1992): the belts run on their own clock, a belt carries
  // the runner standing on it, and the side of a station or box stops them.
  let props = state.props ?? EMPTY_PROPS;
  const prevClockMs = state.propClockMs ?? 0;
  const propClockMs = prevClockMs + safeDelta;
  const prevCameraX = state.distanceMeters * PX_PER_METER;
  const prevFeetBottom = state.playerY + playerHeightFor(state.power ?? "base");
  const carry = state.isGrounded
    ? beltCarry(props, prevCameraX, prevFeetBottom, prevClockMs, propClockMs)
    : { dx: 0, dy: 0 };
  // Swimming (#1993): stroke-paced progress plus the Open Water currents
  // under the runner. A stroke's progress never runs backwards.
  const swimming = isUnderwater(state);
  const suitOn = (state.power ?? "base") === "trisuit";
  const swimLeft = prevCameraX + PLAYER_X;
  const currentPush = currentFlow(
    (state.course ?? EMPTY_COURSE).currents,
    swimLeft,
    swimLeft + PLAYER_WIDTH
  );
  // Wading along the bottom is far slower than swimming, so strokes pay.
  const swimPace =
    (suitOn ? SUIT_SWIM_PACE : SWIM_PACE) *
    (state.isGrounded ? WADE_PACE_SCALE : 1);
  const progress = swimming
    ? Math.max(0, (0.25 * pace * swimPace + currentPush) * dtRatio)
    : 0.25 * pace * dtRatio;
  // Hill Repeats (#2026) slows the climbs and quickens the descents.
  const hillScale = hillSpeedScale(state.secondWind, prevCameraX + PLAYER_X);
  let nextDistance =
    state.distanceMeters + progress * hillScale + carry.dx / PX_PER_METER;
  const wall = wallAhead(
    props,
    GROUND_Y,
    prevCameraX + PLAYER_X + PLAYER_WIDTH - 3,
    nextDistance * PX_PER_METER + PLAYER_X + PLAYER_WIDTH - 3,
    prevFeetBottom + carry.dy
  );
  if (wall !== null) {
    nextDistance = Math.max(
      state.distanceMeters,
      (wall - PLAYER_X - PLAYER_WIDTH + 3) / PX_PER_METER
    );
  }
  const cameraX = nextDistance * PX_PER_METER;
  const footLeft = cameraX + PLAYER_X + 5;
  const footRight = cameraX + PLAYER_X + PLAYER_WIDTH - 5;
  const bodyLeft = cameraX + PLAYER_X + 3;
  const bodyRight = cameraX + PLAYER_X + PLAYER_WIDTH - 3;
  let course = state.course ?? EMPTY_COURSE;
  // A Rest Day ends: the swapped bricks and Kudos turn back.
  let restDayMs = Math.max(0, (state.restDayMs ?? 0) - safeDelta);
  if ((state.restDayMs ?? 0) > 0 && restDayMs === 0) {
    course = restDaySwap(course, false);
  }
  let score = state.score;
  let kudos = state.kudos ?? 0;
  // Finisher Medals, the Aid Station and secret exits this run (#2025).
  let medalsFound = state.medalsFound ?? [];
  let checkpoint: CourseCheckpoint | null = state.checkpoint ?? null;
  let secretExits = state.secretExits ?? [];
  let power: PowerTier = state.power ?? "base";
  // A Running Buddy under the runner (#2024); a catch below mounts it.
  let riding = state.riding === true;
  let lives = state.lives;
  let starMs = Math.max(0, (state.starMs ?? 0) - safeDelta);
  let pickups = state.pickups ?? [];
  // Race-only tallies (#2019): a Training Run keeps neither.
  const racing = state.race != null;
  let kudosMissed = state.kudosMissed ?? 0;
  let gearTaken = state.gearTaken === true;
  // The runner's box grows when Buff; its top is playerY, its feet stay put.
  const h = playerHeightFor(power);
  let stage = state.stage ?? 1;
  let banner = state.banner ?? null;
  // The Second Wind running this tick; a wind Sync Block may start one (#2026).
  let wind: SecondWind | null = state.secondWind ?? null;
  const popups: FacePopup[] = [];
  for (const p of state.popups ?? []) {
    const ttlMs = p.ttlMs - safeDelta;
    if (ttlMs > 0) popups.push({ ...p, y: p.y - 0.4 * dtRatio, ttlMs });
  }
  if (banner) {
    const ttlMs = banner.ttlMs - safeDelta;
    banner = ttlMs > 0 ? { ...banner, ttlMs } : null;
  }
  // The banner carried in from last frame; anything else was set this frame.
  const carriedBanner = banner;
  // A Buff or stronger runner breaks a PR Board (a brick) from below.
  const breakBoard = (index: number) => {
    const block = course.blocks[index];
    course = {
      ...course,
      blocks: course.blocks.filter((_, i) => i !== index),
    };
    score += PR_BOARD_SCORE;
    popups.push({ x: block.x, y: block.y - 6, text: "NEW PR!", ttlMs: 900 });
    // A PR Board hiding a Finisher Medal gives it up too (#2025).
    if (block.contents === "medal" && block.medalId !== undefined) {
      const medal = medalFind(medalsFound, block.medalId, block.x, block.y);
      medalsFound = medal.found;
      score += medal.points;
      popups.push(...medal.popups);
    }
  };
  // Bumping an unused Sync Block uses it up and pays out its contents.
  const bumpBlock = (index: number) => {
    const block = course.blocks[index];
    if (block.kind !== "sync" || block.used) return;
    if (block.contents === "wind") {
      // A Second Wind (#2026) starts unless one is already running, and the
      // block stays unused until it can. Its medal is paid on the goal, and a
      // found medal starts the event with none.
      if (!wind) {
        const blocks = course.blocks.slice();
        blocks[index] = { ...block, used: true };
        course = { ...course, blocks };
        score += SYNC_BLOCK_SCORE;
        const kind = block.windKind ?? "taper";
        const medalId =
          block.medalId !== undefined && !medalsFound.includes(block.medalId)
            ? block.medalId
            : undefined;
        wind = startSecondWind(kind, stage, medalId);
        banner = {
          text: `${SECOND_WIND_EVENTS[kind].name} · ${SECOND_WIND_EVENTS[kind].goalText}`,
          ttlMs: 2200,
          tone: "good",
        };
      }
      return;
    }
    const blocks = course.blocks.slice();
    blocks[index] = { ...block, used: true };
    course = { ...course, blocks };
    // A No Gear race pays Kudos for gear, so no block forces gear on the
    // runner (#2019).
    const reward =
      state.race?.category === "nogear"
        ? "kudos"
        : blockReward(block.contents, power);
    if (reward === "kudos") {
      kudos += 1;
      score += KUDOS_SCORE + SYNC_BLOCK_SCORE;
      popups.push({
        x: block.x,
        y: block.y - 6,
        text: `+${KUDOS_SCORE + SYNC_BLOCK_SCORE}`,
        ttlMs: 800,
      });
    } else {
      score += SYNC_BLOCK_SCORE;
      pickups = [...pickups, emergePickup(reward, block, block.id)];
    }
  };

  const jumpHeld = state.jumpHeld ?? false;
  // A Spin Jump floats: a lighter pull and a slower fall, until it lands.
  // The rise is untouched, so a spin never reaches higher than the jump.
  const spinJumping = state.spinJump === true;
  const spinFalling = spinJumping && state.playerVy >= 0;
  // Swimming sinks under lighter gravity, and a Tri Suit sinks slower still.
  // On land a Tri Suit rise gets no float.
  const landGravity = spinFalling
    ? SPIN_GRAVITY
    : state.playerVy < 0 && jumpHeld && !suitOn
      ? GRAVITY
      : FALL_GRAVITY;
  const gravity = swimming
    ? suitOn
      ? SWIM_GRAVITY * SUIT_GRAVITY_SCALE
      : SWIM_GRAVITY
    : landGravity * windGravityScale(state.secondWind);
  // A Burpee Slam falls at its own speed, which is also its cap.
  const fallCap = swimming
    ? SWIM_SINK_MAX
    : state.slamming
      ? SLAM_VY
      : spinJumping
        ? SPIN_MAX_FALL
        : MAX_FALL_VY;
  let nextPlayerY = state.playerY + carry.dy + state.playerVy * dtRatio;
  let nextPlayerVy = Math.min(fallCap, state.playerVy + gravity * dtRatio);
  // A Cape runner holding jump glides, and flight stops at the ceiling.
  nextPlayerVy = glideVy(nextPlayerVy, power, jumpHeld);
  if (power === "cape" && nextPlayerY < CAPE_CEILING_Y) {
    nextPlayerY = CAPE_CEILING_Y;
    nextPlayerVy = Math.max(0, nextPlayerVy);
  }
  // The surface: a swimmer's head never rises above it.
  if (swimming && nextPlayerY < SWIM_SURFACE_Y) {
    nextPlayerY = SWIM_SURFACE_Y;
    nextPlayerVy = Math.max(0, nextPlayerVy);
  }
  // Pressed against a station or plyo side, the runner slides down slowly.
  // Only a fall is slowed; the wall is checked where the runner now stands.
  const wallTouch =
    !swimming && wallContact(props, GROUND_Y, bodyRight, nextPlayerY + h);
  if (wallTouch && !state.slamming) {
    nextPlayerVy = Math.min(nextPlayerVy, WALL_SLIDE_MAX_VY);
  }
  let isGrounded = false;

  const prevBottom = state.playerY + carry.dy + h;
  const nextBottom = nextPlayerY + h;
  // The top the runner came down onto, when it landed this step.
  let landedTop = Infinity;
  if (nextBottom >= prevBottom) {
    // Footing: the lane where it isn't a gap, and the tops of ledges, blocks
    // and props the runner was above a moment ago. The highest one crossed
    // wins.
    let landingTop = Infinity;
    let landingProp = null as PropFooting | null;
    const consider = (top: number, prop: PropFooting | null = null) => {
      if (prevBottom <= top + 1 && nextBottom >= top && top < landingTop) {
        landingTop = top;
        landingProp = prop;
      }
    };
    if (
      !isFootingOverGap(course, footLeft, footRight) &&
      prevBottom <= GROUND_Y + 2
    ) {
      consider(GROUND_Y);
    }
    for (const l of course.ledges) {
      if (footRight > l.x && footLeft < l.x + l.width) consider(l.y);
    }
    for (const b of course.blocks) {
      if (footRight > b.x && footLeft < b.x + BLOCK_SIZE) consider(b.y);
    }
    for (const f of propFootings(props, propClockMs, GROUND_Y)) {
      if (footRight > f.left && footLeft < f.right) consider(f.top, f);
    }
    if (landingTop !== Infinity) {
      landedTop = landingTop;
      nextPlayerY = landingTop - h;
      nextPlayerVy = 0;
      isGrounded = true;
      if (landingProp?.kind === "plyo") {
        // A Plyo Box springs the runner up; holding jump springs higher.
        nextPlayerVy = plyoLaunchVy(jumpHeld);
        isGrounded = false;
      } else if (landingProp?.kind === "switch") {
        // Stomping the Rest Day Switch swaps bricks and Kudos for a while.
        const pressedId = landingProp.id;
        props = {
          ...props,
          switches: props.switches.map((sw) =>
            sw.id === pressedId ? { ...sw, pressed: true } : sw
          ),
        };
        if (restDayMs === 0) course = restDaySwap(course, true);
        restDayMs = REST_DAY_MS;
        banner = { text: "REST DAY · RECOVERING", ttlMs: 1800, tone: "info" };
        nextPlayerVy = STOMP_BOUNCE_VY;
        isGrounded = false;
      }
    }
  } else {
    // Rising: a head-first hit on a block's underside stops the rise and
    // bumps the block.
    let bumped: number | null = null;
    let bestOverlap = 0;
    course.blocks.forEach((b, i) => {
      const bottom = b.y + BLOCK_SIZE;
      const overlap =
        Math.min(bodyRight, b.x + BLOCK_SIZE) - Math.max(bodyLeft, b.x);
      if (
        overlap > bestOverlap &&
        state.playerY >= bottom - 1 &&
        nextPlayerY < bottom
      ) {
        bestOverlap = overlap;
        bumped = i;
      }
    });
    if (bumped !== null) {
      const block = course.blocks[bumped];
      nextPlayerY = block.y + BLOCK_SIZE;
      nextPlayerVy = 1;
      // A Spin Jump only bonks: no break and no reward.
      // A Rest Day brick is a Kudos in disguise, so it never breaks.
      if (spinJumping) {
        // Bonk only.
      } else if (
        block.kind === "brick" &&
        !block.fromKudos &&
        power !== "base"
      ) {
        breakBoard(bumped);
      } else bumpBlock(bumped);
    }
  }

  // A Burpee Slam that lands: the board under the feet breaks from above, and
  // the fitness runner pays for the drop in Body Battery.
  const slamLanded = landedTop !== Infinity && state.slamming === true;
  if (slamLanded && fitness) {
    bodyBatteryChange -= SLAM_BATTERY_COST;
  }
  if (slamLanded) {
    const under = course.blocks.findIndex(
      (b) =>
        b.kind === "brick" &&
        !b.fromKudos &&
        b.y === landedTop &&
        footRight > b.x &&
        footLeft < b.x + BLOCK_SIZE
    );
    if (under !== -1) breakBoard(under);
  }

  // Basement Gym racks (#1993): a runner rising into a rack's underside bonks
  // off it, and a runner taller than Base whose head is under one takes a hit.
  let rackHit = false;
  const runnerTall = playerHeightFor(power) > playerHeightFor("base");
  for (const c of course.ceilings ?? []) {
    if (!(bodyRight > c.x && bodyLeft < c.x + c.width)) continue;
    if (
      state.playerY >= c.bottom - 1 &&
      nextPlayerY < c.bottom &&
      nextPlayerY < state.playerY
    ) {
      nextPlayerY = c.bottom;
      nextPlayerVy = 1;
    }
    if (runnerTall && nextPlayerY <= c.bottom) rackHit = true;
  }

  // A cape spin bumps Sync Blocks level with the runner from the side.
  if ((state.spinMs ?? 0) > 0) {
    const runnerBox = {
      left: bodyLeft,
      right: bodyRight,
      top: nextPlayerY,
      bottom: nextPlayerY + h,
    };
    course.blocks.forEach((b, i) => {
      if (
        b.kind === "sync" &&
        !b.used &&
        inSpinReach(runnerBox, {
          left: b.x,
          right: b.x + BLOCK_SIZE,
          top: b.y,
          bottom: b.y + BLOCK_SIZE,
        })
      ) {
        bumpBlock(i);
      }
    });
  }

  // The pace meter fills while sprinting on footing and holds in the air.
  // A flight keeps it full and empties it when it ends, on landing or
  // when its time runs out.
  const wasFlying = (state.flightMs ?? 0) > 0;
  let flightMs = isGrounded
    ? 0
    : Math.max(0, (state.flightMs ?? 0) - safeDelta);
  const paceMeter = wasFlying
    ? flightMs > 0
      ? 1
      : 0
    : stepPaceMeter(
        state.paceMeter,
        isGrounded,
        pace > 1,
        safeDelta,
        state.carrying ? MEDBALL_FILL_SCALE : 1
      );

  // Coyote time and the jump buffer.
  // Neither applies while swimming.
  let coyoteMs = swimming || isGrounded ? 0 : (state.coyoteMs ?? 0) + safeDelta;
  let jumpBufferMs = swimming
    ? 0
    : Math.max(0, (state.jumpBufferMs ?? 0) - safeDelta);
  if (!swimming && isGrounded && (state.jumpBufferMs ?? 0) > 0) {
    nextPlayerVy = takeOffVy(power, paceMeter, riding);
    if (startsFlight(power, paceMeter)) flightMs = CAPE_FLIGHT_MS;
    isGrounded = false;
    coyoteMs = COYOTE_MS;
    jumpBufferMs = 0;
  }
  const spinMs = Math.max(0, (state.spinMs ?? 0) - safeDelta);
  const spinCooldownMs = Math.max(0, (state.spinCooldownMs ?? 0) - safeDelta);
  const strokeCooldownMs = Math.max(
    0,
    (state.strokeCooldownMs ?? 0) - safeDelta
  );
  const stompChain = isGrounded ? 0 : (state.stompChain ?? 0);

  // Falling below the face through a gap costs a life.
  if (nextPlayerY > CANVAS_SIZE) {
    return loseLife(
      {
        ...state,
        playerY: nextPlayerY,
        playerVy: 0,
        distanceMeters: nextDistance,
        score,
        kudos,
      },
      {
        errorType: "Segmentation Fault",
        file: "MonkeyC_Mayhem_App.mc",
        line: 256,
        stackTrace: [
          "Segmentation Fault: read past the end of the track",
          "Runner fell through a gap in the lane",
          "at MonkeyC_Mayhem_App.onStep() [App.mc:256]",
        ],
        heapUsedKb: state.allocatedRamKb,
        heapLimitKb: DEVICE_PROFILES[state.device].ramLimitKb,
      }
    );
  }

  // Kudos: touching one collects it; every KUDOS_PER_LIFE earns a life.
  const playerTop = nextPlayerY;
  const playerBottom = nextPlayerY + h;
  const kudosBefore = kudos;
  if (course.kudos.length > 0) {
    const kept = course.kudos.filter((k) => {
      const hit =
        k.x + KUDOS_RADIUS > bodyLeft &&
        k.x - KUDOS_RADIUS < bodyRight &&
        k.y + KUDOS_RADIUS > playerTop &&
        k.y - KUDOS_RADIUS < playerBottom;
      if (!hit) return true;
      kudos += 1;
      score += KUDOS_SCORE;
      bodyBatteryChange += BODY_BATTERY_KUDOS_GAIN;
      popups.push({ x: k.x, y: k.y - 6, text: `+${KUDOS_SCORE}`, ttlMs: 600 });
      return false;
    });
    if (kept.length !== course.kudos.length)
      course = { ...course, kudos: kept };
  }
  // Finisher Medals (#2025): the runner's box, as for Kudos, finds a medal on
  // the course, the main course or a bonus room alike.
  if (course.medals && course.medals.length > 0) {
    const touched = course.medals.filter((m) =>
      medalHit(m, bodyLeft, playerTop, bodyRight, playerBottom)
    );
    if (touched.length > 0) {
      course = {
        ...course,
        medals: course.medals.filter((m) => !touched.includes(m)),
      };
      for (const m of touched) {
        const medal = medalFind(medalsFound, m.id, m.x, m.y);
        medalsFound = medal.found;
        score += medal.points;
        popups.push(...medal.popups);
      }
    }
  }
  const earned = livesEarned(kudosBefore, kudos);
  if (earned > 0) {
    lives = addLives(lives, earned);
    popups.push({ x: bodyLeft, y: playerTop - 10, text: "1UP", ttlMs: 1000 });
    banner = {
      text: `${kudos} KUDOS · 1UP · LIVES ${lives}`,
      ttlMs: 1800,
      tone: "good",
    };
  }

  // A runaway Running Buddy that runs out of time is gone, and says so.
  for (const p of pickups) {
    if (p.ttlMs !== undefined && p.ttlMs - safeDelta <= 0) {
      popups.push({ x: p.x, y: p.y - 6, text: BUDDY_TOASTS.gone, ttlMs: 900 });
    }
  }
  // Power-ups travel the course; touching one collects it.
  pickups = stepPickups(
    pickups,
    course,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    safeDelta
  );
  if (pickups.length > 0) {
    const kept: Pickup[] = [];
    for (const p of pickups) {
      const hit =
        p.emergeMs <= 0 &&
        p.x + PICKUP_SIZE > bodyLeft &&
        p.x < bodyRight &&
        p.y + PICKUP_SIZE > playerTop &&
        p.y < playerBottom;
      if (!hit) {
        kept.push(p);
        continue;
      }
      gearTaken = true;
      if (p.kind === "buddy") {
        // A hatched buddy scores; a runaway caught again gives no points.
        // Mounting shows "Good boy!" once; a rider has nothing more to do.
        if (p.ttlMs === undefined) {
          score += POWERUP_SCORE;
          popups.push({
            x: p.x,
            y: p.y - 6,
            text: `+${POWERUP_SCORE}`,
            ttlMs: 900,
          });
        }
        if (!riding) {
          riding = true;
          popups.push({
            x: bodyLeft,
            y: playerTop - 14,
            text: BUDDY_TOASTS.mount,
            ttlMs: 1100,
          });
        }
        continue;
      }
      score += POWERUP_SCORE;
      popups.push({
        x: p.x,
        y: p.y - 6,
        text: `+${POWERUP_SCORE}`,
        ttlMs: 900,
      });
      const nextPower = collectTier(power, p.kind);
      bodyBatteryChange +=
        p.kind === "high" ? BODY_BATTERY_MAX : BODY_BATTERY_POWER_GAIN;
      if (p.kind === "high") {
        starMs = HIGH_MS;
        banner = { text: "RUNNER'S HIGH!", ttlMs: 1800, tone: "good" };
      } else if (nextPower !== power) {
        banner = {
          text:
            nextPower === "heatmap"
              ? "HEAT MAP · X THROWS"
              : nextPower === "cape"
                ? "COMPRESSION CAPE · X SPINS"
                : nextPower === "trisuit"
                  ? "TRI SUIT · SWIM"
                  : "PROTEIN SHAKE · BUFF",
          ttlMs: 1800,
          tone: "good",
        };
      }
      power = nextPower;
    }
    pickups = kept;
  }
  // Heat bolts bounce along the course; the obstacle pass below checks hits.
  let bolts = stepBolts(
    state.bolts ?? [],
    course,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    safeDelta
  );
  // Snap float residue so a cooldown of whole frames ends on the last one.
  const cooldownLeft = (state.boltCooldownMs ?? 0) - safeDelta;
  const boltCooldownMs = cooldownLeft > 1e-6 ? cooldownLeft : 0;

  // Growing keeps the feet where they are.
  const grownBy = playerHeightFor(power) - h;
  if (grownBy !== 0) nextPlayerY -= grownBy;
  const bodyH = playerHeightFor(power);

  // An Aid Station (#2025): touching a checkpoint of this stage marks it, so a
  // lost life restarts the stage there. Not inside a bonus room; a checkpoint
  // passed on the way out of one counts on the next tick. The pole below
  // runs after this, so a stage clear's banner wins.
  const reachedCheckpoint =
    state.bonusRoom || !course.checkpoints
      ? undefined
      : course.checkpoints.find(
          (cp) =>
            cp.stage === stage &&
            cp.x <= cameraX + PLAYER_X &&
            !(checkpoint?.x === cp.x && checkpoint.stage === cp.stage)
        );
  if (reachedCheckpoint) {
    checkpoint = reachedCheckpoint;
    banner = { text: CHECKPOINT_BANNER, ttlMs: 1600, tone: "good" };
    popups.push({
      x: reachedCheckpoint.x,
      y: GROUND_Y - 30,
      text: CHECKPOINT_TOAST,
      ttlMs: 1600,
    });
  }

  // The finish pole: grabbing it ends the stage, higher pays more. A secret
  // exit's pole (#2025) ends a bonus room and starts the next stage instead.
  let stageCleared = false;
  // The next stage's layout, when a secret exit has been taken this tick.
  let secretNext: {
    course: CourseLayout;
    props: CourseProps;
    foes: Foe[];
  } | null = null;
  const lapClockMs = (state.runClockMs ?? 0) + safeDelta;
  let lapSplits = state.lapSplits ?? [];
  let lapSplit: number | null = null;
  let stageTrainingEffect: number | null = null;
  let runComplete = false;
  const poleIdx = course.poles.findIndex(
    (p) => p.grabbed === undefined && bodyRight >= p.x
  );
  if (poleIdx !== -1) {
    const pole = course.poles[poleIdx];
    // Only a stage's own pole is a secret exit; the last stage has none.
    // A Training Plan workout ends at its own pole (#1994).
    const lastStage = state.plan?.stage ?? STAGE_COUNT;
    const secret = pole.secret === true && pole.stage < lastStage;
    const height = clamp(
      (GROUND_Y - (nextPlayerY + bodyH / 2)) / POLE_HEIGHT,
      0,
      1
    );
    const bonus = poleBonus(height);
    score += bonus + STAGE_CLEAR_SCORE;
    const poles = course.poles.slice();
    poles[poleIdx] = { ...pole, grabbed: height };
    course = { ...course, poles };
    popups.push({
      x: pole.x,
      y: GROUND_Y - height * POLE_HEIGHT - 8,
      text: `+${bonus}`,
      ttlMs: 1200,
    });
    stageCleared = true;
    // An Aid Station belongs to the stage just cleared (#2025).
    checkpoint = null;
    bodyBatteryChange += BODY_BATTERY_POWER_GAIN;
    // Auto lap: the stage just cleared is a lap of the run clock.
    lapSplit = lapClockMs - (state.lapStartMs ?? 0);
    lapSplits = [...lapSplits, lapSplit];
    // The fitness rules grade the stage like a workout.
    if (fitness) {
      stageTrainingEffect = trainingEffect({
        foesDefeated: state.stageFoes ?? 0,
        hitsTaken: state.stageHits ?? 0,
        livesLost: state.stageLivesLost ?? 0,
        poleHeight: height,
      });
    }
    // The medals the stage just cleared held (#2025).
    popups.push({
      x: bodyLeft,
      y: nextPlayerY - 46,
      text: `MEDALS ${stageMedalCount(medalsFound, pole.stage)}/${MEDALS_PER_STAGE}`,
      ttlMs: 1600,
    });
    if (pole.stage >= lastStage) {
      runComplete = true;
    } else {
      stage = pole.stage + 1;
      if (secret) {
        // The room's far pole clears the stage like its own pole, records
        // the secret exit, and the runner starts the next stage (#2025).
        if (!secretExits.includes(pole.stage)) {
          secretExits = [...secretExits, pole.stage];
        }
        secretNext = stageSetup(stage, state.courseSeed ?? 0, medalsFound);
      } else {
        const next = stageLayout(stage, state.courseSeed ?? 0);
        // A Rest Day still running swaps the new stage's bricks and Kudos too.
        course = appendCourse(
          course,
          restDayMs > 0 ? restDaySwap(next.course, true) : next.course
        );
        props = appendProps(props, next.props);
      }
      // Transition: the Tri Suit comes off when the next stage is on land,
      // so its clumsy land hop never meets the track's gaps.
      if (power === "trisuit" && !isWaterTheme(themeForStage(stage))) {
        power = "base";
      }
      // The lap banner is green on a best split for the lap, amber when
      // slower; the fitness rules add the stage's Training Effect.
      const lapText =
        stageTrainingEffect === null
          ? `LAP ${pole.stage} · ${formatClock(lapSplit)}`
          : `LAP ${pole.stage} · ${formatClock(lapSplit)} · TE ${stageTrainingEffect.toFixed(1)}`;
      if (secret) {
        // A secret exit's banner is its own; its lap goes in a popup.
        banner = { text: SECRET_EXIT_BANNER, ttlMs: 2200, tone: "good" };
        popups.push({
          x: bodyLeft,
          y: nextPlayerY - 64,
          text: lapText,
          ttlMs: 1600,
        });
      } else {
        banner = {
          text: lapText,
          ttlMs: 2200,
          tone: beatsBest(lapSplit, state.bestSplits?.[pole.stage - 1])
            ? "good"
            : "warn",
        };
      }
    }
  }
  // Pace calls on the lap just run: world-record pace, a negative or a
  // positive split.
  const lapCall = lapSplit === null ? null : splitToast(lapSplits);
  if (lapCall) {
    popups.push({
      x: bodyLeft,
      y: nextPlayerY - 28,
      text: lapCall,
      ttlMs: 1600,
    });
  }
  if (racing && !state.bonusRoom) kudosMissed += missedKudos(course, cameraX);
  course = pruneCourse(course, cameraX);
  props = pruneProps(props, cameraX);

  // Reaching the far wall of a bonus room puts the runner back on the
  // course at the station's exit.
  let bonusRoom = state.bonusRoom ?? null;
  let roomExit: BonusRoom | null = null;
  // A secret exit has already ended the room this tick, so the room's far
  // wall is not walked through on stale data (#2025).
  if (bonusRoom && !secretNext && cameraX + PLAYER_X >= bonusRoom.endX) {
    roomExit = bonusRoom;
    const exitCameraX = bonusRoom.exitX - PLAYER_X;
    if (racing) kudosMissed += missedKudos(bonusRoom.returnCourse, exitCameraX);
    course = pruneCourse(bonusRoom.returnCourse, exitCameraX);
    props = pruneProps(bonusRoom.returnProps, exitCameraX);
    bonusRoom = null;
  }

  // 3. Distance & Score Tracking
  // Score, distance and the stress meters accumulate fractionally so equal
  // elapsed time gives equal progress at any refresh rate; only the score is
  // an integer to callers, with its remainder carried in scoreRemainder
  // (#1212). Round for display, never in the tick.
  const exactScore = score + (state.scoreRemainder ?? 0) + dtRatio;
  const nextScore = Math.floor(exactScore + 1e-9);
  const nextScoreRemainder = Math.max(0, exactScore - nextScore);
  const nextHighScore = Math.max(state.highScore, nextScore);
  const nextHeartRate = clamp(130 + Math.floor(nextScore * 0.05), 120, 188);

  // Body Battery, the move alert and a new PR (fitness rules).
  let bodyBattery = state.bodyBattery;
  let idleMs = state.idleMs ?? 0;
  let prAnnounced = state.prAnnounced ?? false;
  if (fitness) {
    const before = state.bodyBattery;
    bodyBattery = adjustBodyBattery(
      stepBodyBattery(before, runInput, isGrounded, safeDelta),
      bodyBatteryChange
    );
    // A banner set this frame (a stage clear, a power-up, a 1UP) wins.
    const freshBanner = banner !== carriedBanner;
    if (bodyBattery.bonked && !(before?.bonked ?? false) && !freshBanner) {
      banner = {
        text: `BONK! · ${pickToast("bonk", nextDistance)}`,
        ttlMs: 2200,
        tone: "warn",
      };
    }
    // Easing on footing for too long and the watch nags. A bonked runner is
    // forced to ease, so that never counts.
    idleMs =
      isGrounded && state.runInput === -1 && !bodyBattery.bonked
        ? idleMs + safeDelta
        : 0;
    if (idleMs >= MOVE_ALERT_IDLE_MS) {
      idleMs = 0;
      if (!banner)
        banner = { text: MOVE_ALERT_TEXT, ttlMs: 1400, tone: "warn" };
    }
    // A new PR waits for the watch to clear any other banner.
    const best = state.bestAtStart ?? 0;
    if (!prAnnounced && best > 0 && nextScore > best && !banner) {
      prAnnounced = true;
      banner = { text: NEW_PR_TEXT, ttlMs: 1800, tone: "good" };
    }
    // Gym and running toasts float up from the runner.
    const toast = (event: ToastEvent) =>
      popups.push({
        x: bodyLeft,
        y: playerTop - 14,
        text: pickToast(event, nextScore + nextDistance),
        ttlMs: 1100,
      });
    if (stageTrainingEffect !== null) toast("stage-clear");
    else if (earned > 0) toast("kudos-life");
    else if (power !== (state.power ?? "base") || bodyBatteryChange >= 25)
      toast("power-up");
  }

  // The wall contact: a fresh touch arms the Wall Jump, and it stays spent
  // while the runner keeps touching the same wall.
  const landed = landedTop !== Infinity;
  const wallSide = wallTouch && !isGrounded;
  const wallJumpReady = wallSide
    ? state.wallSide
      ? state.wallJumpReady === true
      : true
    : false;

  // 4. Memory Allocations (Automatic dynamic memory pressure)
  let updatedState: GameEngineState = {
    ...state,
    playerY: nextPlayerY,
    playerVy: nextPlayerVy,
    isGrounded,
    battery: nextBattery,
    isLightOn: nextLight,
    lightActiveDurationMs: lightDuration,
    thermalStress: nextThermalStress,
    fogLevel: nextFogLevel,
    distanceMeters: nextDistance,
    score: nextScore,
    scoreRemainder: nextScoreRemainder,
    highScore: nextHighScore,
    heartRate: nextHeartRate,
    course,
    stage,
    kudos,
    power,
    lives,
    starMs,
    pickups: stageCleared ? [] : pickups,
    // Stage advance: the buddy, a carried ball and a thrown one are left
    // behind on the finished stage.
    riding: stageCleared ? false : riding,
    carrying: stageCleared ? false : state.carrying,
    carryingId: stageCleared ? undefined : state.carryingId,
    thrownBall: stageCleared ? null : (state.thrownBall ?? null),
    bolts: stageCleared ? [] : bolts,
    boltCooldownMs,
    paceMeter,
    flightMs,
    spinMs,
    spinCooldownMs,
    strokeCooldownMs,
    invulnerableMs: Math.max(0, (state.invulnerableMs ?? 0) - safeDelta),
    coyoteMs,
    jumpBufferMs,
    stompChain,
    popups,
    banner,
    props,
    propClockMs,
    restDayMs,
    bonusRoom,
    lapSplits,
    lapStartMs: lapSplit === null ? (state.lapStartMs ?? 0) : lapClockMs,
    medalsFound,
    checkpoint,
    secretExits,
    // A stage clear ends a Second Wind; otherwise it runs on (#2026).
    secondWind: stageCleared ? null : wind,
    // The moves end on the landing; a wall contact lasts while the runner
    // stays in the air against it.
    slamming: state.slamming === true && !landed,
    spinJump: spinJumping && !landed,
    wallSide,
    wallJumpReady,
    ...(racing ? { kudosMissed, gearTaken } : {}),
    ...(fitness
      ? {
          bodyBattery,
          idleMs,
          prAnnounced,
          ...(stageTrainingEffect === null
            ? {}
            : {
                lastTrainingEffect: stageTrainingEffect,
                stageFoes: 0,
                stageHits: 0,
                stageLivesLost: 0,
              }),
        }
      : {}),
  };

  if (secretNext) {
    // A secret exit: the room and the stage it was in are left behind (the
    // finished stage's own pole is discarded with its course), and the runner
    // starts the next stage at its start, clear of the room's items (#2025).
    return {
      ...updatedState,
      // The lane Kudos the shortcut skips are missed (#2019).
      ...(racing && state.bonusRoom
        ? {
            kudosMissed:
              kudosMissed +
              missedKudos(
                state.bonusRoom.returnCourse,
                stageStartX(stage) + 40
              ),
          }
        : {}),
      distanceMeters: stageStartX(stage) / PX_PER_METER,
      playerY: GROUND_Y - playerHeightFor(power),
      playerVy: 0,
      isGrounded: true,
      course: secretNext.course,
      props: secretNext.props,
      foes: secretNext.foes,
      obstacles: [],
      foeShots: [],
      pickups: [],
      bolts: [],
      thrownBall: null,
      carrying: false,
      carryingId: undefined,
      riding: false,
      bonusRoom: null,
      checkpoint: null,
      // A move in progress ends at the pole, so no slam lands on the new stage.
      slamming: false,
      spinJump: false,
      wallSide: false,
      wallJumpReady: false,
    };
  }
  if (roomExit) {
    updatedState = tickSecondWind(
      updatedState,
      wind,
      {
        deltaMs: safeDelta,
        metres: Math.max(0, nextDistance - state.distanceMeters),
        kudos: (updatedState.kudos ?? 0) - (state.kudos ?? 0),
        highFives: 0,
        hits: 0,
      },
      { x: bodyLeft, y: nextPlayerY },
      false
    );
    // Out of the bonus room and onto the lane at the exit; the course's foes
    // come back, and the bugs and shots wait for the next frame.
    return {
      ...updatedState,
      distanceMeters: (roomExit.exitX - PLAYER_X) / PX_PER_METER,
      playerY: GROUND_Y - bodyH,
      playerVy: 0,
      isGrounded: true,
      // Foes waiting at the exit step aside so the runner lands clear.
      foes: roomExit.returnFoes.filter(
        (f) => f.x + f.width < roomExit.exitX - 40 || f.x > roomExit.exitX + 160
      ),
      // Power-ups that were out at the door come along, keeping their place
      // relative to the runner.
      pickups: roomExit.returnPickups.map((p) => ({
        ...p,
        x: p.x + roomExit.exitX - (roomExit.endX - BONUS_ROOM_LENGTH),
      })),
      foeShots: [],
      obstacles: [],
      // A ball still in flight at the far wall stays in the room.
      thrownBall: null,
    };
  }
  if (runComplete) {
    return {
      ...updatedState,
      gameState: "summary",
      crashReport: null,
      obstacles: [],
      banner: null,
    };
  }
  if (stageCleared) {
    // Bugs on screen at the pole are cleared with the stage, and the next
    // stage's foes take the course.
    const seed = state.courseSeed ?? 0;
    updatedState = {
      ...updatedState,
      obstacles: [],
      foes: stageSetup(stage, seed, medalsFound).foes,
      foeShots: [],
    };
  }

  const now = clockNow(state);
  // The app allocates faster, bugs arrive sooner and move quicker as the run
  // goes on, reaching full difficulty after DIFFICULTY_RAMP_METERS (#1320).
  const ramp = getDifficultyRamp(nextDistance);
  const allocInterval =
    (state.device === "fenix"
      ? 3200
      : state.device === "forerunner"
        ? 4000
        : 5000) *
    tuning.allocIntervalScale *
    (1 - 0.6 * ramp);
  if (!fitness && now - state.lastAllocTime > allocInterval) {
    const types: VariableType[] = ["int", "float", "string", "array"];
    const chosenType = types[Math.floor(rand() * types.length)];
    const allocResult = allocateVariable(updatedState, chosenType);
    if (allocResult.crashed) {
      return allocResult.state;
    }
    updatedState = {
      ...allocResult.state,
      lastAllocTime: now,
    };
  }

  // A tall runner under a rack takes a hit, once per grace window.
  if (rackHit && (updatedState.invulnerableMs ?? 0) <= 0) {
    if (updatedState.riding) {
      // The buddy takes a rack hit instead of the tier (#2024).
      updatedState = riderLosesBuddy(updatedState, cameraX);
    } else {
      // Only a tier taller than Base is hit, and every such tier survives a
      // hit by dropping a tier, so a rack never costs a life.
      const hit = damageTier(updatedState.power);
      updatedState = dropCarriedBall(
        {
          ...updatedState,
          ...hitToll(updatedState),
          power: hit.power,
          playerY:
            updatedState.playerY +
            playerHeightFor(updatedState.power) -
            playerHeightFor(hit.power),
          invulnerableMs: DAMAGE_GRACE_MS,
          banner: { text: ouchText(updatedState), ttlMs: 1400, tone: "warn" },
        },
        cameraX
      );
    }
  }

  // 5. Procedural Obstacles & Memory Tokens Update
  const currentObstacles = [...updatedState.obstacles];
  const nextObstacles: Obstacle[] = [];
  let crashTriggered: CrashReport | null = null;

  // Enemies and tokens move with their own speed plus the change in track
  // scroll from sprinting or braking.
  const paceShift = 2.5 * (pace - 1);
  const prevPlayerBottom = state.playerY + h;
  const spinning = (state.spinMs ?? 0) > 0 && updatedState.power === "cape";
  for (const obs of currentObstacles) {
    const nextX = obs.x - (obs.speed + paceShift) * dtRatio;
    const isWalker =
      obs.type === "null_pointer" ||
      obs.type === "watchdog" ||
      obs.type === "stack_overflow";
    // A walker that steps over a gap drops into it.
    let obsY = obs.y;
    let obsVy = obs.vy;
    if (
      isWalker &&
      (obsVy !== undefined ||
        isOverGap(
          updatedState.course ?? EMPTY_COURSE,
          cameraX + nextX + obs.width / 2
        ))
    ) {
      obsVy = Math.min(MAX_FALL_VY, (obsVy ?? 0) + FALL_GRAVITY * dtRatio);
      obsY += obsVy * dtRatio;
      if (obsY > CANVAS_SIZE) continue;
    }

    // A cape spin defeats a bug or a watchdog beside the runner; a spiked
    // stack overflow shrugs it off.
    if (
      spinning &&
      isWalker &&
      obs.type !== "stack_overflow" &&
      inSpinReach(
        {
          left: PLAYER_X,
          right: PLAYER_X + PLAYER_WIDTH,
          top: updatedState.playerY,
          bottom: updatedState.playerY + bodyH,
        },
        {
          left: nextX,
          right: nextX + obs.width,
          top: obsY,
          bottom: obsY + obs.height,
        }
      )
    ) {
      updatedState = {
        ...updatedState,
        score: updatedState.score + SPIN_DEFEAT_SCORE,
        stageFoes: (updatedState.stageFoes ?? 0) + 1,
        highScore: Math.max(
          updatedState.highScore,
          updatedState.score + SPIN_DEFEAT_SCORE
        ),
        popups: [
          ...(updatedState.popups ?? []),
          {
            x: cameraX + nextX,
            y: obsY - 6,
            text: `+${SPIN_DEFEAT_SCORE}`,
            ttlMs: 700,
          },
        ],
      };
      continue;
    }

    // A heat bolt defeats a bug or a watchdog it touches and is spent; a
    // stack overflow puts it out unharmed; tokens let it pass.
    if (isWalker && bolts.length > 0) {
      const wl = cameraX + nextX + 2;
      const wr = cameraX + nextX + obs.width - 2;
      const hitIdx = bolts.findIndex((b) =>
        boltHits(b, wl, obsY + 2, wr, obsY + obs.height - 2)
      );
      if (hitIdx !== -1) {
        bolts = bolts.filter((_, i) => i !== hitIdx);
        updatedState = { ...updatedState, bolts };
        if (obs.type !== "stack_overflow") {
          updatedState = {
            ...updatedState,
            score: updatedState.score + BOLT_DEFEAT_SCORE,
            stageFoes: (updatedState.stageFoes ?? 0) + 1,
            highScore: Math.max(
              updatedState.highScore,
              updatedState.score + BOLT_DEFEAT_SCORE
            ),
            popups: [
              ...(updatedState.popups ?? []),
              {
                x: cameraX + nextX,
                y: obsY - 6,
                text: `+${BOLT_DEFEAT_SCORE}`,
                ttlMs: 700,
              },
            ],
          };
          continue;
        }
      }
    }

    // Check collision with Player
    const playerBox = {
      left: PLAYER_X + 2,
      right: PLAYER_X + PLAYER_WIDTH - 2,
      top: updatedState.playerY + 2,
      bottom: updatedState.playerY + bodyH - 2,
    };

    const obsBox = {
      left: nextX + 2,
      right: nextX + obs.width - 2,
      top: obsY + 2,
      bottom: obsY + obs.height - 2,
    };

    const isColliding =
      playerBox.right > obsBox.left &&
      playerBox.left < obsBox.right &&
      playerBox.bottom > obsBox.top &&
      playerBox.top < obsBox.bottom;

    if (isColliding && isWalker) {
      // Landing on a bug or a watchdog from above squashes it; a stack
      // overflow is spiked and can only be jumped.
      const stompable = obs.type !== "stack_overflow";
      if (
        stompable &&
        updatedState.playerVy > 0 &&
        prevPlayerBottom <= obsY + 8
      ) {
        const chain = (updatedState.stompChain ?? 0) + 1;
        const base = obs.type === "watchdog" ? STOMP_SCORE * 2 : STOMP_SCORE;
        const points = Math.min(3200, base * 2 ** (chain - 1));
        const buffered = (updatedState.jumpBufferMs ?? 0) > 0;
        updatedState = {
          ...updatedState,
          score: updatedState.score + points,
          stageFoes: (updatedState.stageFoes ?? 0) + 1,
          highScore: Math.max(
            updatedState.highScore,
            updatedState.score + points
          ),
          playerY: obsY - bodyH,
          playerVy: buffered
            ? JUMP_FORCE + (updatedState.riding ? BUDDY_JUMP_BONUS_VY : 0)
            : STOMP_BOUNCE_VY,
          jumpBufferMs: 0,
          stompChain: chain,
          popups: [
            ...(updatedState.popups ?? []),
            {
              x: cameraX + nextX,
              y: obsY - 6,
              text: chainLabel(updatedState, points, chain) ?? `+${points}`,
              ttlMs: 800,
            },
          ],
        };
        continue;
      }
      if ((updatedState.starMs ?? 0) > 0) {
        // A Runner's High flattens whatever it runs into, spikes included.
        updatedState = {
          ...updatedState,
          score: updatedState.score + HIGH_DEFEAT_SCORE,
          stageFoes: (updatedState.stageFoes ?? 0) + 1,
          highScore: Math.max(
            updatedState.highScore,
            updatedState.score + HIGH_DEFEAT_SCORE
          ),
          popups: [
            ...(updatedState.popups ?? []),
            {
              x: cameraX + nextX,
              y: obsY - 6,
              text: `+${HIGH_DEFEAT_SCORE}`,
              ttlMs: 700,
            },
          ],
        };
        continue;
      }
      // Read live: a hit earlier in this tick starts the grace window.
      if ((updatedState.invulnerableMs ?? 0) > 0) {
        nextObstacles.push({ ...obs, x: nextX, y: obsY, vy: obsVy });
        continue;
      }
      if (updatedState.riding) {
        // The buddy takes this bug, and the runner keeps the tier (#2024).
        updatedState = riderLosesBuddy(updatedState, cameraX);
        nextObstacles.push({ ...obs, x: nextX, y: obsY, vy: obsVy });
        continue;
      }
      const hit = damageTier(updatedState.power);
      if (hit.survived) {
        // Dropping to Base shrinks the box from the top; the feet stay put.
        updatedState = dropCarriedBall(
          {
            ...updatedState,
            ...hitToll(updatedState),
            power: hit.power,
            playerY: updatedState.playerY + bodyH - playerHeightFor(hit.power),
            invulnerableMs: DAMAGE_GRACE_MS,
            banner: { text: ouchText(updatedState), ttlMs: 1400, tone: "warn" },
          },
          cameraX
        );
        nextObstacles.push({ ...obs, x: nextX, y: obsY, vy: obsVy });
        continue;
      }
    }

    if (isColliding) {
      if (obs.type === "mem_token" && obs.variablePayload) {
        // Collected memory token -> forced allocation
        const allocRes = allocateVariable(updatedState, obs.variablePayload);
        if (allocRes.crashed) {
          return allocRes.state;
        }
        updatedState = {
          ...allocRes.state,
          score: allocRes.state.score + MEM_TOKEN_SCORE,
        };
        // Don't keep obstacle after collection
        continue;
      } else if (obs.type === "flash_token") {
        const flashRes = allocateFlashVariable(updatedState, 4.0);
        if (flashRes.crashed) {
          return flashRes.state;
        }
        updatedState = {
          ...flashRes.state,
          score: flashRes.state.score + FLASH_TOKEN_SCORE,
        };
        continue;
      } else if (obs.type === "watchdog") {
        crashTriggered = {
          errorType: "Watchdog Tripped",
          file: "MonkeyC_Mayhem_App.mc",
          line: 42,
          stackTrace: [
            "Watchdog Tripped: App Execution > 5000ms",
            "at System.println() [Core.mc:12]",
            "at MonkeyC_Mayhem_App.onTimer() [App.mc:42]",
          ],
          heapUsedKb: updatedState.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[updatedState.device].ramLimitKb,
        };
        break;
      } else if (obs.type === "null_pointer") {
        crashTriggered = {
          errorType: "Null Pointer",
          file: "MonkeyC_Mayhem_App.mc",
          line: 77,
          stackTrace: [
            "Null Pointer Exception in MonkeyC_Mayhem_App.mc:77",
            "Attempted to access a member of null: :activeView",
            "at Ui.View.findDrawableById() [Ui.mc:104]",
          ],
          heapUsedKb: updatedState.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[updatedState.device].ramLimitKb,
        };
        break;
      } else if (obs.type === "stack_overflow") {
        crashTriggered = {
          errorType: "Stack Overflow",
          file: "MonkeyC_Mayhem_App.mc",
          line: 118,
          stackTrace: [
            "Stack Overflow Error in MonkeyC_Mayhem_App.mc:118",
            "Call depth exceeded: recursive onUpdate()",
            "at MonkeyC_Mayhem_App.onUpdate() [App.mc:118]",
          ],
          heapUsedKb: updatedState.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[updatedState.device].ramLimitKb,
        };
        break;
      }
    }

    // Keep active if on screen
    if (nextX + obs.width > 0) {
      nextObstacles.push(
        obsVy === undefined
          ? { ...obs, x: nextX }
          : { ...obs, x: nextX, y: obsY, vy: obsVy }
      );
    }
  }

  if (crashTriggered) {
    return loseLife(
      { ...updatedState, obstacles: nextObstacles },
      crashTriggered
    );
  }

  // 5b. Course foes and their shots (#1991).
  const foeTick = updateCourseFoes(updatedState, nextObstacles, {
    cameraX,
    bodyH,
    prevBottom: prevPlayerBottom,
    spinning,
    deltaMs: safeDelta,
    slam: slamLanded ? { footLeft, footRight, top: landedTop } : null,
  });
  if (foeTick.lost) return foeTick.state;
  updatedState = foeTick.state;
  nextObstacles.splice(0, nextObstacles.length, ...foeTick.obstacles);

  // 5c. A thrown medicine ball flies on (#2024).
  if (updatedState.thrownBall) {
    updatedState = stepThrownMedBall(updatedState, cameraX, safeDelta);
  }

  // 5d. Second Wind (#2026): its timer, goal and medal, on the tick it runs.
  // Damage restarts the grace window, which only starts from none: a hit.
  const hits =
    (updatedState.invulnerableMs ?? 0) === DAMAGE_GRACE_MS &&
    (state.invulnerableMs ?? 0) - safeDelta <= 0
      ? 1
      : 0;
  updatedState = tickSecondWind(
    updatedState,
    wind,
    {
      deltaMs: safeDelta,
      metres: Math.max(0, nextDistance - state.distanceMeters),
      kudos: (updatedState.kudos ?? 0) - (state.kudos ?? 0),
      highFives: foeTick.highFives,
      hits,
    },
    { x: bodyLeft, y: nextPlayerY },
    stageCleared
  );

  // 6. Spawn new Obstacles
  // Early stages leave room to learn the course before the bugs crowd in.
  const stageCalm = 1 + 0.12 * (STAGE_COUNT - (updatedState.stage ?? 1));
  const obstacleInterval =
    (1800 + rand() * 1200) *
    tuning.obstacleIntervalScale *
    stageCalm *
    (1 - 0.4 * ramp);
  if (
    now - updatedState.lastObstacleTime > obstacleInterval &&
    nextObstacles.length < 3 &&
    !updatedState.bonusRoom
  ) {
    const maxX = nextObstacles.reduce((max, o) => Math.max(max, o.x), 0);
    // Nothing spawns over a gap or within reach of a finish pole.
    const spawnWorldX = cameraX + CANVAS_SIZE + 10;
    const liveCourse = updatedState.course ?? EMPTY_COURSE;
    const blockedSpawn =
      isOverGap(liveCourse, spawnWorldX - 12) ||
      isOverGap(liveCourse, spawnWorldX + 32) ||
      liveCourse.poles.some(
        (p) => p.grabbed === undefined && Math.abs(p.x - spawnWorldX) < 160
      ) ||
      propFootings(
        updatedState.props ?? EMPTY_PROPS,
        propClockMs,
        GROUND_Y
      ).some((f) => f.right > spawnWorldX - 40 && f.left < spawnWorldX + 60);
    if (maxX < 190 && !blockedSpawn) {
      // Memory and flash tokens belong to Dev Mode's heap.
      const obstacleTypes: ObstacleType[] = fitness
        ? ["null_pointer", "watchdog", "stack_overflow"]
        : [
            "null_pointer",
            "watchdog",
            "stack_overflow",
            "mem_token",
            "flash_token",
          ];
      const chosen = obstacleTypes[Math.floor(rand() * obstacleTypes.length)];

      let width = 16;
      let height = 20;
      let y = GROUND_Y - height;
      let label = "NULL";
      let variablePayload: VariableType | undefined;

      if (chosen === "null_pointer") {
        label = "NULL";
        width = 16;
        height = 20;
        y = GROUND_Y - height;
      } else if (chosen === "watchdog") {
        label = "DOG";
        width = 20;
        height = 28;
        y = GROUND_Y - height;
      } else if (chosen === "stack_overflow") {
        label = "STK";
        width = 18;
        height = 24;
        y = GROUND_Y - height;
      } else if (chosen === "mem_token") {
        const types: VariableType[] = ["int", "float", "string", "array"];
        variablePayload = types[Math.floor(rand() * types.length)];
        label = variablePayload.slice(0, 3).toUpperCase();
        width = 14;
        height = 14;
        y = GROUND_Y - 36 - Math.floor(rand() * 20); // Floating in air
      } else if (chosen === "flash_token") {
        label = "NV";
        width = 14;
        height = 14;
        y = GROUND_Y - 32 - Math.floor(rand() * 20);
      }

      nextObstacles.push({
        id: now + rand(),
        x: CANVAS_SIZE + 10,
        y,
        width,
        height,
        type: chosen,
        label,
        speed: (2.2 + 2.6 * ramp) * tuning.obstacleSpeedScale,
        variablePayload,
      });

      updatedState.lastObstacleTime = now;
    }
  }

  return {
    ...updatedState,
    obstacles: nextObstacles,
  };
}

/**
 * 16-Color CIQ Retro Canvas 2D Renderer
 */
export function renderCanvasFrame(
  ctx: CanvasRenderingContext2D,
  state: GameEngineState
) {
  // Clear full 280x280 frame
  ctx.save();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Circular Clip Path for 280x280 Round Smartwatch Display
  ctx.beginPath();
  ctx.arc(
    CANVAS_SIZE / 2,
    CANVAS_SIZE / 2,
    CANVAS_SIZE / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.clip();

  // If Shut Down / Total Power Loss (0% battery): Render Blackout Shutdown Screen
  if (state.gameState === "shutdown" || state.battery <= 0) {
    renderShutdownScreen(ctx, state);
    ctx.restore();
    return;
  }

  // Background Display (Black / Dark Navy)
  ctx.fillStyle = state.isLightOn ? "#0c1f2d" : CIQ_PALETTE.black;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // LCD Pixel Grid Texture
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_SIZE; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_SIZE; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_SIZE, y);
    ctx.stroke();
  }

  // Draw Ground & Track Baseline
  ctx.fillStyle = CIQ_PALETTE.darkGray;
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, CANVAS_SIZE - GROUND_Y);

  ctx.fillStyle = CIQ_PALETTE.cyan;
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, 2);

  // Perspective Track Markers
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  const markerOffset = (state.distanceMeters * 10) % 24;
  for (let x = -markerOffset; x < CANVAS_SIZE; x += 24) {
    ctx.fillRect(x, GROUND_Y + 4, 12, 2);
  }

  // If Crashed: Render CIQ Blue Error Screen
  if (state.gameState === "crashed" && state.crashReport) {
    renderCrashScreen(ctx, state);
    ctx.restore();
    return;
  }

  // 1. Draw Player Character (Retro Monkey C Pixel Sprite)
  drawMonkeyRunner(ctx, PLAYER_X, state.playerY, state.isGcActive);

  // 2. Draw Obstacles & Memory Tokens
  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs);
  }

  // 3. Draw GC Freeze Indicator Overlay
  if (state.isGcActive) {
    ctx.fillStyle = "rgba(0, 0, 170, 0.4)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.fillStyle = CIQ_PALETTE.brightCyan;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GC FREEZE (500ms)", CANVAS_SIZE / 2, 95);
    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "8px monospace";
    ctx.fillText(`RECLAIMING HEAP...`, CANVAS_SIZE / 2, 108);
  }

  // 4. Low Power Visual Dimming Effect (< 15% charge warning)
  if (state.battery < 15 && state.battery > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  // 5. Draw HUD Overlays (Top Arc & Bottom RAM/Flash Meter)
  drawHud(ctx, state);

  // 6. Draw Overheat Fog & Condensation Layer
  if (state.fogLevel > 0.05) {
    drawOverheatFog(ctx, state);
  }

  // 7. Paused: dim the frozen frame so it can't be mistaken for live play
  if (state.gameState === "paused") {
    drawPausedOverlay(ctx);
  }

  ctx.restore();
}

function drawPausedOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.textAlign = "center";
  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "bold 16px monospace";
  ctx.fillText("PAUSED", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4);
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  ctx.font = "8px monospace";
  ctx.fillText("PRESS START / ENTER", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 12);
}

// The top HUD row sits inside the round display's safe area: at the side
// labels' cap height (y≈50) the display is visible from about x=35 to x=245,
// so labels inset 60 px from either edge keep clear of the bezel (#1318).
const HUD_SIDE_INSET_X = 60;
const HUD_SIDE_Y = 58;
const HUD_SCORE_Y = 40;

/**
 * Draws HUD elements inside the circular screen
 */
function drawHud(ctx: CanvasRenderingContext2D, state: GameEngineState) {
  const ramLimit = DEVICE_PROFILES[state.device].ramLimitKb;
  const ramPct = Math.min(1.0, state.allocatedRamKb / ramLimit);
  const flashLimit = DEVICE_PROFILES[state.device].flashLimitKb;
  const flashPct = Math.min(1.0, state.allocatedFlashKb / flashLimit);

  // Top Status Bar: Battery & Profile
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle =
    state.battery < 15
      ? CIQ_PALETTE.red
      : state.battery < 30
        ? CIQ_PALETTE.yellow
        : CIQ_PALETTE.green;
  ctx.fillText(
    `BAT: ${Math.round(state.battery)}%`,
    HUD_SIDE_INSET_X,
    HUD_SIDE_Y
  );

  // Low power alarm badge
  if (state.battery < 15 && state.battery > 0) {
    ctx.fillStyle = CIQ_PALETTE.red;
    ctx.fillRect(HUD_SIDE_INSET_X, HUD_SIDE_Y + 3, 62, 10);
    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "bold 7px monospace";
    ctx.fillText("⚠️ LOW POWER", HUD_SIDE_INSET_X + 2, HUD_SIDE_Y + 11);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  ctx.font = "bold 9px monospace";
  ctx.fillText(
    state.device.toUpperCase(),
    CANVAS_SIZE - HUD_SIDE_INSET_X,
    HUD_SIDE_Y
  );

  // Top Center: Score & Heart Rate
  ctx.textAlign = "center";
  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "bold 11px monospace";
  ctx.fillText(`${state.score} PTS`, CANVAS_SIZE / 2, HUD_SCORE_Y);

  // Bottom HUD Box (RAM & Flash Meter Gauges)
  const ramY = 214;
  const ramBarW = 160;
  const ramBarH = 6;
  const ramBarX = (CANVAS_SIZE - ramBarW) / 2;

  // Background Box
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(ramBarX - 4, ramY - 12, ramBarW + 8, 48);
  ctx.strokeStyle = CIQ_PALETTE.darkGray;
  ctx.strokeRect(ramBarX - 4, ramY - 12, ramBarW + 8, 48);

  // RAM Text & Progress Bar
  ctx.font = "bold 7.5px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle =
    ramPct > 0.85
      ? CIQ_PALETTE.red
      : ramPct > 0.65
        ? CIQ_PALETTE.yellow
        : CIQ_PALETTE.brightCyan;
  ctx.fillText(
    `RAM: ${state.allocatedRamKb.toFixed(1)} / ${ramLimit.toFixed(0)} KB`,
    ramBarX,
    ramY - 3
  );

  ctx.fillStyle = CIQ_PALETTE.darkGray;
  ctx.fillRect(ramBarX, ramY, ramBarW, ramBarH);

  const fillRam = Math.max(0, ramBarW * ramPct);
  ctx.fillStyle =
    ramPct > 0.9
      ? CIQ_PALETTE.red
      : ramPct > 0.7
        ? CIQ_PALETTE.yellow
        : CIQ_PALETTE.brightGreen;
  ctx.fillRect(ramBarX, ramY, fillRam, ramBarH);

  // Flash Storage Text & Progress Bar
  const flashY = ramY + 14;
  ctx.fillStyle =
    flashPct > 0.85
      ? CIQ_PALETTE.red
      : flashPct > 0.65
        ? CIQ_PALETTE.yellow
        : CIQ_PALETTE.orange;
  ctx.fillText(
    `FLASH: ${state.allocatedFlashKb.toFixed(1)} / ${flashLimit.toFixed(0)} KB`,
    ramBarX,
    flashY - 2
  );

  ctx.fillStyle = CIQ_PALETTE.darkGray;
  ctx.fillRect(ramBarX, flashY, ramBarW, ramBarH);

  const fillFlash = Math.max(0, ramBarW * flashPct);
  ctx.fillStyle =
    flashPct > 0.9
      ? CIQ_PALETTE.red
      : flashPct > 0.7
        ? CIQ_PALETTE.yellow
        : CIQ_PALETTE.orange;
  ctx.fillRect(ramBarX, flashY, fillFlash, ramBarH);

  // NV Flash Files Summary Text
  ctx.font = "6.5px monospace";
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  ctx.fillText(
    `NV FILES: ${state.flashVariables.length} saved (${state.allocatedFlashKb.toFixed(1)}KB)`,
    ramBarX,
    flashY + 13
  );
}

/**
 * Draws the Pixel Art Monkey Runner
 */
function drawMonkeyRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isFrozen: boolean
) {
  ctx.save();
  ctx.translate(x, y);

  // Body Color (Brown or Cyan if Frozen)
  ctx.fillStyle = isFrozen ? CIQ_PALETTE.cyan : "#8B4513";
  ctx.fillRect(4, 6, 12, 14); // Torso

  // Head
  ctx.fillStyle = isFrozen ? CIQ_PALETTE.brightCyan : "#A0522D";
  ctx.fillRect(2, 0, 16, 8); // Head

  // Ears
  ctx.fillStyle = "#D2B48C";
  ctx.fillRect(0, 2, 3, 4);
  ctx.fillRect(17, 2, 3, 4);

  // Snout
  ctx.fillStyle = "#F5DEB3";
  ctx.fillRect(5, 3, 10, 5);

  // Eyes
  ctx.fillStyle = CIQ_PALETTE.black;
  ctx.fillRect(7, 3, 2, 2);
  ctx.fillRect(11, 3, 2, 2);

  // Developer Headband (Red)
  ctx.fillStyle = CIQ_PALETTE.red;
  ctx.fillRect(2, 0, 16, 2);

  // Tail
  ctx.strokeStyle = "#8B4513";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, 16);
  ctx.quadraticCurveTo(-4, 12, -2, 6);
  ctx.stroke();

  // Running Legs
  ctx.fillStyle = CIQ_PALETTE.black;
  ctx.fillRect(6, 20, 3, 4);
  ctx.fillRect(11, 20, 3, 4);

  ctx.restore();
}

/**
 * Draws an obstacle or memory token
 */
function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  ctx.save();
  ctx.translate(obs.x, obs.y);

  if (obs.type === "mem_token") {
    // Floating Memory Token
    ctx.fillStyle = CIQ_PALETTE.yellow;
    ctx.fillRect(0, 0, obs.width, obs.height);
    ctx.strokeStyle = CIQ_PALETTE.orange;
    ctx.strokeRect(0, 0, obs.width, obs.height);

    ctx.fillStyle = CIQ_PALETTE.black;
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "center";
    ctx.fillText(obs.label, obs.width / 2, obs.height / 2 + 2);
  } else if (obs.type === "flash_token") {
    // Floating Flash NV Token
    ctx.fillStyle = CIQ_PALETTE.orange;
    ctx.fillRect(0, 0, obs.width, obs.height);
    ctx.strokeStyle = CIQ_PALETTE.yellow;
    ctx.strokeRect(0, 0, obs.width, obs.height);

    ctx.fillStyle = CIQ_PALETTE.black;
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NV", obs.width / 2, obs.height / 2 + 2);
  } else if (obs.type === "null_pointer") {
    // Red Spiky Bug Obstacle
    ctx.fillStyle = CIQ_PALETTE.red;
    ctx.beginPath();
    ctx.moveTo(obs.width / 2, 0);
    ctx.lineTo(obs.width, obs.height);
    ctx.lineTo(0, obs.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "bold 5px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NULL", obs.width / 2, obs.height - 2);
  } else if (obs.type === "watchdog") {
    // Watchdog Hurdle (Purple Box with Timer)
    ctx.fillStyle = CIQ_PALETTE.purple;
    ctx.fillRect(0, 0, obs.width, obs.height);
    ctx.strokeStyle = CIQ_PALETTE.magenta;
    ctx.strokeRect(0, 0, obs.width, obs.height);

    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DOG", obs.width / 2, 10);
    ctx.fillText("5s", obs.width / 2, 20);
  } else {
    // Stack Overflow Block
    ctx.fillStyle = CIQ_PALETTE.darkRed;
    ctx.fillRect(0, 0, obs.width, obs.height);
    ctx.strokeStyle = CIQ_PALETTE.red;
    ctx.strokeRect(0, 0, obs.width, obs.height);

    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "bold 5px monospace";
    ctx.textAlign = "center";
    ctx.fillText("STK", obs.width / 2, obs.height / 2 + 2);
  }

  ctx.restore();
}

/**
 * Draws the Overheat Screen Fog and Condensation Layer
 */
function drawOverheatFog(
  ctx: CanvasRenderingContext2D,
  state: GameEngineState
) {
  ctx.save();

  // Create temporary offscreen fog layer
  const fogAlpha = Math.min(0.85, state.fogLevel);
  ctx.fillStyle = `rgba(220, 240, 255, ${fogAlpha})`;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Cut out swiped / wiped areas using destination-out
  ctx.globalCompositeOperation = "destination-out";
  for (const wipe of state.fogWipes) {
    const grad = ctx.createRadialGradient(
      wipe.x,
      wipe.y,
      0,
      wipe.x,
      wipe.y,
      wipe.radius
    );
    grad.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    grad.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(wipe.x, wipe.y, wipe.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Render "OVERHEAT / SWIPE TO WIPE" Warning
  if (state.fogLevel > 0.4) {
    ctx.save();
    ctx.fillStyle = CIQ_PALETTE.yellow;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚠️ OVERHEAT: SWIPE TO WIPE", CANVAS_SIZE / 2, 75);
    ctx.restore();
  }
}

/**
 * Draws the Blackout Shutdown Screen when battery hits zero
 */
function renderShutdownScreen(
  ctx: CanvasRenderingContext2D,
  state: GameEngineState
) {
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.fillStyle = CIQ_PALETTE.red;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("⚡ POWER DEPLETED ⚡", CANVAS_SIZE / 2, 75);

  ctx.fillStyle = CIQ_PALETTE.yellow;
  ctx.font = "bold 9px monospace";
  ctx.fillText("BROWNOUT SHUTDOWN", CANVAS_SIZE / 2, 92);

  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "8px monospace";
  ctx.fillText("0.0% BATTERY REMAINING", CANVAS_SIZE / 2, 112);

  ctx.fillStyle = CIQ_PALETTE.lightGray;
  ctx.font = "7.5px monospace";
  ctx.fillText("System halted to protect NV flash", CANVAS_SIZE / 2, 128);
  ctx.fillText(`Final Score: ${state.score} PTS`, CANVAS_SIZE / 2, 144);

  ctx.fillStyle = CIQ_PALETTE.brightGreen;
  ctx.font = "bold 9px monospace";
  ctx.fillText("PRESS START TO REBOOT", CANVAS_SIZE / 2, 185);
}

/**
 * Draws the CIQ Blue Error Console when crashed
 */
function renderCrashScreen(
  ctx: CanvasRenderingContext2D,
  state: GameEngineState
) {
  const report = state.crashReport;
  if (!report) return;

  // Garmin Blue Screen of Death
  ctx.fillStyle = "#000088";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.fillStyle = CIQ_PALETTE.brightCyan;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CONNECT IQ ERROR", CANVAS_SIZE / 2, 45);

  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "bold 8px monospace";
  ctx.fillText(report.errorType.toUpperCase(), CANVAS_SIZE / 2, 60);

  ctx.fillStyle = CIQ_PALETTE.yellow;
  ctx.font = "7px monospace";
  ctx.fillText(`File: ${report.file}:${report.line}`, CANVAS_SIZE / 2, 74);

  // Stack trace lines
  ctx.font = "6.5px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  let textY = 92;
  for (const line of report.stackTrace) {
    ctx.fillText(line.slice(0, 42), 24, textY);
    textY += 11;
  }

  // Summary Metrics
  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "bold 7.5px monospace";
  ctx.textAlign = "center";
  if (report.errorType === "Out Of Storage") {
    const used = report.flashUsedKb ?? state.allocatedFlashKb;
    const limit =
      report.flashLimitKb ?? DEVICE_PROFILES[state.device].flashLimitKb;
    ctx.fillText(
      `FLASH: ${used.toFixed(1)} / ${limit.toFixed(1)} KB`,
      CANVAS_SIZE / 2,
      175
    );
  } else {
    ctx.fillText(
      `PEAK RAM: ${report.heapUsedKb.toFixed(1)} / ${report.heapLimitKb.toFixed(1)} KB`,
      CANVAS_SIZE / 2,
      175
    );
  }
  ctx.fillText(
    `SCORE: ${state.score}  |  HI: ${state.highScore}`,
    CANVAS_SIZE / 2,
    190
  );

  // Restart instructions
  ctx.fillStyle = CIQ_PALETTE.brightGreen;
  ctx.font = "bold 9px monospace";
  ctx.fillText("PRESS START TO REBUILD", CANVAS_SIZE / 2, 218);
}

import { ArcadeEngine } from "@/lib/arcade/core/engine";

export interface GarminWatchSnapshot {
  device: DeviceTarget;
  gameState: GameEngineState["gameState"];
  batteryPercent: number;
  cpuLoadPercent: number;
  allocatedRamKb: number;
  allocatedFlashKb: number;
  temperatureC: number;
  score: number;
  highScore: number;
}

export class GarminWatchEngine extends ArcadeEngine<
  GameEngineState,
  GarminWatchSnapshot
> {
  constructor(device: DeviceTarget = "fenix") {
    super(createInitialState(device));
  }

  public override init(): void {
    // init
  }

  public startGame(): void {
    this.state = startGame(this.state, this.state.device);
    this.notifySubscribers();
  }

  public triggerGc(): void {
    const { state } = triggerGarbageCollection(this.state);
    this.state = state;
    this.notifySubscribers();
  }

  public jettisonOldest(): void {
    const { state } = jettisonOldestVariable(this.state);
    this.state = state;
    this.notifySubscribers();
  }

  public jump(): void {
    if (this.state.gameState !== "playing") return;
    this.state = pressJump(this.state);
    this.notifySubscribers();
  }

  public releaseJump(): void {
    this.state = releaseJump(this.state);
    this.notifySubscribers();
  }

  public throwBolt(): void {
    this.state = throwBolt(this.state);
    this.notifySubscribers();
  }

  public pressAction(): void {
    this.state = pressAction(this.state);
    this.notifySubscribers();
  }

  /** Down in the air on a fitness run: starts a Burpee Slam (#2023). */
  public pressSlam(): void {
    this.state = pressSlam(this.state);
    this.notifySubscribers();
  }

  public pressButton(btn: "up" | "down" | "start" | "back" | "light"): void {
    if (btn === "start") {
      if (
        this.state.gameState === "idle" ||
        this.state.gameState === "crashed" ||
        this.state.gameState === "shutdown"
      ) {
        this.startGame();
      } else if (this.state.gameState === "playing") {
        this.jump();
      }
    } else if (btn === "down") {
      this.triggerGc();
    } else if (btn === "back") {
      this.jettisonOldest();
    } else if (btn === "light") {
      this.state.isLightOn = !this.state.isLightOn;
      this.notifySubscribers();
    }
  }

  public override update(dt: number): void {
    if (this.state.gameState === "playing") {
      this.state = updateGameSimulation(this.state, dt * 1000);
    }
    this.invalidateSnapshot();
  }

  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;
    renderCanvasFrame(ctx, this.state);
  }

  public override createSnapshot(): GarminWatchSnapshot {
    return {
      device: this.state.device,
      gameState: this.state.gameState,
      batteryPercent: Math.round(this.state.battery),
      cpuLoadPercent: Math.round(
        (this.state.allocatedRamKb /
          (DEVICE_PROFILES[this.state.device]?.ramLimitKb || 32)) *
          100
      ),
      allocatedRamKb: this.state.allocatedRamKb,
      allocatedFlashKb: this.state.allocatedFlashKb,
      temperatureC: Math.round(37 + this.state.thermalStress * 15),
      score: this.state.score,
      highScore: this.state.highScore,
    };
  }
}
