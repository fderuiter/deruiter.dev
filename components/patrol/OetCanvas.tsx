"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
  useMemo,
} from "react";
import type {
  PatrolScenario,
  PatrolEvent,
  BriefingState,
  OetDescentSnapshot,
} from "@/lib/patrol";
import { OetDescentEngine } from "@/lib/patrol";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  IconGauge,
  IconRoute,
  IconCheck,
  IconChevronRight,
  IconAlertTriangle,
  IconAnchor,
  IconPlayerPlay,
  IconPlayerPause,
  IconArrowLeft,
  IconArrowRight,
  IconArrowDown,
  IconHandStop,
  IconShieldCheck,
  IconSparkles,
  IconRotateClockwise,
} from "@tabler/icons-react";

/**
 * Props for the OetCanvas component.
 */
export interface OetCanvasProps {
  /** The active patrol scenario. */
  scenario: PatrolScenario | null;
  /** Optional condition modifiers from the briefing screen or scenario environment. */
  briefingState?: BriefingState;
  /** Callback triggered when the toboggan safely reaches the base aid room. */
  onArriveAtBase: () => void;
  /** Optional callback to record metric snapshots into the patrol shift event history. */
  onRecordEvent?: (event: PatrolEvent) => void;
  /** Optional custom engine instance for dependency injection or testing. */
  engine?: OetDescentEngine;
}

/**
 * Interactive 2D Canvas OET Toboggan Transport Mini-Game component.
 *
 * Simulates a Cascade 100 rescue toboggan descent down the fall line, featuring
 * handling physics, chain-brake deployment, edge control, HTML/CSS HUD overlay,
 * dual desktop/touch controls (ADR 0019), and a step-through accessibility fallback.
 */
