/**
 * Pure shift rules for Clinical Trial Chaos: observation corrections,
 * CRF submission scoring, campaign phase completion, lifelines and the
 * per-frame clocks.
 *
 * The player-facing component and `ClinicalTrialChaosEngine` both run the
 * game through these functions, so there is one implementation of each rule
 * (#901). Every function returns new values and never mutates its inputs;
 * anything time- or randomness-dependent takes the clock or random source as
 * a parameter.
 */
import type { StudyProtocol } from "../crf/types";
import { clamp } from "../game-utils";
import {
  calculateSubmissionPoints,
  fixObservation,
  generateBIMOReport,
  selectNextUrgentSubject,
  tickAuditor,
  tickPowerUps,
  tickSubjectTimers,
} from "./engine";
import {
  applySponsorSkeletonsToReport,
  SponsorEvent,
  SponsorSkeleton,
} from "./sponsor";
import type {
  AuditLogEntry,
  AuditorState,
  BIMOInspectionReport,
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
  StationConfig,
} from "./types";

/**
 * New CRFs to lock in each campaign phase before it is cleared. Each phase
 * counts its own locks from zero, so every phase asks for more than the last
 * (#1673); the campaign score and total still carry across phases (#1325).
 */
export const PHASE_TARGETS: Readonly<Record<GamePhase, number>> = {
  1: 5,
  2: 8,
  3: 12,
};

/** Suspicion a subject expiring on the conveyor adds to the auditor. */
export const EXPIRY_SUSPICION = 20;

/** Audit log line when the FDA Coffee Break lifeline starts. */
export const COFFEE_BREAK_START_LOG =
  "☕ [POWER-UP ACTIVATED] FDA Coffee Break! Auditor halted for 8 seconds.";

/** Audit log line when the FDA Coffee Break lifeline runs out. */
export const COFFEE_BREAK_END_LOG =
  "☕ FDA Coffee Break ended. Auditor resumed inspection floor patrol.";

/** Audit log line when the Site Query Extension lifeline fires. */
export const QUERY_EXTENSION_LOG =
  "⏱️ [POWER-UP ACTIVATED] Site Query Extension added +12s to all active conveyors.";

// --- Auditor & combo --------------------------------------------------------

/**
 * Score multiplier for a combo: one step per three consecutive clean
 * submissions, capped at 4x.
 *
 * @param combo - Consecutive successful submissions.
 * @returns The multiplier, from 1 to 4.
 */
export function getComboMultiplier(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 3));
}

/**
 * Raises auditor suspicion after a mistake, capped at 100. The auditor turns
 * suspicious, or starts writing a Form 483 once suspicion reaches 100.
 *
 * @param auditor - The auditor before the mistake.
 * @param delta - Suspicion to add, in percentage points.
 * @returns The updated auditor.
 */
export function raiseAuditorSuspicion(
  auditor: AuditorState,
  delta: number
): AuditorState {
  const suspicion = Math.min(100, auditor.suspicion + delta);
  return {
    ...auditor,
    suspicion,
    behavior: suspicion >= 100 ? "issuing_483" : "suspicious",
  };
}

/**
 * Applies a suspicion change that leaves the auditor's behavior alone,
 * floored at 0. A verified submission uses it with a negative delta.
 *
 * @param auditor - The auditor before the change.
 * @param delta - Suspicion to add (negative to cool the auditor down).
 * @returns The updated auditor.
 */
export function adjustAuditorSuspicion(
  auditor: AuditorState,
  delta: number
): AuditorState {
  return { ...auditor, suspicion: Math.max(0, auditor.suspicion + delta) };
}

/**
 * Breaks the combo after a rejected or expired CRF: the combo and multiplier
 * reset and each failure counts as an audit violation.
 *
 * @param score - The score state before the failure.
 * @param violations - Audit violations to record.
 * @returns The updated score state.
 */
export function breakCombo(
  score: GameScoreState,
  violations = 1
): GameScoreState {
  return {
    ...score,
    combo: 0,
    multiplier: 1,
    auditViolations: score.auditViolations + violations,
  };
}

/**
 * Records subjects that expired on the conveyor: the combo breaks, each
 * expiry counts as an audit violation, and the expired tally grows so the
 * report can name them as expiries rather than bad submissions (#1670).
 *
 * @param score - The score state before the expiries.
 * @param count - Subjects that expired.
 * @returns The updated score state.
 */
