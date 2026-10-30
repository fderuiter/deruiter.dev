"use client";

import React, { useEffect, useRef } from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import { clamp } from "@/lib/game-utils";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import {
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerPause,
  IconTrophy,
  IconFileText,
  IconShieldCheck,
  IconFlame,
  IconArrowsShuffle,
  IconExternalLink,
  IconVolume,
  IconVolumeOff,
  IconClock,
  IconLock,
  IconDownload,
  IconCoffee,
  IconSparkles,
  IconDatabase,
  IconTable,
  IconHelp,
  IconBolt,
  IconMusic,
  IconMail,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { ChaosTouchDock } from "@/components/clinical-trial-chaos/ChaosTouchDock";
import "@/components/clinical-trial-chaos/clinical-chaos-touch.css";

import {
  CDISCDomain,
  AuditorState,
  GamePhase,
  GameMode,
  SignatureReason,
  PowerUpType,
  StressPresetId,
} from "@/lib/clinical-trial-chaos/types";

import { getObservationChoices } from "@/lib/clinical-trial-chaos/engine";

import { STRESS_PRESETS } from "@/lib/clinical-trial-chaos/scenarios";

import {
  getRoutingReadiness,
  OFFICES,
  MAX_CONVEYOR_SUBJECTS,
  getSponsorMoodLabel,
  getFollowUpSubject,
  OUTFITS,
  OutfitConfig,
  drawOutfitAvatar,
  getPowerUpRefusal,
  describePowerUpRefusal,
  POWER_UP_REFUSAL_LABELS,
  getPhaseProgress,
  getPhaseLockTarget,
  getViolationBreakdown,
  getLocksToNextAuditYear,
} from "@/lib/clinical-trial-chaos";
import { InspectionRoundDialog } from "@/components/clinical-trial-chaos/InspectionRoundDialog";

import {
  getConveyorGeometry,
  getVisibleSubjects,
} from "@/components/clinical-trial-chaos/conveyor-canvas";
import {
  DESK_FRACTION,
  getChuteIndexAt,
  getFolderIndexAt,
  getVerdictStamp,
  getReportTone,
} from "@/components/clinical-trial-chaos/floor-scene";
import { safeRemoveItem } from "@/lib/safe-storage";
import {
  CRF_ACTIVE_PROTOCOL_KEY,
  readStoredProtocol,
  useClinicalChaosSession,
} from "@/components/clinical-trial-chaos/useClinicalChaosSession";

const AUDITOR_BEHAVIOR_LABELS: Record<AuditorState["behavior"], string> = {
  patrolling: "Patrolling",
  inspecting: "Inspecting",
  suspicious: "Suspicious",
  issuing_483: "Writing a 483",
  coffee_break: "☕ Coffee break",
};

/** Reduced motion or a phone: folder events snap instead of flying. */
function prefersCalmMotion(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.innerWidth < 768 ||
    getMatchMediaMatches("(prefers-reduced-motion: reduce)")
  );
}

function timerBarColor(ratio: number): string {
  if (ratio > 0.5) return "bg-emerald-500";
  if (ratio > 0.25) return "bg-amber-500";
  return "bg-rose-500";
}

/** Small canvas preview of an outfit, drawn with the same renderer as the game. */
const OutfitPreview: React.FC<{ outfit: OutfitConfig }> = ({ outfit }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 44 * dpr;
    canvas.height = 56 * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOutfitAvatar(ctx, 22 * dpr, 53 * dpr, outfit, dpr);
  }, [outfit]);
  return <canvas ref={ref} aria-hidden="true" className="h-14 w-11 shrink-0" />;
};

/** The reduced-motion preference, read when the session asks. */
function readReducedMotion(): boolean {
  return getMatchMediaMatches("(prefers-reduced-motion: reduce)");
}

