import { clamp } from "../game-utils";
import { escapeXml } from "../utils";
import {
  AuditLogEntry,
  AuditorState,
  BIMOInspectionReport,
  BIMOFinding,
  CDISCDomain,
  ClinicalObservation,
  ClinicalSubject,
  GameMode,
  GamePhase,
  GameScoreState,
  PowerUpInventory,
  PowerUpType,
  ProtocolAmendment,
  RecordedRuleViolation,
  SDTMRow,
  SignatureReason,
  StationConfig,
} from "./types";
import { AMENDMENT_PRESETS } from "./scenarios";
import { evaluateCondition, evaluateRule } from "../crf/ast-evaluator";
import { EditCheckRule, StudyProtocol, CRFField } from "../crf/types";
import { StudyProtocolEngine } from "../crf/study-engine";

export function createInitialScoreState(): GameScoreState {
  return {
    score: 0,
    highScore: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    subjectsSubmitted: 0,
    correctionsMade: 0,
    cleanSubmissions: 0,
    auditViolations: 0,
  };
}

/**
 * Score state for the next shift. Advancing to campaign phase 2 or 3
 * continues the same run, so the score and running tallies carry over and the
 * campaign ends on one total (#1325); the combo and multiplier restart. Any
 * other start (phase 1 or endless) is a fresh run.
 *
 * @param prev - The score state at the end of the previous shift.
 * @param continuesCampaign - True when advancing to campaign phase 2 or 3.
 * @param highScore - The best score saved so far.
 * @returns The score state to start the shift with.
 */
export function getNextShiftScoreState(
  prev: GameScoreState,
  continuesCampaign: boolean,
  highScore: number
): GameScoreState {
  if (!continuesCampaign) {
    return { ...createInitialScoreState(), highScore };
  }
  return {
    ...createInitialScoreState(),
    score: prev.score,
    maxCombo: prev.maxCombo,
    subjectsSubmitted: prev.subjectsSubmitted,
    correctionsMade: prev.correctionsMade,
    cleanSubmissions: prev.cleanSubmissions,
    auditViolations: prev.auditViolations,
    highScore: Math.max(highScore, prev.score),
  };
}

export function createInitialAuditorState(): AuditorState {
  return {
    x: 0.1,
    y: 0.5,
    direction: 1,
    behavior: "patrolling",
    suspicion: 0,
    suspicionDecayRate: 0.5, // 0.5% decay per second
    inspectTimer: 0,
    total483Citations: 0,
    isPaused: false,
  };
}

export function createInitialPowerUpInventory(): PowerUpInventory {
  return {
    "fda-coffee-break": {
      id: "fda-coffee-break",
      name: "FDA Coffee Break",
      description:
        "Sends auditor to cafeteria. Freezes suspicion and auditor movement for 8 seconds.",
      hotkey: "Q",
      charge: 0,
      maxCharge: 3,
      activeSecondsRemaining: 0,
      duration: 8,
    },
    "auto-clean": {
      id: "auto-clean",
      name: "CDISC Auto-Clean",
      description:
        "Instantly validates and standardizes all observations on the active dossier.",
      hotkey: "W",
      charge: 0,
      maxCharge: 4,
      activeSecondsRemaining: 0,
      duration: 0,
    },
    "query-extension": {
      id: "query-extension",
      name: "Site Query Extension",
      description:
        "Grants +12 seconds to all active conveyor subjects to avoid overdue timeouts.",
      hotkey: "E",
      charge: 0,
      maxCharge: 2,
      activeSecondsRemaining: 0,
      duration: 0,
    },
    "fast-sign": {
      id: "fast-sign",
      name: "Fast-Track 21 CFR Pass",
      description:
        "Instant compliant sign & lock of active subject without opening the signature modal.",
      hotkey: "R",
      charge: 0,
      maxCharge: 5,
      activeSecondsRemaining: 0,
      duration: 0,
    },
  };
}

export function formatAuditTimestamp(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `[${h}:${m}:${s}]`;
}

export function createAuditLogEntry(
  message: string,
  level: "INFO" | "WARN" | "CRITICAL" | "COMPLIANT",
  suspicionDelta = 0
): AuditLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: formatAuditTimestamp(),
    level,
    message,
    suspicionDelta,
  };
}

// FNV-1a: a small, stable string hash used to seed the choice shuffle.
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Fisher-Yates driven by mulberry32, so one seed always gives one order.
function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The choices the fix dialog offers for an observation. An empty or missing
 * option list falls back to the expected value and the raw entry, so the
 * dialog never opens without a button to press.
 *
 * Authored and generated option lists put the correct value first, so the
 * choices are shuffled. The shuffle is seeded by the observation, which keeps
 * the order (and so the 1-4 hotkeys) stable while a dialog is open and across
 * server and client renders, but varies it from one observation to the next.
 */
export function getObservationChoices(
  observation: ClinicalObservation
): string[] {
  const configured = (observation.options ?? []).filter(
    (option) => option.trim().length > 0
  );
  const choices =
    configured.length > 0
      ? configured
      : [
          observation.correctedValue ?? observation.rawValue,
          observation.rawValue,
        ];
  const unique = Array.from(new Set(choices));
  return seededShuffle(
    unique,
    hashString(`${observation.id}|${observation.field}|${observation.rawValue}`)
  );
}

/**
 * Validates a user's multi-choice answer on a clinical observation using authored AST conditions.
 */
