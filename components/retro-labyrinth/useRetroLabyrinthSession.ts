"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { logger } from "@/lib/logger";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { clamp } from "@/lib/game-utils";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import {
  AUTOMATIC_REASONS,
  useCabinetPauseController,
  useCabinetRunActive,
} from "@/components/arcade/pause";
import {
  CRTCalibrationConfig,
  CRT_CALIBRATION_STORAGE_KEY,
  loadCRTCalibration,
  saveCRTCalibration,
} from "@/lib/arcade/crt-pipeline";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { resolveLabyrinthCrt } from "@/components/retro-labyrinth/labyrinth-crt";
import {
  patrolThreat,
  type ThreatLevel,
} from "@/components/retro-labyrinth/threat";
import { markNodeVisited } from "@/components/retro-labyrinth/tsp-nodes";
import {
  serializeGrid,
  serializeNodes,
} from "@/components/retro-labyrinth/room-data";
import {
  bossVolleyHitLine,
  controlsScrambled,
  holdBossSpin,
  isMarketOpen,
  rewardUnavailableReasons,
  sideEffectForClass,
  slotUnavailableMessage,
  stillParticles,
} from "@/components/retro-labyrinth/run-rules";
import { describeAmmoGrants } from "@/components/retro-labyrinth/labels";
import {
  RUN_SAVE_KEY,
  clearRun,
  loadRun,
  saveRun,
  takeRunResumeRequest,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import {
  ActiveSideEffect,
  BossState,
  CRTThemeConfig,
  CRTThemeId,
  CyberdeckClass,
  CyberdeckClassId,
  CyberdeckProfile,
  DEFAULT_WEAPONS,
  DungeonRoom,
  Enemy,
  FloatingNotification,
  HexMatrixPuzzle,
  ItemPickup,
  ParticleEffect,
  Weapon,
  WeaponId,
  calculateFOV,
  computeShortestTour,
  fireWeapon,
  generateClassicStage1,
  generateClassicStage2,
  generateRoguelikeCampaign,
  generateTSPRoom,
  generateHexMatrixPuzzle,
  selectHexCell,
  consumeBypassChip,
  updateEnemyAI,
  updateBoss,
  armBossForRoomEntry,
  getExitLockState,
  grantAmmoForLoadout,
  computeRoomExitScore,
  ENEMY_STEP_INTERVAL_MS,
  ENEMY_CONTACT_RECOIL_MS,
  updateTSPMovingWalls,
  tspWallTelegraph,
  retroAudio,
  CRT_THEMES,
  CYBERDECK_CLASSES,
  DARKNET_VENDOR_CATALOG,
  loadCyberdeckProfile,
  RETRO_LABYRINTH_HIGH_SCORE_KEY,
  saveCyberdeckProfile,
  recordCyberdeckRoomResult,
  recordCyberdeckMilestone,
  cyberdeckStartingStats,
  firmwareBonuses,
  aoeRadiusBonus,
  isCyberdeckClassUnlocked,
  purchaseFirmwareTier,
  type CyberdeckMilestone,
  type FirmwareTiers,
  type FirmwareUpgradeId,
  STAGE_1_MAZE,
  EMPTY_RUN_BUILD,
  applyRunReward,
  chooseRouteRoom,
  createRunSeed,
  describeRouteMap,
  drawRouteOptions,
  drawRunRewards,
  routeRoomName,
  routeRooms,
  routeRunLength,
  runBuildBonuses,
  runLoadout,
  RUN_PASSIVES,
  startRunRoute,
  type RouteMapRoom,
  type RouteMapStep,
  type RunBuild,
  type RunReward,
  type RunRoute,
  type SecurityDrone,
  stepSecurityDrone,
} from "@/lib/dungeon";

/** The start and exit cells every room shares. */
export const START_X = 1;
export const START_Y = 1;
export const EXIT_X = 13;
export const EXIT_Y = 7;
// How recent the player's last step must be for boss salvos to lead it.
const BOSS_LEAD_WINDOW_MS = 600;
/** HP a drone takes when it and the player share a tile. */
const DRONE_CONTACT_DAMAGE = 25;
/** How long a contact hit protects the player from the next one (#2176). */
const CONTACT_IMMUNITY_MS = ENEMY_CONTACT_RECOIL_MS;
/**
 * Real time between classic Stage 2 drone steps. It used to be a 4% chance
 * per frame, which ran twice as fast on a 120 Hz display (#1665).
 */
const CLASSIC_DRONE_STEP_INTERVAL_MS = 400;

/** Where a room stands: playing, paused, a card or an overlay. */
export type GameStatus =
  | "playing"
  | "paused"
  | "victory"
  | "caught"
  | "timesheet"
  | "hacking"
  | "darknet_shop"
  | "class_select"
  | "firmware_bay";

/** An overlay the player opens over a room. */
export type LabyrinthOverlay = "darknet_shop" | "class_select" | "firmware_bay";

/** A step of the player, in the direction a key or the d-pad names. */
type LabyrinthDirection = "up" | "down" | "left" | "right";

/**
 * One-shot feedback from the session (#2376). Each view renders it its own
 * way: the desktop already draws floating text in the maze, and the phone
 * shows a toast and plays a haptic.
 */
export type LabyrinthEvent =
  /** Contact or a boss volley cost the player HP. */
  | { readonly type: "bump"; readonly damage: number; readonly cause: string }
  /**
   * A tool press: what fired and what happened. `tool` is null for a press
   * that fired nothing, such as an empty slot; `outcome` then says why.
   */
  | {
      readonly type: "toolResult";
      readonly tool: WeaponId | null;
      readonly success: boolean;
      readonly outcome: string;
    }
  /** The last route node opened a locked exit. */
  | { readonly type: "exitOpened" }
  /** The nearest patrol came closer or backed off. */
  | { readonly type: "threat"; readonly level: ThreatLevel }
  /** The room's boss entered a new phase. */
  | { readonly type: "bossPhase"; readonly phase: number }
  /** The player picked up an item. */
  | { readonly type: "pickup"; readonly itemId: string }
  /** The trace ended the room. */
  | { readonly type: "death" }
  /** The player reached the exit of a room that is not the run's last. */
  | { readonly type: "roomCleared" }
  /** The player cleared the run's last room, or a classic stage. */
  | { readonly type: "runComplete" };

/** What the loop and the painters read each frame. */
interface LabyrinthLoopState {
  readonly wallTelegraph: ReturnType<typeof tspWallTelegraph> | null;
  readonly reducedMotion: boolean;
  readonly currentMaze: string[][];
  readonly playerPosition: { x: number; y: number };
  readonly visibleMap: boolean[][];
  readonly exploredMap: boolean[][];
  readonly enemies: Enemy[];
  readonly drones: SecurityDrone[];
  readonly dronesStunned: boolean;
  readonly items: ItemPickup[];
  readonly boss: BossState | undefined;
  readonly tspNodes: NonNullable<DungeonRoom["tspNodes"]>;
  readonly tspTour: ReturnType<typeof computeShortestTour>["tour"];
  readonly gameMode: "roguelike" | "classic";
  readonly roomIndex: number;
  readonly gameStatus: GameStatus;
  readonly activeSideEffect: ActiveSideEffect | null;
  readonly currentTheme: CRTThemeConfig;
  readonly crtCalibration: CRTCalibrationConfig;
  readonly playNote: (frequency: number, duration: number) => void;
  readonly takeContactHit: (
    damage: number,
    cause: string,
    at: { x: number; y: number }
  ) => boolean;
}

/**
 * One frame for a painter: the loop's state after this frame's step, and
 * the effects buffers the painter advances as it draws them.
 */
export interface LabyrinthFrame {
  /** The engine's frame timestamp, on the `performance.now()` clock. */
  readonly timestamp: number;
  /** Frames since the session started, for the CRT shimmer. */
  readonly crtFrame: number;
  readonly state: LabyrinthLoopState;
  readonly campaignRooms: readonly DungeonRoom[];
  /** Particles still to draw. The painter fades and drops them. */
  readonly particlesRef: RefObject<ParticleEffect[]>;
  /** Floating lines still to draw. The painter fades and drops them. */
  readonly floatingTextsRef: RefObject<FloatingNotification[]>;
  /** The maze cell under the pointer, for the TSP room's highlight. */
  readonly cursor: { x: number; y: number } | null;
}

/** Draws one frame. */
export type LabyrinthPainter = (frame: LabyrinthFrame) => void;

/** One row of the Market, ready to show. */
interface LabyrinthMarketRow {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly note: string | null;
  readonly disabled: boolean;
  readonly label: string;
}

/**
 * The game as a read-only snapshot (#2376). Views read this and never the
 * session's refs; every change goes through an intent.
 */
interface LabyrinthView {
  readonly gameStatus: GameStatus;
  readonly gameMode: "roguelike" | "classic";
  readonly stage: number;
  readonly roomIndex: number;
  readonly runLength: number;
  readonly isFinalRoom: boolean;
  /**
   * The run is over: the last room is cleared, or a classic stage is. The
   * room's objective and its side effect no longer apply (#2841).
   */
  readonly runComplete: boolean;
  readonly currentRoom: DungeonRoom;
  readonly campaignRooms: readonly DungeonRoom[];
  readonly currentMaze: string[][];
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly playerHp: number;
  readonly maxPlayerHp: number;
  readonly currentRam: number;
  readonly maxRam: number;
  readonly cryptoBounty: number;
  readonly roomCrypto: number;
  readonly cveFeedActive: boolean;
  readonly bypassChips: number;
  readonly score: number;
  readonly highScore: number;
  readonly movesCount: number;
  readonly lastHitBy: string;
  readonly runMoves: readonly number[];
  readonly runCrypto: number;
  readonly runDamage: number;
  readonly runTimeMs: number | null;
  readonly runRoomNames: readonly string[];
  readonly profile: CyberdeckProfile;
  readonly selectedClassId: CyberdeckClassId;
  readonly selectedClass: CyberdeckClass;
  readonly crtThemeId: CRTThemeId;
  readonly currentTheme: CRTThemeConfig;
  readonly crtCalibration: CRTCalibrationConfig;
  readonly weapons: Readonly<Record<WeaponId, Weapon>>;
  readonly loadout: readonly WeaponId[];
  readonly loadoutHasEmp: boolean;
  readonly activeWeaponId: WeaponId;
  readonly dronesStunned: boolean;
  readonly activeSideEffect: ActiveSideEffect | null;
  readonly enemies: readonly Enemy[];
  readonly boss: BossState | undefined;
  readonly tspNodes: NonNullable<DungeonRoom["tspNodes"]>;
  readonly exitLocked: boolean;
  readonly exitLock: ReturnType<typeof getExitLockState>;
  readonly wallShiftLabel: string | null;
  readonly threat: ThreatLevel;
  readonly gridData: string;
  readonly nodeData: string;
  readonly hexPuzzle: HexMatrixPuzzle | null;
  readonly hackingFeedback: string;
  readonly marketOpen: boolean;
  readonly marketRows: readonly LabyrinthMarketRow[];
  readonly route: {
    readonly seed: string;
    readonly map: readonly RouteMapStep[];
    readonly options: readonly RouteMapRoom[];
    readonly selected: number | undefined;
  };
  readonly rewardOffer: readonly RunReward[];
  readonly pendingReward: number | null;
  readonly rewardPromptShown: boolean;
  readonly rewardUnavailable: ReturnType<typeof rewardUnavailableReasons>;
  readonly unlockNotice: string | null;
}

/** Everything a view can ask the game to do. */
interface LabyrinthIntents {
  /** One step, through any scramble a side effect has applied. */
  readonly move: (direction: LabyrinthDirection) => void;
  /**
   * Fires the tool in a hotbar slot (0 to 4). An empty or spent slot says
   * so while the room is playing (#2291).
   */
  readonly fireTool: (slot: number) => void;
  /** Fires the tool the hotbar has selected. */
  readonly fireActive: () => void;
  readonly emp: () => void;
  /** Fires the next tool that has ammo. */
  readonly exploit: () => void;
  readonly openOverlay: (overlay: LabyrinthOverlay) => void;
  /** Closes the Market, class or firmware overlay, back where it opened. */
  readonly closeOverlay: () => void;
  readonly buy: (itemId: string) => void;
  readonly selectHex: (row: number, col: number) => void;
  readonly spendBypassChip: () => void;
  readonly finishHack: () => void;
  readonly submitTimesheet: () => void;
  readonly chooseRoute: (position: number | null) => void;
  readonly pickReward: (offerIndex: number | null) => void;
  readonly skipReward: () => void;
  readonly chooseClass: (classId: CyberdeckClassId) => void;
  readonly buyFirmware: (id: FirmwareUpgradeId) => void;
  /** Moves on to the chosen room, or starts a new run after the last. */
  readonly continue: () => void;
  /** Retries the room from how it was entered. */
  readonly retry: () => void;
  /** Starts a new roguelike run from Room 01. */
  readonly newRun: () => void;
  /** Plays a classic subnet stage. */
  readonly playClassic: (stage: 1 | 2) => void;
  readonly toggleCrt: () => void;
  readonly setTheme: (theme: CRTThemeId) => void;
  readonly setCrtCalibration: (config: CRTCalibrationConfig) => void;
  /** Pauses a running room. */
  readonly pause: () => void;
  /** Resumes a paused room. */
  readonly resume: () => void;
  /** P: pauses a running room or resumes a paused one. */
  readonly togglePause: () => boolean;
  /** Escape: pauses, resumes, or closes the hex terminal or the Market. */
  readonly cancel: () => boolean;
  /** Enter on a card: the card's main action. */
  readonly confirm: () => boolean;
  /** R on a card: retries the room where a retry is offered. */
  readonly retryRoom: () => boolean;
  /** The maze cell under the pointer, or null when it leaves the maze. */
  readonly pointAt: (cell: { x: number; y: number } | null) => void;
}

/** Options for {@link useRetroLabyrinthSession}. */
interface RetroLabyrinthSessionOptions {
  /** Whether the loop runs. A server render passes false. */
  readonly active: boolean;
  /** Tools hold still and the boss holds its angle under reduced motion. */
  readonly reducedMotion: boolean;
  /**
   * The input tuning (#2376). Unused until the touch-tuning issue (#2383)
   * gives coarse pointers their assists.
   */
  readonly tuning?: { readonly input: "fine" | "coarse" };
}

/** What {@link useRetroLabyrinthSession} returns. */
export interface RetroLabyrinthSession {
  readonly view: LabyrinthView;
  readonly intents: LabyrinthIntents;
  /** Calls `listener` with each one-shot event. Returns an unsubscribe. */
  readonly subscribe: (listener: (event: LabyrinthEvent) => void) => () => void;
  /** Calls `paint` once per frame. Returns an unsubscribe. */
  readonly onFrame: (paint: LabyrinthPainter) => () => void;
}

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getHighScoreSnapshot = () => {
  try {
    return safeGetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY) || "0";
  } catch {
    return "0";
  }
};
const getHighScoreServerSnapshot = () => "0";

