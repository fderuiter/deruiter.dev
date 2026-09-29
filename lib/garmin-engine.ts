/**
 * Garmin Connect IQ (Monkey C) Game Simulation Engine
 * Handles physics, memory allocation lifecycle, GC mechanics,
 * thermal overheating, crash reports, and 16-color pixel canvas rendering.
 */
import { clamp } from "./game-utils";

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

export function loadPersistedFlashStorage(): FlashVariable[] {
  if (typeof window === "undefined") return [];
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
  return [];
}

export function savePersistedFlashStorage(flashVars: FlashVariable[]): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify(flashVars));
    }
  } catch {
    // Fall back safely when browser local storage is unavailable
  }
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
}

export interface CrashReport {
  errorType:
    | "Out Of Memory"
    | "Symbol Not Found"
    | "Watchdog Tripped"
    | "Null Pointer"
    | "Out Of Storage"
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
  distanceMeters: number;
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
  consecutiveDodges: number;
  /** Setup-derived parameters for this run; absent means defaults. */
  tuning?: GarminRunTuning;
}

export const CANVAS_SIZE = 280;
export const GROUND_Y = 205;
export const PLAYER_X = 52;
export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 24;
export const GRAVITY = 0.65;
export const JUMP_FORCE = -10.5;

/**
 * Initializes a new fresh game state
 */
export function createInitialState(
  device: DeviceTarget = "fenix",
  highScore = 0,
  initialFlash?: FlashVariable[]
): GameEngineState {
  const flashVars = initialFlash || loadPersistedFlashStorage();
  const defaultFlashVars: FlashVariable[] =
    flashVars.length > 0
      ? flashVars
      : [{ id: 1, name: "sys_log.dat", sizeKb: 4.0, allocatedAt: 0 }];
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
  };
}

/**
 * Start a new game session
 */
export function startGame(
  state: GameEngineState,
  device?: DeviceTarget,
  tuning?: GarminRunTuning
): GameEngineState {
  const targetDevice = device || state.device;
  const initial = createInitialState(targetDevice, state.highScore);
  const runTuning = tuning ?? state.tuning;
  return {
    ...initial,
    ...(runTuning ? { tuning: runTuning } : {}),
    gameState: "playing",
  };
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
 * reclaim nothing award no points. Survival ticks and dodges are the primary
 * score source; higher-difficulty devices only differ in their RAM limits.
 */
export const JETTISON_SCORE = 5;
export const GC_SCORE = 10;

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
export function jettisonOldestVariable(state: GameEngineState): {
  state: GameEngineState;
  popped?: MemoryVariable;
  reason?: string;
} {
  if (state.gameState !== "playing") {
    return { state };
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
    },
    popped,
  };
}

/**
 * Force Garbage Collection (GC)
 * Freezes game for 500ms and frees up to 2.0 to 4.0 KB of collectible garbage.
 * With no collectible garbage the call is a no-op: no freeze, no score.
 */