export function validateObservationChoice(
  observation: ClinicalObservation,
  selectedChoice: string,
  activeProtocol?: StudyProtocol | null
): {
  observation: ClinicalObservation;
  isValid: boolean;
  explanation: string;
  suspicionDelta: number;
  scoreDelta: number;
  isAstEvaluated: boolean;
  ruleName?: string;
} {
  // The observation's own rule is its answer key. An authored protocol rule
  // is consulted only when there is none, and only if every condition reads
  // this field: a rule that also reads other fields (a BMI derivation, say)
  // can never be satisfied by a single choice, so it would reject them all.
  let ruleToEvaluate: EditCheckRule | undefined = observation.astRule;
  let ruleName = ruleToEvaluate?.name || `AST Check (${observation.field})`;

  if (!ruleToEvaluate && activeProtocol) {
    const aliases = new Set(
      [observation.field, observation.fieldId].filter(
        (alias): alias is string => Boolean(alias)
      )
    );
    const readsOnlyThisField = (r: EditCheckRule) =>
      !r.unsupportedExpression &&
      !(r.conditionGroups && r.conditionGroups.length > 0) &&
      r.conditions.length > 0 &&
      r.conditions.every((c) => aliases.has(c.fieldId) && !c.crossVisitId);
    const protocolRule = [
      ...(activeProtocol.forms ?? []).flatMap((form) => form.rules ?? []),
      ...(activeProtocol.rules ?? []),
    ].find(
      (r) =>
        (aliases.has(r.targetFieldId) ||
          r.triggerFieldIds.some((id) => aliases.has(id))) &&
        readsOnlyThisField(r)
    );
    if (protocolRule) {
      ruleToEvaluate = protocolRule;
      ruleName = protocolRule.name;
    }
  }

  const fieldValues: Record<
    string,
    string | number | boolean | null | undefined
  > = {
    [observation.field]: selectedChoice,
    [observation.field.toLowerCase()]: selectedChoice,
  };
  if (observation.fieldId) {
    fieldValues[observation.fieldId] = selectedChoice;
    fieldValues[observation.fieldId.toLowerCase()] = selectedChoice;
  }

  const fieldsList: CRFField[] = [
    {
      id: observation.fieldId || observation.field,
      variableName: observation.field,
      label: observation.field,
      dataType: "text",
      columnSpan: 6,
      required: true,
    },
  ];

  let isValid = false;
  let explanation = "";

  if (
    ruleToEvaluate &&
    ruleToEvaluate.conditions &&
    ruleToEvaluate.conditions.length > 0
  ) {
    isValid = evaluateRule(ruleToEvaluate, fieldValues, fieldsList);
    if (isValid) {
      explanation =
        ruleToEvaluate.description ||
        `Authored AST Rule '${ruleName}' PASSED: '${selectedChoice}' satisfies condition.`;
    } else {
      const failedCond = ruleToEvaluate.conditions[0];
      explanation =
        ruleToEvaluate.queryMessage ||
        `Authored AST Rule '${ruleName}' FAILED: '${selectedChoice}' violates condition (${failedCond.fieldId} ${failedCond.operator} ${failedCond.value}).`;
    }
  } else if (
    observation.astConditions &&
    observation.astConditions.length > 0
  ) {
    isValid = observation.astConditions.every((cond) =>
      evaluateCondition(cond, fieldValues, fieldsList)
    );
    if (isValid) {
      explanation = `AST Condition PASSED: '${selectedChoice}' satisfies condition.`;
    } else {
      explanation = `AST Condition FAILED: '${selectedChoice}' violates condition.`;
    }
  } else {
    // Fallback AST condition evaluation (evaluates via AST evaluateCondition)
    const expected = observation.correctedValue ?? observation.rawValue;
    const syntheticCond = {
      fieldId: observation.field,
      operator: "eq" as const,
      value: expected.trim(),
    };
    isValid = evaluateCondition(syntheticCond, fieldValues, fieldsList);
    if (isValid) {
      explanation =
        observation.explanation ||
        `Correct CDISC standardization applied: '${selectedChoice}' complies with ${observation.destination} specification.`;
    } else {
      explanation = `Invalid regulatory code: '${selectedChoice}' does not resolve '${observation.field}' (${observation.hint || "Review standard terminology"}).`;
    }
  }

  if (isValid) {
    return {
      observation: {
        ...observation,
        currentValue: selectedChoice,
        isResolved: true,
      },
      isValid: true,
      explanation,
      suspicionDelta: -3,
      scoreDelta: 75,
      isAstEvaluated: true,
      ruleName,
    };
  } else {
    return {
      observation: {
        ...observation,
        isResolved: false,
      },
      isValid: false,
      explanation,
      suspicionDelta: 8,
      scoreDelta: -25,
      isAstEvaluated: true,
      ruleName,
    };
  }
}

/**
 * Resolves or corrects a single clinical observation on a subject (auto or manual fallback).
 */
export function fixObservation(
  observation: ClinicalObservation,
  suggestedCorrection?: string
): { observation: ClinicalObservation; isValid: boolean } {
  const target =
    suggestedCorrection ?? observation.correctedValue ?? observation.rawValue;
  const isValid =
    target === observation.correctedValue || target.trim().length > 0;

  return {
    observation: {
      ...observation,
      currentValue: target,
      isResolved: true,
    },
    isValid,
  };
}

/**
 * Validates whether all observations on a subject are resolved and compliant.
 */
export function isSubjectFullyCompliant(subject: ClinicalSubject): boolean {
  return subject.observations.every((obs) => obs.isResolved);
}

/**
 * Computes score delta for a successful subject submission.
 */
export function calculateSubmissionPoints(
  subject: ClinicalSubject,
  multiplier: number,
  allClean: boolean
): number {
  const basePoints = 200;
  const observationBonus = subject.observations.length * 60;
  const speedBonus = Math.floor(
    (subject.timeRemaining / subject.maxTime) * 120
  );
  const saeBonus = subject.isSAE ? 300 : 0;
  const cleanBonus = allClean ? 150 : 0;

  return Math.round(
    (basePoints + observationBonus + speedBonus + saeBonus + cleanBonus) *
      multiplier
  );
}

