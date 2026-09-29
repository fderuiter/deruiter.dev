"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { cloneDeep } from "@/lib/utils";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import {
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconPlayerPlay,
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
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { applyCanvasScale, computeCanvasResolution } from "@/lib/arcade";

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
} from "@/lib/clinical-trial-chaos/types";
import { StudyProtocol } from "@/lib/crf/types";

import {
  createInitialScoreState,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  createAuditLogEntry,
  fixObservation,
  validateObservationChoice,
  getObservationChoices,
  selectNextUrgentSubject,
  shouldRunCalibration,
  getCalibrationStep,
  isSubjectFullyCompliant,
  calculateSubmissionPoints,
  tickSubjectTimers,
  tickAuditor,
  tickPowerUps,
  chargePowerUps,
  scrambleStations,
  verify21CFRSubmission,
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
} from "@/lib/clinical-trial-chaos/scenarios";

import {
  getRoutingReadiness,
  getSubmissionMode,
  OFFICES,
  DEFAULT_OFFICE_ID,
  OfficeId,
  getOfficeById,
  applyOfficeSpawnInterval,
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
  resolveSponsorChoice,
  applySponsorSubmissionBoost,
  applySponsorSkeletonsToReport,
  getSponsorMoodLabel,
  getFollowUpSubject,
  OUTFITS,
  DEFAULT_OUTFIT_ID,
  OutfitConfig,
  OutfitId,
  getOutfitById,
  drawOutfitAvatar,
} from "@/lib/clinical-trial-chaos";

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

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getHighScoreSnapshot = () => {
  try {
    return localStorage.getItem("clinical_chaos_highscore") || "0";
  } catch {
    return "0";
  }
};
const getHighScoreServerSnapshot = () => "0";

/** CRFs to lock before a campaign phase is cleared. */
const PHASE_TARGETS: Record<GamePhase, number> = { 1: 5, 2: 8, 3: 12 };
const QUICK_DISPATCH_GUARD_MS = 400;

const AUDITOR_BEHAVIOR_LABELS: Record<AuditorState["behavior"], string> = {
  patrolling: "Patrolling",
  inspecting: "Inspecting",
  suspicious: "Suspicious",
  issuing_483: "Writing a 483",
  coffee_break: "☕ Coffee break",
};

function getConveyorGeometry(width: number, height: number) {
  const compact = width <= 500;
  const narrow = width < 280;
  const visibleSlots = narrow ? 2 : compact ? 3 : 5;
  const subjectHeight = compact ? Math.min(52, height - 36) : 52;
  const subjectTop = compact
    ? Math.max(30, (height - subjectHeight) / 2 + 8)
    : height * 0.57 - 26;
  const beltY = compact ? subjectTop + subjectHeight / 2 : height * 0.57;
  return {
    compact,
    narrow,
    visibleSlots,
    beltY,
    beltHeight: compact ? Math.min(44, height - beltY - 4) : 44,
    subjectTop,
    subjectHeight,
    slotWidth: (width - 70) / visibleSlots,
  };
}

/**
 * The slice of the queue the canvas shows. The window follows the selected
 * subject so a selection past the visible slots (via the arrow keys or the
 * dossier) is
 * still drawn, highlighted and tappable.
 */
function getVisibleSubjects<T extends { id: string }>(
  subjects: T[],
  selectedId: string | null,
  visibleSlots: number
): T[] {
  const selectedIndex = subjects.findIndex((s) => s.id === selectedId);
  const start =
    selectedIndex >= visibleSlots ? selectedIndex - visibleSlots + 1 : 0;
  return subjects.slice(start, start + visibleSlots);
}

function timerBarColor(ratio: number): string {
  if (ratio > 0.5) return "bg-emerald-500";
  if (ratio > 0.25) return "bg-amber-500";
  return "bg-rose-500";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
}

const OUTFIT_STORAGE_KEY = "clinical_chaos_outfit";

