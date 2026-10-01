import { ArcadeEngine } from "@/lib/arcade";
import type { StudyProtocol } from "../crf/types";
import {
  chargePowerUps,
  createAuditLogEntry,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  createInitialScoreState,
  isSubjectFullyCompliant,
  validateObservationChoice,
  verify21CFRSubmission,
} from "./engine";
import {
  adjustAuditorSuspicion,
  appendRuleViolation,
  applyCorrectionScore,
  applySubmissionScore,
  breakCombo,
  COFFEE_BREAK_END_LOG,
  COFFEE_BREAK_START_LOG,
  createRuleViolation,
  extendSubjectDeadlines,
  formatCorrectionLog,
  formatExpiryLog,
  formatRuleFailureLog,
  getSubmissionCharge,
  isShiftClockHalted,
  QUERY_EXTENSION_LOG,
  raiseAuditorSuspicion,
  replaceObservation,
  scoreSubmission,
  spendPowerUp,
  startCoffeeBreak,
  tickShiftClocks,
  EXPIRY_SUSPICION,
} from "./shift";
import { DEFAULT_STRESS_PARAMS, STRESS_PRESETS } from "./scenarios";
import type {
  AuditLogEntry,
  AuditorState,
  CDISCDomain,
  ClinicalSubject,
  GameScoreState,
  PowerUpInventory,
  PowerUpType,
  ProtocolAmendment,
  RecordedRuleViolation,
  SignatureReason,
  StressParameters,
  StressPresetId,
} from "./types";