/**
 * Advances conveyor subjects timer by deltaSeconds.
 */
export function tickSubjectTimers(
  subjects: ClinicalSubject[],
  deltaSeconds: number
): {
  updatedSubjects: ClinicalSubject[];
  expiredSubjects: ClinicalSubject[];
} {
  const updated: ClinicalSubject[] = [];
  const expired: ClinicalSubject[] = [];

  for (const subject of subjects) {
    if (subject.status === "submitted" || subject.status === "rejected") {
      continue;
    }

    const nextTime = Math.max(0, subject.timeRemaining - deltaSeconds);
    if (nextTime <= 0 && subject.status !== "expired") {
      expired.push({ ...subject, timeRemaining: 0, status: "expired" });
    } else {
      updated.push({ ...subject, timeRemaining: nextTime });
    }
  }

  return { updatedSubjects: updated, expiredSubjects: expired };
}

/**
 * Updates Auditor AI physics and state machine.
 */
export function tickAuditor(
  auditor: AuditorState,
  deltaSeconds: number,
  unresolvedBacklogCount: number
): AuditorState {
  if (auditor.isPaused || auditor.behavior === "coffee_break") {
    return auditor;
  }

  const { suspicion } = auditor;
  let { x, direction, behavior, inspectTimer, total483Citations } = auditor;

  // 1. Move patrol position across floor
  x += direction * 0.12 * deltaSeconds;
  if (x >= 0.9) {
    x = 0.9;
    direction = -1;
  } else if (x <= 0.1) {
    x = 0.1;
    direction = 1;
  }

  // 2. State machine transitions
  if (behavior === "patrolling") {
    inspectTimer += deltaSeconds;
    if (inspectTimer > 8) {
      behavior = "inspecting";
      inspectTimer = 0;
    }
  } else if (behavior === "inspecting") {
    inspectTimer += deltaSeconds;
    if (inspectTimer > 3) {
      behavior = suspicion > 50 ? "suspicious" : "patrolling";
      inspectTimer = 0;
    }
  } else if (behavior === "suspicious") {
    inspectTimer += deltaSeconds;
    if (inspectTimer > 5 && suspicion < 40) {
      behavior = "patrolling";
      inspectTimer = 0;
    }
  }

  // 3. Passive suspicion decay and backlog pressure
  let nextSuspicion = suspicion - auditor.suspicionDecayRate * deltaSeconds;
  if (unresolvedBacklogCount > 4) {
    // Backlog increases audit scrutiny
    nextSuspicion += (unresolvedBacklogCount - 4) * 0.8 * deltaSeconds;
  }

  nextSuspicion = clamp(nextSuspicion, 0, 100);

  if (nextSuspicion >= 100) {
    behavior = "issuing_483";
    total483Citations += 1;
  }

  return {
    ...auditor,
    x,
    direction,
    behavior,
    suspicion: nextSuspicion,
    inspectTimer,
    total483Citations,
  };
}

/**
 * Ticks active power-up cooldowns and durations.
 */
export function tickPowerUps(
  inventory: PowerUpInventory,
  deltaSeconds: number
): PowerUpInventory {
  const next = { ...inventory };
  let key: PowerUpType;
  for (key in next) {
    const item = next[key];
    if (item.activeSecondsRemaining > 0) {
      const remaining = Math.max(0, item.activeSecondsRemaining - deltaSeconds);
      next[key] = { ...item, activeSecondsRemaining: remaining };
    }
  }
  return next;
}

/**
 * Charges power-up meters upon clean actions or combos.
 */
export function chargePowerUps(
  inventory: PowerUpInventory,
  amount = 1
): PowerUpInventory {
  const next = { ...inventory };
  let key: PowerUpType;
  for (key in next) {
    const item = next[key];
    const newCharge = Math.min(item.maxCharge, item.charge + amount);
    next[key] = { ...item, charge: newCharge };
  }
  return next;
}

/**
 * Scrambles station positions (for Protocol Amendment event).
 */
export function scrambleStations(stations: StationConfig[]): StationConfig[] {
  const currentIndices = stations.map((s) => s.positionIndex);
  // Circular shift
  const shiftedIndices = [...currentIndices.slice(1), currentIndices[0]];

  return stations.map((station, i) => ({
    ...station,
    positionIndex: shiftedIndices[i],
  }));
}

/**
 * Evaluates 21 CFR Part 11 Electronic Signature submission.
 */
export function verify21CFRSubmission(
  subject: ClinicalSubject,
  reason: SignatureReason | string,
  targetStation: CDISCDomain
): {
  success: boolean;
  suspicionDelta: number;
  logMessage: string;
  level: "COMPLIANT" | "WARN" | "CRITICAL";
} {
  const validReasons: SignatureReason[] = [
    "Intent to Submit",
    "Author Verification",
    "Protocol Compliance Review",
    "Urgent Safety Expedited",
  ];

  if (!validReasons.includes(reason as SignatureReason)) {
    return {
      success: false,
      suspicionDelta: 20,
      logMessage: `[AUDIT REJECT] 21 CFR Part 11 Lock violated for ${subject.subjectLabel}: Invalid signature reason '${reason}'`,
      level: "CRITICAL",
    };
  }

  // Check if unvalidated observations exist
  const hasUnresolved = subject.observations.some((obs) => !obs.isResolved);
  if (hasUnresolved) {
    return {
      success: false,
      suspicionDelta: 25,
      logMessage: `[AUDIT REJECT] ${subject.subjectLabel} submitted to ${targetStation} with UNVERIFIED raw data entries! Suspicion +25%`,
      level: "CRITICAL",
    };
  }

  // Check if subject has observations matching the target station domain
  const hasMatchingDomain = subject.observations.some(
    (obs) => obs.destination === targetStation
  );
  if (!hasMatchingDomain) {
    return {
      success: false,
      suspicionDelta: 15,
      logMessage: `[AUDIT WARN] CDISC Domain Mismatch: ${subject.subjectLabel} routed to ${targetStation} with no matching domain observations!`,
      level: "WARN",
    };
  }

  return {
    success: true,
    suspicionDelta: -5, // Cools down suspicion
    logMessage: `[COMPLIANT] 21 CFR Part 11 Signature verified for ${subject.subjectLabel} -> ${targetStation} (${reason}). Auditor satisfied.`,
    level: "COMPLIANT",
  };
}