function readStoredOutfitId(): OutfitId {
  if (typeof window === "undefined") return DEFAULT_OUTFIT_ID;
  try {
    if (typeof window.localStorage?.getItem === "function") {
      return getOutfitById(window.localStorage.getItem(OUTFIT_STORAGE_KEY)).id;
    }
  } catch {}
  return DEFAULT_OUTFIT_ID;
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

export const ClinicalTrialChaos: React.FC = () => {
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
  const { playSuccess, muted: globalMuted } = useAudio();
  const { recordEvent } = useTelemetry();
  const { announce } = useAnnouncer();

  // 1. Game configuration & modes
  const [gameMode, setGameMode] = useState<GameMode>("campaign");
  const [phase, setPhase] = useState<GamePhase>(1);
  const [playState, setPlayState] = useState<PlayState>("idle");
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
    try {
      if (typeof window.localStorage?.setItem === "function") {
        window.localStorage.setItem(OUTFIT_STORAGE_KEY, id);
      }
    } catch {}
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
  const [auditor, setAuditor] = useState<AuditorState>(
    createInitialAuditorState
  );
  const [stations, setStations] = useState<StationConfig[]>(() =>
    getStationsForPhase(1, "campaign")
  );
  const [conveyorSubjects, setConveyorSubjects] = useState<ClinicalSubject[]>(
    []
  );
  const [submittedHistory, setSubmittedHistory] = useState<ClinicalSubject[]>(
    []
  );
  const [powerUps, setPowerUps] = useState<PowerUpInventory>(
    createInitialPowerUpInventory
  );
  const [activeAmendment, setActiveAmendment] =
    useState<ProtocolAmendment | null>(null);
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

  // Active Authored Protocol Engine State & Rule Violations Log
  const [activeProtocol, setActiveProtocol] = useState<StudyProtocol | null>(
    () => {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("crf_active_protocol");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) return parsed;
          }
        } catch {}
      }
      return null;
    }
  );
  const [ruleViolations, setRuleViolations] = useState<RecordedRuleViolation[]>(
    []
  );

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
  const animFrameIdRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const amendmentTimerRef = useRef<number>(0);
  const ambientTimerRef = useRef<number>(0);
  const officeSiteSeqRef = useRef<number>(3);
  // Source of truth for the sponsor simulation; `sponsor` state mirrors it for rendering.
  const sponsorRef = useRef<SponsorState>(sponsor);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
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
      setAuditor(applyOfficeToAuditor(createInitialAuditorState(), office));
      ambientTimerRef.current = 0;
      const freshSponsor = createInitialSponsorState();
      sponsorRef.current = freshSponsor;
      setSponsor(freshSponsor);
      setGameOverReason("auditor");
      const phaseStations = getStationsForPhase(targetPhase, mode);
      setStations(phaseStations);
      setActiveAmendment(null);
      setSelectedSubjectId(null);
      submittedSubjectIdsRef.current.clear();
      setRoutingNotice(null);
      setValidatingObs(null);
      setBimoReport(null);
      setLastBimoReport(null);
      // A new trial (phase 1 or endless) starts a fresh SDTM dataset; advancing
      // phases continues the same study, so its locked CRFs carry over.
      if (targetPhase === 1) setSubmittedHistory([]);
      setRuleViolations([]);
      ruleViolationsRef.current = [];
      setPowerUps(createInitialPowerUpInventory());
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
      setScoreState({
        ...createInitialScoreState(),
        highScore: effectiveHighScore,
      });

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

      // Bring the whole board into view (clear of the fixed site navbar) and
      // focus it so hotkeys work: the Start button unmounts on click.
      const board = containerRef.current;
      if (board) {
        const reduceMotion = getMatchMediaMatches(
          "(prefers-reduced-motion: reduce)"
        );
        requestAnimationFrame(() => {
          board.focus({ preventScroll: true });
          if (isFullscreen || typeof window.scrollTo !== "function") return;
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
      addAuditLog,
      recordEvent,
      effectiveHighScore,
      activeProtocol,
      office,
      outfit,
      isFullscreen,
    ]
  );

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

  // 11. Spawn Canvas Sparkle Particles
  const spawnSparkles = useCallback(
    (x: number, y: number, color = "#10b981") => {
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          size: Math.random() * 3 + 2,
          life: 1,
        });
      }
    },
    []
  );

  // 12. Handle Multi-Choice Validation Selection
  const handleSelectChoice = useCallback(
    (choice: string) => {
      if (!validatingObs) return;
      const { subjectId, obs } = validatingObs;

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

        // Update observation on subject
        setConveyorSubjects((prev) =>
          prev.map((sub) => {
            if (sub.id !== subjectId) return sub;
            const updatedObs = sub.observations.map((o) =>
              o.id === obs.id ? result.observation : o
            );
            return { ...sub, observations: updatedObs };
          })
        );

        pushScorePop(result.scoreDelta);
        setScoreState((prev) => {
          const nextScore = prev.score + result.scoreDelta;
          return {
            ...prev,
            score: nextScore,
            correctionsMade: prev.correctionsMade + 1,
          };
        });

        // Charge power-ups
        setPowerUps((pu) => chargePowerUps(pu, applyOfficeCharge(1, office)));

        addAuditLog(
          `Observation Standardized: ${obs.field} -> '${choice}' [${result.explanation}]`,
          "COMPLIANT",
          result.suspicionDelta
        );

        // Auto close after brief display
        setTimeout(() => {
          setValidatingObs(null);
        }, 550);
      } else {
        triggerSound("incorrect");
        setValidatingObs((prev) =>
          prev
            ? {
                ...prev,
                selectedChoice: choice,
                feedback: { isValid: false, text: result.explanation },
              }
            : null
        );

        // Immediately increase Auditor AI suspicion metrics
        setAuditor((aud) => {
          const nextSusp = Math.min(100, aud.suspicion + result.suspicionDelta);
          return {
            ...aud,
            suspicion: nextSusp,
            behavior: nextSusp >= 100 ? "issuing_483" : "suspicious",
          };
        });

        // Record rule violation for final regulatory inspection report
        const violation: RecordedRuleViolation = {
          id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: obs.astRule ? "ast_edit_check" : "cdisc_conformance",
          subjectLabel: activeSubject?.subjectLabel || "SUBJ-UNK",
          field: obs.field,
          selectedChoice: choice,
          ruleName: result.ruleName,
          message: result.explanation,
          domain: obs.destination,
          timestamp: new Date().toISOString(),
        };
        setRuleViolations((prev) => [...prev, violation]);
        ruleViolationsRef.current.push(violation);

        addAuditLog(
          `[AST RULE FAILURE] ${result.ruleName || "Edit check"} failed for ${obs.field}: '${choice}'. Auditor Suspicion +${result.suspicionDelta}%`,
          "WARN",
          result.suspicionDelta
        );
      }
    },
    [
      validatingObs,
      activeProtocol,
      activeSubject,
      office,
      triggerSound,
      addAuditLog,
      pushScorePop,
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
      }: { allClean: boolean; suspicionDelta: number }
    ) => {
      const points = applyOfficeScore(
        calculateSubmissionPoints(subj, scoreState.multiplier, allClean),
        office
      );
      const nextCombo = scoreState.combo + 1;
      const nextMultiplier = Math.min(4, 1 + Math.floor(nextCombo / 3));

      pushScorePop(points);
      setScoreState((prev) => {
        const newScore = prev.score + points;
        return {
          ...prev,
          score: newScore,
          highScore: Math.max(newScore, prev.highScore),
          combo: nextCombo,
          maxCombo: Math.max(prev.maxCombo, nextCombo),
          multiplier: nextMultiplier,
          subjectsSubmitted: prev.subjectsSubmitted + 1,
          cleanSubmissions: allClean
            ? prev.cleanSubmissions + 1
            : prev.cleanSubmissions,
        };
      });
      // Persist outside the updater (AGENTS.md §4).
      if (typeof window.localStorage?.setItem === "function") {
        try {
          localStorage.setItem(
            "clinical_chaos_highscore",
            Math.max(scoreState.score + points, scoreState.highScore).toString()
          );
        } catch {}
      }

      // Charge power-ups
      setPowerUps((pu) =>
        chargePowerUps(pu, applyOfficeCharge(allClean ? 2 : 1, office))
      );

      // Cool down auditor suspicion
      setAuditor((prev) => ({
        ...prev,
        suspicion: Math.max(0, prev.suspicion + suspicionDelta),
      }));

      // Update station stats
      setStations((prev) =>
        prev.map((s) =>
          s.id === domain ? { ...s, processedCount: s.processedCount + 1 } : s
        )
      );

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

      // Phase completion check in Campaign mode
      const phaseCleared =
        gameMode === "campaign" &&
        scoreState.subjectsSubmitted + 1 >= PHASE_TARGETS[phase];

      // Load the most urgent remaining dossier (#834), computed from the
      // queue without the packet just submitted.
      const nextSubject = phaseCleared
        ? null
        : selectNextUrgentSubject(
            conveyorSubjects.filter((s) => s.id !== subj.id)
          );
      setSelectedSubjectId(nextSubject?.id ?? null);
      if (nextSubject) {
        const cue = `Next dossier loaded: ${nextSubject.subjectLabel}${
          nextSubject.isSAE ? " (SAE)" : ""
        }`;
        setNextDossierCue({ subjectId: nextSubject.id, text: cue });
        announce(cue, "polite");
      } else {
        setNextDossierCue(null);
      }

      if (gameMode === "campaign") {
        if (phaseCleared) {
          setPlayState("phase_cleared");
          playSuccess();
          const report = applySponsorSkeletonsToReport(
            generateBIMOReport(
              {
                ...scoreState,
                subjectsSubmitted: scoreState.subjectsSubmitted + 1,
              },
              auditor,
              auditLogs,
              ruleViolations,
              activeProtocol
            ),
            sponsorRef.current.skeletons
          );
          setBimoReport(report);
          setLastBimoReport(report);
        }
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
      pushScorePop,
      playSuccess,
      announce,
    ]
  );

  // 13. Power-Up Trigger Execution
  const triggerPowerUp = useCallback(
    (type: PowerUpType) => {
      const p = powerUps[type];
      if (
        !p ||
        p.charge < p.maxCharge ||
        playState !== "playing" ||
        ((type === "auto-clean" || type === "fast-sign") && !activeSubject)
      )
        return;

      triggerSound("powerup");

      if (type === "fda-coffee-break") {
        setAuditor((aud) => ({
          ...aud,
          behavior: "coffee_break",
          isPaused: true,
          suspicion: Math.max(0, aud.suspicion - 15),
        }));
        addAuditLog(
          "☕ [POWER-UP ACTIVATED] FDA Coffee Break! Auditor halted for 8 seconds.",
          "COMPLIANT"
        );
      } else if (type === "auto-clean") {
        if (activeSubject) {
          setConveyorSubjects((prev) =>
            prev.map((sub) => {
              if (sub.id !== activeSubject.id) return sub;
              const cleaned = sub.observations.map(
                (obs) => fixObservation(obs).observation
              );
              return { ...sub, observations: cleaned };
            })
          );
          addAuditLog(
            `✨ [POWER-UP ACTIVATED] CDISC Auto-Clean standardized all fields on ${activeSubject.subjectLabel}.`,
            "COMPLIANT"
          );
        }
      } else if (type === "query-extension") {
        setConveyorSubjects((prev) =>
          prev.map((sub) => ({
            ...sub,
            timeRemaining: Math.min(sub.maxTime + 10, sub.timeRemaining + 12),
          }))
        );
        addAuditLog(
          "⏱️ [POWER-UP ACTIVATED] Site Query Extension added +12s to all active conveyors.",
          "COMPLIANT"
        );
      } else if (type === "fast-sign") {
        if (activeSubject) {
          // Auto-clean, then sign to the first active station the subject
          // routes to, exactly as a signed CRF would be.
          const cleanedSubject = {
            ...activeSubject,
            observations: activeSubject.observations.map(
              (obs) => fixObservation(obs).observation
            ),
          };
          const domain =
            cleanedSubject.observations.find((obs) =>
              stations.some((st) => st.id === obs.destination)
            )?.destination ??
            cleanedSubject.observations[0]?.destination ??
            "DM";
          const result = verify21CFRSubmission(
            cleanedSubject,
            "Intent to Submit",
            domain
          );

          triggerSound("sign");
          addAuditLog(
            `⚡ [FAST-TRACK 21 CFR PASS] Expedited NDA sign-off for ${cleanedSubject.subjectLabel} -> ${domain}.`,
            "COMPLIANT"
          );
          completeSubmission(cleanedSubject, domain, {
            allClean: true,
            suspicionDelta: result.success ? result.suspicionDelta : 0,
          });
        }
      }

      // Reset power-up charge
      setPowerUps((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          charge: 0,
          activeSecondsRemaining: p.duration,
        },
      }));
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
          suspicion: Math.min(
            100,
            Math.max(0, prev.suspicion + effects.suspicion)
          ),
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
          prev.map((sub) => ({
            ...sub,
            timeRemaining: Math.max(
              Math.min(sub.timeRemaining, 3),
              Math.min(
                sub.maxTime + 10,
                sub.timeRemaining + effects.timeBonusSeconds
              )
            ),
          }))
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
    [addAuditLog, triggerSound, announce, pushScorePop]
  );

  // 14. Shared verified submission path for routine and reviewed dossiers.
  const submitDossier = useCallback(
    (
      subj: ClinicalSubject,
      reason: SignatureReason,
      domain: CDISCDomain,
      mode: "quick" | "full"
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
        const view = conveyorViewRef.current;
        spawnSparkles(
          view.width / 2,
          getConveyorGeometry(view.width, view.height).beltY,
          "#38bdf8"
        );
        setFlashStationId(domain);
        setTimeout(() => setFlashStationId(null), 700);
        addAuditLog(
          mode === "quick"
            ? `[SIMULATED ROUTINE DISPATCH] ${subj.subjectLabel} routed to ${domain} without exceptional review.`
            : result.logMessage,
          "COMPLIANT",
          result.suspicionDelta
        );

        completeSubmission(subj, domain, {
          allClean: isSubjectFullyCompliant(subj),
          suspicionDelta: result.suspicionDelta,
        });
        announce(`${subj.subjectLabel} routed to ${domain}`, "polite");
      } else {
        triggerSound("error");
        addAuditLog(result.logMessage, result.level, result.suspicionDelta);
        // Say why on the board itself, not only in the audit log tab (#1326).
        const { matchingDomains } = getRoutingReadiness(subj, stations);
        const rejection = `Rejected: ${subj.subjectLabel} does not belong at ${domain}.${
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

        setScoreState((prev) => ({
          ...prev,
          combo: 0,
          multiplier: 1,
          auditViolations: prev.auditViolations + 1,
        }));

        setAuditor((prev) => {
          const nextSusp = Math.min(
            100,
            prev.suspicion + result.suspicionDelta
          );
          return {
            ...prev,
            suspicion: nextSusp,
            behavior: nextSusp >= 100 ? "issuing_483" : "suspicious",
          };
        });
      }
      setSignatureModal((prev) => ({ ...prev, isOpen: false, subject: null }));
    },
    [
      triggerSound,
      spawnSparkles,
      addAuditLog,
      completeSubmission,
      announce,
      stations,
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
      if (
        getSubmissionMode(activeSubject, domain, stations, {
          gameMode,
          submittedCount: scoreState.subjectsSubmitted,
          phaseTarget: PHASE_TARGETS[phase],
          amendmentActive: !!activeAmendment?.active,
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
        selectedReason: activeSubject.isSAE
          ? "Urgent Safety Expedited"
          : "Intent to Submit",
        passwordInput: "••••••••",
        requiresReason: true,
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
      submitDossier,
    ]
  );

  // 16. Confirm the exceptional packet through the same submission path.
  const handleConfirmSignature = useCallback(() => {
    if (!signatureModal.subject) return;
    submitDossier(
      signatureModal.subject,
      signatureModal.selectedReason,
      targetRoutingStation,
      "full"
    );
  }, [signatureModal, targetRoutingStation, submitDossier]);

  // 16. Canvas 2D Simulation Renderer
  const renderConveyorCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      auditorState: AuditorState,
      subjects: ClinicalSubject[],
      particles: Particle[]
    ) => {
      ctx.clearRect(0, 0, width, height);

      // Background Grid (tinted per office floor)
      ctx.fillStyle = office.floorColor;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // The narrow canvas is a compact queue map; the DOM dossier below it
      // remains the full-fidelity way to inspect and process observations.
      const {
        compact,
        narrow,
        visibleSlots,
        beltY,
        beltHeight,
        subjectTop,
        subjectHeight,
        slotWidth,
      } = getConveyorGeometry(width, height);
      ctx.fillStyle = "#18181b";
      ctx.fillRect(20, beltY, width - 40, beltHeight);

      // Rollers Animation
      ctx.fillStyle = "#27272a";
      const rollerCount = compact ? 12 : 28;
      const timeOffset = (Date.now() / 35) % 20;
      for (let i = 0; i < rollerCount; i++) {
        const rx = 24 + i * ((width - 48) / rollerCount) + timeOffset;
        if (rx < width - 24) {
          ctx.fillRect(rx, beltY + 4, 3, beltHeight - 8);
        }
      }

      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 2;
      ctx.strokeRect(20, beltY, width - 40, beltHeight);

      // Conveyor Subject Parcels
      getVisibleSubjects(subjects, selectedSubjectId, visibleSlots).forEach(
        (subj, idx) => {
          const px = 28 + idx * slotWidth;
          const py = subjectTop;

          const isSelected = subj.id === selectedSubjectId;
          ctx.fillStyle = subj.isSAE
            ? "#7f1d1d"
            : isSelected
              ? "#1e3a8a"
              : "#1f2937";
          ctx.strokeStyle = subj.isSAE
            ? "#ef4444"
            : isSelected
              ? "#38bdf8"
              : "#4b5563";
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.fillRect(px, py, slotWidth - 10, subjectHeight);
          ctx.strokeRect(px, py, slotWidth - 10, subjectHeight);

          // Subject Label
          ctx.fillStyle = "#f3f4f6";
          ctx.font = "bold 10px monospace";
          ctx.fillText(subj.subjectLabel, px + 6, py + 16);

          // SAE Badge or Domain Badge
          if (subj.isSAE && !narrow) {
            // Right-aligned so it ends before the status pip; light text reads on the red card
            ctx.fillStyle = "#fecaca";
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "right";
            ctx.fillText("⚡ SAE", px + slotWidth - 26, py + 16);
            ctx.textAlign = "left";
          }

          // Compliance status pip
          const allClean = isSubjectFullyCompliant(subj);
          if (!narrow) {
            ctx.fillStyle = allClean ? "#10b981" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(px + slotWidth - 18, py + 12, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Mini timer bar
          const timePercent = Math.max(0, subj.timeRemaining / subj.maxTime);
          ctx.fillStyle = "#374151";
          ctx.fillRect(px + 6, py + subjectHeight - 14, slotWidth - 22, 5);
          ctx.fillStyle =
            timePercent < 0.25
              ? "#ef4444"
              : timePercent < 0.5
                ? "#f59e0b"
                : "#3b82f6";
          ctx.fillRect(
            px + 6,
            py + subjectHeight - 14,
            (slotWidth - 22) * timePercent,
            5
          );
        }
      );

      if (!compact) {
        // Preserve the chosen outfit in the narrow right-side desk lane.
        // The lane starts after the fifth parcel, avoiding belt/card overlap.
        const deskX = width - 46;
        ctx.fillStyle = "#3f3f46";
        ctx.fillRect(deskX, height - 13, 34, 4);
        ctx.fillRect(deskX + 3, height - 9, 3, 8);
        ctx.fillRect(deskX + 28, height - 9, 3, 8);
        drawOutfitAvatar(ctx, width - 29, height - 6, outfit, 0.82);
        ctx.fillStyle = "#f4f4f6";
        ctx.font = "bold 8px monospace";
        ctx.fillText("YOU", deskX + 8, height - 49);
      }

      // Auditor Sprite on Top Patrol Floor
      const auditorX = 50 + auditorState.x * (width - 100);
      const auditorY = 44;

      if (compact) {
        ctx.fillStyle = "#f4f4f6";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`FDA ${Math.round(auditorState.suspicion)}%`, 20, 20);
        ctx.textAlign = "right";
        ctx.fillText(`QUEUE ${subjects.length}/5`, width - 24, 20);
        ctx.textAlign = "left";
      } else {
        // Suspicion Aura
        const suspRatio = auditorState.suspicion / 100;
        if (suspRatio > 0.2) {
          const grad = ctx.createRadialGradient(
            auditorX,
            auditorY,
            4,
            auditorX,
            auditorY,
            36
          );
          grad.addColorStop(0, `rgba(239, 68, 68, ${suspRatio * 0.45})`);
          grad.addColorStop(1, "rgba(239, 68, 68, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(auditorX, auditorY, 36, 0, Math.PI * 2);
          ctx.fill();
        }

        // Auditor Body
        ctx.fillStyle =
          auditorState.behavior === "issuing_483"
            ? "#dc2626"
            : auditorState.behavior === "coffee_break"
              ? "#8b5cf6"
              : auditorState.behavior === "suspicious"
                ? "#ea580c"
                : "#0284c7";
        ctx.fillRect(auditorX - 10, auditorY - 14, 20, 28);

        // Clipboard / Coffee Cup
        if (auditorState.behavior === "coffee_break") {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(auditorX + 5, auditorY - 8, 8, 10);
        } else {
          ctx.fillStyle = "#fef08a";
          ctx.fillRect(
            auditorX + (auditorState.direction > 0 ? 4 : -12),
            auditorY - 6,
            8,
            12
          );
        }

        // Head
        ctx.fillStyle = "#fed7aa";
        ctx.beginPath();
        ctx.arc(auditorX, auditorY - 18, 7, 0, Math.PI * 2);
        ctx.fill();

        // Glasses / Hat
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(auditorX - 8, auditorY - 26, 16, 4);
        ctx.fillRect(auditorX - 5, auditorY - 30, 10, 5);

        // Auditor Name / Status Tag
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          auditorState.behavior === "coffee_break"
            ? "☕ FDA COFFEE BREAK"
            : `FDA AUDITOR [${Math.round(auditorState.suspicion)}%]`,
          Math.max(80, Math.min(width - 80, auditorX)),
          auditorY - 34
        );
        ctx.textAlign = "left";
      }

      // Render Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    [selectedSubjectId, office.floorColor, outfit]
  );

  useEffect(() => {
    if (activeTab !== "conveyor") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const displayWidth = Math.floor(canvas.getBoundingClientRect().width);
      if (displayWidth <= 0) return;
      const logicalWidth = displayWidth < 768 ? displayWidth : 760;
      const logicalHeight =
        displayWidth < 768 ? Math.round((displayWidth * 5) / 13) : 150;
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
  const officeRef = useRef(office);
  const conveyorSubjectsRef = useRef(conveyorSubjects);
  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const auditorRef = useRef(auditor);
  const stationsRef = useRef(stations);
  const scoreStateRef = useRef(scoreState);
  const powerUpsRef = useRef(powerUps);
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

  // Sync refs on every render
  useEffect(() => {
    playStateRef.current = playState;
    phaseRef.current = phase;
    officeRef.current = office;
    conveyorSubjectsRef.current = conveyorSubjects;
    selectedSubjectIdRef.current = selectedSubjectId;
    auditorRef.current = auditor;
    stationsRef.current = stations;
    scoreStateRef.current = scoreState;
    powerUpsRef.current = powerUps;
    auditLogsRef.current = auditLogs;
    addAuditLogRef.current = addAuditLog;
    triggerSoundRef.current = triggerSound;
    renderConveyorCanvasRef.current = renderConveyorCanvas;
    validatingObsRef.current = validatingObs;
    signatureModalRef.current = signatureModal;
    activeProtocolRef.current = activeProtocol;
    ruleViolationsRef.current = ruleViolations;
  });

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

  // 17. Main Game Loop Tick (requestAnimationFrame)
  useEffect(() => {
    if (playState !== "playing") return;

    let isRunning = true;
    let isContextLost = false;
    const canvas = canvasRef.current;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };

    const handleContextRestored = () => {
      isContextLost = false;
      lastTickTimeRef.current = Date.now();
      animFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    if (canvas) {
      canvas.addEventListener("contextlost", handleContextLost);
      canvas.addEventListener("contextrestored", handleContextRestored);
    }

    const gameLoop = () => {
      if (!isRunning || isContextLost) return;

      const now = Date.now();
      const isPausedByModal =
        !!validatingObsRef.current ||
        !!signatureModalRef.current?.isOpen ||
        calibrationActiveRef.current;
      const deltaMs = Math.min(100, now - lastTickTimeRef.current);
      const deltaSeconds = isPausedByModal ? 0 : deltaMs / 1000;
      lastTickTimeRef.current = now;

      let uiNeedsSync = false;

      // 1. Tick subjects on conveyor
      const { updatedSubjects, expiredSubjects } = tickSubjectTimers(
        conveyorSubjectsRef.current,
        deltaSeconds
      );
      conveyorSubjectsRef.current = updatedSubjects;

      if (expiredSubjects.length > 0) {
        uiNeedsSync = true;
        expiredSubjects.forEach((exp) => {
          triggerSoundRef.current("error");
          addAuditLogRef.current(
            `[AUDIT TIMEOUT] Subject ${exp.subjectLabel} expired unverified on conveyor! Auditor suspicion +20%`,
            "CRITICAL",
            20
          );
        });

        if (
          !auditorRef.current.isPaused &&
          auditorRef.current.behavior !== "coffee_break"
        ) {
          const nextSusp = Math.min(
            100,
            auditorRef.current.suspicion + expiredSubjects.length * 20
          );
          auditorRef.current = {
            ...auditorRef.current,
            suspicion: nextSusp,
            behavior: nextSusp >= 100 ? "issuing_483" : "suspicious",
          };
          setAuditor({ ...auditorRef.current });
        }

        scoreStateRef.current = {
          ...scoreStateRef.current,
          combo: 0,
          multiplier: 1,
          auditViolations:
            scoreStateRef.current.auditViolations + expiredSubjects.length,
        };
        setScoreState({ ...scoreStateRef.current });
      }

      // 2. Tick Auditor AI
      const updatedAuditor = tickAuditor(
        auditorRef.current,
        deltaSeconds,
        conveyorSubjectsRef.current.length
      );
      auditorRef.current = updatedAuditor;
      if (
        updatedAuditor.suspicion >= 100 &&
        playStateRef.current === "playing"
      ) {
        uiNeedsSync = true;
        triggerSoundRef.current("alarm");
        playStateRef.current = "game_over";
        setGameOverReason("auditor");
        setPlayState("game_over");
        addAuditLogRef.current(
          `[FDA NOTICE OF STUDY TERMINATION] 21 CFR Part 11 Audit Suspicion reached 100%. Form 483 Issued.`,
          "CRITICAL"
        );
        const report = applySponsorSkeletonsToReport(
          generateBIMOReport(
            scoreStateRef.current,
            updatedAuditor,
            auditLogsRef.current,
            ruleViolationsRef.current,
            activeProtocolRef.current
          ),
          sponsorRef.current.skeletons
        );
        setBimoReport(report);
        setLastBimoReport(report);
        setAuditor({ ...updatedAuditor });
      }

      // 3. Tick Power-ups
      const prevPu = powerUpsRef.current;
      const nextPu = tickPowerUps(prevPu, deltaSeconds);
      powerUpsRef.current = nextPu;
      if (
        prevPu["fda-coffee-break"].activeSecondsRemaining > 0 &&
        nextPu["fda-coffee-break"].activeSecondsRemaining === 0
      ) {
        uiNeedsSync = true;
        if (auditorRef.current.behavior === "coffee_break") {
          auditorRef.current = {
            ...auditorRef.current,
            behavior: "patrolling",
            isPaused: false,
          };
          setAuditor({ ...auditorRef.current });
        }
        addAuditLogRef.current(
          "☕ FDA Coffee Break ended. Auditor resumed inspection floor patrol.",
          "INFO"
        );
        setPowerUps({ ...nextPu });
      }

      // 4. Tick Protocol Amendment countdown
      if (activeAmendmentRef.current && activeAmendmentRef.current.active) {
        const remaining =
          activeAmendmentRef.current.timeRemaining - deltaSeconds;
        if (remaining <= 0) {
          uiNeedsSync = true;
          addAuditLogRef.current(
            `Protocol Amendment ${activeAmendmentRef.current.version} concluded. Standard site procedures resumed.`,
            "INFO"
          );
          activeAmendmentRef.current = null;
          setActiveAmendment(null);
        } else {
          const secondChanged =
            Math.ceil(remaining) !==
            Math.ceil(activeAmendmentRef.current.timeRemaining);
          activeAmendmentRef.current = {
            ...activeAmendmentRef.current,
            timeRemaining: remaining,
          };
          if (secondChanged) setActiveAmendment(activeAmendmentRef.current);
        }
      }

      // 5. Random Protocol Amendments
      amendmentTimerRef.current += deltaSeconds;
      const amendmentInterval = applyOfficeAmendmentInterval(
        phaseRef.current === 1 ? 40 : phaseRef.current === 2 ? 28 : 20,
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

        if (newAmendment.type === "station-scramble") {
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
      const spawnInterval = applyOfficeSpawnInterval(
        phaseRef.current === 1 ? 6.5 : phaseRef.current === 2 ? 4.8 : 3.5,
        officeRef.current
      );
      if (
        spawnTimerRef.current > spawnInterval &&
        conveyorSubjectsRef.current.length < 5
      ) {
        uiNeedsSync = true;
        spawnTimerRef.current = 0;
        const errorChance = applyOfficeErrorChance(
          phaseRef.current === 1 ? 0.45 : phaseRef.current === 2 ? 0.65 : 0.8,
          officeRef.current
        );
        const isSAE = Math.random() < (phaseRef.current === 1 ? 0.1 : 0.3);
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
          deltaSeconds
        );
        sponsorRef.current = nextSponsor;
        for (const ev of sponsorEvents) {
          if (ev.type === "request_arrived") {
            triggerSoundRef.current("chute");
            addAuditLogRef.current(
              `[SPONSOR] 📧 New email from ${ev.request.from} (${ev.request.role}): "${ev.request.subject}"`,
              "WARN"
            );
          } else if (ev.type === "follow_up") {
            triggerSoundRef.current("error");
            addAuditLogRef.current(
              `[SPONSOR] 📧 ${ev.request.from}: "${ev.subjectLine}"`,
              "WARN"
            );
          } else if (ev.type === "request_dropped") {
            addAuditLogRef.current(
              `[SPONSOR] ${ev.request.from} escalated "${ev.request.subject}" to your manager's manager. Satisfaction ${ev.moodDelta}%.`,
              "CRITICAL"
            );
          } else if (ev.type === "contract_terminated") {
            triggerSoundRef.current("alarm");
            playStateRef.current = "game_over";
            setGameOverReason("sponsor");
            setPlayState("game_over");
            addAuditLogRef.current(
              "[CONTRACT TERMINATED] The sponsor has 'decided to go in a different direction' and moved the study to another CRO.",
              "CRITICAL"
            );
            const sponsorReport = applySponsorSkeletonsToReport(
              generateBIMOReport(
                scoreStateRef.current,
                auditorRef.current,
                auditLogsRef.current,
                ruleViolationsRef.current,
                activeProtocolRef.current
              ),
              nextSponsor.skeletons
            );
            setBimoReport(sponsorReport);
            setLastBimoReport(sponsorReport);
          }
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

      // 7. UI State Sync: Sync React state only when DOM second display value changes or milestones occur
      const secondsChanged = conveyorSubjectsRef.current.some(
        (s, i) =>
          Math.ceil(s.timeRemaining) !==
          Math.ceil(conveyorSubjects[i]?.timeRemaining ?? 0)
      );

      if (uiNeedsSync || secondsChanged) {
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
            conveyorSubjectsRef.current,
            particlesRef.current
          );
        }
      }

      animFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    lastTickTimeRef.current = Date.now();
    animFrameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (canvas) {
        canvas.removeEventListener("contextlost", handleContextLost);
        canvas.removeEventListener("contextrestored", handleContextRestored);
      }
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playState]);

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
        particlesRef.current
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

    // The inspection report sits on top of everything: Escape closes it and
    // no other hotkey (e.g. Enter = start shift) may act behind it.
    if (bimoReport) {
      if (key === "ESCAPE") setBimoReport(null);
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

    if (validatingObs) {
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

    if (signatureModal.isOpen) {
      if (key === "ESCAPE") {
        setSignatureModal((prev) => ({ ...prev, isOpen: false }));
      } else if (key === "ENTER") {
        handleConfirmSignature();
      }
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
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CDISC_ODM_Snapshot_${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditLog(
      "CDISC ODM 1.3 XML snapshot exported and downloaded.",
      "COMPLIANT"
    );
  };

  const downloadSDTMCSV = () => {
    const csv = exportToSDTMCSV(sdtmDataset);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SDTM_Dataset_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handleCanvasClickOrTouch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = conveyorViewRef.current;
    const x = (clientX - rect.left) * (view.width / rect.width);
    const y = (clientY - rect.top) * (view.height / rect.height);
    const { subjectTop, subjectHeight, visibleSlots, slotWidth } =
      getConveyorGeometry(view.width, view.height);

    if (y >= subjectTop && y <= subjectTop + subjectHeight) {
      getVisibleSubjects(
        conveyorSubjects,
        selectedSubjectId,
        visibleSlots
      ).forEach((subj, idx) => {
        const px = 28 + idx * slotWidth;
        if (x >= px && x <= px + slotWidth - 10) {
          setSelectedSubjectId(subj.id);
          triggerSound("validate");
        }
      });
    }
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
      handleCanvasClickOrTouch(e.clientX, e.clientY);
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
        handleCanvasClickOrTouch(touch.clientX, touch.clientY);
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

  const sortedStations = [...stations].sort(
    (a, b) => a.positionIndex - b.positionIndex
  );

  // Derived guidance for the "what do I do next" flow: fix → route → sign
  const phaseTarget = PHASE_TARGETS[phase];
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

  const sponsorEmailCard = sponsor.activeRequest ? (
    <section
      aria-label="Sponsor email"
      className={`overflow-hidden rounded-xl border ${
        sponsor.activeRequest.followUps > 0
          ? "border-rose-500/50 bg-rose-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <div className="h-1 bg-zinc-800">
        <div
          className={`h-full transition-[width] duration-500 ease-linear ${
            sponsor.activeRequest.followUps > 0 ? "bg-rose-500" : "bg-amber-500"
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
        <div className="mt-2 grid gap-1.5">
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

  return (
    <div
      ref={containerRef}
      data-keyboard-boundary="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative w-full font-mono focus:outline-none transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-black p-3 sm:p-6 overflow-y-auto select-none"
          : "rounded-2xl border border-blue-500/30 bg-zinc-950 p-2.5 sm:p-4 md:p-6 shadow-2xl focus:ring-1 focus:ring-brand-cyan"
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
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3 text-xs">
        <div className="relative flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-800 bg-[#13151a] px-2.5 sm:px-3">
          <IconTrophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="sr-only text-[10px] uppercase text-zinc-400 sm:not-sr-only">
            Score:
          </span>
          <span className="font-bold tabular-nums text-white">
            {scoreState.score}
          </span>
          <span className="hidden text-[10px] tabular-nums text-zinc-400 sm:inline">
            Best {effectiveHighScore}
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
          {gameMode === "campaign" && (
            <span
              className="flex items-center gap-1"
              role="img"
              aria-label={`${Math.min(scoreState.subjectsSubmitted, phaseTarget)} of ${phaseTarget} CRFs locked`}
            >
              {Array.from({ length: phaseTarget }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-sm transition-colors ${
                    i < scoreState.subjectsSubmitted
                      ? "bg-emerald-400"
                      : "bg-zinc-700"
                  }`}
                />
              ))}
            </span>
          )}
          <span className="tabular-nums text-zinc-300">
            {scoreState.subjectsSubmitted}
            {gameMode === "campaign" ? `/${phaseTarget}` : ""}
            <span className="hidden sm:inline"> locked</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <FieldManualButton manualId="clinical-chaos" label="Manual" />
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
                try {
                  localStorage.removeItem("crf_active_protocol");
                } catch {}
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

      {/* The core tension: FDA auditor vs sponsor */}
      {playState !== "idle" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-xl border border-zinc-800 bg-[#13151a] p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <IconShieldCheck
                  className={`h-4 w-4 shrink-0 ${
                    auditor.suspicion > 60 ? "text-rose-400" : "text-zinc-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate font-bold text-zinc-300">
                  FDA
                  <span className="hidden sm:inline"> AUDITOR SCRUTINY</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`font-bold tabular-nums ${
                    auditor.suspicion > 75
                      ? "text-rose-400"
                      : auditor.suspicion > 40
                        ? "text-amber-300"
                        : "text-emerald-400"
                  }`}
                >
                  {Math.round(auditor.suspicion)}%
                </span>
              </span>
            </div>
            <div
              className="relative mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
              role="meter"
              aria-label="FDA auditor suspicion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(auditor.suspicion)}
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-0 right-0 w-1/4 bg-rose-500/15"
              />
              <div
                className={`relative h-full rounded-full transition-[width] duration-300 ${
                  auditor.suspicion > 75
                    ? "bg-rose-500"
                    : auditor.suspicion > 40
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, auditor.suspicion)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
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
              <p className="hidden min-w-0 truncate text-[10px] text-zinc-400 sm:block">
                Bad data and expired subjects raise it. 100% = Form 483.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-zinc-800 bg-[#13151a] p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <IconMail
                  className={`h-4 w-4 shrink-0 ${
                    sponsor.mood < 25 ? "text-rose-400" : "text-zinc-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate font-bold text-zinc-300">
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
                  className={`font-bold tabular-nums ${
                    sponsor.mood < 25
                      ? "text-rose-400"
                      : sponsor.mood < 45
                        ? "text-amber-300"
                        : "text-emerald-400"
                  }`}
                >
                  {Math.round(sponsor.mood)}%
                </span>
              </span>
            </div>
            <div
              className="relative mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
              role="meter"
              aria-label="Sponsor satisfaction"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(sponsor.mood)}
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1/4 bg-rose-500/15"
              />
              <div
                className={`relative h-full rounded-full transition-[width] duration-300 ${
                  sponsor.mood >= 45
                    ? "bg-emerald-500"
                    : sponsor.mood >= 25
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{ width: `${Math.round(sponsor.mood)}%` }}
              />
            </div>
            <p className="mt-1.5 truncate py-0.5 text-[10px] italic text-zinc-400">
              {getSponsorMoodLabel(sponsor.mood)}
            </p>
          </div>
        </div>
      )}

      {/* Active Protocol Amendment Banner */}
      {playState === "playing" && activeAmendment && activeAmendment.active && (
        <div
          role="status"
          className="mt-3 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/5"
        >
          <div className="flex items-start justify-between gap-3 p-3">
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
            <div
              className="h-full bg-amber-500 transition-[width] duration-500 ease-linear"
              style={{
                width: `${Math.max(0, (activeAmendment.timeRemaining / activeAmendment.durationSeconds) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 1: Conveyor Floor View */}
      {activeTab === "conveyor" && (
        <>
          {/* HTML5 Canvas Simulation */}
          <div className="mt-3 relative rounded-xl border border-zinc-800 bg-black overflow-hidden">
            <canvas
              ref={canvasRef}
              width={760}
              height={150}
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
              aria-label="Clinical Trial Chaos Simulation Canvas. Left and right arrows change the selected subject, Enter takes the next step, and Tab moves to the game's other controls."
              tabIndex={0}
              className="block w-full aspect-[13/5] cursor-pointer touch-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 md:aspect-[760/150]"
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
                  <output htmlFor="clinical-phase">Phase: {phase} of 3</output>
                  <output htmlFor="clinical-playstate">
                    Play State: {playState}
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
                      announce("Switched mode to Endless BIMO Audit", "polite");
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
                  ).map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => triggerPowerUp(type)}
                      disabled={
                        playState !== "playing" ||
                        powerUps[type].charge < powerUps[type].maxCharge ||
                        ((type === "auto-clean" || type === "fast-sign") &&
                          !activeSubject)
                      }
                    >
                      Activate {label} ({powerUps[type].charge} of{" "}
                      {powerUps[type].maxCharge} charge)
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Canvas status caption while the conveyor is stopped */}
            {playState !== "playing" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                <span className="rounded-full border border-zinc-700 bg-[#0d0e11]/90 px-3 py-1 text-[11px] text-zinc-300">
                  {playState === "idle"
                    ? "Conveyor idle · clock in below"
                    : playState === "phase_cleared"
                      ? "Phase cleared · conveyor stopped"
                      : "Shift over · conveyor stopped"}
                </span>
              </div>
            )}
          </div>

          {playState === "playing" ? (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
              {/* Mobile: urgent sponsor email sits above the work */}
              {sponsorEmailCard && (
                <div className="lg:hidden">{sponsorEmailCard}</div>
              )}

              {/* Left column: queue + active CRF */}
              <section
                aria-labelledby="cc-dossier-title"
                className="min-w-0 rounded-xl border border-zinc-800 bg-[#13151a] p-3 sm:p-4 lg:col-span-7"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Queue · {conveyorSubjects.length}/5
                  </span>
                  <span className="hidden text-[10px] text-zinc-400 sm:inline">
                    ← → to cycle
                  </span>
                </div>
                <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {conveyorSubjects.length === 0 && (
                    <li className="py-3 text-[11px] text-zinc-400">
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
                      <li key={sub.id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedSubjectId(sub.id)}
                          aria-pressed={isSelected}
                          className={`flex min-h-[56px] w-[7.5rem] flex-col justify-between rounded-lg border p-2 text-left transition active:scale-[0.98] ${
                            isSelected
                              ? "border-cyan-400/80 bg-cyan-950/30"
                              : sub.isSAE
                                ? "border-rose-500/40 bg-[#0d0e11] hover:border-rose-400"
                                : "border-zinc-800 bg-[#0d0e11] hover:border-zinc-600"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[11px] font-bold ${
                                isSelected ? "text-cyan-200" : "text-zinc-200"
                              }`}
                            >
                              {sub.subjectLabel}
                            </span>
                            {sub.isSAE && (
                              <span className="rounded bg-rose-500/20 px-1 text-[9px] font-bold text-rose-300">
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
                            <span
                              className={`block h-full transition-[width] duration-500 ease-linear ${timerBarColor(ratio)}`}
                              style={{
                                width: `${Math.max(0, Math.min(100, ratio * 100))}%`,
                              }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {activeSubject ? (
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Active CRF
                        </span>
                        <h3
                          id="cc-dossier-title"
                          className="flex flex-wrap items-center gap-2 text-base font-bold text-white"
                        >
                          {activeSubject.subjectLabel}
                          {activeSubject.isSAE && (
                            <span className="rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-300">
                              ⚡ SAE expedited
                            </span>
                          )}
                        </h3>
                        <p className="truncate text-[10px] text-zinc-400">
                          {activeSubject.studySite}
                        </p>
                        {nextDossierCue?.subjectId === activeSubject.id && (
                          <p className="mt-1 text-[10px] font-bold text-emerald-300">
                            {nextDossierCue.text}
                          </p>
                        )}
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${
                          activeSubject.timeRemaining / activeSubject.maxTime <
                          0.25
                            ? "text-rose-400"
                            : "text-amber-300"
                        }`}
                      >
                        <IconClock className="h-4 w-4" aria-hidden="true" />
                        {Math.ceil(activeSubject.timeRemaining)}s
                      </span>
                    </div>

                    {/* Fix → Route → Dispatch stepper */}
                    <ol
                      className="mt-3 grid grid-cols-3 gap-1.5 text-[10px]"
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
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                            step.current
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                              : step.done
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                                : "border-zinc-800 text-zinc-400"
                          }`}
                        >
                          <span className="font-bold tabular-nums">
                            {step.done ? "✓" : i + 1}
                          </span>
                          <span className="truncate">{step.label}</span>
                        </li>
                      ))}
                    </ol>

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
                        className="mt-3 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-left transition hover:bg-amber-500/15 active:scale-[0.99]"
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
                      <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
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
                        className="mt-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                            First-shift calibration · clocks paused
                          </p>
                          <button
                            type="button"
                            onClick={skipCalibration}
                            className="min-h-[44px] shrink-0 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-200 hover:border-zinc-500 hover:text-white active:scale-[0.98]"
                          >
                            Skip calibration
                          </button>
                        </div>
                        <ol className="mt-2 space-y-1 text-xs text-zinc-200">
                          <li
                            aria-current={
                              calibrationStep === "fix" ? "step" : undefined
                            }
                            className={
                              calibrationStep === "fix"
                                ? "font-bold text-white"
                                : "text-zinc-400"
                            }
                          >
                            {calibrationStep === "fix" ? "▸" : "✓"} 1. Fix: open
                            the flagged field and pick the compliant value
                            (Enter, then 1–4).
                          </li>
                          <li
                            aria-current={
                              calibrationStep === "route" ? "step" : undefined
                            }
                            className={
                              calibrationStep === "route"
                                ? "font-bold text-white"
                                : "text-zinc-400"
                            }
                          >
                            {calibrationStep === "route" ? "▸" : "·"} 2. Route:
                            send the clean CRF to its matching station.
                          </li>
                          <li className="text-zinc-400">
                            · 3. Sign: routine packets dispatch at once; SAE and
                            phase-lock packets open the signature review.
                          </li>
                        </ol>
                        {activeSubject.id !== calibrationSubject.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSubjectId(calibrationSubject.id)
                            }
                            className="mt-2 min-h-[44px] rounded-lg border border-sky-500/40 px-3 text-xs font-bold text-sky-200 hover:bg-sky-500/10 active:scale-[0.98]"
                          >
                            Back to {calibrationSubject.subjectLabel}
                          </button>
                        )}
                      </section>
                    )}

                    {/* Observations */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                          className={`cursor-pointer min-h-[44px] min-w-0 rounded-lg border p-3 text-left transition active:scale-[0.99] ${
                            !obs.isResolved
                              ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-400"
                              : "border-zinc-800 bg-[#0d0e11] hover:border-zinc-700"
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
                          <span className="mt-1 flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm font-bold ${
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
                  <p className="mt-3 border-t border-zinc-800 py-6 text-center text-xs text-zinc-400">
                    Queue clear. Enjoy the silence while it lasts.
                  </p>
                )}
              </section>

              {/* Right column: email, stations, lifelines */}
              <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
                {sponsorEmailCard && (
                  <div className="hidden lg:block">{sponsorEmailCard}</div>
                )}

                <section
                  aria-label="EDC stations"
                  className="rounded-xl border border-zinc-800 bg-[#13151a] p-3"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span>Route to station</span>
                    <span className="font-normal normal-case text-zinc-400">
                      Keys 1–{sortedStations.length}
                    </span>
                  </div>
                  {routingNotice &&
                    routingNotice.subjectId === activeSubject?.id &&
                    routingNotice.unresolvedCount ===
                      routingReadiness.unresolvedCount && (
                      <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                        {routingNotice.message}
                      </p>
                    )}
                  <div
                    className={`mt-2 grid gap-2 ${
                      sortedStations.length > 4
                        ? "grid-cols-2 sm:grid-cols-3"
                        : "grid-cols-2"
                    }`}
                  >
                    {sortedStations.map((station, index) => {
                      const matches =
                        !!activeSubject &&
                        routingReadiness.matchingDomains.includes(station.id);
                      const accepts = matches && flowStep === 2;
                      const isFlashing = flashStationId === station.id;
                      return (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => handleInitiateSubmission(station.id)}
                          className={`group min-h-[44px] min-w-0 rounded-lg border p-2.5 text-left transition active:scale-[0.98] ${
                            isFlashing
                              ? "border-emerald-400 bg-emerald-500/20"
                              : accepts
                                ? "border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                                : matches
                                  ? "border-amber-500/60 bg-amber-500/10"
                                  : activeSubject
                                    ? "border-zinc-900 bg-zinc-950/80 [&_h4]:text-zinc-300"
                                    : "border-zinc-800 bg-[#0d0e11] hover:border-zinc-600"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <kbd className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                              {index + 1}
                            </kbd>
                            {accepts ? (
                              <span className="text-[9px] font-bold text-emerald-300">
                                Accepts ✓
                              </span>
                            ) : matches || activeSubject ? (
                              <span className="flex min-w-0 items-center gap-1">
                                <span
                                  className={`text-[9px] ${matches ? "font-bold text-amber-300" : "font-medium text-zinc-300"}`}
                                >
                                  {matches ? "Fix first" : "Other domain"}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: station.color }}
                                />
                              </span>
                            ) : (
                              <span
                                aria-hidden="true"
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: station.color }}
                              />
                            )}
                          </span>
                          <h4 className="mt-1 truncate text-xs font-bold text-white">
                            {station.label}
                          </h4>
                          <span className="block truncate text-[10px] text-zinc-400">
                            {station.name}
                          </span>
                          <span className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Submits:</span>
                            <span className="font-bold tabular-nums text-emerald-400">
                              {station.processedCount}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section
                  aria-label="Lifelines"
                  className="rounded-xl border border-zinc-800 bg-[#13151a] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span>Lifelines</span>
                    <span className="font-normal normal-case text-zinc-400">
                      Charge by fixing and dispatching
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => triggerPowerUp(type)}
                          disabled={
                            !isReady ||
                            ((type === "auto-clean" || type === "fast-sign") &&
                              !activeSubject)
                          }
                          title={p.description}
                          className={`flex min-h-[56px] min-w-0 flex-col justify-between rounded-lg border p-2 text-left transition active:scale-[0.98] ${
                            isActive
                              ? "border-violet-400/60 bg-violet-500/10"
                              : isReady
                                ? "border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/15"
                                : "border-zinc-800 bg-[#0d0e11] opacity-80"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span
                              className={`flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-tight ${
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
                              <span className="break-words">{p.name}</span>
                            </span>
                            <kbd className="shrink-0 rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                              {p.hotkey}
                            </kbd>
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="block h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
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
                              className={`text-[9px] font-bold tabular-nums ${
                                isReady ? "text-emerald-300" : "text-zinc-400"
                              }`}
                            >
                              {isActive
                                ? `${Math.ceil(p.activeSecondsRemaining)}s`
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
              </div>
            </div>
          ) : playState === "idle" ? (
            <section
              aria-labelledby="cc-briefing-title"
              className="@container mt-3 rounded-xl border border-zinc-800 bg-[#13151a] p-4 sm:p-5"
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
                      ? `Lock ${PHASE_TARGETS[1]} CRFs to clear Phase 1. Three phases, each busier than the last.`
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
                    Pick a valid signature reason. Back-to-back locks build your
                    combo.
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
                      try {
                        const stored = localStorage.getItem(
                          "crf_active_protocol"
                        );
                        if (stored) {
                          const parsed = JSON.parse(stored);
                          setActiveProtocol(parsed);
                          addAuditLog(
                            `Loaded active protocol ${parsed.protocolNumber} into simulation.`,
                            "COMPLIANT"
                          );
                          announce("Authored protocol loaded", "polite");
                          return;
                        }
                      } catch {}
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
              className={`mt-3 rounded-xl border p-5 text-center ${
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
                  ? phase < 3
                    ? `PHASE ${phase} COMPLIANCE AUDIT PASSED!`
                    : "STUDY PROTOCOL APPROVED FOR NDA SUBMISSION!"
                  : gameOverReason === "sponsor"
                    ? "CONTRACT TERMINATED · STUDY MOVED TO ANOTHER CRO"
                    : "FDA FORM 483 ISSUED · TRIAL TERMINATED"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400">
                {playState === "phase_cleared"
                  ? phase < 3
                    ? `Phase ${phase + 1} opens more EDC stations and a faster conveyor.`
                    : "Database locked. All trial data validated and archived."
                  : gameOverReason === "sponsor"
                    ? "Sponsor satisfaction hit 0%. They 'decided to go in a different direction' and awarded the study to a vendor whose bid was 40% cheaper and entirely hypothetical."
                    : "Auditor suspicion reached 100%. Major source data validation discrepancies triggered clinical hold under 21 CFR § 312.44."}
              </p>

              <dl className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {[
                  {
                    label: "Score",
                    value: scoreState.score,
                    tone: "text-white",
                  },
                  {
                    label: "CRFs locked",
                    value: scoreState.subjectsSubmitted,
                    tone: "text-emerald-300",
                  },
                  {
                    label: "Violations",
                    value: scoreState.auditViolations,
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
        </>
      )}

      {/* TAB 2: Live CDISC SDTM Studio & Dataset Inspector */}
      {activeTab === "sdtm_studio" && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
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
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] border-b border-zinc-800 sticky top-0">
                <tr>
                  <th className="p-2.5">STUDYID</th>
                  <th className="p-2.5">DOMAIN</th>
                  <th className="p-2.5">USUBJID</th>
                  <th className="p-2.5">TESTCD</th>
                  <th className="p-2.5">TEST NAME</th>
                  <th className="p-2.5">RAW (ORRES)</th>
                  <th className="p-2.5">STANDARDIZED (STRESC)</th>
                  <th className="p-2.5">STATUS</th>
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
        <div className="mt-4 rounded-xl border border-zinc-800 bg-black/90 p-4">
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

      {/* Multi-Choice Regulatory Validation Drawer Modal */}
      {validatingObs && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-fix-dialog-title"
            className="max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-amber-500/50 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <IconHelp className="h-5 w-5 text-amber-400" />
                <h3
                  id="cc-fix-dialog-title"
                  className="text-base font-bold text-white"
                >
                  CDISC Controlled Terminology Validation
                </h3>
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
                    (opt, optIdx) => (
                      <button
                        key={opt}
                        onClick={() => handleSelectChoice(opt)}
                        className={`p-2.5 min-h-[44px] rounded-xl border text-left font-mono text-xs transition ${
                          validatingObs.selectedChoice === opt
                            ? validatingObs.feedback?.isValid
                              ? "border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold"
                              : "border-rose-500 bg-rose-950/60 text-rose-300 font-bold"
                            : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-brand-cyan hover:bg-zinc-800"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <kbd className="rounded border border-zinc-700 px-1 text-[10px] font-normal text-zinc-400">
                            {optIdx + 1}
                          </kbd>
                          <span>{opt}</span>
                        </span>
                      </button>
                    )
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
      {signatureModal.isOpen && signatureModal.subject && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-sign-dialog-title"
            className="max-w-lg w-full rounded-2xl border border-brand-cyan/60 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <IconLock className="h-5 w-5 text-brand-cyan" />
                <h3
                  id="cc-sign-dialog-title"
                  className="text-base font-bold text-white"
                >
                  21 CFR Part 11 Electronic Signature
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {targetRoutingStation} EDC LOCK
              </span>
            </div>

            <div className="mt-4 space-y-4 text-xs font-mono">
              <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                <p className="text-zinc-400">
                  <span className="text-zinc-400">SUBJECT:</span>{" "}
                  {signatureModal.subject.subjectLabel} (
                  {signatureModal.subject.studySite})
                </p>
                <p className="text-zinc-400 mt-1">
                  <span className="text-zinc-400">TARGET EDC:</span>{" "}
                  {targetRoutingStation} Domain Desk (
                  {stations.find((s) => s.id === targetRoutingStation)?.vendor})
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">
                  Select Legal Signature Reason [21 CFR § 11.50]
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      onClick={() =>
                        setSignatureModal((prev) => ({
                          ...prev,
                          selectedReason: r,
                        }))
                      }
                      className={`p-2 min-h-[44px] rounded-lg text-left text-[11px] border transition ${
                        signatureModal.selectedReason === r
                          ? "border-brand-cyan bg-cyan-950/60 text-cyan-300 font-bold"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
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
                  className="w-full min-h-[44px] rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-brand-cyan focus:outline-none"
                />
              </div>

              <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                By executing this signature, I legally attest that all clinical
                data points conform to CDISC Controlled Terminology and ICH GCP
                E6(R2) standards.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() =>
                  setSignatureModal((prev) => ({
                    ...prev,
                    isOpen: false,
                    subject: null,
                  }))
                }
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-white"
              >
                Cancel (Esc)
              </button>
              <button
                onClick={handleConfirmSignature}
                className="flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
              >
                <IconShieldCheck className="h-4 w-4" /> Sign &amp; Lock CRF
                (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FDA BIMO Inspection Report Modal */}
      {bimoReport && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-report-dialog-title"
            className="max-w-2xl w-full rounded-2xl border border-emerald-500/50 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <IconShieldCheck className="h-6 w-6 text-emerald-400" />
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
              <div className="grid grid-cols-3 gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">
                    Compliance Score
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    {bimoReport.overallScore}/100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">
                    Clean Rate
                  </span>
                  <span className="text-lg font-bold text-brand-cyan">
                    {bimoReport.cleanRate}%
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

          <Link
            href="/case-studies/imednet-python-sdk"
            className="shrink-0 inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-lg border border-brand-blue/40 bg-brand-blue/15 text-xs font-bold text-brand-cyan hover:bg-brand-blue/25 transition shadow-sm"
          >
            <span>Read SDK Case Study</span>
            <IconExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
};