export function triggerGarbageCollection(state: GameEngineState): {
  state: GameEngineState;
  freedKb: number;
  reason?: string;
} {
  if (state.gameState !== "playing" || state.isGcActive) {
    return { state, freedKb: 0 };
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
    (2.0 + Math.random() * 2.0 + tuning.gcBonusFreedKb).toFixed(2)
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
    id: Date.now() + Math.random(),
    name: name || `${type}_${Math.floor(Math.random() * 900 + 100)}`,
    type,
    sizeKb,
    allocatedAt: Date.now(),
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
        "at Garmin_Schvitz_App.onUpdate() [App.mc:42]",
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
    id: Date.now() + Math.random(),
    name: name || `nv_data_${Math.floor(Math.random() * 900 + 100)}.bin`,
    sizeKb,
    allocatedAt: Date.now(),
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
        "at Garmin_Schvitz_App.saveState() [App.mc:95]",
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
  savePersistedFlashStorage(nextFlashVars);

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
  savePersistedFlashStorage([]);
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
 * Primary Game Physics & Simulation Update Loop (Called by requestAnimationFrame)
 */
export function updateGameSimulation(
  state: GameEngineState,
  deltaMs: number
): GameEngineState {
  if (state.gameState !== "playing" || state.battery <= 0) {
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

  // Handle GC Freeze
  if (state.isGcActive) {
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
        battery: Number(nextBattery.toFixed(2)),
        isLightOn: nextLight,
        lightActiveDurationMs: lightDuration,
        thermalStress: Number(nextThermalStress.toFixed(3)),
        fogLevel: Number(nextFogLevel.toFixed(3)),
        isGcActive: false,
        gcTimerMs: 0,
      };
    }
    return {
      ...state,
      battery: Number(nextBattery.toFixed(2)),
      isLightOn: nextLight,
      lightActiveDurationMs: lightDuration,
      thermalStress: Number(nextThermalStress.toFixed(3)),
      fogLevel: Number(nextFogLevel.toFixed(3)),
      gcTimerMs: remainingGc,
    };
  }

  const dtRatio = safeDelta / 16.666;

  // 1. Battery Drain & Overheating Mechanics
  let nextBattery = state.battery;
  let lightDuration = state.lightActiveDurationMs;

  // Base battery drain: 0.1%/sec; With light: +0.3%/sec (0.4%/sec total)
  const baseDrainPerMs = 0.0001;
  const lightDrainPerMs = 0.0003;
  const totalDrain =
    (baseDrainPerMs + (state.isLightOn ? lightDrainPerMs : 0)) *
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

  // 2. Player Jump & Gravity Physics
  let nextPlayerY = state.playerY + state.playerVy * dtRatio;
  let nextPlayerVy = state.playerVy + GRAVITY * dtRatio;
  let isGrounded = false;

  const groundLevel = GROUND_Y - PLAYER_HEIGHT;
  if (nextPlayerY >= groundLevel) {
    nextPlayerY = groundLevel;
    nextPlayerVy = 0;
    isGrounded = true;
  }

  // 3. Distance & Score Tracking
  const nextDistance = state.distanceMeters + 0.25 * dtRatio;
  const nextScore = state.score + Math.round(1 * dtRatio);
  const nextHighScore = Math.max(state.highScore, nextScore);
  const nextHeartRate = clamp(130 + Math.floor(nextScore * 0.05), 120, 188);

  // 4. Memory Allocations (Automatic dynamic memory pressure)
  let updatedState: GameEngineState = {
    ...state,
    playerY: nextPlayerY,
    playerVy: nextPlayerVy,
    isGrounded,
    battery: Number(nextBattery.toFixed(2)),
    isLightOn: nextLight,
    lightActiveDurationMs: lightDuration,
    thermalStress: Number(nextThermalStress.toFixed(3)),
    fogLevel: Number(nextFogLevel.toFixed(3)),
    distanceMeters: Number(nextDistance.toFixed(1)),
    score: nextScore,
    highScore: nextHighScore,
    heartRate: nextHeartRate,
  };

  const now = Date.now();
  const allocInterval =
    (state.device === "fenix"
      ? 3200
      : state.device === "forerunner"
        ? 4000
        : 5000) * tuning.allocIntervalScale;
  if (now - state.lastAllocTime > allocInterval) {
    const types: VariableType[] = ["int", "float", "string", "array"];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    const allocResult = allocateVariable(updatedState, chosenType);
    if (allocResult.crashed) {
      return allocResult.state;
    }
    updatedState = {
      ...allocResult.state,
      lastAllocTime: now,
    };
  }

  // 5. Procedural Obstacles & Memory Tokens Update
  const currentObstacles = [...updatedState.obstacles];
  const nextObstacles: Obstacle[] = [];
  let crashTriggered: CrashReport | null = null;

  for (const obs of currentObstacles) {
    const nextX = obs.x - obs.speed * dtRatio;

    // Check collision with Player
    const playerBox = {
      left: PLAYER_X + 2,
      right: PLAYER_X + PLAYER_WIDTH - 2,
      top: updatedState.playerY + 2,
      bottom: updatedState.playerY + PLAYER_HEIGHT - 2,
    };

    const obsBox = {
      left: nextX + 2,
      right: nextX + obs.width - 2,
      top: obs.y + 2,
      bottom: obs.y + obs.height - 2,
    };

    const isColliding =
      playerBox.right > obsBox.left &&
      playerBox.left < obsBox.right &&
      playerBox.bottom > obsBox.top &&
      playerBox.top < obsBox.bottom;

    if (isColliding) {
      if (obs.type === "mem_token" && obs.variablePayload) {
        // Collected memory token -> forced allocation
        const allocRes = allocateVariable(updatedState, obs.variablePayload);
        if (allocRes.crashed) {
          return allocRes.state;
        }
        updatedState = allocRes.state;
        // Don't keep obstacle after collection
        continue;
      } else if (obs.type === "flash_token") {
        const flashRes = allocateFlashVariable(updatedState, 4.0);
        if (flashRes.crashed) {
          return flashRes.state;
        }
        updatedState = flashRes.state;
        continue;
      } else if (obs.type === "watchdog") {
        crashTriggered = {
          errorType: "Watchdog Tripped",
          file: "Garmin_Schvitz_App.mc",
          line: 42,
          stackTrace: [
            "Watchdog Tripped: App Execution > 5000ms",
            "at System.println() [Core.mc:12]",
            "at Garmin_Schvitz_App.onTimer() [App.mc:42]",
          ],
          heapUsedKb: updatedState.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[updatedState.device].ramLimitKb,
        };
        break;
      } else if (obs.type === "null_pointer" || obs.type === "stack_overflow") {
        crashTriggered = {
          errorType:
            obs.type === "null_pointer" ? "Null Pointer" : "Symbol Not Found",
          file: "Garmin_Schvitz_App.mc",
          line: 77,
          stackTrace: [
            `Symbol Not Found Error in Garmin_Schvitz_App.mc:77`,
            `Failed symbol: :${obs.label.toLowerCase()}`,
            "at Ui.View.findDrawableById() [Ui.mc:104]",
          ],
          heapUsedKb: updatedState.allocatedRamKb,
          heapLimitKb: DEVICE_PROFILES[updatedState.device].ramLimitKb,
        };
        break;
      }
    }

    // Keep active if on screen
    if (nextX + obs.width > 0) {
      nextObstacles.push({ ...obs, x: nextX });
    }
  }

  if (crashTriggered) {
    return {
      ...updatedState,
      gameState: "crashed",
      crashReport: crashTriggered,
      obstacles: nextObstacles,
    };
  }

  // 6. Spawn new Obstacles
  const obstacleInterval =
    (1800 + Math.random() * 1200) * tuning.obstacleIntervalScale;
  if (
    now - updatedState.lastObstacleTime > obstacleInterval &&
    nextObstacles.length < 3
  ) {
    const maxX = nextObstacles.reduce((max, o) => Math.max(max, o.x), 0);
    if (maxX < 190) {
      const obstacleTypes: ObstacleType[] = [
        "null_pointer",
        "watchdog",
        "stack_overflow",
        "mem_token",
        "flash_token",
      ];
      const chosen =
        obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

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
        variablePayload = types[Math.floor(Math.random() * types.length)];
        label = variablePayload.slice(0, 3).toUpperCase();
        width = 14;
        height = 14;
        y = GROUND_Y - 36 - Math.floor(Math.random() * 20); // Floating in air
      } else if (chosen === "flash_token") {
        label = "NV";
        width = 14;
        height = 14;
        y = GROUND_Y - 32 - Math.floor(Math.random() * 20);
      }

      nextObstacles.push({
        id: Date.now() + Math.random(),
        x: CANVAS_SIZE + 10,
        y,
        width,
        height,
        type: chosen,
        label,
        speed:
          (2.2 + Math.min(2.0, updatedState.score * 0.005)) *
          tuning.obstacleSpeedScale,
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

  ctx.restore();
}

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
  ctx.fillText(`BAT: ${Math.round(state.battery)}%`, 45, 40);

  // Low power alarm badge
  if (state.battery < 15 && state.battery > 0) {
    ctx.fillStyle = CIQ_PALETTE.red;
    ctx.fillRect(45, 43, 62, 10);
    ctx.fillStyle = CIQ_PALETTE.white;
    ctx.font = "bold 7px monospace";
    ctx.fillText("⚠️ LOW POWER", 47, 51);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = CIQ_PALETTE.lightGray;
  ctx.font = "bold 9px monospace";
  ctx.fillText(state.device.toUpperCase(), CANVAS_SIZE - 45, 40);

  // Top Center: Score & Heart Rate
  ctx.textAlign = "center";
  ctx.fillStyle = CIQ_PALETTE.white;
  ctx.font = "bold 11px monospace";
  ctx.fillText(`${state.score} PTS`, CANVAS_SIZE / 2, 52);

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
    if (this.state.isGrounded && this.state.gameState === "playing") {
      this.state.playerVy = JUMP_FORCE;
      this.state.isGrounded = false;
      this.notifySubscribers();
    }
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