export interface ClinicalTrialChaosState {
  scoreState: GameScoreState;
  auditorState: AuditorState;
  powerUps: PowerUpInventory;
  stressParams: StressParameters;
  isPaused: boolean;
  isModalPaused: boolean;
  /** The Field Manual is open, which holds the clocks still (#1672). */
  isManualOpen: boolean;
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

/**
 * Event-emitting wrapper around the Clinical Trial Chaos shift rules. Every
 * rule it applies comes from the same pure functions the player-facing
 * component uses (#901); this class only holds the state and emits events.
 */
export class ClinicalTrialChaosEngine extends ArcadeEngine<
  ClinicalTrialChaosState,
  ClinicalTrialChaosSnapshot
> {
  constructor(initialProtocol?: StudyProtocol | null) {
    super({
      scoreState: createInitialScoreState(),
      auditorState: createInitialAuditorState(),
      powerUps: createInitialPowerUpInventory(),
      stressParams: { ...DEFAULT_STRESS_PARAMS },
      isPaused: false,
      isModalPaused: false,
      isManualOpen: false,
      activeAmendment: null,
      ruleViolations: [],
      subjects: [],
      submittedHistory: [],
      activeProtocol: initialProtocol ?? null,
      auditLogs: [],
    });
  }

  public override init(): void {
    this.state.scoreState = createInitialScoreState();
    this.state.auditorState = createInitialAuditorState();
    this.state.powerUps = createInitialPowerUpInventory();
    this.state.stressParams = { ...DEFAULT_STRESS_PARAMS };
    this.state.isPaused = false;
    this.state.isModalPaused = false;
    this.state.isManualOpen = false;
    this.state.activeAmendment = null;
    this.state.ruleViolations = [];
    this.state.subjects = [];
    this.state.submittedHistory = [];
    this.state.auditLogs = [];
    this.notifySubscribers();
  }

  public setStressParameters(params: Partial<StressParameters>): void {
    this.state.stressParams = { ...this.state.stressParams, ...params };
    this.notifySubscribers();
  }

  public applyStressPreset(presetId: StressPresetId): void {
    const preset = STRESS_PRESETS[presetId];
    if (preset) {
      this.state.stressParams = { ...preset.params };
      this.notifySubscribers();
    }
  }

  public getState(): ClinicalTrialChaosState {
    return this.state;
  }

  public getStressParams(): StressParameters {
    return this.state.stressParams;
  }

  public setPaused(paused: boolean): void {
    this.state.isPaused = paused;
    this.notifySubscribers();
  }

  public setModalPause(paused: boolean): void {
    this.state.isModalPaused = paused;
    this.notifySubscribers();
  }

  public setManualOpen(open: boolean): void {
    this.state.isManualOpen = open;
    this.notifySubscribers();
  }

  public isModalPaused(): boolean {
    return this.state.isModalPaused;
  }

  public addSubject(subject: ClinicalSubject): void {
    this.state.subjects = [...this.state.subjects, subject];
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
      this.state.subjects = replaceObservation(
        this.state.subjects,
        subjectId,
        result.observation
      );
      this.state.scoreState = applyCorrectionScore(
        this.state.scoreState,
        result.scoreDelta
      );
      this.state.powerUps = chargePowerUps(this.state.powerUps, 1);

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("powerUpUpdate", { ...this.state.powerUps });
      this.addAuditLog(
        formatCorrectionLog(obs.field, choice, result.explanation),
        "COMPLIANT",
        result.suspicionDelta
      );
    } else {
      this.state.auditorState = raiseAuditorSuspicion(
        this.state.auditorState,
        result.suspicionDelta
      );
      this.state.ruleViolations = appendRuleViolation(
        this.state.ruleViolations,
        createRuleViolation(obs, choice, result, subject.subjectLabel)
      );

      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.addAuditLog(
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
      const submission = scoreSubmission(
        this.state.scoreState,
        subject,
        allClean
      );
      this.state.scoreState = applySubmissionScore(
        this.state.scoreState,
        submission,
        allClean
      );
      this.state.powerUps = chargePowerUps(
        this.state.powerUps,
        getSubmissionCharge(allClean)
      );
      this.state.auditorState = adjustAuditorSuspicion(
        this.state.auditorState,
        result.suspicionDelta
      );

      this.state.submittedHistory = [...this.state.submittedHistory, subject];
      this.state.subjects = this.state.subjects.filter(
        (s) => s.id !== subjectId
      );

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.emit("powerUpUpdate", { ...this.state.powerUps });
      this.emit("submissionVerified", { subject, targetStation, reason });
      this.addAuditLog(result.logMessage, "COMPLIANT", result.suspicionDelta);
    } else {
      this.state.scoreState = breakCombo(this.state.scoreState);
      this.state.auditorState = raiseAuditorSuspicion(
        this.state.auditorState,
        result.suspicionDelta
      );

      this.emit("scoreChange", { ...this.state.scoreState });
      this.emit("auditorUpdate", { ...this.state.auditorState });
      this.addAuditLog(result.logMessage, result.level, result.suspicionDelta);
    }

    this.notifySubscribers();
    return { success: result.success, logMessage: result.logMessage };
  }

  public activatePowerUp(id: PowerUpType, force = true): void {
    const p = this.state.powerUps[id];
    if (!p || (!force && p.charge < p.maxCharge)) return;

    this.state.powerUps = spendPowerUp(this.state.powerUps, id);
    if (id === "fda-coffee-break") {
      this.state.auditorState = startCoffeeBreak(this.state.auditorState);
      this.addAuditLog(COFFEE_BREAK_START_LOG, "COMPLIANT");
    } else if (id === "query-extension") {
      this.state.subjects = extendSubjectDeadlines(this.state.subjects);
      this.addAuditLog(QUERY_EXTENSION_LOG, "COMPLIANT");
    }
    this.emit("powerUpUpdate", { ...this.state.powerUps });
    this.emit("auditorUpdate", { ...this.state.auditorState });
    this.notifySubscribers();
  }

  public override update(dt: number): void {
    if (
      isShiftClockHalted({
        userPaused: this.state.isPaused,
        dialogOpen: this.state.isModalPaused,
        manualOpen: this.state.isManualOpen,
      })
    ) {
      return;
    }

    const tick = tickShiftClocks(
      {
        subjects: this.state.subjects,
        auditor: this.state.auditorState,
        scoreState: this.state.scoreState,
        powerUps: this.state.powerUps,
        amendment: this.state.activeAmendment,
      },
      dt
    );
    this.state.subjects = tick.subjects;
    this.state.auditorState = tick.auditor;
    this.state.scoreState = tick.scoreState;
    this.state.powerUps = tick.powerUps;
    this.state.activeAmendment = tick.amendment;

    for (const exp of tick.expired) {
      this.addAuditLog(formatExpiryLog(exp), "CRITICAL", EXPIRY_SUSPICION);
    }
    if (tick.expired.length > 0) {
      this.emit("scoreChange", { ...this.state.scoreState });
    }
    if (tick.coffeeBreakEnded) {
      this.addAuditLog(COFFEE_BREAK_END_LOG, "INFO");
      this.emit("powerUpUpdate", { ...this.state.powerUps });
    }
    if (tick.suspicionMaxed) {
      this.emit("gameOver", {
        auditorState: this.state.auditorState,
        scoreState: this.state.scoreState,
      });
    }
    this.emit("auditorUpdate", { ...this.state.auditorState });

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