export function recordExpiredSubjects(
  score: GameScoreState,
  count: number
): GameScoreState {
  if (count <= 0) return score;
  return {
    ...breakCombo(score, count),
    expiredSubjects: score.expiredSubjects + count,
  };
}

/** A run's violations by kind, as the report and the end panel show them. */
export interface ViolationBreakdown {
  /** Subjects that expired on the conveyor before anyone locked them. */
  expired: number;
  /** CRFs a station rejected because they belong to another domain. */
  misrouted: number;
  /** Wrong answers picked in the fix dialog. */
  wrongFixes: number;
  /** All of the above. */
  total: number;
}

/**
 * Splits a run's violations by kind (#1670). Audit violations hold both the
 * expiries and the station rejections; wrong fixes are recorded separately.
 *
 * @param score - The score state to break down.
 * @param wrongFixes - Rule violations recorded for wrong fixes.
 * @returns The counts by kind and their total.
 */
export function getViolationBreakdown(
  score: GameScoreState,
  wrongFixes: number
): ViolationBreakdown {
  const expired = Math.min(score.auditViolations, score.expiredSubjects);
  const misrouted = score.auditViolations - expired;
  return {
    expired,
    misrouted,
    wrongFixes,
    total: expired + misrouted + wrongFixes,
  };
}

// --- Observation corrections ------------------------------------------------

/**
 * Credits a correct observation fix.
 *
 * @param score - The score state before the fix.
 * @param scoreDelta - Points the fix earns.
 * @returns The updated score state.
 */
export function applyCorrectionScore(
  score: GameScoreState,
  scoreDelta: number
): GameScoreState {
  return {
    ...score,
    score: score.score + scoreDelta,
    correctionsMade: score.correctionsMade + 1,
  };
}

/**
 * Swaps one observation on one subject for its corrected version.
 *
 * @param subjects - The conveyor queue.
 * @param subjectId - The subject that owns the observation.
 * @param observation - The corrected observation; matched by id.
 * @returns A new queue with the observation replaced.
 */
export function replaceObservation(
  subjects: ClinicalSubject[],
  subjectId: string,
  observation: ClinicalObservation
): ClinicalSubject[] {
  return subjects.map((sub) => {
    if (sub.id !== subjectId) return sub;
    return {
      ...sub,
      observations: sub.observations.map((o) =>
        o.id === observation.id ? observation : o
      ),
    };
  });
}

/**
 * Records a wrong fix for the end-of-run inspection report.
 *
 * @param observation - The observation the player tried to fix.
 * @param choice - The rejected answer.
 * @param result - The failed validation's explanation and rule name.
 * @param subjectLabel - Label of the subject the observation belongs to.
 * @param now - Epoch milliseconds for the id and timestamp.
 * @param random - Random source for the id suffix.
 * @returns The violation record.
 */
