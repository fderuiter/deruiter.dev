"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { IconPlayerPlay } from "@tabler/icons-react";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { ResultCard } from "@/components/arcade/ResultCard";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import {
  renderWatchFace,
  stepsFor,
} from "@/components/garmin-watch/watch-face-art";
import {
  WatchGlass,
  WatchHardware,
  type WatchBezelTheme,
} from "@/components/garmin-watch/WatchHardware";
import { CompanionPanel } from "@/components/garmin-watch/CompanionPanel";
import {
  pusherAnchorPercent,
  screenBoxPercent,
  type PusherId,
} from "@/components/garmin-watch/watch-geometry";
import { downloadFile } from "@/lib/download";
import {
  TelemetryRecorder,
  exportTelemetryCsv,
  exportTelemetryFit,
} from "@/lib/garmin-telemetry";
import {
  DEFAULT_GROUND_STRIP,
  loadGroundStrip,
  saveGroundStrip,
  type GroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin-ground-strip";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
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
import { BezelClusterDock } from "@/components/arcade/ControlDocks";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import {
  DeviceTarget,
  DEVICE_PROFILES,
  createInitialState,
  resolveRunTuning,
  DEFAULT_RUN_TUNING,
  startGame,
  jettisonOldestVariable,
  pauseGame,
  resumeGame,
  wipeScreenFog,
  updateGameSimulation,
  JUMP_FORCE,
  CANVAS_SIZE,
  GameEngineState,
  CrashReport,
  allocateFlashVariable,
  clearFlashStorage,
} from "@/lib/garmin-engine";
import {
  TelemetryBuffer,
  exportTelemetryToCsv,
  exportTelemetryToFit,
  downloadClientFile,
  type TelemetrySample,
} from "@/lib/garmin-telemetry-buffer";
import {
  loadWidgetLayout,
  saveWidgetLayout,
  DEFAULT_WIDGET_LAYOUT,
  type WidgetLayoutConfig,
  type WidgetSlot,
  type MetricKey,
} from "@/lib/garmin-widget-layout";

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
    hint: "A watchdog timer caught you. Jump (Up) over it.",
  },
  "Null Pointer": {
    title: "NULL POINTER",
    hint: "You ran into a null reference. Jump (Up) over bugs.",
  },
  "Symbol Not Found": {
    title: "SYMBOL NOT FOUND",
    hint: "You ran into a missing symbol. Jump (Up) over bugs.",
  },
  "Stack Overflow": {
    title: "STACK OVERFLOW",
    hint: "You ran into runaway recursion. Jump (Up) over bugs.",
  },
  "Power Loss": {
    title: "POWER LOSS",
    hint: "The battery ran out. Keep the backlight off to save power.",
  },
};

/** Where the canvas sits over the watch's round screen. */
const SCREEN_BOX = screenBoxPercent();

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

interface GarminWatchSimulatorProps {
  /**
   * Test/debug seam only: seeds both stateRef and gameState with this exact
   * state at mount instead of a fresh createInitialState() call. Lets a
   * real-component + real-engine test drive straight to a specific (e.g.
   * mid-run) state without simulating a full playthrough or mocking the
   * engine module (#685). Not used by any production caller.
   */
  initialState?: GameEngineState;
}

