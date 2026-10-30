"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import {
  renderWatchFace,
  stepsFor,
} from "@/components/garmin-watch/watch-face-art";
import { type WatchBezelTheme } from "@/components/garmin-watch/WatchHardware";
import { type RunMode } from "@/components/garmin-watch/CompanionPanel";
import {
  BADGE_MILESTONES,
  badgeNews,
  newBadgeRun,
  recordRun,
  runFactsOf,
  stepBadgeRun,
  type BadgeId,
  type BadgeSave,
} from "@/lib/garmin/badges";
import { loadBadges, saveBadges } from "@/lib/garmin/badge-store";
import { renderPlanFace } from "@/components/garmin-watch/plan-face-art";
import {
  useTrainingPlan,
  type PlanInput,
} from "@/components/garmin-watch/useTrainingPlan";
import { startLoadout, stepLoadout } from "@/lib/garmin/bag";
import {
  FINISHER_CARD_NAMES,
  isPayoutBanner,
  stepFinisherCard,
} from "@/lib/garmin/finisher";
import type { GearItem, PlanRun } from "@/lib/garmin/plan";
import { stepRaceDay } from "@/lib/garmin/raceday";
import { type PusherId } from "@/components/garmin-watch/watch-geometry";
import { downloadFile } from "@/lib/download";
import {
  TelemetryRecorder,
  exportTelemetryCsv,
  exportTelemetryFit,
} from "@/lib/garmin/telemetry";
import {
  DEFAULT_GROUND_STRIP,
  loadGroundStrip,
  saveGroundStrip,
  type GroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin/ground-strip";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { applyCanvasScale } from "@/lib/arcade";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { useGarminService } from "@/hooks/useGarminService";
import { triggerHaptic } from "@/lib/haptics";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { formatClock, mergeBests, type GarminBests } from "@/lib/garmin/splits";
import { bestsKey, loadBests, saveBests } from "@/lib/garmin/bests-store";
import { copyToClipboard } from "@/lib/clipboard";
import {
  FIXED_STEP_MS,
  RACE_CATEGORY_INFO,
  RACE_COURSE_NAMES,
  fixedSteps,
  formatRaceTime,
  judgeRace,
  raceSetup,
  shareText,
  type BoardEntry,
  type RaceCategory,
  type RaceCourse,
  type RaceOutcome,
  raceOutcomeOf,
  type RaceSetup,
  type RaceVerdict,
} from "@/lib/garmin/race";
import {
  PLAN_RUN_MODE,
  RACE_CATEGORY_KEY,
  RACE_COURSE_KEY,
  RACE_MODE_KEY,
  loadBoard,
  raceOverText,
  raceRecordOf,
  readRaceCategory,
  readRaceCourse,
  readPlanMode,
  readRaceMode,
  saveResult,
  writeRacePref,
} from "@/lib/garmin/race-store";
import {
  createGhostRecorder,
  finishGhost,
  formatGap,
  ghostAt,
  ghostGapMs,
  lapGapMs,
  recordGhost,
  GHOST_SAMPLE_MS,
  type GhostRecorder,
  type GhostSample,
  type GhostTrack,
} from "@/lib/garmin/ghost";
import {
  GHOST_ON_KEY,
  GHOST_TARGET_KEY,
  loadGhost,
  readGhostOn,
  readGhostTarget,
  saveGhost,
  type GhostTarget,
} from "@/lib/garmin/ghost-store";
import { isUnderwater } from "@/lib/garmin/swim";
import {
  type GarminDockKey,
  type GarminDockMode,
} from "@/components/garmin-watch/GarminTouchDock";
import { GARMIN_AUTO_PAUSE_EVENT } from "@/components/garmin-watch/auto-pause";
import "@/components/garmin-watch/garmin-touch.css";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import {
  DeviceTarget,
  DEVICE_PROFILES,
  createInitialState,
  resolveRunTuning,
  DEFAULT_RUN_TUNING,
  startGame,
  jettisonOldestVariable,
  enterStation,
  pauseGame,
  resumeGame,
  wipeScreenFog,
  updateGameSimulation,
  pressJump,
  releaseJump,
  setRunInput,
  pressAction,
  canSlam,
  pressSlam,
  CANVAS_SIZE,
  GameEngineState,
  CrashReport,
  allocateFlashVariable,
  clearFlashStorage,
  setRules,
  causeLabel,
  isFitnessRun,
  type FinisherCard,
  type GameRules,
} from "@/lib/garmin/engine";
import { trainingStatus } from "@/lib/garmin/culture";
import { STAGE_COUNT } from "@/lib/garmin/course";
import {
  MEDALS_PER_STAGE,
  medalStage,
  stageMedalCount,
} from "@/lib/garmin/medals";
import { PACE_SEGMENTS, isPaceFull, paceSegments } from "@/lib/garmin/cape";
import type { PowerTier } from "@/lib/garmin/powerups";
import { themeForStage, type StageTheme } from "@/lib/garmin/themes";
import {
  SECOND_WIND_EVENTS,
  SECOND_WIND_MS,
  type SecondWind,
  type SecondWindKind,
} from "@/lib/garmin/second-wind";

export const POWER_NAMES: Record<PowerTier, string> = {
  base: "Base",
  buff: "Buff",
  heatmap: "Heat Map",
  cape: "Compression Cape",
  trisuit: "Tri Suit",
};

/** Human names of the stage themes, for the readouts (#1993). */
const STAGE_THEME_NAMES: Record<StageTheme, string> = {
  track: "Track",
  pool: "Pool",
  "basement-gym": "Basement Gym",
  "open-water": "Open Water",
};

/** The stage number and its theme name, e.g. "Stage 2 of 5, Pool". */
export function stageLabel(s: GameEngineState): string {
  const stage = s.stage ?? 1;
  const place = s.bonusRoom
    ? "Water Station"
    : STAGE_THEME_NAMES[themeForStage(stage)];
  return `Stage ${stage} of ${STAGE_COUNT}, ${place}`;
}

/** Compact UTC stamp for export file names, e.g. 20261010-120000. */
function exportStamp(startedAtMs: number): string {
  return new Date(startedAtMs || Date.now())
    .toISOString()
    .replace(/\.\d+Z$/, "")
    .replace(/[-:]/g, "")
    .replace("T", "-");
}

/** Flash written by the Write NV Flash button; matches its label. */
const NV_WRITE_KB = 8;

/** What the crash overlay says for each cause, and how to avoid it next run. */
const CRASH_LABELS: Record<
  CrashReport["errorType"],
  { title: string; hint: string }
> = {
  "Out Of Memory": {
    title: "OUT OF MEMORY",
    hint: "The heap filled up. Pop variables (Down) or force GC (Back) sooner.",
  },
  "Out Of Storage": {
    title: "OUT OF FLASH STORAGE",
    hint: "Flash filled up. Jump over flash tokens when storage runs high.",
  },
  "Watchdog Tripped": {
    title: "WATCHDOG TRIPPED",
    hint: "A watchdog timer caught you. Jump (Up) and land on it to reset it, or clear it.",
  },
  "Null Pointer": {
    title: "NULL POINTER",
    hint: "You ran into a null reference. Jump (Up) and land on bugs to squash them.",
  },
  "Symbol Not Found": {
    title: "SYMBOL NOT FOUND",
    hint: "You ran into a missing symbol. Jump (Up) over bugs.",
  },
  "Stack Overflow": {
    title: "STACK OVERFLOW",
    hint: "You ran into runaway recursion. Stacks are spiked: Jump (Up) over them, never onto them.",
  },
  "Dropped Kettlebell": {
    title: "DROPPED KETTLEBELL",
    hint: "A Kettlebell got you. Stomp it to tip it over, then kick it to clear the way, and stay clear when it slides back.",
  },
  "Gym Injury": {
    title: "GYM INJURY",
    hint: "A Move Alert, Box Jumper, Auto Lap, lap ping or the Rep Max got you. Stomp them, watch their timers, and jump the lap pings and dumbbells.",
  },
  "Segmentation Fault": {
    title: "SEGFAULT",
    hint: "You fell through a gap in the track. Hold Up longer to clear wide gaps, and sprint (Right) into them.",
  },
  "Power Loss": {
    title: "POWER LOSS",
    hint: "The battery ran out. Keep the backlight off to save power.",
  },
};

/**
 * The crash overlay under fitness rules: the same causes, told as a run that
 * ended early. Causes missing here fall back to a generic hint.
 */
const FITNESS_CRASH_HINTS: Partial<Record<CrashReport["errorType"], string>> = {
  "Null Pointer":
    "A Couch Potato got you. Jump (Up) and land on it to stomp it.",
  "Watchdog Tripped":
    "A Snooze Button caught you. Jump (Up) and land on it to stomp it, or jump clear.",
  "Stack Overflow": "Hurdles are spiked. Jump (Up) over them, never onto them.",
  "Segmentation Fault":
    "You missed the curb and fell through a gap. Hold Up longer, and sprint (Right) into wide gaps.",
  "Dropped Kettlebell": CRASH_LABELS["Dropped Kettlebell"].hint,
  "Gym Injury": CRASH_LABELS["Gym Injury"].hint,
};
const FITNESS_CRASH_FALLBACK = "Lace up and run it again.";

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const HIGH_SCORE_KEY = "garmin_simulator_high_score";
// The high score is stored as a bare numeric string, so it is read and
// written raw; the safe-storage helpers already guard missing or throwing
// storage, and a failed write is dropped rather than kept in memory.
const getHighScoreSnapshot = () => safeGetRawItem(HIGH_SCORE_KEY) || "0";
const getHighScoreServerSnapshot = () => "0";

// Dev Mode brings back the firmware rules (heap, GC, flash, battery, fog).
// It is off by default and remembered on this device.
const DEV_MODE_KEY = "garmin_dev_mode";
const devModeListeners = new Set<() => void>();
const subscribeDevMode = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  devModeListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    devModeListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
};
const getDevModeSnapshot = () => safeGetRawItem(DEV_MODE_KEY) === "1";
const getDevModeServerSnapshot = () => false;
const writeDevMode = (on: boolean) => {
  safeSetRawItem(DEV_MODE_KEY, on ? "1" : "0");
  devModeListeners.forEach((listener) => listener());
};

