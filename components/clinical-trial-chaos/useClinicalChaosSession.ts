"use client";

import { standardCitation } from "@/lib/clinical-standards";
import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
  useMemo,
  type SetStateAction,
} from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { cloneDeep } from "@/lib/utils";
import { clamp, createSeededRandom } from "@/lib/game-utils";
import { downloadFile } from "@/lib/download";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { applyCanvasScale, computeCanvasResolution } from "@/lib/arcade";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CLINICAL_CHAOS_AUTO_PAUSE_EVENT } from "@/components/clinical-trial-chaos/auto-pause";
import "@/components/clinical-trial-chaos/clinical-chaos-touch.css";

import {
  CDISCDomain,
  ClinicalObservation,
  ClinicalSubject,
  AuditorState,
  ProtocolAmendment,
  AuditLogEntry,
  GamePhase,
  GameMode,
  PlayState,
  GameScoreState,
  SignatureModalState,
  SignatureReason,
  StationConfig,
  PowerUpInventory,
  PowerUpType,
  RecordedRuleViolation,
  SDTMRow,
  BIMOInspectionReport,
  StressParameters,
  BIMOComplianceTrend,
} from "@/lib/clinical-trial-chaos/types";
import { StudyProtocol } from "@/lib/crf/types";

import {
  createInitialScoreState,
  getNextShiftScoreState,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  createAuditLogEntry,
  validateObservationChoice,
  getObservationChoices,
  shouldRunCalibration,
  getCalibrationStep,
  isSubjectFullyCompliant,
  chargePowerUps,
  scrambleStations,
  verify21CFRSubmission,
  getSignatureReasonError,
  triggerRandomAmendment,
  generateSDTMDataset,
  exportToCDISCODMXML,
  exportToSDTMCSV,
  generateBIMOReport,
} from "@/lib/clinical-trial-chaos/engine";

import {
  getStationsForPhase,
  SEEDED_SCENARIOS,
  generateClinicalSubject,
  generateClinicalSubjectFromProtocol,
  DEFAULT_STRESS_PARAMS,
} from "@/lib/clinical-trial-chaos/scenarios";

import {
  getRoutingReadiness,
  getSubmissionMode,
  DEFAULT_OFFICE_ID,
  OfficeId,
  getOfficeById,
  applyOfficeSpawnInterval,
  getSpawnIntervalSeconds,
  MAX_CONVEYOR_SUBJECTS,
  applyOfficeErrorChance,
  applyOfficeAmendmentInterval,
  applyOfficeScore,
  applyOfficeCharge,
  applyOfficeToSubject,
  applyOfficeToAuditor,
  pickOfficeAmbientEvent,
  SponsorState,
  createInitialSponsorState,
  tickSponsor,
  getSponsorMoodDecayPerSecond,
  resolveSponsorChoice,
  applySponsorSubmissionBoost,
  DEFAULT_OUTFIT_ID,
  OutfitId,
  getOutfitById,
  PHASE_TARGETS,
  EXPIRY_SUSPICION,
  COFFEE_BREAK_START_LOG,
  COFFEE_BREAK_END_LOG,
  QUERY_EXTENSION_LOG,
  raiseAuditorSuspicion,
  adjustAuditorSuspicion,
  breakCombo,
  applyCorrectionScore,
  replaceObservation,
  createRuleViolation,
  appendRuleViolation,
  formatCorrectionLog,
  formatRuleFailureLog,
  formatExpiryLog,
  settleSubmission,
  applySubmissionScore,
  getSubmissionCharge,
  recordStationSubmission,
  selectNextDossier,
  formatNextDossierCue,
  buildInspectionReport,
  getPowerUpRefusal,
  describePowerUpRefusal,
  getShiftClockRate,
  getShiftTickSeconds,
  spendPowerUp,
  startCoffeeBreak,
  extendSubjectDeadlines,
  autoCleanSubject,
  getFastTrackDomain,
  tickShiftClocks,
  getAmendmentIntervalSeconds,
  getSAEChance,
  describeSponsorEvent,
  describePhaseClearForm483,
  SHIFT_END_LOGS,
  getAuditYear,
  getAuditYearErrorChance,
  formatAuditYearLog,
  describeAuditYear,
  addOpenedStations,
  ENDLESS_BEST_STORAGE_KEY,
  parseEndlessBest,
  mergeEndlessBest,
  type AmendmentEffectsState,
  createAmendmentEffectsState,
  beginAmendmentEffect,
  getRequiredSignatureCount,
  recordAmendmentLock,
  tickAmendmentEffects,
  applySpotInspectionMisroute,
  parkAuditorAtStation,
  annotateInspectionReport,
  createInspectionRecord,
  createInspectionRound,
  getInspectionSeed,
  answerInspectionQuestion,
  advanceInspection,
  isInspectionComplete,
  tickInspectionTimer,
  extendInspectionTimer,
  setInspectionTimerEnabled,
  type InspectionRecord,
  type InspectionRound,
  type InspectionSignature,
  type SponsorSkeleton,
} from "@/lib/clinical-trial-chaos";