/**
 * Retro Labyrinth's session (#2376, ADR 0062): the whole game, moved out of
 * the component that drew it. It owns the room and the run, the loop and the
 * pause, and exposes a read-only {@link LabyrinthView}, the intents, one-shot
 * events and a painter hook. It never reads the device: no phone, touch or
 * media query checks. The host passes reduced motion and the input tuning.
 *
 * @param options - Whether the loop runs, and the host's motion and tuning.
 * @returns The session.
 */
export function useRetroLabyrinthSession(
  options: RetroLabyrinthSessionOptions
): RetroLabyrinthSession {
  const { active, reducedMotion } = options;
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const { announce } = useAnnouncer();

  // One-shot events go straight to the views that subscribed.
  const eventListenersRef = useRef(new Set<(event: LabyrinthEvent) => void>());
  const emit = useCallback((event: LabyrinthEvent) => {
    [...eventListenersRef.current].forEach((listener) => listener(event));
  }, []);
  const paintersRef = useRef(new Set<LabyrinthPainter>());
  // How many views paint the room. Game time passes only while one does, so
  // the run does not start behind a view chunk that is still loading.
  const [painterCount, setPainterCount] = useState(0);

  // Persistent Cyberdeck Profile & Meta-Progression
  const [profile, setProfile] = useState<CyberdeckProfile>(() =>
    loadCyberdeckProfile()
  );
  const [selectedClassId, setSelectedClassId] =
    useState<CyberdeckClassId>("script_kiddie");
  const selectedClass =
    CYBERDECK_CLASSES[selectedClassId] || CYBERDECK_CLASSES.script_kiddie;
  // The firmware tiers in force for this run. Tiers bought between runs wait
  // for the next run start, so a purchase never changes a run under way
  // (#2085).
  const [runFirmware, setRunFirmware] = useState<FirmwareTiers>(
    () => profile.firmwareUpgrades
  );
  const runFirmwareBonus = useMemo(
    () => firmwareBonuses(runFirmware),
    [runFirmware]
  );
  const openingStats = cyberdeckStartingStats(selectedClassId, runFirmware);
  // Firmware and the APT Specialist's passive both widen the AoE (#2085).
  const runAoeRadiusBonus = aoeRadiusBonus(selectedClassId, runFirmware);

  // CRT Phosphor Theme & Calibration. Emerald phosphor is the default
  // theme (#1522). The CRT follows the cabinet's Setup Wizard filter, Soft
  // by default, unless the player saved their own calibration in the CRT
  // modal or with the C key.
  const [crtThemeId, setCrtThemeId] = useState<CRTThemeId>("emerald");
  const cabinetSetup = useCabinetSetup();
  const cabinetCrtFilter = cabinetSetup?.config.crtFilter;
  const [savedCrtCalibration, setSavedCrtCalibration] =
    useState<CRTCalibrationConfig | null>(() =>
      safeGetRawItem(CRT_CALIBRATION_STORAGE_KEY) ? loadCRTCalibration() : null
    );
  const crtCalibration = useMemo(
    () => resolveLabyrinthCrt(cabinetCrtFilter, savedCrtCalibration),
    [cabinetCrtFilter, savedCrtCalibration]
  );
  const currentTheme = CRT_THEMES[crtThemeId] || CRT_THEMES.emerald;

  // Game mode & stage
  const [gameMode, setGameMode] = useState<"roguelike" | "classic">(
    "roguelike"
  );
  const [stage, setStage] = useState<number>(1);
  const [roomIndex, setRoomIndex] = useState<number>(0);
  // The room library a run routes through, and the route taken so far: its
  // seed and the rooms entered (#2084). The mount effect replaces this
  // placeholder route with a freshly seeded one.
  const [roomLibrary, setRoomLibrary] = useState<DungeonRoom[]>(() =>
    generateRoguelikeCampaign()
  );
  const [runRoute, setRunRoute] = useState<RunRoute>(() =>
    startRunRoute(createRunSeed(0))
  );
  // The rooms of this run in play order; the current room is roomIndex.
  const campaignRooms = useMemo(
    () => routeRooms(roomLibrary, runRoute),
    [roomLibrary, runRoute]
  );
  const runLength = routeRunLength(roomLibrary);
  // What the run's reward picks have added to the class (#2084).
  const [runBuild, setRunBuild] = useState<RunBuild>(EMPTY_RUN_BUILD);
  const runBonuses = useMemo(() => runBuildBonuses(runBuild), [runBuild]);
  // The room-cleared screen's picks: the next room (a library position; null
  // means the first option) and the reward (an offer index; null skips it).
  const [pendingRoute, setPendingRoute] = useState<number | null>(null);
  const [pendingReward, setPendingReward] = useState<number | null>(null);
  // Enter with no reward picked asks once before skipping it (#2177).
  const [rewardPromptShown, setRewardPromptShown] = useState(false);
  // The class a cleared room just unlocked, shown on its card (#2085).
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);

  // Active room & grid
  const [currentMaze, setCurrentMaze] = useState<string[][]>(STAGE_1_MAZE);
  const [playerPosition, setPlayerPosition] = useState({
    x: START_X,
    y: START_Y,
  });
  const [playerHp, setPlayerHp] = useState(selectedClass.baseHp);
  const [maxPlayerHp, setMaxPlayerHp] = useState(selectedClass.baseHp);

  // Cyberdeck RAM & Currency Resources
  const [currentRam, setCurrentRam] = useState(openingStats.ram);
  const [maxRam, setMaxRam] = useState(openingStats.ram);
  const [cryptoBounty, setCryptoBounty] = useState(0);
  // Crypto earned in the current room. Only this counts toward the room's
  // exit bonus, so a coin never scores twice (#1668).
  const [roomCrypto, setRoomCrypto] = useState(0);
  // The Market's CVE Threat Feed, once bought, exposes CVEs on every room
  // entry for the rest of the run (#1668).
  const [cveFeedActive, setCveFeedActive] = useState(false);
  const cveFeedRef = useRef(false);
  const [bypassChips, setBypassChips] = useState(openingStats.bypassChips);

  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const effectiveHighScore = Math.max(highScore, loadedHighScore);
  const [movesCount, setMovesCount] = useState(0);

  // Game lifecycle status & Modals
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  // Where the Market or class overlay returns to when it closes. A room that
  // was running comes back paused, so nothing hits the player unseen (#1669).
  const overlayReturnStatusRef = useRef<GameStatus>("paused");
  // Moves and crypto of each room cleared so far this run, so the run's end
  // card reports the run rather than its last room (#1943).
  // What last hurt the player, named on the trace card (#1943).
  const [lastHitBy, setLastHitBy] = useState(
    "EDR Sentinel Daemons severed your cyberdeck proxy tunnel."
  );
  const [clearedRooms, setClearedRooms] = useState<
    { moves: number; crypto: number }[]
  >([]);
  // HP lost across the run, retries included, and when the run started and
  // ended, for the run-complete card (#2291).
  const [runDamage, setRunDamage] = useState(0);
  const runStartedAtRef = useRef(0);
  const [runTimeMs, setRunTimeMs] = useState<number | null>(null);
  // Hacking Minigame State
  const [hexPuzzle, setHexPuzzle] = useState<HexMatrixPuzzle | null>(null);
  const [hackingFeedback, setHackingFeedback] = useState<string>("");

  // Combat & Weapons
  const [weapons, setWeapons] =
    useState<Record<WeaponId, Weapon>>(DEFAULT_WEAPONS);
  // The class tools, then any weapons picked as route rewards (#2084).
  const loadout = useMemo(
    () => runLoadout(selectedClass.starterWeapons, runBuild),
    [selectedClass.starterWeapons, runBuild]
  );
  const [rawActiveWeaponId, setActiveWeaponId] = useState<WeaponId>(() => {
    return selectedClass.starterWeapons?.[0] || "npm_install";
  });
  const activeWeaponId = loadout.includes(rawActiveWeaponId)
    ? rawActiveWeaponId
    : loadout[0] || "npm_install";
  const [dronesStunned, setDronesStunned] = useState(false);
  const [activeSideEffect, setActiveSideEffect] =
    useState<ActiveSideEffect | null>(null);

  // Room Entities
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  // A live patrol within two steps warns (amber), and one that can step onto
  // the player next turn is red. The phone view shows it (ADR 0061).
  const threat: ThreatLevel =
    gameStatus === "playing" ? patrolThreat(playerPosition, enemies) : "none";
  const lastThreatRef = useRef<ThreatLevel>("none");
  useEffect(() => {
    if (lastThreatRef.current === threat) return;
    lastThreatRef.current = threat;
    emit({ type: "threat", level: threat });
  }, [threat, emit]);
  const [items, setItems] = useState<ItemPickup[]>([]);
  const [boss, setBoss] = useState<BossState | undefined>(undefined);
  // The player's last step and when it was taken; boss salvos lead it (#1321).
  const lastHeadingRef = useRef<{ dx: number; dy: number; at: number } | null>(
    null
  );
  const [tspNodes, setTspNodes] = useState(generateTSPRoom().tspNodes || []);
  // Testing and playtest read the room as data: the grid, the route nodes and
  // whether the exit is still locked. Recomputed only when they change.
  const gridData = useMemo(() => serializeGrid(currentMaze), [currentMaze]);
  const nodeData = useMemo(() => serializeNodes(tspNodes), [tspNodes]);
  const [tspWalls, setTspWalls] = useState(
    generateTSPRoom().tspMovingWalls || []
  );

  // Backward compatibility state for Stage 2 Drone
  const [drones, setDrones] = useState<SecurityDrone[]>([]);

  // Field of View & Exploration
  const [exploredMap, setExploredMap] = useState<boolean[][]>(() =>
    Array.from({ length: 9 }, () => Array(15).fill(false))
  );
  const [visibleMap, setVisibleMap] = useState<boolean[][]>(() =>
    Array.from({ length: 9 }, () => Array(15).fill(true))
  );

  // FX: Particles & Floating texts
  const particlesRef = useRef<ParticleEffect[]>([]);
  const floatingTextsRef = useRef<FloatingNotification[]>([]);
  // Whether a boss volley has hit the player in this room, for the no-hit
  // boss trophy (#2181). Every room load, retries included, clears it.
  const bossHitThisRoomRef = useRef(false);
  const cursorGridPosRef = useRef<{ x: number; y: number } | null>(null);

  const { recordEvent } = useTelemetry();
  const { playNote, playSuccess } = useAudio();

  // Initialize or Switch to a specific Room / Stage
  // A roguelike room is entered along a route; leaving the route out starts a
  // freshly seeded one.
  const loadRoom = useCallback(
    (
      mode: "roguelike" | "classic",
      targetStageOrIndex: number,
      route?: RunRoute
    ) => {
      setGameMode(mode);
      setPendingRoute(null);
      setPendingReward(null);
      setRewardPromptShown(false);
      setUnlockNotice(null);
      bossHitThisRoomRef.current = false;
      floatingTextsRef.current = [
        {
          id: `objective-${Date.now()}`,
          x: 7,
          y: 8,
          text: "REACH THE EXIT >>",
          color: "#f59e0b",
          alpha: 3,
          vy: 0,
        },
      ];
      setMovesCount(0);
      setRoomCrypto(0);
      setDronesStunned(false);
      setActiveSideEffect(null);
      setGameStatus("playing");

      if (mode === "classic") {
        setStage(targetStageOrIndex);
        const classicRoom =
          targetStageOrIndex === 2
            ? generateClassicStage2()
            : generateClassicStage1();
        setCurrentMaze(classicRoom.grid);
        setPlayerPosition({ x: classicRoom.startX, y: classicRoom.startY });
        setEnemies(classicRoom.enemies);
        setItems([]);
        setBoss(undefined);
        if (targetStageOrIndex === 2) {
          setDrones([{ x: 6, y: 5, dir: "right", minX: 5, maxX: 9 }]);
        } else {
          setDrones([]);
        }
        setVisibleMap(Array.from({ length: 9 }, () => Array(15).fill(true)));
        setExploredMap(Array.from({ length: 9 }, () => Array(15).fill(true)));
      } else {
        const library = generateRoguelikeCampaign();
        const activeRoute = route ?? startRunRoute(createRunSeed());
        if (!route) {
          // A room entered without a route starts a new run (#2291).
          setRunDamage(0);
          setRunTimeMs(null);
          runStartedAtRef.current = Date.now();
        }
        setRoomLibrary(library);
        setRunRoute(activeRoute);
        const rooms = routeRooms(library, activeRoute);
        const idx = clamp(targetStageOrIndex, 0, rooms.length - 1);
        setRoomIndex(idx);
        const currentRoom = rooms[idx];
        setStage(idx + 1);
        setCurrentMaze(currentRoom.grid);
        setPlayerPosition({ x: currentRoom.startX, y: currentRoom.startY });
        setEnemies(
          cveFeedRef.current
            ? currentRoom.enemies.map((e) => ({ ...e, cveExposed: true }))
            : currentRoom.enemies
        );
        setItems(currentRoom.items);
        setBoss(
          currentRoom.boss
            ? armBossForRoomEntry(currentRoom.boss, performance.now())
            : undefined
        );
        setTspNodes(currentRoom.tspNodes || []);
        // A boss or route-node room names its objective instead of the exit,
        // which stays locked until that is done (#1321).
        const roomObjective = getExitLockState(
          currentRoom.boss,
          currentRoom.tspNodes
        );
        if (roomObjective.locked) {
          floatingTextsRef.current[0] = {
            ...floatingTextsRef.current[0],
            text: `${roomObjective.objective} >>`,
          };
        }
        setTspWalls(currentRoom.tspMovingWalls || []);
        // Patrol drones are enemies, moved and drawn with the rest. A room's
        // sweeping security drones run on a timer (#2273); rooms without them
        // start with none, so no static copy is left on the spawn tile (#1665).
        setDrones(currentRoom.drones ?? []);

        const fov = calculateFOV(
          currentRoom.grid,
          currentRoom.startX,
          currentRoom.startY,
          7
        );
        setVisibleMap(fov.visible);
        setExploredMap(fov.explored);
      }
    },
    []
  );

  // HP, RAM, score, crypto, weapon ammo and the Threat Feed as the player
  // entered the current room. Retry restores these, so a breach that ended at
  // 0 HP doesn't restart at 0 HP, dying then retrying can't bank the room's
  // points twice (#1552), and a boss retry has the ammo to win (#1667).
  const roomEntryVitalsRef = useRef({
    hp: selectedClass.baseHp,
    ram: openingStats.ram,
    score: 0,
    cryptoBounty: 0,
    weapons: DEFAULT_WEAPONS,
    cveFeed: false,
  });

  // Whether the current run has been counted in runsCompleted. A run counts
  // once, when it is cleared or first lost; retrying a lost room continues the
  // same run (#2048).
  const runEndRecordedRef = useRef(false);

  // Switch Stage (classic support)
  const switchStage = useCallback(
    (stgNum: number) => {
      runEndRecordedRef.current = false;
      roomEntryVitalsRef.current = {
        ...roomEntryVitalsRef.current,
        score,
        cryptoBounty,
        weapons,
      };
      loadRoom("classic", stgNum);
    },
    [loadRoom, score, cryptoBounty, weapons]
  );

  // Picks a saved run up at the start of the room it was saved in (#3466).
  // The room loads as on entry, so a reload never resumes mid-room and a
  // boss room opens at the boss's opening. The no-hit boss trophy reads a
  // flag every room load clears, so a resume earns it only by a clean room.
  const resumeRun = useCallback(
    (save: RetroLabyrinthRunSave) => {
      const start = cyberdeckStartingStats(save.classId, save.firmware);
      const resumedWeapons: Record<WeaponId, Weapon> = { ...DEFAULT_WEAPONS };
      for (const [id, ammo] of Object.entries(save.ammo)) {
        const weaponId = id as WeaponId;
        resumedWeapons[weaponId] = { ...resumedWeapons[weaponId], ammo };
      }
      setSelectedClassId(save.classId);
      setRunFirmware(save.firmware);
      setMaxPlayerHp(save.maxHp);
      setPlayerHp(save.hp);
      setMaxRam(save.maxRam);
      setCurrentRam(save.ram);
      setBypassChips(start.bypassChips);
      setWeapons(resumedWeapons);
      setActiveWeaponId(save.activeWeaponId);
      setScore(save.score);
      setCryptoBounty(save.crypto);
      setRunBuild(save.loadout);
      setClearedRooms([]);
      setRunDamage(save.runDamage ?? 0);
      setRunTimeMs(null);
      runEndRecordedRef.current = false;
      cveFeedRef.current = false;
      setCveFeedActive(false);
      runStartedAtRef.current = Date.now() - save.elapsedMs;
      roomEntryVitalsRef.current = {
        hp: save.hp,
        ram: save.ram,
        score: save.score,
        cryptoBounty: save.crypto,
        weapons: resumedWeapons,
        cveFeed: false,
      };
      loadRoom("roguelike", save.roomIndex, {
        seed: save.seed,
        path: save.route,
      });
    },
    [loadRoom]
  );

  // Load the opening room on mount so the maze, fog and HUD match the room,
  // or the saved run the Launch screen asked to resume (#3466).
  useEffect(() => {
    const resume = takeRunResumeRequest();
    if (resume) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resumeRun(resume);
      return;
    }
    // A save of an unknown version or shape is never resumed; drop it.
    if (safeGetRawItem(RUN_SAVE_KEY) !== null && loadRun() === null) {
      clearRun();
    }
    loadRoom("roguelike", 0);
  }, [loadRoom, resumeRun]);

  // A run that ends in a trace still counts toward the high score; only
  // reaching the exit used to record it (#1552). Same key and bare numeric
  // string as the exit path.
  useEffect(() => {
    if (gameStatus !== "caught" || score <= effectiveHighScore) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighScore(score);
    safeSetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY, score.toString());
    recordArcadeScore("retro-labyrinth", score);
  }, [gameStatus, score, effectiveHighScore]);

  // A lost run counts toward runsCompleted once, however many times its room
  // is retried afterwards (#2048).
  useEffect(() => {
    if (gameStatus !== "caught" || runEndRecordedRef.current) return;
    runEndRecordedRef.current = true;
    const updatedProf = recordCyberdeckRoomResult(profile, {
      crypto: 0,
      score,
      endsRun: true,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(updatedProf);
    saveCyberdeckProfile(updatedProf);
  }, [gameStatus, profile, score]);

  // Restart current stage
  const handleRestart = useCallback(() => {
    const entry = roomEntryVitalsRef.current;
    setPlayerHp(entry.hp);
    setCurrentRam(entry.ram);
    setScore(entry.score);
    setCryptoBounty(entry.cryptoBounty);
    setWeapons(entry.weapons);
    cveFeedRef.current = entry.cveFeed;
    setCveFeedActive(entry.cveFeed);
    if (gameMode === "classic") {
      loadRoom("classic", stage);
    } else {
      loadRoom("roguelike", roomIndex, runRoute);
    }
  }, [gameMode, stage, roomIndex, runRoute, loadRoom]);

  // Start Roguelike Campaign with chosen Cyberdeck Class
  const startRoguelikeCampaign = useCallback(() => {
    // A new run, from New run, Restart, Setup or the end of a run, replaces
    // any saved one (#3466).
    clearRun();
    const chosenClass =
      CYBERDECK_CLASSES[selectedClassId] || CYBERDECK_CLASSES.script_kiddie;
    // A new run takes the firmware the profile owns now (#2085).
    const firmware = profile.firmwareUpgrades;
    const start = cyberdeckStartingStats(chosenClass.id, firmware);
    setRunFirmware(firmware);
    setPlayerHp(start.hp);
    setMaxPlayerHp(start.hp);
    setCurrentRam(start.ram);
    setMaxRam(start.ram);
    setBypassChips(start.bypassChips);
    setWeapons(DEFAULT_WEAPONS);
    if (chosenClass.starterWeapons?.[0]) {
      setActiveWeaponId(chosenClass.starterWeapons[0]);
    }
    setScore(0);
    setCryptoBounty(0);
    setClearedRooms([]);
    setRunBuild(EMPTY_RUN_BUILD);
    runEndRecordedRef.current = false;
    cveFeedRef.current = false;
    setCveFeedActive(false);
    roomEntryVitalsRef.current = {
      hp: start.hp,
      ram: start.ram,
      score: 0,
      cryptoBounty: 0,
      weapons: DEFAULT_WEAPONS,
      cveFeed: false,
    };
    loadRoom("roguelike", 0);
  }, [selectedClassId, profile.firmwareUpgrades, loadRoom]);

  // The room-cleared screen's offers: the next rooms on the route and the
  // three rewards, both drawn from the run seed (#2084).
  const routeOptions = useMemo(
    () =>
      gameMode === "roguelike" ? drawRouteOptions(roomLibrary, runRoute) : [],
    [gameMode, roomLibrary, runRoute]
  );
  const rewardOffer = useMemo(
    () => drawRunRewards(runRoute.seed, roomIndex, loadout),
    [runRoute.seed, roomIndex, loadout]
  );
  const selectedRoute =
    pendingRoute !== null && routeOptions.includes(pendingRoute)
      ? pendingRoute
      : routeOptions[0];

  // Advance along the route to the chosen room, taking the chosen reward.
  // After the last room the run is complete, and continuing starts a new run
  // from Room 01 (#1668).
  const handleNextRoom = useCallback(() => {
    if (roomIndex >= runLength - 1 || selectedRoute === undefined) {
      startRoguelikeCampaign();
      return;
    }
    const reward = pendingReward === null ? null : rewardOffer[pendingReward];
    let nextBuild = runBuild;
    let nextWeapons = weapons;
    let hp = playerHp;
    let nextMaxHp = maxPlayerHp;
    let ram = currentRam;
    let nextMaxRam = maxRam;
    if (reward) {
      nextBuild = applyRunReward(runBuild, reward);
      if (reward.kind === "weapon") {
        // A new tool comes at full ammo; a full loadout's cache refills it.
        const refilled = reward.weaponId ? [reward.weaponId] : loadout;
        nextWeapons = { ...weapons };
        for (const id of refilled) {
          nextWeapons[id] = {
            ...nextWeapons[id],
            ammo: nextWeapons[id].maxAmmo,
          };
        }
      } else if (reward.kind === "heal") {
        hp = Math.min(nextMaxHp, hp + reward.hp);
      } else {
        const passive = RUN_PASSIVES[reward.passiveId];
        nextMaxHp += passive.maxHp ?? 0;
        hp += passive.maxHp ?? 0;
        nextMaxRam += passive.maxRam ?? 0;
        ram += passive.maxRam ?? 0;
      }
    }
    // Rooms open with at least half health, so a boss fight that ended at
    // 5 HP doesn't make every later room (and every retry of it) a one-hit
    // death (#1943).
    const entryHp = Math.max(hp, Math.ceil(nextMaxHp / 2));
    const chipsPerRoom = runBuildBonuses(nextBuild).chipsPerRoom;
    setRunBuild(nextBuild);
    setWeapons(nextWeapons);
    setMaxPlayerHp(nextMaxHp);
    setPlayerHp(entryHp);
    setMaxRam(nextMaxRam);
    setCurrentRam(ram);
    if (chipsPerRoom > 0) setBypassChips((b) => b + chipsPerRoom);
    setClearedRooms((rooms) => [
      ...rooms,
      { moves: movesCount, crypto: roomCrypto },
    ]);
    roomEntryVitalsRef.current = {
      hp: entryHp,
      ram,
      score,
      cryptoBounty,
      weapons: nextWeapons,
      cveFeed: cveFeedActive,
    };
    loadRoom(
      "roguelike",
      roomIndex + 1,
      chooseRouteRoom(roomLibrary, runRoute, selectedRoute)
    );
  }, [
    roomIndex,
    runLength,
    selectedRoute,
    pendingReward,
    rewardOffer,
    runBuild,
    loadout,
    roomLibrary,
    runRoute,
    loadRoom,
    startRoguelikeCampaign,
    playerHp,
    maxPlayerHp,
    maxRam,
    movesCount,
    roomCrypto,
    currentRam,
    score,
    cryptoBounty,
    weapons,
    cveFeedActive,
  ]);

  // The run as it stood when the current room was entered, for the save
  // (#3466). Refs, so the save effect and the suspend listener read the
  // latest without re-subscribing.
  const saveSourceRef = useRef({
    gameMode,
    gameStatus,
    runRoute,
    roomIndex,
    runLength,
    maxPlayerHp,
    maxRam,
    runBuild,
    selectedClassId,
    activeWeaponId,
    runFirmware,
    runDamage,
  });
  useEffect(() => {
    saveSourceRef.current = {
      gameMode,
      gameStatus,
      runRoute,
      roomIndex,
      runLength,
      maxPlayerHp,
      maxRam,
      runBuild,
      selectedClassId,
      activeWeaponId,
      runFirmware,
      runDamage,
    };
  });
  // The route the session holds before its first room loads; it is never a
  // run worth saving.
  const placeholderRouteRef = useRef(runRoute);

  /** Saves the current roguelike room as it was entered (#3466). */
  const writeRoomSave = useCallback(() => {
    const src = saveSourceRef.current;
    if (src.gameMode !== "roguelike") return;
    if (src.runRoute === placeholderRouteRef.current) return;
    // Room 01 is where every run starts, so a save there resumes nothing.
    // Saving it would turn Launch into Resume for anyone who only looked in.
    if (src.roomIndex === 0) return;
    const entry = roomEntryVitalsRef.current;
    const ammo: Partial<Record<WeaponId, number>> = {};
    for (const [id, weapon] of Object.entries(entry.weapons)) {
      ammo[id as WeaponId] = weapon.ammo;
    }
    saveRun({
      seed: src.runRoute.seed,
      route: [...src.runRoute.path],
      roomIndex: src.roomIndex,
      hp: entry.hp,
      maxHp: src.maxPlayerHp,
      ram: entry.ram,
      maxRam: src.maxRam,
      crypto: entry.cryptoBounty,
      ammo,
      loadout: src.runBuild,
      classId: src.selectedClassId,
      activeWeaponId: src.activeWeaponId,
      firmware: src.runFirmware,
      score: entry.score,
      elapsedMs: Math.max(0, Date.now() - runStartedAtRef.current),
      runLength: src.runLength,
      runDamage: src.runDamage,
    });
  }, []);

  // Every roguelike room entry after Room 01 is a save point (#3466): the
  // next room on the route and a resumed room both land here.
  useEffect(() => {
    writeRoomSave();
  }, [runRoute, roomIndex, gameMode, writeRoomSave]);

  // Crypto the player earns (not spends) counts toward this room's exit
  // bonus as well as the balance (#1668).
  const earnCrypto = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCryptoBounty((c) => c + amount);
    setRoomCrypto((r) => r + amount);
  }, []);

  // Grid position of the hacking terminal the player is working on.
  const hackTerminalPosRef = useRef<{ x: number; y: number } | null>(null);

  // Trigger Terminal Hacking Minigame
  const openHackingTerminal = useCallback(
    (difficulty: number = 2) => {
      const puzzle = generateHexMatrixPuzzle(
        difficulty,
        runFirmwareBonus.hexBufferSlots
      );
      setHexPuzzle(puzzle);
      setHackingFeedback(
        "Pick from the highlighted row, then the column of that cell, then its row…"
      );
      setGameStatus("hacking");
      retroAudio.playTone(600, 80, "sawtooth", 0.08);
    },
    [runFirmwareBonus.hexBufferSlots]
  );

  // Handle Hex Cell Selection in Minigame
  const handleHexCellClick = useCallback(
    (row: number, col: number) => {
      if (!hexPuzzle) return;
      const res = selectHexCell(hexPuzzle, row, col);
      setHexPuzzle(res.puzzle);
      setHackingFeedback(res.message);

      if (res.soundType === "match") {
        retroAudio.playHackSuccess();
        earnCrypto(res.puzzle.rewardCrypto);
        setScore((s) => s + res.puzzle.rewardCrypto * 2);
        if (res.puzzle.rewardBypassChips > 0) {
          setBypassChips((b) => b + res.puzzle.rewardBypassChips);
        }
      } else if (res.soundType === "fail") {
        retroAudio.playTone(150, 200, "sawtooth", 0.1);
      } else {
        retroAudio.playTone(800, 40, "sine", 0.05);
      }
    },
    [hexPuzzle, earnCrypto]
  );

  // A finished puzzle disables the cell that was just clicked, which drops
  // focus to the page and left Escape and the arrows dead (#1943). Hand it to
  // the Complete Decryption button instead.
  const hackCloseButtonRef = useRef<HTMLButtonElement>(null);
  const hackFinished = !!(hexPuzzle?.solved || hexPuzzle?.failed);
  useEffect(() => {
    if (hackFinished)
      hackCloseButtonRef.current?.focus({ preventScroll: true });
  }, [hackFinished]);

  // Use Bypass Chip in Minigame
  const handleUseBypassChip = useCallback(() => {
    if (!hexPuzzle || bypassChips <= 0) return;
    setBypassChips((b) => b - 1);
    const solved = consumeBypassChip(hexPuzzle);
    setHexPuzzle(solved);
    setHackingFeedback("HARDWARE BYPASS VERIFIED! Terminal Decrypted.");
    retroAudio.playHackSuccess();
    earnCrypto(solved.rewardCrypto);
    setScore((s) => s + solved.rewardCrypto * 2);
  }, [hexPuzzle, bypassChips, earnCrypto]);

  // Close Hacking Minigame Modal. A decrypted terminal goes dark, so the
  // player can walk on without reopening it.
  const closeHackingModal = useCallback(() => {
    const terminal = hackTerminalPosRef.current;
    if (terminal && hexPuzzle?.solved) {
      setCurrentMaze((maze) =>
        maze.map((row, y) =>
          row.map((cell, x) =>
            x === terminal.x && y === terminal.y && cell === "H" ? " " : cell
          )
        )
      );
    }
    hackTerminalPosRef.current = null;
    setGameStatus("playing");
    setHexPuzzle(null);
  }, [hexPuzzle]);

  // Darknet Vendor Purchase
  const buyDarknetItem = useCallback(
    (itemId: string) => {
      const item = DARKNET_VENDOR_CATALOG.find((i) => i.id === itemId);
      if (!item || cryptoBounty < item.cost) {
        retroAudio.playTone(140, 150, "sawtooth", 0.1);
        return;
      }

      setCryptoBounty((c) => c - item.cost);
      retroAudio.playPickup();

      if (item.category === "ram") {
        setMaxRam((r) => r + 16);
        setCurrentRam((r) => r + 16);
      } else if (item.category === "chip") {
        setBypassChips((b) => b + 1);
      } else if (item.category === "weapon") {
        // 0-Day ammo, or the same damage in a weapon this class can fire.
        const grant = grantAmmoForLoadout(
          weapons,
          loadout,
          "zero_day",
          2,
          false
        );
        setWeapons(grant.updatedWeapons);
        floatingTextsRef.current.push({
          id: `market-ammo-${Date.now()}`,
          x: playerPosition.x,
          y: playerPosition.y,
          text: describeAmmoGrants([grant]),
          color: "#ec4899",
          alpha: 1.5,
          vy: -0.02,
        });
      } else if (item.category === "heal") {
        setPlayerHp((hp) => Math.min(maxPlayerHp, hp + 50));
        setActiveSideEffect(null);
      } else if (item.category === "firmware") {
        // Applies now and on every later room entry this run (#1668).
        cveFeedRef.current = true;
        setCveFeedActive(true);
        setEnemies((prev) => prev.map((e) => ({ ...e, cveExposed: true })));
      }
    },
    [
      cryptoBounty,
      maxPlayerHp,
      weapons,
      loadout,
      playerPosition.x,
      playerPosition.y,
    ]
  );

  // Attempt player move
  // After any contact hit the player is untouchable for a moment, so a held
  // key or a patrol that keeps bumping costs one hit, not one per keypress
  // or per enemy step (#2176).
  const contactImmuneUntilRef = useRef(0);
  const takeContactHit = useCallback(
    (damage: number, cause: string, at: { x: number; y: number }) => {
      const now = performance.now();
      if (now < contactImmuneUntilRef.current) return false;
      contactImmuneUntilRef.current = now + CONTACT_IMMUNITY_MS;
      setLastHitBy(cause);
      setRunDamage((total) => total + damage);
      setPlayerHp((hp) => {
        const nextHp = hp - damage;
        if (nextHp <= 0) {
          setGameStatus("caught");
          retroAudio.playAlertPulse();
          return 0;
        }
        return nextHp;
      });
      floatingTextsRef.current.push({
        id: `contact-hit-${now}`,
        x: at.x,
        y: at.y,
        text: `-${damage} HP`,
        color: "#ef4444",
        alpha: 1,
        vy: -0.02,
      });
      playNote(200, 0.2);
      emit({ type: "bump", damage, cause });
      return true;
    },
    [playNote, emit]
  );

  const tryMove = useCallback(
    (dx: number, dy: number) => {
      if (gameStatus !== "playing") return;

      const nextX = playerPosition.x + dx;
      const nextY = playerPosition.y + dy;

      // Boundary & Wall check
      if (
        nextY >= 0 &&
        nextY < currentMaze.length &&
        nextX >= 0 &&
        nextX < currentMaze[0].length &&
        currentMaze[nextY][nextX] !== "#" &&
        currentMaze[nextY][nextX] !== "W"
      ) {
        // Walking into a drone or another live enemy costs HP and leaves
        // the player where they were, rather than ending the run outright.
        if (
          !dronesStunned &&
          (drones.some((d) => d.x === nextX && d.y === nextY) ||
            enemies.some(
              (e) =>
                e.x === nextX &&
                e.y === nextY &&
                e.state !== "stunned" &&
                e.state !== "frozen"
            ))
        ) {
          takeContactHit(
            DRONE_CONTACT_DAMAGE,
            "You walked into a patrolling security process, and it traced you.",
            playerPosition
          );
          return;
        }

        // A locked exit is a wall until the room objective is done (#1321).
        if (gameMode === "roguelike" && nextX === EXIT_X && nextY === EXIT_Y) {
          const exitLock = getExitLockState(boss, tspNodes);
          if (exitLock.locked) {
            floatingTextsRef.current.push({
              id: `exit-locked-${Date.now()}`,
              x: nextX,
              y: nextY,
              text: exitLock.lockedMessage,
              color: "#ef4444",
              alpha: 1.5,
              vy: -0.02,
            });
            playNote(160, 0.15);
            return;
          }
        }

        lastHeadingRef.current = { dx, dy, at: Date.now() };
        const nextMoves = movesCount + 1;
        setPlayerPosition({ x: nextX, y: nextY });
        setMovesCount(nextMoves);

        // Regenerate Cyberdeck RAM
        setCurrentRam((r) =>
          Math.min(maxRam, r + selectedClass.ramRegen + runBonuses.ramRegen)
        );

        // Audio step pulse
        retroAudio.playStep();
        playNote(523.25 + (nextX + nextY) * 20, 0.02);

        // Update FOV in Roguelike mode
        if (gameMode === "roguelike") {
          const fov = calculateFOV(currentMaze, nextX, nextY, 7, exploredMap);
          setVisibleMap(fov.visible);
          setExploredMap(fov.explored);
        }

        // Route nodes: every move (keyboard, d-pad tap, hold or swipe) lands
        // here, so each one collects a node the same way. The side effects run
        // here, outside any state updater, and only when a node is new.
        if (gameMode === "roguelike") {
          const visit = markNodeVisited(tspNodes, nextX, nextY);
          if (visit.collected) {
            setTspNodes(visit.nodes);
            // The in-world prompt is drawn once per room, so the last node
            // re-states the goal when it opens the exit.
            if (
              getExitLockState(boss, tspNodes).locked &&
              !getExitLockState(boss, visit.nodes).locked
            ) {
              floatingTextsRef.current.push({
                id: `exit-open-${Date.now()}`,
                x: 7,
                y: 8,
                text: "REACH THE EXIT >>",
                color: "#f59e0b",
                alpha: 3,
                vy: 0,
              });
              // A phone has no objective line, so it hears it as a toast.
              emit({ type: "exitOpened" });
            }
            playSuccess();
            retroAudio.playPickup();
            setScore((s) => s + 200);
            earnCrypto(50);
            floatingTextsRef.current.push({
              id: `tsp-node-${Date.now()}`,
              x: nextX,
              y: nextY,
              text: "AIRGAP NODE BYPASS! +200 PTS",
              color: currentTheme.accentColor,
              alpha: 1,
              vy: -0.02,
            });
          }
        }

        // TSP room: Dynamic wall shifting
        if (
          gameMode === "roguelike" &&
          campaignRooms[roomIndex]?.id === "tsp"
        ) {
          const { updatedGrid, updatedWalls } = updateTSPMovingWalls(
            currentMaze,
            tspWalls,
            nextMoves
          );
          setCurrentMaze(updatedGrid);
          setTspWalls(updatedWalls);
        }

        // Item Collection check. Ammo goes to a weapon this class can
        // fire, and the floating line says which (#1667).
        const pickup = items.find(
          (item) => !item.collected && item.x === nextX && item.y === nextY
        );
        if (pickup) {
          retroAudio.playPickup();
          playNote(784, 0.1);
          let pickupText = pickup.name;
          if (pickup.itemId === "node_modules") {
            const grant = grantAmmoForLoadout(
              weapons,
              loadout,
              "npm_install",
              4,
              true
            );
            setWeapons(grant.updatedWeapons);
            pickupText = describeAmmoGrants([grant]);
            setScore((s) => s + 100);
          } else if (pickup.itemId === "coffee") {
            setPlayerHp((hp) => Math.min(maxPlayerHp, hp + 25));
            setScore((s) => s + 100);
          } else if (pickup.itemId === "git_stash") {
            const pushGrant = grantAmmoForLoadout(
              weapons,
              loadout,
              "git_force_push",
              1,
              true
            );
            const zeroDayGrant = grantAmmoForLoadout(
              pushGrant.updatedWeapons,
              loadout,
              "zero_day",
              1,
              true
            );
            setWeapons(zeroDayGrant.updatedWeapons);
            pickupText = describeAmmoGrants([pushGrant, zeroDayGrant]);
            setScore((s) => s + 200);
          } else if (pickup.itemId === "commit_token") {
            setScore((s) => s + 500);
            earnCrypto(150);
          } else if (pickup.itemId === "ram_expansion") {
            setMaxRam((r) => r + 16);
            setCurrentRam((r) => r + 16);
            setScore((s) => s + 250);
          } else if (pickup.itemId === "crypto_stash") {
            earnCrypto(150);
            setScore((s) => s + 300);
          } else if (pickup.itemId === "bypass_chip") {
            setBypassChips((b) => b + 1);
          } else if (pickup.itemId === "todo_shield") {
            // It used to do nothing at all (#1943). A quick patch, then.
            setPlayerHp((hp) => Math.min(maxPlayerHp, hp + 20));
            setScore((s) => s + 50);
            pickupText = "TODO: Fix Later · +20 HP patch";
          }

          floatingTextsRef.current.push({
            id: `pickup-${Date.now()}`,
            x: nextX,
            y: nextY,
            text: pickupText,
            color: pickup.color,
            alpha: 1,
            vy: -0.03,
          });

          setItems((prevItems) =>
            prevItems.map((item) =>
              item.id === pickup.id ? { ...item, collected: true } : item
            )
          );
          emit({ type: "pickup", itemId: pickup.itemId });
        }

        // Terminal / Chest Intercept: "T" is the timesheet-locked repo chest,
        // "H" a hex-matrix hacking terminal.
        const tile = currentMaze[nextY][nextX];
        if (gameMode === "roguelike" && (tile === "T" || tile === "H")) {
          if (tile === "T") {
            setGameStatus("timesheet");
          } else {
            hackTerminalPosRef.current = { x: nextX, y: nextY };
            openHackingTerminal(
              campaignRooms[roomIndex]?.securityTier ?? roomIndex + 1
            );
          }
          playNote(440, 0.15);
          return;
        }

        // Exit reached
        if (nextX === EXIT_X && nextY === EXIT_Y) {
          setGameStatus("victory");
          if (gameMode === "roguelike" && roomIndex >= runLength - 1) {
            setRunTimeMs(Date.now() - runStartedAtRef.current);
            // A finished run has nothing left to resume (#3466).
            clearRun();
          }
          playSuccess();
          retroAudio.playHackSuccess();
          const finalScore = computeRoomExitScore(score, nextMoves, roomCrypto);
          setScore(finalScore);
          if (finalScore > effectiveHighScore) {
            setHighScore(finalScore);
            // Bare numeric string, written raw to keep the stored bytes.
            safeSetRawItem(
              RETRO_LABYRINTH_HIGH_SCORE_KEY,
              finalScore.toString()
            );
            recordArcadeScore("retro-labyrinth", finalScore);
          }

          // A run ends on its last room (a classic stage is a run of one).
          // One that was lost and retried was counted when it was lost, so
          // it isn't counted again here (#2048).
          const endsRun =
            (gameMode === "classic" || roomIndex >= runLength - 1) &&
            !runEndRecordedRef.current;
          if (endsRun) runEndRecordedRef.current = true;
          // The bank takes what the room earned, not the wallet left after
          // Market spending: banked crypto is lifetime earnings, by design
          // (#2291).
          let updatedProf = recordCyberdeckRoomResult(profile, {
            crypto: roomCrypto,
            score: finalScore,
            endsRun,
          });
          // Clearing FaceForge, and clearing a run's last room, unlock
          // classes (#2085).
          const milestones: CyberdeckMilestone[] = [];
          if (gameMode === "roguelike") {
            if (campaignRooms[roomIndex]?.id === "faceforge") {
              milestones.push("faceforge_cleared");
            }
            if (roomIndex >= runLength - 1) milestones.push("run_completed");
          }
          // The same moments, plus a boss cleared without a hit, unlock the
          // arcade trophies (#2181).
          if (gameMode === "roguelike") {
            const trophyMoments: string[] = [...milestones];
            if (campaignRooms[roomIndex]?.boss && !bossHitThisRoomRef.current) {
              trophyMoments.push("boss_no_hit");
            }
            for (const moment of trophyMoments) {
              recordArcadeMilestone("retro-labyrinth", moment);
            }
          }
          const unlockedNow: string[] = [];
          for (const milestone of milestones) {
            const res = recordCyberdeckMilestone(updatedProf, milestone);
            updatedProf = res.profile;
            unlockedNow.push(
              ...res.unlocked.map((id) => CYBERDECK_CLASSES[id].name)
            );
          }
          setProfile(updatedProf);
          saveCyberdeckProfile(updatedProf);
          if (unlockedNow.length > 0) {
            const notice = `Class unlocked: ${unlockedNow.join(", ")}`;
            setUnlockNotice(notice);
            announce(notice);
          }

          recordEvent("labyrinth_solved", "project_click").catch((err) => {
            logger.error(
              "Failed to record telemetry for labyrinth solution:",
              err
            );
          });
        }
      }
    },
    [
      gameStatus,
      playerPosition,
      boss,
      tspNodes,
      currentMaze,
      movesCount,
      playNote,
      playSuccess,
      takeContactHit,
      gameMode,
      exploredMap,
      roomIndex,
      campaignRooms,
      tspWalls,
      dronesStunned,
      enemies,
      drones,
      items,
      weapons,
      score,
      effectiveHighScore,
      maxPlayerHp,
      maxRam,
      selectedClass,
      loadout,
      runBonuses.ramRegen,
      runLength,
      currentTheme,
      roomCrypto,
      earnCrypto,
      profile,
      announce,
      recordEvent,
      openHackingTerminal,
      emit,
    ]
  );

  // Trigger Active Weapon
  const handleFireWeapon = useCallback(
    (wId: WeaponId) => {
      if (gameStatus !== "playing") return;

      const nowMs = Date.now();
      const res = fireWeapon(
        wId,
        weapons,
        playerPosition.x,
        playerPosition.y,
        playerHp,
        maxPlayerHp,
        enemies,
        boss,
        nowMs,
        currentRam,
        runAoeRadiusBonus
      );

      const firedWeapon = weapons[wId];
      emit({
        type: "toolResult",
        tool: wId,
        success: res.success,
        outcome: res.success
          ? res.message
          : !firedWeapon || firedWeapon.ammo <= 0
            ? "out of ammo"
            : "out of RAM",
      });

      if (!res.success) {
        floatingTextsRef.current.push({
          id: `ammo-err-${nowMs}`,
          x: playerPosition.x,
          y: playerPosition.y,
          text: res.message,
          color: "#f43f5e",
          alpha: 1,
          vy: -0.02,
        });
        return;
      }

      // Deduct RAM cost
      const weapon = weapons[wId];
      if (weapon?.ramCost) {
        setCurrentRam((r) => Math.max(0, r - (weapon.ramCost || 0)));
      }

      setWeapons(res.updatedWeapons);
      setEnemies(res.updatedEnemies);
      setBoss(res.updatedBoss);
      setPlayerHp(res.updatedPlayerHp);
      setScore((s) => s + res.scoreGained);
      if (res.cryptoGained) {
        earnCrypto(res.cryptoGained);
      }

      // Audio feedback
      if (wId === "port_scan") {
        retroAudio.playPortScan();
      } else if (wId === "buffer_overflow" || wId === "git_force_push") {
        retroAudio.playExploitBlast();
        if (res.critTriggered) retroAudio.playCriticalHit();
      } else if (wId === "zero_day") {
        retroAudio.playCriticalHit();
      } else if (wId === "stack_overflow") {
        playSuccess();
      } else if (wId === "emp_blast") {
        setDronesStunned(true);
        retroAudio.playAlertPulse();
        setTimeout(() => setDronesStunned(false), 4000);
      } else {
        playNote(330, 0.18);
      }

      // A class immune to a side effect never gets it (#2338).
      const sideEffect = sideEffectForClass(
        selectedClassId,
        res.activeSideEffect
      );
      if (sideEffect) {
        setActiveSideEffect(sideEffect);
      }

      // Under reduced motion a tool's burst holds still and fades (#2291).
      particlesRef.current.push(
        ...(reducedMotion ? stillParticles(res.particles) : res.particles)
      );

      floatingTextsRef.current.push({
        id: `weap-msg-${nowMs}`,
        x: playerPosition.x,
        y: playerPosition.y,
        text: res.critTriggered ? `CRIT! ${res.message}` : res.message,
        color: res.critTriggered ? "#ec4899" : currentTheme.accentColor,
        alpha: 1,
        vy: -0.03,
      });
    },
    [
      gameStatus,
      weapons,
      playerPosition,
      playerHp,
      maxPlayerHp,
      enemies,
      boss,
      currentRam,
      runAoeRadiusBonus,
      currentTheme,
      playNote,
      playSuccess,
      earnCrypto,
      selectedClassId,
      emit,
      reducedMotion,
    ]
  );

  // Submit billable hours timesheet in Room 4
  const handleSubmitTimesheet = useCallback(() => {
    setGameStatus("playing");
    playSuccess();
    retroAudio.playHackSuccess();
    setScore((s) => s + 500);
    earnCrypto(150);

    const updatedGrid = currentMaze.map((row) =>
      row.map((cell) => (cell === "T" ? " " : cell))
    );
    setCurrentMaze(updatedGrid);

    floatingTextsRef.current.push({
      id: `timesheet-done-${Date.now()}`,
      x: playerPosition.x,
      y: playerPosition.y,
      text: "TIMESHEET LOGGED: +0.25h (+500 PTS / +150 CRYPTO)",
      color: "#10b981",
      alpha: 1,
      vy: -0.03,
    });
  }, [
    currentMaze,
    playSuccess,
    playerPosition.x,
    playerPosition.y,
    earnCrypto,
  ]);

  // Closing the Market or class overlay returns to where it was opened.
  const closeOverlay = useCallback(() => {
    setGameStatus(overlayReturnStatusRef.current);
  }, []);

  // A step from a key, the d-pad or a swipe. A side effect can scramble the
  // controls for a while (#2338).
  const move = useCallback(
    (dir: LabyrinthDirection) => {
      if (gameStatus !== "playing") return;
      const isScrambled = controlsScrambled(
        selectedClassId,
        activeSideEffect,
        Date.now()
      );

      if (dir === "up") {
        tryMove(0, isScrambled ? 1 : -1);
      } else if (dir === "down") {
        tryMove(0, isScrambled ? -1 : 1);
      } else if (dir === "left") {
        tryMove(isScrambled ? 1 : -1, 0);
      } else if (dir === "right") {
        tryMove(isScrambled ? -1 : 1, 0);
      }
    },
    [activeSideEffect, gameStatus, selectedClassId, tryMove]
  );

  // A slot fires its tool when it has ammo. On a running room an empty or
  // spent slot says so instead of doing nothing (#2291).
  const fireTool = useCallback(
    (slotIdx: number) => {
      const weaponId = loadout[slotIdx];
      if (weaponId && weapons[weaponId] && weapons[weaponId].ammo > 0) {
        setActiveWeaponId(weaponId);
        handleFireWeapon(weaponId);
        return;
      }
      if (gameStatus !== "playing") return;
      const message = slotUnavailableMessage(
        slotIdx,
        weaponId ? weapons[weaponId]?.name : undefined
      );
      floatingTextsRef.current.push({
        id: `slot-empty-${Date.now()}`,
        x: playerPosition.x,
        y: playerPosition.y,
        text: message,
        color: "#f59e0b",
        alpha: 1,
        vy: -0.03,
      });
      announce(message);
      emit({
        type: "toolResult",
        tool: null,
        success: false,
        outcome: message,
      });
    },
    [
      loadout,
      weapons,
      gameStatus,
      handleFireWeapon,
      playerPosition,
      announce,
      emit,
    ]
  );

  // C toggles the scanlines and saves the player's own calibration.
  const toggleCrt = useCallback(() => {
    const next = {
      ...crtCalibration,
      scanlinesEnabled: !crtCalibration.scanlinesEnabled,
    };
    saveCRTCalibration(next);
    setSavedCrtCalibration(next);
  }, [crtCalibration]);

  const togglePause = useCallback((): boolean => {
    if (gameStatus === "playing") {
      setGameStatus("paused");
      return true;
    }
    if (gameStatus === "paused") {
      setGameStatus("playing");
      return true;
    }
    return false;
  }, [gameStatus]);

  const cancel = useCallback((): boolean => {
    if (gameStatus === "playing" || gameStatus === "paused") {
      return togglePause();
    }
    if (gameStatus === "hacking") {
      closeHackingModal();
      return true;
    }
    if (gameStatus === "darknet_shop") {
      closeOverlay();
      return true;
    }
    return false;
  }, [gameStatus, togglePause, closeHackingModal, closeOverlay]);

  const confirm = useCallback((): boolean => {
    if (gameStatus === "timesheet") {
      handleSubmitTimesheet();
      return true;
    }
    if (gameStatus === "hacking") {
      if (!(hexPuzzle?.solved || hexPuzzle?.failed)) return false;
      closeHackingModal();
      return true;
    }
    if (gameStatus === "paused") {
      setGameStatus("playing");
      return true;
    }
    if (gameStatus === "caught") {
      handleRestart();
      return true;
    }
    if (gameStatus !== "victory") return false;
    const rewardWaiting =
      gameMode === "roguelike" &&
      roomIndex < runLength - 1 &&
      rewardOffer.length > 0 &&
      pendingReward === null;
    if (rewardWaiting && !rewardPromptShown) {
      // The hinted key must not throw the reward away unasked: the first
      // Enter asks for a pick, a second one skips (#2177).
      setRewardPromptShown(true);
      announce("Pick a reward, or press Enter again to skip it.");
      return true;
    }
    if (gameMode === "roguelike") {
      // After the last room this starts a new run (#1668).
      handleNextRoom();
    } else {
      handleRestart();
    }
    return true;
  }, [
    gameStatus,
    hexPuzzle,
    gameMode,
    roomIndex,
    runLength,
    rewardOffer,
    pendingReward,
    rewardPromptShown,
    announce,
    handleSubmitTimesheet,
    closeHackingModal,
    handleRestart,
    handleNextRoom,
  ]);

  const retryRoom = useCallback((): boolean => {
    if (gameStatus === "caught") {
      handleRestart();
      return true;
    }
    if (gameStatus !== "victory") return false;
    // The run-complete card offers only a new run: retrying the last boss
    // after the run has ended is not a choice (#2291).
    if (gameMode === "classic" || roomIndex < runLength - 1) {
      handleRestart();
    }
    return true;
  }, [gameStatus, gameMode, roomIndex, runLength, handleRestart]);

  const cycleWeapon = useCallback(() => {
    const starterWeapons = loadout;
    if (!starterWeapons || starterWeapons.length === 0) return;
    const currentIdx = starterWeapons.indexOf(activeWeaponId);

    for (let i = 1; i <= starterWeapons.length; i++) {
      const candidateIdx = (currentIdx + i) % starterWeapons.length;
      const candidateWeaponId = starterWeapons[candidateIdx];
      if (
        candidateWeaponId &&
        weapons[candidateWeaponId] &&
        weapons[candidateWeaponId].ammo > 0
      ) {
        setActiveWeaponId(candidateWeaponId);
        handleFireWeapon(candidateWeaponId);
        return;
      }
    }
    emit({
      type: "toolResult",
      tool: null,
      success: false,
      outcome: "Exploit: no tool has ammo",
    });
  }, [loadout, activeWeaponId, weapons, handleFireWeapon, emit]);

  // The pointer over the maze. The TSP room draws a hover highlight from it,
  // and BlinkBrowse also steers the player towards it. Rooms are matched by
  // id, not position, so reordering the campaign cannot strand either
  // mechanic (#1639).
  const pointAt = useCallback(
    (cell: { x: number; y: number } | null) => {
      if (!cell) {
        cursorGridPosRef.current = null;
        return;
      }
      if (gameMode !== "roguelike" || gameStatus !== "playing") return;
      cursorGridPosRef.current = cell;

      if (campaignRooms[roomIndex]?.id !== "blinkbrowse") return;

      if (Math.random() < 0.2) {
        const dx =
          cell.x > playerPosition.x ? 1 : cell.x < playerPosition.x ? -1 : 0;
        const dy =
          cell.y > playerPosition.y ? 1 : cell.y < playerPosition.y ? -1 : 0;
        if (dx !== 0 || dy !== 0) {
          tryMove(dx, dy);
        }
      }
    },
    [gameMode, gameStatus, campaignRooms, roomIndex, playerPosition, tryMove]
  );

  // What still locks the exit in this room, for the objective line (#1321).
  const roomExitLock = useMemo(
    () =>
      gameMode === "roguelike"
        ? getExitLockState(boss, tspNodes)
        : getExitLockState(undefined, undefined),
    [gameMode, boss, tspNodes]
  );

  // Opening the Market, class or firmware overlay pauses a running room;
  // closing it returns there paused, or to the result screen it was opened
  // from (#1669).
  const openOverlay = useCallback(
    (overlay: "darknet_shop" | "class_select" | "firmware_bay") => {
      if (gameStatus === overlay) return;
      if (
        gameStatus !== "darknet_shop" &&
        gameStatus !== "class_select" &&
        gameStatus !== "firmware_bay"
      ) {
        overlayReturnStatusRef.current =
          gameStatus === "playing" ? "paused" : gameStatus;
      }
      setGameStatus(overlay);
    },
    [gameStatus]
  );

  // Buying a firmware tier spends banked crypto and saves at once; the tier
  // applies from the next run start (#2085).
  const buyFirmwareTier = useCallback(
    (id: FirmwareUpgradeId) => {
      const next = purchaseFirmwareTier(profile, id);
      if (!next) return;
      setProfile(next);
      saveCyberdeckProfile(next);
      retroAudio.playHackSuccess();
      announce(
        `Firmware upgraded to tier ${next.firmwareUpgrades[id]}. ${next.totalCrypto} crypto banked.`,
        "polite"
      );
    },
    [profile, announce]
  );

  // Choosing a class gives its fresh loadout and restarts the room paused, so
  // nothing fires at the player before they look back at the board. On a
  // room-cleared screen the loadout carries into the next room instead
  // (#1669).
  const chooseClass = useCallback(
    (classId: CyberdeckClassId) => {
      const cls = CYBERDECK_CLASSES[classId] || CYBERDECK_CLASSES.script_kiddie;
      // A locked class waits for its milestone (#2085).
      if (!isCyberdeckClassUnlocked(profile, cls.id)) return;
      const start = cyberdeckStartingStats(cls.id, runFirmware);
      setSelectedClassId(cls.id);
      if (cls.starterWeapons?.[0]) {
        setActiveWeaponId(cls.starterWeapons[0]);
      }
      // Passives picked on the route stay with the run (#2084).
      const hp = start.hp + runBonuses.maxHp;
      const ram = start.ram + runBonuses.maxRam;
      setMaxPlayerHp(hp);
      setMaxRam(ram);
      setBypassChips(start.bypassChips);
      if (overlayReturnStatusRef.current === "victory") {
        setPlayerHp(hp);
        setCurrentRam(ram);
        setWeapons(DEFAULT_WEAPONS);
        setGameStatus("victory");
        return;
      }
      roomEntryVitalsRef.current = {
        ...roomEntryVitalsRef.current,
        hp,
        ram,
        weapons: DEFAULT_WEAPONS,
      };
      handleRestart();
      setGameStatus("paused");
    },
    [handleRestart, profile, runFirmware, runBonuses.maxHp, runBonuses.maxRam]
  );

  // Memoized Traveling Salesman Pathfinding Tour
  const tspTour = useMemo(() => {
    return computeShortestTour(
      playerPosition.x,
      playerPosition.y,
      tspNodes,
      EXIT_X,
      EXIT_Y
    ).tour;
  }, [playerPosition.x, playerPosition.y, tspNodes]);

  // Loop State Mirroring Ref for Stable Animation Lifecycle
  // The walls' next shift: drawn as a ghost on the maze and counted down in
  // the HUD. Walls only exist in the TSP room, so other rooms have none.
  const wallTelegraph = useMemo(
    () =>
      tspWalls.length > 0
        ? tspWallTelegraph(currentMaze, tspWalls, movesCount)
        : null,
    [currentMaze, tspWalls, movesCount]
  );
  const wallShiftLabel = wallTelegraph
    ? wallTelegraph.stepsUntilAppear === null
      ? "Walls steady"
      : `Walls shift in ${wallTelegraph.stepsUntilAppear} step${
          wallTelegraph.stepsUntilAppear === 1 ? "" : "s"
        }`
    : null;
  const loopState: LabyrinthLoopState = {
    wallTelegraph,
    reducedMotion,
    currentMaze,
    playerPosition,
    visibleMap,
    exploredMap,
    enemies,
    drones,
    dronesStunned,
    items,
    boss,
    tspNodes,
    tspTour,
    gameMode,
    roomIndex,
    gameStatus,
    activeSideEffect,
    currentTheme,
    crtCalibration,
    playNote,
    takeContactHit,
  };
  const loopStateRef = useRef(loopState);
  useEffect(() => {
    loopStateRef.current = loopState;
  });

  // A paused room stops the loop: the cabinet's pause, a lost canvas
  // context and the room's own pause all hold it still (#2357). So does a
  // room no view paints yet.
  const isLoopActive = active && gameStatus !== "paused" && painterCount > 0;

  // Main Real-Time Game Loop
  //
  // The loop runs while the session is active. The hook's delta is unclamped
  // (maxDeltaMs: Infinity) and clamped to 40 ms below, as before, so the
  // frame clock can rebuild the frame timestamp the engine reads: an anchor
  // taken on the loop's first frame plus the elapsed time. A lost canvas
  // context pauses the cabinet from the view that owns the canvas (#2357).
  const frameAnchorRef = useRef<number | null>(null);
  // Phosphor shimmer phase for renderCRTEffects: one step per frame.
  const crtFrameRef = useRef(0);
  // Play time since the last enemy step and classic drone step. Enemies move
  // on elapsed time, not frame count, so a 144 Hz display does not double
  // their speed (#1665).
  const enemyStepElapsedRef = useRef(0);
  const droneStepElapsedRef = useRef(0);
  // The TSP hover highlight reads the rendered campaign, so a new run's
  // rooms replace the old layout on the next frame (#1628).
  const campaignRoomsRef = useRef(campaignRooms);
  useEffect(() => {
    campaignRoomsRef.current = campaignRooms;
  });

  // Every fresh loop re-anchors its frame timestamp.
  useEffect(() => {
    if (active) frameAnchorRef.current = null;
  }, [active]);

  useAnimationFrame(
    (frameDeltaMs, frameClockMs) => {
      if (frameAnchorRef.current === null) {
        frameAnchorRef.current = performance.now() - frameClockMs;
      }
      const timestamp = frameAnchorRef.current + frameClockMs;
      crtFrameRef.current += 1;
      const campaignRooms = campaignRoomsRef.current;

      const {
        reducedMotion,
        currentMaze,
        playerPosition,
        enemies,
        drones,
        dronesStunned,
        boss,
        gameMode,
        gameStatus,
        activeSideEffect,
        playNote,
        takeContactHit,
      } = loopStateRef.current;

      const deltaMs = Math.min(40, frameDeltaMs);

      // 1. Update active side effect expiry. fireWeapon stamps expiresAt on
      // the Date.now() clock, which the key handlers also read, so the loop
      // checks it on that clock rather than the frame timestamp (#1628).
      if (activeSideEffect && activeSideEffect.expiresAt <= Date.now()) {
        setActiveSideEffect(null);
      }

      // 2. Update Enemy AI, one step per ENEMY_STEP_INTERVAL_MS of play.
      // Contact costs HP; the run ends only when HP reaches 0 (#1665).
      if (gameStatus === "playing" && enemies.length > 0 && deltaMs > 0) {
        enemyStepElapsedRef.current += deltaMs;
        if (enemyStepElapsedRef.current >= ENEMY_STEP_INTERVAL_MS) {
          const stepElapsedMs = enemyStepElapsedRef.current;
          enemyStepElapsedRef.current = 0;
          const { updatedEnemies, damageToPlayer } = updateEnemyAI(
            enemies,
            currentMaze,
            playerPosition.x,
            playerPosition.y,
            stepElapsedMs
          );
          setEnemies(updatedEnemies);

          if (damageToPlayer > 0) {
            takeContactHit(
              damageToPlayer,
              "EDR Sentinel Daemons severed your cyberdeck proxy tunnel.",
              playerPosition
            );
          }
        }
      }

      // 3. Update Boss
      if (
        gameStatus === "playing" &&
        boss &&
        !boss.defeated &&
        gameMode === "roguelike"
      ) {
        const { updatedBoss, spawnedDamage } = updateBoss(
          boss,
          playerPosition.x,
          playerPosition.y,
          timestamp,
          currentMaze[0].length,
          currentMaze.length,
          lastHeadingRef.current &&
            Date.now() - lastHeadingRef.current.at < BOSS_LEAD_WINDOW_MS
            ? lastHeadingRef.current
            : undefined,
          deltaMs,
          (col, row) => currentMaze[row]?.[col] === "#"
        );
        // Under reduced motion the boss mesh holds its angle (#2291).
        setBoss(reducedMotion ? holdBossSpin(boss, updatedBoss) : updatedBoss);

        if (spawnedDamage > 0) {
          bossHitThisRoomRef.current = true;
          setRunDamage((total) => total + spawnedDamage);
          setLastHitBy(bossVolleyHitLine(boss));
          setPlayerHp((hp) => {
            const nextHp = hp - spawnedDamage;
            if (nextHp <= 0) {
              setGameStatus("caught");
              return 0;
            }
            return nextHp;
          });
          playNote(200, 0.15);
          emit({
            type: "bump",
            damage: spawnedDamage,
            cause: bossVolleyHitLine(boss),
          });
          floatingTextsRef.current.push({
            id: `mesh-hit-${timestamp}`,
            x: playerPosition.x,
            y: playerPosition.y,
            text: `-${spawnedDamage} HP (Vector Hit!)`,
            color: "#ef4444",
            alpha: 1,
            vy: -0.02,
          });
        }
      }

      // 4. Update sweeping drones, one step per
      // CLASSIC_DRONE_STEP_INTERVAL_MS of play.
      if (gameStatus === "playing" && !dronesStunned && drones.length > 0) {
        droneStepElapsedRef.current += deltaMs;
        if (droneStepElapsedRef.current >= CLASSIC_DRONE_STEP_INTERVAL_MS) {
          droneStepElapsedRef.current = 0;
          setDrones((prev) =>
            prev.map((d) => {
              const next = stepSecurityDrone(d);
              if (next.x === playerPosition.x && next.y === playerPosition.y) {
                takeContactHit(
                  DRONE_CONTACT_DAMAGE,
                  "An Airgap Sentinel drone severed your cyberdeck proxy tunnel.",
                  playerPosition
                );
              }
              return next;
            })
          );
        }
      }

      // 5. Paint: every view's painter draws this frame (ADR 0062).
      const frame: LabyrinthFrame = {
        timestamp,
        crtFrame: crtFrameRef.current,
        state: loopStateRef.current,
        campaignRooms,
        particlesRef,
        floatingTextsRef,
        cursor: cursorGridPosRef.current,
      };
      paintersRef.current.forEach((paint) => paint(frame));
    },
    { isActive: isLoopActive, maxDeltaMs: Infinity }
  );

  // The status-driven events, each sent once on its transition.
  const lastStatusRef = useRef<GameStatus>(gameStatus);
  useEffect(() => {
    const previous = lastStatusRef.current;
    lastStatusRef.current = gameStatus;
    if (previous === gameStatus) return;
    if (gameStatus === "caught") emit({ type: "death" });
    if (gameStatus === "victory" && previous !== "victory") {
      const endsRun = gameMode === "classic" || roomIndex >= runLength - 1;
      emit({ type: endsRun ? "runComplete" : "roomCleared" });
    }
  }, [gameStatus, gameMode, roomIndex, runLength, emit]);
  const bossPhase = boss && !boss.defeated ? boss.phase : null;
  const lastBossPhaseRef = useRef<number | null>(bossPhase);
  useEffect(() => {
    const previous = lastBossPhaseRef.current;
    lastBossPhaseRef.current = bossPhase;
    // A room that opens with a boss starts its count; only a later phase
    // is news.
    if (bossPhase !== null && previous !== null && bossPhase > previous) {
      emit({ type: "bossPhase", phase: bossPhase });
    }
  }, [bossPhase, emit]);

  // The cabinet's pause service (#2357). A running room pauses for any
  // reason the cabinet pauses (P and Escape in a cabinet with views, a
  // hidden tab, a blurred window on touch, a rotated phone). With no room
  // running, an automatic pause has nothing to stop and is released at once.
  // The room's own pause, from a key, an overlay or the Field Manual, is
  // mirrored to the cabinet, so both agree on whether the room is paused.
  const pauseService = useCabinetPauseController();
  const gameStatusRef = useRef(gameStatus);
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  });
  useEffect(
    () =>
      pauseService.onPause((reason) => {
        const status = gameStatusRef.current;
        if (status === "playing") {
          setGameStatus("paused");
          return;
        }
        if (status !== "paused" && AUTOMATIC_REASONS.has(reason)) {
          pauseService.resume();
        }
      }),
    [pauseService]
  );
  // Hiding the tab or leaving the page saves the run at its room's entry,
  // with the time played so far (#3466). A finished run has no save left.
  useEffect(
    () =>
      pauseService.onSuspend(() => {
        const {
          gameStatus: status,
          roomIndex: idx,
          runLength: length,
        } = saveSourceRef.current;
        if (status === "victory" && idx >= length - 1) return;
        writeRoomSave();
      }),
    [pauseService, writeRoomSave]
  );
  useEffect(
    () =>
      pauseService.onResume(() =>
        setGameStatus((status) => (status === "paused" ? "playing" : status))
      ),
    [pauseService]
  );
  useEffect(() => {
    // A pause the cabinet already holds (a sheet, a hidden tab) is not
    // turned into the player's own, so a sheet shows no pause overlay.
    if (gameStatus === "paused") {
      if (!pauseService.getState().paused) pauseService.pause("user");
    } else if (gameStatus === "playing") pauseService.resume();
  }, [gameStatus, pauseService]);
  // The screen stays awake while a room runs.
  useCabinetRunActive(active && gameStatus === "playing");

  // The pause overlay's Restart and a confirmed Setup start a new run.
  const runRevision = cabinetSetup?.runRevision ?? 0;
  const lastRunRevisionRef = useRef(runRevision);
  useEffect(() => {
    if (lastRunRevisionRef.current === runRevision) return;
    lastRunRevisionRef.current = runRevision;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gameMode === "classic") switchStage(stage);
    else startRoguelikeCampaign();
  }, [runRevision, gameMode, stage, switchStage, startRoguelikeCampaign]);

  // A class without a 0-Day slot gets the same damage in a weapon it can
  // fire, and the Market card says so (#1667).
  const marketRows = useMemo(
    () =>
      DARKNET_VENDOR_CATALOG.map((item): LabyrinthMarketRow => {
        let note: string | null = null;
        if (item.category === "weapon" && !loadout.includes("zero_day")) {
          const grant = grantAmmoForLoadout(
            weapons,
            loadout,
            "zero_day",
            2,
            false
          );
          note = grant.weaponId
            ? ` Your class has no 0-Day slot, so you get ${describeAmmoGrants([grant])} instead.`
            : " Your class has no weapon that can use it.";
        }
        const unavailable =
          cryptoBounty < item.cost ||
          (item.category === "firmware" && cveFeedActive);
        return {
          id: item.id,
          name: item.name,
          icon: item.icon,
          description: item.description,
          note,
          disabled: unavailable,
          label:
            item.category === "firmware" && cveFeedActive
              ? "Active"
              : `🪙 ${item.cost}`,
        };
      }),
    [loadout, weapons, cryptoBounty, cveFeedActive]
  );

  const isFinalRoom = gameMode === "roguelike" && roomIndex >= runLength - 1;
  const runComplete =
    gameStatus === "victory" &&
    (gameMode === "classic" || roomIndex >= runLength - 1);
  const runMoves = [...clearedRooms.map((r) => r.moves), movesCount];
  const routeMap =
    gameStatus === "victory" && gameMode === "roguelike"
      ? describeRouteMap(roomLibrary, runRoute)
      : [];
  const runCrypto =
    clearedRooms.reduce((sum, r) => sum + r.crypto, 0) + roomCrypto;
  const currentRoom =
    gameMode === "roguelike"
      ? campaignRooms[roomIndex] || campaignRooms[0]
      : stage === 2
        ? generateClassicStage2()
        : generateClassicStage1();

  const view: LabyrinthView = {
    gameStatus,
    gameMode,
    stage,
    roomIndex,
    runLength,
    isFinalRoom,
    runComplete,
    currentRoom,
    campaignRooms,
    currentMaze,
    playerPosition,
    playerHp,
    maxPlayerHp,
    currentRam,
    maxRam,
    cryptoBounty,
    roomCrypto,
    cveFeedActive,
    bypassChips,
    score,
    highScore: effectiveHighScore,
    movesCount,
    lastHitBy,
    runMoves,
    runCrypto,
    runDamage,
    runTimeMs,
    // The run-complete card names each room it cleared (#2291).
    runRoomNames: campaignRooms
      .slice(0, runMoves.length)
      .map((room) => routeRoomName(room)),
    profile,
    selectedClassId,
    selectedClass,
    crtThemeId,
    currentTheme,
    crtCalibration,
    weapons,
    loadout,
    // A starter slot holding EMP shares the Space key, so the hotbar shows
    // one EMP button for both (#2291).
    loadoutHasEmp: loadout.includes("emp_blast"),
    activeWeaponId,
    dronesStunned,
    activeSideEffect,
    enemies,
    boss,
    tspNodes,
    exitLocked: gameMode === "roguelike" && roomExitLock.locked,
    exitLock: roomExitLock,
    wallShiftLabel,
    threat,
    gridData,
    nodeData,
    hexPuzzle,
    hackingFeedback,
    // The Market trades only at the rest stop the route map labels (#2291).
    marketOpen: isMarketOpen(
      gameMode,
      gameMode === "roguelike" ? campaignRooms[roomIndex] : undefined
    ),
    marketRows,
    route: {
      seed: runRoute.seed,
      map: routeMap,
      options: routeMap.find((step) => step.state === "choice")?.rooms ?? [],
      selected: selectedRoute,
    },
    rewardOffer,
    pendingReward,
    rewardPromptShown,
    rewardUnavailable: rewardUnavailableReasons(
      rewardOffer,
      playerHp,
      maxPlayerHp
    ),
    unlockNotice,
  };

  const skipReward = useCallback(() => setPendingReward(null), []);
  const pause = useCallback(
    () => setGameStatus((status) => (status === "playing" ? "paused" : status)),
    []
  );
  const resume = useCallback(
    () => setGameStatus((status) => (status === "paused" ? "playing" : status)),
    []
  );
  const fireActive = useCallback(
    () => handleFireWeapon(activeWeaponId),
    [handleFireWeapon, activeWeaponId]
  );
  const emp = useCallback(
    () => handleFireWeapon("emp_blast"),
    [handleFireWeapon]
  );
  const playClassic = useCallback(
    (classicStage: 1 | 2) => switchStage(classicStage),
    [switchStage]
  );
  const intents: LabyrinthIntents = {
    move,
    fireTool,
    fireActive,
    emp,
    exploit: cycleWeapon,
    openOverlay,
    closeOverlay,
    buy: buyDarknetItem,
    selectHex: handleHexCellClick,
    spendBypassChip: handleUseBypassChip,
    finishHack: closeHackingModal,
    submitTimesheet: handleSubmitTimesheet,
    chooseRoute: setPendingRoute,
    pickReward: setPendingReward,
    skipReward,
    chooseClass,
    buyFirmware: buyFirmwareTier,
    continue: handleNextRoom,
    retry: handleRestart,
    newRun: startRoguelikeCampaign,
    playClassic,
    toggleCrt,
    setTheme: setCrtThemeId,
    setCrtCalibration: setSavedCrtCalibration,
    pause,
    resume,
    togglePause,
    cancel,
    confirm,
    retryRoom,
    pointAt,
  };

  const subscribe = useCallback((listener: (event: LabyrinthEvent) => void) => {
    eventListenersRef.current.add(listener);
    return () => {
      eventListenersRef.current.delete(listener);
    };
  }, []);
  const onFrame = useCallback((paint: LabyrinthPainter) => {
    paintersRef.current.add(paint);
    setPainterCount(paintersRef.current.size);
    return () => {
      paintersRef.current.delete(paint);
      setPainterCount(paintersRef.current.size);
    };
  }, []);

  return { view, intents, subscribe, onFrame };
}