// Race Mode (#2019): the picked mode, course and category, remembered on this
// device like Dev Mode. Races are picked while idle or after a run ends.
const racePrefListeners = new Set<() => void>();
const subscribeRacePrefs = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  racePrefListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    racePrefListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
};
const writeRacePrefAndNotify = (key: string, value: string) => {
  writeRacePref(key, value);
  racePrefListeners.forEach((listener) => listener());
};
const getRaceModeServerSnapshot = () => false;
const getRaceCourseServerSnapshot = (): RaceCourse => "saturday5k";
const getRaceCategoryServerSnapshot = (): RaceCategory => "any";
const getGhostOnServerSnapshot = () => true;
const getGhostTargetServerSnapshot = (): GhostTarget => "pr";

/**
 * The bests a run's laps are judged against: races keep their own (#2019),
 * and so does each Training Plan workout, which is one stage long (#1994).
 */
export const splitsKeyOf = (s: GameEngineState) =>
  `${bestsKey(s.device, isFitnessRun(s))}${
    s.plan ? `:plan${s.plan.stage}` : s.race ? ":race" : ""
  }`;

/**
 * A Training Plan workout to start: its run, lives, packed gear and
 * Finisher Cards (#1994, #1995, #1996).
 */
interface Workout {
  run: PlanRun;
  /** The plan's lives, or null for practice, which starts with a fresh three. */
  lives: number | null;
  packed: readonly GearItem[];
  /** The plan's cards, or null when the run collects none (practice, Race Day). */
  cards: readonly FinisherCard[] | null;
}

/** What each key does on a Training Plan screen (#1994). */
const PLAN_KEYS: Readonly<Record<string, PlanInput>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  " ": "select",
  Enter: "select",
  Escape: "back",
  Backspace: "back",
  // The action key opens the gear bag (#1995).
  x: "bag",
  X: "bag",
};

/** A race as it ended: its outcome, verdict, board place and record (#2019). */
export interface RaceReport {
  setup: RaceSetup;
  outcome: RaceOutcome;
  verdict: RaceVerdict;
  /** 1-based place on the board, or 0 when it missed the top five. */
  place: number;
  record: "CR" | "PR" | null;
  board: BoardEntry[];
  date: Date;
  /** The finish against the Virtual Partner in ms, negative when it was beaten; null without one (#2020). */
  partnerMs: number | null;
}

/** The run clock for the telemetry readout, once a run has a clock. */
function runClockReadout(s: GameEngineState): string {
  if (s.gameState === "idle" || s.runClockMs === undefined) return "";
  return ` Run time: ${formatClock(s.runClockMs)}.`;
}

/**
 * The Virtual Partner on this frame (#2020): where the ghost is at the run
 * clock, its trail (none under reduced motion), and the gap to it. No
 * options outside a race, without a ghost, or before GPS locks.
 */
function ghostOptions(
  s: GameEngineState,
  track: GhostTrack | null,
  reducedMotion: boolean
): {
  ghost?: { sample: GhostSample; trail: GhostSample[] } | null;
  ghostGapMs?: number | null;
} {
  if (!track || !s.race || (s.gpsMs ?? 0) > 0) return {};
  const clock = s.runClockMs ?? 0;
  const sample = ghostAt(track, clock);
  const trail = reducedMotion
    ? []
    : [1, 2, 3]
        .map((i) => ghostAt(track, clock - i * GHOST_SAMPLE_MS * 1.2))
        .filter((t): t is GhostSample => t !== null);
  return {
    ghost: sample ? { sample, trail } : null,
    // The ghost records world distance, so its gap is measured on it too.
    ghostGapMs: ghostGapMs(
      track,
      Math.max(s.furthestMeters ?? 0, s.distanceMeters),
      clock
    ),
  };
}

/** Whether a run has ended, so its bests are recorded and its result card shows. */
function isRunOver(s: GameEngineState): boolean {
  return (
    s.gameState === "summary" ||
    s.gameState === "crashed" ||
    s.gameState === "shutdown"
  );
}

/**
 * What a Second Wind announces as it starts (#2026): its name, goal and time
 * limit, e.g. "Second Wind: Taper Week. Grab 6 Kudos in 15 seconds."
 */
function secondWindStartText(kind: SecondWindKind): string {
  const { name, goalText } = SECOND_WIND_EVENTS[kind];
  const title = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `Second Wind: ${title}. ${goalText} in ${SECOND_WIND_MS / 1000} seconds.`;
}

/**
 * The Finisher Medals of this stage found so far (#2025), for the canvas
 * description and the telemetry readout.
 */
function medalReadout(s: GameEngineState): string {
  const found = stageMedalCount(s.medalsFound, s.stage ?? 1);
  // The Finisher Cards held, on a run that collects them (#1996).
  const cards = Array.isArray(s.finisherCards)
    ? ` Finisher cards: ${
        s.finisherCards.length > 0
          ? s.finisherCards.map((c) => FINISHER_CARD_NAMES[c]).join(", ")
          : "none"
      }.`
    : "";
  return ` Finisher medals: ${found} of ${MEDALS_PER_STAGE} on this stage.${cards}`;
}

/** What the course props mean for the runner right now (#1992), for the telemetry readout. */
export function courseReadout(s: GameEngineState): string {
  const medals = medalReadout(s);
  if (s.bonusRoom) return `${medals} In a Water Station bonus room.`;
  const rest = s.restDayMs ?? 0;
  const restText =
    rest > 0 ? ` Rest Day: ${Math.ceil(rest / 1000)} seconds left.` : "";
  const station =
    enterStation(s) !== s
      ? " On a Water Station: press Down to enter its bonus room."
      : "";
  return medals + restText + station;
}

/** What the session reads from the device or the page, supplied by the view (ADR 0062). */
interface MonkeyCSessionOptions {
  /**
   * Test/debug seam only: seeds both stateRef and gameState with this exact
   * state at mount, as the component's prop of the same name does (#685).
   */
  readonly initialState?: GameEngineState;
  /** Whether the visitor asks for less motion. */
  readonly prefersReducedMotion: boolean;
}

/**
 * The Garmin Watch (Monkey C) session (#3435): the engine state and its
 * animation loop, run modes, race and ghost preferences, badges, bests,
 * splits, device and theme, and the Training Plan it composes. Moved
 * verbatim from GarminWatchSimulator.tsx; the watch renders what it returns.
 */