/** Most subjects the conveyor holds at once. */
export const MAX_CONVEYOR_SUBJECTS = 5;

/** Seconds before a fresh subject arrives once the queue has emptied. */
export const EMPTY_QUEUE_SPAWN_DELAY_SECONDS = 0.75;

/** Seconds between subject spawns for each phase while the queue has work. */
export const SPAWN_INTERVAL_BY_PHASE: Readonly<Record<GamePhase, number>> = {
  1: 6.5,
  2: 4.8,
  3: 3.5,
};

/**
 * Seconds until the next subject spawns. An empty queue refills almost at
 * once and a queue with one subject left fills at twice the phase rate, so a
 * fast player works instead of waiting on the conveyor (#1327). `scale`
 * applies office modifiers to the phase rate; the empty-queue refill ignores
 * it.
 */
export function getSpawnIntervalSeconds(
  phase: GamePhase,
  queueLength: number,
  scale: (seconds: number) => number = (seconds) => seconds
): number {
  if (queueLength <= 0) return EMPTY_QUEUE_SPAWN_DELAY_SECONDS;
  const base = SPAWN_INTERVAL_BY_PHASE[phase];
  return scale(queueLength === 1 ? base / 2 : base);
}

/**
 * Picks the dossier to load after a submission: SAE cases first, then the
 * least time remaining, then the oldest arrival, then subject id, so the
 * choice is deterministic. Returns null when nothing is pending.
 */
export function selectNextUrgentSubject(
  queue: ReadonlyArray<ClinicalSubject>
): ClinicalSubject | null {
  const pending = queue.filter(
    (subject) =>
      subject.status !== "submitted" &&
      subject.status !== "rejected" &&
      subject.status !== "expired"
  );
  if (pending.length === 0) return null;
  return [...pending].sort(
    (a, b) =>
      Number(Boolean(b.isSAE)) - Number(Boolean(a.isSAE)) ||
      a.timeRemaining - b.timeRemaining ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id)
  )[0];
}

/** Where the first-shift calibration walkthrough stands (#834). */
export type CalibrationStep = "fix" | "route" | "complete";

/**
 * Whether a new shift opens with the first-shift calibration: only a Phase 1
 * campaign does; later phases and endless mode start live.
 */
export function shouldRunCalibration(
  mode: GameMode,
  phase: GamePhase
): boolean {
  return mode === "campaign" && phase === 1;
}

/**
 * Derives the calibration step from the live queue: the guided subject still
 * has flagged fields ("fix"), is clean and waiting to be routed ("route"), or
 * has left the queue because it was submitted ("complete").
 */
export function getCalibrationStep(
  queue: ReadonlyArray<ClinicalSubject>,
  subjectId: string
): CalibrationStep {
  const subject = queue.find((s) => s.id === subjectId);
  if (!subject) return "complete";
  return subject.observations.some((o) => !o.isResolved) ? "fix" : "route";
}

/**
 * Describes which active stations match a dossier before routing is allowed.
 * Matching domains remain visible while observations are unresolved so the
 * player can understand the destination without submitting prematurely.
 */
export function getRoutingReadiness(
  subject: ClinicalSubject | null,
  stations: ReadonlyArray<Pick<StationConfig, "id">>
): { matchingDomains: CDISCDomain[]; unresolvedCount: number } {
  if (!subject) return { matchingDomains: [], unresolvedCount: 0 };

  const activeDomains = new Set(stations.map((station) => station.id));
  return {
    matchingDomains: Array.from(
      new Set(
        subject.observations
          .map((observation) => observation.destination)
          .filter((domain) => activeDomains.has(domain))
      )
    ),
    unresolvedCount: subject.observations.filter(
      (observation) => !observation.isResolved
    ).length,
  };
}

/**
 * Chooses the in-game submission flow for a station route. Routine packets
 * can dispatch directly; safety cases, phase locks, active amendments, and
 * invalid destinations keep the full review dialog.
 */
export function getSubmissionMode(
  subject: ClinicalSubject,
  targetStation: CDISCDomain,
  stations: ReadonlyArray<Pick<StationConfig, "id">>,
  context: {
    gameMode: GameMode;
    submittedCount: number;
    phaseTarget: number;
    amendmentActive: boolean;
  }
): "quick" | "full" {
  const { matchingDomains, unresolvedCount } = getRoutingReadiness(
    subject,
    stations
  );
  if (
    unresolvedCount > 0 ||
    !matchingDomains.includes(targetStation) ||
    subject.isSAE ||
    context.amendmentActive ||
    (context.gameMode === "campaign" &&
      context.submittedCount + 1 >= context.phaseTarget)
  ) {
    return "full";
  }
  return "quick";
}

/**
 * Spawns a random mid-game protocol amendment.
 */
export function triggerRandomAmendment(): ProtocolAmendment {
  const picked =
    AMENDMENT_PRESETS[Math.floor(Math.random() * AMENDMENT_PRESETS.length)];
  return {
    ...picked,
    timeRemaining: picked.durationSeconds,
    active: true,
  };
}

/**
 * Converts submitted subjects into compliant CDISC SDTM observation rows.
 */