export const ClinicalTrialChaos: React.FC = () => {
  const touchCabinet = useCabinetTouch();
  const {
    activeAmendment,
    activeProtocol,
    activeSubject,
    activeTab,
    addAuditLog,
    amendmentEffects,
    announce,
    auditLogs,
    auditYear,
    auditor,
    bgmEnabled,
    bimoDialogRef,
    bimoReport,
    calibrationActive,
    calibrationStep,
    calibrationSubject,
    canvasRef,
    closeReportButtonRef,
    containerRef,
    conveyorSubjects,
    conveyorViewRef,
    downloadODMXML,
    downloadSDTMCSV,
    effectiveHighScore,
    endlessBest,
    filteredSDTMRows,
    firstFixOptionRef,
    fixDialogRef,
    flashStationId,
    fxFlashRef,
    fxStageRef,
    gameMode,
    gameOverReason,
    handleConfirmSignature,
    handleInitiateSubmission,
    handleInspectionAnswer,
    handleInspectionExtend,
    handleInspectionNext,
    handleInspectionTick,
    handleInspectionTimerEnabled,
    handleKeyDown,
    handleSelectChoice,
    handleSponsorChoice,
    headerBimoReport,
    hotkeyStations,
    inspectionRound,
    isFullscreen,
    isManualOpen,
    isMounted,
    isPaused,
    isPointerDownRef,
    isStressDrawerOpen,
    lastBimoReport,
    lastPointerTimeRef,
    lastTouchTimeRef,
    liveBimoReport,
    nextDossierCue,
    office,
    officeId,
    outfitId,
    pauseDialogOpen,
    pauseDialogRef,
    phase,
    phaseClearForm483,
    playState,
    powerUps,
    rejectedChoices,
    resumeButtonRef,
    routingNotice,
    ruleViolations,
    scorePops,
    scoreState,
    scoreTrend,
    sdtmDataset,
    sdtmFilterDomain,
    selectOutfit,
    selectedSubjectId,
    setActiveProtocol,
    setActiveTab,
    setBgmEnabled,
    setBimoReport,
    setGameMode,
    setIsManualOpen,
    setIsStressDrawerOpen,
    setOfficeId,
    setPlayState,
    setSdtmFilterDomain,
    setSelectedSubjectId,
    setSignatureModal,
    setSoundEnabled,
    setStressParams,
    setValidatingObs,
    signButtonRef,
    signatureDialogRef,
    signatureModal,
    skipCalibration,
    soundEnabled,
    sponsor,
    startGame,
    stations,
    stressParams,
    stressSheetRef,
    submittedHistory,
    targetRoutingStation,
    terminalContainerRef,
    toggleFullscreen,
    togglePause,
    triggerPowerUp,
    triggerSound,
    validatingObs,
    watchedStationId,
  } = useClinicalChaosSession({
    touch: touchCabinet,
    readReducedMotion,
    readCalmMotion: prefersCalmMotion,
  });

  // SSR check
  if (!isMounted) {
    return (
      <section
        aria-labelledby="clinical-chaos-heading"
        className="rounded-2xl border border-brand-blue/25 bg-zinc-950/80 p-5 shadow-[0_0_30px_-12px_rgba(59,130,246,0.35)]"
      >
        <h2
          id="clinical-chaos-heading"
          className="text-xl font-bold font-mono text-zinc-100"
        >
          INITIALIZING CLINICAL TRIAL CHAOS ARCADE...
        </h2>
      </section>
    );
  }

  // A tap on a folder selects it; a tap on a chute routes the active folder
  // there, exactly like its station button. Dragging only selects.
  const sortedStations = hotkeyStations;

  const handleCanvasClickOrTouch = (
    clientX: number,
    clientY: number,
    allowRoute = true
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = conveyorViewRef.current;
    const x = (clientX - rect.left) * (view.width / rect.width);
    const y = (clientY - rect.top) * (view.height / rect.height);
    const geometry = getConveyorGeometry(view.width, view.height);
    const visible = getVisibleSubjects(
      conveyorSubjects,
      selectedSubjectId,
      geometry.visibleSlots
    );
    const folderIndex = getFolderIndexAt(geometry, x, y, visible.length);
    if (folderIndex >= 0) {
      setSelectedSubjectId(visible[folderIndex].id);
      triggerSound("validate");
      return;
    }
    if (!allowRoute || playState !== "playing" || isPaused) return;
    const chuteIndex = getChuteIndexAt(
      geometry,
      view.width,
      sortedStations.length,
      x,
      y
    );
    if (chuteIndex >= 0)
      handleInitiateSubmission(sortedStations[chuteIndex].id);
  };

  const preventCancelable = (e: React.SyntheticEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const now = Date.now();
    if (now - lastTouchTimeRef.current < 100) return;
    lastPointerTimeRef.current = now;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for environments without setPointerCapture mock
    }
    isPointerDownRef.current = true;
    handleCanvasClickOrTouch(e.clientX, e.clientY);
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (isPointerDownRef.current) {
      const now = Date.now();
      if (now - lastTouchTimeRef.current < 100) return;
      lastPointerTimeRef.current = now;
      handleCanvasClickOrTouch(e.clientX, e.clientY, false);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    isPointerDownRef.current = false;
  };

  const handleCanvasPointerCancel = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    isPointerDownRef.current = false;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    preventCancelable(e);
    const now = Date.now();
    if (now - lastPointerTimeRef.current < 100) return;
    lastTouchTimeRef.current = now;
    isPointerDownRef.current = true;

    const touch = e.touches[0];
    if (touch) {
      handleCanvasClickOrTouch(touch.clientX, touch.clientY);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    preventCancelable(e);
    if (isPointerDownRef.current) {
      const now = Date.now();
      if (now - lastPointerTimeRef.current < 100) return;
      lastTouchTimeRef.current = now;
      const touch = e.touches[0];
      if (touch) {
        handleCanvasClickOrTouch(touch.clientX, touch.clientY, false);
      }
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    preventCancelable(e);
    isPointerDownRef.current = false;
  };

  const handleCanvasTouchCancel = (e: React.TouchEvent<HTMLCanvasElement>) => {
    preventCancelable(e);
    isPointerDownRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const now = Date.now();
    if (
      now - lastPointerTimeRef.current < 400 ||
      now - lastTouchTimeRef.current < 400
    ) {
      return;
    }
    handleCanvasClickOrTouch(e.clientX, e.clientY);
  };

  // Derived guidance for the "what do I do next" flow: fix → route → sign
  // The header counts this phase's locks against this phase's target (#1673).
  const phaseProgress = getPhaseProgress(scoreState, gameMode, phase);
  const phaseTarget = phaseProgress.target ?? getPhaseLockTarget(phase);
  const violationBreakdown = getViolationBreakdown(
    scoreState,
    ruleViolations.length
  );
  const flaggedObs =
    activeSubject?.observations.filter((o) => !o.isResolved) ?? [];
  const nextFlaggedObs = flaggedObs[0] ?? null;
  const routingReadiness = getRoutingReadiness(activeSubject, stations);

  const routeDomains: CDISCDomain[] =
    routingReadiness.unresolvedCount === 0
      ? routingReadiness.matchingDomains
      : [];
  const flowStep: 0 | 1 | 2 = !activeSubject ? 0 : nextFlaggedObs ? 1 : 2;
  const stationHotkey = (id: CDISCDomain) =>
    sortedStations.findIndex((s) => s.id === id) + 1;

  // `overlay` lays the email over the conveyor board on a wide cabinet, so
  // the stations and lifelines stay on screen while it is open (#1327).
  const renderSponsorEmailCard = (overlay: boolean) =>
    sponsor.activeRequest ? (
      <section
        aria-label="Sponsor email"
        className={`overflow-hidden rounded-xl border ${
          sponsor.activeRequest.followUps > 0
            ? "border-rose-500/50 bg-rose-500/5"
            : "border-amber-500/40 bg-amber-500/5"
        }`}
      >
        <div className="h-1 bg-zinc-800">
          {/* The sponsor commits once per displayed second, so a linear
              one-second transition keeps the bar moving between commits (#1639). */}
          <div
            className={`h-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${
              sponsor.activeRequest.followUps > 0
                ? "bg-rose-500"
                : "bg-amber-500"
            }`}
            style={{
              width: `${Math.max(
                0,
                (sponsor.activeRequest.timeRemaining /
                  (sponsor.activeRequest.followUps > 0
                    ? 12
                    : sponsor.activeRequest.request.deadlineSeconds)) *
                  100
              )}%`,
            }}
          />
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0" aria-live="polite">
              <p className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <IconMail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="break-words">
                  {sponsor.activeRequest.request.from} ·{" "}
                  {sponsor.activeRequest.request.role}
                </span>
              </p>
              <p className="mt-0.5 text-xs font-bold text-zinc-100 break-words">
                {sponsor.activeRequest.followUps > 0
                  ? getFollowUpSubject(
                      sponsor.activeRequest.request,
                      sponsor.activeRequest.followUps
                    )
                  : sponsor.activeRequest.request.subject}
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-amber-300">
              {Math.ceil(sponsor.activeRequest.timeRemaining)}s
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400 break-words">
            {sponsor.activeRequest.request.body}
          </p>
          <div className={`mt-2 grid gap-1.5 ${overlay ? "grid-cols-3" : ""}`}>
            {sponsor.activeRequest.request.choices.map((choice, idx) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => handleSponsorChoice(idx)}
                className="min-h-[44px] min-w-0 rounded-lg border border-zinc-700 bg-[#0d0e11] px-3 py-2 text-left text-[11px] font-bold text-zinc-200 break-words transition hover:border-amber-500/60 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                {choice.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            Ignore it and they will follow up. Twice.
          </p>
        </div>
      </section>
    ) : null;
  const sponsorEmailCard = renderSponsorEmailCard(false);

  // A protocol amendment in force, shown with the work it changes.
  const amendmentBanner =
    playState === "playing" && activeAmendment && activeAmendment.active ? (
      <div
        role="status"
        className="overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/5"
      >
        <div className="flex items-start justify-between gap-3 px-3 py-2">
          <div className="flex min-w-0 items-start gap-2">
            <IconArrowsShuffle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300 break-words">
                Protocol amendment: {activeAmendment.title}
              </p>
              <p className="text-[11px] text-zinc-400 break-words">
                {activeAmendment.description}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums text-amber-300">
            {Math.ceil(activeAmendment.timeRemaining)}s
          </span>
        </div>
        <div className="h-1 bg-zinc-800">
          {/* Committed once per displayed second: glide for the whole second (#1639). */}
          <div
            className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
            style={{
              width: `${Math.max(0, (activeAmendment.timeRemaining / activeAmendment.durationSeconds) * 100)}%`,
            }}
          />
        </div>
      </div>
    ) : null;

  // Lasting amendment rules (#2053), shown for as long as they are in force,
  // which can outlast the amendment's own banner.
  const doubleSignatureLeft = amendmentEffects.doubleSignature
    ? amendmentEffects.doubleSignature.required -
      amendmentEffects.doubleSignature.countersigned
    : 0;
  const amendmentRulesBanner =
    playState === "playing" &&
    (amendmentEffects.spotInspection || doubleSignatureLeft > 0) ? (
      <div
        role="status"
        data-testid="cc-amendment-rules"
        className="space-y-1 rounded-xl border border-amber-500/40 bg-[#13151a] px-3 py-2 text-[11px]"
      >
        {amendmentEffects.spotInspection && (
          <p className="flex min-w-0 items-start gap-2 text-zinc-300 break-words">
            <span className="shrink-0 rounded bg-amber-500 px-1 text-[9px] font-bold uppercase text-[#0d0e11]">
              FDA
            </span>
            <span className="min-w-0">
              <span className="font-bold text-amber-300">
                GCP spot inspection at the{" "}
                {amendmentEffects.spotInspection.stationId} station.
              </span>{" "}
              The investigator checks every CRF routed there against source. A
              misroute there counts double.
            </span>
          </p>
        )}
        {doubleSignatureLeft > 0 && (
          <p className="flex min-w-0 items-start gap-2 text-zinc-300 break-words">
            <IconLock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="font-bold text-amber-300">
                Double-signature audit: {doubleSignatureLeft} CRF
                {doubleSignatureLeft === 1 ? "" : "s"} left.
              </span>{" "}
              Each needs an author signature and an independent reviewer
              countersignature (21 CFR 11.50).
            </span>
          </p>
        )}
      </div>
    ) : null;

  // The two ways to lose, as segmented gauges with their losing zone marked.
  const GAUGE_SEGMENTS = 20;
  const suspicionLit = Math.round(
    (clamp(auditor.suspicion, 0, 100) / 100) * GAUGE_SEGMENTS
  );
  const suspicionTone =
    auditor.suspicion > 75
      ? "rose"
      : auditor.suspicion > 40
        ? "amber"
        : "emerald";
  const moodLit = Math.round(
    (clamp(sponsor.mood, 0, 100) / 100) * GAUGE_SEGMENTS
  );
  const moodTone =
    sponsor.mood < 25 ? "rose" : sponsor.mood < 45 ? "amber" : "emerald";
  const GAUGE_FILL = {
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
  } as const;
  const GAUGE_TEXT = {
    rose: "text-rose-400",
    amber: "text-amber-300",
    emerald: "text-emerald-400",
  } as const;
  const pressureMeters = (
    <>
      <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#13151a] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconShieldCheck
              className={`h-3.5 w-3.5 shrink-0 ${
                auditor.suspicion > 60 ? "text-rose-400" : "text-zinc-400"
              }`}
              aria-hidden="true"
            />
            <span className="truncate font-bold uppercase tracking-wider text-zinc-300">
              FDA
              <span className="hidden sm:inline"> AUDITOR SCRUTINY</span>
            </span>
          </span>
          <span
            className={`shrink-0 text-sm font-bold tabular-nums ${GAUGE_TEXT[suspicionTone]}`}
          >
            {Math.round(auditor.suspicion)}%
          </span>
        </div>
        <div
          className="mt-1.5 flex h-2.5 gap-[2px]"
          role="meter"
          aria-label="FDA auditor suspicion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(auditor.suspicion)}
        >
          {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`min-w-0 flex-1 rounded-[1px] ${
                i < suspicionLit
                  ? GAUGE_FILL[suspicionTone]
                  : i >= GAUGE_SEGMENTS * 0.75
                    ? "bg-rose-500/20"
                    : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              auditor.behavior === "issuing_483"
                ? "bg-rose-600 text-white"
                : auditor.behavior === "suspicious"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {AUDITOR_BEHAVIOR_LABELS[auditor.behavior]}
          </span>
          <span className="hidden truncate text-[9px] text-zinc-400 sm:inline">
            100% = Form 483
          </span>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#13151a] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconMail
              className={`h-3.5 w-3.5 shrink-0 ${
                sponsor.mood < 25 ? "text-rose-400" : "text-zinc-400"
              }`}
              aria-hidden="true"
            />
            <span className="truncate font-bold uppercase tracking-wider text-zinc-300">
              SPONSOR
              <span className="hidden sm:inline"> SATISFACTION</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              className="hidden text-[10px] tabular-nums text-zinc-400 sm:inline"
              title="Shortcuts you took to please the sponsor. The inspector will find them."
            >
              🦴 {sponsor.skeletons.length}
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${GAUGE_TEXT[moodTone]}`}
            >
              {Math.round(sponsor.mood)}%
            </span>
          </span>
        </div>
        <div
          className="mt-1.5 flex h-2.5 gap-[2px]"
          role="meter"
          aria-label="Sponsor satisfaction"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sponsor.mood)}
        >
          {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`min-w-0 flex-1 rounded-[1px] ${
                i < moodLit
                  ? GAUGE_FILL[moodTone]
                  : i < GAUGE_SEGMENTS * 0.25
                    ? "bg-rose-500/20"
                    : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <p className="mt-1.5 truncate text-[10px] italic text-zinc-400">
          {getSponsorMoodLabel(sponsor.mood)}
        </p>
      </div>
    </>
  );

  // Phase lock or shift end: the inspection verdict as a stamp (#1521).
  const verdictStamp = getVerdictStamp(
    playState,
    lastBimoReport?.verdict,
    gameOverReason
  );

  // The stress panel's content, shared by the desktop drawer and the touch
  // cabinet's sheet.
  const stressDrawerBody = (
    <>
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <IconBolt className="h-5 w-5 text-amber-400" />
          <h2 id="cc-stress-title" className="text-sm font-bold text-zinc-100">
            Stress Control & BIMO Stream
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsStressDrawerOpen(false)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close Stress Control Drawer"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-3 space-y-5 pr-1">
        {/* 1. Stress Parameter Overrides & Presets */}
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              ⚡ Stress Parameters
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono">
              21 CFR § 11 / § 812
            </span>
          </div>

          {/* Presets */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Scenario Presets:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STRESS_PRESETS) as StressPresetId[]).map((key) => {
                const preset = STRESS_PRESETS[key];
                const isActive =
                  stressParams.arrivalRateMultiplier ===
                    preset.params.arrivalRateMultiplier &&
                  stressParams.errorChance === preset.params.errorChance &&
                  stressParams.auditorPacingMultiplier ===
                    preset.params.auditorPacingMultiplier;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStressParams({ ...preset.params })}
                    className={`min-h-[44px] rounded-lg px-2.5 py-1.5 text-left text-xs transition border ${
                      isActive
                        ? "border-amber-500 bg-amber-500/20 text-amber-200 font-bold"
                        : "border-zinc-800 bg-zinc-800/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-semibold">{preset.name}</div>
                    <div className="text-[10px] text-zinc-400 line-clamp-1">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-3 pt-2">
            {/* Arrival Rate */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-300">Subject Arrival Rate</span>
                <span className="tabular-nums text-amber-400 font-bold">
                  {stressParams.arrivalRateMultiplier.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={stressParams.arrivalRateMultiplier}
                onChange={(e) =>
                  setStressParams((prev) => ({
                    ...prev,
                    arrivalRateMultiplier: parseFloat(e.target.value),
                  }))
                }
                aria-label="Subject Arrival Rate Slider"
                className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>0.5x (Slow)</span>
                <span>1.0x (Normal)</span>
                <span>3.0x (Surge)</span>
              </div>
            </div>

            {/* Error Chance */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-300">Observation Error Chance</span>
                <span className="tabular-nums text-amber-400 font-bold">
                  {Math.round(stressParams.errorChance * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={stressParams.errorChance}
                onChange={(e) =>
                  setStressParams((prev) => ({
                    ...prev,
                    errorChance: parseFloat(e.target.value),
                  }))
                }
                aria-label="Observation Error Chance Slider"
                className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>0% (Clean)</span>
                <span>50% (Standard)</span>
                <span>100% (High Error)</span>
              </div>
            </div>

            {/* Auditor Pacing */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-300">Auditor Inspection Pacing</span>
                <span className="tabular-nums text-amber-400 font-bold">
                  {stressParams.auditorPacingMultiplier.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={stressParams.auditorPacingMultiplier}
                onChange={(e) =>
                  setStressParams((prev) => ({
                    ...prev,
                    auditorPacingMultiplier: parseFloat(e.target.value),
                  }))
                }
                aria-label="Auditor Inspection Pacing Slider"
                className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                <span>0.5x (Relaxed)</span>
                <span>1.0x (Standard)</span>
                <span>3.0x (Intense Patrol)</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Live BIMO Compliance Stream */}
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live BIMO Stream
            </h3>
            <span className="text-[10px] tabular-nums font-mono text-zinc-400">
              Score: {liveBimoReport.overallScore}%
            </span>
          </div>

          {/* Score & Verdict Header */}
          <div className="flex items-center justify-between rounded-lg bg-zinc-950 p-2.5 border border-zinc-800">
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                Score &amp; Trend
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold tabular-nums text-white">
                  {liveBimoReport.overallScore}/100
                </span>
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${
                    scoreTrend === "improving"
                      ? "text-emerald-400"
                      : scoreTrend === "declining"
                        ? "text-rose-400"
                        : "text-zinc-400"
                  }`}
                >
                  {scoreTrend === "improving" && "▲ Improving"}
                  {scoreTrend === "declining" && "▼ Declining"}
                  {scoreTrend === "stable" && "▶ Stable"}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                Verdict Status
              </div>
              <div
                className={`text-xs font-bold mt-0.5 rounded px-2 py-0.5 inline-block ${
                  liveBimoReport.verdict.startsWith("NAI")
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : liveBimoReport.verdict.startsWith("VAI")
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                {liveBimoReport.verdict.split(" ")[0]}
              </div>
            </div>
          </div>

          {/* Warning Banner if threshold violations occur */}
          {(liveBimoReport.verdict.startsWith("OAI") ||
            liveBimoReport.findings.some((f) => f.severity === "Critical")) && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-xs text-rose-200 flex items-start gap-2 animate-pulse">
              <IconAlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">
                  REGULATORY THRESHOLD VIOLATION
                </div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  Corrective action needed now. Form 483 and clinical hold (21
                  CFR § 312.42) risk elevated.
                </div>
              </div>
            </div>
          )}

          {/* Findings Stream */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 mb-2 flex justify-between">
              <span>
                Regulatory Findings ({liveBimoReport.findings.length}):
              </span>
              <span className="text-[10px] text-zinc-400">Live Feed</span>
            </div>

            {liveBimoReport.findings.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center text-xs text-zinc-400">
                <IconShieldCheck className="mx-auto h-5 w-5 text-emerald-400 mb-1" />
                No regulatory violations detected. Site systems compliant.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {liveBimoReport.findings.map((f, i) => (
                  <div
                    key={f.id || i}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 space-y-1 text-left"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-zinc-300">
                        {f.id}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                          f.severity === "Critical"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : f.severity === "Major"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-snug">
                      {f.description}
                    </p>
                    <div className="text-[10px] text-amber-400/90 font-mono">
                      📜 {f.regulation}
                    </div>
                    {f.actionableGuidance && (
                      <div className="text-[10px] text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 rounded p-1 mt-1">
                        💡 <strong>Guidance:</strong> {f.actionableGuidance}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );

  // The touch cabinet leaves Escape to the game while a shift runs, a sheet is
  // open or the inspection report is up: a dialog closes, the shift pauses,
  // and the cabinet stays open. Elsewhere Escape leaves the cabinet (#2105).
  const escapeHandledHere =
    touchCabinet &&
    (playState === "playing" || !!bimoReport || isStressDrawerOpen);

  return (
    <div
      ref={containerRef}
      data-keyboard-boundary="true"
      data-escape-docks={escapeHandledHere ? "true" : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`@container relative w-full font-mono focus:outline-none transition-all ${
        touchCabinet ? "cc-touch " : ""
      }${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-[#0d0e11] p-3 sm:p-4 overflow-y-auto select-none"
          : "rounded-2xl border border-white/[0.08] bg-[#0d0e11] p-2.5 sm:p-4 focus-visible:ring-1 focus-visible:ring-amber-500/50"
      }`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full mb-4" />

      {/* HUD: score, combo, phase goal, office, audio */}
      <h2 id="clinical-chaos-heading" className="sr-only">
        Clinical Trial Chaos: CDISC Compliance
      </h2>
      <div
        className={`flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-2 text-xs${
          touchCabinet ? " cc-hud" : ""
        }`}
      >
        <div className="relative flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-800 bg-[#13151a] px-2.5 sm:px-3">
          <IconTrophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="sr-only text-[10px] uppercase text-zinc-400 sm:not-sr-only">
            Score:
          </span>
          <span className="font-bold tabular-nums text-white">
            {scoreState.score}
          </span>
          <span className="hidden text-[10px] tabular-nums text-zinc-400 sm:inline">
            {gameMode === "endless"
              ? `Best ${endlessBest.score} · Y${endlessBest.auditYear}`
              : `Best ${effectiveHighScore}`}
          </span>
          {scorePops.map((pop) => (
            <span
              key={pop.id}
              aria-hidden="true"
              className={`cc-score-pop pointer-events-none absolute -top-2 right-2 text-xs font-bold tabular-nums ${
                pop.tone === "good" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {pop.text}
            </span>
          ))}
        </div>

        <div
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#13151a] px-2.5 sm:px-3"
          title="Lock CRFs back-to-back to build a combo. Every 3 in a row raises the multiplier."
        >
          <IconFlame
            className={`h-4 w-4 ${
              scoreState.combo > 2 ? "text-amber-400" : "text-zinc-400"
            }`}
            aria-hidden="true"
          />
          <span className="sr-only text-[10px] uppercase text-zinc-400 sm:not-sr-only">
            Combo:
          </span>
          <span className="font-bold tabular-nums text-zinc-100">
            {scoreState.combo}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
              scoreState.multiplier > 1
                ? "bg-amber-500/15 text-amber-300"
                : "text-zinc-400"
            }`}
          >
            ×{scoreState.multiplier}
          </span>
        </div>

        <div className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-[#13151a] px-2.5 sm:px-3">
          <span className="text-[10px] uppercase text-zinc-400">
            {gameMode === "campaign" ? `Phase ${phase}/3` : "Endless"}
          </span>
          {gameMode === "endless" && (
            <span
              data-testid="cc-audit-year"
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-300"
              title={`Every few locked CRFs start a new Audit Year and the floor gets harder. ${getLocksToNextAuditYear(scoreState.subjectsSubmitted)} more to the next.`}
            >
              Audit Year {auditYear}
            </span>
          )}
          {gameMode === "campaign" && (
            <span
              className="flex items-center gap-1"
              role="img"
              aria-label={`${Math.min(phaseProgress.locked, phaseTarget)} of ${phaseTarget} CRFs locked in this phase`}
            >
              {Array.from({ length: phaseTarget }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-sm transition-colors ${
                    i < phaseProgress.locked ? "bg-emerald-400" : "bg-zinc-700"
                  }`}
                />
              ))}
            </span>
          )}
          <span className="tabular-nums text-zinc-300">
            {phaseProgress.locked}
            {gameMode === "campaign" ? `/${phaseTarget}` : ""}
            <span className="hidden sm:inline"> locked</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {playState === "playing" && (
            // Compact, like the audio toggles beside it, so the header keeps
            // one row with a four-digit score at 1280px.
            <button
              type="button"
              onClick={togglePause}
              aria-label={isPaused ? "Resume shift" : "Pause shift"}
              aria-keyshortcuts="P"
              title={isPaused ? "Resume the shift (P)" : "Pause the shift (P)"}
              className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-[#13151a] px-2 text-xs font-bold text-zinc-300 transition hover:text-white"
            >
              {isPaused ? (
                <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />
              ) : (
                <IconPlayerPause className="h-4 w-4" aria-hidden="true" />
              )}
              <kbd
                aria-hidden="true"
                className="rounded border border-zinc-700 px-1 text-[10px] font-normal text-zinc-400"
              >
                P
              </kbd>
            </button>
          )}
          <FieldManualButton
            manualId="clinical-chaos"
            label="Manual"
            onOpenChange={setIsManualOpen}
          />
          <button
            type="button"
            onClick={() => setBgmEnabled(!bgmEnabled)}
            aria-pressed={bgmEnabled}
            aria-label="Background music"
            title="Toggle 8-bit background music"
            className={`flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border transition ${
              bgmEnabled
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-[#13151a] text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <IconMusic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-pressed={soundEnabled}
            aria-label="Sound effects"
            title={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-800 bg-[#13151a] text-zinc-400 transition hover:text-white"
          >
            {soundEnabled ? (
              <IconVolume className="h-4 w-4 text-brand-cyan" />
            ) : (
              <IconVolumeOff className="h-4 w-4 text-zinc-400" />
            )}
          </button>
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            variant="header"
          />
        </div>
      </div>

      {/* View switcher */}
      <div
        className={`mt-2 flex flex-wrap items-center justify-between gap-2${
          touchCabinet ? " cc-tabs" : ""
        }`}
      >
        <div className="flex gap-1 overflow-x-auto" aria-label="Game views">
          {(
            [
              {
                id: "conveyor",
                label: "Conveyor Floor",
                short: "Floor",
                icon: <IconBolt className="h-3.5 w-3.5" />,
                badge: null,
              },
              {
                id: "sdtm_studio",
                label: "Live SDTM Studio",
                short: "SDTM",
                icon: <IconDatabase className="h-3.5 w-3.5" />,
                badge: sdtmDataset.length,
              },
              {
                id: "audit_trail",
                label: "Audit Trail Log",
                short: "Audit",
                icon: <IconFileText className="h-3.5 w-3.5" />,
                badge: null,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "border border-zinc-700 bg-zinc-800 text-zinc-100"
                  : "border border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge !== null && (
                <span className="rounded bg-zinc-900 px-1.5 text-[10px] tabular-nums text-zinc-400">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}

          {/* Stress Control & BIMO Stream Toggle Button. Its visible words
              are its name, so speech input users can say what they see (axe
              label-content-name-mismatch, #2571); the title says more. */}
          <button
            type="button"
            onClick={() => setIsStressDrawerOpen((prev) => !prev)}
            aria-expanded={isStressDrawerOpen}
            title="Toggle the interactive stress control panel and live BIMO stream"
            className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition border ${
              isStressDrawerOpen
                ? "border-amber-500 bg-amber-500/20 text-amber-200"
                : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-zinc-600 hover:text-white"
            }`}
          >
            <IconBolt className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">Stress & BIMO Stream</span>{" "}
            <span className="sm:hidden">Stress</span>{" "}
            {headerBimoReport && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  headerBimoReport.verdict.startsWith("NAI")
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : headerBimoReport.verdict.startsWith("VAI")
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                {headerBimoReport.overallScore}% (
                {headerBimoReport.verdict.split(" ")[0]})
              </span>
            )}
          </button>
        </div>
        <span className="hidden min-w-0 items-center gap-1.5 text-[10px] text-zinc-400 sm:flex">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: office.accentColor }}
          />
          <span className="truncate">{office.name}</span>
        </span>
        {activeProtocol && (
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-zinc-400">
            <span className="truncate">
              Protocol {activeProtocol.protocolNumber}
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveProtocol(null);
                safeRemoveItem(CRF_ACTIVE_PROTOCOL_KEY);
                addAuditLog(
                  "Switched simulation engine to Built-in Preset Scenarios.",
                  "INFO"
                );
              }}
              className="min-h-[44px] rounded-lg border border-zinc-700 px-2 text-zinc-300 hover:bg-zinc-800"
            >
              Use Built-in Presets
            </button>
          </div>
        )}
      </div>

      {/* Other views keep the two pressure meters and the amendment in view. */}
      {activeTab !== "conveyor" && playState !== "idle" && (
        <div className="mt-3 grid grid-cols-2 gap-2">{pressureMeters}</div>
      )}
      {activeTab !== "conveyor" && amendmentBanner && (
        <div className="mt-3">{amendmentBanner}</div>
      )}
      {activeTab !== "conveyor" && amendmentRulesBanner && (
        <div className="mt-3">{amendmentRulesBanner}</div>
      )}

      {/* TAB 1: the floor (#1521). The belt and its chutes fill the top, the
          active CRF sits on a clipboard below, and the queue, lifelines and
          meters live in a slim side rail, so the whole shift fits one
          1280x800 screen. */}
      {activeTab === "conveyor" && (
        <div
          className={`mt-2 grid grid-cols-1 gap-3 ${
            playState !== "idle" ? "@3xl:grid-cols-[minmax(0,1fr)_15.5rem]" : ""
          }${touchCabinet ? ` cc-floor cc-floor-${playState}` : ""}`}
        >
          <div
            className={`flex min-w-0 flex-col gap-2${
              touchCabinet ? " cc-main" : ""
            }`}
          >
            <div
              className={`mx-auto w-full max-w-[56rem]${
                touchCabinet ? " cc-stage" : ""
              }`}
            >
              <div
                ref={fxStageRef}
                className="relative isolate overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0e11]"
              >
                <canvas
                  ref={canvasRef}
                  width={760}
                  height={260}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerCancel}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                  onTouchCancel={handleCanvasTouchCancel}
                  onClick={handleCanvasClick}
                  style={{ touchAction: "none" }}
                  role="application"
                  aria-label="Clinical Trial Chaos floor. Tap a folder to select it or a chute to route the active folder. Left and right arrows change the selected subject, Enter takes the next step, and Tab moves to the game's other controls."
                  tabIndex={0}
                  className="block w-full aspect-[13/5] cursor-pointer touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 md:aspect-[760/260]"
                />

                {/* Off-screen Accessible DOM Fallback Subtree */}
                <div
                  className="sr-only"
                  aria-label="Clinical Trial Chaos Accessible Subtree"
                >
                  <fieldset>
                    <legend>
                      Clinical Trial Chaos SDTM Simulator State and Controls
                    </legend>

                    <div
                      role="group"
                      aria-label="Clinical Trial Telemetry and Status"
                    >
                      <output htmlFor="clinical-score">
                        Score: {scoreState.score}
                      </output>
                      <output htmlFor="clinical-highscore">
                        High Score: {effectiveHighScore}
                      </output>
                      <output htmlFor="clinical-phase">
                        Phase: {phase} of 3
                      </output>
                      <output htmlFor="clinical-playstate">
                        Play State: {playState}
                      </output>
                      <output htmlFor="clinical-paused">
                        Shift clocks:{" "}
                        {playState !== "playing"
                          ? "stopped"
                          : isPaused
                            ? "paused"
                            : isManualOpen
                              ? "paused while the Field Manual is open"
                              : "running"}
                      </output>
                      <output htmlFor="clinical-auditor">
                        BIMO Auditor Behavior: {auditor.behavior} (Suspicion:{" "}
                        {Math.round(auditor.suspicion)}%)
                      </output>
                      <output htmlFor="clinical-protocol">
                        Protocol: {activeProtocol?.protocolId || "P-001"} v
                        {activeProtocol?.version || "1.0"}
                      </output>
                      <output htmlFor="clinical-active-subjects">
                        Active Subjects on Conveyor: {conveyorSubjects.length}
                      </output>
                    </div>

                    <div
                      role="group"
                      aria-label="Interactive Clinical Trial Actions"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          playState === "phase_cleared"
                            ? startGame(
                                "campaign",
                                (phase < 3 ? phase + 1 : 1) as GamePhase
                              )
                            : startGame(gameMode, 1)
                        }
                        disabled={playState === "playing"}
                      >
                        {playState === "phase_cleared"
                          ? `Start Phase ${phase < 3 ? phase + 1 : 1}`
                          : "Start Phase 1"}
                      </button>

                      <button
                        type="button"
                        onClick={togglePause}
                        disabled={playState !== "playing"}
                        aria-pressed={isPaused}
                      >
                        {isPaused ? "Resume Shift" : "Pause Shift"} (P)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGameMode("campaign");
                          announce("Switched mode to Campaign", "polite");
                        }}
                        aria-pressed={gameMode === "campaign"}
                      >
                        Campaign Mode
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGameMode("endless");
                          announce(
                            "Switched mode to Endless BIMO Audit",
                            "polite"
                          );
                        }}
                        aria-pressed={gameMode === "endless"}
                      >
                        Endless BIMO Audit Mode
                      </button>

                      {/* Active Conveyor Subject Controls */}
                      {conveyorSubjects.map((sub) => (
                        <div
                          key={sub.id}
                          id={`sub-${sub.id}`}
                          role="group"
                          aria-label={`Subject ${sub.subjectLabel} Controls`}
                        >
                          <output htmlFor={`sub-${sub.id}`}>
                            Subject {sub.subjectLabel} ({sub.studySite}): Time
                            Remaining {Math.round(sub.timeRemaining)}s
                          </output>
                          {sub.observations.map((obs) => (
                            <button
                              key={obs.id}
                              type="button"
                              onClick={() => {
                                setValidatingObs({
                                  subjectId: sub.id,
                                  obs,
                                  selectedChoice: undefined,
                                  feedback: undefined,
                                });
                                announce(
                                  `Selected observation ${obs.destination} for Subject ${sub.subjectLabel}`,
                                  "polite"
                                );
                              }}
                            >
                              Inspect Observation: {obs.destination} -{" "}
                              {obs.rawValue}
                            </button>
                          ))}
                        </div>
                      ))}

                      {/* These use the same action and readiness rules as the visible lifelines. */}
                      {(
                        [
                          ["fda-coffee-break", "Coffee Break"],
                          ["auto-clean", "Auto Clean"],
                          ["query-extension", "Query Extension"],
                          ["fast-sign", "Fast-Track"],
                        ] as const
                      ).map(([type, label]) => {
                        const refusal = getPowerUpRefusal(
                          powerUps,
                          type,
                          playState === "playing",
                          activeSubject
                        );
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => triggerPowerUp(type)}
                            disabled={refusal !== null}
                          >
                            Activate {label} ({powerUps[type].charge} of{" "}
                            {powerUps[type].maxCharge} charge)
                            {refusal === "nothing_to_clean" ||
                            refusal === "no_dossier"
                              ? `: ${POWER_UP_REFUSAL_LABELS[refusal]}`
                              : ""}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                {/* Kit flash layer for a wrong route (useArcadeFx). */}
                <div
                  ref={fxFlashRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0"
                />

                {playState === "playing" && sponsor.activeRequest && (
                  <div
                    className={`absolute inset-x-2 top-2 max-h-[calc(100%-1rem)] overflow-y-auto rounded-xl bg-[#13151a] shadow-2xl ${
                      touchCabinet ? "block" : "hidden @3xl:block"
                    }`}
                  >
                    {renderSponsorEmailCard(true)}
                  </div>
                )}

                {playState === "idle" && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                    <span className="rounded-full border border-white/[0.08] bg-[#0d0e11]/90 px-3 py-1 text-[11px] text-zinc-300">
                      Conveyor idle · clock in below
                    </span>
                  </div>
                )}

                {/* Phase lock or shift end: the verdict slams onto the floor. */}
                {verdictStamp && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
                    <div
                      key={`${playState}-${phase}-${verdictStamp.code}`}
                      data-testid="cc-verdict-stamp"
                      role="img"
                      aria-label={`${verdictStamp.code}: ${verdictStamp.caption}`}
                      className={`cc-verdict-stamp flex flex-col items-center rounded-lg border-[3px] px-5 py-2 ${
                        verdictStamp.tone === "good"
                          ? "border-emerald-400 text-emerald-300"
                          : verdictStamp.tone === "warn"
                            ? "border-amber-400 text-amber-300"
                            : "border-rose-500 text-rose-400"
                      }`}
                    >
                      <span className="text-4xl font-extrabold leading-none tracking-[0.08em]">
                        {verdictStamp.code}
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                        {verdictStamp.caption}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Station strip: one button per chute, lined up under it. The
                  touch cabinet has the same keys in its dock instead. */}
              {playState === "playing" && !touchCabinet && (
                <section aria-label="EDC stations" className="relative mt-1.5">
                  <h3 className="sr-only">
                    Route to station, keys 1 to {sortedStations.length}
                  </h3>
                  {routingNotice &&
                    routingNotice.subjectId === activeSubject?.id &&
                    routingNotice.unresolvedCount ===
                      routingReadiness.unresolvedCount && (
                      <p
                        className={`absolute bottom-full left-[10%] right-0 z-10 mb-1.5 rounded-lg border px-2.5 py-2 text-xs shadow-xl ${
                          routingNotice.unresolvedCount > 0
                            ? "border-amber-500/50 bg-[#1f1a10] text-amber-200"
                            : "border-rose-500/60 bg-[#221214] text-rose-200"
                        }`}
                      >
                        {routingNotice.message}
                      </p>
                    )}
                  <div
                    className="relative grid gap-1"
                    style={{
                      paddingLeft: `${DESK_FRACTION * 100}%`,
                      gridTemplateColumns: `repeat(${sortedStations.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 w-[10%] -translate-y-1/2 pr-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wider text-zinc-400"
                    >
                      Route
                      <br />
                      1–{sortedStations.length}
                    </span>
                    {sortedStations.map((station, index) => {
                      const matches =
                        !!activeSubject &&
                        routingReadiness.matchingDomains.includes(station.id);
                      const accepts = matches && flowStep === 2;
                      const isFlashing = flashStationId === station.id;
                      const isWatched = watchedStationId === station.id;
                      return (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => handleInitiateSubmission(station.id)}
                          title={`${station.label}: ${station.name}${
                            isWatched
                              ? " (GCP spot inspection: a misroute here counts double)"
                              : ""
                          }`}
                          className={`group relative min-h-[48px] min-w-0 overflow-hidden rounded-lg border px-2 pb-1.5 pt-2 text-left transition active:scale-[0.98] ${
                            isWatched ? "ring-2 ring-inset ring-amber-500 " : ""
                          }${
                            isFlashing
                              ? "border-emerald-400 bg-emerald-500/20"
                              : accepts
                                ? "border-emerald-500/70 bg-emerald-500/10"
                                : matches
                                  ? "border-amber-500/60 bg-amber-500/10"
                                  : activeSubject
                                    ? "border-white/[0.06] bg-[#0d0e11] [&_h4]:text-zinc-400"
                                    : "border-white/[0.08] bg-[#13151a] hover:border-zinc-600"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-x-0 top-0 h-[3px]"
                            style={{ backgroundColor: station.color }}
                          />
                          <span className="flex items-center justify-between gap-1">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <kbd className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                                {index + 1}
                              </kbd>
                              <h4 className="min-w-0 truncate text-xs font-bold text-white">
                                <span aria-hidden="true">{station.id}</span>
                                <span className="sr-only">{station.label}</span>
                              </h4>
                            </span>
                            {isWatched && (
                              <span
                                data-testid="cc-watched-station"
                                className="shrink-0 rounded bg-amber-500 px-1 text-[9px] font-bold uppercase text-[#0d0e11]"
                              >
                                FDA
                                <span className="sr-only">
                                  {" "}
                                  inspector watching: a misroute here counts
                                  double
                                </span>
                              </span>
                            )}
                            <span
                              className="shrink-0 text-[10px] font-bold tabular-nums text-emerald-400"
                              title="CRFs submitted here"
                            >
                              <span className="sr-only">Submits:</span>
                              {station.processedCount}
                            </span>
                          </span>
                          <span
                            className={`mt-0.5 block truncate text-[9px] ${
                              accepts
                                ? "font-bold text-emerald-300"
                                : matches
                                  ? "font-bold text-amber-300"
                                  : "text-zinc-400"
                            }`}
                          >
                            {accepts
                              ? "Accepts ✓"
                              : matches
                                ? "Fix first"
                                : activeSubject
                                  ? "Other domain"
                                  : station.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {amendmentBanner}
            {amendmentRulesBanner}

            {/* Narrow cabinets: the urgent sponsor email sits above the work */}
            {playState === "playing" && sponsorEmailCard && !touchCabinet && (
              <div className="@3xl:hidden">{sponsorEmailCard}</div>
            )}

            {playState === "playing" ? (
              <section
                aria-labelledby="cc-dossier-title"
                className="relative min-w-0 rounded-xl border border-white/[0.08] bg-[#13151a] px-3 pb-3 pt-4"
              >
                {/* The clipboard's clip. */}
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-0 h-3 w-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-zinc-500/60 bg-gradient-to-b from-zinc-500 to-zinc-700"
                />
                {activeSubject ? (
                  <div>
                    {/* The timer stays the header's second child, after the
                        title block; the stepper sits between them visually. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="order-1 min-w-0">
                        <span className="block truncate text-[10px] text-zinc-400">
                          <span className="font-bold uppercase tracking-wider">
                            Active CRF
                          </span>{" "}
                          · {activeSubject.studySite}
                        </span>
                        <h3
                          id="cc-dossier-title"
                          className="flex flex-wrap items-center gap-2 text-base font-bold tracking-[-0.02em] text-white"
                        >
                          {activeSubject.subjectLabel}
                          {activeSubject.isSAE && (
                            <span className="rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-300">
                              ⚡ SAE expedited
                            </span>
                          )}
                        </h3>
                        {nextDossierCue?.subjectId === activeSubject.id && (
                          <p className="mt-1 text-[10px] font-bold text-emerald-300">
                            {nextDossierCue.text}
                          </p>
                        )}
                      </div>
                      <span
                        className={`order-3 flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${
                          activeSubject.timeRemaining / activeSubject.maxTime <
                          0.25
                            ? "text-rose-400"
                            : "text-amber-300"
                        }`}
                      >
                        <IconClock className="h-4 w-4" aria-hidden="true" />
                        {Math.ceil(activeSubject.timeRemaining)}s
                      </span>
                      {/* Fix → Route → Dispatch stepper */}
                      <ol
                        className="order-2 ml-auto flex gap-1 text-[10px]"
                        aria-label="CRF progress"
                      >
                        {[
                          {
                            label:
                              flaggedObs.length > 0
                                ? `Fix (${flaggedObs.length})`
                                : "Clean",
                            done: flowStep > 1,
                            current: flowStep === 1,
                          },
                          {
                            label: "Route",
                            done: false,
                            current: flowStep === 2,
                          },
                          { label: "Dispatch", done: false, current: false },
                        ].map((step, i) => (
                          <li
                            key={step.label}
                            aria-current={step.current ? "step" : undefined}
                            className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${
                              step.current
                                ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                                : step.done
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                                  : "border-white/[0.08] text-zinc-400"
                            }`}
                          >
                            <span className="font-bold tabular-nums">
                              {step.done ? "✓" : i + 1}
                            </span>
                            <span className="whitespace-nowrap">
                              {step.label}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Next action */}
                    {nextFlaggedObs ? (
                      <button
                        type="button"
                        onClick={() =>
                          setValidatingObs({
                            subjectId: activeSubject.id,
                            obs: nextFlaggedObs,
                          })
                        }
                        className="mt-2 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-left transition hover:bg-amber-500/15 active:scale-[0.99]"
                      >
                        <span className="min-w-0 text-xs text-zinc-200">
                          <span className="font-bold text-amber-300">
                            Next:
                          </span>{" "}
                          {nextFlaggedObs.field} reads{" "}
                          <span className="font-bold text-rose-300">
                            {nextFlaggedObs.currentValue}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-amber-300">
                          Fix it
                          <kbd className="rounded border border-amber-500/40 px-1 text-[10px]">
                            Enter
                          </kbd>
                        </span>
                      </button>
                    ) : (
                      <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5">
                        <p className="text-xs text-zinc-200">
                          <span className="font-bold text-emerald-300">
                            Clean.
                          </span>{" "}
                          Route it to a matching station. Routine packets
                          dispatch immediately; exceptional packets need review.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {routeDomains.map((domain) => (
                            <button
                              key={domain}
                              type="button"
                              onClick={() => handleInitiateSubmission(domain)}
                              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-black transition hover:bg-emerald-400 active:scale-[0.98]"
                            >
                              <kbd className="rounded bg-black/15 px-1 text-[10px]">
                                {stationHotkey(domain)}
                              </kbd>
                              Route to {domain}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* First-shift calibration (#834) */}
                    {calibrationActive && calibrationSubject && (
                      <section
                        aria-label="First-shift calibration"
                        data-testid="cc-calibration"
                        className="mt-2 rounded-lg border border-blue-400/40 bg-blue-400/5 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                            First-shift calibration · clocks paused
                          </p>
                          <ol
                            className="flex gap-1 text-[10px]"
                            aria-label="Calibration steps"
                          >
                            {(
                              [
                                ["fix", "1 Fix"],
                                ["route", "2 Route"],
                                ["sign", "3 Sign"],
                              ] as const
                            ).map(([step, label]) => {
                              const current = calibrationStep === step;
                              const done =
                                step === "fix" && calibrationStep === "route";
                              return (
                                <li
                                  key={step}
                                  aria-current={current ? "step" : undefined}
                                  className={`rounded-md border px-1.5 py-0.5 ${
                                    current
                                      ? "border-blue-300/60 bg-blue-400/15 font-bold text-white"
                                      : done
                                        ? "border-emerald-500/30 text-emerald-300"
                                        : "border-white/[0.08] text-zinc-400"
                                  }`}
                                >
                                  {done ? "✓ " : ""}
                                  {label}
                                </li>
                              );
                            })}
                          </ol>
                          <button
                            type="button"
                            onClick={skipCalibration}
                            className="ml-auto min-h-9 shrink-0 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-200 hover:border-zinc-500 hover:text-white active:scale-[0.98]"
                          >
                            Skip calibration
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-zinc-200">
                          {calibrationStep === "fix"
                            ? "Fix: open the flagged field and pick the compliant value (Enter, then 1–4)."
                            : "Route: send the clean CRF to its matching chute. Routine packets dispatch at once; SAE and phase-lock packets open the signature review."}
                        </p>
                        {activeSubject.id !== calibrationSubject.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSubjectId(calibrationSubject.id)
                            }
                            className="mt-2 min-h-9 rounded-lg border border-blue-400/40 px-3 text-xs font-bold text-blue-200 hover:bg-blue-400/10 active:scale-[0.98]"
                          >
                            Back to {calibrationSubject.subjectLabel}
                          </button>
                        )}
                      </section>
                    )}

                    {/* Observations */}
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2 @3xl:grid-cols-3">
                      {activeSubject.observations.map((obs) => (
                        <button
                          key={obs.id}
                          type="button"
                          onClick={() =>
                            setValidatingObs({
                              subjectId: activeSubject.id,
                              obs,
                            })
                          }
                          className={`cursor-pointer min-h-[44px] min-w-0 rounded-lg border px-2.5 py-2 text-left transition active:scale-[0.99] ${
                            !obs.isResolved
                              ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-400"
                              : "border-white/[0.08] bg-[#0d0e11] hover:border-zinc-700"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-bold text-zinc-300">
                              {obs.field}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-100">
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    stations.find(
                                      (st) => st.id === obs.destination
                                    )?.color ?? "#94a3b8",
                                }}
                              />
                              {obs.destination}
                            </span>
                          </span>
                          {/* The flagged value is what the player judges, so it
                              wraps rather than truncating (#2173). */}
                          <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                            <span
                              className={`min-w-0 break-words text-sm font-bold ${
                                !obs.isResolved
                                  ? "text-amber-300"
                                  : "text-zinc-100"
                              }`}
                            >
                              {obs.currentValue}
                            </span>
                            {!obs.isResolved ? (
                              <span className="shrink-0 text-[10px] font-bold text-amber-300">
                                Validate Choice →
                              </span>
                            ) : (
                              <IconCheck
                                className="h-4 w-4 shrink-0 text-emerald-400"
                                aria-label="Resolved"
                              />
                            )}
                          </span>
                          {obs.hint && !obs.isResolved && (
                            <span className="mt-1.5 block text-[10px] italic text-amber-400/80">
                              {obs.hint}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    Queue clear. Enjoy the silence while it lasts.
                  </p>
                )}
              </section>
            ) : playState === "idle" ? (
              <section
                aria-labelledby="cc-briefing-title"
                className="@container rounded-xl border border-white/[0.08] bg-[#13151a] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0 max-w-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Shift briefing
                    </p>
                    <h3
                      id="cc-briefing-title"
                      className="mt-1 text-lg font-bold tracking-[-0.02em] text-zinc-100"
                    >
                      Clean the data. Lock the CRFs. Keep everyone happy.
                    </h3>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {gameMode === "campaign"
                        ? `Lock ${getPhaseLockTarget(1)} CRFs to clear Phase 1, then ${getPhaseLockTarget(2)} more in Phase 2 and ${getPhaseLockTarget(3)} more in Phase 3. Each phase is busier than the last.`
                        : "No finish line. Lock as many CRFs as you can before someone ends your career."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className="flex rounded-lg border border-zinc-800 bg-[#0d0e11] p-0.5"
                      role="group"
                      aria-label="Game mode"
                    >
                      {(["campaign", "endless"] as GameMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setGameMode(mode)}
                          aria-pressed={gameMode === mode}
                          className={`min-h-[44px] rounded-md px-3 text-xs font-bold transition ${
                            gameMode === mode
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:text-zinc-300"
                          }`}
                        >
                          {mode === "campaign" ? "Campaign" : "Endless"}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => startGame(gameMode, 1)}
                      className="flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-amber-400 active:scale-[0.98]"
                    >
                      <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />
                      {gameMode === "campaign"
                        ? "Start 3-Phase Campaign"
                        : "Start Endless Sprint"}
                    </button>
                  </div>
                </div>

                {/* How a shift works, shown rather than told */}
                <ol className="mt-5 grid grid-cols-1 gap-2 @2xl:grid-cols-3">
                  <li className="rounded-lg border border-zinc-800 bg-[#0d0e11] p-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-400">
                      1 · Fix
                    </p>
                    <div
                      className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-xs"
                      aria-hidden="true"
                    >
                      <span className="text-zinc-400">Height</span>
                      <span className="font-bold text-rose-300 line-through">
                        180 m
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="font-bold text-emerald-300">180 cm</span>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Click the flagged field and pick the CDISC-standard value.
                    </p>
                  </li>
                  <li className="rounded-lg border border-zinc-800 bg-[#0d0e11] p-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-400">
                      2 · Route
                    </p>
                    <div
                      className="mt-2 flex items-center gap-2 text-xs"
                      aria-hidden="true"
                    >
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        VS
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="rounded-md border border-emerald-500/70 bg-emerald-500/10 px-2 py-1 font-bold text-zinc-100">
                        VS Station{" "}
                        <span className="text-[9px] text-emerald-300">✓</span>
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Send the clean CRF to a station that matches its data.
                      Matching stations light up.
                    </p>
                  </li>
                  <li className="rounded-lg border border-zinc-800 bg-[#0d0e11] p-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-400">
                      3 · Sign
                    </p>
                    <div
                      className="mt-2 flex items-center gap-2 text-xs"
                      aria-hidden="true"
                    >
                      <IconLock className="h-4 w-4 text-brand-cyan" />
                      <span className="rounded-md border border-cyan-500/50 bg-cyan-950/40 px-2 py-1 font-bold text-cyan-200">
                        Intent to Submit
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Pick a valid signature reason. Back-to-back locks build
                      your combo.
                    </p>
                  </li>
                </ol>

                {/* The two ways to lose */}
                <div
                  className="mt-2 grid grid-cols-1 gap-2 @xl:grid-cols-2"
                  aria-label="How you lose"
                >
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#0d0e11] p-3">
                    <IconShieldCheck
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-zinc-300">
                        FDA auditor hits{" "}
                        <span className="font-bold text-rose-300">100%</span> →
                        Form 483
                      </p>
                      <div
                        className="mt-1 h-1 rounded-full bg-gradient-to-r from-emerald-500/60 via-amber-500/60 to-rose-500"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#0d0e11] p-3">
                    <IconMail
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-zinc-300">
                        Sponsor hits{" "}
                        <span className="font-bold text-rose-300">0%</span> →
                        study moves to another CRO
                      </p>
                      <div
                        className="mt-1 h-1 rounded-full bg-gradient-to-r from-rose-500 via-amber-500/60 to-emerald-500/60"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                {/* Office picker */}
                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <h4
                    id="clinical-office-picker-heading"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-300"
                  >
                    Pick your office
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    Each one bends the rules
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="clinical-office-picker-heading"
                  className="mt-2 grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-3"
                >
                  {OFFICES.map((o) => {
                    const isSelected = o.id === officeId;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setOfficeId(o.id);
                          announce(`Office set to ${o.name}`, "polite");
                        }}
                        className={`min-h-[44px] min-w-0 rounded-lg border p-3 text-left transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                          isSelected
                            ? "border-amber-500/70 bg-amber-500/5"
                            : "border-zinc-800 bg-[#0d0e11] hover:border-zinc-600"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: o.accentColor }}
                            />
                            <span className="min-w-0 text-xs font-bold text-zinc-100 break-words">
                              {o.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-[9px] uppercase text-zinc-400">
                            {o.difficulty}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] italic text-zinc-400 break-words">
                          {o.tagline}
                        </span>
                        <span className="mt-2 block text-[10px] text-amber-300/90 break-words">
                          {o.quirk}
                        </span>
                        <span className="mt-1 block text-[10px] tabular-nums text-zinc-400">
                          {o.modifiers.scoreMultiplier}× score
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Outfit picker (cosmetic) */}
                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <h4
                    id="clinical-outfit-picker-heading"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-300"
                  >
                    Pick your outfit
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    Cosmetic only. The auditor judges you anyway.
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="clinical-outfit-picker-heading"
                  className="mt-2 grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-3"
                >
                  {OUTFITS.map((o) => {
                    const isSelected = o.id === outfitId;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          selectOutfit(o.id);
                          announce(`Outfit set to ${o.name}`, "polite");
                        }}
                        className={`flex min-h-[44px] min-w-0 items-center gap-3 rounded-lg border p-2.5 text-left transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                          isSelected
                            ? "border-amber-500/70 bg-amber-500/5"
                            : "border-zinc-800 bg-[#0d0e11] hover:border-zinc-600"
                        }`}
                      >
                        <OutfitPreview outfit={o} />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-zinc-100 break-words">
                            {o.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] italic text-zinc-400 break-words">
                            {o.tagline}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Authored protocol hand-off */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3 text-[11px] text-zinc-400">
                  <span className="min-w-0 break-words">
                    {activeProtocol
                      ? `Using your authored protocol ${activeProtocol.protocolNumber} (${activeProtocol.forms?.length || 0} forms).`
                      : "Using built-in scenarios. Authored a study in CRF Studio? Play it here."}
                  </span>
                  {!activeProtocol && (
                    <button
                      type="button"
                      onClick={() => {
                        const stored = readStoredProtocol();
                        if (stored) {
                          setActiveProtocol(stored);
                          addAuditLog(
                            `Loaded active protocol ${stored.protocolNumber} into simulation.`,
                            "COMPLIANT"
                          );
                          announce("Authored protocol loaded", "polite");
                          return;
                        }
                        announce(
                          "No authored protocol found. Author one in CRF Studio first.",
                          "polite"
                        );
                        addAuditLog(
                          "No authored protocol found. Author one in CRF Studio and click 'Simulate Protocol'.",
                          "WARN"
                        );
                      }}
                      className="min-h-[44px] rounded-lg border border-zinc-700 px-3 font-bold text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Load Authored Protocol
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section
                aria-labelledby="cc-end-title"
                className={`rounded-xl border p-5 text-center ${
                  playState === "phase_cleared"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-rose-500/40 bg-rose-500/5"
                }`}
              >
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                    playState === "phase_cleared"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                  aria-hidden="true"
                >
                  {playState === "phase_cleared" ? (
                    <IconShieldCheck className="h-5 w-5" />
                  ) : gameOverReason === "sponsor" ? (
                    <IconMail className="h-5 w-5" />
                  ) : (
                    <IconAlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <h3
                  id="cc-end-title"
                  className={`mt-3 text-base font-bold tracking-[-0.02em] ${
                    playState === "phase_cleared"
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {playState === "phase_cleared"
                    ? phaseClearForm483
                      ? phase < 3
                        ? `PHASE ${phase} LOCKED… AND A 483 IS IN THE MAIL`
                        : "DATABASE LOCKED… AND A 483 IS IN THE MAIL"
                      : phase < 3
                        ? `PHASE ${phase} COMPLIANCE AUDIT PASSED!`
                        : "DATABASE LOCKED: READY FOR NDA SUBMISSION!"
                    : gameOverReason === "sponsor"
                      ? "CONTRACT TERMINATED · STUDY MOVED TO ANOTHER CRO"
                      : "FORM 483 ISSUED · STUDY ON CLINICAL HOLD"}
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400">
                  {playState === "phase_cleared"
                    ? phase < 3
                      ? `Phase ${phase + 1} opens more EDC stations and a faster conveyor, and asks for ${getPhaseLockTarget((phase + 1) as GamePhase)} more locks. Your score carries over.`
                      : "Database locked. All trial data validated and archived."
                    : gameOverReason === "sponsor"
                      ? "Sponsor satisfaction hit 0%. They 'decided to go in a different direction' and awarded the study to a vendor whose bid was 40% cheaper and entirely hypothetical."
                      : "Auditor suspicion reached 100%. The inspector wrote up a Form 483, and the source data discrepancies put the study on clinical hold under 21 CFR § 312.42."}
                </p>
                {phaseClearForm483 && (
                  <div
                    className="mx-auto mt-3 max-w-md rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-left"
                    data-testid="cc-phase-483"
                  >
                    <p className="text-xs font-bold text-rose-300">
                      The data locked, but the inspection verdict is OAI: FDA
                      Form 483 issued.
                    </p>
                    {phaseClearForm483.length > 0 && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-zinc-300 break-words">
                        {phaseClearForm483.map((cause) => (
                          <li key={cause}>{cause}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <dl className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-2 text-left sm:grid-cols-4">
                  {[
                    {
                      label:
                        gameMode === "campaign" ? "Campaign score" : "Score",
                      value: scoreState.score,
                      tone: "text-white",
                      // Endless keeps its own best, apart from the campaign (#2053).
                      detail:
                        gameMode === "endless"
                          ? `Audit Year ${auditYear} · endless best ${endlessBest.score} (Year ${endlessBest.auditYear})`
                          : undefined,
                    },
                    {
                      label: "CRFs locked",
                      value: scoreState.subjectsSubmitted,
                      tone: "text-emerald-300",
                    },
                    {
                      // Expired subjects, misrouted CRFs and wrong fixes, the
                      // same breakdown the inspection report uses (#1670).
                      label: "Violations",
                      value: violationBreakdown.total,
                      detail: `${violationBreakdown.expired} expired · ${violationBreakdown.misrouted} misrouted · ${violationBreakdown.wrongFixes} wrong ${violationBreakdown.wrongFixes === 1 ? "fix" : "fixes"}`,
                      tone: "text-rose-300",
                    },
                    {
                      label: "Skeletons",
                      value: sponsor.skeletons.length,
                      tone: "text-amber-300",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-zinc-800 bg-[#0d0e11] p-2"
                    >
                      <dt className="text-[10px] uppercase text-zinc-400">
                        {stat.label}
                      </dt>
                      <dd
                        className={`text-sm font-bold tabular-nums ${stat.tone}`}
                      >
                        {stat.value}
                      </dd>
                      {stat.detail && (
                        <dd className="mt-0.5 text-[10px] leading-snug text-zinc-400 break-words">
                          {stat.detail}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {playState === "phase_cleared" ? (
                    <button
                      type="button"
                      onClick={() =>
                        startGame(
                          "campaign",
                          (phase < 3 ? phase + 1 : 1) as GamePhase
                        )
                      }
                      className="flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400 active:scale-[0.98]"
                    >
                      <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />
                      {phase < 3
                        ? `Advance to Phase ${phase + 1}`
                        : "Play Victory Lap / Re-run"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startGame(gameMode, 1)}
                      className="flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-amber-400 active:scale-[0.98]"
                    >
                      <IconRefresh className="h-4 w-4" aria-hidden="true" />
                      {gameMode === "campaign"
                        ? "Restart Phase I"
                        : "Restart Endless Sprint"}
                    </button>
                  )}
                  {lastBimoReport && (
                    <button
                      type="button"
                      onClick={() => setBimoReport(lastBimoReport)}
                      className="flex min-h-[48px] items-center gap-2 rounded-xl border border-zinc-700 px-4 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800"
                    >
                      <IconFileText className="h-4 w-4" aria-hidden="true" />
                      Inspection report
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPlayState("idle")}
                    className="min-h-[48px] rounded-xl px-4 text-xs font-bold text-zinc-400 transition hover:text-zinc-200"
                  >
                    Change office
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Side rail: meters, queue and lifelines. */}
          {playState !== "idle" && (
            <aside
              aria-label="Shift status"
              className="flex min-w-0 flex-col gap-2"
            >
              <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-1">
                {pressureMeters}
              </div>

              {playState === "playing" && (
                <section
                  aria-label="Queue"
                  className="rounded-xl border border-white/[0.08] bg-[#13151a] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Queue · {conveyorSubjects.length}/{MAX_CONVEYOR_SUBJECTS}
                    </span>
                    <span className="text-[10px] text-zinc-400">← → cycle</span>
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-1.5 @3xl:grid-cols-2">
                    {conveyorSubjects.length === 0 && (
                      <li className="col-span-2 py-3 text-[11px] text-zinc-400">
                        Waiting for the next packet from site…
                      </li>
                    )}
                    {conveyorSubjects.map((sub) => {
                      const left = sub.observations.filter(
                        (o) => !o.isResolved
                      ).length;
                      const ratio =
                        sub.maxTime > 0 ? sub.timeRemaining / sub.maxTime : 0;
                      const isSelected = sub.id === activeSubject?.id;
                      return (
                        <li key={sub.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedSubjectId(sub.id)}
                            aria-pressed={isSelected}
                            className={`flex min-h-[48px] w-full min-w-0 flex-col justify-between rounded-lg border px-2 py-1.5 text-left transition active:scale-[0.98] ${
                              isSelected
                                ? "border-amber-500/70 bg-amber-500/10"
                                : sub.isSAE
                                  ? "border-rose-500/40 bg-[#0d0e11] hover:border-rose-400"
                                  : "border-white/[0.08] bg-[#0d0e11] hover:border-zinc-600"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-1">
                              <span
                                className={`truncate text-[11px] font-bold ${
                                  isSelected
                                    ? "text-amber-100"
                                    : "text-zinc-200"
                                }`}
                              >
                                {sub.subjectLabel}
                              </span>
                              {sub.isSAE && (
                                <span className="shrink-0 rounded bg-rose-500/20 px-1 text-[9px] font-bold text-rose-300">
                                  SAE
                                </span>
                              )}
                            </span>
                            <span
                              className={`text-[10px] ${
                                left > 0 ? "text-amber-300" : "text-emerald-400"
                              }`}
                            >
                              {left > 0 ? `${left} to fix` : "Ready ✓"}
                            </span>
                            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-zinc-800">
                              {/* Subject clocks commit every half second (whole
                                  and rounded seconds), matching this 500 ms glide (#1639). */}
                              <span
                                className={`block h-full transition-[width] duration-500 ease-linear motion-reduce:transition-none ${timerBarColor(ratio)}`}
                                style={{
                                  width: `${clamp(ratio * 100, 0, 100)}%`,
                                }}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {playState === "playing" && !touchCabinet && (
                <section
                  aria-label="Lifelines"
                  className="rounded-xl border border-white/[0.08] bg-[#13151a] p-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span>Lifelines</span>
                    <span className="font-normal normal-case text-zinc-400">
                      Charge by dispatching
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    {(
                      [
                        "fda-coffee-break",
                        "auto-clean",
                        "query-extension",
                        "fast-sign",
                      ] as PowerUpType[]
                    ).map((type) => {
                      const p = powerUps[type];
                      const isReady = p.charge >= p.maxCharge;
                      const isActive = p.activeSecondsRemaining > 0;
                      // A charged lifeline that cannot change the open
                      // dossier says why instead of READY (#1673).
                      const refusal = getPowerUpRefusal(
                        powerUps,
                        type,
                        true,
                        activeSubject
                      );
                      const blockedLabel =
                        refusal === "nothing_to_clean" ||
                        refusal === "no_dossier"
                          ? POWER_UP_REFUSAL_LABELS[refusal]
                          : null;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => triggerPowerUp(type)}
                          disabled={refusal !== null}
                          title={
                            refusal && blockedLabel
                              ? describePowerUpRefusal(refusal, p.name)
                              : p.description
                          }
                          className={`flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2 py-1 text-left transition active:scale-[0.98] ${
                            isActive
                              ? "border-blue-400/60 bg-blue-400/10"
                              : isReady
                                ? "border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/15"
                                : "border-white/[0.08] bg-[#0d0e11] opacity-80"
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span
                              className={`flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-bold leading-tight ${
                                isReady ? "text-emerald-200" : "text-zinc-300"
                              }`}
                            >
                              {type === "fda-coffee-break" && (
                                <IconCoffee className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {type === "auto-clean" && (
                                <IconSparkles className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {type === "query-extension" && (
                                <IconClock className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {type === "fast-sign" && (
                                <IconBolt className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="min-w-0 break-words">
                                {p.name}
                              </span>
                            </span>
                            <kbd className="shrink-0 rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                              {p.hotkey}
                            </kbd>
                          </span>
                          <span className="flex w-[4.5rem] shrink-0 flex-col items-end gap-1">
                            <span className="block h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                              <span
                                className={`block h-full transition-[width] duration-300 ${
                                  isReady ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                                style={{
                                  width: `${(p.charge / p.maxCharge) * 100}%`,
                                }}
                              />
                            </span>
                            <span
                              className={`text-right text-[9px] font-bold leading-tight tabular-nums ${
                                isReady ? "text-emerald-300" : "text-zinc-400"
                              }`}
                            >
                              {isActive
                                ? `${Math.ceil(p.activeSecondsRemaining)}s`
                                : blockedLabel
                                  ? blockedLabel.toUpperCase()
                                  : isReady
                                    ? "READY"
                                    : `${p.charge}/${p.maxCharge}`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </aside>
          )}
        </div>
      )}

      {/* The touch cabinet's dock: a key per station and per lifeline, at the
          thumbs' edge of the screen (#2105). */}
      {touchCabinet && activeTab === "conveyor" && playState === "playing" && (
        <div className="cc-dock-wrap">
          {routingNotice &&
            routingNotice.subjectId === activeSubject?.id &&
            routingNotice.unresolvedCount ===
              routingReadiness.unresolvedCount && (
              <p
                className={`cc-notice rounded-lg border px-2.5 py-2 text-xs shadow-xl ${
                  routingNotice.unresolvedCount > 0
                    ? "border-amber-500/50 bg-[#1f1a10] text-amber-200"
                    : "border-rose-500/60 bg-[#221214] text-rose-200"
                }`}
              >
                {routingNotice.message}
              </p>
            )}
          <ChaosTouchDock
            stations={sortedStations}
            activeSubject={activeSubject}
            matchingDomains={routingReadiness.matchingDomains}
            readyToRoute={flowStep === 2}
            flashStationId={flashStationId}
            watchedStationId={watchedStationId}
            powerUps={powerUps}
            onRoute={handleInitiateSubmission}
            onLifeline={triggerPowerUp}
          />
        </div>
      )}

      {/* TAB 2: Live CDISC SDTM Studio & Dataset Inspector */}
      {activeTab === "sdtm_studio" && (
        <div
          className={`mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4${
            touchCabinet ? " cc-panel" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IconDatabase className="h-5 w-5 text-emerald-400" />
                <span>Live CDISC SDTM Dataset Studio</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Inspect real-time SDTM clinical observation variables mapped
                from submitted subject packets.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadODMXML}
                disabled={submittedHistory.length === 0}
                className="flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 text-cyan-300 text-xs font-bold hover:bg-brand-cyan/20 disabled:opacity-40"
              >
                <IconDownload className="h-3.5 w-3.5" />
                <span>Export CDISC ODM XML</span>
              </button>

              <button
                onClick={downloadSDTMCSV}
                disabled={sdtmDataset.length === 0}
                className="flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-40"
              >
                <IconTable className="h-3.5 w-3.5" />
                <span>Export SDTM CSV</span>
              </button>
            </div>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            <span className="text-[10px] text-zinc-400 uppercase shrink-0">
              Filter Domain:
            </span>
            {["ALL", "DM", "VS", "AE", "LB", "CM", "EX", "DS", "MH"].map(
              (dom) => (
                <button
                  key={dom}
                  onClick={() => setSdtmFilterDomain(dom)}
                  className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-2.5 py-1 rounded-md text-xs font-bold shrink-0 border transition ${
                    sdtmFilterDomain === dom
                      ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {dom}
                </button>
              )
            )}
          </div>

          {/* SDTM Table */}
          <div className="overflow-x-auto max-h-72 border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs font-mono">
              <caption className="sr-only">Clinical Trial SDTM Dataset</caption>
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] border-b border-zinc-800 sticky top-0">
                <tr>
                  <th scope="col" className="p-2.5">
                    STUDYID
                  </th>
                  <th scope="col" className="p-2.5">
                    DOMAIN
                  </th>
                  <th scope="col" className="p-2.5">
                    USUBJID
                  </th>
                  <th scope="col" className="p-2.5">
                    TESTCD
                  </th>
                  <th scope="col" className="p-2.5">
                    TEST NAME
                  </th>
                  <th scope="col" className="p-2.5">
                    RAW (ORRES)
                  </th>
                  <th scope="col" className="p-2.5">
                    STANDARDIZED (STRESC)
                  </th>
                  <th scope="col" className="p-2.5">
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                {filteredSDTMRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-6 text-center text-zinc-400 italic"
                    >
                      No compliant SDTM records generated yet. Complete
                      electronic signatures on conveyor subjects to populate
                      database.
                    </td>
                  </tr>
                ) : (
                  filteredSDTMRows.map((row, idx) => (
                    <tr
                      key={`${row.USUBJID}-${row.SEQ}-${idx}`}
                      className="hover:bg-zinc-800/40"
                    >
                      <td className="p-2.5 text-zinc-400">{row.STUDYID}</td>
                      <td className="p-2.5 font-bold text-brand-cyan">
                        {row.DOMAIN}
                      </td>
                      <td className="p-2.5 text-zinc-300">{row.USUBJID}</td>
                      <td className="p-2.5 font-bold text-amber-300">
                        {row.TESTCD}
                      </td>
                      <td className="p-2.5 text-zinc-200">{row.TEST}</td>
                      <td className="p-2.5 text-rose-400">{row.ORRES}</td>
                      <td className="p-2.5 text-emerald-300 font-bold">
                        {row.STRESC}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            row.STATUS === "COMPLIANT"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {row.STATUS}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail Log Tab */}
      {activeTab === "audit_trail" && (
        <div
          className={`mt-4 rounded-xl border border-zinc-800 bg-black/90 p-4${
            touchCabinet ? " cc-panel" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="font-bold uppercase tracking-wider text-zinc-300">
                21 CFR PART 11 IMMUTABLE AUDIT TRAIL
              </span>
            </div>
            <span>TOTAL EVENTS: {auditLogs.length}</span>
          </div>

          <div
            ref={terminalContainerRef}
            className="h-64 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 p-2"
          >
            {auditLogs.length === 0 ? (
              <p className="text-zinc-400 italic">
                Audit logger standing by. Ready for event stream...
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 leading-relaxed"
                >
                  <span className="text-zinc-400 shrink-0">
                    {log.timestamp}
                  </span>
                  <span
                    className={
                      log.level === "CRITICAL"
                        ? "text-rose-400 font-bold"
                        : log.level === "WARN"
                          ? "text-amber-300"
                          : log.level === "COMPLIANT"
                            ? "text-emerald-400"
                            : "text-zinc-400"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Shift pause (#1672): every clock stops until the player resumes. */}
      {pauseDialogOpen && (
        <div
          data-cc-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            ref={pauseDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-pause-dialog-title"
            aria-describedby="cc-pause-dialog-desc"
            className="max-w-sm w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl"
          >
            <IconPlayerPause
              className="mx-auto h-6 w-6 text-amber-400"
              aria-hidden="true"
            />
            <h2
              id="cc-pause-dialog-title"
              className="mt-2 text-base font-bold text-white"
            >
              Shift paused
            </h2>
            <p
              id="cc-pause-dialog-desc"
              className="mt-1 text-xs leading-relaxed text-zinc-400"
            >
              Subject timers, the auditor, the sponsor and your lifelines are
              all stopped. Press P or Resume to continue.
            </p>
            <button
              ref={resumeButtonRef}
              type="button"
              onClick={togglePause}
              aria-keyshortcuts="P"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />
              Resume shift (P)
            </button>
          </div>
        </div>
      )}

      {/* Multi-Choice Regulatory Validation Drawer Modal */}
      {validatingObs && playState === "playing" && !isPaused && (
        <div
          data-cc-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            ref={fixDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-fix-dialog-title"
            className="max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-amber-500/50 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <IconHelp className="h-5 w-5 text-amber-400" />
                <h2
                  id="cc-fix-dialog-title"
                  className="text-base font-bold text-white"
                >
                  CDISC Controlled Terminology Validation
                </h2>
              </div>
              <button
                onClick={() => setValidatingObs(null)}
                className="text-zinc-400 hover:text-white text-xs font-mono min-h-[44px] min-w-[44px] flex items-center justify-center p-2"
              >
                ✕ ESC
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">
                    Clinical Variable
                  </span>
                  <p className="text-sm font-bold text-zinc-100">
                    {validatingObs.obs.field}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {validatingObs.obs.destination} DOMAIN
                </span>
              </div>

              <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-rose-400 uppercase block">
                  Raw Site Entry Discrepancy
                </span>
                <p className="text-sm font-mono font-bold text-rose-300">
                  {validatingObs.obs.rawValue}
                </p>
                {validatingObs.obs.hint && (
                  <p className="mt-1 text-[11px] text-amber-400/90 italic">
                    {validatingObs.obs.hint}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-2">
                  Select Compliant CDISC Standard Value / CT Code
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getObservationChoices(validatingObs.obs).map(
                    (opt, optIdx, options) => {
                      const rejectedHere =
                        rejectedChoices[
                          `${validatingObs.subjectId}:${validatingObs.obs.id}`
                        ] ?? [];
                      const isRejected = rejectedHere.includes(opt);
                      // Focus lands on the first answer still open (#1671).
                      const isFirstOpen =
                        !isRejected &&
                        options.findIndex((o) => !rejectedHere.includes(o)) ===
                          optIdx;
                      return (
                        <button
                          key={opt}
                          ref={isFirstOpen ? firstFixOptionRef : undefined}
                          type="button"
                          onClick={() => handleSelectChoice(opt)}
                          disabled={isRejected}
                          aria-disabled={isRejected}
                          data-rejected={isRejected ? "true" : undefined}
                          className={`p-2.5 min-h-[44px] rounded-xl border text-left font-mono text-xs transition ${
                            validatingObs.selectedChoice === opt &&
                            validatingObs.feedback?.isValid
                              ? "border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold"
                              : isRejected
                                ? "border-rose-500/70 bg-rose-950/40 text-rose-300 cursor-not-allowed"
                                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-brand-cyan hover:bg-zinc-800"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <kbd className="rounded border border-zinc-700 px-1 text-[10px] font-normal text-zinc-400">
                              {optIdx + 1}
                            </kbd>
                            <span className={isRejected ? "line-through" : ""}>
                              {opt}
                            </span>
                            {isRejected && (
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-rose-400">
                                Rejected
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {validatingObs.feedback && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    validatingObs.feedback.isValid
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  <p className="font-bold mb-0.5">
                    {validatingObs.feedback.isValid
                      ? "✓ Standard Verified"
                      : "✗ Regulatory Query"}
                  </p>
                  <p>{validatingObs.feedback.text}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end">
              <button
                onClick={() => setValidatingObs(null)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-white"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 21 CFR Part 11 Electronic Signature Modal */}
      {signatureModal.isOpen &&
        signatureModal.subject &&
        playState === "playing" &&
        !isPaused && (
          <div
            data-cc-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:backdrop-blur-sm"
          >
            <div
              ref={signatureDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cc-sign-dialog-title"
              className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#13151a] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <IconLock className="h-5 w-5 shrink-0 text-blue-400" />
                  <h2
                    id="cc-sign-dialog-title"
                    className="text-base font-bold tracking-tight text-[#f4f4f6]"
                  >
                    21 CFR Part 11 Electronic Signature
                  </h2>
                  {(signatureModal.signaturesRequired ?? 1) > 1 && (
                    <span
                      data-testid="cc-sign-step"
                      className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300"
                    >
                      {(signatureModal.signaturesApplied ?? 0) + 1}/
                      {signatureModal.signaturesRequired}
                    </span>
                  )}
                </div>
                <span className="shrink-0 rounded border border-white/[0.08] bg-[#0d0e11] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                  {targetRoutingStation} EDC LOCK
                </span>
              </div>

              <div className="mt-4 space-y-4 text-xs font-mono">
                <div className="rounded-xl border border-white/[0.08] bg-[#0d0e11] p-3">
                  <p className="text-zinc-200">
                    <span className="text-zinc-400">SUBJECT:</span>{" "}
                    {signatureModal.subject.subjectLabel} (
                    {signatureModal.subject.studySite})
                  </p>
                  <p className="mt-1 text-zinc-200">
                    <span className="text-zinc-400">TARGET EDC:</span>{" "}
                    {targetRoutingStation} Domain Desk (
                    {
                      stations.find((s) => s.id === targetRoutingStation)
                        ?.vendor
                    }
                    )
                  </p>
                </div>

                {(signatureModal.signaturesRequired ?? 1) > 1 && (
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                    {(signatureModal.signaturesApplied ?? 0) === 0
                      ? "Double-signature audit: sign first as the author. An independent reviewer then countersigns before the CRF locks."
                      : "Author signature applied. Countersign as the independent reviewer to lock the CRF."}
                  </p>
                )}
                <div role="group" aria-labelledby="cc-sign-reason-label">
                  <p
                    id="cc-sign-reason-label"
                    className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-400"
                  >
                    Select Legal Signature Reason [21 CFR § 11.50]
                  </p>
                  <p
                    data-testid="cc-sign-reason-rule"
                    className="mb-2 text-[11px] text-zinc-300"
                  >
                    {signatureModal.subject?.isSAE ? (
                      <span className="font-bold text-rose-300">
                        SAE: sign it Urgent Safety Expedited.
                      </span>
                    ) : (
                      "Routine CRF: Urgent Safety Expedited is only for SAEs."
                    )}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        "Intent to Submit",
                        "Author Verification",
                        "Protocol Compliance Review",
                        "Urgent Safety Expedited",
                      ] as SignatureReason[]
                    ).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={signatureModal.selectedReason === r}
                        onClick={() =>
                          setSignatureModal((prev) => ({
                            ...prev,
                            selectedReason: r,
                          }))
                        }
                        className={`min-h-[44px] rounded-lg border p-2 text-left text-[11px] transition active:scale-[0.98] ${
                          signatureModal.selectedReason === r
                            ? "border-blue-400/70 bg-blue-400/10 font-bold text-blue-100"
                            : "border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:border-white/20"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="cc-signature-password"
                    className="block text-[10px] font-bold uppercase text-zinc-400 mb-1"
                  >
                    User Authenticator Password
                  </label>
                  <input
                    id="cc-signature-password"
                    type="password"
                    value={signatureModal.passwordInput}
                    onChange={(e) =>
                      setSignatureModal((prev) => ({
                        ...prev,
                        passwordInput: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-zinc-200 focus:border-blue-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/60"
                  />
                </div>

                <p className="text-[10px] italic leading-relaxed text-zinc-400">
                  By executing this signature, I legally attest that all
                  clinical data points conform to CDISC Controlled Terminology
                  and ICH GCP E6(R3) standards.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSignatureModal((prev) => ({
                      ...prev,
                      isOpen: false,
                      subject: null,
                    }))
                  }
                  className="min-h-[44px] rounded-xl border border-white/[0.08] bg-[#0d0e11] px-4 py-2.5 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white active:scale-[0.98]"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  ref={signButtonRef}
                  onClick={handleConfirmSignature}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0d0e11] transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.98]"
                >
                  <IconShieldCheck className="h-4 w-4" />{" "}
                  {(signatureModal.signaturesRequired ?? 1) > 1 &&
                  (signatureModal.signaturesApplied ?? 0) === 0
                    ? "Apply Author Signature"
                    : (signatureModal.signaturesRequired ?? 1) > 1
                      ? "Countersign & Lock CRF"
                      : "Sign & Lock CRF"}{" "}
                  (Enter)
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Campaign-finale FDA inspection interview (#2089) */}
      {inspectionRound && (
        <InspectionRoundDialog
          round={inspectionRound}
          onAnswer={handleInspectionAnswer}
          onNext={handleInspectionNext}
          onExtend={handleInspectionExtend}
          onSetTimerEnabled={handleInspectionTimerEnabled}
          onTick={handleInspectionTick}
          returnFocusTo={containerRef}
        />
      )}

      {/* FDA BIMO Inspection Report Modal */}
      {bimoReport && (
        <div
          data-cc-modal={touchCabinet ? "true" : undefined}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div
            ref={bimoDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-report-dialog-title"
            data-testid="cc-bimo-report"
            className={`max-w-2xl w-full rounded-2xl border bg-zinc-950 p-6 shadow-2xl ${getReportTone(bimoReport.verdict).frame}`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <IconShieldCheck
                  className={`h-6 w-6 ${getReportTone(bimoReport.verdict).icon}`}
                />
                <div>
                  <h3
                    id="cc-report-dialog-title"
                    className="text-base font-bold text-white"
                  >
                    FDA Bioresearch Monitoring (BIMO) Report
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    {bimoReport.runId} · {bimoReport.auditDate}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setBimoReport(null)}
                className="text-zinc-400 hover:text-white text-xs font-mono min-h-[48px] min-w-[48px] flex items-center justify-center p-2"
              >
                ✕ ESC
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 sm:grid-cols-4">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">
                    Compliance Score
                  </span>
                  <span
                    data-testid="cc-bimo-score"
                    className={`text-lg font-bold ${getReportTone(bimoReport.verdict).score}`}
                  >
                    {bimoReport.overallScore}/100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">
                    Clean Rate
                  </span>
                  <span className="text-lg font-bold text-brand-cyan">
                    {bimoReport.cleanRate === null
                      ? "n/a"
                      : `${bimoReport.cleanRate}%`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">
                    CRFs Processed
                  </span>
                  <span className="text-lg font-bold text-white">
                    {bimoReport.submittedCRFs}
                  </span>
                </div>
                <div>
                  {/* Expired subjects were never processed, so they sit
                      beside the clean rate rather than inside it (#1670). */}
                  <span className="text-[10px] text-zinc-400 block uppercase">
                    Expired
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      bimoReport.expiredCRFs > 0
                        ? "text-rose-300"
                        : "text-white"
                    }`}
                  >
                    {bimoReport.expiredCRFs}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Regulatory Determination
                </span>
                <p
                  className={`p-3 rounded-xl font-bold border ${
                    bimoReport.verdict.includes("NAI")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : bimoReport.verdict.includes("VAI")
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {bimoReport.verdict}
                </p>
                <p className="mt-2 text-zinc-400 leading-relaxed text-[11px]">
                  {bimoReport.summary}
                </p>
              </div>

              {bimoReport.inspection && (
                <p
                  data-testid="cc-bimo-interview"
                  className={`rounded-xl border p-3 ${
                    bimoReport.inspection.clean
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                      : "border-amber-500/40 bg-amber-500/5 text-amber-200"
                  }`}
                >
                  <span className="font-bold">
                    Closing interview: {bimoReport.inspection.recordCorrect}/
                    {bimoReport.inspection.recordQuestions} records answered
                    from the audit trail
                  </span>
                  {bimoReport.inspection.skeletonQuestions > 0 && (
                    <span className="text-zinc-400">
                      {" "}
                      · {bimoReport.inspection.skeletonsDisclosed}/
                      {bimoReport.inspection.skeletonQuestions} sponsor
                      shortcuts disclosed
                    </span>
                  )}
                </p>
              )}

              {bimoReport.auditYear !== undefined && (
                <p
                  data-testid="cc-bimo-audit-year"
                  className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-amber-200"
                >
                  <span className="font-bold">
                    Endless audit: Audit Year {bimoReport.auditYear}
                  </span>{" "}
                  <span className="text-zinc-400">
                    · endless best {endlessBest.score} (Year{" "}
                    {endlessBest.auditYear})
                  </span>
                </p>
              )}

              {bimoReport.amendmentOutcomes &&
                bimoReport.amendmentOutcomes.length > 0 && (
                  <div data-testid="cc-bimo-amendments">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                      Protocol Amendments ({bimoReport.amendmentOutcomes.length}
                      )
                    </span>
                    <ul className="space-y-1.5">
                      {bimoReport.amendmentOutcomes.map((outcome, idx) => (
                        <li
                          key={`${outcome.type}-${idx}`}
                          className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5"
                        >
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              outcome.resolved
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            {outcome.resolved ? "MET" : "NOT MET"}
                          </span>
                          <span className="min-w-0 break-words text-zinc-300">
                            <span className="font-bold text-white">
                              {outcome.title}:
                            </span>{" "}
                            {outcome.summary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {bimoReport.findings.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                    Inspection Findings ({bimoReport.findings.length})
                  </span>
                  <div
                    className="space-y-2 max-h-36 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    tabIndex={0}
                    role="region"
                    aria-label="Inspection findings"
                  >
                    {bimoReport.findings.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                f.severity === "Critical"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : f.severity === "Major"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {f.severity}
                            </span>
                            <span className="font-bold text-zinc-300">
                              {f.category}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {f.description}
                          </p>
                          <span className="text-[9px] text-zinc-400 block mt-0.5">
                            {f.regulation}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-3">
              <div className="flex gap-2">
                <button
                  onClick={downloadODMXML}
                  className="flex min-h-[44px] items-center gap-1 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
                >
                  <IconDownload className="h-3.5 w-3.5" /> ODM XML
                </button>
                <button
                  onClick={downloadSDTMCSV}
                  className="flex min-h-[44px] items-center gap-1 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
                >
                  <IconTable className="h-3.5 w-3.5" /> SDTM CSV
                </button>
              </div>
              <button
                ref={closeReportButtonRef}
                onClick={() => setBimoReport(null)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Study Cross-Link */}
      {playState !== "playing" && (
        <div className="mt-4 rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs">
            <div className="flex items-center gap-2 font-bold text-brand-blue uppercase tracking-wider text-[11px]">
              <IconFileText className="h-4 w-4" />
              <span>Case Study Synergy: iMednet Python SDK</span>
            </div>
            <p className="text-zinc-400 mt-1 leading-relaxed">
              Interested in real-world clinical EDC integration and CDISC ODM
              XML extraction? Explore the production architecture case study.
            </p>
          </div>

          <IntentLink
            href="/case-studies/imednet-python-sdk"
            className="shrink-0 inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-lg border border-brand-blue/40 bg-brand-blue/15 text-xs font-bold text-brand-cyan hover:bg-brand-blue/25 transition shadow-sm"
          >
            <span>Read SDK Case Study</span>
            <IconExternalLink className="h-3.5 w-3.5" />
          </IntentLink>
        </div>
      )}

      {/* Interactive Stress Control Panel & Live BIMO Stream Drawer */}
      {isStressDrawerOpen && !touchCabinet && (
        <aside
          aria-label="Interactive Stress Control Panel and Live BIMO Stream"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950/95 p-4 text-zinc-100 backdrop-blur-md shadow-2xl transition-all sm:w-96"
        >
          {stressDrawerBody}
        </aside>
      )}

      {/* On the touch cabinet the same panel is a sheet: a bottom sheet held
          upright, a side sheet beside the floor held sideways (#2105). */}
      {isStressDrawerOpen && touchCabinet && (
        <div
          data-cc-modal="true"
          data-testid="cc-stress-sheet-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsStressDrawerOpen(false);
            }
          }}
          className="cc-sheet-backdrop"
        >
          <div
            ref={stressSheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-stress-title"
            data-testid="cc-stress-sheet"
            className="cc-sheet flex flex-col border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl"
          >
            {stressDrawerBody}
          </div>
        </div>
      )}
    </div>
  );
};