import {
  createFloorAnimState,
  createFolderFx,
  drawConveyor,
  getConveyorGeometry,
  getVisibleSubjects,
  type FloorAnimState,
} from "@/components/clinical-trial-chaos/conveyor-canvas";
import {
  FOLDER_FX_MS,
  getChuteSlots,
  getAuditorParkX,
  getConveyorLogicalSize,
  getSlotX,
} from "@/components/clinical-trial-chaos/floor-scene";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import {
  safeGetItem,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import {
  playValidationSound,
  playChoiceIncorrectSound,
  playSignatureVerifiedSound,
  playAuditErrorBuzz,
  playAmendmentSirenSound,
  playForm483AlarmSound,
  playPowerUpSound,
  playPneumaticChuteSound,
  startProceduralBGM,
  stopProceduralBGM,
  updateBGMTempo,
} from "@/lib/clinical-trial-chaos/sound-effects";

const emptySubscribe = () => () => {};
/** How fast the auditor walks to a spot inspection, in floor widths per second. */
const SPOT_WALK_SPEED = 0.6;

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getHighScoreSnapshot = () => {
  try {
    return safeGetRawItem("clinical_chaos_highscore") || "0";
  } catch {
    return "0";
  }
};
const getHighScoreServerSnapshot = () => "0";
// The endless best lives under its own key, apart from the campaign score
// (#2053). Reads go through the guarded storage helpers.
const getEndlessBestSnapshot = () => {
  try {
    return safeGetRawItem(ENDLESS_BEST_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};
const getEndlessBestServerSnapshot = () => "";
const persistEndlessBest = (score: number, auditYear: number) => {
  try {
    const { best, improved } = mergeEndlessBest(
      parseEndlessBest(safeGetRawItem(ENDLESS_BEST_STORAGE_KEY)),
      score,
      auditYear
    );
    if (improved)
      safeSetRawItem(ENDLESS_BEST_STORAGE_KEY, JSON.stringify(best));
  } catch {
    // Storage unavailable: the best simply is not remembered.
  }
};

const QUICK_DISPATCH_GUARD_MS = 400;

/** Belt travel per running second, in logical pixels. */
const BELT_SPEED = 18;

const OUTFIT_STORAGE_KEY = "clinical_chaos_outfit";

/** CRF Studio writes the protocol to simulate here as plain JSON. */
export const CRF_ACTIVE_PROTOCOL_KEY = "crf_active_protocol";

/** The protocol CRF Studio stored for a run, if it is one. */
export function readStoredProtocol(): StudyProtocol | null {
  const stored = safeGetItem<unknown>(CRF_ACTIVE_PROTOCOL_KEY);
  if (
    stored &&
    typeof stored === "object" &&
    !Array.isArray(stored) &&
    "id" in stored &&
    (stored as { id: unknown }).id
  ) {
    return stored as StudyProtocol;
  }
  return null;
}

function readStoredOutfitId(): OutfitId {
  if (typeof window === "undefined") return DEFAULT_OUTFIT_ID;
  return getOutfitById(safeGetRawItem(OUTFIT_STORAGE_KEY)).id;
}

/**
 * State the game loop advances between renders. The ref holds the latest
 * value and is the base for every update, so a handler builds on the loop's
 * current countdowns and patrol rather than the last rendered ones, and a
 * render never rewinds the loop (#1628).
 */
function useLoopOwnedState<T>(initial: T | (() => T)) {
  const [state, setState] = useState<T>(initial);
  const ref = useRef<T>(state);
  const update = useCallback((action: SetStateAction<T>) => {
    const next =
      typeof action === "function"
        ? (action as (prev: T) => T)(ref.current)
        : action;
    ref.current = next;
    setState(next);
  }, []);
  return [state, update, ref] as const;
}

/**
 * True when the loop's state would change what the board shows: a subject
 * added, removed or reordered, a displayed countdown second, the auditor's
 * shown suspicion or behavior, or a lifeline's shown seconds (#1628).
 */
function loopStateChangesDisplay(
  rendered: {
    subjects: readonly ClinicalSubject[];
    auditor: AuditorState;
    powerUps: PowerUpInventory;
  },
  current: {
    subjects: readonly ClinicalSubject[];
    auditor: AuditorState;
    powerUps: PowerUpInventory;
  }
): boolean {
  if (rendered.subjects.length !== current.subjects.length) return true;
  const subjectChanged = current.subjects.some((s, i) => {
    const shown = rendered.subjects[i];
    return (
      s.id !== shown.id ||
      Math.ceil(s.timeRemaining) !== Math.ceil(shown.timeRemaining) ||
      Math.round(s.timeRemaining) !== Math.round(shown.timeRemaining)
    );
  });
  if (subjectChanged) return true;
  if (
    rendered.auditor.behavior !== current.auditor.behavior ||
    Math.round(rendered.auditor.suspicion) !==
      Math.round(current.auditor.suspicion)
  ) {
    return true;
  }
  return (Object.keys(current.powerUps) as PowerUpType[]).some(
    (type) =>
      Math.ceil(current.powerUps[type].activeSecondsRemaining) !==
      Math.ceil(rendered.powerUps[type]?.activeSecondsRemaining ?? 0)
  );
}

/** What the session reads from the device, supplied by the view (ADR 0062). */
interface ClinicalChaosSessionOptions {
  /** Whether the game runs in the touch cabinet. */
  readonly touch: boolean;
  /** Reads the reduced-motion preference at the moment it is called. */
  readonly readReducedMotion: () => boolean;
  /** Reads whether motion should be calm (a narrow screen or reduced motion) now. */
  readonly readCalmMotion: () => boolean;
}

/**
 * The Clinical Trial Chaos session (#3438): shift and campaign state, the
 * shift timer, pause, the conveyor loop and the handlers the view calls.
 * Moved verbatim from ClinicalTrialChaos.tsx; the view renders what it returns.
 */
export function useClinicalChaosSession(options: ClinicalChaosSessionOptions) {
  const { touch: touchCabinet, readReducedMotion, readCalmMotion } = options;
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const rawEndlessBest = useSyncExternalStore(
    subscribeHighScore,
    getEndlessBestSnapshot,
    getEndlessBestServerSnapshot
  );
  const { playSuccess, muted: globalMuted } = useAudio();
  const { recordEvent } = useTelemetry();
  const { announce } = useAnnouncer();
  // True inside the immersive touch cabinet (a tablet after Launch). Desktop
  // and the attract screen read false, and none of the touch layout, dock or
  // sheet behaviour below applies there (#2105).

  // 1. Game configuration & modes
  const [gameMode, setGameMode] = useState<GameMode>("campaign");
  const [phase, setPhase] = useState<GamePhase>(1);
  const [playState, setPlayState] = useState<PlayState>("idle");
  // A player pause (P or the Pause button) and an open Field Manual both hold
  // the shift clocks still, as they do in the other arcade games (#1672).
  const [isPaused, setIsPaused] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Bitmap size of the conveyor canvas; changes trigger an idle redraw
  const [canvasSize, setCanvasSize] = useState("");
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [officeId, setOfficeId] = useState<OfficeId>(DEFAULT_OFFICE_ID);
  const office = getOfficeById(officeId);
  // Cosmetic only; remembered per viewer
  const [outfitId, setOutfitId] = useState<OutfitId>(readStoredOutfitId);
  const outfit = getOutfitById(outfitId);
  const selectOutfit = useCallback((id: OutfitId) => {
    setOutfitId(id);
    safeSetRawItem(OUTFIT_STORAGE_KEY, id);
  }, []);
  const [sponsor, setSponsor] = useState<SponsorState>(() =>
    createInitialSponsorState()
  );
  const [gameOverReason, setGameOverReason] = useState<"auditor" | "sponsor">(
    "auditor"
  );
  const [activeTab, setActiveTab] = useState<
    "conveyor" | "sdtm_studio" | "audit_trail"
  >("conveyor");
  const [sdtmFilterDomain, setSdtmFilterDomain] = useState<string>("ALL");

  // 2. Entities & Engine State
  const [scoreState, setScoreState] = useState<GameScoreState>(
    createInitialScoreState
  );
  const effectiveHighScore = Math.max(scoreState.highScore, loadedHighScore);
  // Endless Audit Years (#2053): every few locks raise one difficulty axis.
  const auditYear =
    gameMode === "endless" ? getAuditYear(scoreState.subjectsSubmitted) : 1;
  const endlessBest = useMemo(
    () =>
      mergeEndlessBest(
        parseEndlessBest(rawEndlessBest),
        gameMode === "endless" ? scoreState.score : 0,
        auditYear
      ).best,
    [rawEndlessBest, gameMode, scoreState.score, auditYear]
  );
  // The game loop advances the auditor, the subject countdowns and the
  // lifeline timers between renders; their refs hold the latest values.
  const [auditor, setAuditor, auditorRef] = useLoopOwnedState<AuditorState>(
    createInitialAuditorState
  );
  const [stations, setStations] = useState<StationConfig[]>(() =>
    getStationsForPhase(1, "campaign")
  );
  const [conveyorSubjects, setConveyorSubjects, conveyorSubjectsRef] =
    useLoopOwnedState<ClinicalSubject[]>([]);
  const [submittedHistory, setSubmittedHistory] = useState<ClinicalSubject[]>(
    []
  );
  const [powerUps, setPowerUps, powerUpsRef] =
    useLoopOwnedState<PowerUpInventory>(createInitialPowerUpInventory);
  const [activeAmendment, setActiveAmendment] =
    useState<ProtocolAmendment | null>(null);
  // Lasting amendment rules (#2053): the ref is the source of truth, which
  // the loop advances every frame; the state mirrors it on each event.
  const [amendmentEffects, setAmendmentEffects] =
    useState<AmendmentEffectsState>(createAmendmentEffectsState);
  const amendmentEffectsRef = useRef<AmendmentEffectsState>(amendmentEffects);
  const commitAmendmentEffects = useCallback((next: AmendmentEffectsState) => {
    amendmentEffectsRef.current = next;
    setAmendmentEffects(next);
  }, []);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // 3. Modals & Interactive States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null
  );
  // First-shift calibration (#834): the guided subject's id while active.
  // Every clock that can expire work, raise the auditor or spawn subjects
  // stays frozen until the subject is submitted or the player skips.
  const [calibrationSubjectId, setCalibrationSubjectId] = useState<
    string | null
  >(null);
  const calibrationActiveRef = useRef(false);
  // Short "Next dossier loaded" cue shown after a submission auto-advances.
  const [nextDossierCue, setNextDossierCue] = useState<{
    subjectId: string;
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!nextDossierCue) return;
    const timer = setTimeout(() => setNextDossierCue(null), 2500);
    return () => clearTimeout(timer);
  }, [nextDossierCue]);
  const [validatingObs, setValidatingObs] = useState<{
    subjectId: string;
    obs: ClinicalObservation;
    selectedChoice?: string;
    feedback?: { isValid: boolean; text: string };
  } | null>(null);
  // Answers already rejected in a fix dialog, keyed by subject and
  // observation. A rejected answer stays disabled, even after the dialog is
  // closed and reopened, so the same mistake is never charged twice (#1554).
  const [rejectedChoices, setRejectedChoices] = useState<
    Record<string, string[]>
  >({});

  const [signatureModal, setSignatureModal] = useState<SignatureModalState>({
    isOpen: false,
    subject: null,
    selectedReason: "Intent to Submit",
    passwordInput: "••••••••",
    requiresReason: true,
  });
  const [targetRoutingStation, setTargetRoutingStation] =
    useState<CDISCDomain>("DM");
  const lastQuickDispatchAtRef = useRef(0);
  const [routingNotice, setRoutingNotice] = useState<{
    subjectId: string;
    unresolvedCount: number;
    message: string;
  } | null>(null);
  const [bimoReport, setBimoReport] = useState<BIMOInspectionReport | null>(
    null
  );
  // Campaign-finale inspection (#2089): the audit-trail record of every CRF
  // locked this run, the sponsor skeletons of earlier phases, and the round
  // the auditor runs once phase 3 locks.
  const inspectionLedgerRef = useRef<InspectionRecord[]>([]);
  const campaignSkeletonsRef = useRef<SponsorSkeleton[]>([]);
  const [inspectionRound, setInspectionRound] =
    useState<InspectionRound | null>(null);
  const pendingFinaleRef = useRef<{
    score: GameScoreState;
    auditor: AuditorState;
    logs: AuditLogEntry[];
    violations: RecordedRuleViolation[];
    protocol: StudyProtocol | null;
    skeletons: SponsorSkeleton[];
    /** Leading skeletons Phase 1 and 2 reports already charged. */
    chargedSkeletons: number;
    amendments: AmendmentEffectsState;
  } | null>(null);

  // Active Authored Protocol Engine State & Rule Violations Log
  const [activeProtocol, setActiveProtocol] = useState<StudyProtocol | null>(
    () => {
      if (typeof window !== "undefined") {
        const stored = readStoredProtocol();
        if (stored) return stored;
      }
      return null;
    }
  );
  const [ruleViolations, setRuleViolations] = useState<RecordedRuleViolation[]>(
    []
  );

  // 3b. Interactive Stress Controls & Live BIMO Compliance Stream
  const [stressParams, setStressParams] = useState<StressParameters>(
    DEFAULT_STRESS_PARAMS
  );
  const stressParamsRef = useRef<StressParameters>(stressParams);
  useEffect(() => {
    stressParamsRef.current = stressParams;
  }, [stressParams]);

  const [isStressDrawerOpen, setIsStressDrawerOpen] = useState(false);

  // Live BIMO Inspection Report & Compliance Score Trend
  const liveBimoReport = useMemo(() => {
    return generateBIMOReport(
      scoreState,
      auditor,
      auditLogs,
      ruleViolations,
      activeProtocol
    );
  }, [scoreState, auditor, auditLogs, ruleViolations, activeProtocol]);

  const prevLiveScoreRef = useRef(liveBimoReport.overallScore);
  const [scoreTrend, setScoreTrend] = useState<BIMOComplianceTrend>("stable");

  useEffect(() => {
    if (liveBimoReport.overallScore > prevLiveScoreRef.current) {
      setScoreTrend("improving");
    } else if (liveBimoReport.overallScore < prevLiveScoreRef.current) {
      setScoreTrend("declining");
    }
    prevLiveScoreRef.current = liveBimoReport.overallScore;
  }, [liveBimoReport.overallScore]);

  // 4. DOM & Canvas references
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Logical conveyor size the renderer and hit-testing work in; the backing
  // store is this times the device pixel ratio so it stays sharp on HiDPI.
  const conveyorViewRef = useRef({ width: 760, height: 150, scale: 1 });
  const lastPointerTimeRef = useRef(0);
  const lastTouchTimeRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  const lastTickTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const amendmentTimerRef = useRef<number>(0);
  const ambientTimerRef = useRef<number>(0);
  const officeSiteSeqRef = useRef<number>(3);
  // Source of truth for the sponsor simulation; `sponsor` state mirrors it for rendering.
  const sponsorRef = useRef<SponsorState>(sponsor);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  // Floor scene animation: eased folder positions, folder events in flight
  // and chute flashes (#1521). The belt only travels while clocks run.
  const floorAnimRef = useRef<FloorAnimState>(createFloorAnimState());
  const beltOffsetRef = useRef(0);
  const fx = useArcadeFx();
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;
  const submittedSubjectIdsRef = useRef<Set<string>>(new Set());
  const activeProtocolRef = useRef<StudyProtocol | null>(activeProtocol);
  const ruleViolationsRef = useRef<RecordedRuleViolation[]>(ruleViolations);

  // 4b. Juice: floating score deltas, station flash, last inspection report
  const [scorePops, setScorePops] = useState<
    { id: number; text: string; tone: "good" | "bad" }[]
  >([]);
  const scorePopSeqRef = useRef(0);
  const pushScorePop = useCallback((amount: number) => {
    if (amount === 0) return;
    scorePopSeqRef.current += 1;
    const id = scorePopSeqRef.current;
    setScorePops((prev) => [
      ...prev.slice(-3),
      {
        id,
        text: `${amount > 0 ? "+" : ""}${amount}`,
        tone: amount > 0 ? "good" : "bad",
      },
    ]);
    setTimeout(() => {
      setScorePops((prev) => prev.filter((pop) => pop.id !== id));
    }, 900);
  }, []);
  const [flashStationId, setFlashStationId] = useState<CDISCDomain | null>(
    null
  );
  const [lastBimoReport, setLastBimoReport] =
    useState<BIMOInspectionReport | null>(null);
  // A phase can lock its data and still draw a Form 483 (#899): the end panel
  // then owns that verdict and its causes instead of claiming a pass.
  const phaseClearForm483 =
    playState === "phase_cleared" && lastBimoReport
      ? describePhaseClearForm483(lastBimoReport, scoreState.auditViolations)
      : null;
  // Between shifts the header shows the filed report, which the closing
  // interview may have downgraded, not the live stream (#2172).
  const headerBimoReport =
    playState !== "playing" && lastBimoReport ? lastBimoReport : liveBimoReport;

  // 5. Audit Logger
  const addAuditLog = useCallback(
    (
      message: string,
      level: "INFO" | "WARN" | "CRITICAL" | "COMPLIANT" = "INFO",
      suspicionDelta = 0
    ) => {
      const entry = createAuditLogEntry(message, level, suspicionDelta);
      setAuditLogs((prev) => [...prev.slice(-50), entry]);
    },
    []
  );

  // 6. Sound Effects Handler
  const triggerSound = useCallback(
    (
      type:
        | "validate"
        | "incorrect"
        | "sign"
        | "error"
        | "amendment"
        | "alarm"
        | "powerup"
        | "chute"
    ) => {
      if (!soundEnabled || globalMuted) return;
      if (type === "validate") playValidationSound();
      else if (type === "incorrect") playChoiceIncorrectSound();
      else if (type === "sign") playSignatureVerifiedSound();
      else if (type === "error") playAuditErrorBuzz();
      else if (type === "amendment") playAmendmentSirenSound();
      else if (type === "alarm") playForm483AlarmSound();
      else if (type === "powerup") playPowerUpSound();
      else if (type === "chute") playPneumaticChuteSound();
    },
    [soundEnabled, globalMuted]
  );

  // 6b. Campaign-finale inspection (#2089). The report is filed once the
  // interview ends, from the run state captured when phase 3 locked.
  const fileFinaleReport = useCallback(
    (round: InspectionRound) => {
      const finale = pendingFinaleRef.current;
      pendingFinaleRef.current = null;
      setInspectionRound(null);
      if (!finale) return;
      const report = annotateInspectionReport(
        buildInspectionReport(
          finale.score,
          finale.auditor,
          finale.logs,
          finale.violations,
          finale.protocol,
          finale.skeletons,
          {
            inspection: round,
            now: new Date(),
            chargedSkeletons: finale.chargedSkeletons,
          }
        ),
        null,
        finale.amendments
      );
      setBimoReport(report);
      setLastBimoReport(report);
      if (report.verdict.startsWith("NAI")) {
        recordArcadeMilestone("clinical-chaos", "nai_campaign");
      }
      if (report.inspection?.clean) {
        recordArcadeMilestone("clinical-chaos", "clean_inspection");
      }
      announce(
        `Inspection report filed. Verdict: ${report.verdict}.`,
        "polite"
      );
    },
    [announce]
  );
  const handleInspectionAnswer = useCallback((optionId: string | null) => {
    setInspectionRound((prev) =>
      prev ? answerInspectionQuestion(prev, optionId) : prev
    );
  }, []);
  const handleInspectionNext = useCallback(() => {
    if (!inspectionRound) return;
    const next = advanceInspection(inspectionRound);
    if (isInspectionComplete(next)) fileFinaleReport(next);
    else setInspectionRound(next);
  }, [inspectionRound, fileFinaleReport]);
  const handleInspectionExtend = useCallback(() => {
    setInspectionRound((prev) => (prev ? extendInspectionTimer(prev) : prev));
  }, []);
  const handleInspectionTimerEnabled = useCallback((enabled: boolean) => {
    setInspectionRound((prev) =>
      prev ? setInspectionTimerEnabled(prev, enabled) : prev
    );
  }, []);
  const handleInspectionTick = useCallback((seconds: number) => {
    setInspectionRound((prev) =>
      prev ? tickInspectionTimer(prev, seconds) : prev
    );
  }, []);

  // 7. BGM Synth Controller
  useEffect(() => {
    if (bgmEnabled && soundEnabled && !globalMuted && playState === "playing") {
      startProceduralBGM();
      updateBGMTempo(auditor.suspicion);
    } else {
      stopProceduralBGM();
    }
    return () => {
      stopProceduralBGM();
    };
  }, [bgmEnabled, soundEnabled, globalMuted, playState, auditor.suspicion]);

  // 8. Start / Restart shift
  const startGame = useCallback(
    (mode: GameMode = "campaign", targetPhase: GamePhase = 1) => {
      setGameMode(mode);
      setPhase(targetPhase);
      setPlayState("playing");
      setIsPaused(false);
      setAuditor(applyOfficeToAuditor(createInitialAuditorState(), office));
      ambientTimerRef.current = 0;
      // Phases 2 and 3 continue the run, so the inspection that ends it can
      // ask about every skeleton and every locked CRF since phase 1 (#2089).
      if (mode === "campaign" && targetPhase > 1) {
        campaignSkeletonsRef.current = [
          ...campaignSkeletonsRef.current,
          ...sponsorRef.current.skeletons,
        ];
      } else {
        campaignSkeletonsRef.current = [];
      }
      if (targetPhase === 1) inspectionLedgerRef.current = [];
      pendingFinaleRef.current = null;
      setInspectionRound(null);
      const freshSponsor = createInitialSponsorState();
      sponsorRef.current = freshSponsor;
      setSponsor(freshSponsor);
      setGameOverReason("auditor");
      const phaseStations = getStationsForPhase(targetPhase, mode);
      setStations(phaseStations);
      setActiveAmendment(null);
      commitAmendmentEffects(createAmendmentEffectsState());
      setSelectedSubjectId(null);
      submittedSubjectIdsRef.current.clear();
      setRoutingNotice(null);
      setValidatingObs(null);
      setBimoReport(null);
      setLastBimoReport(null);
      // A new trial (phase 1 or endless) starts a fresh SDTM dataset; advancing
      // phases continues the same study, so its locked CRFs carry over.
      if (targetPhase === 1) setSubmittedHistory([]);
      // Advancing to campaign phase 2 or 3 continues the same run: the score,
      // tallies and charged lifelines carry over, so the campaign ends on one
      // total (#1325). Phase 1 and endless start fresh.
      const continuesCampaign = mode === "campaign" && targetPhase > 1;
      setRuleViolations([]);
      ruleViolationsRef.current = [];
      setRejectedChoices({});
      if (!continuesCampaign) setPowerUps(createInitialPowerUpInventory());
      setSignatureModal({
        isOpen: false,
        subject: null,
        selectedReason: "Intent to Submit",
        passwordInput: "••••••••",
        requiresReason: true,
      });

      // Initial subjects: Seeded for Phase 1 campaign or populated from active protocol
      const activeDomains = phaseStations.map((s) => s.id);
      // Generated openers draw from the shared subject sequence so labels stay
      // unique (SUBJ-1004+) instead of reusing fixed three-digit ids per run.
      const baseSubs: ClinicalSubject[] = activeProtocol
        ? [
            generateClinicalSubjectFromProtocol(
              activeProtocol,
              0.4,
              false,
              undefined,
              activeDomains
            ),
            generateClinicalSubjectFromProtocol(
              activeProtocol,
              0.6,
              false,
              undefined,
              activeDomains
            ),
            generateClinicalSubjectFromProtocol(
              activeProtocol,
              0.7,
              targetPhase >= 2,
              undefined,
              activeDomains
            ),
          ]
        : targetPhase === 1 && mode === "campaign"
          ? cloneDeep(SEEDED_SCENARIOS as unknown as ClinicalSubject[])
          : [
              generateClinicalSubject(0.4, false, undefined, activeDomains),
              generateClinicalSubject(0.6, false, undefined, activeDomains),
              generateClinicalSubject(
                0.7,
                targetPhase >= 2,
                undefined,
                activeDomains
              ),
            ];

      const initialSubs = baseSubs.map((sub, i) =>
        applyOfficeToSubject(sub, office, i)
      );
      setConveyorSubjects(initialSubs);
      setSelectedSubjectId(initialSubs[0]?.id ?? null);
      const calibrationId = shouldRunCalibration(mode, targetPhase)
        ? (initialSubs[0]?.id ?? null)
        : null;
      setCalibrationSubjectId(calibrationId);
      calibrationActiveRef.current = calibrationId !== null;
      setScoreState((prev) =>
        getNextShiftScoreState(prev, continuesCampaign, effectiveHighScore)
      );

      addAuditLog(
        `[STUDY PROTOCOL ONLINE] Phase ${targetPhase} (${
          targetPhase === 1
            ? "Phase-I Healthy Cohort"
            : targetPhase === 2
              ? "Phase-II Dose Escalation & ConMed"
              : "Phase-III Global Multi-Center"
        }) EDC Stations Activated: [${activeDomains.join(", ")}].`,
        "INFO"
      );
      addAuditLog(
        `[OFFICE] Clocked in at ${office.name}. ${office.quirk}`,
        "INFO"
      );
      addAuditLog(`[WARDROBE] ${outfit.clockInLine}`, "INFO");

      recordEvent("clinical_trial_chaos", "project_click").catch(() => {});

      // Focus the board so hotkeys work (the Start button unmounts on click)
      // and, outside a cabinet, bring it into view clear of the navbar.
      const board = containerRef.current;
      if (board) {
        const reduceMotion = readReducedMotion();
        requestAnimationFrame(() => {
          board.focus({ preventScroll: true });
          if (isFullscreen || typeof window.scrollTo !== "function") return;
          // Inside a cabinet, PlayCabinet already holds its marquee just
          // under the header; scrolling the board would tuck the Setup and
          // Power bar under the navbar (#1937).
          if (board.closest("[data-arcade-cabinet]")) return;
          const NAVBAR_CLEARANCE_PX = 80;
          window.scrollTo({
            top: Math.max(
              0,
              window.scrollY +
                board.getBoundingClientRect().top -
                NAVBAR_CLEARANCE_PX
            ),
            behavior: reduceMotion ? "auto" : "smooth",
          });
        });
      }
    },
    [
      readReducedMotion,
      addAuditLog,
      recordEvent,
      effectiveHighScore,
      activeProtocol,
      office,
      outfit,
      isFullscreen,
      setAuditor,
      setConveyorSubjects,
      setPowerUps,
      commitAmendmentEffects,
    ]
  );

  // 8b. Pause and resume a running shift (#1672). The loop keeps drawing but
  // advances no clock; the resume stamp keeps the first frame from jumping.
  const togglePause = useCallback(() => {
    if (playState !== "playing") return;
    const next = !isPaused;
    if (!next) lastTickTimeRef.current = Date.now();
    setIsPaused(next);
    announce(
      next
        ? "Shift paused. Every clock is stopped. Press P or Resume to continue."
        : "Shift resumed.",
      "assertive"
    );
  }, [playState, isPaused, announce]);

  // 9. Active Subject in Dossier
  const activeSubject = useMemo(() => {
    return (
      conveyorSubjects.find((s) => s.id === selectedSubjectId) ||
      conveyorSubjects[0] ||
      null
    );
  }, [conveyorSubjects, selectedSubjectId]);

  // 10. Generate full SDTM dataset from submitted subjects
  const sdtmDataset: SDTMRow[] = useMemo(() => {
    return generateSDTMDataset(submittedHistory);
  }, [submittedHistory]);

  const filteredSDTMRows = useMemo(() => {
    if (sdtmFilterDomain === "ALL") return sdtmDataset;
    return sdtmDataset.filter((r) => r.DOMAIN === sdtmFilterDomain);
  }, [sdtmDataset, sdtmFilterDomain]);

  // 11. Floor feedback (#1521): a routed folder drops into its chute, a
  // wrong route bounces back with a red stamp, an expired one slides off.
  // Reduced motion and phones keep only the stamp and the chute flash.
  const queueFolderFx = useCallback(
    (
      kind: "drop" | "bounce" | "expire",
      subj: ClinicalSubject,
      domain: CDISCDomain | null,
      selectedId: string | null,
      sortedStations: readonly StationConfig[]
    ) => {
      const view = conveyorViewRef.current;
      const g = getConveyorGeometry(view.width, view.height);
      const anim = floorAnimRef.current;
      const now = performance.now();
      const calm = readCalmMotion();
      const visible = getVisibleSubjects(
        conveyorSubjectsRef.current,
        selectedId,
        g.visibleSlots
      );
      const index = visible.findIndex((s) => s.id === subj.id);
      const fromX =
        anim.folderX.get(subj.id) ??
        (index >= 0 ? getSlotX(g, index) : undefined);
      const chuteIndex = domain
        ? sortedStations.findIndex((s) => s.id === domain)
        : -1;
      if (domain && chuteIndex >= 0 && !g.compact) {
        anim.chuteFlash.push({
          domain,
          tone: kind === "drop" ? "good" : "bad",
          until:
            now + (kind === "drop" && !calm ? FOLDER_FX_MS.drop + 360 : 520),
        });
      }
      if (fromX === undefined) return;
      if (kind !== "bounce" && (calm || g.compact)) return;
      const toX =
        chuteIndex >= 0
          ? getChuteSlots(view.width, sortedStations.length, g.beltLeft)[
              chuteIndex
            ].cx
          : fromX;
      anim.fx = anim.fx.filter((f) => f.subjectId !== subj.id);
      anim.fx.push(
        createFolderFx(
          kind,
          subj,
          sortedStations,
          fromX,
          toX,
          now,
          calm ? 0 : undefined
        )
      );
    },
    [conveyorSubjectsRef, readCalmMotion]
  );

  // 12. Handle Multi-Choice Validation Selection
  const handleSelectChoice = useCallback(
    (choice: string) => {
      if (!validatingObs) return;
      const { subjectId, obs } = validatingObs;
      const rejectionKey = `${subjectId}:${obs.id}`;
      if (rejectedChoices[rejectionKey]?.includes(choice)) return;

      const result = validateObservationChoice(obs, choice, activeProtocol);

      if (result.isValid) {
        triggerSound("validate");
        setValidatingObs((prev) =>
          prev
            ? {
                ...prev,
                selectedChoice: choice,
                feedback: { isValid: true, text: result.explanation },
              }
            : null
        );

        setConveyorSubjects((prev) =>
          replaceObservation(prev, subjectId, result.observation)
        );
        pushScorePop(result.scoreDelta);
        setScoreState((prev) => applyCorrectionScore(prev, result.scoreDelta));
        setPowerUps((pu) => chargePowerUps(pu, applyOfficeCharge(1, office)));
        addAuditLog(
          formatCorrectionLog(obs.field, choice, result.explanation),
          "COMPLIANT",
          result.suspicionDelta
        );

        // Auto close after brief display
        setTimeout(() => {
          setValidatingObs(null);
        }, 550);
      } else {
        triggerSound("incorrect");
        setRejectedChoices((prev) => ({
          ...prev,
          [rejectionKey]: [...(prev[rejectionKey] ?? []), choice],
        }));
        setValidatingObs((prev) =>
          prev
            ? {
                ...prev,
                selectedChoice: choice,
                feedback: { isValid: false, text: result.explanation },
              }
            : null
        );

        setAuditor((aud) => raiseAuditorSuspicion(aud, result.suspicionDelta));

        // Record rule violation for final regulatory inspection report
        const violation = createRuleViolation(
          obs,
          choice,
          result,
          activeSubject?.subjectLabel || "SUBJ-UNK"
        );
        // Replace the ref's array rather than pushing onto it: the ref holds
        // the state array itself, so a push would also land in `prev` and
        // record every wrong pick twice (#1553).
        ruleViolationsRef.current = appendRuleViolation(
          ruleViolationsRef.current,
          violation
        );
        setRuleViolations((prev) => appendRuleViolation(prev, violation));

        addAuditLog(
          formatRuleFailureLog(
            obs.field,
            choice,
            result.ruleName,
            result.suspicionDelta
          ),
          "WARN",
          result.suspicionDelta
        );
      }
    },
    [
      validatingObs,
      rejectedChoices,
      activeProtocol,
      activeSubject,
      office,
      triggerSound,
      addAuditLog,
      pushScorePop,
      setAuditor,
      setConveyorSubjects,
      setPowerUps,
    ]
  );

  // 12b. Complete a verified submission: scoring, combo/multiplier, lifeline
  // charge, auditor cool-down, station count, sponsor boost, history, and the
  // campaign phase-target check. The signature modal and the Fast-Track
  // lifeline both finish through here so neither can skip a side effect.
  const completeSubmission = useCallback(
    (
      subj: ClinicalSubject,
      domain: CDISCDomain,
      {
        allClean,
        suspicionDelta,
      }: { allClean: boolean; suspicionDelta: number },
      signature: InspectionSignature
    ) => {
      // The audit trail the finale inspection asks about (#2089).
      inspectionLedgerRef.current = [
        ...inspectionLedgerRef.current,
        createInspectionRecord(subj, domain, signature),
      ];
      queueFolderFx(
        "drop",
        subj,
        domain,
        selectedSubjectId,
        [...stations].sort((a, b) => a.positionIndex - b.positionIndex)
      );
      const {
        submission,
        scoreState: settledScore,
        phaseCleared,
      } = settleSubmission(scoreState, subj, allClean, gameMode, phase, (p) =>
        applyOfficeScore(p, office)
      );
      pushScorePop(submission.points);
      setScoreState((prev) => applySubmissionScore(prev, submission, allClean));
      // Persist outside the updater (AGENTS.md §4).
      safeSetRawItem(
        "clinical_chaos_highscore",
        settledScore.highScore.toString()
      );
      recordArcadeScore("clinical-chaos", settledScore.highScore);
      // Endless Audit Years (#2053): crossing a year boundary raises the
      // next axis, opens any new station and is kept as the endless best.
      if (gameMode === "endless") {
        const prevYear = getAuditYear(scoreState.subjectsSubmitted);
        const nextYear = getAuditYear(settledScore.subjectsSubmitted);
        persistEndlessBest(settledScore.score, nextYear);
        if (nextYear > prevYear) {
          addAuditLog(formatAuditYearLog(nextYear), "WARN");
          setStations((prev) =>
            addOpenedStations(prev, getStationsForPhase(1, "endless", nextYear))
          );
          announce(
            `Audit Year ${nextYear}. ${describeAuditYear(nextYear)}`,
            "polite"
          );
        }
      }
      // A double-signature audit counts each lock as countersigned (#2053).
      const amendmentLock = recordAmendmentLock(amendmentEffectsRef.current);
      if (amendmentLock.state !== amendmentEffectsRef.current) {
        commitAmendmentEffects(amendmentLock.state);
      }
      if (amendmentLock.auditClosed) {
        addAuditLog(
          "[21 CFR 11.50] Double-signature audit closed: every CRF in scope carries an author signature and an independent reviewer countersignature.",
          "COMPLIANT"
        );
        announce("Double-signature audit closed.", "polite");
      }
      setPowerUps((pu) =>
        chargePowerUps(
          pu,
          applyOfficeCharge(getSubmissionCharge(allClean), office)
        )
      );
      setAuditor((prev) => adjustAuditorSuspicion(prev, suspicionDelta));
      setStations((prev) => recordStationSubmission(prev, domain));

      // Sponsors love throughput
      sponsorRef.current = applySponsorSubmissionBoost(
        sponsorRef.current,
        allClean
      );
      setSponsor(sponsorRef.current);

      // Record to submitted history
      setSubmittedHistory((prev) => [...prev, subj]);

      // Remove from conveyor
      setConveyorSubjects((prev) => prev.filter((s) => s.id !== subj.id));

      if (subj.id === calibrationSubjectId) {
        setCalibrationSubjectId(null);
        calibrationActiveRef.current = false;
        announce("Calibration complete. The shift is live.", "polite");
      }

      // Load the most urgent remaining dossier (#834).
      const nextSubject = selectNextDossier(
        conveyorSubjects,
        subj.id,
        phaseCleared
      );
      setSelectedSubjectId(nextSubject?.id ?? null);
      if (nextSubject) {
        const cue = formatNextDossierCue(nextSubject);
        setNextDossierCue({ subjectId: nextSubject.id, text: cue });
        announce(cue, "polite");
      } else {
        setNextDossierCue(null);
      }

      if (phaseCleared && gameMode === "campaign" && phase === 3) {
        // The campaign finale (#2089): the auditor interviews the site about
        // records from this run before the report is filed.
        setPlayState("phase_cleared");
        playSuccess();
        const skeletons = [
          ...campaignSkeletonsRef.current,
          ...sponsorRef.current.skeletons,
        ];
        const records = inspectionLedgerRef.current;
        pendingFinaleRef.current = {
          score: settledScore,
          auditor,
          logs: auditLogs,
          violations: ruleViolations,
          protocol: activeProtocol,
          skeletons,
          chargedSkeletons: campaignSkeletonsRef.current.length,
          amendments: amendmentEffectsRef.current,
        };
        const round = createInspectionRound(
          records,
          skeletons,
          createSeededRandom(getInspectionSeed(records))
        );
        if (round.questions.length === 0) {
          fileFinaleReport(round);
        } else {
          setInspectionRound(round);
          announce(
            "Database locked. The FDA inspector is pulling records for a closing interview.",
            "assertive"
          );
        }
      } else if (phaseCleared) {
        setPlayState("phase_cleared");
        playSuccess();
        // Grade the phase on the tallies after this final CRF, so its clean
        // count is included (#1609).
        const report = annotateInspectionReport(
          buildInspectionReport(
            settledScore,
            auditor,
            auditLogs,
            ruleViolations,
            activeProtocol,
            sponsorRef.current.skeletons
          ),
          null,
          amendmentEffectsRef.current
        );
        setBimoReport(report);
        setLastBimoReport(report);
      }
    },
    [
      scoreState,
      office,
      auditor,
      auditLogs,
      ruleViolations,
      activeProtocol,
      gameMode,
      phase,
      conveyorSubjects,
      calibrationSubjectId,
      selectedSubjectId,
      stations,
      queueFolderFx,
      pushScorePop,
      playSuccess,
      announce,
      addAuditLog,
      setAuditor,
      setConveyorSubjects,
      setPowerUps,
      commitAmendmentEffects,
      fileFinaleReport,
    ]
  );

  // 13. Power-Up Trigger Execution
  const triggerPowerUp = useCallback(
    (type: PowerUpType) => {
      const p = powerUps[type];
      const refusal = getPowerUpRefusal(
        powerUps,
        type,
        playState === "playing",
        activeSubject
      );
      if (refusal) {
        // Say why, and keep the charge: a lifeline that cannot change the
        // dossier is never spent on it (#1673).
        if (playState === "playing" && p) {
          announce(describePowerUpRefusal(refusal, p.name), "polite");
        }
        return;
      }

      triggerSound("powerup");

      if (type === "fda-coffee-break") {
        setAuditor(startCoffeeBreak);
        addAuditLog(COFFEE_BREAK_START_LOG, "COMPLIANT");
      } else if (type === "auto-clean") {
        if (activeSubject) {
          setConveyorSubjects((prev) =>
            prev.map((sub) =>
              sub.id === activeSubject.id ? autoCleanSubject(sub) : sub
            )
          );
          addAuditLog(
            `✨ [POWER-UP ACTIVATED] CDISC Auto-Clean standardized all fields on ${activeSubject.subjectLabel}.`,
            "COMPLIANT"
          );
        }
      } else if (type === "query-extension") {
        setConveyorSubjects(extendSubjectDeadlines);
        addAuditLog(QUERY_EXTENSION_LOG, "COMPLIANT");
      } else if (type === "fast-sign") {
        if (activeSubject) {
          // Auto-clean, then sign to the first active station the subject
          // routes to, exactly as a signed CRF would be.
          const cleanedSubject = autoCleanSubject(activeSubject);
          const domain = getFastTrackDomain(cleanedSubject, stations);
          const result = verify21CFRSubmission(
            cleanedSubject,
            cleanedSubject.isSAE
              ? "Urgent Safety Expedited"
              : "Intent to Submit",
            domain
          );

          triggerSound("sign");
          addAuditLog(
            `⚡ [FAST-TRACK 21 CFR PASS] Expedited NDA sign-off for ${cleanedSubject.subjectLabel} -> ${domain}.`,
            "COMPLIANT"
          );
          completeSubmission(
            cleanedSubject,
            domain,
            {
              allClean: true,
              suspicionDelta: result.success ? result.suspicionDelta : 0,
            },
            {
              method: "fast-track",
              reason: cleanedSubject.isSAE
                ? "Urgent Safety Expedited"
                : "Intent to Submit",
              signatures: 1,
            }
          );
        }
      }

      setPowerUps((prev) => spendPowerUp(prev, type));
      announce(`${p.name} activated`, "polite");
    },
    [
      powerUps,
      playState,
      activeSubject,
      stations,
      triggerSound,
      addAuditLog,
      completeSubmission,
      announce,
      setAuditor,
      setConveyorSubjects,
      setPowerUps,
    ]
  );

  // 13b. Answer the sponsor's latest email
  const handleSponsorChoice = useCallback(
    (choiceIndex: number) => {
      const request = sponsorRef.current.activeRequest?.request;
      const choice = request?.choices[choiceIndex];
      const {
        state: next,
        effects,
        outcome,
      } = resolveSponsorChoice(sponsorRef.current, choiceIndex);
      if (!request || !choice || !effects) return;

      sponsorRef.current = next;
      setSponsor(next);
      triggerSound("validate");

      if (effects.suspicion !== 0) {
        setAuditor((prev) => ({
          ...prev,
          suspicion: clamp(prev.suspicion + effects.suspicion, 0, 100),
        }));
      }
      if (effects.score !== 0) {
        pushScorePop(effects.score);
        setScoreState((prev) => ({
          ...prev,
          score: Math.max(0, prev.score + effects.score),
        }));
      }
      if (effects.timeBonusSeconds !== 0) {
        setConveyorSubjects((prev) =>
          prev.map((sub) => {
            // A penalty never drops a subject below min(current, 3) seconds;
            // the upper bound is lifted to that floor so it cannot invert.
            const floor = Math.min(sub.timeRemaining, 3);
            return {
              ...sub,
              timeRemaining: clamp(
                sub.timeRemaining + effects.timeBonusSeconds,
                floor,
                Math.max(floor, sub.maxTime + 10)
              ),
            };
          })
        );
      }
      if (effects.powerUpCharge > 0) {
        setPowerUps((pu) => chargePowerUps(pu, effects.powerUpCharge));
      }

      addAuditLog(
        `[SPONSOR] Replied to ${request.from}: "${choice.label}". ${outcome}${
          effects.skeleton ? " 🦴 (A new skeleton joins the closet.)" : ""
        }`,
        effects.skeleton || effects.suspicion > 0 ? "WARN" : "INFO",
        effects.suspicion
      );
      announce(`Replied to ${request.from}. ${outcome}`, "polite");
    },
    [
      addAuditLog,
      triggerSound,
      announce,
      pushScorePop,
      setAuditor,
      setConveyorSubjects,
      setPowerUps,
    ]
  );

  // 14. Shared verified submission path for routine and reviewed dossiers.
  const submitDossier = useCallback(
    (
      subj: ClinicalSubject,
      reason: SignatureReason,
      domain: CDISCDomain,
      mode: "quick" | "full",
      signatures = 1
    ) => {
      if (submittedSubjectIdsRef.current.has(subj.id)) {
        setSignatureModal((prev) => ({
          ...prev,
          isOpen: false,
          subject: null,
        }));
        return;
      }
      const result = verify21CFRSubmission(subj, reason, domain);

      if (result.success) {
        submittedSubjectIdsRef.current.add(subj.id);
        triggerSound("sign");
        triggerSound("chute");
        setFlashStationId(domain);
        setTimeout(() => setFlashStationId(null), 700);
        addAuditLog(
          mode === "quick"
            ? `[SIMULATED ROUTINE DISPATCH] ${subj.subjectLabel} routed to ${domain} without exceptional review.`
            : result.logMessage,
          "COMPLIANT",
          result.suspicionDelta
        );

        completeSubmission(
          subj,
          domain,
          {
            allClean: isSubjectFullyCompliant(subj),
            suspicionDelta: result.suspicionDelta,
          },
          mode === "quick"
            ? { method: "routine", reason, signatures: 0 }
            : { method: "signed", reason, signatures }
        );
        announce(`${subj.subjectLabel} routed to ${domain}`, "polite");
      } else {
        triggerSound("error");
        addAuditLog(result.logMessage, result.level, result.suspicionDelta);
        // Say why on the board itself, not only in the audit log tab (#1326).
        const { matchingDomains } = getRoutingReadiness(subj, stations);
        const reasonError = result.reasonMismatch
          ? getSignatureReasonError(subj, reason)
          : null;
        const rejection = reasonError
          ? `Rejected: wrong signature reason for ${subj.subjectLabel}: ${reasonError}`
          : `Rejected: ${subj.subjectLabel} does not belong at ${domain}.${
              matchingDomains.length > 0
                ? ` Route it to ${matchingDomains.join(" or ")}.`
                : ""
            }`;
        setRoutingNotice({
          subjectId: subj.id,
          unresolvedCount: 0,
          message: rejection,
        });
        announce(rejection, "assertive");
        // On the floor: the folder bounces back off the chute with a red
        // REJECTED stamp, and the stage shakes once (#1521).
        queueFolderFx(
          "bounce",
          subj,
          domain,
          selectedSubjectId,
          [...stations].sort((a, b) => a.positionIndex - b.positionIndex)
        );
        fx.shake(4);
        fx.flash("#ef4444");

        // GCP spot inspection (#2053): a misroute to the watched station is
        // seen first-hand, so it counts double toward suspicion.
        let suspicionDelta = result.suspicionDelta;
        if (!result.reasonMismatch) {
          const inspected = applySpotInspectionMisroute(
            amendmentEffectsRef.current,
            domain,
            result.suspicionDelta
          );
          if (inspected.doubled) {
            commitAmendmentEffects(inspected.state);
            suspicionDelta = inspected.suspicionDelta;
            addAuditLog(
              `[GCP SPOT INSPECTION] The FDA investigator watched ${subj.subjectLabel} misrouted at the ${domain} station. Suspicion counts double (+${suspicionDelta}%).`,
              "CRITICAL",
              suspicionDelta - result.suspicionDelta
            );
          }
        }

        setScoreState((prev) => breakCombo(prev));
        setAuditor((prev) => raiseAuditorSuspicion(prev, suspicionDelta));
      }
      setSignatureModal((prev) => ({ ...prev, isOpen: false, subject: null }));
    },
    [
      triggerSound,
      queueFolderFx,
      fx,
      selectedSubjectId,
      addAuditLog,
      completeSubmission,
      announce,
      stations,
      setAuditor,
      commitAmendmentEffects,
    ]
  );

  // 15. Route now or open the full review dialog for exceptional packets.
  const handleInitiateSubmission = useCallback(
    (domain: CDISCDomain) => {
      if (!activeSubject) return;
      // A quick dispatch clears the selection, so the queue head becomes the
      // active subject at once. Ignore a double-click or repeated hotkey so
      // it cannot route a dossier the player has not looked at.
      if (Date.now() - lastQuickDispatchAtRef.current < QUICK_DISPATCH_GUARD_MS)
        return;
      // Only a premature route is forgiven (#834 Prompt 1). A clean dossier
      // sent to the wrong station is a genuinely invalid submission and still
      // goes through verify21CFRSubmission and its penalties.
      const { unresolvedCount } = getRoutingReadiness(activeSubject, stations);
      if (unresolvedCount > 0) {
        const message = `Resolve ${unresolvedCount} flagged observation${unresolvedCount === 1 ? "" : "s"} before routing`;
        setRoutingNotice({
          subjectId: activeSubject.id,
          unresolvedCount,
          message,
        });
        announce(message, "polite");
        return;
      }
      setRoutingNotice(null);
      const signaturesRequired = getRequiredSignatureCount(amendmentEffects);
      if (
        getSubmissionMode(activeSubject, domain, stations, {
          gameMode,
          submittedCount: scoreState.subjectsSubmitted,
          phaseTarget: PHASE_TARGETS[phase],
          amendmentActive: !!activeAmendment?.active,
          signaturesRequired,
        }) === "quick"
      ) {
        lastQuickDispatchAtRef.current = Date.now();
        submitDossier(activeSubject, "Intent to Submit", domain, "quick");
        return;
      }
      setTargetRoutingStation(domain);
      setSignatureModal({
        isOpen: true,
        subject: activeSubject,
        // Always starts on the routine reason: signing an SAE is a decision
        // the player makes, not a default (#1937).
        selectedReason: "Intent to Submit",
        passwordInput: "••••••••",
        requiresReason: true,
        signaturesRequired,
        signaturesApplied: 0,
      });
    },
    [
      activeSubject,
      stations,
      announce,
      gameMode,
      scoreState.subjectsSubmitted,
      phase,
      activeAmendment,
      amendmentEffects,
      submitDossier,
    ]
  );

  // 16. Confirm the exceptional packet through the same submission path.
  const handleConfirmSignature = useCallback(() => {
    if (!signatureModal.subject) return;
    // Double-signature audit (#2053): the first step applies the author's
    // signature and keeps the dialog open for the reviewer's countersignature.
    const applied = (signatureModal.signaturesApplied ?? 0) + 1;
    if (applied < (signatureModal.signaturesRequired ?? 1)) {
      triggerSound("sign");
      addAuditLog(
        `[21 CFR 11.50] Author signature applied to ${signatureModal.subject.subjectLabel} (${signatureModal.selectedReason}). Awaiting an independent reviewer countersignature.`,
        "INFO"
      );
      setSignatureModal((prev) => ({ ...prev, signaturesApplied: applied }));
      announce(
        "Author signature applied. Sign again as the independent reviewer to lock the CRF.",
        "polite"
      );
      return;
    }
    submitDossier(
      signatureModal.subject,
      signatureModal.selectedReason,
      targetRoutingStation,
      "full",
      signatureModal.signaturesRequired ?? 1
    );
  }, [
    signatureModal,
    targetRoutingStation,
    submitDossier,
    triggerSound,
    addAuditLog,
    announce,
  ]);

  // 16. Canvas 2D floor scene renderer (#1521)
  const hotkeyStations = useMemo(
    () => [...stations].sort((a, b) => a.positionIndex - b.positionIndex),
    [stations]
  );
  const acceptingDomains = useMemo(() => {
    if (playState !== "playing" || !activeSubject) return [];
    const readiness = getRoutingReadiness(activeSubject, stations);
    return readiness.unresolvedCount === 0 ? readiness.matchingDomains : [];
  }, [playState, activeSubject, stations]);
  const watchedStationId = amendmentEffects.spotInspection?.stationId ?? null;
  const renderConveyorCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      auditorState: AuditorState,
      subjects: ClinicalSubject[],
      still = false
    ) =>
      drawConveyor(ctx, width, height, auditorState, subjects, {
        selectedSubjectId,
        officeId: office.id,
        floorColor: office.floorColor,
        outfit,
        stations: hotkeyStations,
        acceptingDomains,
        watchedDomain: watchedStationId,
        beltOffset: beltOffsetRef.current,
        now: performance.now(),
        calm: still || readCalmMotion(),
        anim: floorAnimRef.current,
        pixelRatio: conveyorViewRef.current.scale,
      }),
    [
      readCalmMotion,
      selectedSubjectId,
      office.id,
      office.floorColor,
      outfit,
      hotkeyStations,
      acceptingDomains,
      watchedStationId,
    ]
  );

  useEffect(() => {
    if (activeTab !== "conveyor") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const displayWidth = Math.floor(canvas.getBoundingClientRect().width);
      if (displayWidth <= 0) return;
      const { width: logicalWidth, height: logicalHeight } =
        getConveyorLogicalSize(displayWidth);
      const resolution = computeCanvasResolution(
        logicalWidth,
        logicalHeight,
        displayWidth,
        window.devicePixelRatio
      );
      conveyorViewRef.current = {
        width: logicalWidth,
        height: logicalHeight,
        scale: resolution.scale,
      };
      // The bitmap is device pixels; expose the logical layout for tests.
      canvas.dataset.logicalWidth = String(logicalWidth);
      canvas.dataset.logicalHeight = String(logicalHeight);
      if (
        canvas.width !== resolution.width ||
        canvas.height !== resolution.height
      ) {
        canvas.width = resolution.width;
        canvas.height = resolution.height;
        // Resizing clears the bitmap; let the static-frame effect redraw it.
        setCanvasSize(`${resolution.width}x${resolution.height}`);
      }
      // The CSS box follows the bitmap chosen from the canvas's own width,
      // not a viewport breakpoint, so the drawing is never stretched. Set it
      // unconditionally: the initial bitmap attributes may already match.
      canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
    };

    resizeCanvas();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeTab]);

  // 16b. Mirroring Refs for Stable Game Loop
  const playStateRef = useRef(playState);
  const phaseRef = useRef(phase);
  const gameModeRef = useRef(gameMode);
  const announceRef = useRef(announce);
  const officeRef = useRef(office);
  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const stationsRef = useRef(stations);
  const scoreStateRef = useRef(scoreState);
  // What the board last rendered, which the loop compares against to decide
  // whether a frame changes the display (#1628).
  const renderedLoopStateRef = useRef({
    subjects: conveyorSubjects,
    auditor,
    powerUps,
  });
  const activeAmendmentRef = useRef(activeAmendment);
  // Sync only when the state changes: the game loop owns the countdown, and
  // an every-render sync would reset it to the last rendered value.
  useEffect(() => {
    activeAmendmentRef.current = activeAmendment;
  }, [activeAmendment]);
  const auditLogsRef = useRef(auditLogs);
  const addAuditLogRef = useRef(addAuditLog);
  const triggerSoundRef = useRef(triggerSound);
  const renderConveyorCanvasRef = useRef(renderConveyorCanvas);
  const validatingObsRef = useRef(validatingObs);
  const signatureModalRef = useRef(signatureModal);
  const isPausedRef = useRef(isPaused);
  const isManualOpenRef = useRef(isManualOpen);
  // The touch cabinet's stress sheet holds the shift still like the Field
  // Manual does, because it covers the floor while the player sets it.
  const stressSheetOpenRef = useRef(false);

  // Sync refs on every render
  useEffect(() => {
    playStateRef.current = playState;
    phaseRef.current = phase;
    gameModeRef.current = gameMode;
    announceRef.current = announce;
    officeRef.current = office;
    selectedSubjectIdRef.current = selectedSubjectId;
    stationsRef.current = stations;
    scoreStateRef.current = scoreState;
    renderedLoopStateRef.current = {
      subjects: conveyorSubjects,
      auditor,
      powerUps,
    };
    auditLogsRef.current = auditLogs;
    addAuditLogRef.current = addAuditLog;
    triggerSoundRef.current = triggerSound;
    renderConveyorCanvasRef.current = renderConveyorCanvas;
    validatingObsRef.current = validatingObs;
    signatureModalRef.current = signatureModal;
    isPausedRef.current = isPaused;
    isManualOpenRef.current = isManualOpen;
    stressSheetOpenRef.current = touchCabinet && isStressDrawerOpen;
    activeProtocolRef.current = activeProtocol;
    ruleViolationsRef.current = ruleViolations;
  });

  // 16c. Pause and resume that are safe to repeat. One Escape can reach both
  // the board's key handler and the pause dialog's own handler, so asking for
  // a state the shift is already in does nothing instead of flipping it back.
  const setShiftPaused = useCallback((paused: boolean) => {
    if (playStateRef.current !== "playing") return;
    if (isPausedRef.current === paused) return;
    isPausedRef.current = paused;
    if (!paused) lastTickTimeRef.current = Date.now();
    setIsPaused(paused);
    announceRef.current(
      paused
        ? "Shift paused. Every clock is stopped. Press P or Resume to continue."
        : "Shift resumed.",
      "assertive"
    );
  }, []);

  // The touch cabinet asks the game to stop when the tab is hidden, the page
  // is closing or the window loses focus (#2105). Only a shift in progress
  // pauses, and resuming is the player's choice.
  useEffect(() => {
    const pauseForBackground = () => setShiftPaused(true);
    window.addEventListener(
      CLINICAL_CHAOS_AUTO_PAUSE_EVENT,
      pauseForBackground
    );
    return () =>
      window.removeEventListener(
        CLINICAL_CHAOS_AUTO_PAUSE_EVENT,
        pauseForBackground
      );
  }, [setShiftPaused]);

  // First-shift calibration (#834)
  const calibrationStep =
    calibrationSubjectId && playState === "playing"
      ? getCalibrationStep(conveyorSubjects, calibrationSubjectId)
      : null;
  const calibrationActive =
    calibrationStep !== null && calibrationStep !== "complete";
  const calibrationSubject = calibrationActive
    ? (conveyorSubjects.find((s) => s.id === calibrationSubjectId) ?? null)
    : null;
  useEffect(() => {
    calibrationActiveRef.current = calibrationActive;
  }, [calibrationActive]);
  useEffect(() => {
    if (calibrationStep === "fix") {
      announce(
        "Calibration: clocks are paused. Step 1, fix the flagged field on the first dossier.",
        "polite"
      );
    } else if (calibrationStep === "route") {
      announce(
        "Calibration step 2: route the clean dossier to its matching station to sign it.",
        "polite"
      );
    }
  }, [calibrationStep, announce]);
  const skipCalibration = () => {
    setCalibrationSubjectId(null);
    calibrationActiveRef.current = false;
    announce("Calibration skipped. The shift is live.", "polite");
    containerRef.current?.focus({ preventScroll: true });
  };

  // 17. Main Game Loop Tick (useAnimationFrame)
  //
  // The loop runs while a shift is playing and the canvas context is live.
  // Its clock stays on Date.now() with the 100 ms clamp below, as before, so
  // the hook's own delta is unused and unclamped (maxDeltaMs: Infinity).
  // The context listeners set a ref that guards the frame already in flight
  // and a state flag that stops the loop; restoring starts a fresh one.
  const contextLostRef = useRef(false);
  const [isContextLost, setIsContextLost] = useState(false);

  useEffect(() => {
    if (playState !== "playing") return;

    lastTickTimeRef.current = Date.now();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      lastTickTimeRef.current = Date.now();
      setIsContextLost(false);
    };

    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
      contextLostRef.current = false;
      setIsContextLost(false);
    };
  }, [playState]);

  useAnimationFrame(
    () => {
      if (contextLostRef.current) return;

      // Ends the shift on a Form 483 or a terminated sponsor contract and
      // files the BIMO inspection report from the latest simulation state.
      const endShift = (reason: "auditor" | "sponsor") => {
        triggerSoundRef.current("alarm");
        playStateRef.current = "game_over";
        setGameOverReason(reason);
        setPlayState("game_over");
        addAuditLogRef.current(SHIFT_END_LOGS[reason], "CRITICAL");
        const endless = gameModeRef.current === "endless";
        const yearReached = getAuditYear(
          scoreStateRef.current.subjectsSubmitted
        );
        if (endless) {
          persistEndlessBest(scoreStateRef.current.score, yearReached);
        }
        const report = annotateInspectionReport(
          buildInspectionReport(
            scoreStateRef.current,
            auditorRef.current,
            auditLogsRef.current,
            ruleViolationsRef.current,
            activeProtocolRef.current,
            sponsorRef.current.skeletons
          ),
          endless ? yearReached : null,
          amendmentEffectsRef.current
        );
        setBimoReport(report);
        setLastBimoReport(report);
      };

      const now = Date.now();
      // A pause, the Field Manual and calibration hold every clock still
      // (#1672); a fix or signature dialog only slows them, so thinking
      // inside a decision still costs time (#1937).
      const clockRate = getShiftClockRate({
        userPaused: isPausedRef.current,
        manualOpen: isManualOpenRef.current || stressSheetOpenRef.current,
        dialogOpen:
          !!validatingObsRef.current || !!signatureModalRef.current?.isOpen,
        calibrating: calibrationActiveRef.current,
      });
      const halted = clockRate === 0;
      const deltaSeconds = getShiftTickSeconds(
        now - lastTickTimeRef.current,
        halted,
        clockRate
      );
      lastTickTimeRef.current = now;

      let uiNeedsSync = false;

      const preTickAuditorX = auditorRef.current.x;
      // 1-4. Deadlines, auditor patrol, lifeline durations and the running
      // amendment advance through the shared shift rules (#901).
      const tick = tickShiftClocks(
        {
          subjects: conveyorSubjectsRef.current,
          auditor: auditorRef.current,
          scoreState: scoreStateRef.current,
          powerUps: powerUpsRef.current,
          amendment: activeAmendmentRef.current,
        },
        deltaSeconds,
        stressParamsRef.current.auditorPacingMultiplier
      );
      conveyorSubjectsRef.current = tick.subjects;
      auditorRef.current = tick.auditor;
      powerUpsRef.current = tick.powerUps;
      const loopAuditYear =
        gameModeRef.current === "endless"
          ? getAuditYear(scoreStateRef.current.subjectsSubmitted)
          : 1;

      // GCP spot inspection (#2053): the window runs on the shift clock and
      // the auditor stands at the watched chute until it closes.
      const effectsTick = tickAmendmentEffects(
        amendmentEffectsRef.current,
        deltaSeconds
      );
      if (effectsTick.inspectionEnded) {
        uiNeedsSync = true;
        commitAmendmentEffects(effectsTick.state);
        const ended = effectsTick.inspectionEnded;
        auditorRef.current = {
          ...auditorRef.current,
          behavior:
            auditorRef.current.behavior === "inspecting"
              ? "patrolling"
              : auditorRef.current.behavior,
          targetStationId: undefined,
        };
        addAuditLogRef.current(
          `[GCP SPOT INSPECTION] The FDA investigator left the ${ended.stationId} station: ${
            ended.misroutes === 0
              ? "no misroutes observed."
              : `${ended.misroutes} misroute${ended.misroutes === 1 ? "" : "s"} observed.`
          }`,
          ended.misroutes === 0 ? "COMPLIANT" : "WARN"
        );
        announceRef.current(
          `Spot inspection over. The investigator left the ${ended.stationId} station.`,
          "polite"
        );
      } else {
        amendmentEffectsRef.current = effectsTick.state;
      }
      const inspection = amendmentEffectsRef.current.spotInspection;
      if (inspection) {
        const sortedFloor = [...stationsRef.current].sort(
          (a, b) => a.positionIndex - b.positionIndex
        );
        const view = conveyorViewRef.current;
        const parkX = getAuditorParkX(
          view.width,
          sortedFloor.length,
          sortedFloor.findIndex((st) => st.id === inspection.stationId),
          getConveyorGeometry(view.width, view.height).beltLeft
        );
        // Walk over rather than teleport: at most SPOT_WALK_SPEED per second.
        const step = SPOT_WALK_SPEED * deltaSeconds;
        auditorRef.current = parkAuditorAtStation(
          auditorRef.current,
          preTickAuditorX + clamp(parkX - preTickAuditorX, -step, step),
          inspection.stationId
        );
      }

      if (!readCalmMotion()) beltOffsetRef.current += deltaSeconds * BELT_SPEED;

      if (tick.expired.length > 0) {
        uiNeedsSync = true;
        tick.expired.forEach((exp) => {
          queueFolderFx(
            "expire",
            exp,
            null,
            selectedSubjectIdRef.current,
            stationsRef.current
          );
          triggerSoundRef.current("error");
          addAuditLogRef.current(
            formatExpiryLog(exp),
            "CRITICAL",
            EXPIRY_SUSPICION
          );
        });
        scoreStateRef.current = tick.scoreState;
        setScoreState({ ...scoreStateRef.current });
      }

      if (tick.suspicionMaxed && playStateRef.current === "playing") {
        uiNeedsSync = true;
        endShift("auditor");
      }

      if (tick.coffeeBreakEnded) {
        uiNeedsSync = true;
        addAuditLogRef.current(COFFEE_BREAK_END_LOG, "INFO");
      }

      if (tick.concludedAmendment) {
        uiNeedsSync = true;
        addAuditLogRef.current(
          `Protocol Amendment ${tick.concludedAmendment.version} concluded. Standard site procedures resumed.`,
          "INFO"
        );
        activeAmendmentRef.current = null;
        setActiveAmendment(null);
      } else if (tick.amendment) {
        activeAmendmentRef.current = tick.amendment;
        if (tick.amendmentSecondChanged) setActiveAmendment(tick.amendment);
      }

      // 5. Random Protocol Amendments
      amendmentTimerRef.current += deltaSeconds;
      const amendmentInterval = applyOfficeAmendmentInterval(
        getAmendmentIntervalSeconds(phaseRef.current, loopAuditYear),
        officeRef.current
      );
      if (amendmentTimerRef.current > amendmentInterval) {
        uiNeedsSync = true;
        amendmentTimerRef.current = 0;
        const newAmendment = triggerRandomAmendment();
        setActiveAmendment(newAmendment);
        triggerSoundRef.current("amendment");
        addAuditLogRef.current(
          `[PROTOCOL AMENDMENT ALERT] ${newAmendment.version}: ${newAmendment.title}!`,
          "WARN"
        );

        if (
          newAmendment.type === "double-signature-audit" ||
          newAmendment.type === "gcp-spot-inspection"
        ) {
          const nextEffects = beginAmendmentEffect(
            amendmentEffectsRef.current,
            newAmendment,
            stationsRef.current.map((st) => st.id)
          );
          commitAmendmentEffects(nextEffects);
          if (
            nextEffects.spotInspection &&
            newAmendment.type === "gcp-spot-inspection"
          ) {
            const watched = nextEffects.spotInspection.stationId;
            addAuditLogRef.current(
              `[GCP SPOT INSPECTION] An FDA investigator is observing the ${watched} station for ${Math.round(nextEffects.spotInspection.durationSeconds)}s. A misroute there counts double.`,
              "WARN"
            );
            announceRef.current(
              `Spot inspection: the FDA investigator is watching the ${watched} station. A misroute there counts double.`,
              "assertive"
            );
          } else if (newAmendment.type === "double-signature-audit") {
            announceRef.current(
              "Double-signature audit: the next 3 CRFs each need an author signature and a reviewer countersignature.",
              "assertive"
            );
          }
        } else if (newAmendment.type === "station-scramble") {
          setStations((st) => scrambleStations(st));
        } else if (newAmendment.type === "sae-priority-rush") {
          const saeSubj = applyOfficeToSubject(
            generateClinicalSubject(
              0.7,
              true,
              undefined,
              stationsRef.current.map((s) => s.id)
            ),
            officeRef.current,
            officeSiteSeqRef.current++
          );
          conveyorSubjectsRef.current = [
            saeSubj,
            ...conveyorSubjectsRef.current,
          ];
          setConveyorSubjects([...conveyorSubjectsRef.current]);
        }
      }

      // 6. Spawning new subjects
      spawnTimerRef.current += deltaSeconds;
      const spawnInterval = getSpawnIntervalSeconds(
        phaseRef.current,
        conveyorSubjectsRef.current.length,
        (seconds) => applyOfficeSpawnInterval(seconds, officeRef.current),
        stressParamsRef.current.arrivalRateMultiplier,
        loopAuditYear
      );
      if (
        spawnTimerRef.current > spawnInterval &&
        conveyorSubjectsRef.current.length < MAX_CONVEYOR_SUBJECTS
      ) {
        uiNeedsSync = true;
        spawnTimerRef.current = 0;
        const baseErrorChance = getAuditYearErrorChance(
          stressParamsRef.current.errorChance,
          loopAuditYear
        );
        const errorChance = applyOfficeErrorChance(
          baseErrorChance,
          officeRef.current
        );
        const isSAE = Math.random() < getSAEChance(phaseRef.current);
        const newSub = applyOfficeToSubject(
          activeProtocolRef.current
            ? generateClinicalSubjectFromProtocol(
                activeProtocolRef.current,
                errorChance,
                isSAE,
                undefined,
                stationsRef.current.map((s) => s.id)
              )
            : generateClinicalSubject(
                errorChance,
                isSAE,
                undefined,
                stationsRef.current.map((s) => s.id)
              ),
          officeRef.current,
          officeSiteSeqRef.current++
        );
        conveyorSubjectsRef.current = [...conveyorSubjectsRef.current, newSub];
        setConveyorSubjects([...conveyorSubjectsRef.current]);
        if (!selectedSubjectIdRef.current) {
          setSelectedSubjectId(newSub.id);
        }
      }

      // 6a. Sponsor inbox: mood decay, new emails, follow-up escalation
      if (playStateRef.current === "playing") {
        const prevSponsor = sponsorRef.current;
        const { state: nextSponsor, events: sponsorEvents } = tickSponsor(
          prevSponsor,
          deltaSeconds,
          Math.random,
          getSponsorMoodDecayPerSecond(phaseRef.current)
        );
        sponsorRef.current = nextSponsor;
        for (const ev of sponsorEvents) {
          if (ev.type === "contract_terminated") {
            endShift("sponsor");
            continue;
          }
          const { message, level, sound } = describeSponsorEvent(ev);
          if (sound) triggerSoundRef.current(sound);
          addAuditLogRef.current(message, level);
        }
        if (
          sponsorEvents.length > 0 ||
          Math.round(prevSponsor.mood) !== Math.round(nextSponsor.mood) ||
          Math.ceil(prevSponsor.activeRequest?.timeRemaining ?? 0) !==
            Math.ceil(nextSponsor.activeRequest?.timeRemaining ?? 0)
        ) {
          setSponsor(nextSponsor);
        }
      }

      // 6b. Office ambient flavor events
      ambientTimerRef.current += deltaSeconds;
      if (ambientTimerRef.current > 24) {
        ambientTimerRef.current = 0;
        addAuditLogRef.current(
          `[OFFICE] ${pickOfficeAmbientEvent(officeRef.current)}`,
          "INFO"
        );
      }

      // 7. UI State Sync: render only when a milestone occurs or the frame
      // changes what the board last rendered (#1628).
      const displayChanged = loopStateChangesDisplay(
        renderedLoopStateRef.current,
        {
          subjects: conveyorSubjectsRef.current,
          auditor: auditorRef.current,
          powerUps: powerUpsRef.current,
        }
      );

      if (uiNeedsSync || displayChanged) {
        setConveyorSubjects([...conveyorSubjectsRef.current]);
        setAuditor({ ...auditorRef.current });
        setPowerUps({ ...powerUpsRef.current });
      }

      // 8. Render Canvas Simulation
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const view = conveyorViewRef.current;
          applyCanvasScale(ctx, view.scale);
          renderConveyorCanvasRef.current(
            ctx,
            view.width,
            view.height,
            auditorRef.current,
            conveyorSubjectsRef.current
          );
        }
      }
    },
    {
      isActive: playState === "playing" && !isContextLost,
      maxDeltaMs: Infinity,
    }
  );

  // 17a0. The verdict stamp lands on a phase lock or a shift end: one small
  // shake as it presses down (#1521). useArcadeFx skips it when calm.
  useEffect(() => {
    if (playState !== "phase_cleared" && playState !== "game_over") return;
    const timer = setTimeout(() => fx.shake(5), 380);
    return () => clearTimeout(timer);
  }, [playState, fx]);

  // 17a. Keep hotkeys working: return focus to the board when a dialog closes
  useEffect(() => {
    if (playState !== "playing" || validatingObs || signatureModal.isOpen) {
      return;
    }
    const board = containerRef.current;
    const active = document.activeElement;
    if (board && (!active || active === document.body)) {
      board.focus({ preventScroll: true });
    }
  }, [playState, validatingObs, signatureModal.isOpen]);

  // 17a2. Modal dialogs (#1671): each traps Tab and Shift+Tab, closes on
  // Escape and hands focus back to the board. The board's own key handler
  // still sees their keys, so the number keys and Enter keep working.
  // A pause (the player's, or the cabinet's when the app goes to the
  // background) shows only the pause dialog; a fix or signature dialog that was
  // open comes back on resume.
  const fixDialogOpen = !!validatingObs && playState === "playing" && !isPaused;
  const signatureDialogOpen =
    signatureModal.isOpen &&
    !!signatureModal.subject &&
    playState === "playing" &&
    !isPaused;
  const pauseDialogOpen = isPaused && playState === "playing";
  const firstFixOptionRef = useRef<HTMLButtonElement | null>(null);
  const signButtonRef = useRef<HTMLButtonElement | null>(null);
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const fixDialogRef = useFocusTrap<HTMLDivElement>(fixDialogOpen, {
    initialFocusRef: firstFixOptionRef,
    onEscape: () => setValidatingObs(null),
    returnFocusTo: containerRef,
  });
  const signatureDialogRef = useFocusTrap<HTMLDivElement>(signatureDialogOpen, {
    initialFocusRef: signButtonRef,
    onEscape: () => setSignatureModal((prev) => ({ ...prev, isOpen: false })),
    returnFocusTo: containerRef,
  });
  const pauseDialogRef = useFocusTrap<HTMLDivElement>(pauseDialogOpen, {
    initialFocusRef: resumeButtonRef,
    onEscape: () => setShiftPaused(false),
    returnFocusTo: containerRef,
  });

  // The touch cabinet turns the stress drawer into a sheet and traps focus in
  // the inspection report too. Desktop keeps its non-modal drawer (#2105).
  const stressSheetOpen = touchCabinet && isStressDrawerOpen;
  const bimoDialogOpen = touchCabinet && !!bimoReport;
  const closeReportButtonRef = useRef<HTMLButtonElement | null>(null);
  const stressSheetRef = useFocusTrap<HTMLDivElement>(stressSheetOpen, {
    onEscape: () => setIsStressDrawerOpen(false),
    returnFocusTo: containerRef,
  });
  const bimoDialogRef = useFocusTrap<HTMLDivElement>(bimoDialogOpen, {
    initialFocusRef: closeReportButtonRef,
    onEscape: () => setBimoReport(null),
    returnFocusTo: containerRef,
  });

  // A wrong pick disables the focused answer; move focus to the next open
  // answer so it never falls back to the page behind the dialog.
  useEffect(() => {
    if (!fixDialogOpen) return;
    const dialog = fixDialogRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (
      dialog &&
      (!active || !dialog.contains(active) || active.hasAttribute("disabled"))
    ) {
      firstFixOptionRef.current?.focus();
    }
  }, [fixDialogOpen, fixDialogRef, rejectedChoices]);

  // Everything behind an open dialog is inert, so neither Tab nor a pointer
  // reaches the controls under the backdrop (#1671).
  const anyTrappedDialogOpen =
    fixDialogOpen ||
    signatureDialogOpen ||
    pauseDialogOpen ||
    stressSheetOpen ||
    bimoDialogOpen ||
    !!inspectionRound;
  useEffect(() => {
    const board = containerRef.current;
    if (!board || !anyTrappedDialogOpen) return;
    const background = Array.from(board.children).filter(
      (el) => !el.hasAttribute("data-cc-modal") && !el.hasAttribute("inert")
    );
    background.forEach((el) => el.setAttribute("inert", ""));
    return () => background.forEach((el) => el.removeAttribute("inert"));
  }, [anyTrappedDialogOpen]);

  // 17b. Draw a single static frame while the shift is not running
  useEffect(() => {
    if (playState === "playing" || activeTab !== "conveyor") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const view = conveyorViewRef.current;
      applyCanvasScale(ctx, view.scale);
      renderConveyorCanvas(
        ctx,
        view.width,
        view.height,
        auditor,
        conveyorSubjects,
        true
      );
    }
  }, [
    playState,
    activeTab,
    renderConveyorCanvas,
    auditor,
    conveyorSubjects,
    canvasSize,
  ]);

  // 18. Hotkeys and Keyboard Boundary
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toUpperCase();
    const target = e.target as HTMLElement;

    // Typing in a field (e.g. the signature password) never triggers hotkeys.
    if (
      target !== e.currentTarget &&
      target.closest("input, textarea, select, [contenteditable=true]")
    ) {
      return;
    }

    // A focused button, link or tab keeps its native keys: Enter and Space
    // activate it and Tab moves focus on (WCAG 2.1.1, 2.1.2). Only the board
    // itself and its canvas treat them as game keys.
    const onControl =
      target !== e.currentTarget &&
      target !== canvasRef.current &&
      !!target.closest(
        'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="option"], [role="checkbox"], [role="switch"]'
      );
    if (onControl && (key === " " || key === "ENTER")) return;
    if (key === "TAB") return;

    // Prevent scrolling on gameplay keys
    if (
      [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        " ",
        "ESCAPE",
        "ENTER",
        "Q",
        "W",
        "E",
        "R",
        "ARROWLEFT",
        "ARROWRIGHT",
      ].includes(key)
    ) {
      e.preventDefault();
    }

    // The finale inspection owns the keyboard until its report is filed.
    if (inspectionRound) return;

    // The inspection report sits on top of everything: Escape closes it and
    // no other hotkey (e.g. Enter = start shift) may act behind it.
    if (bimoReport) {
      if (key === "ESCAPE") setBimoReport(null);
      return;
    }

    // The touch cabinet's stress sheet covers the floor: Escape closes it and
    // no other hotkey acts behind it (#2105).
    if (touchCabinet && isStressDrawerOpen) {
      if (key === "ESCAPE") setIsStressDrawerOpen(false);
      return;
    }

    if (playState !== "playing") {
      // Only when the board itself has focus: Enter/Space on a focused button
      // (office card, mode toggle) must activate that button, not start a shift.
      if ((key === " " || key === "ENTER") && e.target === e.currentTarget) {
        e.preventDefault();
        // Mirror the primary button of the current screen
        if (playState === "phase_cleared") {
          startGame("campaign", (phase < 3 ? phase + 1 : 1) as GamePhase);
        } else {
          startGame(gameMode, 1);
        }
      }
      return;
    }

    // A paused shift shows the pause dialog alone, whatever else was open.
    if (validatingObs && !isPaused) {
      if (key === "ESCAPE") {
        setValidatingObs(null);
      } else if (!validatingObs.feedback?.isValid) {
        // Number keys pick an answer in the fix dialog
        const options = getObservationChoices(validatingObs.obs);
        const optionIdx = parseInt(key, 10) - 1;
        if (optionIdx >= 0 && optionIdx < options.length) {
          e.preventDefault();
          handleSelectChoice(options[optionIdx]);
        }
      }
      return;
    }

    if (signatureModal.isOpen && !isPaused) {
      if (key === "ESCAPE") {
        setSignatureModal((prev) => ({ ...prev, isOpen: false }));
      } else if (key === "ENTER") {
        handleConfirmSignature();
      }
      return;
    }

    // The Field Manual holds the shift; no game key acts behind it (#1672).
    if (isManualOpen) return;

    // P pauses and resumes the shift, as in the other arcade games (#1672).
    if (key === "P") {
      e.preventDefault();
      togglePause();
      return;
    }
    // While paused only P, or Escape and Resume in the pause dialog, act.
    if (isPaused) {
      if (key === "ESCAPE") setShiftPaused(false);
      return;
    }

    // The touch cabinet hands this key to the game while a shift runs, so a
    // stray Escape from a keyboard case pauses the shift instead of closing the
    // cabinet and losing it (#2105).
    if (key === "ESCAPE" && touchCabinet) {
      setShiftPaused(true);
      return;
    }

    // Enter performs the next step: fix the next flagged field, or route a clean CRF
    if (key === "ENTER" && activeSubject && e.target === e.currentTarget) {
      e.preventDefault();
      const flagged = activeSubject.observations.find((o) => !o.isResolved);
      if (flagged) {
        setValidatingObs({ subjectId: activeSubject.id, obs: flagged });
      } else {
        const target = activeSubject.observations.find((o) =>
          stations.some((st) => st.id === o.destination)
        );
        if (target) handleInitiateSubmission(target.destination);
      }
      return;
    }

    // Power-up hotkeys Q, W, E, R
    if (key === "Q") triggerPowerUp("fda-coffee-break");
    else if (key === "W") triggerPowerUp("auto-clean");
    else if (key === "E") triggerPowerUp("query-extension");
    else if (key === "R") triggerPowerUp("fast-sign");

    // Station routing hotkeys 1-8 (phase 3 opens DS and MH as 7 and 8)
    const sorted = [...stations].sort(
      (a, b) => a.positionIndex - b.positionIndex
    );
    const keyNum = parseInt(key, 10);
    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= sorted.length) {
      const station = sorted[keyNum - 1];
      if (station) handleInitiateSubmission(station.id);
    }

    // Left and right arrows cycle the active subject; Tab stays free to move
    // focus between the game's controls.
    if (
      (key === "ARROWRIGHT" || key === "ARROWLEFT") &&
      conveyorSubjects.length > 0
    ) {
      const currentIdx = conveyorSubjects.findIndex(
        (s) => s.id === selectedSubjectId
      );
      const step = key === "ARROWRIGHT" ? 1 : -1;
      const nextIdx =
        (currentIdx + step + conveyorSubjects.length) % conveyorSubjects.length;
      setSelectedSubjectId(conveyorSubjects[nextIdx].id);
    }
  };

  // 19. Export Downloads
  const downloadODMXML = () => {
    const xml = exportToCDISCODMXML(submittedHistory, sdtmDataset);
    downloadFile(xml, `CDISC_ODM_Snapshot_${Date.now()}.xml`, {
      mimeType: "application/xml",
    });
    addAuditLog(
      `CDISC ${standardCitation("ODM")} XML snapshot exported and downloaded.`,
      "COMPLIANT"
    );
  };

  const downloadSDTMCSV = () => {
    const csv = exportToSDTMCSV(sdtmDataset);
    downloadFile(csv, `SDTM_Dataset_${Date.now()}.csv`, {
      mimeType: "text/csv",
    });
    addAuditLog(
      "CDISC SDTM observation dataset (.csv) exported and downloaded.",
      "COMPLIANT"
    );
  };

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop =
        terminalContainerRef.current.scrollHeight;
    }
  }, [auditLogs]);

  return {
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
  };
}