export const GarminWatchSimulator: React.FC<GarminWatchSimulatorProps> = ({
  initialState,
}) => {
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const { playNote, playSuccess } = useAudio();
  const { recordEvent } = useTelemetry();
  const { announce } = useAnnouncer();
  const { garbageCollect } = useGarminService();
  const [alertMessage, setAlertMessage] = useState<string>("");

  // Pre-Game Setup Wizard choices from the hosting cabinet (null standalone).
  const cabinetSetup = useCabinetSetup();
  const prefersReducedMotion = usePrefersReducedMotion();
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
  const isDraggingFogRef = useRef(false);
  // A gesture that meets fog at any point is a wipe for its whole duration,
  // so clearing the last of the fog mid-drag never turns it into a swipe
  // (#1648).
  const isWipeGestureRef = useRef(false);

  // Telemetry buffer & Widget layout
  const telemetryRef = useRef(new TelemetryRecorder());
  const runStartedAtRef = useRef(0);
  const telemetryBufferRef = useRef<TelemetryBuffer>(new TelemetryBuffer());
  const [telemetrySamples, setTelemetrySamples] = useState<TelemetrySample[]>(
    []
  );
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayoutConfig>(() =>
    loadWidgetLayout()
  );
  const widgetLayoutRef = useRef<WidgetLayoutConfig>(widgetLayout);
  useEffect(() => {
    widgetLayoutRef.current = widgetLayout;
  }, [widgetLayout]);

  const handleUpdateLayoutSlot = useCallback(
    (slot: WidgetSlot, metric: MetricKey) => {
      setWidgetLayout((prev) => {
        const next = { ...prev, [slot]: metric };
        saveWidgetLayout(next);
        return next;
      });
    },
    []
  );

  const handleResetLayout = useCallback(() => {
    setWidgetLayout(DEFAULT_WIDGET_LAYOUT);
    saveWidgetLayout(DEFAULT_WIDGET_LAYOUT);
  }, []);

  const handleExportCsv = useCallback(() => {
    const mainSamples = telemetryRef.current.samples();
    if (mainSamples.length > 0) {
      downloadFile(
        exportTelemetryCsv(mainSamples),
        `garmin-run-${exportStamp(runStartedAtRef.current)}.csv`,
        { mimeType: "text/csv;charset=utf-8" }
      );
      return;
    }
    const samples = telemetryBufferRef.current.getSamples();
    if (samples.length === 0) return;
    const csv = exportTelemetryToCsv(samples);
    downloadClientFile(csv, "garmin_telemetry.csv", "text/csv");
  }, []);

  const handleExportFit = useCallback(() => {
    const mainSamples = telemetryRef.current.samples();
    if (mainSamples.length > 0) {
      downloadFile(
        exportTelemetryFit(mainSamples, runStartedAtRef.current || Date.now()),
        `garmin-run-${exportStamp(runStartedAtRef.current)}.fit`,
        { mimeType: "application/octet-stream" }
      );
      return;
    }
    const samples = telemetryBufferRef.current.getSamples();
    if (samples.length === 0) return;
    const fit = exportTelemetryToFit(samples);
    downloadClientFile(fit, "garmin_telemetry.fit", "application/octet-stream");
  }, []);

  const handleClearTelemetry = useCallback(() => {
    telemetryBufferRef.current.clear();
    setTelemetrySamples([]);
  }, []);

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
      renderWatchFace(ctx, stateRef.current, groundStripRef.current);
    },
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outerContainerRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(outerContainerRef);
  const frameCountRef = useRef<number>(0);

  // Run telemetry: sampled beside the animation loop, never through React
  // state except the sample count shown in the panel.
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

  // Jump (UP)
  const handleJump = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing" || !current.isGrounded) return;
    triggerHaptic(20);
    playBeep(900, 0.03);
    applyTransition((state) => ({
      ...state,
      playerVy: JUMP_FORCE,
      isGrounded: false,
    }));
  }, [playBeep, applyTransition]);

  // Jettison Oldest Variable (DOWN)
  const handleJettison = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing") return;
    triggerHaptic(20);
    playBeep(650, 0.035);
    const result = jettisonOldestVariable(current);
    if (result.reason && !result.popped) {
      setAlertMessage(result.reason);
      return;
    }
    applyTransition((state) => jettisonOldestVariable(state).state);
  }, [playBeep, applyTransition]);

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

  // Force Garbage Collection (BACK)
  const handleForceGc = useCallback(() => {
    const current = stateRef.current;
    if (current.gameState !== "playing" || current.isGcActive) return;
    triggerHaptic(20);
    playBeep(450, 0.08);
    const result = garbageCollect({ state: current });
    if (result.success) {
      applyTransition(() => result.data.state);
    } else if (result.error?.message) {
      setAlertMessage(result.error.message);
    }
  }, [playBeep, applyTransition, garbageCollect]);

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
  }, [playBeep, applyTransition]);

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
    if (
      current.gameState === "idle" ||
      current.gameState === "crashed" ||
      current.gameState === "shutdown" ||
      current.gameState === "summary"
    ) {
      setRunStartBest(
        Math.max(current.highScore, parseInt(getHighScoreSnapshot(), 10) || 0)
      );
      setResultDismissed(false);
      telemetryRef.current.reset();
      setTelemetryCount(0);
      runStartedAtRef.current = Date.now();
      applyTransition((state) => startGame(state, deviceTarget, runTuning));
      recordEvent("garmin_simulator_start", "project_click").catch(() => {});
      playSuccess();
    } else if (current.gameState === "playing") {
      applyTransition((state) => pauseGame(state));
    } else if (current.gameState === "paused") {
      applyTransition((state) => resumeGame(state));
    }
  }, [
    deviceTarget,
    runTuning,
    playButtonTone,
    playSuccess,
    recordEvent,
    applyTransition,
  ]);

  // Quick Fog Wipe (W / Touch / Mouse)
  const handleWipeFog = useCallback(
    (canvasX = CANVAS_SIZE / 2, canvasY = CANVAS_SIZE / 2) => {
      playBeep(1100, 0.015);
      applyTransition((state) => wipeScreenFog(state, canvasX, canvasY, 35));
    },
    [playBeep, applyTransition]
  );

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
    applyTransition((state) => startGame(state, deviceTarget, runTuning));
    recordEvent("garmin_simulator_start", "project_click").catch(() => {});
    playSuccess();
    announce("New run started with your setup options.", "polite");
    // The wizard's focus trap restores focus to its trigger as it unmounts;
    // move focus to the watch after that has happened.
    window.setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [
    setupRunRevision,
    deviceTarget,
    runTuning,
    applyTransition,
    recordEvent,
    playSuccess,
    announce,
  ]);

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
      "Backspace",
    ];

    if (interceptKeys.includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      handleJump();
    } else if (e.key === "ArrowDown") {
      handleJettison();
    } else if (e.key.toLowerCase() === "l") {
      handleToggleLight();
    } else if (e.key.toLowerCase() === "w") {
      handleWipeFog();
    } else if (e.key === "Backspace" || e.key.toLowerCase() === "g") {
      handleForceGc();
    } else if (e.key === "Enter" || e.key === " ") {
      handleStartStop();
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
  const a11yLight = () => {
    handleToggleLight();
    announce(
      stateRef.current.isLightOn ? "Backlight on." : "Backlight off.",
      "polite"
    );
  };
  const a11yReadTelemetry = () => {
    const s = stateRef.current;
    announce(
      `Status: ${s.gameState}. Memory: ${s.allocatedRamKb.toFixed(1)} of ${currentProfile.ramLimitKb} KB. Flash: ${s.allocatedFlashKb.toFixed(1)} KB. Battery: ${Math.round(s.battery)}%. Thermal stress: ${Math.round((s.thermalStress ?? 0) * 100)}%. Condensation: ${Math.round(s.fogLevel * 100)}%. Score: ${s.score}. High score: ${Math.max(s.highScore, loadedHighScore)}.`,
      "polite"
    );
  };

  // Screen Reader Critical Alert Vocalizations Effect
  useEffect(() => {
    const ramLimit = DEVICE_PROFILES[deviceTarget].ramLimitKb;
    const ramUsage = gameState.allocatedRamKb;
    const isHighMemory = ramUsage / ramLimit > 0.85;

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
      const msg = `System crash: ${errorType}. ${gameState.crashReport?.file ? "File: " + gameState.crashReport.file : ""}`;
      setAlertMessage(msg);
      announce(msg, "assertive");
      triggerHaptic([50, 50, 50]);
    } else if (gameState.gameState !== "crashed") {
      hasAlertedCrashRef.current = false;
    }

    // 4. Low battery (<15%), once per crossing
    if (
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
  }, [gameState, deviceTarget, announce]);

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
        // On milestone status transition, sync the throttled React UI
        // immediately. Otherwise, sync low-frequency React UI throttled to
        // 10 FPS (every 6 frames).
        const nextState = applyTransition(
          (state) => updateGameSimulation(state, deltaMs),
          (next) => {
            if (next.gameState !== prevStatus) return true;
            frameCountRef.current++;
            return frameCountRef.current % 6 === 0;
          }
        );

        const recorder = telemetryRef.current;
        const sampled = recorder.advance(nextState, deltaMs);
        const closed =
          nextState.gameState !== "playing" && recorder.finish(nextState);
        if (sampled || closed) setTelemetryCount(recorder.count);

        telemetryBufferRef.current.recordSample(nextState);
        if (frameCountRef.current % 10 === 0) {
          setTelemetrySamples(telemetryBufferRef.current.getSamples());
        }

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
      }

      // Render Canvas Frame directly from mutable ref
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const scale = canvasScaleRef.current;
          applyCanvasScale(ctx, scale);
          renderWatchFace(ctx, stateRef.current, groundStripRef.current);
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
    else handleForceGc();
    containerRef.current?.focus({ preventScroll: true });
  };

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
      title: "Jump (ArrowUp / UP)",
    },
    {
      id: "down",
      label: "DOWN",
      hint: "[▼] POP",
      title: "Jettison Variable (ArrowDown / DOWN)",
    },
    {
      id: "start",
      label: startAction.toUpperCase(),
      hint: "[ENTER]",
      title: `${startAction} (Enter / Space)`,
      ariaLabel: `${startAction} (Enter / Space)`,
    },
    {
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
  const endTitle =
    gameState.gameState === "shutdown"
      ? "BROWNOUT SHUTDOWN"
      : gameState.gameState === "crashed"
        ? (CRASH_LABELS[crashType]?.title ?? "APP CRASHED")
        : "RUN COMPLETE";
  const endMessage =
    gameState.gameState === "shutdown"
      ? `${CRASH_LABELS["Power Loss"].hint} Power loss score penalty applied (-50 PTS).`
      : gameState.gameState === "crashed"
        ? (CRASH_LABELS[crashType]?.hint ?? "Reboot and try again.")
        : "The activity is saved to the watch.";
  const report = gameState.crashReport;
  const endStats: Array<{ label: string; value: number; suffix?: string }> = [
    { label: "Score", value: gameState.score },
    {
      label: "Metres",
      value: Math.round(gameState.distanceMeters),
    },
  ];
  if (gameState.gameState === "shutdown") {
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

  const rebootFromCard = () => {
    handleStartStop();
    window.setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <div
      ref={outerContainerRef}
      data-game-fullscreen={isFullscreen}
      className={`garmin-sim w-full select-none @container ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] max-w-none overflow-y-auto overflow-x-hidden bg-black p-3 sm:p-6 touch-none"
          : "px-3 py-5 sm:px-4"
      }`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="mx-auto mb-3 w-full max-w-md" />

      <div className="mx-auto grid w-full max-w-6xl gap-5 @3xl:grid-cols-[minmax(0,1fr)_18rem] @5xl:grid-cols-[minmax(0,1fr)_21rem] @3xl:items-start">
        <div className="flex min-w-0 flex-col items-center">
          {/* Watch: keyboard boundary around the hardware render. */}
          <div
            ref={containerRef}
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            data-keyboard-boundary="true"
            className="garmin-chassis relative w-full px-12 outline-none select-none"
          >
            <div
              ref={fxStageRef}
              className="garmin-watch-frame relative mx-auto aspect-[520/580]"
            >
              <WatchHardware
                theme={bezelTheme}
                model={currentProfile.name}
                focused={isFocused}
              />

              {/* Round screen: the canvas fills it at device resolution. */}
              <div
                data-testid="garmin-screen"
                className="absolute isolate overflow-hidden rounded-full bg-black"
                style={{
                  left: `${SCREEN_BOX.left}%`,
                  top: `${SCREEN_BOX.top}%`,
                  width: `${SCREEN_BOX.width}%`,
                  height: `${SCREEN_BOX.height}%`,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  role="img"
                  aria-label={`Smartwatch display simulator. Status: ${gameState.gameState}. Score: ${
                    gameState.score
                  }, High Score: ${effectiveHighScore}. Memory: ${gameState.allocatedRamKb.toFixed(
                    1
                  )} of ${currentProfile.ramLimitKb} KB. Battery: ${Math.round(
                    gameState.battery
                  )}%. Condensation: ${Math.round(gameState.fogLevel * 100)}%.`}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerCancel={handleCanvasPointerCancel}
                  className="block h-full w-full cursor-crosshair touch-none rounded-full"
                />

                {/* Event flash for crashes (useArcadeFx). */}
                <div
                  ref={fxFlashRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 rounded-full opacity-0"
                />

                {/* CRT filter chosen in Pre-Game Setup (static, never animated) */}
                {setupCrt !== "off" && (
                  <div
                    aria-hidden="true"
                    data-testid="garmin-crt-overlay"
                    data-garmin-crt={setupCrt}
                    className="garmin-crt pointer-events-none absolute inset-0 z-20 rounded-full"
                  />
                )}

                {/* Idle start card. The canvas draws no text while idle, so
                    nothing shows through behind it. */}
                {gameState.gameState === "idle" && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/65 px-[14%] text-center font-mono">
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                      Monkey C Runner
                    </span>
                    <span className="mt-1 text-[11px] font-bold text-amber-300">
                      LIMIT: {currentProfile.ramLimitKb} KB RAM
                    </span>
                    <p className="mt-2 max-w-[15rem] text-[11px] leading-snug text-zinc-300">
                      Survive memory allocations, jump over bugs, pop variables
                      &amp; trigger GC!
                    </p>
                    <button
                      type="button"
                      onClick={handleStartStop}
                      className="arcade-launch-button mt-3 flex min-h-[36px] items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-400 px-4 text-[11px] font-bold text-zinc-950 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <IconPlayerPlay
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      START SIMULATION
                    </button>
                  </div>
                )}

                {/* Overheat fog quick wipe */}
                {gameState.fogLevel > 0.35 &&
                  gameState.gameState === "playing" && (
                    <button
                      type="button"
                      onClick={() => handleWipeFog()}
                      className="absolute right-[20%] top-[24%] z-30 rounded-full border border-amber-300 bg-amber-500 px-2.5 py-1 font-mono text-[10px] font-bold text-black active:scale-[0.98]"
                    >
                      WIPE [W]
                    </button>
                  )}
              </div>

              <WatchGlass />

              {/* Pushers: real buttons over the drawn ones, captioned outward. */}
              {pushers.map((pusher) => {
                const anchor = pusherAnchorPercent(pusher.id);
                const left = anchor.side === "left";
                return (
                  <button
                    key={pusher.id}
                    type="button"
                    onClick={(e) => handlePusherClick(pusher.id, e)}
                    title={pusher.title}
                    aria-label={pusher.ariaLabel}
                    data-pusher={pusher.id}
                    className={`group absolute flex -translate-y-1/2 items-center gap-1.5 rounded-md font-mono leading-none active:scale-[0.98] focus-visible:outline-none ${
                      left ? "flex-row-reverse" : ""
                    }`}
                    style={
                      left
                        ? {
                            right: `calc(${100 - anchor.x}% - 14px)`,
                            top: `${anchor.y}%`,
                          }
                        : {
                            left: `calc(${anchor.x}% - 14px)`,
                            top: `${anchor.y}%`,
                          }
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="block h-7 w-7 rounded-md transition-colors group-hover:bg-white/10 group-focus-visible:ring-2 group-focus-visible:ring-cyan-300/80"
                    />
                    <span
                      className={`flex flex-col gap-0.5 ${left ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] font-bold tracking-wider text-zinc-300 group-hover:text-zinc-50">
                        {pusher.label}
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {pusher.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Touch devices get the bezel pushers as a dock as well. */}
          <div className="mt-4 hidden w-full max-w-xl justify-center [@media(hover:none)]:flex">
            <BezelClusterDock
              onButtonPress={(btn) => {
                if (btn === "light") handleToggleLight();
                else if (btn === "up") handleJump();
                else if (btn === "down") handleJettison();
                else if (btn === "start") handleStartStop();
                else if (btn === "back") handleForceGc();
              }}
            />
          </div>
        </div>

        <CompanionPanel
          state={gameState}
          deviceTarget={deviceTarget}
          bezelTheme={bezelTheme}
          highScore={effectiveHighScore}
          isFocused={isFocused}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSelectDevice={(target, e) => {
            handleSelectDevice(target);
            returnFocusAfterPointerClick(e);
          }}
          onSelectTheme={(theme, e) => {
            setBezelTheme(theme);
            returnFocusAfterPointerClick(e);
          }}
          onWriteFlash={(e) => {
            handleSaveFlash();
            returnFocusAfterPointerClick(e);
          }}
          onClearFlash={(e) => {
            handleClearFlash();
            returnFocusAfterPointerClick(e);
          }}
          telemetryCount={telemetryCount}
          onExportCsv={handleExportCsv}
          onExportFit={handleExportFit}
          groundStrip={groundStrip}
          onGroundStripSlot={handleGroundStripSlot}
          onGroundStripReset={handleGroundStripReset}
          onDrainBattery={(e) => {
            handleDrainBattery();
            returnFocusAfterPointerClick(e);
          }}
          telemetrySamples={telemetrySamples}
          onClearTelemetry={handleClearTelemetry}
          widgetLayout={widgetLayout}
          onUpdateLayoutSlot={handleUpdateLayoutSlot}
          onResetLayout={handleResetLayout}
        >
          {runEnded && !resultDismissed && (
            <ResultCard
              key={`${gameState.gameState}-${crashType}`}
              title={endTitle}
              stamp={
                gameState.gameState === "shutdown"
                  ? "Power loss"
                  : gameState.gameState === "crashed"
                    ? "Crashed"
                    : "Saved"
              }
              verdict={gameState.gameState === "summary" ? "win" : "loss"}
              message={endMessage}
              stats={endStats}
              score={gameState.score}
              previousBest={runStartBest}
              primary={{
                label: "Reboot & Restart",
                icon: <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />,
                onClick: rebootFromCard,
              }}
              secondary={{
                label: "Inspect watch",
                onClick: () => {
                  setResultDismissed(true);
                  containerRef.current?.focus({ preventScroll: true });
                },
              }}
            >
              <p className="mt-4 text-[11px] text-zinc-400">
                Shipping a real Connect IQ app?{" "}
                <a
                  href="/schedule"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    recordEvent("garmin_simulator", "project_click")
                  }
                  className="text-zinc-300 underline underline-offset-2 hover:text-zinc-50"
                >
                  Book Consultation
                </a>
              </p>
            </ResultCard>
          )}
        </CompanionPanel>
      </div>
      {/* Off-screen Accessible DOM Fallback Subtree */}
      <div className="sr-only" aria-label="Garmin Watch Accessible Subtree">
        <fieldset>
          <legend>
            Garmin Watch Embedded Simulator State and Physical Controls
          </legend>

          <div role="group" aria-label="Garmin Simulator Telemetry and Status">
            <output aria-live="off" htmlFor="garmin-state">
              State: {gameState.gameState}
            </output>
            <output aria-live="off" htmlFor="garmin-score">
              Score: {gameState.score}
            </output>
            <output aria-live="off" htmlFor="garmin-highscore">
              High Score: {effectiveHighScore}
            </output>
            <output aria-live="off" htmlFor="garmin-device">
              Device Target: {currentProfile.name}
            </output>
            <output aria-live="off" htmlFor="garmin-ram">
              RAM Memory: {gameState.allocatedRamKb.toFixed(1)} /{" "}
              {currentProfile.ramLimitKb} KB
            </output>
            <output aria-live="off" htmlFor="garmin-battery">
              Battery Level: {Math.round(gameState.battery)}%
            </output>
            <output aria-live="off" htmlFor="garmin-thermal">
              Thermal Stress: {Math.round((gameState.thermalStress ?? 0) * 100)}
              %
            </output>
            <output aria-live="off" htmlFor="garmin-fog">
              Condensation Fog: {Math.round(gameState.fogLevel * 100)}%
            </output>
          </div>

          <div role="group" aria-label="Garmin Watch Physical Controls">
            <button type="button" onClick={a11yLight}>
              LIGHT / Backlight Button
            </button>

            <button
              type="button"
              onClick={a11yJump}
              disabled={gameState.gameState !== "playing"}
            >
              UP / Jump Button
            </button>

            <button
              type="button"
              onClick={a11yJettison}
              disabled={gameState.gameState !== "playing"}
            >
              DOWN / Jettison Variable Button
            </button>

            <button type="button" onClick={a11yStartStop}>
              START / STOP Button
            </button>

            <button
              type="button"
              onClick={a11yBack}
              disabled={
                gameState.gameState !== "playing" || gameState.isGcActive
              }
            >
              BACK / Force GC Button
            </button>

            <button type="button" onClick={a11yReadTelemetry}>
              Read Telemetry
            </button>

            <button
              type="button"
              onClick={() => {
                handleWipeFog();
                announce("Wiped screen condensation fog.", "polite");
              }}
            >
              Wipe Screen Fog
            </button>

            <button
              type="button"
              onClick={() => {
                handleSaveFlash();
                announce("Saved variable to NVRAM flash storage.", "polite");
              }}
            >
              Save NVRAM Flash
            </button>

            <button
              type="button"
              onClick={() => {
                handleClearFlash();
                announce("Cleared NVRAM flash storage.", "polite");
              }}
            >
              Clear NVRAM Flash
            </button>

            <button
              type="button"
              onClick={() => {
                handleSelectDevice("forerunner");
                announce("Switched profile to Forerunner.", "polite");
              }}
              aria-pressed={deviceTarget === "forerunner"}
            >
              Profile: Forerunner
            </button>

            <button
              type="button"
              onClick={() => {
                handleSelectDevice("fenix");
                announce("Switched profile to Fenix.", "polite");
              }}
              aria-pressed={deviceTarget === "fenix"}
            >
              Profile: Fenix
            </button>

            <button
              type="button"
              onClick={() => {
                handleSelectDevice("edge");
                announce("Switched profile to Edge.", "polite");
              }}
              aria-pressed={deviceTarget === "edge"}
            >
              Profile: Edge
            </button>
          </div>
        </fieldset>
      </div>

      {/* Off-screen Live Regions for Screen Reader Telemetry & Assertive Alerts */}
      {/* Polite status changes only on run transitions; changing telemetry is
          read on demand via the Read Telemetry button (#1215). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Garmin Simulator Telemetry. Status: ${gameState.gameState}.`}
      </div>

      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {alertMessage}
      </div>
    </div>
  );
};