export const OetCanvas: React.FC<OetCanvasProps> = ({
  scenario,
  briefingState: customBriefingState,
  onArriveAtBase,
  onRecordEvent,
  engine: customEngine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasRecordedEventRef = useRef<boolean>(false);
  const { announce } = useAnnouncer();

  // Step-Through accessibility mode toggle
  const [isStepThroughMode, setIsStepThroughMode] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Derive condition modifiers from briefing state or scenario environment
  const effectiveBriefingState = useMemo<BriefingState>(() => {
    if (customBriefingState) return customBriefingState;
    const env = scenario?.environment;
    const snowCondition = env?.snowConditions?.toLowerCase() ?? "hardpack";
    // Checks actual hazard content (not a location display string, which is
    // free-text flavor and shouldn't drive physics) for wooded/narrow terrain.
    const isTreedTerrain =
      env?.hazards?.some((hazard) => hazard.toLowerCase().includes("tree")) ??
      false;
    return {
      snowCondition,
      narrowTrails: isTreedTerrain || false,
      treeHazards: isTreedTerrain || false,
      temperatureFahrenheit: env?.temperatureFahrenheit ?? 18,
      visibility: env?.visibility ?? "clear",
    };
  }, [customBriefingState, scenario]);

  // Maintain stable engine instance
  const defaultEngine = useMemo(() => {
    return new OetDescentEngine({
      conditions: effectiveBriefingState,
      totalDistance: 1500,
    });
  }, [effectiveBriefingState]);

  const activeEngine = customEngine ?? defaultEngine;

  // Subscribe to engine state mutations via useSyncExternalStore (React 19)
  const subscribe = useCallback(
    (callback: () => void) => activeEngine.subscribe(callback),
    [activeEngine]
  );
  const snapshot: OetDescentSnapshot = useSyncExternalStore(
    subscribe,
    () => activeEngine.getSnapshot(),
    () => activeEngine.getSnapshot()
  );

  // Guaranteed arrive-at-base action ensuring metrics event is recorded
  const handleArriveAtBase = useCallback(() => {
    if (!hasRecordedEventRef.current) {
      hasRecordedEventRef.current = true;
      const event = activeEngine.createPatrolEventSnapshot(scenario?.id);
      onRecordEvent?.(event);
    }
    onArriveAtBase();
  }, [activeEngine, onArriveAtBase, onRecordEvent, scenario?.id]);

  // Record metrics into PatrolEvent history when completed or crashed
  useEffect(() => {
    if (
      (snapshot.status === "completed" || snapshot.status === "crashed") &&
      !hasRecordedEventRef.current
    ) {
      hasRecordedEventRef.current = true;
      const event = activeEngine.createPatrolEventSnapshot(scenario?.id);
      onRecordEvent?.(event);
      if (snapshot.status === "crashed") {
        announce(
          `Toboggan transport halted: Terrain collision limit reached. Judgment score: ${snapshot.judgmentScore} percent.`
        );
      } else {
        announce(
          `Toboggan descent completed. Control judgment score: ${snapshot.judgmentScore} percent. Arrived at Base Aid Room.`
        );
      }
    }
  }, [
    snapshot.status,
    snapshot.judgmentScore,
    activeEngine,
    scenario?.id,
    onRecordEvent,
    announce,
  ]);

  // Reinitialize engine on mount or scenario change
  useEffect(() => {
    activeEngine.init();
    hasRecordedEventRef.current = false;
  }, [activeEngine]);

  // Clean up default engine on unmount
  useEffect(() => {
    return () => {
      if (!customEngine) {
        defaultEngine.destroy();
      }
    };
  }, [customEngine, defaultEngine]);

  // Continuous animation and physics loop
  useEffect(() => {
    let animId: number | null = null;
    let lastTime = 0;

    function onFrame(timestamp: number) {
      if (lastTime === 0) {
        lastTime = timestamp;
      }
      const deltaMs = timestamp - lastTime;
      lastTime = timestamp;

      const currentStatus = activeEngine.createSnapshot().status;
      if (
        !isPaused &&
        !isStepThroughMode &&
        currentStatus !== "completed" &&
        currentStatus !== "crashed"
      ) {
        // Step fixed 60Hz physics
        const dt = Math.min(0.05, deltaMs / 1000);
        activeEngine.update(dt);
      }

      // Render graphics to canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          activeEngine.render(ctx, 1.0);
        }
      }

      animId = requestAnimationFrame(onFrame);
    }

    animId = requestAnimationFrame(onFrame);

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [activeEngine, isPaused, isStepThroughMode]);

  // Desktop Keyboard Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid stealing input if focus is in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        activeEngine.setSteering(-1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        activeEngine.setSteering(1);
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        activeEngine.setBraking(true);
      } else if (e.code === "Space" || e.code === "KeyB") {
        e.preventDefault();
        const currentEngaged = activeEngine.getSnapshot().isChainBrakeEngaged;
        activeEngine.toggleChainBrake();
        announce(`Chain brake ${!currentEngaged ? "engaged" : "released"}`);
      } else if (e.code === "KeyT") {
        const currentRope = activeEngine.getSnapshot().isTailRopeBraking;
        activeEngine.toggleTailRope();
        announce(`Tail rope belay ${!currentRope ? "active" : "slack"}`);
      } else if (e.code === "KeyP") {
        setIsPaused((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        activeEngine.setSteering(0);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        activeEngine.setSteering(0);
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        activeEngine.setBraking(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeEngine, announce]);

  // Pointer event helpers ensuring touch targets do not stick on drag-out
  const handlePointerDownSteer =
    (val: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.cancelable) e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe catch for synthetic/mock pointer environments
      }
      activeEngine.setSteering(val);
    };

  const handlePointerUpSteer = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe catch
    }
    activeEngine.setSteering(0);
  };

  const handlePointerDownBrake = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.cancelable) e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe catch
    }
    activeEngine.setBraking(true);
  };

  const handlePointerUpBrake = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe catch
    }
    activeEngine.setBraking(false);
  };

  // Step-through accessibility action dispatcher with dynamic post-action snapshot query
  const handleStepAction = (
    label: string,
    action: () => void,
    announcementGenerator: (snap: OetDescentSnapshot) => string
  ) => {
    action();
    const updatedSnap = activeEngine.getSnapshot();
    announce(`${label}: ${announcementGenerator(updatedSnap)}`);
  };

  const safeTotalDistance = Math.max(1, snapshot.totalDistance);
  const progressPercent = Math.min(
    100,
    Math.round((snapshot.distanceTraveled / safeTotalDistance) * 100)
  );

  const speedColorClass =
    snapshot.currentSpeedMph > 18
      ? "text-red-400 animate-pulse"
      : snapshot.currentSpeedMph > 14
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div
      className="flex flex-col gap-5 p-4 sm:p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/80"
      data-testid="patrol-oet-canvas"
    >
      <div
        data-testid="patrol-oet-placeholder"
        className="hidden"
        aria-hidden="true"
      />
      {/* Header & Mission Objective */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-[10px] font-mono font-bold uppercase tracking-wider">
              OET Fall-Line Transport Run
            </span>
            <span className="text-zinc-400 text-xs font-mono">
              Cascade Toboggan 100
            </span>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono">
              {effectiveBriefingState.snowCondition?.toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
            Toboggan Descent: {scenario?.location ?? "The Back Bowl"} to Base
          </h2>
          <p className="text-xs font-sans text-zinc-300 max-w-2xl">
            Control descent speed and lateral edge angles down the 24° fall
            line. Maintain head uphill orientation, pass guide gates, and deploy
            chain brake to protect the packaged patient from excessive
            acceleration and abrupt jerks.
          </p>
        </div>

        {/* Accessibility Step-Through Toggle & Pause */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsStepThroughMode((prev) => !prev);
              announce(
                `Step-through accessibility mode ${
                  !isStepThroughMode ? "activated" : "deactivated"
                }`
              );
            }}
            aria-pressed={isStepThroughMode}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border inline-flex items-center gap-2 ${
              isStepThroughMode
                ? "bg-brand-cyan text-zinc-950 border-brand-cyan shadow-lg shadow-brand-cyan/20"
                : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <IconShieldCheck className="w-4 h-4" />
            <span>
              {isStepThroughMode
                ? "A11y Step-Through: ON"
                : "Step-Through Mode"}
            </span>
          </button>

          {!isStepThroughMode && (
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center"
            >
              {isPaused ? (
                <IconPlayerPlay className="w-4 h-4 text-emerald-400" />
              ) : (
                <IconPlayerPause className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2D Mini-Game Canvas & Absolute HTML HUD Layer (ADR 0026) */}
      <div className="relative w-full rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl aspect-[16/10] min-h-[220px]">
        {/* Render Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          data-testid="oet-viewport-canvas"
          className="w-full h-full block"
          style={{ imageRendering: "pixelated" }}
        />

        {/* HTML/CSS Overlay Layer (ADR 0026 #ui-layer) */}
        <div
          id="ui-layer"
          className="absolute inset-0 pointer-events-none p-3 sm:p-5 flex flex-col justify-between"
        >
          {/* Top HUD Bar */}
          <div className="flex items-start justify-between gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            {/* Speed & Control Gauge */}
            <div className="bg-zinc-950/85 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-zinc-800/80 shadow-lg flex items-center gap-2.5 sm:gap-3.5 pointer-events-auto min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-brand-cyan shrink-0">
                <IconGauge className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-zinc-400 uppercase truncate">
                  Descent Speed
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-lg sm:text-xl font-mono font-bold ${speedColorClass}`}
                  >
                    {snapshot.currentSpeedMph.toFixed(1)}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono text-zinc-400">
                    mph
                  </span>
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-zinc-400 truncate">
                  {snapshot.currentSpeedMph > 15
                    ? "EXCEEDING SAFE LIMIT"
                    : snapshot.isStopped
                      ? "STOPPED / SECURED"
                      : "CONTROLLED GLIDE"}
                </div>
              </div>
            </div>

            {/* Distance Progress & Gate Rating */}
            <div className="bg-zinc-950/85 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-zinc-800/80 shadow-lg flex items-center gap-2.5 sm:gap-4 pointer-events-auto min-w-0">
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-zinc-400 uppercase truncate">
                  Fall Line Progress
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                  {Math.round(snapshot.distanceTraveled)}m /{" "}
                  {snapshot.totalDistance}m ({progressPercent}%)
                </div>
                {/* Visual Progress Bar */}
                <div className="w-20 sm:w-32 h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-brand-cyan transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="border-l border-zinc-800 pl-2.5 sm:pl-3 shrink-0">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Judgment
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-emerald-400">
                  {snapshot.judgmentScore}%
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-zinc-400">
                  Eff: {snapshot.metrics.routeEfficiency}%
                </div>
              </div>
            </div>
          </div>

          {/* Active Warnings Alert Pill */}
          {snapshot.activeWarnings.length > 0 && (
            <div className="self-center pointer-events-auto animate-bounce">
              <div className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 shadow-xl backdrop-blur-md">
                <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{snapshot.activeWarnings[0]}</span>
              </div>
            </div>
          )}

          {/* Bottom HUD: Chain Brake & Tail Rope Status Badges */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2 pointer-events-auto">
              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 backdrop-blur-md ${
                  snapshot.isChainBrakeEngaged
                    ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan"
                    : "bg-zinc-900/80 border-zinc-800 text-zinc-400"
                }`}
              >
                <IconAnchor className="w-4 h-4" />
                <span>
                  Chain Brake:{" "}
                  {snapshot.isChainBrakeEngaged ? "DEPLOYED" : "RELEASED"}
                </span>
              </div>

              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 backdrop-blur-md ${
                  snapshot.isTailRopeBraking
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "bg-zinc-900/80 border-zinc-800 text-zinc-400"
                }`}
              >
                <IconRoute className="w-4 h-4" />
                <span>
                  Tail Rope:{" "}
                  {snapshot.isTailRopeBraking ? "TENSIONED" : "SLACK"}
                </span>
              </div>
            </div>

            {/* In-world live controls reference */}
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-400 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800 pointer-events-auto">
              <span>Keys: [A/D or ←/→] Steer</span>
              <span>•</span>
              <span>[S or ↓] Wedge Brake</span>
              <span>•</span>
              <span>[Space] Chain Brake</span>
              <span>•</span>
              <span>[T] Tail Rope</span>
            </div>
          </div>
        </div>

        {/* Completion Modal Overlay */}
        {snapshot.status === "completed" && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center gap-4 z-20">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <IconCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-2xl font-mono font-bold text-white">
                Base Aid Room Arrival
              </h3>
              <p className="text-xs text-zinc-300 font-sans">
                Toboggan transport completed safely. Patient delivered to base
                aid room staging for EMS handoff and triage transition.
              </p>
            </div>

            {/* Metrics Score Breakdown */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left w-full max-w-lg">
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Judgment Score
                </div>
                <div className="text-lg font-mono font-bold text-emerald-400">
                  {snapshot.judgmentScore}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Collisions
                </div>
                <div className="text-lg font-mono font-bold text-zinc-200">
                  {snapshot.metrics.collisions}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Boundary Excursions
                </div>
                <div className="text-lg font-mono font-bold text-zinc-200">
                  {snapshot.metrics.boundaryViolations}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Abrupt Jerks
                </div>
                <div className="text-sm font-mono text-zinc-200">
                  {snapshot.metrics.abruptDirectionChanges}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Controlled Stops
                </div>
                <div className="text-sm font-mono text-zinc-200">
                  {snapshot.metrics.controlledStops}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Route Efficiency
                </div>
                <div className="text-sm font-mono text-zinc-200">
                  {snapshot.metrics.routeEfficiency}%
                </div>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  activeEngine.init();
                  hasRecordedEventRef.current = false;
                }}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <IconRotateClockwise className="w-4 h-4" />
                <span>Re-run Descent</span>
              </button>

              <button
                type="button"
                onClick={handleArriveAtBase}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-brand-cyan/20"
              >
                <span>Proceed to Base Aid Room Handoff</span>
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Crash / Incident Modal Overlay */}
        {snapshot.status === "crashed" && (
          <div
            className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center gap-4 z-20"
            data-testid="oet-crashed-modal"
          >
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse">
              <IconAlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-2xl font-mono font-bold text-white">
                Critical Transport Incident: Toboggan Halted
              </h3>
              <p className="text-xs text-zinc-300 font-sans">
                Repeated terrain obstacle collisions resulted in sled stoppage
                on the fall line. Patient transport suspended due to impact
                shock risk. Immediate triage assessment required.
              </p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left w-full max-w-lg">
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Judgment Score
                </div>
                <div className="text-lg font-mono font-bold text-red-400">
                  {snapshot.judgmentScore}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Collisions
                </div>
                <div className="text-lg font-mono font-bold text-red-400">
                  {snapshot.metrics.collisions} / 4
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase">
                  Boundary Excursions
                </div>
                <div className="text-lg font-mono font-bold text-zinc-200">
                  {snapshot.metrics.boundaryViolations}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  activeEngine.init();
                  hasRecordedEventRef.current = false;
                }}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <IconRotateClockwise className="w-4 h-4" />
                <span>Retry Descent Run</span>
              </button>

              <button
                type="button"
                onClick={handleArriveAtBase}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-red-600/20"
              >
                <span>Proceed to Emergency Triage</span>
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step-Through Accessibility Mode Panel (WCAG 2.1 AA Non-continuous Input) */}
      {isStepThroughMode && (
        <div
          role="region"
          aria-label="Step-Through Accessibility Controls"
          className="p-4 rounded-xl bg-zinc-950 border border-brand-cyan/40 space-y-3"
          data-testid="oet-a11y-step-controls"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-cyan">
              <IconShieldCheck className="w-4 h-4" />
              <span>Step-Through Accessibility Mode Active</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              Discrete turn-based inputs for motor-assistive access
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleStepAction(
                  "Glide Ahead",
                  () =>
                    activeEngine.stepSimulation(0.6, {
                      steering: 0,
                      brake: false,
                      chainBrake: false,
                    }),
                  (snap) =>
                    snap.status === "completed"
                      ? "Arrived at Base Aid Room."
                      : snap.status === "crashed"
                        ? "Sled stopped due to collisions."
                        : `Advanced to ${Math.round(snap.distanceTraveled)}m at ${snap.currentSpeedMph.toFixed(1)} mph.`
                )
              }
              className="min-h-[48px] p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconPlayerPlay className="w-4 h-4 text-emerald-400" />
              <span>Glide 30m</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleStepAction(
                  "Sideslip Left",
                  () =>
                    activeEngine.stepSimulation(0.6, {
                      steering: -0.7,
                      brake: false,
                      chainBrake: false,
                    }),
                  (snap) =>
                    `Sideslipped left through guide corridor to ${Math.round(snap.distanceTraveled)}m.`
                )
              }
              className="min-h-[48px] p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Sideslip Left</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleStepAction(
                  "Sideslip Right",
                  () =>
                    activeEngine.stepSimulation(0.6, {
                      steering: 0.7,
                      brake: false,
                      chainBrake: false,
                    }),
                  (snap) =>
                    `Sideslipped right through guide corridor to ${Math.round(snap.distanceTraveled)}m.`
                )
              }
              className="min-h-[48px] p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-white transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconArrowRight className="w-4 h-4 text-cyan-400" />
              <span>Sideslip Right</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleStepAction(
                  "Wedge & Chain Brake",
                  () => {
                    activeEngine.setChainBrake(true);
                    activeEngine.stepSimulation(0.6, { brake: true });
                  },
                  (snap) =>
                    `Applied wedge and chain brake. Speed checked to ${snap.currentSpeedMph.toFixed(1)} mph.`
                )
              }
              className="min-h-[48px] p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-amber-400 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconHandStop className="w-4 h-4" />
              <span>Check Speed</span>
            </button>
          </div>
        </div>
      )}

      {/* Touch Control Dock (ADR 0019 Archetype with min 48x48px hit areas and touch-action: none) */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80"
        data-testid="oet-touch-control-dock"
      >
        <button
          type="button"
          onPointerDown={handlePointerDownSteer(-1)}
          onPointerUp={handlePointerUpSteer}
          onPointerCancel={handlePointerUpSteer}
          onPointerLeave={handlePointerUpSteer}
          className="min-h-[48px] min-w-[48px] p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.96] border border-zinc-800 text-white font-mono text-xs font-bold inline-flex items-center justify-center gap-2 select-none touch-none cursor-pointer"
        >
          <IconArrowLeft className="w-5 h-5 text-cyan-400" />
          <span>Steer Left</span>
        </button>

        <button
          type="button"
          onPointerDown={handlePointerDownSteer(1)}
          onPointerUp={handlePointerUpSteer}
          onPointerCancel={handlePointerUpSteer}
          onPointerLeave={handlePointerUpSteer}
          className="min-h-[48px] min-w-[48px] p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.96] border border-zinc-800 text-white font-mono text-xs font-bold inline-flex items-center justify-center gap-2 select-none touch-none cursor-pointer"
        >
          <IconArrowRight className="w-5 h-5 text-cyan-400" />
          <span>Steer Right</span>
        </button>

        <button
          type="button"
          onPointerDown={handlePointerDownBrake}
          onPointerUp={handlePointerUpBrake}
          onPointerCancel={handlePointerUpBrake}
          onPointerLeave={handlePointerUpBrake}
          className="min-h-[48px] min-w-[48px] p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.96] border border-zinc-800 text-amber-300 font-mono text-xs font-bold inline-flex items-center justify-center gap-2 select-none touch-none cursor-pointer"
        >
          <IconArrowDown className="w-5 h-5" />
          <span>Wedge Brake</span>
        </button>

        <button
          type="button"
          onClick={() => activeEngine.toggleChainBrake()}
          className={`min-h-[48px] min-w-[48px] p-3 rounded-xl active:scale-[0.96] border font-mono text-xs font-bold inline-flex items-center justify-center gap-2 select-none touch-none cursor-pointer ${
            snapshot.isChainBrakeEngaged
              ? "bg-brand-cyan text-zinc-950 border-brand-cyan shadow-md shadow-brand-cyan/20"
              : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
          }`}
        >
          <IconAnchor className="w-5 h-5" />
          <span>Chain Brake</span>
        </button>

        <button
          type="button"
          onClick={() => activeEngine.performControlledStop()}
          className="col-span-2 sm:col-span-1 min-h-[48px] min-w-[48px] p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.96] border border-zinc-800 text-red-400 font-mono text-xs font-bold inline-flex items-center justify-center gap-2 select-none touch-none cursor-pointer"
        >
          <IconHandStop className="w-5 h-5" />
          <span>Check Stop</span>
        </button>
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <IconSparkles className="w-4 h-4 text-brand-cyan" />
          <span>
            Cascade 100 Safety Invariant: Patient packaged head uphill.
            Four-point harness secured.
          </span>
        </div>

        <button
          type="button"
          onClick={handleArriveAtBase}
          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>Arrive at Base Aid Room</span>
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
