"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import {
  IconRadio,
  IconCheck,
  IconFlag,
  IconAntenna,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconFocus2,
  IconMoon,
  IconSun,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconRotateClockwise,
  IconShieldCheck,
  IconCompass,
} from "@tabler/icons-react";
import {
  WELCH_TRAILS,
  WELCH_LIFTS,
  WELCH_POIS,
  RESPONSIBILITY_CODE,
  SUMMIT_ELEVATION_FT,
  BASE_ELEVATION_FT,
  VERTICAL_DROP_FT,
  catmullRomToPath,
  calculateElevationAt,
  calculateAverageGrade,
  interpolateSkierPosition,
  type WelchTrail,
  type WelchZone,
  type AmbientEvent,
  type ShiftOperationalState,
  type PatrolScenario,
  getDescentCommitIntervalMs,
} from "@/lib/patrol";
import { AmbientEventToast } from "./AmbientEventToast";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { clamp } from "@/lib/game-utils";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

/**
 * Props for the MountainMap component.
 */
interface MountainMapProps {
  /** Number of patrol incidents completed during the current shift. */
  incidentsCompleted: number;
  /** Callback triggered when patroller stands by on hill and accepts incoming dispatch. */
  onAwaitDispatch: () => void;
  /** Callback triggered to initiate final sweep and conclude the shift. */
  onCompleteShift: () => void;
  /** Optional active ambient mini-event currently requiring patrol attention. */
  activeAmbientEvent?: AmbientEvent | null;
  /** Operational modifier state (closed trails, equipment location, active hazard pins). */
  operationalState?: ShiftOperationalState;
  /** Callback triggered to request or trigger a routine ambient hill check. */
  onTriggerAmbientEvent?: () => void;
  /** Callback triggered when the patroller selects a response option for an ambient event. */
  onResolveAmbientOption?: (optionId: string) => void;
  /** Callback triggered when dismissing an ambient event. */
  onDismissAmbientEvent?: () => void;
  /** Optional active scenario for live dispatch incident tracking (Issue #835). */
  activeScenario?: PatrolScenario | null;
  /** Optional direct incident coordinates override for emergency radar beacon. */
  incidentCoordinates?: { x: number; y: number; zone?: WelchZone } | null;
}

/**
 * High-fidelity interactive mountain viewport for Welch Village Ski Area (Welch, MN).
 * Features dual-zone toggle (East & West Slopes ↔ The Back Bowl), Catmull-Rom vector
 * pathing with grooming textures, live cursor altitude calculation, trail inspector with
 * elevation sparkline, skier run simulation, minimap radar, night skiing floodlights,
 * and NSAA Responsibility Code modal. Adheres to ADR 0044 and WCAG 2.1 AA.
 *
 * Trail names, lift names, and elevation stats are cross-checked against Welch
 * Village's own current published trail map, but the artwork is an original
 * illustration — not a reproduction of, nor an official, resort trail map.
 */