export function generateSDTMDataset(subjects: ClinicalSubject[]): SDTMRow[] {
  const rows: SDTMRow[] = [];
  let seq = 1;

  subjects.forEach((subj, subjIdx) => {
    subj.observations.forEach((obs) => {
      // Parse numeric result if present
      const numMatch = obs.currentValue.match(/^[-+]?[0-9]*\.?[0-9]+/);
      const stresn = numMatch ? parseFloat(numMatch[0]) : undefined;
      const unitMatch = obs.currentValue
        .replace(/^[-+]?[0-9]*\.?[0-9]+/, "")
        .trim();

      rows.push({
        STUDYID: "CT-CHAOS-2026",
        DOMAIN: obs.destination,
        USUBJID: `CTC-${subj.studySite.slice(5, 8)}-${subj.subjectLabel}`,
        SEQ: seq++,
        TESTCD:
          obs.ctCode || obs.field.toUpperCase().replace(/\s+/g, "").slice(0, 8),
        TEST: obs.field,
        ORRES: obs.rawValue,
        STRESC: obs.currentValue,
        STRESN: Number.isFinite(stresn) ? stresn : undefined,
        STRESU: unitMatch || undefined,
        VISIT: `VISIT ${subjIdx + 1} (DAY ${(subjIdx + 1) * 7})`,
        DY: (subjIdx + 1) * 7,
        SIGNDATE: new Date(subj.createdAt).toISOString().split("T")[0],
        STATUS: obs.isResolved ? "COMPLIANT" : "QUERY",
      });
    });
  });

  return rows;
}

/**
 * Serializes subjects and SDTM dataset into authentic CDISC ODM 1.3 XML.
 */