export function useMonkeyCSession(options: MonkeyCSessionOptions) {
  const { initialState, prefersReducedMotion } = options;
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const devMode = useSyncExternalStore(
    subscribeDevMode,
    getDevModeSnapshot,
    getDevModeServerSnapshot
  );
  const raceMode = useSyncExternalStore(
    subscribeRacePrefs,
    readRaceMode,
    getRaceModeServerSnapshot
  );
  const raceCourse = useSyncExternalStore(
    subscribeRacePrefs,
    readRaceCourse,
    getRaceCourseServerSnapshot
  );
  const raceCategory = useSyncExternalStore(
    subscribeRacePrefs,
    readRaceCategory,
    getRaceCategoryServerSnapshot
  );
  // Virtual Partner options (#2020), kept with the race preferences.
  const ghostOn = useSyncExternalStore(
    subscribeRacePrefs,
    readGhostOn,
    getGhostOnServerSnapshot
  );
  const ghostTarget = useSyncExternalStore(
    subscribeRacePrefs,
    readGhostTarget,
    getGhostTargetServerSnapshot
  );
  // The Training Plan (#1994) is a third run mode, stored with Race Mode's.
  const planMode = useSyncExternalStore(
    subscribeRacePrefs,
    readPlanMode,
    getRaceModeServerSnapshot
  );
  // Races and the plan run with Dev Mode off; the stored setting is kept.
  const runRules: GameRules =
    devMode && !raceMode && !planMode ? "dev" : "fitness";
  const { playNote, playSuccess } = useAudio();
  const { recordEvent } = useTelemetry();
  const { announce } = useAnnouncer();
  const { garbageCollect } = useGarminService();
  // Each alert carries a count so a repeat of the same text still re-shows
  // the visible toast (#1945: warnings were screen-reader only).
  const [alertState, setAlert] = useState<{ text: string; n: number }>({
    text: "",
    n: 0,
  });
  const alertMessage = alertState.text;
  const setAlertMessage = useCallback((text: string) => {
    setAlert((prev) => ({ text, n: prev.n + 1 }));
  }, []);

  // Pre-Game Setup Wizard choices from the hosting cabinet (null standalone).
  const cabinetSetup = useCabinetSetup();
  // The frame loop reads this ref, so the loop never restarts on a change.
  const reducedMotionRef = useRef(prefersReducedMotion);
  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);
  const setupDifficulty = cabinetSetup?.config.difficulty;
  const setupLoadout = cabinetSetup?.config.loadout;
  const setupShake = cabinetSetup?.config.screenShake ?? "none";
  const setupCrt = cabinetSetup?.config.crtFilter ?? "off";
  const setupRunRevision = cabinetSetup?.runRevision ?? 0;
  const isSetupOpen = cabinetSetup?.isSetupOpen ?? false;
  const runTuning = useMemo(
    () =>
      setupDifficulty && setupLoadout
        ? resolveRunTuning(setupDifficulty, setupLoadout)
        : DEFAULT_RUN_TUNING,
    [setupDifficulty, setupLoadout]
  );

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef<boolean>(false);

  const hasAlertedMemoryRef = useRef<boolean>(false);
  const hasAlertedGcRef = useRef<boolean>(false);
  const hasAlertedCrashRef = useRef<boolean>(false);
  const hasAlertedBatteryRef = useRef<boolean>(false);
  const hasAlertedShutdownRef = useRef<boolean>(false);
  const lastBannerRef = useRef<string | null>(null);
  // The Finisher Cards last announced (#1996).
  const lastCardsRef = useRef<readonly FinisherCard[] | null>(null);
  const lastPaceFullRef = useRef(false);
  const lastRunStateRef = useRef<GameEngineState["gameState"]>("idle");
  // What the last frame showed of the medals, checkpoint and secret exits (#2025).
  // Null until the first frame, which only records the baseline, so a state
  // that already holds medals is not announced again on mount.
  const medalsSeenRef = useRef<{
    medals: readonly number[];
    checkpoint: GameEngineState["checkpoint"];
    exits: readonly number[];
  } | null>(null);
  // The Second Wind the last frame showed (#2026). Undefined until the first
  // frame, which only records the baseline, so an event already running on
  // mount is not announced again.
  const windSeenRef = useRef<SecondWind | null | undefined>(undefined);

  // Hardware & Simulation State
  const [bezelTheme, setBezelTheme] = useState<WatchBezelTheme>("slate");
  const [deviceTarget, setDeviceTarget] = useState<DeviceTarget>("fenix");
  const defaultState =
    initialState ?? createInitialState("fenix", loadedHighScore);
  const stateRef = useRef<GameEngineState>(defaultState);
  const [gameState, setGameState] = useState<GameEngineState>(defaultState);
  const effectiveHighScore = Math.max(gameState.highScore, loadedHighScore);
  const [isFocused, setIsFocused] = useState(false);
  // The best score before the current run, for the result card's best line,
  // and whether the player put the result card away to inspect the watch.
  const [runStartBest, setRunStartBest] = useState(effectiveHighScore);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [raceReport, setRaceReport] = useState<RaceReport | null>(null);
  // Badges and run history (#2021): read after mount so server and client
  // markup match, and saved once per run, keyed by the run id.
  const [badgeSave, setBadgeSave] = useState<BadgeSave | null>(null);
  const [badgeFresh, setBadgeFresh] = useState<BadgeId[]>([]);
  // Run 0 is a state handed in before any run starts, never a run played.
  const savedHistoryRunRef = useRef(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBadgeSave(loadBadges());
  }, []);
  // The share text of the last race when the clipboard is unavailable, or the
  // copied note once it is copied (#2019).
  const [shareNote, setShareNote] = useState<{
    text: string;
    copied: boolean;
  } | null>(null);
  const isDraggingFogRef = useRef(false);
  // A gesture that meets fog at any point is a wipe for its whole duration,
  // so clearing the last of the fog mid-drag never turns it into a swipe
  // (#1648).
  const isWipeGestureRef = useRef(false);

  // References for Canvas and Animation Loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toGameCoordinates } = useResponsiveCanvas({
    canvasRef,
    internalWidth: CANVAS_SIZE,
    internalHeight: CANVAS_SIZE,
    maxDpr: 1.5,
  });
  // Sharp on HiDPI screens; drawing stays in the 280x280 logical space.
  const canvasScaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: CANVAS_SIZE,
    logicalHeight: CANVAS_SIZE,
    // Resizing clears the bitmap; repaint in case the loop is idle.
    onResize: (scale) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      applyCanvasScale(ctx, scale);
      renderWatchFace(ctx, stateRef.current, groundStripRef.current, {
        reducedMotion: reducedMotionRef.current,
      });
    },
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outerContainerRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(outerContainerRef);
  const frameCountRef = useRef<number>(0);

  // Run telemetry: sampled beside the animation loop, never through React
  // state except the sample count shown in the panel.
  const telemetryRef = useRef(new TelemetryRecorder());
  const runStartedAtRef = useRef(0);
  const [telemetryCount, setTelemetryCount] = useState(0);

  const [groundStrip, setGroundStrip] =
    useState<GroundStripLayout>(DEFAULT_GROUND_STRIP);
  // The animation loop reads the layout from a ref so a change never
  // rebuilds the loop callback.
  const groundStripRef = useRef<GroundStripLayout>(DEFAULT_GROUND_STRIP);
  useEffect(() => {
    groundStripRef.current = groundStrip;
  }, [groundStrip]);
  useEffect(() => {
    // Storage is read after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroundStrip(loadGroundStrip());
  }, []);

  const handleGroundStripSlot = useCallback(
    (slot: number, field: GroundStripField) => {
      const next = groundStrip.map((current, i) =>
        i === slot ? field : current
      ) as unknown as GroundStripLayout;
      setGroundStrip(next);
      saveGroundStrip(next);
    },
    [groundStrip]
  );

  const handleGroundStripReset = useCallback(() => {
    setGroundStrip(DEFAULT_GROUND_STRIP);
    saveGroundStrip(DEFAULT_GROUND_STRIP);
  }, []);

  const handleExportCsv = useCallback(() => {
    const samples = telemetryRef.current.samples();
    if (samples.length === 0) return;
    downloadFile(
      exportTelemetryCsv(samples),
      `garmin-run-${exportStamp(runStartedAtRef.current)}.csv`,
      { mimeType: "text/csv;charset=utf-8" }
    );
  }, []);

  const handleExportFit = useCallback(() => {
    const samples = telemetryRef.current.samples();
    if (samples.length === 0) return;
    downloadFile(
      exportTelemetryFit(samples, runStartedAtRef.current || Date.now()),
      `garmin-run-${exportStamp(runStartedAtRef.current)}.fit`,
      { mimeType: "application/octet-stream" }
    );
  }, []);

  // Single gateway for every stateRef mutation: stateRef.current and
  // gameState are always written together from the same computed value, so
  // the 60fps-loop ref and the rendered React state can never diverge by a
  // call site forgetting to update one of them (#685, mirroring #655's
  // applyTransition in WorkingWithDuck.tsx). `shouldSync` lets the hot
  // per-frame tick path opt out of a React re-render per tick while still
  // going through this one path; every discrete user action defaults to
  // always syncing.
  const applyTransition = useCallback(
    (
      updater: (state: GameEngineState) => GameEngineState,
      shouldSync: (next: GameEngineState) => boolean = () => true
    ): GameEngineState => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      if (shouldSync(next)) {
        setGameState(next);
      }
      return next;
    },
    []
  );

  // Race refs (#2019): the fixed-step carry, and the id of the current run so a
  // race is saved once per run.
  const raceCarryRef = useRef(0);
  const raceRunIdRef = useRef(0);
  // The day the race was picked: a quick restart past midnight keeps its seed,
  // so the share text keeps that day too.
  const raceDayRef = useRef(new Date(0));
  // Virtual Partner (#2020): the ghost this race replays, if one is stored,
  // and this race's own recording, which becomes the ghost if it sets the
  // board's best.
  const ghostTrackRef = useRef<GhostTrack | null>(null);
  const ghostRecorderRef = useRef<GhostRecorder | null>(null);
  const ghostOnRef = useRef(ghostOn);
  useEffect(() => {
    ghostOnRef.current = ghostOn;
  }, [ghostOn]);
  // A new run. The engine gets this device's best split per lap so it can
  // colour the lap banners; the bests are read here, before the run saves.
  // A race takes the picked course and category, or the same race again when
  // `restart` is given. The fixed-step carry and the race report start over.
  const beginRun = useCallback(
    (restart?: RaceSetup, workout?: Workout) => {
      const today = new Date();
      // Race Day is a race on its own board, on the plan's course (#1994).
      const race =
        restart ??
        (workout
          ? workout.run.raceDay
            ? {
                course: "raceday" as const,
                category: "any" as const,
                seed: workout.run.seed,
              }
            : undefined
          : raceMode
            ? raceSetup(raceCourse, raceCategory, today)
            : undefined);
      if (!restart) raceDayRef.current = today;
      const fresh = startGame(
        setRules(stateRef.current, runRules),
        deviceTarget,
        runTuning,
        race,
        workout?.run
      );
      // A workout starts with the plan's lives; practice with a fresh three.
      // The gear packed for it goes on now (#1995).
      const loaded = startLoadout(
        workout && workout.lives !== null
          ? { ...fresh, lives: workout.lives }
          : fresh,
        workout?.packed ?? []
      );
      // Finisher Cards (#1996): a Training Run collects its own, a workout
      // the plan's, and a race none.
      const cards = race ? null : workout ? workout.cards : [];
      const started = {
        ...loaded,
        finisherCards: cards ? [...cards] : null,
        finisherNews: null,
        // Badges (#2021): every run is watched for its in-run badges.
        badgeRun: newBadgeRun(),
      };
      raceCarryRef.current = 0;
      raceRunIdRef.current += 1;
      ghostTrackRef.current = race ? loadGhost(race) : null;
      ghostRecorderRef.current = race ? createGhostRecorder() : null;
      setRaceReport(null);
      setShareNote(null);
      setBadgeFresh([]);
      applyTransition(() => ({
        ...started,
        bestSplits: loadBests(splitsKeyOf(started)).splits,
      }));
      if (race && !restart && !workout) {
        const info = RACE_CATEGORY_INFO[race.category];
        announce(
          `Race: ${RACE_COURSE_NAMES[race.course]}, ${info.name}. ${info.rule}`,
          "polite"
        );
      }
    },
    [
      applyTransition,
      runRules,
      deviceTarget,
      runTuning,
      raceMode,
      raceCourse,
      raceCategory,
      announce,
    ]
  );

  // A fresh run from the watch, the result card or the Training Plan: the
  // result card and the telemetry start over.
  const launchRun = useCallback(
    (workout?: Workout) => {
      setRunStartBest(
        Math.max(
          stateRef.current.highScore,
          parseInt(getHighScoreSnapshot(), 10) || 0
        )
      );
      setResultDismissed(false);
      telemetryRef.current.reset();
      setTelemetryCount(0);
      runStartedAtRef.current = Date.now();
      beginRun(undefined, workout);
      recordEvent("garmin_simulator_start", "project_click").catch(() => {});
      playSuccess();
    },
    [beginRun, recordEvent, playSuccess]
  );

  // The Training Plan (#1994): its save and the screen the watch shows
  // between workouts. Entering a workout starts it here.
  const startWorkout = useCallback(
    (
      run: PlanRun,
      lives: number | null,
      packed: readonly GearItem[],
      cards: readonly FinisherCard[] | null
    ) => launchRun({ run, lives, packed, cards }),
    [launchRun]
  );
  const plan = useTrainingPlan({ active: planMode, announce, startWorkout });
  const planPress = plan.press;
  const planModeRef = useRef(planMode);
  useEffect(() => {
    planModeRef.current = planMode;
  }, [planMode]);
  // Whether the watch shows a Training Plan screen rather than the run.
  const planFaceShowing = useCallback(
    () =>
      planModeRef.current &&
      plan.viewRef.current.save !== null &&
      stateRef.current.gameState !== "playing" &&
      stateRef.current.gameState !== "paused",
    [plan.viewRef]
  );
  // A press on a Training Plan screen. False when no plan screen is showing.
  const pressPlan = useCallback(
    (input: PlanInput) => planFaceShowing() && planPress(input),
    [planFaceShowing, planPress]
  );

  // The bests the last run was judged against, read just before that run was
  // saved, so the result card can show the difference. Keyed on the run.
  const [runRecord, setRunRecord] = useState<{
    key: string;
    previous: GarminBests;
  } | null>(null);
  const savedRunSeedRef = useRef<number | string | null>(null);
  // Each race is saved once per run, keyed by the run id (declared with the
  // race refs above beginRun): the same course is raced again and again, so
  // its seed alone would not tell the runs apart.
  const savedRaceRunRef = useRef(-1);
  // Each run's bests are saved once, when it ends: the 5K is finished
  // (summary), or the run crashed or lost power. A crash keeps its splits but
  // never sets a total.
  const { runOver } = plan;
  useEffect(() => {
    if (!isRunOver(gameState)) return;
    // Every run goes in the history once, and earns its badges (#2021).
    if (savedHistoryRunRef.current !== raceRunIdRef.current) {
      savedHistoryRunRef.current = raceRunIdRef.current;
      const recorded = recordRun(
        loadBadges(),
        runFactsOf(gameState),
        new Date()
      );
      saveBadges(recorded.save);
      setBadgeSave(recorded.save);
      setBadgeFresh(recorded.earned);
      for (const id of recorded.earned) {
        const milestone = BADGE_MILESTONES[id];
        if (milestone) recordArcadeMilestone("garmin-watch", milestone);
      }
      const news = badgeNews(recorded.earned);
      if (news) announce(news, "polite");
    }
    // A Training Plan workout settles on the map first (#1994).
    if (gameState.plan) runOver(gameState);
    if (gameState.race) {
      // A race keeps its own splits, and a judged time goes on its board.
      const runId = raceRunIdRef.current;
      if (savedRaceRunRef.current === runId) return;
      savedRaceRunRef.current = runId;
      const race = gameState.race;
      const key = splitsKeyOf(gameState);
      saveBests(
        key,
        mergeBests(
          loadBests(key),
          gameState.lapSplits ?? [],
          gameState.runClockMs ?? 0,
          gameState.gameState === "summary"
        )
      );
      const outcome = raceOutcomeOf(gameState);
      const verdict = judgeRace(race.category, outcome);
      const priorBoard = loadBoard(race.course, race.category, race.seed);
      const date = new Date();
      const saved =
        verdict.result === "time"
          ? saveResult(race, outcome.timeMs, date)
          : null;
      const place = saved?.place ?? 0;
      // A new best on the board becomes the ghost of this race.
      const recorder = ghostRecorderRef.current;
      if (saved && place === 1 && recorder) {
        saveGhost(
          race,
          finishGhost(recorder, outcome.lapSplits, outcome.timeMs),
          date
        );
      }
      const partner = ghostTrackRef.current;
      const record =
        verdict.result === "time"
          ? raceRecordOf(place, outcome.timeMs, priorBoard[0]?.timeMs ?? null)
          : null;
      setRaceReport({
        setup: race,
        outcome,
        verdict,
        place,
        record,
        board: saved?.board ?? priorBoard,
        date: raceDayRef.current,
        partnerMs:
          partner && outcome.finished ? outcome.timeMs - partner.timeMs : null,
      });
      announce(raceOverText(verdict, outcome, place, record), "assertive");
      return;
    }
    const seed = gameState.courseSeed ?? 0;
    // Every workout runs the plan's one seed, so a workout is told apart by its run.
    const savedKey = gameState.plan ? `plan:${raceRunIdRef.current}` : seed;
    if (savedRunSeedRef.current === savedKey) return;
    savedRunSeedRef.current = savedKey;
    const key = splitsKeyOf(gameState);
    const previous = loadBests(key);
    saveBests(
      key,
      mergeBests(
        previous,
        gameState.lapSplits ?? [],
        gameState.runClockMs ?? 0,
        gameState.gameState === "summary"
      )
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunRecord({ key, previous });
  }, [gameState, announce, runOver]);

  // Audio Beep Helpers (Authentic Garmin 1200-1600Hz Piezo)
  const playBeep = useCallback(
    (freq = 1200, dur = 0.04) => {
      try {
        playNote(freq, dur);
      } catch {}
    },
    [playNote]
  );

  const playButtonTone = useCallback(() => {
    playBeep(1400, 0.025);
  }, [playBeep]);

  // Jump (UP / Space). Holding jumps higher; a press just before landing or
  // just after running off an edge still counts (#1950).
  const handleJump = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing") {
      // On a Training Plan screen UP steps back through the map (#1994).
      pressPlan("prev");
      return;
    }
    const next = applyTransition((state) => pressJump(state));
    if (
      current.isGrounded !== next.isGrounded ||
      next.playerVy < current.playerVy
    ) {
      triggerHaptic(20);
      playBeep(900, 0.03);
    }
  }, [playBeep, applyTransition, pressPlan]);

  const handleJumpRelease = useCallback(() => {
    applyTransition((state) => releaseJump(state));
  }, [applyTransition]);

  // The action key (X): a Heat Map runner throws a heat bolt (#1989) and a
  // Cape runner spins (#1990).
  const handleAction = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing") return;
    const next = applyTransition((state) => pressAction(state));
    if ((next.boltsThrown ?? 0) !== (current.boltsThrown ?? 0)) {
      playBeep(1200, 0.03);
    } else if ((next.spinMs ?? 0) > (current.spinMs ?? 0)) {
      playBeep(700, 0.04);
    } else if (next.spinJump && !current.spinJump) {
      // Spin Jump (#2023): a light rising chirp.
      playBeep(1000, 0.03);
    }
  }, [playBeep, applyTransition]);

  // Sprint (Right) and brake (Left), held.
  const handleRunInput = useCallback(
    (input: -1 | 0 | 1) => {
      applyTransition((state) => setRunInput(state, input));
    },
    [applyTransition]
  );

  // DOWN: into a Water Station's bonus room when standing on one (#1992).
  // Otherwise a fitness run slams down in mid-air (#2023), and Dev Mode
  // jettisons the oldest variable.
  const handleJettison = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing") {
      pressPlan("next");
      return;
    }
    if (enterStation(current) !== current) {
      triggerHaptic(20);
      playBeep(880, 0.05);
      applyTransition((state) => enterStation(state));
      return;
    }
    if (isFitnessRun(current)) {
      if (canSlam(current)) {
        triggerHaptic(30);
        playBeep(330, 0.05);
        applyTransition((state) => pressSlam(state));
      }
      return;
    }
    triggerHaptic(20);
    playBeep(650, 0.035);
    const result = jettisonOldestVariable(current);
    if (result.reason && !result.popped) {
      setAlertMessage(result.reason);
      return;
    }
    applyTransition((state) => jettisonOldestVariable(state).state);
  }, [playBeep, applyTransition, setAlertMessage, pressPlan]);

  // Trigger Backlight / Flashlight (LIGHT)
  const handleToggleLight = useCallback(() => {
    triggerHaptic(20);
    playButtonTone();
    const current = stateRef.current;
    const nextLight = !current.isLightOn;
    if (nextLight && current.battery > 0) {
      playBeep(1600, 0.04);
    }
    applyTransition((state) => ({
      ...state,
      isLightOn: state.battery > 0 ? nextLight : false,
    }));
  }, [playButtonTone, playBeep, applyTransition]);

  // Force Garbage Collection (BACK). A fitness run has no heap, so BACK and
  // G are the action key there.
  const handleForceGc = useCallback(() => {
    const current = stateRef.current;
    if (isFitnessRun(current)) {
      handleAction();
      return;
    }
    if (current.gameState !== "playing" || current.isGcActive) return;
    triggerHaptic(20);
    playBeep(450, 0.08);
    const result = garbageCollect({ state: current });
    if (result.success) {
      applyTransition(() => result.data.state);
    } else if (result.error?.message) {
      setAlertMessage(result.error.message);
    }
  }, [
    playBeep,
    applyTransition,
    garbageCollect,
    setAlertMessage,
    handleAction,
  ]);

  // BACK is the action key at the Heat Map and Cape tiers and collects
  // garbage otherwise; X and G always do one each.
  const handleBack = useCallback(() => {
    if (pressPlan("back")) return;
    const power = stateRef.current.power;
    if (power === "heatmap" || power === "cape") handleAction();
    else handleForceGc();
  }, [handleAction, handleForceGc, pressPlan]);

  // Save Persistent Variable to Flash NVRAM (+8KB flash, RAM untouched)
  const handleSaveFlash = useCallback(() => {
    playBeep(800, 0.03);
    const current = stateRef.current;
    const result = allocateFlashVariable(
      current,
      NV_WRITE_KB,
      `nvram_${current.flashVariables.length + 1}.dat`
    );
    if (result.crashed) {
      // A manual write that does not fit is refused with the flash-specific
      // reason; only in-run flash tokens crash the run (#1210).
      const report = result.state.crashReport;
      setAlertMessage(
        `Out of Storage: ${report?.flashUsedKb ?? "?"}KB / ${report?.flashLimitKb ?? "?"}KB flash limit exceeded. Clear flash storage first.`
      );
      return;
    }
    applyTransition(() => result.state);
  }, [playBeep, applyTransition, setAlertMessage]);

  // Clear NVRAM Flash Storage (flashVariables, flashFiles, meter, persisted)
  const handleClearFlash = useCallback(() => {
    playBeep(500, 0.04);
    applyTransition((state) => clearFlashStorage(state));
  }, [playBeep, applyTransition]);

  // Drain Battery for Power Loss Testing
  const handleDrainBattery = useCallback(() => {
    playBeep(400, 0.05);
    applyTransition((state) => ({
      ...state,
      battery: Math.max(0, state.battery - 20),
    }));
  }, [playBeep, applyTransition]);

  // Start / Pause / Restart (START)
  const handleStartStop = useCallback(() => {
    triggerHaptic(20);
    playButtonTone();
    const current = stateRef.current;
    // In the Training Plan, START selects on the map and its cards (#1994).
    if (pressPlan("select")) return;
    if (
      current.gameState === "idle" ||
      current.gameState === "crashed" ||
      current.gameState === "shutdown" ||
      current.gameState === "summary"
    ) {
      launchRun();
    } else if (current.gameState === "playing") {
      applyTransition((state) => pauseGame(state));
    } else if (current.gameState === "paused") {
      applyTransition((state) => resumeGame(state));
    }
  }, [launchRun, playButtonTone, applyTransition, pressPlan]);

  // Quick restart (#2019): while a race is paused, Backspace runs the same
  // race again, on the same course seed.
  const restartRace = useCallback(() => {
    const current = stateRef.current;
    // A workout's lives come from the plan, so it is never restarted (#1994).
    if (current.gameState !== "paused" || !current.race || current.plan) return;
    triggerHaptic(20);
    playButtonTone();
    telemetryRef.current.reset();
    setTelemetryCount(0);
    runStartedAtRef.current = Date.now();
    beginRun(current.race);
    announce("Race restarted.", "polite");
  }, [beginRun, playButtonTone, announce]);

  // Race Mode picker (#2019): set while idle or after a run ends.
  const handleSetRunMode = useCallback(
    (mode: RunMode) => {
      writeRacePrefAndNotify(
        RACE_MODE_KEY,
        mode === "race" ? "1" : mode === "plan" ? PLAN_RUN_MODE : "0"
      );
      announce(
        mode === "race"
          ? "Race Mode on. The next run is a race on the picked course, with Dev Mode off."
          : mode === "plan"
            ? "Training Plan. The watch shows the Morning Report, then the map."
            : "Training Run. The next run lays a random course.",
        "polite"
      );
    },
    [announce]
  );
  const handleSetRaceCourse = useCallback((course: RaceCourse) => {
    writeRacePrefAndNotify(RACE_COURSE_KEY, course);
  }, []);
  const handleSetRaceCategory = useCallback((category: RaceCategory) => {
    writeRacePrefAndNotify(RACE_CATEGORY_KEY, category);
  }, []);
  // Virtual Partner options (#2020): the ghost is only drawn, so they can
  // change at any time, mid-race included.
  const handleSetGhostOn = useCallback((on: boolean) => {
    writeRacePrefAndNotify(GHOST_ON_KEY, on ? "1" : "0");
  }, []);
  const handleSetGhostTarget = useCallback((target: GhostTarget) => {
    writeRacePrefAndNotify(GHOST_TARGET_KEY, target);
  }, []);

  // Copies the race's share text, or shows it when the clipboard is unavailable.
  const handleShareRace = useCallback(
    async (report: RaceReport) => {
      const text = shareText(
        report.setup,
        report.verdict,
        report.outcome,
        report.date
      );
      try {
        await copyToClipboard(text);
        setShareNote({ text, copied: true });
        announce("Result copied.", "polite");
        return;
      } catch {
        // Clipboard blocked: fall through to the visible text.
      }
      setShareNote({ text, copied: false });
    },
    [announce]
  );

  // Quick Fog Wipe (W / Touch / Mouse)
  const handleWipeFog = useCallback(
    (canvasX = CANVAS_SIZE / 2, canvasY = CANVAS_SIZE / 2) => {
      // A fitness run has no fog to wipe.
      if (isFitnessRun(stateRef.current)) return;
      playBeep(1100, 0.015);
      applyTransition((state) => wipeScreenFog(state, canvasX, canvasY, 35));
    },
    [playBeep, applyTransition]
  );

  // Dev Mode applies from the next run; a run in progress keeps its rules.
  const handleToggleDevMode = useCallback(() => {
    const next = !getDevModeSnapshot();
    writeDevMode(next);
    applyTransition((state) => setRules(state, next ? "dev" : "fitness"));
    announce(
      next
        ? "Dev Mode on. The next run uses the firmware rules."
        : "Dev Mode off. The next run is a fitness run.",
      "polite"
    );
  }, [applyTransition, announce]);

  // Setup confirmed in the cabinet wizard (START GAME): begin a fresh run with
  // the chosen options right away and hand keyboard focus to the watch, so
  // the player never has to press a second start button.
  const handledRunRevisionRef = useRef(setupRunRevision);
  useEffect(() => {
    if (setupRunRevision === handledRunRevisionRef.current) return;
    handledRunRevisionRef.current = setupRunRevision;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunStartBest(
      Math.max(
        stateRef.current.highScore,
        parseInt(getHighScoreSnapshot(), 10) || 0
      )
    );
    setResultDismissed(false);
    beginRun();
    recordEvent("garmin_simulator_start", "project_click").catch(() => {});
    playSuccess();
    announce("New run started with your setup options.", "polite");
    // The wizard's focus trap restores focus to its trigger as it unmounts;
    // move focus to the watch after that has happened.
    window.setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [setupRunRevision, beginRun, recordEvent, playSuccess, announce]);

  // Reopening Setup mid-run pauses the run underneath the wizard. Confirming
  // restarts (handled above); skipping resumes exactly where it stopped.
  const pausedBySetupRef = useRef(false);
  useEffect(() => {
    if (isSetupOpen) {
      if (stateRef.current.gameState === "playing") {
        pausedBySetupRef.current = true;
        applyTransition((state) => pauseGame(state));
      }
    } else if (pausedBySetupRef.current) {
      pausedBySetupRef.current = false;
      if (stateRef.current.gameState === "paused") {
        applyTransition((state) => resumeGame(state));
      }
    }
  }, [isSetupOpen, applyTransition]);

  // A mouse or touch click on a setup control hands the keyboard back to the
  // watch, so Enter starts or reboots the run instead of pressing that
  // control again (#1649). Keyboard activation (click detail 0) keeps focus
  // where the player deliberately put it.
  const returnFocusAfterPointerClick = (e: React.MouseEvent) => {
    if (e.detail > 0) {
      containerRef.current?.focus({ preventScroll: true });
    }
  };

  // Switch Device Profile
  const handleSelectDevice = (target: DeviceTarget) => {
    if (target === stateRef.current.device) return;
    const midRun =
      stateRef.current.gameState === "playing" ||
      stateRef.current.gameState === "paused";
    if (
      midRun &&
      typeof window.confirm === "function" &&
      !window.confirm("Switch device? This ends the current run.")
    ) {
      return;
    }
    triggerHaptic(15);
    playButtonTone();
    setDeviceTarget(target);
    telemetryRef.current.reset();
    setTelemetryCount(0);
    applyTransition((state) => createInitialState(target, state.highScore));
  };

  // Process Directional Touch Swipe Gestures
  const processSwipeGesture = useCallback(
    (dx: number, dy: number) => {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      triggerHaptic(15);

      if (absY > absX) {
        if (dy < -35) {
          handleJump();
        } else if (dy > 35) {
          handleJettison();
        }
      } else {
        if (dx > 35) {
          handleStartStop();
        } else if (dx < -35) {
          handleForceGc();
        }
      }
    },
    [handleJump, handleJettison, handleStartStop, handleForceGc]
  );

  // The touch dock (#2122). Jog and Sprint are held like the arrow keys; with
  // both down the later press wins, and letting it go falls back to the other.
  const dockRunRef = useRef<{ jog: boolean; sprint: boolean; last: -1 | 1 }>({
    jog: false,
    sprint: false,
    last: 1,
  });
  const releaseDockRun = useCallback(() => {
    const held = dockRunRef.current;
    if (!held.jog && !held.sprint) return;
    held.jog = false;
    held.sprint = false;
    handleRunInput(0);
  }, [handleRunInput]);
  const handleDockKey = (key: GarminDockKey, down: boolean) => {
    // A Training Plan screen takes the dock as its arrows, Select, Back and
    // the gear bag, exactly as the keyboard drives it.
    if (planFaceShowing()) {
      if (!down) return;
      const planInput: Record<GarminDockKey, PlanInput> = {
        jog: "left",
        sprint: "right",
        down: "down",
        start: "select",
        back: "back",
        action: "bag",
        jump: "up",
      };
      triggerHaptic(15);
      plan.press(planInput[key]);
      return;
    }
    if (key === "jog" || key === "sprint") {
      const held = dockRunRef.current;
      held[key] = down;
      if (down) held.last = key === "jog" ? -1 : 1;
      const input: -1 | 0 | 1 =
        held.jog && held.sprint
          ? held.last
          : held.jog
            ? -1
            : held.sprint
              ? 1
              : 0;
      handleRunInput(input);
      return;
    }
    if (key === "jump") {
      if (down) handleJump();
      else handleJumpRelease();
      return;
    }
    if (!down) return;
    if (key === "action") handleAction();
    else if (key === "down") handleJettison();
    else if (key === "start") handleStartStop();
    else handleBack();
  };

  // The touch cabinet asks the game to stop when the tab is hidden or the app
  // is backgrounded (onAutoPause on PlayCabinet, #2122). A run in progress
  // pauses and held keys let go; resuming is the player's choice.
  useEffect(() => {
    const pauseRun = () => {
      handleJumpRelease();
      releaseDockRun();
      handleRunInput(0);
      if (stateRef.current.gameState === "playing") {
        applyTransition((state) => pauseGame(state, undefined, true));
      }
    };
    window.addEventListener(GARMIN_AUTO_PAUSE_EVENT, pauseRun);
    return () => window.removeEventListener(GARMIN_AUTO_PAUSE_EVENT, pauseRun);
  }, [applyTransition, handleJumpRelease, handleRunInput, releaseDockRun]);

  // Keyboard Event Handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const interceptKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
      " ",
      "l",
      "L",
      "w",
      "W",
      "Enter",
      "g",
      "G",
      "p",
      "P",
      "Backspace",
      "x",
      "X",
    ];

    if (interceptKeys.includes(e.key)) {
      e.preventDefault();
    }

    const status = stateRef.current.gameState;
    // A Training Plan screen takes the arrows, Space, Enter and BACK (#1994).
    const planInput = PLAN_KEYS[e.key];
    if (planInput && planFaceShowing()) {
      if (!e.repeat) plan.press(planInput);
      return;
    }
    if (e.key === "ArrowUp" || (e.key === " " && status === "playing")) {
      // Held keys repeat; only the first press jumps.
      if (!e.repeat) handleJump();
    } else if (e.key === "ArrowRight") {
      handleRunInput(1);
    } else if (e.key === "ArrowLeft") {
      handleRunInput(-1);
    } else if (e.key === "Escape" || e.key.toLowerCase() === "p") {
      // Pause and resume only; Escape never starts a run (#1945).
      if (status === "playing" || status === "paused") {
        e.preventDefault();
        handleStartStop();
      }
    } else if (e.key === "ArrowDown") {
      handleJettison();
    } else if (e.key.toLowerCase() === "l") {
      handleToggleLight();
    } else if (e.key.toLowerCase() === "w") {
      handleWipeFog();
    } else if (
      e.key === "Backspace" &&
      status === "paused" &&
      stateRef.current.race
    ) {
      restartRace();
    } else if (e.key === "Backspace" || e.key.toLowerCase() === "g") {
      handleForceGc();
    } else if (e.key.toLowerCase() === "x") {
      if (!e.repeat) handleAction();
    } else if (e.key === "Enter" || e.key === " ") {
      if (!e.repeat) handleStartStop();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp" || e.key === " ") {
      handleJumpRelease();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      handleRunInput(0);
    }
  };

  // Canvas Mouse & Touch Drag Wiping for Overheat Fog & Isolated Swipe Detection
  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    isDraggingFogRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipeHandledRef.current = false;
    isWipeGestureRef.current = stateRef.current.fogLevel > 0;

    if (typeof e.currentTarget.setPointerCapture === "function") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }

    const { x, y } = toGameCoordinates(e.clientX, e.clientY);
    handleWipeFog(x, y);
    containerRef.current?.focus({ preventScroll: true });
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (!isDraggingFogRef.current && e.buttons === 0) return;

    const { x, y } = toGameCoordinates(e.clientX, e.clientY);
    handleWipeFog(x, y);

    // Suppress directional swipe action processing for any gesture that has
    // met screen fog, even once the wipe has cleared it.
    if (stateRef.current.fogLevel > 0) {
      isWipeGestureRef.current = true;
    }
    if (isWipeGestureRef.current) {
      return;
    }

    if (pointerStartRef.current && !swipeHandledRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 35) {
        swipeHandledRef.current = true;
        processSwipeGesture(dx, dy);
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (typeof e.currentTarget.releasePointerCapture === "function") {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
    }

    // Evaluate directional swipe gesture only when screen fog is zero and
    // the gesture was never a wipe
    if (
      stateRef.current.fogLevel <= 0 &&
      !isWipeGestureRef.current &&
      pointerStartRef.current &&
      !swipeHandledRef.current
    ) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 35) {
        swipeHandledRef.current = true;
        processSwipeGesture(dx, dy);
      }
    }

    isDraggingFogRef.current = false;
    pointerStartRef.current = null;
    swipeHandledRef.current = false;
    isWipeGestureRef.current = false;
  };

  const handleCanvasPointerCancel = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (typeof e.currentTarget.releasePointerCapture === "function") {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
    }

    isDraggingFogRef.current = false;
    pointerStartRef.current = null;
    swipeHandledRef.current = false;
    isWipeGestureRef.current = false;
  };

  // Accessible control handlers run the same engine action as the visible
  // watch, then announce the state that actually resulted (not the state
  // from before the press).
  const a11yStartStop = () => {
    handleStartStop();
    const next = stateRef.current.gameState;
    announce(
      next === "playing"
        ? "Run in progress."
        : next === "paused"
          ? "Run paused."
          : `Status: ${next}.`,
      "polite"
    );
  };
  const a11yJump = () => {
    const wasGrounded = stateRef.current.isGrounded;
    handleJump();
    if (wasGrounded && !stateRef.current.isGrounded) {
      announce("Jumped.", "polite");
    }
  };
  const a11yJettison = () => {
    const before = stateRef.current.variables.length;
    handleJettison();
    const after = stateRef.current.variables.length;
    announce(
      after < before
        ? `Jettisoned oldest variable. RAM ${stateRef.current.allocatedRamKb.toFixed(1)} KB.`
        : "Nothing to jettison.",
      "polite"
    );
  };
  const a11yBack = () => {
    // The GC freeze itself is announced by the critical-alert effect.
    handleForceGc();
  };
  const a11yDown = () => {
    const before = stateRef.current;
    handleJettison();
    const after = stateRef.current;
    if (!before.bonusRoom && after.bonusRoom) {
      announce("Entered the Water Station bonus room.", "polite");
    } else if (!before.slamming && after.slamming) {
      announce("Burpee slam.", "polite");
    }
  };
  const a11yAction = () => {
    const before = stateRef.current;
    handleAction();
    const after = stateRef.current;
    if ((after.boltsThrown ?? 0) !== (before.boltsThrown ?? 0)) {
      announce("Threw a heat bolt.", "polite");
    } else if ((after.spinMs ?? 0) > (before.spinMs ?? 0)) {
      announce("Cape spin.", "polite");
    } else if (after.spinJump && !before.spinJump) {
      announce("Spin jump.", "polite");
    }
    // Medicine ball (#2024): picking one up and throwing it; a buddy mounts.
    if (!before.carrying && after.carrying) {
      announce("Medicine ball picked up.", "polite");
    }
    if (!before.thrownBall && after.thrownBall) {
      announce("Threw the medicine ball.", "polite");
    }
    if (!before.riding && after.riding) {
      announce("Riding your buddy.", "polite");
    }
  };
  const a11yLight = () => {
    handleToggleLight();
    announce(
      stateRef.current.isLightOn ? "Backlight on." : "Backlight off.",
      "polite"
    );
  };
  const a11yReadTelemetry = () => {
    const s = stateRef.current;
    const fitnessReadout =
      s.gameState === "idle" ? !getDevModeSnapshot() : isFitnessRun(s);
    if (fitnessReadout) {
      const bb = s.bodyBattery;
      announce(
        `Status: ${s.gameState}. ${stageLabel(s)}. Body Battery: ${Math.round(bb?.value ?? 100)}${bb?.bonked ? ", bonked" : ""}. Lives: ${s.lives ?? 1}. Power: ${POWER_NAMES[s.power ?? "base"]}. Pace meter: ${paceSegments(s.paceMeter)} of ${PACE_SEGMENTS}${(s.starMs ?? 0) > 0 ? ", Runner's High" : ""}. Kudos: ${s.kudos ?? 0}.${courseReadout(s)} Score: ${s.score}.${runClockReadout(s)} High score: ${Math.max(s.highScore, loadedHighScore)}.`,
        "polite"
      );
      return;
    }
    announce(
      `Status: ${s.gameState}. ${stageLabel(s)}. Memory: ${s.allocatedRamKb.toFixed(1)} of ${currentProfile.ramLimitKb} KB. Flash: ${s.allocatedFlashKb.toFixed(1)} KB. Battery: ${Math.round(s.battery)}%. Thermal stress: ${Math.round((s.thermalStress ?? 0) * 100)}%. Condensation: ${Math.round(s.fogLevel * 100)}%. Lives: ${s.lives ?? 1}. Power: ${POWER_NAMES[s.power ?? "base"]}. Pace meter: ${paceSegments(s.paceMeter)} of ${PACE_SEGMENTS}${(s.starMs ?? 0) > 0 ? ", Runner's High" : ""}.${courseReadout(s)} Score: ${s.score}.${runClockReadout(s)} High score: ${Math.max(s.highScore, loadedHighScore)}.`,
      "polite"
    );
  };

  // Screen Reader Critical Alert Vocalizations Effect
  useEffect(() => {
    const ramLimit = DEVICE_PROFILES[deviceTarget].ramLimitKb;
    const ramUsage = gameState.allocatedRamKb;
    const fitnessRun = isFitnessRun(gameState);
    const isHighMemory = !fitnessRun && ramUsage / ramLimit > 0.85;

    // 1. High Memory Pressure (>85%)
    if (
      isHighMemory &&
      !hasAlertedMemoryRef.current &&
      gameState.gameState === "playing"
    ) {
      hasAlertedMemoryRef.current = true;
      const msg = `Warning: High memory pressure. RAM usage at ${Math.round((ramUsage / ramLimit) * 100)}% (${ramUsage.toFixed(1)} KB of ${ramLimit} KB).`;
      setAlertMessage(msg);
      announce(msg, "assertive");
      triggerHaptic([30, 20, 30]);
    } else if (!isHighMemory && ramUsage / ramLimit <= 0.8) {
      hasAlertedMemoryRef.current = false;
    }

    // 2. Garbage Collection Freeze
    if (gameState.isGcActive && !hasAlertedGcRef.current) {
      hasAlertedGcRef.current = true;
      const msg = `Garbage collection active. ${gameState.tuning?.gcFreezeMs ?? DEFAULT_RUN_TUNING.gcFreezeMs} millisecond execution freeze.`;
      setAlertMessage(msg);
      announce(msg, "assertive");
    } else if (!gameState.isGcActive) {
      hasAlertedGcRef.current = false;
    }

    // 3. System Crash / Out Of Memory
    if (gameState.gameState === "crashed" && !hasAlertedCrashRef.current) {
      hasAlertedCrashRef.current = true;
      const errorType = gameState.crashReport?.errorType || "Out Of Memory";
      // A race announces its own end, with its verdict (see the save effect).
      if (!gameState.race) {
        const msg = fitnessRun
          ? `Run over: ${causeLabel(gameState, errorType)}. Training Status: ${trainingStatus(gameState.stage ?? 1, false)}. Finisher medals: ${gameState.medalsFound?.length ?? 0} of ${STAGE_COUNT * MEDALS_PER_STAGE}.`
          : `System crash: ${errorType}. ${gameState.crashReport?.file ? "File: " + gameState.crashReport.file : ""}`;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAlertMessage(msg);
        announce(msg, "assertive");
      }
      triggerHaptic([50, 50, 50]);
    } else if (gameState.gameState !== "crashed") {
      hasAlertedCrashRef.current = false;
    }

    // 4. Low battery (<15%), once per crossing
    if (
      !fitnessRun &&
      gameState.gameState === "playing" &&
      gameState.battery > 0 &&
      gameState.battery < 15 &&
      !hasAlertedBatteryRef.current
    ) {
      hasAlertedBatteryRef.current = true;
      const msg = `Warning: low battery, ${Math.round(gameState.battery)}%. Turn off the backlight to save power.`;
      setAlertMessage(msg);
      announce(msg, "assertive");
    } else if (gameState.battery >= 20) {
      hasAlertedBatteryRef.current = false;
    }

    // 5. Power loss
    if (gameState.gameState === "shutdown" && !hasAlertedShutdownRef.current) {
      hasAlertedShutdownRef.current = true;
      const msg = "Power loss: battery empty. The watch has shut down.";
      setAlertMessage(msg);
      announce(msg, "assertive");
    } else if (gameState.gameState !== "shutdown") {
      hasAlertedShutdownRef.current = false;
    }

    // 6. Course banners (power-ups, lives, stage clears) are drawn on the
    // face; screen readers hear them too. The opening banner is skipped:
    // starting a run is already announced.
    const bannerText = gameState.banner?.text ?? null;
    const justStarted =
      gameState.gameState === "playing" &&
      lastRunStateRef.current !== "playing";
    lastRunStateRef.current = gameState.gameState;
    // A Finisher Card just collected (#1996) is heard with what its set
    // paid, even when the pole ends the run; a badge banner says no more.
    const cards = gameState.finisherCards ?? null;
    if (cards !== lastCardsRef.current) {
      lastCardsRef.current = cards;
      if (!justStarted && gameState.finisherNews) {
        announce(gameState.finisherNews, "polite");
        // A badge banner repeats what was just said; a lap banner does not.
        if (isPayoutBanner(bannerText)) lastBannerRef.current = bannerText;
      }
    }
    if (justStarted) {
      lastBannerRef.current = bannerText;
    } else if (
      bannerText &&
      bannerText !== lastBannerRef.current &&
      gameState.gameState === "playing"
    ) {
      lastBannerRef.current = bannerText;
      announce(bannerText, "polite");
    } else if (!bannerText) {
      lastBannerRef.current = null;
    }

    // 7. The pace meter filling is announced once each time it fills.
    const paceFull =
      gameState.gameState === "playing" && isPaceFull(gameState.paceMeter);
    if (paceFull && !lastPaceFullRef.current) {
      announce("Pace meter full.", "polite");
    }
    lastPaceFullRef.current = paceFull;

    // 8. Finisher Medals, the Aid Station and secret exits (#2025), each
    // announced once when a frame first shows it.
    const medalsNow = gameState.medalsFound ?? [];
    const checkpointNow = gameState.checkpoint ?? null;
    const exitsNow = gameState.secretExits ?? [];
    const seen = medalsSeenRef.current ?? {
      medals: medalsNow,
      checkpoint: checkpointNow,
      exits: exitsNow,
    };
    for (const id of medalsNow) {
      if (seen.medals.includes(id)) continue;
      // Count up to this medal, so each new one reads its own place.
      const upTo = medalsNow.slice(0, medalsNow.indexOf(id) + 1);
      announce(
        `Finisher medal found, ${stageMedalCount(upTo, medalStage(id))} of ${MEDALS_PER_STAGE} on this stage.`,
        "polite"
      );
    }
    if (
      checkpointNow &&
      (seen.checkpoint?.x !== checkpointNow.x ||
        seen.checkpoint?.stage !== checkpointNow.stage)
    ) {
      announce(
        "Aid station checkpoint reached. You will restart here.",
        "polite"
      );
    }
    if (exitsNow.some((stage) => !seen.exits.includes(stage))) {
      announce("Secret exit found. Shortcut open.", "polite");
    }
    medalsSeenRef.current = {
      medals: medalsNow,
      checkpoint: checkpointNow,
      exits: exitsNow,
    };

    // 9. Second Wind events (#2026): start, goal met and over. A goal met on
    // the event's last tick (always so for Night Run) is gone from the state
    // by the time it is seen, so it is read from the "OVER" banner's tone.
    const windNow = gameState.secondWind ?? null;
    const windWas =
      windSeenRef.current === undefined ? windNow : windSeenRef.current;
    if (windNow && !windWas) {
      announce(secondWindStartText(windNow.kind), "polite");
    }
    const metAtEnd =
      !windNow &&
      windWas !== null &&
      !windWas.cleared &&
      gameState.banner?.tone === "good" &&
      gameState.banner.text.endsWith(" OVER");
    if ((windNow?.cleared && !windWas?.cleared) || metAtEnd) {
      announce("Second Wind goal met.", "polite");
    }
    if (!windNow && windWas) {
      announce("Second Wind over.", "polite");
    }
    windSeenRef.current = windNow;
  }, [gameState, deviceTarget, announce, setAlertMessage]);

  // Main 60FPS Game Physics and Rendering Loop
  //
  // Runs on every frame while the canvas context is live, with each delta
  // clamped to 40 ms as before. The context listeners set a ref that guards
  // the frame already in flight and a state flag that stops the loop;
  // restoring the context starts a fresh one.
  const contextLostRef = useRef(false);
  const [isContextLost, setIsContextLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      setIsContextLost(false);
    };

    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
    };
  }, []);

  useAnimationFrame(
    (deltaMs) => {
      if (contextLostRef.current) return;

      // Update simulation in mutable ref if active
      if (stateRef.current.gameState === "playing") {
        const prevStatus = stateRef.current.gameState;
        // The run clock on the face drawn last, so a pole grabbed in any of
        // this frame's steps gives the card the runner saw (#1996).
        const shownClockMs = stateRef.current.runClockMs;
        // A race steps at a fixed 1/60 s, so a fast or slow monitor cannot
        // change its time (#2019). Each frame runs whole steps; the rest is
        // carried. A Training Run takes one step of the frame's delta.
        const fixed = stateRef.current.race
          ? fixedSteps(raceCarryRef.current, deltaMs)
          : null;
        if (fixed) raceCarryRef.current = fixed.carryMs;
        const stepCount = fixed ? fixed.steps : 1;
        const stepMs = fixed ? FIXED_STEP_MS : deltaMs;
        const prevStage = stateRef.current.stage ?? 1;
        // On milestone status transition, sync the throttled React UI
        // immediately. Otherwise, sync low-frequency React UI throttled to
        // 10 FPS (every 6 frames). Intermediate race steps sync only with the
        // frame's last step.
        let nextState = stateRef.current;
        for (
          let i = 0;
          i < stepCount && nextState.gameState === "playing";
          i++
        ) {
          const last = i === stepCount - 1;
          nextState = applyTransition(
            // Race Day moves The Wall after each step (#1994), packed gear
            // takes effect (#1995), the pole's Finisher Card is collected
            // (#1996), and the run's badges are watched (#2021).
            (state) =>
              stepBadgeRun(
                state,
                stepFinisherCard(
                  state,
                  shownClockMs,
                  stepLoadout(
                    state,
                    stepRaceDay(
                      state,
                      updateGameSimulation(state, stepMs),
                      stepMs
                    ),
                    stepMs
                  )
                )
              ),
            (next) => {
              if (next.gameState !== prevStatus) return true;
              if (!last) return false;
              frameCountRef.current++;
              return frameCountRef.current % 6 === 0;
            }
          );
          const recorder = ghostRecorderRef.current;
          if (recorder)
            recordGhost(recorder, nextState, isUnderwater(nextState));
        }

        // A lap banner in a race adds the gap to the Virtual Partner at that
        // lap (#2020). Only the banner's text changes, which the engine never
        // reads, so the ghost cannot change the run.
        const ghost = ghostTrackRef.current;
        const laps = nextState.lapSplits ?? [];
        if (
          ghost &&
          ghostOnRef.current &&
          (nextState.stage ?? 1) > prevStage &&
          nextState.banner?.text.startsWith("LAP ")
        ) {
          const gap = lapGapMs(
            ghost,
            laps.length,
            laps.reduce((sum, ms) => sum + ms, 0)
          );
          if (gap !== null) {
            nextState = applyTransition((state) =>
              state.banner
                ? {
                    ...state,
                    banner: {
                      ...state.banner,
                      text: `${state.banner.text} · ${formatGap(gap)}`,
                    },
                  }
                : state
            );
          }
        }

        const recorder = telemetryRef.current;
        const sampled = recorder.advance(nextState, deltaMs);
        const closed =
          nextState.gameState !== "playing" && recorder.finish(nextState);
        if (sampled || closed) setTelemetryCount(recorder.count);

        // Save a new high score when the run ends, and about once a second
        // while it's still going. The engine raises highScore to the score
        // every tick, so compare against the stored best instead.
        const runEnded = nextState.gameState !== "playing";
        if (runEnded || frameCountRef.current % 60 === 0) {
          const storedBest = parseInt(getHighScoreSnapshot(), 10) || 0;
          if (nextState.highScore > storedBest) {
            safeSetRawItem(HIGH_SCORE_KEY, nextState.highScore.toString(), {
              retainInMemory: false,
            });
            recordArcadeScore("garmin-watch", nextState.highScore);
          }
        }

        // Trophies follow the course, not the score (#2047): a new stage
        // means the last one's pole was reached, and the summary is the 5K.
        // The loop only steps a playing run, so the summary lands once.
        const finished = nextState.gameState === "summary";
        if (finished || (nextState.stage ?? 1) > prevStage) {
          recordArcadeMilestone("garmin-watch", "stage_cleared");
        }
        // A Training Plan workout is one stage, not the 5K.
        if (finished && !nextState.plan) {
          recordArcadeMilestone("garmin-watch", "run_complete");
        }
      }

      // Render Canvas Frame directly from mutable ref
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const scale = canvasScaleRef.current;
          applyCanvasScale(ctx, scale);
          const planView = plan.viewRef.current;
          if (planFaceShowing() && planView.save) {
            // Between workouts the watch shows the Training Plan (#1994).
            renderPlanFace(ctx, planView.save, planView.screen);
          } else {
            renderWatchFace(ctx, stateRef.current, groundStripRef.current, {
              reducedMotion: reducedMotionRef.current,
              ...ghostOptions(
                stateRef.current,
                ghostOnRef.current ? ghostTrackRef.current : null,
                reducedMotionRef.current
              ),
            });
          }
        }
      }
    },
    { isActive: !isContextLost, maxDeltaMs: 40 }
  );

  const currentProfile = DEVICE_PROFILES[deviceTarget];
  const gcFreezeMs = gameState.tuning?.gcFreezeMs ?? runTuning.gcFreezeMs;

  // Screen shake and a red flash fire on discrete impacts only: the run
  // ending in a crash or power loss, and GC on the High shake setting.
  // useArcadeFx keeps them off under reduced motion and below 768px.
  const {
    stageRef: fxStageRef,
    flashRef: fxFlashRef,
    shake: fxShake,
    flash: fxFlash,
  } = useArcadeFx({
    enabled: setupShake !== "none" && !prefersReducedMotion,
  });
  const lastStatusRef = useRef(gameState.gameState);
  const lastGcRef = useRef(gameState.isGcActive);
  useEffect(() => {
    const prev = lastStatusRef.current;
    lastStatusRef.current = gameState.gameState;
    if (
      prev === "playing" &&
      (gameState.gameState === "crashed" || gameState.gameState === "shutdown")
    ) {
      fxShake(6);
      fxFlash("#ef4444");
    }
  }, [gameState.gameState, fxShake, fxFlash]);
  useEffect(() => {
    const wasActive = lastGcRef.current;
    lastGcRef.current = gameState.isGcActive;
    if (!wasActive && gameState.isGcActive && setupShake === "high") {
      fxShake(4);
    }
  }, [gameState.isGcActive, setupShake, fxShake]);

  // Fitness or Dev Mode as the player sees it: the next run's rules while
  // idle, otherwise the rules the current or last run used.
  const fitnessView =
    gameState.gameState === "idle" ? !devMode : isFitnessRun(gameState);

  // What the START button does right now, shown on the bezel (#1216).
  const startAction =
    gameState.gameState === "playing"
      ? "Pause"
      : gameState.gameState === "paused"
        ? "Resume"
        : gameState.gameState === "idle"
          ? "Start"
          : "Restart";

  const handlePusherClick = (id: PusherId, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(20);
    if (id === "light") handleToggleLight();
    else if (id === "up") handleJump();
    else if (id === "down") handleJettison();
    else if (id === "start") handleStartStop();
    else handleBack();
    containerRef.current?.focus({ preventScroll: true });
  };

  // A pusher's name starts with its caption and key hint, the words it shows,
  // so speech input users can say what they see (axe
  // label-content-name-mismatch, #2571).
  const pushers: Array<{
    id: PusherId;
    label: string;
    hint: string;
    title: string;
    ariaLabel?: string;
  }> = [
    {
      id: "light",
      label: "LIGHT",
      hint: "[L]",
      title: "Backlight (L): +0.3%/s Battery",
    },
    {
      id: "up",
      label: "UP",
      hint: "[▲]",
      title: "Jump (ArrowUp / Space), hold for higher",
    },
    fitnessView
      ? {
          id: "down",
          label: "DOWN",
          hint: "[▼]",
          title:
            "Down: Water Station bonus room on a station, Burpee Slam in mid-air (ArrowDown / DOWN)",
        }
      : {
          id: "down",
          label: "DOWN",
          hint: "[▼] POP",
          title:
            "Jettison Variable, or enter a Water Station's bonus room (ArrowDown / DOWN)",
        },
    {
      id: "start",
      label: startAction.toUpperCase(),
      hint: "[ENTER]",
      title: `${startAction} (Enter / P)`,
      ariaLabel: `${startAction}, Enter or P`,
    },
    gameState.power === "heatmap"
      ? {
          id: "back",
          label: "THROW",
          hint: "[X]",
          title: fitnessView
            ? "Throw Heat Bolt (X / BACK)"
            : "Throw Heat Bolt (X / BACK); G still collects garbage",
          ariaLabel: "Throw (heat bolt), X or BACK",
        }
      : gameState.power === "cape"
        ? {
            id: "back",
            label: "SPIN",
            hint: "[X]",
            title: fitnessView
              ? "Cape Spin (X / BACK)"
              : "Cape Spin (X / BACK); G still collects garbage",
            ariaLabel: "Spin (cape spin), X or BACK",
          }
        : fitnessView
          ? {
              id: "back",
              label: "ACTION",
              hint: "[X]",
              title:
                "Action (X / BACK): throws a heat bolt with a Heat Map, spins with the Compression Cape, Spin Jump in mid-air; stand beside a medicine ball to pick it up, then press again to throw it",
              ariaLabel: "Action, X or BACK",
            }
          : {
              id: "back",
              label: "BACK",
              hint: "[G]",
              title: `Force Garbage Collection (G / Backspace): ${gcFreezeMs}ms Freeze`,
            },
  ];

  // The end of a run: the watch draws its own one-layer error face, and the
  // result card opens over the companion panel beside it.
  const runEnded =
    gameState.gameState === "crashed" ||
    gameState.gameState === "shutdown" ||
    gameState.gameState === "summary";
  const crashType = gameState.crashReport?.errorType ?? "Out Of Memory";
  // A race's result card reports its verdict in place of the Training Status.
  const raceVerdict =
    gameState.race && runEnded
      ? judgeRace(gameState.race.category, raceOutcomeOf(gameState))
      : null;
  const endTitle = raceVerdict
    ? "RACE REPORT"
    : gameState.gameState === "shutdown"
      ? "BROWNOUT SHUTDOWN"
      : gameState.gameState === "crashed"
        ? fitnessView
          ? causeLabel(gameState, crashType)
          : (CRASH_LABELS[crashType]?.title ?? "APP CRASHED")
        : "5K COMPLETE";
  const endMessage = raceVerdict
    ? raceVerdict.result === "time"
      ? `Finished in ${formatRaceTime(gameState.runClockMs ?? 0)}. The board and your splits are below.`
      : `${raceVerdict.result.toUpperCase()}: ${raceVerdict.reason}. The board and your splits are below.`
    : gameState.gameState === "shutdown"
      ? `${CRASH_LABELS["Power Loss"].hint} Power loss score penalty applied (-50 PTS).`
      : gameState.gameState === "crashed"
        ? fitnessView
          ? `${FITNESS_CRASH_HINTS[crashType] ?? FITNESS_CRASH_FALLBACK} Training Status: ${trainingStatus(gameState.stage ?? 1, false)}.`
          : (CRASH_LABELS[crashType]?.hint ?? "Reboot and try again.")
        : fitnessView
          ? `All five stages cleared. Training Status: ${trainingStatus(gameState.stage ?? 1, true)}. The activity is saved to the watch.`
          : "All five stages cleared. The activity is saved to the watch.";
  const report = gameState.crashReport;
  const endStats: Array<{ label: string; value: number; suffix?: string }> = [
    { label: "Score", value: gameState.score },
    {
      label: "Metres",
      value: Math.round(gameState.distanceMeters),
    },
    { label: "Kudos", value: gameState.kudos ?? 0 },
  ];
  if (fitnessView) {
    endStats.push({
      label: "Body Battery",
      value: Math.round(gameState.bodyBattery?.value ?? 0),
    });
  } else if (gameState.gameState === "shutdown") {
    endStats.push({
      label: "Steps",
      value: stepsFor(gameState.distanceMeters),
    });
  } else if (report?.errorType === "Out Of Storage") {
    const used = report.flashUsedKb ?? gameState.allocatedFlashKb;
    const limit = report.flashLimitKb ?? currentProfile.flashLimitKb;
    endStats.push({
      label: "Flash",
      value: Math.round((used / Math.max(1, limit)) * 100),
      suffix: "%",
    });
  } else {
    const used = report?.heapUsedKb ?? gameState.allocatedRamKb;
    const limit = report?.heapLimitKb ?? currentProfile.ramLimitKb;
    endStats.push({
      label: "Heap",
      value: Math.round((used / Math.max(1, limit)) * 100),
      suffix: "%",
    });
  }

  // What the touch dock drives right now: the run, or a Training Plan screen.
  const runLive =
    gameState.gameState === "playing" || gameState.gameState === "paused";
  const dockMode: GarminDockMode =
    planMode && plan.save !== null && !runLive ? "plan" : "run";

  const rebootFromCard = () => {
    triggerHaptic(20);
    playButtonTone();
    launchRun();
    window.setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return {
    a11yAction,
    a11yBack,
    a11yDown,
    a11yJettison,
    a11yJump,
    a11yLight,
    a11yReadTelemetry,
    a11yStartStop,
    alertMessage,
    alertState,
    announce,
    badgeFresh,
    badgeSave,
    bezelTheme,
    canvasRef,
    containerRef,
    crashType,
    currentProfile,
    devMode,
    deviceTarget,
    dockMode,
    effectiveHighScore,
    endMessage,
    endStats,
    endTitle,
    fitnessView,
    fxFlashRef,
    fxStageRef,
    gameState,
    ghostOn,
    ghostTarget,
    groundStrip,
    handleBack,
    handleCanvasPointerCancel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleClearFlash,
    handleDockKey,
    handleDrainBattery,
    handleExportCsv,
    handleExportFit,
    handleGroundStripReset,
    handleGroundStripSlot,
    handleJettison,
    handleJump,
    handleJumpRelease,
    handleKeyDown,
    handleKeyUp,
    handlePusherClick,
    handleRunInput,
    handleSaveFlash,
    handleSelectDevice,
    handleSetGhostOn,
    handleSetGhostTarget,
    handleSetRaceCategory,
    handleSetRaceCourse,
    handleSetRunMode,
    handleShareRace,
    handleStartStop,
    handleToggleDevMode,
    handleToggleLight,
    handleWipeFog,
    isFocused,
    isFullscreen,
    outerContainerRef,
    plan,
    planMode,
    pushers,
    raceCategory,
    raceCourse,
    raceMode,
    raceReport,
    raceVerdict,
    rebootFromCard,
    recordEvent,
    resultDismissed,
    returnFocusAfterPointerClick,
    runEnded,
    runLive,
    runRecord,
    runStartBest,
    setBezelTheme,
    setIsFocused,
    setResultDismissed,
    setupCrt,
    shareNote,
    startAction,
    telemetryCount,
    toggleFullscreen,
  };
}