export function createRuleViolation(
  observation: ClinicalObservation,
  choice: string,
  result: { explanation: string; ruleName?: string },
  subjectLabel: string,
  now: number = Date.now(),
  random: () => number = Math.random
): RecordedRuleViolation {
  return {
    id: `viol_${now}_${random().toString(36).substring(2, 7)}`,
    type: observation.astRule ? "ast_edit_check" : "cdisc_conformance",
    subjectLabel,
    field: observation.field,
    selectedChoice: choice,
    ruleName: result.ruleName,
    message: result.explanation,
    domain: observation.destination,
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Appends a violation to a new array. The list is never pushed onto, so a
 * caller holding the previous array (a React state value, say) cannot record
 * the same wrong fix twice (#1553).
 *
 * @param violations - The violations recorded so far.
 * @param violation - The new violation.
 * @returns A new array ending with the violation.
 */
export function appendRuleViolation(
  violations: readonly RecordedRuleViolation[],
  violation: RecordedRuleViolation
): RecordedRuleViolation[] {
  return [...violations, violation];
}

/**
 * Audit log line for a correct observation fix.
 *
 * @param field - The observation's field name.
 * @param choice - The accepted answer.
 * @param explanation - Why it was accepted.
 * @returns The log message.
 */
export function formatCorrectionLog(
  field: string,
  choice: string,
  explanation: string
): string {
  return `Observation Standardized: ${field} -> '${choice}' [${explanation}]`;
}

/**
 * Audit log line for a wrong observation fix.
 *
 * @param field - The observation's field name.
 * @param choice - The rejected answer.
 * @param ruleName - The edit check that failed, if named.
 * @param suspicionDelta - Suspicion the mistake added.
 * @returns The log message.
 */
export function formatRuleFailureLog(
  field: string,
  choice: string,
  ruleName: string | undefined,
  suspicionDelta: number
): string {
  return `[AST RULE FAILURE] ${ruleName || "Edit check"} failed for ${field}: '${choice}'. Auditor Suspicion +${suspicionDelta}%`;
}

// --- Submission & phase completion ------------------------------------------

/** Points and combo a verified submission earns. */
export interface SubmissionScore {
  /** Points awarded, after any office adjustment. */
  points: number;
  /** Combo after this submission. */
  combo: number;
  /** Multiplier after this submission. */
  multiplier: number;
}

/**
 * Scores a verified submission against the score state it was made in: the
 * points use the multiplier the player had going in, then the combo grows.
 *
 * @param score - The score state before the submission.
 * @param subject - The submitted subject.
 * @param allClean - Whether every observation was resolved.
 * @param adjustPoints - Adjusts the points, for example for the office.
 * @returns The points, combo and multiplier.
 */
export function scoreSubmission(
  score: GameScoreState,
  subject: ClinicalSubject,
  allClean: boolean,
  adjustPoints: (points: number) => number = (points) => points
): SubmissionScore {
  const combo = score.combo + 1;
  return {
    points: adjustPoints(
      calculateSubmissionPoints(subject, score.multiplier, allClean)
    ),
    combo,
    multiplier: getComboMultiplier(combo),
  };
}

/**
 * Applies a scored submission to a score state.
 *
 * @param score - The score state to update.
 * @param submission - The result of `scoreSubmission`.
 * @param allClean - Whether the submission counts as clean.
 * @returns The updated score state.
 */
export function applySubmissionScore(
  score: GameScoreState,
  submission: SubmissionScore,
  allClean: boolean
): GameScoreState {
  const nextScore = score.score + submission.points;
  return {
    ...score,
    score: nextScore,
    highScore: Math.max(nextScore, score.highScore),
    combo: submission.combo,
    maxCombo: Math.max(score.maxCombo, submission.combo),
    multiplier: submission.multiplier,
    subjectsSubmitted: score.subjectsSubmitted + 1,
    phaseSubmissions: score.phaseSubmissions + 1,
    cleanSubmissions: allClean
      ? score.cleanSubmissions + 1
      : score.cleanSubmissions,
  };
}

/** A verified submission scored, applied and checked against the phase. */
export interface SettledSubmission {
  /** Points, combo and multiplier the submission earned. */
  submission: SubmissionScore;
  /** Score state after the submission, including its clean tally. */
  scoreState: GameScoreState;
  /** Whether the submission cleared the campaign phase. */
  phaseCleared: boolean;
}

/**
 * Scores a verified submission, applies it, and checks whether it clears the
 * phase. A phase-clear report must grade `scoreState`, the tallies after this
 * submission, so the final CRF's clean count is included (#1609).
 *
 * @param score - The score state before the submission.
 * @param subject - The submitted subject.
 * @param allClean - Whether every observation was resolved.
 * @param gameMode - The running mode.
 * @param phase - The running phase.
 * @param adjustPoints - Adjusts the points, for example for the office.
 * @returns The submission, the updated score state and the phase check.
 */
export function settleSubmission(
  score: GameScoreState,
  subject: ClinicalSubject,
  allClean: boolean,
  gameMode: GameMode,
  phase: GamePhase,
  adjustPoints: (points: number) => number = (points) => points
): SettledSubmission {
  const submission = scoreSubmission(score, subject, allClean, adjustPoints);
  return {
    submission,
    scoreState: applySubmissionScore(score, submission, allClean),
    phaseCleared: isPhaseCleared(gameMode, phase, score.phaseSubmissions),
  };
}

/**
 * Lifeline charge a verified submission earns, before any office adjustment.
 *
 * @param allClean - Whether the submission counts as clean.
 * @returns 2 for a clean submission, otherwise 1.
 */
export function getSubmissionCharge(allClean: boolean): number {
  return allClean ? 2 : 1;
}

/**
 * Counts a locked CRF at its station.
 *
 * @param stations - The active stations.
 * @param domain - The station the CRF was routed to.
 * @returns New stations with that station's count incremented.
 */
export function recordStationSubmission(
  stations: StationConfig[],
  domain: CDISCDomain
): StationConfig[] {
  return stations.map((s) =>
    s.id === domain ? { ...s, processedCount: s.processedCount + 1 } : s
  );
}

/**
 * Whether the submission being completed clears the campaign phase. Endless
 * mode has no phase target.
 *
 * @param gameMode - The running mode.
 * @param phase - The running phase.
 * @param submittedBefore - CRFs locked in this phase before this submission.
 * @returns True when this submission reaches the phase target.
 */
export function isPhaseCleared(
  gameMode: GameMode,
  phase: GamePhase,
  submittedBefore: number
): boolean {
  return gameMode === "campaign" && submittedBefore + 1 >= PHASE_TARGETS[phase];
}

/** Locks shown against the phase target in the header. */
export interface PhaseProgress {
  /** CRFs locked in this phase, or in the whole run in endless mode. */
  locked: number;
  /** This phase's target, or `null` in endless mode. */
  target: number | null;
}

/**
 * The header's lock counter: this phase's locks against this phase's target
 * (#1673). Endless mode has no target and counts every lock in the run.
 *
 * @param score - The running score state.
 * @param gameMode - The running mode.
 * @param phase - The running phase.
 * @returns The locked count and the target.
 */
export function getPhaseProgress(
  score: GameScoreState,
  gameMode: GameMode,
  phase: GamePhase
): PhaseProgress {
  if (gameMode !== "campaign") {
    return { locked: score.subjectsSubmitted, target: null };
  }
  return { locked: score.phaseSubmissions, target: PHASE_TARGETS[phase] };
}

/**
 * The dossier to load after a submission (#834): the most urgent subject
 * left in the queue, or none once the phase is cleared.
 *
 * @param queue - The conveyor queue, still holding the submitted subject.
 * @param submittedId - The subject just submitted.
 * @param phaseCleared - Whether the submission cleared the phase.
 * @returns The next subject, or null.
 */
export function selectNextDossier(
  queue: readonly ClinicalSubject[],
  submittedId: string,
  phaseCleared: boolean
): ClinicalSubject | null {
  if (phaseCleared) return null;
  return selectNextUrgentSubject(queue.filter((s) => s.id !== submittedId));
}

/**
 * The on-board cue announcing the auto-loaded dossier.
 *
 * @param subject - The dossier that was loaded.
 * @returns The cue text.
 */
export function formatNextDossierCue(subject: ClinicalSubject): string {
  return `Next dossier loaded: ${subject.subjectLabel}${
    subject.isSAE ? " (SAE)" : ""
  }`;
}

/**
 * The BIMO inspection report shown when a phase clears or the shift ends,
 * with the sponsor's skeletons added as findings.
 *
 * @param score - Score state the report grades.
 * @param auditor - Auditor state the report grades.
 * @param logs - Audit trail.
 * @param violations - Wrong fixes recorded during the shift.
 * @param protocol - The simulated study protocol, if any.
 * @param skeletons - Sponsor-pleasing shortcuts taken this shift.
 * @returns The inspection report.
 */
export function buildInspectionReport(
  score: GameScoreState,
  auditor: AuditorState,
  logs: AuditLogEntry[],
  violations: RecordedRuleViolation[],
  protocol: StudyProtocol | null,
  skeletons: readonly SponsorSkeleton[]
): BIMOInspectionReport {
  return applySponsorSkeletonsToReport(
    generateBIMOReport(score, auditor, logs, violations, protocol),
    skeletons
  );
}

// --- Lifelines --------------------------------------------------------------

/** Why a lifeline cannot fire right now. */
export type PowerUpRefusal =
  "charging" | "shift_stopped" | "no_dossier" | "nothing_to_clean";

/**
 * Why a lifeline cannot fire, or `null` when it can: it must be fully
 * charged and the shift running, and Auto-Clean and Fast-Track need an open
 * dossier with at least one flagged field, so their charge is never spent on
 * a CRF they cannot change (#1673).
 *
 * @param inventory - The lifeline inventory.
 * @param type - The lifeline to fire.
 * @param playing - Whether the shift is running.
 * @param activeSubject - The open dossier, if any.
 * @returns The reason it cannot fire, or null.
 */
export function getPowerUpRefusal(
  inventory: PowerUpInventory,
  type: PowerUpType,
  playing: boolean,
  activeSubject: Pick<ClinicalSubject, "observations"> | null
): PowerUpRefusal | null {
  const p = inventory[type];
  if (!p || p.charge < p.maxCharge) return "charging";
  if (!playing) return "shift_stopped";
  if (type === "auto-clean" || type === "fast-sign") {
    if (!activeSubject) return "no_dossier";
    if (activeSubject.observations.every((obs) => obs.isResolved)) {
      return "nothing_to_clean";
    }
  }
  return null;
}

/**
 * Whether a lifeline can fire. See `getPowerUpRefusal` for the rules.
 *
 * @param inventory - The lifeline inventory.
 * @param type - The lifeline to fire.
 * @param playing - Whether the shift is running.
 * @param activeSubject - The open dossier, if any.
 * @returns True when the lifeline can fire.
 */
export function canActivatePowerUp(
  inventory: PowerUpInventory,
  type: PowerUpType,
  playing: boolean,
  activeSubject: Pick<ClinicalSubject, "observations"> | null
): boolean {
  return getPowerUpRefusal(inventory, type, playing, activeSubject) === null;
}

/** Short tile labels for a refused lifeline. */
export const POWER_UP_REFUSAL_LABELS: Readonly<Record<PowerUpRefusal, string>> =
  {
    charging: "Charging",
    shift_stopped: "Shift stopped",
    no_dossier: "No dossier",
    nothing_to_clean: "Nothing to clean",
  };

/**
 * The announcement when a pressed lifeline is refused.
 *
 * @param refusal - Why it was refused.
 * @param name - The lifeline's display name.
 * @returns A sentence to announce.
 */
export function describePowerUpRefusal(
  refusal: PowerUpRefusal,
  name: string
): string {
  switch (refusal) {
    case "nothing_to_clean":
      return `${name} not used: nothing to clean on this dossier. Its charge is kept.`;
    case "no_dossier":
      return `${name} not used: no dossier is open.`;
    case "shift_stopped":
      return `${name} not used: the shift is not running.`;
    case "charging":
      return `${name} is still charging.`;
  }
}

/**
 * Empties a lifeline's charge and starts its duration.
 *
 * @param inventory - The lifeline inventory.
 * @param type - The lifeline that fired.
 * @returns The updated inventory.
 */
export function spendPowerUp(
  inventory: PowerUpInventory,
  type: PowerUpType
): PowerUpInventory {
  return {
    ...inventory,
    [type]: {
      ...inventory[type],
      charge: 0,
      activeSecondsRemaining: inventory[type].duration,
    },
  };
}

/**
 * Sends the auditor on a coffee break: patrol halts and suspicion drops 15.
 *
 * @param auditor - The auditor before the break.
 * @returns The auditor on break.
 */
export function startCoffeeBreak(auditor: AuditorState): AuditorState {
  return {
    ...auditor,
    behavior: "coffee_break",
    isPaused: true,
    suspicion: Math.max(0, auditor.suspicion - 15),
  };
}

/**
 * Brings the auditor back from a coffee break. The auditor resumes patrol
 * even when a wrong fix during the break made it suspicious, because that
 * auditor is still paused and would otherwise stay frozen for the rest of the
 * shift (#1610). An auditor already writing a Form 483 is left as it is: the
 * shift is ending.
 *
 * @param auditor - The auditor when the break runs out.
 * @returns The auditor back on patrol.
 */
export function endCoffeeBreak(auditor: AuditorState): AuditorState {
  if (auditor.behavior === "issuing_483") return auditor;
  return { ...auditor, behavior: "patrolling", isPaused: false };
}

/**
 * Site Query Extension: adds 12 seconds to every subject, capped at 10
 * seconds over its full time.
 *
 * @param subjects - The conveyor queue.
 * @returns The queue with extended deadlines.
 */
export function extendSubjectDeadlines(
  subjects: ClinicalSubject[]
): ClinicalSubject[] {
  return subjects.map((sub) => ({
    ...sub,
    timeRemaining: Math.min(sub.maxTime + 10, sub.timeRemaining + 12),
  }));
}

/**
 * CDISC Auto-Clean: resolves every observation on a subject.
 *
 * @param subject - The subject to clean.
 * @returns The cleaned subject.
 */
export function autoCleanSubject(subject: ClinicalSubject): ClinicalSubject {
  return {
    ...subject,
    observations: subject.observations.map(
      (obs) => fixObservation(obs).observation
    ),
  };
}

/**
 * The station a Fast-Track signature routes to: the first station on the
 * floor that one of the subject's observations belongs to, else the first
 * observation's domain, else DM.
 *
 * @param subject - The subject being signed.
 * @param stations - The active stations.
 * @returns The target domain.
 */
export function getFastTrackDomain(
  subject: ClinicalSubject,
  stations: StationConfig[]
): CDISCDomain {
  return (
    subject.observations.find((obs) =>
      stations.some((st) => st.id === obs.destination)
    )?.destination ??
    subject.observations[0]?.destination ??
    "DM"
  );
}

// --- Per-frame clocks -------------------------------------------------------

/** Longest frame the clocks advance in one step, in milliseconds. */
export const MAX_SHIFT_TICK_MS = 100;

/** What can hold the shift clocks still. */
export interface ShiftPauseState {
  /** The player paused the shift (P or the Pause button). */
  userPaused?: boolean;
  /** The Field Manual is open. */
  manualOpen?: boolean;
  /** A fix or signature dialog is open. */
  dialogOpen?: boolean;
  /** The first-shift calibration is running. */
  calibrating?: boolean;
}

/**
 * Whether the shift clocks are held still (#1672): a player pause, the Field
 * Manual, a fix or signature dialog, or calibration each stop every subject
 * timer, the auditor patrol, the sponsor drift and the lifeline durations.
 *
 * @param pause - What is currently open or paused.
 * @returns True when the clocks must not advance.
 */
export function isShiftClockHalted(pause: ShiftPauseState): boolean {
  return !!(
    pause.userPaused ||
    pause.manualOpen ||
    pause.dialogOpen ||
    pause.calibrating
  );
}

/**
 * Seconds a frame advances the shift clocks: none while halted, otherwise
 * the elapsed time clamped to `MAX_SHIFT_TICK_MS`.
 *
 * @param elapsedMs - Milliseconds since the previous frame.
 * @param halted - Whether the clocks are held still.
 * @returns Seconds to pass to `tickShiftClocks`.
 */
export function getShiftTickSeconds(
  elapsedMs: number,
  halted: boolean
): number {
  if (halted) return 0;
  return clamp(elapsedMs, 0, MAX_SHIFT_TICK_MS) / 1000;
}

/** The state the per-frame clocks advance. */
export interface ShiftClocks {
  subjects: ClinicalSubject[];
  auditor: AuditorState;
  scoreState: GameScoreState;
  powerUps: PowerUpInventory;
  amendment: ProtocolAmendment | null;
}

/** The advanced clocks plus what happened during the frame. */
export interface ShiftClockTick extends ShiftClocks {
  /** Subjects that ran out of time this frame, removed from `subjects`. */
  expired: ClinicalSubject[];
  /** Auditor suspicion reached 100 after the patrol step. */
  suspicionMaxed: boolean;
  /** The FDA Coffee Break lifeline ran out this frame. */
  coffeeBreakEnded: boolean;
  /** The amendment that concluded this frame, if any. */
  concludedAmendment: ProtocolAmendment | null;
  /** The running amendment's displayed whole second changed. */
  amendmentSecondChanged: boolean;
}

/**
 * Formats the audit log line for a subject that expired on the conveyor.
 *
 * @param subject - The expired subject.
 * @returns The log message.
 */
export function formatExpiryLog(subject: ClinicalSubject): string {
  return `[AUDIT TIMEOUT] Subject ${subject.subjectLabel} expired unverified on conveyor! Auditor suspicion +${EXPIRY_SUSPICION}%`;
}

/**
 * Advances the deterministic per-frame clocks by one step, in order: subject
 * deadlines (expiries raise suspicion and break the combo), the auditor
 * patrol, lifeline durations (the coffee break ending), and the running
 * protocol amendment. Spawning, random amendments and the sponsor inbox draw
 * on randomness and stay with the caller.
 *
 * @param clocks - The state before the frame.
 * @param deltaSeconds - Seconds to advance; 0 while a dialog pauses play.
 * @returns The state after the frame and what happened.
 */
export function tickShiftClocks(
  clocks: ShiftClocks,
  deltaSeconds: number
): ShiftClockTick {
  const { updatedSubjects: subjects, expiredSubjects: expired } =
    tickSubjectTimers(clocks.subjects, deltaSeconds);
  let { auditor, scoreState } = clocks;

  if (expired.length > 0) {
    if (!auditor.isPaused && auditor.behavior !== "coffee_break") {
      auditor = raiseAuditorSuspicion(
        auditor,
        expired.length * EXPIRY_SUSPICION
      );
    }
    scoreState = recordExpiredSubjects(scoreState, expired.length);
  }

  auditor = tickAuditor(auditor, deltaSeconds, subjects.length);
  const suspicionMaxed = auditor.suspicion >= 100;

  const powerUps = tickPowerUps(clocks.powerUps, deltaSeconds);
  const coffeeBreakEnded =
    clocks.powerUps["fda-coffee-break"].activeSecondsRemaining > 0 &&
    powerUps["fda-coffee-break"].activeSecondsRemaining === 0;
  if (coffeeBreakEnded) auditor = endCoffeeBreak(auditor);

  let amendment = clocks.amendment;
  let concludedAmendment: ProtocolAmendment | null = null;
  let amendmentSecondChanged = false;
  if (amendment && amendment.active) {
    const remaining = amendment.timeRemaining - deltaSeconds;
    if (remaining <= 0) {
      concludedAmendment = amendment;
      amendment = null;
    } else {
      amendmentSecondChanged =
        Math.ceil(remaining) !== Math.ceil(amendment.timeRemaining);
      amendment = { ...amendment, timeRemaining: remaining };
    }
  }

  return {
    subjects,
    auditor,
    scoreState,
    powerUps,
    amendment,
    expired,
    suspicionMaxed,
    coffeeBreakEnded,
    concludedAmendment,
    amendmentSecondChanged,
  };
}

// --- Phase pacing & shift events --------------------------------------------

/**
 * Seconds between random protocol amendments in a phase, before the office
 * adjusts it.
 *
 * @param phase - The running phase.
 * @returns 40, 28 or 20 seconds.
 */
export function getAmendmentIntervalSeconds(phase: GamePhase): number {
  return phase === 1 ? 40 : phase === 2 ? 28 : 20;
}

/**
 * Chance that a newly spawned subject carries a data error, before the office
 * adjusts it.
 *
 * @param phase - The running phase.
 * @returns A probability from 0 to 1.
 */
export function getSubjectErrorChance(phase: GamePhase): number {
  return phase === 1 ? 0.45 : phase === 2 ? 0.65 : 0.8;
}

/**
 * Chance that a newly spawned subject is a serious adverse event case.
 *
 * @param phase - The running phase.
 * @returns A probability from 0 to 1.
 */
export function getSAEChance(phase: GamePhase): number {
  return phase === 1 ? 0.1 : 0.3;
}

/** Audit log line filed when a shift ends, by the reason it ended. */
export const SHIFT_END_LOGS: Readonly<Record<"auditor" | "sponsor", string>> = {
  auditor:
    "[FDA NOTICE OF STUDY TERMINATION] 21 CFR Part 11 Audit Suspicion reached 100%. Form 483 Issued.",
  sponsor:
    "[CONTRACT TERMINATED] The sponsor has 'decided to go in a different direction' and moved the study to another CRO.",
};

/** How a sponsor inbox event is logged and sounded. */
export interface SponsorEventNotice {
  message: string;
  level: "WARN" | "CRITICAL";
  sound: "chute" | "error" | "alarm" | null;
}

/**
 * The audit log line, level and sound cue for a sponsor inbox event.
 *
 * @param event - The event from `tickSponsor`.
 * @returns How to report the event.
 */
export function describeSponsorEvent(event: SponsorEvent): SponsorEventNotice {
  switch (event.type) {
    case "request_arrived":
      return {
        message: `[SPONSOR] 📧 New email from ${event.request.from} (${event.request.role}): "${event.request.subject}"`,
        level: "WARN",
        sound: "chute",
      };
    case "follow_up":
      return {
        message: `[SPONSOR] 📧 ${event.request.from}: "${event.subjectLine}"`,
        level: "WARN",
        sound: "error",
      };
    case "request_dropped":
      return {
        message: `[SPONSOR] ${event.request.from} escalated "${event.request.subject}" to your manager's manager. Satisfaction ${event.moodDelta}%.`,
        level: "CRITICAL",
        sound: null,
      };
    case "contract_terminated":
      return {
        message: SHIFT_END_LOGS.sponsor,
        level: "CRITICAL",
        sound: "alarm",
      };
  }
}