export const MountainMap: React.FC<MountainMapProps> = ({
  incidentsCompleted,
  onAwaitDispatch,
  onCompleteShift,
  activeAmbientEvent = null,
  operationalState,
  onTriggerAmbientEvent,
  onResolveAmbientOption,
  onDismissAmbientEvent,
  activeScenario = null,
  incidentCoordinates = null,
}) => {
  // -------------------------------------------------------------
  // State: Viewport, Camera & Modes
  // -------------------------------------------------------------
  const [userZone, setUserZone] = useState<WelchZone | null>(null);

  // Auto-detect zone when ambient event or incident arrives
  const autoZone = useMemo<WelchZone>(() => {
    if (activeAmbientEvent) {
      if (
        activeAmbientEvent.sector?.includes("Back Bowl") ||
        activeAmbientEvent.location?.includes("Belle Creek") ||
        activeAmbientEvent.coordinates?.zone === "back-bowl"
      ) {
        return "back-bowl";
      }
      return "main";
    }
    if (incidentCoordinates?.zone) {
      return incidentCoordinates.zone;
    }
    if (activeScenario?.coordinates?.zone) {
      return activeScenario.coordinates.zone;
    }
    return "main";
  }, [activeAmbientEvent, incidentCoordinates, activeScenario]);

  const activeZone = userZone ?? autoZone;

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [prevNavKey, setPrevNavKey] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [isResponsibilityModalOpen, setIsResponsibilityModalOpen] =
    useState<boolean>(false);
  const [isMinimapExpanded, setIsMinimapExpanded] = useState<boolean>(true);

  usePatrolTriageHotkeys({
    itemsCount: 1,
    onSelectItem: () => onAwaitDispatch(),
    onAdvancePhase: () => onAwaitDispatch(),
    phase: "mountain_map",
    enabled: !activeAmbientEvent && !isResponsibilityModalOpen,
  });

  // Inspector & Simulation State
  const [selectedTrail, setSelectedTrail] = useState<WelchTrail | null>(null);
  const [hoveredTrail, setHoveredTrail] = useState<WelchTrail | null>(null);
  const [cursorElevation, setCursorElevation] = useState<{
    x: number;
    y: number;
    elevation: number;
  } | null>(null);

  const [simulation, setSimulation] = useState<{
    active: boolean;
    trail: WelchTrail;
    progress: number;
    isPaused: boolean;
  } | null>(null);

  // M8 Ambient Resolution State
  const [resolvedConsequence, setResolvedConsequence] = useState<{
    title: string;
    consequenceText: string;
    optionLabel: string;
  } | null>(null);

  // -------------------------------------------------------------
  // Dimensions & Coordinate Calibration
  // -------------------------------------------------------------
  const baseWidth = activeZone === "main" ? 2000 : 1200;
  const baseHeight = activeZone === "main" ? 1300 : 900;

  // Active Emergency Coordinates
  const activeIncident = useMemo(() => {
    if (incidentCoordinates) {
      return {
        x: incidentCoordinates.x,
        y: incidentCoordinates.y,
        zone: incidentCoordinates.zone ?? "main",
      };
    }
    if (activeScenario?.coordinates) {
      return {
        x: activeScenario.coordinates.x,
        y: activeScenario.coordinates.y,
        zone: activeScenario.coordinates.zone ?? "main",
      };
    }
    return null;
  }, [incidentCoordinates, activeScenario]);

  // Adjust camera & clear manual override when incoming incident or ambient event arrives
  const currentNavKey = activeIncident
    ? `${activeIncident.x},${activeIncident.y},${activeIncident.zone}`
    : activeAmbientEvent
      ? activeAmbientEvent.id
      : null;

  if (currentNavKey !== prevNavKey) {
    setPrevNavKey(currentNavKey);
    setUserZone(null);
    if (activeIncident) {
      const targetBaseWidth = activeIncident.zone === "back-bowl" ? 1200 : 2000;
      const targetBaseHeight = activeIncident.zone === "back-bowl" ? 900 : 1300;
      const zoomLevel = 1.25;
      setPan({
        x: (targetBaseWidth / 2 - activeIncident.x) * zoomLevel,
        y: (targetBaseHeight / 2 - activeIncident.y) * zoomLevel,
      });
      setZoom(zoomLevel);
    }
  }

  // Derive scoped trail selection and simulation matching the active zone
  const activeSelectedTrail =
    selectedTrail?.zone === activeZone ? selectedTrail : null;
  const activeSimulation =
    simulation?.trail.zone === activeZone ? simulation : null;

  // Ambient Event zone derivation
  const ambientZone: WelchZone =
    activeAmbientEvent?.coordinates?.zone ??
    (activeAmbientEvent?.sector?.includes("Back Bowl") ||
    activeAmbientEvent?.location?.includes("Belle Creek")
      ? "back-bowl"
      : "main");

  // Backward-compatibility flags for Milestone M8 ambient tests
  const isEventOnLongWayHome = Boolean(
    activeAmbientEvent &&
    (activeAmbientEvent.location.includes("Long Way Home") ||
      activeAmbientEvent.prompt.includes("Long Way Home"))
  );
  const isEventOnHarleysHollow = Boolean(
    activeAmbientEvent &&
    (activeAmbientEvent.location.includes("Harley's Hollow") ||
      activeAmbientEvent.prompt.includes("Harley's Hollow"))
  );
  const isEventOnBelleCreekQuad = Boolean(
    activeAmbientEvent &&
    (activeAmbientEvent.location.includes("Belle Creek Quad") ||
      activeAmbientEvent.prompt.includes("Belle Creek Quad"))
  );
  const isEventAtSummit = Boolean(
    activeAmbientEvent &&
    (activeAmbientEvent.location.includes("Summit") ||
      activeAmbientEvent.prompt.includes("Summit"))
  );
  const isEventAtBase = Boolean(
    activeAmbientEvent &&
    (activeAmbientEvent.location.includes("Base") ||
      activeAmbientEvent.prompt.includes("Base"))
  );

  // Filter datasets to active zone
  const zoneTrails = useMemo(
    () => WELCH_TRAILS.filter((t) => t.zone === activeZone),
    [activeZone]
  );
  const zoneLifts = useMemo(
    () => WELCH_LIFTS.filter((l) => l.zone === activeZone),
    [activeZone]
  );
  const zonePois = useMemo(
    () => WELCH_POIS.filter((p) => p.zone === activeZone),
    [activeZone]
  );

  // -------------------------------------------------------------
  // Skier Simulation Animation Loop
  // -------------------------------------------------------------
  const isMobileViewport = useIsMobileViewport();

  const isSimulationActive = Boolean(
    activeSimulation?.active && !activeSimulation?.isPaused
  );

  // AGENTS.md section 16: cap React state commits on mobile so the descent
  // does not drive a 60fps setState loop through the whole map render tree.
  // The frame loop still runs; only the commit rate is throttled, so the
  // animation stays smooth-enough while halving reconciliation work.
  const minCommitMs = getDescentCommitIntervalMs(isMobileViewport);
  // Frame time accrued since the last commit. Skipped frames add to it, so a
  // throttled commit still advances the descent by the full time it covers.
  const msSinceCommitRef = useRef(0);

  useAnimationFrame(
    (deltaMs, elapsedMs) => {
      // A (re)started loop reports elapsedMs 0 until time accrues: re-anchor.
      if (elapsedMs === 0) msSinceCommitRef.current = 0;
      msSinceCommitRef.current += deltaMs;
      if (msSinceCommitRef.current < minCommitMs) return;

      const dt = msSinceCommitRef.current / 1000;
      msSinceCommitRef.current = 0;

      setSimulation((prev) => {
        if (!prev || !prev.active || prev.isPaused) return prev;
        // Complete full descent in ~8.0 seconds
        const nextProgress = prev.progress + dt / 8.0;
        if (nextProgress >= 1.0) {
          return { ...prev, progress: 1.0, isPaused: true };
        }
        return { ...prev, progress: nextProgress };
      });
    },
    {
      isActive: isSimulationActive,
      // A viewport change restarts the loop so its commit throttle re-anchors.
      restartKey: isMobileViewport,
      // The descent has always advanced by the real time between commits.
      maxDeltaMs: Infinity,
    }
  );

  // Current skier position & tangent
  const currentSkierPosition = useMemo(() => {
    if (!activeSimulation) return null;
    return interpolateSkierPosition(
      activeSimulation.trail.points,
      activeSimulation.progress
    );
  }, [activeSimulation]);

  // -------------------------------------------------------------
  // Viewport Pan & Zoom Handlers
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Only left click or single touch initiates pan
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    // Capture on the <svg> itself, not the child path/text under the cursor —
    // a child can unmount mid-drag (trail re-render, zone switch) and silently
    // drop the capture along with the terminating pointerup.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // 1. Pan update if dragging
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }

    // 2. Cursor altitude calculation with inverse viewport transform
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = baseWidth / rect.width;
      const scaleY = baseHeight / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;
      const cx = baseWidth / 2;
      const cy = baseHeight / 2;
      const terrainX = cx + (svgX - cx - pan.x) / zoom;
      const terrainY = cy + (svgY - cy - pan.y) / zoom;
      const elevation = calculateElevationAt(terrainX, terrainY, activeZone);
      setCursorElevation({
        x: Math.round(terrainX),
        y: Math.round(terrainY),
        elevation,
      });
    }
  };

  const endPan = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsPanning(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    endPan(e);
  };

  // A touch interrupted by the OS (incoming call, notification shade, browser
  // back-gesture) fires pointercancel and never pointerup — without this the
  // map would stay latched in panning mode and keep tracking the cursor.
  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    endPan(e);
  };

  const zoomIn = () =>
    setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 3.8));
  const zoomOut = () =>
    setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.35));
  const resetCamera = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Quick Pan Anchors
  const panToAnchor = (
    targetZone: WelchZone,
    targetX: number,
    targetY: number
  ) => {
    if (activeZone !== targetZone) {
      setUserZone(targetZone);
      if (selectedTrail?.zone !== targetZone) setSelectedTrail(null);
      if (simulation?.trail.zone !== targetZone) setSimulation(null);
    }
    const targetBaseWidth = targetZone === "main" ? 2000 : 1200;
    const targetBaseHeight = targetZone === "main" ? 1300 : 900;
    const zoomLevel = 1.2;
    setPan({
      x: (targetBaseWidth / 2 - targetX) * zoomLevel,
      y: (targetBaseHeight / 2 - targetY) * zoomLevel,
    });
    setZoom(zoomLevel);
  };

  // -------------------------------------------------------------
  // Ambient Mini-Event Handlers
  // -------------------------------------------------------------
  const handleResolveOption = (optionId: string) => {
    if (activeAmbientEvent) {
      const opt = activeAmbientEvent.options.find((o) => o.id === optionId);
      if (opt) {
        setResolvedConsequence({
          title: activeAmbientEvent.title,
          consequenceText: opt.consequenceText,
          optionLabel: opt.label,
        });
      }
    }
    onResolveAmbientOption?.(optionId);
  };

  const handleDismiss = () => {
    setResolvedConsequence(null);
    onDismissAmbientEvent?.();
  };

  // Helper for trail color cores
  const getDifficultyCoreColor = (diff: WelchTrail["difficulty"]) => {
    switch (diff) {
      case "green":
        return "#10b981"; // Emerald green
      case "blue":
        return "#0ea5e9"; // Sky blue
      case "black":
        return "#f43f5e"; // Rose black
      case "double-black":
        return "#be123c"; // Dark rose
      case "terrain-park":
        return "#f59e0b"; // Amber orange
      default:
        return "#38bdf8";
    }
  };

  // -------------------------------------------------------------
  // Keyboard Accessibility
  // -------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isResponsibilityModalOpen) {
          setIsResponsibilityModalOpen(false);
        } else if (activeSimulation?.active) {
          setSimulation(null);
        } else if (activeSelectedTrail) {
          setSelectedTrail(null);
        }
      }
    },
    [isResponsibilityModalOpen, activeSimulation, activeSelectedTrail]
  );

  return (
    <div
      className="flex flex-col gap-4 p-4 sm:p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/90 shadow-2xl relative"
      data-testid="patrol-mountain-map"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Welch Village Interactive Mountain Map"
    >
      <style>{`
        @keyframes patrolSnowFall {
          0% { transform: translateY(0); opacity: 0.7; }
          50% { opacity: 0.3; }
          100% { transform: translateY(22px); opacity: 0.7; }
        }
        @keyframes patrolChairMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(var(--chair-move-x, 0px), var(--chair-move-y, -40px)); }
        }
        @keyframes patrolRadarPing {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .patrol-snow-particle {
          animation: patrolSnowFall 3s ease-in-out infinite alternate;
        }
        .patrol-chair-group {
          animation: patrolChairMove 4s linear infinite;
        }
        .patrol-radar-ping {
          animation: patrolRadarPing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .patrol-snow-particle,
          .patrol-chair-group,
          .patrol-radar-ping {
            animation: none !important;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------- */}
      {/* 1. MOUNTAIN HUB HEADER & STATUS BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              Mountain Open &bull; Patrol On Hill
            </span>
            <span className="text-zinc-400 text-xs font-mono">
              Welch Village, MN
            </span>
            {isNightMode && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                Night Operations &bull; Floodlights On
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-mono font-bold text-white tracking-tight flex items-center gap-2">
            <span>Mountain Patrol Hub &amp; Trail Map</span>
          </h2>
          <p className="text-[11px] font-mono text-zinc-400">
            Base {BASE_ELEVATION_FT} FT &bull; Summit{" "}
            {SUMMIT_ELEVATION_FT.toLocaleString()} FT &bull; Vertical{" "}
            {VERTICAL_DROP_FT} FT &bull; 50+ runs across 3 sectors
          </p>
        </div>

        {/* Patrol Stats Pills */}
        <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">
            <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Incidents Resolved:{" "}
              <strong className="text-white">{incidentsCompleted}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>
              Sled Staged:{" "}
              <strong
                className="text-white font-bold"
                data-testid="equipment-location-badge"
              >
                {operationalState?.equipmentLocation ?? "Summit Shack"}
              </strong>
            </span>
          </div>

          {operationalState?.closedTrails &&
            operationalState.closedTrails.length > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300"
                data-testid="mountain-closed-trails-pill"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span>
                  Closed:{" "}
                  <strong className="text-white font-bold">
                    {operationalState.closedTrails.join(", ")}
                  </strong>
                </span>
              </div>
            )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400">
            <IconRadio className="w-3.5 h-3.5 text-brand-cyan" />
            <span>154.570 MHz CH 1</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. VIEWPORT TOOLBAR: ZONE TOGGLE, CAMERA, MODES */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Dual-Zone View Toggle */}
        <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setUserZone("main");
              setSelectedTrail(null);
              setSimulation(null);
              resetCamera();
            }}
            className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
              activeZone === "main"
                ? "bg-brand-cyan text-zinc-950 shadow-md font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
            aria-pressed={activeZone === "main"}
          >
            East &amp; West Slopes
          </button>
          <button
            type="button"
            onClick={() => {
              setUserZone("back-bowl");
              setSelectedTrail(null);
              setSimulation(null);
              resetCamera();
            }}
            className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
              activeZone === "back-bowl"
                ? "bg-brand-cyan text-zinc-950 shadow-md font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
            aria-pressed={activeZone === "back-bowl"}
          >
            The Back Bowl
          </button>
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Night Skiing Toggle */}
          <button
            type="button"
            onClick={() => setIsNightMode((prev) => !prev)}
            className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border text-xs font-mono font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              isNightMode
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Toggle night skiing floodlights"
            aria-label="Toggle night skiing floodlights"
          >
            {isNightMode ? (
              <IconSun className="w-4 h-4 text-amber-400" />
            ) : (
              <IconMoon className="w-4 h-4 text-zinc-400" />
            )}
            <span className="hidden sm:inline">
              {isNightMode ? "Day View" : "Night Skiing"}
            </span>
          </button>

          {/* Responsibility Code Modal Button */}
          <button
            type="button"
            onClick={() => setIsResponsibilityModalOpen(true)}
            data-testid="safety-code-btn"
            className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white hover:border-zinc-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            aria-label="View Your Responsibility Code"
          >
            <IconShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Safety Code</span>
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={zoomIn}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center transition-colors"
            aria-label="Zoom In"
          >
            <IconZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={zoomOut}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center transition-colors"
            aria-label="Zoom Out"
          >
            <IconZoomOut className="w-4 h-4" />
          </button>

          {/* Reset Camera */}
          <button
            type="button"
            onClick={resetCamera}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center transition-colors"
            aria-label="Fit Mountain"
          >
            <IconFocus2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Accessible Screen Reader Context */}
      <div className="sr-only">
        Interactive terrain map of Welch Village Ski Area. Current sector view:{" "}
        {activeZone === "main" ? "East and West Slopes" : "The Back Bowl"}. Base
        elevation: 700 feet, Summit elevation: 1,060 feet. Use mouse or touch to
        pan and zoom. Select any trail to view slope profiles, average grade,
        and initiate skier descent simulations. This is a stylized, original
        illustration cross-checked against Welch Village&apos;s own published
        trail map, not an official resort map.
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. INTERACTIVE SVG VIEWPORT CONTAINER */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`relative w-full rounded-2xl border border-zinc-800/90 overflow-hidden shadow-2xl flex items-center justify-center transition-colors duration-500 ${
          isNightMode ? "bg-[#020617]" : "bg-zinc-950"
        }`}
        style={{ minHeight: "440px", maxHeight: "640px" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="w-full h-auto max-h-[640px] select-none touch-none cursor-grab active:cursor-grabbing"
          role="group"
          aria-label={`Welch Village Trail Map: ${
            activeZone === "main" ? "East & West Slopes" : "The Back Bowl"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <title>Welch Village Trail Map</title>
          <desc>
            Geospatial terrain map of Welch Village Ski Area in Welch,
            Minnesota. Showing authentic trail splines, chairlifts, POIs, and
            elevation contours. A stylized, original illustration cross-checked
            against Welch Village&apos;s own published trail map, not an
            official resort map.
          </desc>

          <defs>
            {/* Mountain Gradient for Day/Night */}
            <linearGradient
              id="dayMountainBg"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="35%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient
              id="nightMountainBg"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#020617" />
              <stop offset="40%" stopColor="#090d16" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Glowing filter for Night Skiing floodlit paths */}
            <filter
              id="floodlightGlow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Root Transform Matrix Group for Pan and Zoom */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{
              transformOrigin: `${baseWidth / 2}px ${baseHeight / 2}px`,
              transition: isPanning ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Background Mountain Silhouette */}
            <rect
              width={baseWidth}
              height={baseHeight}
              rx="16"
              fill={
                isNightMode ? "url(#nightMountainBg)" : "url(#dayMountainBg)"
              }
            />

            {/* Night Sky Stars */}
            {isNightMode && (
              <g fill="#ffffff" opacity="0.8">
                <circle cx="150" cy="80" r="1.5" />
                <circle cx="340" cy="50" r="1.0" />
                <circle cx="620" cy="95" r="1.5" />
                <circle cx="950" cy="65" r="1.2" />
                <circle cx="1280" cy="110" r="1.5" />
                <circle cx="1580" cy="70" r="1.0" />
                <circle cx="1850" cy="120" r="1.8" />
              </g>
            )}

            {/* Topographic Contour Lines */}
            {activeZone === "main" ? (
              <g
                stroke={isNightMode ? "#1e293b" : "#334155"}
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.4"
              >
                <path d="M 100 240 Q 600 160 1000 180 T 1900 230" fill="none" />
                <path d="M 80 480 Q 620 380 1020 400 T 1920 470" fill="none" />
                <path d="M 70 760 Q 640 660 1040 680 T 1930 750" fill="none" />
                <path
                  d="M 60 1040 Q 660 940 1060 960 T 1940 1030"
                  fill="none"
                />
              </g>
            ) : (
              <g
                stroke={isNightMode ? "#1e293b" : "#334155"}
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.4"
              >
                <path d="M 100 200 Q 450 140 600 150 T 1100 190" fill="none" />
                <path d="M 90 380 Q 460 320 610 330 T 1110 370" fill="none" />
                <path d="M 80 580 Q 470 520 620 530 T 1120 570" fill="none" />
                <path d="M 70 760 Q 480 700 630 710 T 1130 750" fill="none" />
              </g>
            )}

            {/* Mountain Ridge Polygon Geometries */}
            {activeZone === "main" ? (
              <>
                <polygon
                  points="200,1300 1000,160 1800,1300"
                  fill={isNightMode ? "#090d16" : "#1e293b"}
                  opacity="0.3"
                />
                <polygon
                  points="450,1300 1000,180 1550,1300"
                  fill={isNightMode ? "#0f172a" : "#334155"}
                  opacity="0.2"
                />
              </>
            ) : (
              <polygon
                points="100,900 600,130 1100,900"
                fill={isNightMode ? "#090d16" : "#1e293b"}
                opacity="0.3"
              />
            )}

            {/* Sector Labels on Terrain */}
            {activeZone === "main" ? (
              <>
                <text
                  x="520"
                  y="120"
                  fill="#94a3b8"
                  fontSize="22"
                  fontWeight="bold"
                  fontFamily="monospace"
                  letterSpacing="4"
                  textAnchor="middle"
                  opacity="0.7"
                >
                  EAST SLOPES
                </text>
                <text
                  x="1500"
                  y="120"
                  fill="#94a3b8"
                  fontSize="22"
                  fontWeight="bold"
                  fontFamily="monospace"
                  letterSpacing="4"
                  textAnchor="middle"
                  opacity="0.7"
                >
                  WEST SLOPES
                </text>
              </>
            ) : (
              <text
                x="600"
                y="90"
                fill="#fda4af"
                fontSize="22"
                fontWeight="bold"
                fontFamily="monospace"
                letterSpacing="4"
                textAnchor="middle"
                opacity="0.8"
              >
                THE BACK BOWL &bull; EXPERT AMPHITHEATER
              </text>
            )}

            {/* Global Ambient Event Highlights for backward compatibility */}
            {isEventOnBelleCreekQuad &&
              !zoneLifts.some((l) => l.id === "belle-creek-quad") && (
                <line
                  x1="460"
                  y1="465"
                  x2="435"
                  y2="75"
                  stroke="#f59e0b"
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.5"
                  className="animate-pulse"
                  data-testid="lift-highlight-belle-creek-quad"
                />
              )}
            {isEventOnLongWayHome &&
              !zoneTrails.some((t) => t.id === "long-way-home") && (
                <path
                  d="M 370 85 C 260 120 140 200 130 310 C 120 400 240 450 320 460"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="24"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                  className="animate-pulse"
                  data-testid="trail-highlight-long-way-home"
                />
              )}
            {isEventOnHarleysHollow &&
              !zoneTrails.some((t) => t.id === "harleys-hollow") && (
                <path
                  d="M 430 85 C 520 150 560 240 540 330 C 520 410 450 440 390 460"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                  className="animate-pulse"
                  data-testid="trail-highlight-harleys-hollow"
                />
              )}

            {/* --------------------------------------------------------- */}
            {/* TRAILS: CATMULL-ROM DOUBLE-PASS VECTOR RENDERING */}
            {/* --------------------------------------------------------- */}
            {zoneTrails.map((trail) => {
              const pathD = catmullRomToPath(trail.points);
              const isClosed = Boolean(
                operationalState?.closedTrails?.includes(trail.name)
              );
              const isSelected = activeSelectedTrail?.id === trail.id;
              const isHovered = hoveredTrail?.id === trail.id;

              // Core color & dashing
              const coreColor = isClosed
                ? "#ef4444"
                : getDifficultyCoreColor(trail.difficulty);
              const strokeDasharray = isClosed
                ? "4 4"
                : trail.groomed
                  ? undefined
                  : "8 6";

              return (
                <g
                  key={trail.id}
                  className="cursor-pointer transition-opacity"
                  onClick={() => setSelectedTrail(trail)}
                  onPointerEnter={() => setHoveredTrail(trail)}
                  onPointerLeave={() => setHoveredTrail(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${trail.name}, ${trail.difficulty} difficulty, ${
                    trail.groomed ? "Groomed" : "Moguls"
                  }, ${isClosed ? "Closed" : "Open"}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTrail(trail);
                    }
                  }}
                >
                  <title>{`${trail.name} • ${trail.difficulty.toUpperCase()} • ${
                    trail.groomed ? "Groomed Corduroy" : "Moguls"
                  } • ${trail.lengthFt.toLocaleString()} FT • ${trail.verticalDropFt} FT Drop`}</title>

                  {/* Active Event Trail Highlights */}
                  {trail.name === "Long Way Home" && isEventOnLongWayHome && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="28"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.4"
                      className="animate-pulse"
                      data-testid="trail-highlight-long-way-home"
                    />
                  )}

                  {trail.name === "Harley's Hollow" &&
                    isEventOnHarleysHollow && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="28"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.4"
                        className="animate-pulse"
                        data-testid="trail-highlight-harleys-hollow"
                      />
                    )}

                  {/* Selection / Hover Halo */}
                  {(isSelected || isHovered) && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isSelected ? "#00f0ff" : "#facc15"}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.5"
                    />
                  )}

                  {/* Pass 1: Casing (6px) */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isNightMode ? "#000000" : "#09090b"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isClosed ? 0.4 : 0.9}
                  />

                  {/* Pass 2: Difficulty Core (4px) with Grooming Style */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={coreColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={strokeDasharray}
                    filter={
                      isNightMode && trail.groomed
                        ? "url(#floodlightGlow)"
                        : undefined
                    }
                    opacity={isClosed ? 0.6 : 1.0}
                  />

                  {/* Closed Trail Badge */}
                  {isClosed && (
                    <g
                      transform={`translate(${trail.points[Math.floor(trail.points.length / 2)].x}, ${
                        trail.points[Math.floor(trail.points.length / 2)].y
                      })`}
                      data-testid={
                        trail.name === "Long Way Home"
                          ? "closed-trail-badge-long-way-home"
                          : trail.name === "Harley's Hollow"
                            ? "closed-trail-badge-harleys-hollow"
                            : `closed-trail-badge-${trail.id}`
                      }
                    >
                      <rect
                        x="-48"
                        y="-12"
                        width="96"
                        height="24"
                        rx="4"
                        fill="#7f1d1d"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#fecaca"
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        CLOSED
                      </text>
                    </g>
                  )}

                  {/* Trail Name Label at Midpoint */}
                  <text
                    x={trail.points[1]?.x ?? trail.points[0].x}
                    y={(trail.points[1]?.y ?? trail.points[0].y) - 8}
                    fill={coreColor}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none pointer-events-none drop-shadow"
                  >
                    {trail.name}
                  </text>
                </g>
              );
            })}

            {/* --------------------------------------------------------- */}
            {/* CHAIRLIFTS: CABLES, TOWERS, ANIMATED CARRIERS */}
            {/* --------------------------------------------------------- */}
            {zoneLifts.map((lift) => {
              const isBelleCreek = lift.id === "belle-creek-quad";
              return (
                <g key={lift.id} className="select-none">
                  {/* Active Event Highlight for Belle Creek Quad */}
                  {isBelleCreek && isEventOnBelleCreekQuad && (
                    <line
                      x1={lift.bottomTerminal.x}
                      y1={lift.bottomTerminal.y}
                      x2={lift.topTerminal.x}
                      y2={lift.topTerminal.y}
                      stroke="#f59e0b"
                      strokeWidth="12"
                      strokeLinecap="round"
                      opacity="0.5"
                      className="animate-pulse"
                      data-testid="lift-highlight-belle-creek-quad"
                    />
                  )}

                  {/* Aerial Cable Line */}
                  <line
                    x1={lift.bottomTerminal.x}
                    y1={lift.bottomTerminal.y}
                    x2={lift.topTerminal.x}
                    y2={lift.topTerminal.y}
                    stroke="#64748b"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />

                  {/* Towers along lift line */}
                  {Array.from({ length: lift.towerCount }).map((_, idx) => {
                    const t = (idx + 1) / (lift.towerCount + 1);
                    const tx =
                      lift.bottomTerminal.x +
                      (lift.topTerminal.x - lift.bottomTerminal.x) * t;
                    const ty =
                      lift.bottomTerminal.y +
                      (lift.topTerminal.y - lift.bottomTerminal.y) * t;

                    return (
                      <g key={idx}>
                        <line
                          x1={tx}
                          y1={ty}
                          x2={tx}
                          y2={ty + 14}
                          stroke="#94a3b8"
                          strokeWidth="3"
                        />
                        <line
                          x1={tx - 7}
                          y1={ty}
                          x2={tx + 7}
                          y2={ty}
                          stroke="#cbd5e1"
                          strokeWidth="2.5"
                        />
                        <text
                          x={tx + 11}
                          y={ty + 4}
                          fill="#94a3b8"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          T{idx + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Animated Chairs */}
                  {(() => {
                    const cDx = lift.topTerminal.x - lift.bottomTerminal.x;
                    const cDy = lift.topTerminal.y - lift.bottomTerminal.y;
                    const cLen = Math.hypot(cDx, cDy) || 1;
                    const moveStep = 40;
                    const moveX = Math.round((cDx / cLen) * moveStep);
                    const moveY = Math.round((cDy / cLen) * moveStep);

                    return (
                      <g
                        className="patrol-chair-group"
                        style={
                          {
                            "--chair-move-x": `${moveX}px`,
                            "--chair-move-y": `${moveY}px`,
                          } as React.CSSProperties
                        }
                      >
                        {[0.25, 0.5, 0.75].map((pos, cIdx) => {
                          const cx =
                            lift.bottomTerminal.x +
                            (lift.topTerminal.x - lift.bottomTerminal.x) * pos;
                          const cy =
                            lift.bottomTerminal.y +
                            (lift.topTerminal.y - lift.bottomTerminal.y) * pos;
                          return (
                            <g key={cIdx} transform={`translate(${cx}, ${cy})`}>
                              <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="8"
                                stroke="#38bdf8"
                                strokeWidth="1.5"
                              />
                              <rect
                                x="-4"
                                y="8"
                                width="8"
                                height="5"
                                rx="1"
                                fill="#38bdf8"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* Terminals */}
                  <rect
                    x={lift.bottomTerminal.x - 10}
                    y={lift.bottomTerminal.y - 10}
                    width="20"
                    height="20"
                    rx="3"
                    fill="#18181b"
                    stroke="#facc15"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={lift.topTerminal.x - 10}
                    y={lift.topTerminal.y - 10}
                    width="20"
                    height="20"
                    rx="3"
                    fill="#18181b"
                    stroke="#facc15"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lift.bottomTerminal.x}
                    y={lift.bottomTerminal.y + 24}
                    fill="#fde68a"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {lift.name}
                  </text>
                </g>
              );
            })}

            {/* --------------------------------------------------------- */}
            {/* POINTS OF INTEREST (POIs) & CHALETS */}
            {/* --------------------------------------------------------- */}
            {zonePois.map((poi) => (
              <g
                key={poi.id}
                transform={`translate(${poi.coordinates.x}, ${poi.coordinates.y})`}
                className="select-none"
              >
                {/* Station highlights for backward compatibility */}
                {poi.id === "summit-shack" && isEventAtSummit && (
                  <circle
                    cx="0"
                    cy="0"
                    r="32"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    opacity="0.6"
                    className="animate-pulse"
                    data-testid="station-highlight-summit"
                  />
                )}
                {poi.id === "patrol-clinic" && isEventAtBase && (
                  <circle
                    cx="0"
                    cy="0"
                    r="38"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    opacity="0.6"
                    className="animate-pulse"
                    data-testid="station-highlight-base"
                  />
                )}

                <rect
                  x="-36"
                  y="-14"
                  width="72"
                  height="28"
                  rx="6"
                  fill="#09090b"
                  stroke={
                    poi.category === "medical"
                      ? "#00f0ff"
                      : poi.category === "chalet"
                        ? "#38bdf8"
                        : "#10b981"
                  }
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="0"
                  fill={poi.category === "medical" ? "#00f0ff" : "#bae6fd"}
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {poi.id === "summit-shack"
                    ? "SUMMIT"
                    : poi.id === "patrol-clinic"
                      ? "BASE AID ROOM"
                      : poi.name.split(" ")[0]}
                </text>
                <text
                  x="0"
                  y="10"
                  fill="#94a3b8"
                  fontSize="7"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {poi.elevationFt} FT
                </text>
              </g>
            ))}

            {/* --------------------------------------------------------- */}
            {/* SIMULATED SKIER TOKEN & SNOW SPRAY PARTICLES */}
            {/* --------------------------------------------------------- */}
            {activeSimulation?.active && currentSkierPosition && (
              <g
                transform={`translate(${currentSkierPosition.x}, ${
                  currentSkierPosition.y
                }) rotate(${
                  (currentSkierPosition.angleRad * 180) / Math.PI + 90
                })`}
                data-testid="simulated-skier-token"
              >
                {/* Snow spray particles carved backwards from skis */}
                <g fill="#ffffff" opacity="0.8">
                  <circle cx="-6" cy="14" r="2.5" />
                  <circle cx="6" cy="14" r="2.5" />
                  <circle cx="-10" cy="20" r="1.8" />
                  <circle cx="10" cy="20" r="1.8" />
                  <circle cx="-4" cy="26" r="1.2" />
                  <circle cx="4" cy="26" r="1.2" />
                </g>

                {/* Left and Right Skis */}
                <rect
                  x="-7"
                  y="-12"
                  width="3"
                  height="24"
                  rx="1.5"
                  fill="#facc15"
                  stroke="#ca8a04"
                  strokeWidth="0.5"
                />
                <rect
                  x="4"
                  y="-12"
                  width="3"
                  height="24"
                  rx="1.5"
                  fill="#facc15"
                  stroke="#ca8a04"
                  strokeWidth="0.5"
                />

                {/* Skier Body & Red NSP Cross Jacket */}
                <ellipse cx="0" cy="0" rx="5" ry="6" fill="#dc2626" />
                {/* Red NSP Cross */}
                <rect x="-1" y="-3" width="2" height="6" fill="#ffffff" />
                <rect x="-3" y="-1" width="6" height="2" fill="#ffffff" />

                {/* Skier Helmet */}
                <circle
                  cx="0"
                  cy="-3"
                  r="3.5"
                  fill="#09090b"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
              </g>
            )}

            {/* --------------------------------------------------------- */}
            {/* LIVE EMERGENCY RADAR BEACON (Active Dispatch Incident) */}
            {/* --------------------------------------------------------- */}
            {activeIncident && activeIncident.zone === activeZone && (
              <g
                transform={`translate(${activeIncident.x}, ${activeIncident.y})`}
                data-testid="emergency-radar-beacon"
              >
                {/* Concentric Pulsing Radar Rings */}
                <circle
                  cx="0"
                  cy="0"
                  r="36"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  className="patrol-radar-ping"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="24"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2"
                  opacity="0.6"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="12"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="4"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  !
                </text>
                <g transform="translate(0, -22)">
                  <rect
                    x="-46"
                    y="-12"
                    width="92"
                    height="18"
                    rx="4"
                    fill="#7f1d1d"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="1"
                    fill="#fee2e2"
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    DISPATCH INCIDENT
                  </text>
                </g>
              </g>
            )}

            {/* --------------------------------------------------------- */}
            {/* M8 AMBIENT OPERATIONAL EVENT PIN */}
            {/* --------------------------------------------------------- */}
            {activeAmbientEvent && ambientZone === activeZone && (
              <g
                transform={`translate(${activeAmbientEvent.coordinates.x}, ${activeAmbientEvent.coordinates.y})`}
                data-testid="ambient-event-pin"
              >
                <circle
                  cx="0"
                  cy="0"
                  r="20"
                  fill="#f59e0b"
                  opacity="0.35"
                  className="animate-ping"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="10"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="3.5"
                  fill="#09090b"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  !
                </text>
                <g transform="translate(0, -18)">
                  <rect
                    x="-35"
                    y="-12"
                    width="70"
                    height="16"
                    rx="3"
                    fill="#09090b"
                    stroke="#f59e0b"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x="0"
                    y="0"
                    fill="#fbbf24"
                    fontSize="7.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    OPERATIONS
                  </text>
                </g>
              </g>
            )}

            {/* Compass Rose */}
            <g transform={`translate(${baseWidth - 70}, 80)`} opacity="0.8">
              <circle
                cx="0"
                cy="0"
                r="22"
                fill="#09090b"
                stroke="#334155"
                strokeWidth="1.5"
              />
              <line
                x1="0"
                y1="-16"
                x2="0"
                y2="16"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <line
                x1="-16"
                y1="0"
                x2="16"
                y2="0"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <polygon points="0,-16 5,-6 -5,-6" fill="#00f0ff" />
              <text
                x="0"
                y="-18"
                fill="#00f0ff"
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                N
              </text>
            </g>
          </g>
        </svg>

        {/* ----------------------------------------------------------- */}
        {/* FLOATING HUD OVERLAYS */}
        {/* ----------------------------------------------------------- */}

        {/* Floating Sector Badge */}
        <div
          data-testid="mountain-sector-badge"
          className="absolute top-3 left-3 max-w-[calc(100%-24px)] bg-zinc-950/95 md:bg-zinc-950/85 md:backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-300 flex items-center gap-2 shadow-lg truncate"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              activeAmbientEvent || activeIncident
                ? "bg-amber-400"
                : "bg-emerald-400"
            } animate-pulse`}
          />
          <span className="truncate">
            Hill Sector:{" "}
            <strong>
              {activeAmbientEvent
                ? activeAmbientEvent.sector
                : activeZone === "back-bowl"
                  ? "The Back Bowl \u2022 Belle Creek Quad"
                  : "East & West Slopes \u2022 Main Mountain"}
            </strong>
          </span>
        </div>

        {/* Floating Trail Hover Tooltip */}
        {hoveredTrail && (
          <div
            data-testid="trail-hover-tooltip"
            className={`absolute z-20 bg-zinc-950/95 md:backdrop-blur-md border border-zinc-700/80 rounded-xl px-3.5 py-2 shadow-2xl font-mono text-xs pointer-events-none transition-all duration-150 ${
              activeSelectedTrail
                ? "top-14 right-3 max-w-xs"
                : "bottom-4 left-4 max-w-sm"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  backgroundColor: getDifficultyCoreColor(
                    hoveredTrail.difficulty
                  ),
                }}
              />
              <strong className="text-white text-xs">
                {hoveredTrail.name}
              </strong>
              <span className="text-[10px] text-zinc-400 capitalize">
                {hoveredTrail.difficulty.replace("-", " ")}
              </span>
              {hoveredTrail.groomed ? (
                <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                  Groomed
                </span>
              ) : (
                <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                  Moguls
                </span>
              )}
            </div>
            <div className="text-[10px] text-zinc-400 pt-1">
              {hoveredTrail.lengthFt.toLocaleString()} FT &bull;{" "}
              {hoveredTrail.verticalDropFt} FT Drop &bull;{" "}
              <span className="text-brand-cyan font-bold">
                {calculateAverageGrade(
                  hoveredTrail.verticalDropFt,
                  hoveredTrail.lengthFt
                )}
                % Grade
              </span>
            </div>
          </div>
        )}

        {/* Live Altitude Cursor HUD Badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-zinc-950/85 md:backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-1 text-[11px] font-mono text-zinc-300 hidden md:flex items-center gap-2 shadow-lg">
          <IconCompass className="w-3.5 h-3.5 text-brand-cyan" />
          <span>
            Live Terrain:{" "}
            <strong className="text-white">
              {cursorElevation
                ? `${cursorElevation.elevation.toLocaleString()} FT`
                : activeZone === "main"
                  ? "1,060 - 700 FT"
                  : "1,060 - 700 FT"}
            </strong>
          </span>
        </div>

        {/* Simulation Control Overlay (Active Descent) */}
        {activeSimulation?.active && (
          <div
            className="absolute top-14 left-3 bg-zinc-950/95 md:backdrop-blur-md border border-brand-cyan/50 rounded-2xl p-3 shadow-2xl font-mono text-xs max-w-xs space-y-2 z-30"
            data-testid="simulation-control-overlay"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
              <span className="font-bold text-brand-cyan truncate">
                Sim: {activeSimulation.trail.name}
              </span>
              <span className="text-[10px] text-zinc-400">
                {Math.round(activeSimulation.progress * 100)}%
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-brand-cyan h-full transition-all"
                style={{ width: `${activeSimulation.progress * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setSimulation((prev) =>
                    prev ? { ...prev, isPaused: !prev.isPaused } : prev
                  )
                }
                className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                aria-label={
                  activeSimulation.isPaused
                    ? "Resume simulation"
                    : "Pause simulation"
                }
              >
                {activeSimulation.isPaused ? (
                  <IconPlayerPlay className="w-4 h-4 text-emerald-400" />
                ) : (
                  <IconPlayerPause className="w-4 h-4 text-amber-400" />
                )}
              </button>
              {activeSimulation.progress >= 1.0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSimulation((prev) =>
                      prev ? { ...prev, progress: 0, isPaused: false } : prev
                    )
                  }
                  className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                  aria-label="Replay run"
                >
                  <IconRotateClockwise className="w-4 h-4 text-brand-cyan" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSimulation(null)}
                className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Cancel simulation"
              >
                <IconPlayerStop className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* MINIMAP RADAR WIDGET (160x100px) */}
        {/* ----------------------------------------------------------- */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1">
          {isMinimapExpanded && (
            <div
              className="w-40 h-28 bg-zinc-950/95 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl md:backdrop-blur-md flex flex-col p-1 relative"
              data-testid="minimap-radar-widget"
            >
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 px-1 border-b border-zinc-800/80 pb-0.5">
                <span>RADAR OVERVIEW</span>
                <span className="text-[8px] text-brand-cyan uppercase">
                  {activeZone}
                </span>
              </div>
              <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
                <svg
                  viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                  className="w-full h-full opacity-60"
                >
                  {/* Miniature trail outlines */}
                  {zoneTrails.map((t) => (
                    <path
                      key={t.id}
                      d={catmullRomToPath(t.points)}
                      fill="none"
                      stroke={getDifficultyCoreColor(t.difficulty)}
                      strokeWidth="10"
                    />
                  ))}
                  {/* Dynamic Viewport Bounding Box */}
                  <rect
                    x={baseWidth / 2 - (baseWidth / 2 + pan.x) / zoom}
                    y={baseHeight / 2 - (baseHeight / 2 + pan.y) / zoom}
                    width={baseWidth / zoom}
                    height={baseHeight / zoom}
                    fill="rgba(0, 240, 255, 0.15)"
                    stroke="#00f0ff"
                    strokeWidth="16"
                  />
                </svg>
              </div>
              {/* Quick Jump Anchors */}
              <div className="grid grid-cols-4 gap-1 pt-1 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => panToAnchor("main", 1250, 1170)}
                  className="min-h-[44px] min-w-[44px] text-[8px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-center truncate px-0.5 cursor-pointer flex items-center justify-center"
                  title="Pan to Main Chalet"
                >
                  Main
                </button>
                <button
                  type="button"
                  onClick={() => panToAnchor("main", 420, 1160)}
                  className="min-h-[44px] min-w-[44px] text-[8px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-center truncate px-0.5 cursor-pointer flex items-center justify-center"
                  title="Pan to East Chalet"
                >
                  East
                </button>
                <button
                  type="button"
                  onClick={() => panToAnchor("main", 1000, 160)}
                  className="min-h-[44px] min-w-[44px] text-[8px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-center truncate px-0.5 cursor-pointer flex items-center justify-center"
                  title="Pan to Summit Shack"
                >
                  Top
                </button>
                <button
                  type="button"
                  onClick={() => panToAnchor("back-bowl", 600, 460)}
                  className="min-h-[44px] min-w-[44px] text-[8px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-center truncate px-0.5 cursor-pointer flex items-center justify-center"
                  title="Pan to The Back Bowl"
                >
                  Bowl
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMinimapExpanded((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] p-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white rounded-lg flex items-center justify-center cursor-pointer shadow-md"
            aria-expanded={isMinimapExpanded}
            aria-label="Toggle Minimap Radar"
          >
            <IconCompass className="w-3.5 h-3.5 text-brand-cyan" />
          </button>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* TRAIL INSPECTOR CARD / MOBILE BOTTOM SHEET */}
        {/* ----------------------------------------------------------- */}
        {activeSelectedTrail && (
          <div
            className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 max-w-sm w-[calc(100%-24px)] sm:w-80 bg-zinc-950/95 border border-zinc-700/80 rounded-2xl p-4 shadow-2xl md:backdrop-blur-md z-30 font-mono space-y-3"
            data-testid="trail-inspector-card"
          >
            {/* Inspector Header */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-3 h-3 rounded-sm inline-block shrink-0"
                  style={{
                    backgroundColor: getDifficultyCoreColor(
                      activeSelectedTrail.difficulty
                    ),
                  }}
                />
                <h3 className="font-bold text-white text-sm truncate">
                  {activeSelectedTrail.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrail(null)}
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 p-2 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close trail inspector"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
              <div>
                <span className="text-zinc-400 block text-[9px] uppercase">
                  Sector
                </span>
                <span className="font-bold">{activeSelectedTrail.sector}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px] uppercase">
                  Surface
                </span>
                <span className="font-bold">
                  {activeSelectedTrail.groomed
                    ? "Corduroy Groomed"
                    : "Moguls / Glade"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px] uppercase">
                  Length
                </span>
                <span className="font-bold">
                  {activeSelectedTrail.lengthFt.toLocaleString()} FT
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px] uppercase">
                  Drop
                </span>
                <span className="font-bold">
                  {activeSelectedTrail.verticalDropFt} FT
                </span>
              </div>
            </div>

            {/* SVG Elevation Profile Sparkline */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Elevation Cross-Section</span>
                <span className="text-brand-cyan font-bold">
                  {calculateAverageGrade(
                    activeSelectedTrail.verticalDropFt,
                    activeSelectedTrail.lengthFt
                  )}
                  % Avg Grade
                </span>
              </div>
              <svg
                viewBox="0 0 240 60"
                className="w-full h-14 bg-zinc-900/80 rounded-lg p-1 border border-zinc-800"
                aria-label={`Elevation profile for ${activeSelectedTrail.name}`}
              >
                {/* Reference Gridlines */}
                <line
                  x1="20"
                  y1="14"
                  x2="220"
                  y2="14"
                  stroke="#334155"
                  strokeDasharray="2 2"
                  strokeWidth="0.75"
                />
                <line
                  x1="20"
                  y1="50"
                  x2="220"
                  y2="50"
                  stroke="#334155"
                  strokeDasharray="2 2"
                  strokeWidth="0.75"
                />

                {/* Profile Slope Area */}
                <polygon
                  points={`${activeSelectedTrail.points
                    .map((pt, idx) => {
                      const px =
                        20 +
                        (200 * idx) / (activeSelectedTrail.points.length - 1);
                      const elev = calculateElevationAt(
                        pt.x,
                        pt.y,
                        activeSelectedTrail.zone
                      );
                      const clampedElev = clamp(
                        elev,
                        activeSelectedTrail.baseElevationFt,
                        activeSelectedTrail.summitElevationFt
                      );
                      const py = 50 - (clampedElev - BASE_ELEVATION_FT) * 0.1;
                      return `${px.toFixed(1)},${py.toFixed(1)}`;
                    })
                    .join(" ")} 220,50 20,50`}
                  fill="rgba(56, 189, 248, 0.15)"
                />
                {/* Profile Slope Line */}
                <path
                  d={activeSelectedTrail.points
                    .map((pt, idx) => {
                      const px =
                        20 +
                        (200 * idx) / (activeSelectedTrail.points.length - 1);
                      const elev = calculateElevationAt(
                        pt.x,
                        pt.y,
                        activeSelectedTrail.zone
                      );
                      const clampedElev = clamp(
                        elev,
                        activeSelectedTrail.baseElevationFt,
                        activeSelectedTrail.summitElevationFt
                      );
                      const py = 50 - (clampedElev - BASE_ELEVATION_FT) * 0.1;
                      return `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Elevation Labels */}
                <text
                  x="22"
                  y="24"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {activeSelectedTrail.summitElevationFt}&apos;
                </text>
                <text
                  x="180"
                  y="46"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {activeSelectedTrail.baseElevationFt}&apos;
                </text>
              </svg>
            </div>

            <p className="text-xs font-sans text-zinc-300 leading-relaxed">
              {activeSelectedTrail.description}
            </p>

            {/* Run Simulation Action Button */}
            <button
              type="button"
              onClick={() =>
                setSimulation({
                  active: true,
                  trail: activeSelectedTrail,
                  progress: 0,
                  isPaused: false,
                })
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg"
            >
              <IconPlayerPlay className="w-4 h-4" />
              <span>Simulate Run Down Trail</span>
            </button>
          </div>
        )}

        {/* Floating Ambient Operational Event Toast */}
        {activeAmbientEvent && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 max-w-sm sm:max-w-md w-full pointer-events-auto">
            <AmbientEventToast
              // Keyed by event id so a TRIGGER_AMBIENT_EVENT that swaps one
              // active event for another remounts the card with clean
              // selection state instead of carrying the prior pick over.
              key={activeAmbientEvent.id}
              event={activeAmbientEvent}
              onResolveOption={handleResolveOption}
              onDismiss={handleDismiss}
            />
          </div>
        )}

        {/* Resolved Consequence Card */}
        {resolvedConsequence && !activeAmbientEvent && (
          <div
            data-testid="ambient-consequence-card"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 max-w-sm sm:max-w-md w-full bg-zinc-950/95 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl md:backdrop-blur-md font-mono space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 truncate">
                Ops Resolved &bull; {resolvedConsequence.optionLabel}
              </span>
              <button
                type="button"
                onClick={() => setResolvedConsequence(null)}
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 p-2 text-xs text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Dismiss resolution note"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-200 font-sans leading-relaxed">
              {resolvedConsequence.consequenceText}
            </p>
          </div>
        )}
      </div>

      {/* Map Attribution & Sector Information */}
      <p className="text-[10px] font-mono text-zinc-400 -mt-1">
        Welch Village (Welch, MN) recreation: East Slopes, West Slopes, and The
        Back Bowl. 50+ marked trails, 10 lifts, 9 facilities. Unofficial
        educational simulation. Not affiliated with or endorsed by Welch Village
        Ski Area.
      </p>

      {/* ------------------------------------------------------------- */}
      {/* 4. ACTION CONTROLS BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs font-mono text-zinc-400">
          Radio Frequency:{" "}
          <strong className="text-brand-cyan">154.570 MHz</strong> &bull;
          Listening for Base Dispatch...
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Routine Hill Check on-demand trigger */}
          <button
            type="button"
            onClick={() => {
              setResolvedConsequence(null);
              onTriggerAmbientEvent?.();
            }}
            disabled={Boolean(activeAmbientEvent)}
            aria-disabled={Boolean(activeAmbientEvent)}
            data-testid="routine-hill-check-btn"
            className={`w-full sm:w-auto min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl border font-mono text-xs font-bold transition-all inline-flex items-center justify-center gap-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
              activeAmbientEvent
                ? "bg-zinc-900/50 border-zinc-800 text-zinc-400 cursor-not-allowed opacity-60"
                : "bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] border-zinc-700 hover:border-brand-cyan/50 text-zinc-200 hover:text-white cursor-pointer"
            }`}
          >
            <IconAntenna
              className={`w-4 h-4 ${
                activeAmbientEvent ? "text-zinc-400" : "text-brand-cyan"
              }`}
            />
            <span>Routine Hill Check</span>
          </button>

          {incidentsCompleted >= 1 && (
            <button
              type="button"
              onClick={onCompleteShift}
              className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <IconFlag className="w-4 h-4" />
              <span>Call Final Sweep / Complete Shift</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAwaitDispatch}
            data-testid="map-await-dispatch-btn"
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/40">
              [1]
            </span>
            <IconRadio className="w-4 h-4" />
            <span>Standby on Hill / Await Dispatch</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. NSAA RESPONSIBILITY CODE ACCESSIBLE MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalContainer
        isOpen={isResponsibilityModalOpen}
        onClose={() => setIsResponsibilityModalOpen(false)}
        titleId="responsibility-modal-title"
        maxWidth="max-w-2xl"
        // Mobile skips the backdrop blur (GPU rasterization cost while
        // scrolling) and uses a denser scrim instead.
        overlayClassName="bg-black/90 md:bg-black/80 backdrop-blur-none md:backdrop-blur-sm"
        className="block p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <IconShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3
              id="responsibility-modal-title"
              className="font-mono font-bold text-white text-base sm:text-lg"
            >
              Your Responsibility Code
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsResponsibilityModalOpen(false)}
            className="min-h-[44px] min-w-[44px] p-2 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center cursor-pointer"
            aria-label="Close Safety Code"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 font-mono">
          National Ski Areas Association (NSAA) 10-Point Safety Rules. Patrol
          monitors and promotes these guidelines across all Welch Village
          terrain.
        </p>

        <div className="space-y-2.5">
          {RESPONSIBILITY_CODE.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                {item.number}
              </span>
              <div className="space-y-0.5">
                <h4 className="text-xs font-mono font-bold text-zinc-200">
                  {item.title}
                </h4>
                <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                  {item.rule}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setIsResponsibilityModalOpen(false)}
            className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-mono text-xs font-bold cursor-pointer"
          >
            Close Safety Code
          </button>
        </div>
      </ModalContainer>
    </div>
  );
};
