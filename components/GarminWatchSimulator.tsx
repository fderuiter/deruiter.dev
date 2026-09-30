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
  IconCircle,
  IconBolt,
  IconCpu,
  IconFlame,
  IconPlayerPlay,
  IconCalendar,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
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
  renderCanvasFrame,
  JUMP_FORCE,
  CANVAS_SIZE,
  GameEngineState,
  CrashReport,
  allocateFlashVariable,
  clearFlashStorage,
} from "@/lib/garmin-engine";

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

type WatchBezelTheme = "slate" | "solar" | "cyan" | "neon";

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
      renderCanvasFrame(ctx, stateRef.current);
    },
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outerContainerRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(outerContainerRef);
  const frameCountRef = useRef<number>(0);

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
          renderCanvasFrame(ctx, stateRef.current);
        }
      }
    },
    { isActive: !isContextLost, maxDeltaMs: 40 }
  );

  // Theme styling helpers
  const getThemeChassis = () => {
    switch (bezelTheme) {
      case "solar":
        return "from-amber-900 via-zinc-900 to-zinc-950 border-amber-600/50";
      case "cyan":
        return "from-cyan-900 via-zinc-900 to-zinc-950 border-cyan-500/50";
      case "neon":
        return "from-lime-900 via-zinc-900 to-zinc-950 border-lime-500/50";
      default:
        return "from-zinc-800 via-zinc-900 to-zinc-950 border-zinc-700";
    }
  };

  const currentProfile = DEVICE_PROFILES[deviceTarget];
  const gcFreezeMs = gameState.tuning?.gcFreezeMs ?? runTuning.gcFreezeMs;

  // Screen shake fires on discrete impacts only (crash, and GC on High) and
  // never when the player prefers reduced motion.
  const shakeLevel = prefersReducedMotion ? "none" : setupShake;
  const shakeEvent =
    gameState.gameState === "crashed" || gameState.gameState === "shutdown"
      ? "crash"
      : gameState.isGcActive
        ? "gc"
        : "none";

  // What the START button does right now, shown on the bezel (#1216).
  const startAction =
    gameState.gameState === "playing"
      ? "Pause"
      : gameState.gameState === "paused"
        ? "Resume"
        : gameState.gameState === "idle"
          ? "Start"
          : "Restart";

  return (
    <div
      ref={outerContainerRef}
      className={`w-full select-none ${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-black p-2 sm:p-6 overflow-hidden flex flex-col items-center justify-between touch-none"
          : "flex flex-col items-center my-8"
      }`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full max-w-md mb-3" />

      {/* Keyboard Capture Status Banner & Controls Bar */}
      <div className="mb-4 text-center flex flex-wrap items-center justify-center gap-3">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border transition-all duration-300 ${
            isFocused
              ? "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 shadow-[0_0_10px_rgba(34,211,238,0.15)] animate-pulse"
              : "bg-zinc-950 text-zinc-500 border-zinc-800"
          }`}
        >
          <IconCircle
            className={`w-2.5 h-2.5 ${
              isFocused
                ? "fill-brand-cyan stroke-none"
                : "fill-zinc-600 stroke-none"
            }`}
          />
          {isFocused
            ? "Watch Keyboard Captures: ACTIVE"
            : "Click Watch to Focus Controls"}
        </span>

        {/* Device Profile Target (Memory Limit) Selector */}
        <div className="flex items-center gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-full text-[9px] font-mono">
          <button
            onClick={(e) => {
              handleSelectDevice("fenix");
              returnFocusAfterPointerClick(e);
            }}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
              deviceTarget === "fenix"
                ? "bg-rose-600 text-white font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Fēnix (32KB)
          </button>
          <button
            onClick={(e) => {
              handleSelectDevice("forerunner");
              returnFocusAfterPointerClick(e);
            }}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
              deviceTarget === "forerunner"
                ? "bg-amber-600 text-black font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Forerunner (64KB)
          </button>
          <button
            onClick={(e) => {
              handleSelectDevice("edge");
              returnFocusAfterPointerClick(e);
            }}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
              deviceTarget === "edge"
                ? "bg-emerald-600 text-white font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Edge (128KB)
          </button>
        </div>

        {/* Bezel Theme Switcher & Field Manual */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-full text-[9px] font-mono">
            <button
              onClick={(e) => {
                setBezelTheme("slate");
                returnFocusAfterPointerClick(e);
              }}
              className={`px-2 py-0.5 rounded-full cursor-pointer ${
                bezelTheme === "slate"
                  ? "bg-zinc-700 text-white font-bold"
                  : "text-zinc-400"
              }`}
            >
              Tactix
            </button>
            <button
              onClick={(e) => {
                setBezelTheme("solar");
                returnFocusAfterPointerClick(e);
              }}
              className={`px-2 py-0.5 rounded-full cursor-pointer ${
                bezelTheme === "solar"
                  ? "bg-amber-600 text-black font-bold"
                  : "text-zinc-400"
              }`}
            >
              Solar
            </button>
            <button
              onClick={(e) => {
                setBezelTheme("cyan");
                returnFocusAfterPointerClick(e);
              }}
              className={`px-2 py-0.5 rounded-full cursor-pointer ${
                bezelTheme === "cyan"
                  ? "bg-cyan-500 text-black font-bold"
                  : "text-zinc-400"
              }`}
            >
              Cyan
            </button>
          </div>

          <FieldManualButton manualId="garmin-watch" label="Manual" />
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            variant="header"
          />
        </div>
      </div>

      {/* Outer Watch Chassis */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        data-keyboard-boundary="true"
        data-garmin-shake={shakeLevel}
        data-garmin-shake-event={shakeEvent}
        className={`garmin-chassis relative w-full ${
          // Grow with the screen in fullscreen, whether the game or its
          // hosting cabinet owns it (#1318).
          isFullscreen
            ? "max-w-[max(336px,min(90vw,calc(100dvh-22rem),640px))]"
            : "max-w-[336px] [[data-fullscreen=true]_&]:max-w-[max(336px,min(90vw,calc(100dvh-22rem),640px))]"
        } aspect-square h-auto rounded-full bg-gradient-to-br p-6 flex items-center justify-center border-4 select-none outline-none transition-all duration-300 ${getThemeChassis()} ${
          isFocused
            ? "ring-4 ring-brand-cyan/20 shadow-[0_0_40px_rgba(34,211,238,0.25)] scale-[1.01]"
            : "shadow-2xl"
        }`}
      >
        {/* Physical Bezel Buttons */}
        {/* 1. LIGHT BUTTON (Top Left) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            handleToggleLight();
            containerRef.current?.focus({ preventScroll: true });
          }}
          title="Backlight (L): +0.3%/s Battery"
          className="absolute -left-3.5 top-[24%] px-2 py-1.5 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-amber-500 hover:to-amber-600 text-[8px] font-bold text-zinc-300 hover:text-black rounded-l-md border-y border-l border-zinc-600 active:scale-95 transition-all shadow-md cursor-pointer flex flex-col items-center"
        >
          <span>LIGHT</span>
          <span className="text-[6px] text-amber-300/80">[L]</span>
        </button>

        {/* 2. UP BUTTON (Middle Left) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            handleJump();
            containerRef.current?.focus({ preventScroll: true });
          }}
          title="Jump (ArrowUp / UP)"
          className="absolute -left-3.5 top-[46%] px-2.5 py-1.5 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-brand-cyan hover:to-brand-cyan/80 text-[8px] font-bold text-zinc-300 hover:text-black rounded-l-md border-y border-l border-zinc-600 active:scale-95 transition-all shadow-md cursor-pointer flex flex-col items-center"
        >
          <span>UP</span>
          <span className="text-[6px] text-cyan-300/80">[▲]</span>
        </button>

        {/* 3. DOWN BUTTON (Bottom Left) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            handleJettison();
            containerRef.current?.focus({ preventScroll: true });
          }}
          title="Jettison Variable (ArrowDown / DOWN)"
          className="absolute -left-3.5 top-[68%] px-2 py-1.5 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-rose-500 hover:to-rose-600 text-[8px] font-bold text-zinc-300 hover:text-black rounded-l-md border-y border-l border-zinc-600 active:scale-95 transition-all shadow-md cursor-pointer flex flex-col items-center"
        >
          <span>DOWN</span>
          <span className="text-[6px] text-rose-300/80">[▼] POP</span>
        </button>

        {/* 4. START/STOP BUTTON (Top Right) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            handleStartStop();
            containerRef.current?.focus({ preventScroll: true });
          }}
          title={`${startAction} (Enter / Space)`}
          aria-label={`${startAction} (Enter / Space)`}
          className="absolute -right-3.5 top-[30%] px-2.5 py-1.5 bg-gradient-to-l from-zinc-700 to-zinc-800 hover:from-emerald-500 hover:to-emerald-600 text-[8px] font-bold text-zinc-300 hover:text-black rounded-r-md border-y border-r border-zinc-600 active:scale-95 transition-all shadow-md cursor-pointer flex flex-col items-center"
        >
          <span>{startAction.toUpperCase()}</span>
          <span className="text-[6px] text-emerald-300/80">[ENTER]</span>
        </button>

        {/* 5. BACK/GC BUTTON (Bottom Right) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            handleForceGc();
            containerRef.current?.focus({ preventScroll: true });
          }}
          title={`Force Garbage Collection (G / Backspace): ${gcFreezeMs}ms Freeze`}
          className="absolute -right-3.5 top-[62%] px-2.5 py-1.5 bg-gradient-to-l from-zinc-700 to-zinc-800 hover:from-purple-500 hover:to-purple-600 text-[8px] font-bold text-zinc-300 hover:text-black rounded-r-md border-y border-r border-zinc-600 active:scale-95 transition-all shadow-md cursor-pointer flex flex-col items-center"
        >
          <span>BACK</span>
          <span className="text-[6px] text-purple-300/80">[G]</span>
        </button>

        {/* Outer Circular Bezel Dial with Compass / Memory Markers */}
        <div className="absolute inset-2 rounded-full border border-zinc-750/50 pointer-events-none flex items-center justify-center">
          <div className="w-full h-full rounded-full relative">
            <div className="absolute top-1 left-[50%] -translate-x-[50%] text-[8px] font-bold tracking-widest text-zinc-500">
              CIQ · {currentProfile.ramLimitKb}KB
            </div>
            <div className="absolute bottom-1 left-[50%] -translate-x-[50%] text-[8px] font-bold tracking-widest text-zinc-500">
              HEAP · 0x00
            </div>
            <div className="absolute left-2 top-[50%] -translate-y-[50%] text-[8px] font-bold tracking-widest text-zinc-500">
              GC
            </div>
            <div className="absolute right-2 top-[50%] -translate-y-[50%] text-[8px] font-bold tracking-widest text-zinc-500">
              RUN
            </div>
          </div>
        </div>

        {/* Watch Inner Circular 280x280 Screen Display */}
        <div
          className={`relative w-full ${
            isFullscreen
              ? "max-w-none"
              : "max-w-[280px] [[data-fullscreen=true]_&]:max-w-none"
          } aspect-square h-auto rounded-full overflow-hidden border-2 border-zinc-800 bg-black shadow-[inset_0_0_20px_rgba(0,0,0,0.9)] flex items-center justify-center`}
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
            className="w-full h-full aspect-square rounded-full cursor-crosshair touch-none"
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

          {/* Idle Menu Overlay */}
          {gameState.gameState === "idle" && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center z-30 font-mono">
              <span className="text-[12px] font-extrabold text-brand-cyan tracking-wider uppercase flex items-center gap-1">
                <IconCpu className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
                MONKEY C RUNNER
              </span>
              <span className="text-[9px] text-rose-400 font-bold mt-1">
                LIMIT: {currentProfile.ramLimitKb} KB RAM
              </span>
              <p className="text-[8px] text-zinc-400 mt-2 max-w-[190px] leading-tight">
                Survive memory allocations, jump over bugs, pop variables &amp;
                trigger GC!
              </p>
              <button
                onClick={handleStartStop}
                className="mt-3 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] rounded-full flex items-center gap-1 shadow-lg cursor-pointer transition-all active:scale-95"
              >
                <IconPlayerPlay className="w-3 h-3" />
                START SIMULATION
              </button>
            </div>
          )}

          {/* Game Over / Power Loss Shutdown / Completion Overlay.
              Opaque: the canvas draws its own crash and shutdown screens
              underneath, and a translucent card showed both titles (#1557). */}
          {(gameState.gameState === "crashed" ||
            gameState.gameState === "shutdown" ||
            gameState.gameState === "summary") && (
            <div
              data-testid="garmin-end-overlay"
              className="absolute inset-0 rounded-full bg-black flex flex-col items-center justify-center p-3 text-center z-30 font-mono space-y-1.5"
            >
              <span className="text-[11px] font-extrabold text-rose-400 tracking-wider uppercase">
                {gameState.gameState === "shutdown"
                  ? "⚡ BROWNOUT SHUTDOWN"
                  : gameState.gameState === "crashed"
                    ? (CRASH_LABELS[
                        gameState.crashReport?.errorType ?? "Out Of Memory"
                      ]?.title ?? "APP CRASHED")
                    : "RUN COMPLETE"}
              </span>
              {gameState.gameState === "crashed" && (
                <div className="text-[8px] text-zinc-300 max-w-[180px] leading-tight">
                  {CRASH_LABELS[
                    gameState.crashReport?.errorType ?? "Out Of Memory"
                  ]?.hint ?? "Reboot and try again."}
                </div>
              )}
              <div className="text-[10px] text-zinc-300">
                SCORE:{" "}
                <strong className="text-amber-400">{gameState.score}</strong>
              </div>
              {gameState.gameState === "shutdown" && (
                <div className="text-[8px] text-rose-300 max-w-[180px] leading-tight">
                  Power loss score penalty applied (-50 PTS)
                </div>
              )}
              <button
                onClick={handleStartStop}
                className="mt-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[9px] rounded-full flex items-center gap-1 shadow-lg cursor-pointer transition-all active:scale-95"
              >
                <IconPlayerPlay className="w-3 h-3" />
                <span>Reboot &amp; Restart</span>
              </button>
              <a
                href="/schedule"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordEvent("garmin_simulator", "project_click")}
                className="px-2.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[8px] rounded-full flex items-center gap-1 shadow cursor-pointer transition-all active:scale-95"
              >
                <IconCalendar className="w-2.5 h-2.5" />
                <span>Book Consultation</span>
              </a>
            </div>
          )}

          {/* Overheat Fog Quick Wipe Floating Badge */}
          {gameState.fogLevel > 0.35 && gameState.gameState === "playing" && (
            <button
              onClick={() => handleWipeFog()}
              className="absolute top-16 right-12 z-30 px-2 py-0.5 bg-amber-500/90 text-black font-bold text-[8px] font-mono rounded-full border border-amber-300 shadow-md animate-bounce cursor-pointer"
            >
              WIPE [W]
            </button>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Smartwatch Hardware Bezel Pushbuttons */}
      <div className="w-full max-w-xl mt-4 flex justify-center">
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

      {/* Real-time Engineering Telemetry & Controls Dashboard Below Watch */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-zinc-400 max-w-xl text-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <IconCpu className="w-3.5 h-3.5 text-brand-cyan" />
          <span>
            RAM:{" "}
            <strong className="text-white">
              {gameState.allocatedRamKb.toFixed(1)} /{" "}
              {currentProfile.ramLimitKb} KB
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <IconCpu className="w-3.5 h-3.5 text-amber-500" />
          <span>
            FLASH:{" "}
            <strong className="text-white">
              {gameState.allocatedFlashKb.toFixed(1)} /{" "}
              {currentProfile.flashLimitKb} KB
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <IconBolt
            className={`w-3.5 h-3.5 ${gameState.battery < 15 ? "text-rose-500 animate-pulse" : "text-amber-400"}`}
          />
          <span>
            BATTERY:{" "}
            <strong className="text-white">
              {Math.round(gameState.battery)}%
            </strong>
          </span>
          {gameState.battery < 15 && gameState.battery > 0 && (
            <span className="ml-1 text-[9px] text-rose-400 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800 animate-pulse">
              LOW POWER
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <IconFlame
            className={`w-3.5 h-3.5 ${gameState.thermalStress > 0.4 ? "text-orange-500 animate-pulse" : "text-zinc-500"}`}
          />
          <span>
            THERMAL:{" "}
            <strong className="text-white">
              {Math.round((gameState.thermalStress ?? 0) * 100)}%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <IconFlame
            className={`w-3.5 h-3.5 ${gameState.fogLevel > 0.4 ? "text-rose-500 animate-pulse" : "text-zinc-500"}`}
          />
          <span>
            CONDENSATION:{" "}
            <strong className="text-white">
              {Math.round(gameState.fogLevel * 100)}%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <span className="text-amber-400 font-bold">🏆 HI-SCORE:</span>
          <strong className="text-amber-300">{effectiveHighScore}</strong>
        </div>
      </div>

      {/* NV Flash & Power Simulation Action Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
        <button
          onClick={(e) => {
            handleSaveFlash();
            returnFocusAfterPointerClick(e);
          }}
          className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded shadow cursor-pointer transition-all active:scale-95"
        >
          💾 Write NV Flash (+8KB)
        </button>
        <button
          onClick={(e) => {
            handleClearFlash();
            returnFocusAfterPointerClick(e);
          }}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded shadow cursor-pointer transition-all active:scale-95"
        >
          🗑️ Clear Flash Storage
        </button>
        <button
          onClick={(e) => {
            handleDrainBattery();
            returnFocusAfterPointerClick(e);
          }}
          disabled={gameState.gameState !== "playing"}
          title={
            gameState.gameState === "playing"
              ? undefined
              : "Start a run first: each run begins on a full battery"
          }
          className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 rounded shadow cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          ⚡ Drain Battery (-20%)
        </button>
      </div>

      {/* Control Quick Reference Guide */}
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] font-mono text-zinc-500">
        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          <strong className="text-zinc-300">UP / ▲:</strong> Jump
        </span>
        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          <strong className="text-zinc-300">DOWN / ▼:</strong> Pop Heap Variable
        </span>
        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          <strong className="text-zinc-300">BACK / [G]:</strong> Trigger Garbage
          Collector
        </span>
        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          <strong className="text-zinc-300">LIGHT / [L]:</strong> Backlight
          (Burns Bat)
        </span>
        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          <strong className="text-zinc-300">SWIPE / [W]:</strong> Wipe Screen
          Fog
        </span>
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