export function exportToCDISCODMXML(
  subjects: ClinicalSubject[],
  sdtmRows: SDTMRow[]
): string {
  const timestamp = new Date().toISOString();
  const subjectNodes = subjects
    .map((s) => {
      const fullSubjectId = s.studySite?.slice(5, 8)
        ? `CTC-${s.studySite.slice(5, 8)}-${s.subjectLabel}`
        : s.subjectLabel;

      const itemDataNodes = sdtmRows
        .filter(
          (r) =>
            r.USUBJID === s.subjectLabel ||
            r.USUBJID === fullSubjectId ||
            r.USUBJID === s.id
        )
        .map(
          (r) =>
            `          <ItemData ItemOID="${escapeXml(`IT.${r.DOMAIN}.${r.TESTCD}`)}" Value="${escapeXml(r.STRESC)}">
            <AuditRecord>
              <UserOID>USR.DATAMANAGER</UserOID>
              <DateTimeStamp>${timestamp}</DateTimeStamp>
              <ReasonForChange>21 CFR Part 11 Electronic Signature Verified</ReasonForChange>
            </AuditRecord>
          </ItemData>`
        )
        .join("\n");

      return `      <SubjectData SubjectKey="${escapeXml(s.subjectLabel)}">
        <StudyEventData StudyEventOID="SE.VISIT1">
          <FormData FormOID="${escapeXml(`FRM.${s.observations[0]?.destination || "DM"}`)}">
            <ItemGroupData ItemGroupOID="${escapeXml(`IG.${s.observations[0]?.destination || "DM"}`)}" ItemGroupRepeatKey="1">
${itemDataNodes}
            </ItemGroupData>
          </FormData>
        </StudyEventData>
      </SubjectData>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
     ODMVersion="1.3.2"
     FileType="Snapshot"
     FileOID="ODM.CTC.SNAPSHOT.${Date.now()}"
     CreationDateTime="${timestamp}">
  <Study OID="STUDY.CT-CHAOS-2026">
    <GlobalVariables>
      <StudyName>Clinical Trial Chaos - Multi-Center CDISC SDTM Study</StudyName>
      <StudyDescription>21 CFR Part 11 and CDISC Controlled Terminology Electronic Data Capture Run</StudyDescription>
      <ProtocolName>CTC-PHASE-III-GLOBAL</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="MDV.001" Name="CDISC SDTM v3.3 Standard Metadata">
      <Protocol>
        <StudyEventRef StudyEventOID="SE.VISIT1" OrderNumber="1" Mandatory="Yes"/>
      </Protocol>
    </MetaDataVersion>
  </Study>
  <ClinicalData StudyOID="STUDY.CT-CHAOS-2026" MetaDataVersionOID="MDV.001">
${subjectNodes}
  </ClinicalData>
</ODM>`;
}

/**
 * Serializes SDTM rows into standard CSV text.
 */
export function exportToSDTMCSV(sdtmRows: SDTMRow[]): string {
  const headers = [
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "SEQ",
    "TESTCD",
    "TEST",
    "ORRES",
    "STRESC",
    "STRESN",
    "STRESU",
    "VISIT",
    "DY",
    "SIGNDATE",
    "STATUS",
  ];

  const lines = sdtmRows.map((r) =>
    [
      r.STUDYID,
      r.DOMAIN,
      r.USUBJID,
      r.SEQ,
      r.TESTCD,
      `"${r.TEST.replace(/"/g, '""')}"`,
      `"${r.ORRES.replace(/"/g, '""')}"`,
      `"${r.STRESC.replace(/"/g, '""')}"`,
      r.STRESN !== undefined ? r.STRESN : "",
      r.STRESU || "",
      `"${r.VISIT}"`,
      r.DY,
      r.SIGNDATE,
      r.STATUS,
    ].join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

/**
 * Generates an FDA Bioresearch Monitoring (BIMO) inspection compliance report.
 */
export function generateBIMOReport(
  scoreState: GameScoreState,
  auditorState: AuditorState,
  _logs?: AuditLogEntry[],
  ruleViolations?: RecordedRuleViolation[],
  activeProtocol?: StudyProtocol | null
): BIMOInspectionReport {
  const totalSubmissions = scoreState.subjectsSubmitted;
  const violations = scoreState.auditViolations;
  const cleanSubmissions = scoreState.cleanSubmissions;

  const cleanRate =
    totalSubmissions > 0 ? (cleanSubmissions / totalSubmissions) * 100 : 100;
  const violationPenalty = Math.min(60, violations * 15);
  const suspicionPenalty = Math.min(30, auditorState.suspicion * 0.3);
  const rawScore = Math.max(
    0,
    Math.round(100 - violationPenalty - suspicionPenalty)
  );

  const findings: BIMOFinding[] = [];

  // Register specific AST edit check failures & CDISC conformance errors
  if (ruleViolations && ruleViolations.length > 0) {
    ruleViolations.forEach((v, idx) => {
      if (v.type === "ast_edit_check") {
        findings.push({
          id: `FND-AST-${idx + 1}`,
          category: "Protocol Compliance",
          severity: "Major",
          description: `AST Edit Check Violation on ${v.subjectLabel} (${v.field}): '${v.selectedChoice}' failed rule ${v.ruleName || "Check"}. ${v.message}`,
          regulation:
            "21 CFR § 312.62 - Investigator record keeping & protocol adherence",
        });
      } else {
        findings.push({
          id: `FND-CDISC-${idx + 1}`,
          category: "Data Integrity",
          severity: "Major",
          description: `CDISC Conformance Error on ${v.subjectLabel} (${v.field}): '${v.selectedChoice}' violates ${v.domain || "SDTM"} standard. ${v.message}`,
          regulation:
            "ICH GCP E6(R2) § 5.5 - Electronic data handling & CDISC STRESN standardization",
        });
      }
    });
  }

  // If active protocol is loaded, validate protocol conformance
  if (activeProtocol) {
    const protocolVal = StudyProtocolEngine.validateProtocol(activeProtocol);
    protocolVal.errors.forEach((err, idx) => {
      findings.push({
        id: `FND-PROTO-${idx + 1}`,
        category: "Protocol Compliance",
        severity: "Major",
        description: `Authored Protocol Error in Form [${err.form}]: ${err.message}`,
        regulation:
          "CDISC CDASH 2.2 / SDTM v3.3 Protocol Specification Standard",
      });
    });
  }

  if (violations > 0 && findings.length === 0) {
    findings.push({
      id: "FND-001",
      category: "Data Integrity",
      severity: violations >= 3 ? "Critical" : "Major",
      description: `${violations} Case Report Forms submitted with unresolved raw data entries or domain mismatch.`,
      regulation: "21 CFR § 11.10(a) - System validation & record authenticity",
    });
  }

  if (
    auditorState.suspicion >= 50 &&
    !findings.some((f) => f.id === "FND-002")
  ) {
    findings.push({
      id: "FND-002",
      category: "21 CFR Part 11",
      severity: auditorState.suspicion >= 100 ? "Critical" : "Major",
      description: `Elevated auditor scrutiny index (${Math.round(auditorState.suspicion)}%). Backlog pressure and delayed source data verification.`,
      regulation:
        "21 CFR § 11.50 - Signature manifestations and audit trail timeliness",
    });
  }

  if (
    cleanRate < 80 &&
    totalSubmissions > 0 &&
    !findings.some((f) => f.id === "FND-003")
  ) {
    findings.push({
      id: "FND-003",
      category: "Protocol Compliance",
      severity: "Minor",
      description: `Controlled Terminology non-conformances identified in ${Math.round(100 - cleanRate)}% of submissions prior to manual correction.`,
      regulation: "ICH GCP E6(R2) § 5.5 - Data handling and record keeping",
    });
  }

  let verdict: BIMOInspectionReport["verdict"] =
    "NAI (No Action Indicated - Approved)";
  let summary =
    "The Bioresearch Monitoring inspection found no objectionable conditions. The sponsor and clinical site data systems operate in full compliance with 21 CFR Part 11 and CDISC standards.";

  if (
    auditorState.suspicion >= 100 ||
    violations >= 3 ||
    findings.some((f) => f.severity === "Critical")
  ) {
    verdict = "OAI (Official Action Indicated - Form 483 Issued)";
    summary =
      "FDA Form 483 issued. Significant objectionable conditions were observed during the inspection, including critical data integrity discrepancies. Trial operations suspended under 21 CFR § 312.44.";
  } else if (findings.length > 0 || auditorState.suspicion > 30) {
    verdict = "VAI (Voluntary Action Indicated)";
    summary =
      "Objectionable conditions were noted, but they do not meet the threshold for regulatory action. The sponsor is advised to implement corrective and preventive action (CAPA) plans for Corrective Action plans for Controlled Terminology validation.";
  }

  return {
    runId: `BIMO-${Date.now().toString(36).toUpperCase()}`,
    auditDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    overallScore: rawScore,
    verdict,
    complianceRate: Math.round(cleanRate),
    findings,
    submittedCRFs: totalSubmissions,
    cleanRate: Math.round(cleanRate),
    summary,
  };
}

import { ArcadeEngine } from "@/lib/arcade";

export interface ClinicalTrialChaosState {
  scoreState: GameScoreState;
  auditorState: AuditorState;
  powerUps: PowerUpInventory;
  isPaused: boolean;
  isModalPaused: boolean;
  activeAmendment: ProtocolAmendment | null;
  ruleViolations: RecordedRuleViolation[];
  subjects: ClinicalSubject[];
  submittedHistory: ClinicalSubject[];
  activeProtocol: StudyProtocol | null;
  auditLogs: AuditLogEntry[];
}

export interface ClinicalTrialChaosSnapshot {
  scoreState: GameScoreState;
  auditorState: AuditorState;
  powerUps: PowerUpInventory;
  isPaused: boolean;
  isModalPaused: boolean;
  activeAmendment: ProtocolAmendment | null;
  ruleViolationsCount: number;
  subjectCount: number;
  submittedCount: number;
  auditLogCount: number;
}

export class ClinicalTrialChaosEngine extends ArcadeEngine<
  ClinicalTrialChaosState,
  ClinicalTrialChaosSnapshot
> {
  constructor(initialProtocol?: StudyProtocol | null) {
    super({
      scoreState: createInitialScoreState(),
      auditorState: createInitialAuditorState(),
      powerUps: createInitialPowerUpInventory(),
      isPaused: false,
      isModalPaused: false,
      activeAmendment: null,
      ruleViolations: [],
      subjects: [],
      submittedHistory: [],
      activeProtocol: initialProtocol ?? null,
      auditLogs: [],
    });
  }

  public override init(): void {
    // Re-initialize state
    this.state.scoreState = createInitialScoreState();
    this.state.auditorState = createInitialAuditorState();
    this.state.powerUps = createInitialPowerUpInventory();
    this.state.isPaused = false;
    this.state.isModalPaused = false;
    this.state.activeAmendment = null;
    this.state.ruleViolations = [];
    this.state.subjects = [];
    this.state.submittedHistory = [];
    this.state.auditLogs = [];
    this.notifySubscribers();
  }

  public setPaused(paused: boolean): void {
    this.state.isPaused = paused;
    this.notifySubscribers();
  }

  public setModalPause(paused: boolean): void {
    this.state.isModalPaused = paused;
    this.notifySubscribers();
  }

  public isModalPaused(): boolean {
    return this.state.isModalPaused;
  }

  public addSubject(subject: ClinicalSubject): void {
    this.state.subjects.push(subject);
    this.notifySubscribers();
  }

  public addAuditLog(
    message: string,
    level: "INFO" | "WARN" | "CRITICAL" | "COMPLIANT" = "INFO",
    suspicionDelta = 0
  ): void {
    const entry = createAuditLogEntry(message, level, suspicionDelta);
    this.state.auditLogs = [...this.state.auditLogs.slice(-50), entry];
    this.emit("auditLog", entry);
    this.notifySubscribers();
  }

  public resolveObservation(
    subjectId: string,
    obsId: string,
    choice: string
  ): { isValid: boolean; explanation: string } {
    const subject = this.state.subjects.find((s) => s.id === subjectId);
    if (!subject) return { isValid: false, explanation: "Subject not found" };

    const obs = subject.observations.find((o) => o.id === obsId);
    if (!obs) return { isValid: false, explanation: "Observation not found" };

    const result = validateObservationChoice(
      obs,
      choice,
      this.state.activeProtocol
    );

    if (result.isValid) {
      obs.currentValue = choice;
      obs.isResolved = true;

      this.state.scoreState.score += result.scoreDelta;
      this.state.scoreState.correctionsMade += 1;
      this.state.powerUps = chargePowerUps(this.state.powerUps, 1);

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("powerUpUpdate", { ...this.state.powerUps });
      this.addAuditLog(
        `Observation Standardized: ${obs.field} -> '${choice}' [${result.explanation}]`,
        "COMPLIANT",
        result.suspicionDelta
      );
    } else {
      const nextSusp = Math.min(
        100,
        this.state.auditorState.suspicion + result.suspicionDelta
      );
      this.state.auditorState.suspicion = nextSusp;
      this.state.auditorState.behavior =
        nextSusp >= 100 ? "issuing_483" : "suspicious";

      const violation: RecordedRuleViolation = {
        id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: obs.astRule ? "ast_edit_check" : "cdisc_conformance",
        subjectLabel: subject.subjectLabel,
        field: obs.field,
        selectedChoice: choice,
        ruleName: result.ruleName,
        message: result.explanation,
        domain: obs.destination,
        timestamp: new Date().toISOString(),
      };
      this.state.ruleViolations.push(violation);

      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.addAuditLog(
        `[AST RULE FAILURE] ${result.ruleName || "Edit check"} failed for ${obs.field}: '${choice}'. Auditor Suspicion +${result.suspicionDelta}%`,
        "WARN",
        result.suspicionDelta
      );
    }

    this.notifySubscribers();
    return { isValid: result.isValid, explanation: result.explanation };
  }

  public verifyAndSubmit(
    subjectId: string,
    reason: SignatureReason | string,
    targetStation: CDISCDomain
  ): { success: boolean; logMessage: string } {
    const subject = this.state.subjects.find((s) => s.id === subjectId);
    if (!subject) return { success: false, logMessage: "Subject not found" };

    const result = verify21CFRSubmission(subject, reason, targetStation);

    if (result.success) {
      const allClean = isSubjectFullyCompliant(subject);
      const points = calculateSubmissionPoints(
        subject,
        this.state.scoreState.multiplier,
        allClean
      );
      const nextCombo = this.state.scoreState.combo + 1;
      const nextMultiplier = Math.min(4, 1 + Math.floor(nextCombo / 3));

      this.state.scoreState.score += points;
      this.state.scoreState.highScore = Math.max(
        this.state.scoreState.score,
        this.state.scoreState.highScore
      );
      this.state.scoreState.combo = nextCombo;
      this.state.scoreState.maxCombo = Math.max(
        this.state.scoreState.maxCombo,
        nextCombo
      );
      this.state.scoreState.multiplier = nextMultiplier;
      this.state.scoreState.subjectsSubmitted += 1;
      if (allClean) this.state.scoreState.cleanSubmissions += 1;

      this.state.powerUps = chargePowerUps(
        this.state.powerUps,
        allClean ? 2 : 1
      );
      this.state.auditorState.suspicion = Math.max(
        0,
        this.state.auditorState.suspicion + result.suspicionDelta
      );

      this.state.submittedHistory.push(subject);
      this.state.subjects = this.state.subjects.filter(
        (s) => s.id !== subjectId
      );

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.emit("powerUpUpdate", { ...this.state.powerUps });
      this.emit("submissionVerified", { subject, targetStation, reason });
      this.addAuditLog(result.logMessage, "COMPLIANT", result.suspicionDelta);
    } else {
      this.state.scoreState.combo = 0;
      this.state.scoreState.multiplier = 1;
      this.state.scoreState.auditViolations += 1;

      const nextSusp = Math.min(
        100,
        this.state.auditorState.suspicion + result.suspicionDelta
      );
      this.state.auditorState.suspicion = nextSusp;
      this.state.auditorState.behavior =
        nextSusp >= 100 ? "issuing_483" : "suspicious";

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.addAuditLog(result.logMessage, result.level, result.suspicionDelta);
    }

    this.notifySubscribers();
    return { success: result.success, logMessage: result.logMessage };
  }

  public activatePowerUp(id: PowerUpType, force = true): void {
    const p = this.state.powerUps[id];
    if (p && (force || p.charge >= p.maxCharge)) {
      p.activeSecondsRemaining = p.duration;
      p.charge = 0;
      if (id === "fda-coffee-break") {
        this.state.auditorState.isPaused = true;
        this.state.auditorState.behavior = "coffee_break";
        this.state.auditorState.suspicion = Math.max(
          0,
          this.state.auditorState.suspicion - 15
        );
        this.addAuditLog(
          "☕ [POWER-UP ACTIVATED] FDA Coffee Break! Auditor halted for 8 seconds.",
          "COMPLIANT"
        );
      } else if (id === "query-extension") {
        this.state.subjects.forEach((sub) => {
          sub.timeRemaining = Math.min(
            sub.maxTime + 10,
            sub.timeRemaining + 12
          );
        });
        this.addAuditLog(
          "⏱️ [POWER-UP ACTIVATED] Site Query Extension added +12s to all active conveyors.",
          "COMPLIANT"
        );
      }
      this.emit("powerUpUpdate", { ...this.state.powerUps });
      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.notifySubscribers();
    }
  }

  public override update(dt: number): void {
    if (this.state.isPaused || this.state.isModalPaused) return;

    // Update powerups timer
    for (const key of Object.keys(this.state.powerUps) as PowerUpType[]) {
      const p = this.state.powerUps[key];
      if (p.activeSecondsRemaining > 0) {
        p.activeSecondsRemaining = Math.max(0, p.activeSecondsRemaining - dt);
        if (p.activeSecondsRemaining === 0 && key === "fda-coffee-break") {
          this.state.auditorState.isPaused = false;
          this.state.auditorState.behavior = "patrolling";
          this.addAuditLog(
            "☕ FDA Coffee Break ended. Auditor resumed inspection floor patrol.",
            "INFO"
          );
          this.emit("powerUpUpdate", { ...this.state.powerUps });
          this.emit("auditorUpdate", { ...this.state.auditorState });
        }
      }
    }

    // Tick subjects on conveyor
    const { updatedSubjects, expiredSubjects } = tickSubjectTimers(
      this.state.subjects,
      dt
    );
    this.state.subjects = updatedSubjects;

    if (expiredSubjects.length > 0) {
      expiredSubjects.forEach((exp) => {
        this.addAuditLog(
          `[AUDIT TIMEOUT] Subject ${exp.subjectLabel} expired unverified on conveyor! Auditor suspicion +20%`,
          "CRITICAL",
          20
        );
      });

      if (
        !this.state.auditorState.isPaused &&
        this.state.auditorState.behavior !== "coffee_break"
      ) {
        const nextSusp = Math.min(
          100,
          this.state.auditorState.suspicion + expiredSubjects.length * 20
        );
        this.state.auditorState.suspicion = nextSusp;
        this.state.auditorState.behavior =
          nextSusp >= 100 ? "issuing_483" : "suspicious";
      }

      this.state.scoreState.combo = 0;
      this.state.scoreState.multiplier = 1;
      this.state.scoreState.auditViolations += expiredSubjects.length;

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("auditorUpdate", { ...this.state.auditorState });
    }

    // Auditor patrol progression
    if (
      !this.state.auditorState.isPaused &&
      this.state.auditorState.behavior !== "coffee_break"
    ) {
      this.state.auditorState = tickAuditor(
        this.state.auditorState,
        dt,
        this.state.subjects.length
      );
      if (this.state.auditorState.suspicion >= 100) {
        this.emit("gameOver", {
          auditorState: this.state.auditorState,
          scoreState: this.state.scoreState,
        });
      }
      this.emit("auditorUpdate", { ...this.state.auditorState });
    }

    this.invalidateSnapshot();
  }

  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;

    // Conveyor Floor Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 760, 200);

    // Conveyor Belt
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(0, 80, 760, 40);

    // Auditor Indicator
    const audX = this.state.auditorState.x * 760;
    ctx.fillStyle =
      this.state.auditorState.behavior === "coffee_break"
        ? "#8b5cf6"
        : this.state.auditorState.suspicion >= 50
          ? "#ef4444"
          : "#f59e0b";
    ctx.fillRect(audX - 10, 30, 20, 30);
  }

  public override createSnapshot(): ClinicalTrialChaosSnapshot {
    return {
      scoreState: { ...this.state.scoreState },
      auditorState: { ...this.state.auditorState },
      powerUps: { ...this.state.powerUps },
      isPaused: this.state.isPaused,
      isModalPaused: this.state.isModalPaused,
      activeAmendment: this.state.activeAmendment
        ? { ...this.state.activeAmendment }
        : null,
      ruleViolationsCount: this.state.ruleViolations.length,
      subjectCount: this.state.subjects.length,
      submittedCount: this.state.submittedHistory.length,
      auditLogCount: this.state.auditLogs.length,
    };
  }
}
