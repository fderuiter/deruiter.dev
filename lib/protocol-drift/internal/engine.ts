/**
 * The Protocol Drift simulation engine. It consumes PDCommand messages and
 * returns PDWorkerEvent messages, so a Web Worker and a test can drive it the
 * same way. The same seed and command sequence always produce the same
 * output, whatever the speed or how real time was sliced into ticks.
 */
import {
  AMENDMENT_NOTICE,
  DEFAULT_SEED,
  FULL_SUBMISSIONS,
  RANGE_LIMITS,
  SAVE_FORMAT,
  SITE_CLARIFICATIONS,
  SITE_IDS,
  SITE_PROFILES,
  SOURCE_WORKSHEETS,
  STUDY_ID,
  TRACER_SUBMISSIONS,
  WAVE_ENDS,
} from "../presets";
import type {
  ADaMVitalSignRecord,
  AuditActor,
  ClinicalQuery,
  DebtSummary,
  HeldPacket,
  Issue,
  IssueStatus,
  LockAuditResult,
  LockGateInput,
  PDCommand,
  PDWorkerEvent,
  PipelineGraph,
  ProtocolDriftSaveFile,
  ProtocolDriftView,
  RoutingRecord,
  SDTMMedicalHistoryRecord,
  SDTMVitalSignRecord,
  ScenarioId,
  SimSpeed,
  SimulationState,
  SiteId,
  SiteState,
  SourceRevision,
  SubmissionFixture,
  TraceViolation,
  UnmatchedEntry,
  VsTestCode,
  WaveIndex,
} from "../types";
import { pairAndDerive, snapshotHandoff, visitKey } from "./analysis";
import { AuditTrail, type AuditDraft } from "./audit";
import { formatDisplay, vsTestName } from "./chips";
import {
  STEP_MINUTES,
  accumulateRealTime,
  formatClock,
  isoToMinute,
  minuteAt,
  minuteToIso,
} from "./clock";
import {
  GOODWILL_RULES,
  clampGoodwill,
  responseLatencyHours,
  rubberStampProbability,
  simulateEntrySession,
} from "./coordinator";
import { resolvePartialDate } from "./debt";
import { EVENT_PRIORITY, EventQueue, type SimEvent } from "./event-queue";
import { ProtocolDriftStateError, transition } from "./fsm";
import {
  analysisLaneWired,
  compileGraph,
  validateGraph,
  type CompiledGraph,
} from "./graph";
import { buildDatasetExport } from "./export";
import { evaluateLockGate } from "./lock";
import { runPipeline, type IssueDraft } from "./pipeline";
import {
  ProtocolDriftWorkflowError,
  RUBBER_STAMP_RESPONSE,
  isIssueOpen,
  isQueryOpen,
  issueTransition,
  queryTransition,
} from "./queries";
import { hashValue, seededDraw } from "./rng";
import { buildScorecard } from "./scorecard";

/** Options for creating an engine. */
export interface ProtocolDriftEngineOptions {
  seed?: number;
  scenario?: ScenarioId;
}

/** A running Protocol Drift simulation. */
export interface ProtocolDriftEngine {
  /** Applies one command and returns the events it produced. */
  dispatch(command: PDCommand): PDWorkerEvent[];
  /** A deep copy of the current state. */
  view(): ProtocolDriftView;
  /** A stable hash of the ledgers, queries, issues and audit trail. */
  stateHash(): string;
  /** The accepted command log, as a save file would store it. */
  commandLog(): PDCommand[];
}

/** Thrown when a command is not allowed in the current situation. */
export class ProtocolDriftCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolDriftCommandError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const TEST_PAYLOAD_KEYS: Record<string, string[]> = {
  "SYSBP|SITTING": ["sbp", "sbp_sit"],
  "DIABP|SITTING": ["dbp", "dbp_sit"],
  "PULSE|SITTING": ["pulse"],
  "SYSBP|STANDING": ["sbp_stand"],
  "DIABP|STANDING": ["dbp_stand"],
};

const LOGGED_EXCLUDED = new Set<PDCommand["type"]>([
  "EXPORT_SAVE",
  "EXPORT_DATASETS",
]);

class Engine implements ProtocolDriftEngine {
  private seed: number;
  private scenario: ScenarioId;
  private fsm: SimulationState = "BRIEF";
  private minute = 0;
  private speed: SimSpeed = 1;
  private carry = 0;
  private completedWaves: WaveIndex[] = [];
  private amendmentAnnounced = false;
  private draftGraph: PipelineGraph = { nodes: [], edges: [] };
  private validatedGraphJson: string | null = null;
  private publishedGraph: PipelineGraph | null = null;
  private publishedRevisionId: string | null = null;
  private publishedIds = new Set<string>();
  private compiled: CompiledGraph | null = null;
  private sites = {} as Record<SiteId, SiteState>;
  private fixtures = new Map<string, SubmissionFixture>();
  private entered = new Map<string, Record<string, unknown>>();
  private attentionLog: ProtocolDriftView["attentionLog"] = [];
  private sourceLedger: SourceRevision[] = [];
  private currentRevision = new Map<string, SourceRevision>();
  private pendingRevisions = new Map<string, SourceRevision>();
  private pendingSource = new Map<string, string>();
  private vs: SDTMVitalSignRecord[] = [];
  private mh: SDTMMedicalHistoryRecord[] = [];
  private vsSeq = new Map<string, number>();
  private keyVersions = new Map<string, number>();
  private adam: ADaMVitalSignRecord[] = [];
  private unpaired: ADaMVitalSignRecord[] = [];
  private traceViolations: TraceViolation[] = [];
  private derivedVisits = new Map<string, string>();
  private held: HeldPacket[] = [];
  private unmatched: UnmatchedEntry[] = [];
  private issues = new Map<string, Issue>();
  private queries: ClinicalQuery[] = [];
  private queryGoodwill = new Map<string, number>();
  private audit = new AuditTrail();
  private routing = new Map<string, RoutingRecord>();
  private queue = new EventQueue();
  private seenIssueCodes = new Set<string>();
  private pauseReason: string | null = null;
  private collisionCount = 0;
  private applicabilityErrors = 0;
  private regexBeforeNarrative: boolean | null = null;
  private sleuthResolved = false;
  private lastLockAudit: LockAuditResult | null = null;
  private lockedAtMinute: number | null = null;
  private log: PDCommand[] = [];
  private events: PDWorkerEvent[] = [];

  constructor(seed: number, scenario: ScenarioId) {
    this.seed = seed;
    this.scenario = scenario;
    this.reset(seed, scenario);
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private reset(seed: number, scenario: ScenarioId): void {
    Object.assign(this, new Engine.Blank());
    this.seed = seed;
    this.scenario = scenario;
    for (const id of SITE_IDS) {
      const profile = SITE_PROFILES[id];
      this.sites[id] = {
        siteId: id,
        goodwill: profile.initialGoodwill,
        attention: 100,
        version: "v1",
        latencyHours: responseLatencyHours(
          profile.baseLatencyHours,
          profile.initialGoodwill
        ),
        openQueries: 0,
      };
    }
    const fixtures =
      scenario === "tracer" ? TRACER_SUBMISSIONS : FULL_SUBMISSIONS;
    const sessions = new Map<string, SubmissionFixture[]>();
    for (const f of fixtures) {
      this.fixtures.set(f.submissionId, f);
      sessions.set(f.sessionId, [...(sessions.get(f.sessionId) ?? []), f]);
    }
    for (const subs of sessions.values()) {
      const session = simulateEntrySession(subs, seed);
      for (const [id, payload] of session.entered)
        this.entered.set(id, payload);
      this.attentionLog.push(...session.steps);
    }
    for (const f of fixtures) {
      if (f.kind === "VS") {
        this.queue.push(
          isoToMinute(f.assessedAt),
          EVENT_PRIORITY.SCHEDULED_VISIT,
          "SCHEDULED_VISIT",
          f.submissionId
        );
      }
      this.queue.push(
        isoToMinute(f.submittedAt),
        EVENT_PRIORITY.SOURCE_SUBMISSION,
        "SOURCE_SUBMISSION",
        f.submissionId
      );
    }
    const waves: WaveIndex[] = scenario === "tracer" ? [1] : [1, 2, 3];
    for (const w of waves) {
      const end = WAVE_ENDS[w];
      this.queue.push(
        minuteAt(end.day, end.hour, end.minute),
        EVENT_PRIORITY.RECONCILIATION,
        "WAVE_END",
        String(w)
      );
    }
    if (scenario === "full") {
      this.queue.push(
        minuteAt(AMENDMENT_NOTICE.day, AMENDMENT_NOTICE.hour),
        EVENT_PRIORITY.SITE_ACTIVATION,
        "AMENDMENT_NOTICE",
        "AMENDMENT-01"
      );
      for (const id of SITE_IDS) {
        this.queue.push(
          minuteAt(SITE_PROFILES[id].amendmentActivationDay),
          EVENT_PRIORITY.SITE_ACTIVATION,
          "SITE_ACTIVATION",
          id
        );
      }
    }
  }

  /** Field defaults; reset() copies a fresh instance of these onto the engine. */
  private static Blank = class {
    fsm: SimulationState = "BRIEF";
    minute = 0;
    speed: SimSpeed = 1;
    carry = 0;
    completedWaves: WaveIndex[] = [];
    amendmentAnnounced = false;
    draftGraph: PipelineGraph = { nodes: [], edges: [] };
    validatedGraphJson: string | null = null;
    publishedGraph: PipelineGraph | null = null;
    publishedRevisionId: string | null = null;
    publishedIds = new Set<string>();
    compiled: CompiledGraph | null = null;
    sites = {} as Record<SiteId, SiteState>;
    fixtures = new Map<string, SubmissionFixture>();
    entered = new Map<string, Record<string, unknown>>();
    attentionLog: ProtocolDriftView["attentionLog"] = [];
    sourceLedger: SourceRevision[] = [];
    currentRevision = new Map<string, SourceRevision>();
    pendingRevisions = new Map<string, SourceRevision>();
    pendingSource = new Map<string, string>();
    vs: SDTMVitalSignRecord[] = [];
    mh: SDTMMedicalHistoryRecord[] = [];
    vsSeq = new Map<string, number>();
    keyVersions = new Map<string, number>();
    adam: ADaMVitalSignRecord[] = [];
    unpaired: ADaMVitalSignRecord[] = [];
    traceViolations: TraceViolation[] = [];
    derivedVisits = new Map<string, string>();
    held: HeldPacket[] = [];
    unmatched: UnmatchedEntry[] = [];
    issues = new Map<string, Issue>();
    queries: ClinicalQuery[] = [];
    queryGoodwill = new Map<string, number>();
    audit = new AuditTrail();
    routing = new Map<string, RoutingRecord>();
    queue = new EventQueue();
    seenIssueCodes = new Set<string>();
    pauseReason: string | null = null;
    collisionCount = 0;
    applicabilityErrors = 0;
    regexBeforeNarrative: boolean | null = null;
    sleuthResolved = false;
    lastLockAudit: LockAuditResult | null = null;
    lockedAtMinute: number | null = null;
    log: PDCommand[] = [];
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  dispatch(command: PDCommand): PDWorkerEvent[] {
    this.events = [];
    let accepted = true;
    try {
      this.handle(command);
    } catch (error) {
      if (
        error instanceof ProtocolDriftStateError ||
        error instanceof ProtocolDriftWorkflowError ||
        error instanceof ProtocolDriftCommandError
      ) {
        accepted = false;
        this.events.push({
          type: "COMMAND_REJECTED",
          command: command.type,
          reason: error.message,
        });
      } else {
        throw error;
      }
    }
    this.pauseReason = null;
    if (accepted && !LOGGED_EXCLUDED.has(command.type)) {
      if (command.type === "INIT") this.log = [];
      this.logCommand(command);
    }
    this.events.push(this.snapshot());
    return this.events;
  }

  view(): ProtocolDriftView {
    return clone({
      seed: this.seed,
      scenario: this.scenario,
      minute: this.minute,
      fsmState: this.fsm,
      speed: this.speed,
      waveIndex: this.currentWave(),
      completedWaves: this.completedWaves,
      amendmentAnnounced: this.amendmentAnnounced,
      draftGraph: this.draftGraph,
      publishedRevisionId: this.publishedRevisionId,
      publishedGraph: this.publishedGraph,
      sites: this.sites,
      sourceLedger: this.sourceLedger,
      vsLedger: this.vs,
      mhLedger: this.mh,
      adamRows: this.adam,
      unpaired: this.unpaired,
      traceViolations: this.traceViolations,
      held: this.held,
      unmatched: this.unmatched,
      issues: Array.from(this.issues.values()),
      queries: this.queries,
      auditTrail: [...this.audit.list()],
      attentionLog: this.attentionLog,
      debt: this.debt(),
      routing: Array.from(this.routing.values()),
      lastLockAudit: this.lastLockAudit,
    });
  }

  stateHash(): string {
    return hashValue({
      minute: this.minute,
      fsm: this.fsm,
      vs: this.vs,
      mh: this.mh,
      adam: this.adam,
      unpaired: this.unpaired,
      issues: Array.from(this.issues.values()),
      queries: this.queries,
      audit: this.audit.list(),
      sites: this.sites,
    });
  }

  commandLog(): PDCommand[] {
    return clone(this.log);
  }

  // -------------------------------------------------------------------------
  // Command handling
  // -------------------------------------------------------------------------

  private logCommand(command: PDCommand): void {
    const last = this.log[this.log.length - 1];
    if (command.type === "TICK" && last?.type === "TICK") {
      last.realMs += command.realMs;
      return;
    }
    this.log.push(clone(command));
  }

  private require(condition: boolean, message: string): void {
    if (!condition) throw new ProtocolDriftCommandError(message);
  }

  private to(next: SimulationState): void {
    this.fsm = transition(this.fsm, next);
  }

  private notLocked(): void {
    this.require(this.fsm !== "LOCKED", "Database locked: the study is frozen");
  }

  private handle(command: PDCommand): void {
    switch (command.type) {
      case "INIT":
        this.reset(command.seed, command.scenario ?? this.scenario);
        return;
      case "ACCEPT_BRIEF":
        this.to("DRAFT");
        return;
      case "SET_SPEED":
        this.notLocked();
        this.require(
          [1, 2, 5].includes(command.speed),
          "Speed must be 1, 2 or 5"
        );
        this.speed = command.speed;
        return;
      case "SET_PAUSED":
        this.setPaused(command.isPaused);
        return;
      case "STEP_TICK":
        this.notLocked();
        this.require(
          this.fsm === "PAUSED",
          `Step requires PAUSED, not ${this.fsm}`
        );
        this.advanceTo(this.minute + STEP_MINUTES);
        return;
      case "TICK": {
        if (this.fsm !== "RUNNING") return;
        const step = accumulateRealTime(this.carry, command.realMs, this.speed);
        this.carry = step.carry;
        this.advanceTo(this.minute + step.minutes);
        return;
      }
      case "ADVANCE_TO":
        this.notLocked();
        this.require(
          this.fsm === "PAUSED" || this.fsm === "RUNNING",
          `Clock is frozen in ${this.fsm}`
        );
        this.require(
          command.minute >= this.minute,
          "Cannot move the clock backwards"
        );
        this.advanceTo(command.minute);
        return;
      case "LOAD_GRAPH":
        this.notLocked();
        this.enterDraft();
        this.draftGraph = clone({ nodes: command.nodes, edges: command.edges });
        this.validatedGraphJson = null;
        return;
      case "VALIDATE_GRAPH":
        this.validate({ nodes: command.nodes, edges: command.edges });
        return;
      case "PUBLISH_REVISION":
        this.publish(command.revisionId, {
          nodes: command.nodes,
          edges: command.edges,
        });
        return;
      case "DRAFT_QUERY":
        this.draftQuery(
          command.issueId,
          command.evidenceLinked,
          command.message
        );
        return;
      case "SEND_QUERY":
        this.sendQuery(command.queryId);
        return;
      case "CANCEL_QUERY": {
        const q = this.query(command.queryId);
        this.require(
          q.communicationState === "Draft",
          "Only drafts can be cancelled"
        );
        q.communicationState = queryTransition(q.communicationState, "Closed");
        this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
        return;
      }
      case "CLOSE_QUERY":
        this.closeQuery(command.queryId);
        return;
      case "ACCEPT_CORRECTION":
        this.acceptCorrection(command.issueId);
        return;
      case "ACCEPT_UNCERTAINTY":
        this.acceptUncertainty(command.issueId);
        return;
      case "REJECT_RESPONSE": {
        this.workflowAllowed();
        const issue = this.issue(command.issueId);
        issue.status = issueTransition(issue.status, "Open");
        if (issue.pendingRevisionId)
          this.pendingRevisions.delete(issue.pendingRevisionId);
        delete issue.pendingRevisionId;
        this.events.push({ type: "ISSUE_UPDATED", issue: clone(issue) });
        return;
      }
      case "SITE_SOURCE_CORRECTION":
        this.siteCorrection(
          command.submissionId,
          command.payload,
          command.reason
        );
        return;
      case "REPLAY_SUBMISSIONS":
        this.replaySubmissions(command.submissionIds);
        return;
      case "REPLAY_DERIVATIONS":
        this.replayDerivations();
        return;
      case "REQUEST_LOCK":
        this.to("LOCK_REVIEW");
        this.evaluateLock();
        return;
      case "RETURN_TO_WORKBENCH":
        this.require(this.fsm === "LOCK_REVIEW", "Not in lock review");
        this.to("PAUSED");
        return;
      case "CONFIRM_LOCK":
        this.confirmLock();
        return;
      case "EXPORT_SAVE":
        this.events.push({
          type: "SAVE_EXPORTED",
          save: this.buildSave(command.savedAt),
        });
        return;
      case "EXPORT_DATASETS":
        this.events.push({
          type: "DATASETS_EXPORTED",
          bundle: buildDatasetExport({
            vs: this.vs,
            mh: this.mh,
            adam: this.adam,
            unpaired: this.unpaired,
            audit: this.audit.list(),
          }),
        });
        return;
    }
  }

  private setPaused(isPaused: boolean): void {
    this.notLocked();
    if (isPaused) {
      if (this.fsm === "PAUSED") return;
      this.require(
        this.fsm === "RUNNING" || this.fsm === "WAVE_REVIEW",
        `Cannot pause from ${this.fsm}`
      );
      this.to("PAUSED");
      this.carry = 0;
      return;
    }
    if (this.fsm === "RUNNING") return;
    this.require(
      this.publishedRevisionId !== null,
      "Publish a revision before running"
    );
    this.to("RUNNING");
  }

  private enterDraft(): void {
    if (this.fsm === "DRAFT") return;
    this.require(
      ["VALIDATE", "DEPLOY_READY", "PAUSED", "WAVE_REVIEW"].includes(this.fsm),
      `Cannot edit the pipeline in ${this.fsm}`
    );
    this.to("DRAFT");
  }

  private validate(graph: PipelineGraph): void {
    this.notLocked();
    this.enterDraft();
    this.to("VALIDATE");
    const result = validateGraph(graph, {
      amendmentAnnounced: this.amendmentAnnounced,
    });
    const clamped = { nodes: result.clampedNodes, edges: clone(graph.edges) };
    this.draftGraph = clamped;
    this.events.push({
      type: "VALIDATION_RESULT",
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    });
    if (result.valid) {
      this.validatedGraphJson = JSON.stringify(clamped);
      this.to("DEPLOY_READY");
    } else {
      this.validatedGraphJson = null;
    }
  }

  private publish(revisionId: string, graph: PipelineGraph): void {
    this.require(
      this.fsm === "DEPLOY_READY",
      `Publish requires DEPLOY_READY, not ${this.fsm}`
    );
    this.require(
      !this.publishedIds.has(revisionId),
      `Revision ${revisionId} already published`
    );
    const result = validateGraph(graph, {
      amendmentAnnounced: this.amendmentAnnounced,
    });
    const clamped = { nodes: result.clampedNodes, edges: clone(graph.edges) };
    this.require(
      result.valid && JSON.stringify(clamped) === this.validatedGraphJson,
      "Graph changed since validation: run Local Test again"
    );
    this.to("PAUSED");
    this.publishedGraph = clamped;
    this.publishedRevisionId = revisionId;
    this.publishedIds.add(revisionId);
    this.compiled = compileGraph(clamped);
    this.appendAudit({
      type: "REVISION_PUBLISHED",
      subjectId: STUDY_ID,
      visit: "",
      variable: "pipeline",
      oldValue: null,
      newValue: revisionId,
      actor: "DATA_ARCHITECT",
      reason: `Published pipeline revision ${revisionId}`,
    });
    this.events.push({ type: "REVISION_PUBLISHED", revisionId });
    this.syncAnalysis();
  }

  // -------------------------------------------------------------------------
  // Clock
  // -------------------------------------------------------------------------

  private advanceTo(target: number): void {
    for (;;) {
      const next = this.queue.peek();
      if (!next || next.minute > target) break;
      this.queue.pop();
      if (next.minute > this.minute) this.minute = next.minute;
      this.runEvent(next);
      if (this.fsm === "WAVE_REVIEW") {
        this.carry = 0;
        return;
      }
      if (this.pauseReason) {
        if (this.fsm === "RUNNING") this.to("PAUSED");
        this.events.push({ type: "AUTO_PAUSED", reason: this.pauseReason });
        this.pauseReason = null;
        this.carry = 0;
        return;
      }
    }
    if (target > this.minute) this.minute = target;
  }

  private runEvent(event: SimEvent): void {
    switch (event.kind) {
      case "AMENDMENT_NOTICE":
        this.amendmentAnnounced = true;
        this.appendAudit({
          type: "AMENDMENT_ANNOUNCED",
          subjectId: STUDY_ID,
          visit: "",
          variable: "protocol",
          oldValue: "v1",
          newValue: "v2",
          actor: "SIMULATION_ENGINE",
          reason:
            "Sponsor Amendment 01: collect standing blood pressure at applicable visits after site activation",
        });
        this.pauseReason = "AMENDMENT_01";
        return;
      case "SITE_ACTIVATION": {
        const site = this.sites[event.ref as SiteId];
        site.version = "v2";
        this.appendAudit({
          type: "SITE_ACTIVATED",
          subjectId: event.ref,
          visit: "",
          variable: "protocolVersion",
          oldValue: "v1",
          newValue: "v2",
          actor: "SIMULATION_ENGINE",
          reason: `IRB activation of Amendment 01 at ${event.ref}`,
        });
        return;
      }
      case "SCHEDULED_VISIT":
        return;
      case "SOURCE_SUBMISSION":
        this.receiveSubmission(event.ref);
        return;
      case "PIPELINE_PROCESSING": {
        const rev = this.sourceLedger.find(
          (r) => r.sourceRevisionId === event.ref
        );
        if (rev) this.processRevision(rev);
        return;
      }
      case "QUERY_SEND":
        this.querySendEvent(event.ref);
        return;
      case "QUERY_RESPONSE":
        this.queryResponse(event.ref);
        return;
      case "WAVE_END":
        this.completeWave(Number(event.ref) as WaveIndex);
        return;
    }
  }

  private currentWave(): WaveIndex {
    for (const w of [1, 2, 3] as WaveIndex[]) {
      if (!this.completedWaves.includes(w)) return w;
    }
    return 3;
  }

  private completeWave(wave: WaveIndex): void {
    this.completedWaves.push(wave);
    const prior =
      wave === 1
        ? 0
        : this.vs.filter(
            (r) =>
              !r.superseded &&
              this.fixtures.get(r.submissionId)?.waveIndex !== wave
          ).length;
    const current = this.vs.filter((r) => !r.superseded);
    this.to("WAVE_REVIEW");
    this.events.push({
      type: "WAVE_COMPLETED",
      waveIndex: wave,
      summary: {
        waveIndex: wave,
        vsRecords: current.length,
        mhRecords: this.mh.filter((r) => !r.superseded).length,
        newVsRecords: current.length - prior,
        confirmedRecords: current.filter(
          (r) => r.epistemicStatus === "CONFIRMED"
        ).length,
        openIssues: Array.from(this.issues.values()).filter((i) =>
          isIssueOpen(i.status)
        ).length,
        openQueries: this.queries.filter((q) =>
          isQueryOpen(q.communicationState)
        ).length,
        debt: this.debt(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Source ledger and pipeline
  // -------------------------------------------------------------------------

  private receiveSubmission(submissionId: string): void {
    const f = this.fixtures.get(submissionId) as SubmissionFixture;
    const payload = this.entered.get(submissionId) ?? f.payload;
    const rev = this.addRevision(
      f,
      payload,
      "SITE_COORDINATOR",
      "Initial eCRF submission"
    );
    const steps = this.attentionLog.filter(
      (s) => s.submissionId === submissionId
    );
    if (steps.length > 0) {
      this.sites[f.siteId].attention = steps[steps.length - 1].attentionAfter;
    }
    this.queue.push(
      this.minute,
      EVENT_PRIORITY.PIPELINE_PROCESSING,
      "PIPELINE_PROCESSING",
      rev.sourceRevisionId
    );
  }

  private addRevision(
    f: SubmissionFixture,
    payload: Record<string, unknown>,
    actor: AuditActor,
    reason: string,
    pending = false
  ): SourceRevision {
    const count =
      this.sourceLedger.filter((r) => r.submissionId === f.submissionId)
        .length +
      Array.from(this.pendingRevisions.values()).filter(
        (r) => r.submissionId === f.submissionId
      ).length;
    const revision = count + 1;
    const rev: SourceRevision = Object.freeze({
      sourceRevisionId: `${f.submissionId.replace(/^sub-/, "rev-")}-r${revision}`,
      submissionId: f.submissionId,
      revision,
      siteId: f.siteId,
      subjectId: f.subjectId,
      kind: f.kind,
      visitDay: f.visitDay,
      assessedAt: f.assessedAt,
      submittedAt: revision === 1 ? f.submittedAt : minuteToIso(this.minute),
      formVersion: f.formVersion,
      payload: Object.freeze({ ...payload }),
      actor,
      reason,
      receivedAtMinute: this.minute,
    });
    if (pending) {
      this.pendingRevisions.set(rev.sourceRevisionId, rev);
      return rev;
    }
    this.commitRevision(rev);
    return rev;
  }

  private commitRevision(rev: SourceRevision): void {
    this.sourceLedger.push(rev);
    this.currentRevision.set(rev.submissionId, rev);
    this.appendAudit({
      type: "SOURCE_RECEIVED",
      subjectId: rev.subjectId,
      visit: rev.kind === "MH" ? "Baseline MH" : `Day ${rev.visitDay}`,
      variable: rev.sourceRevisionId,
      oldValue: null,
      newValue: rev.payload,
      actor: rev.actor,
      reason: rev.reason,
    });
  }

  private processRevision(rev: SourceRevision): void {
    if (!this.compiled) return;
    const result = runPipeline({
      revision: rev,
      graph: this.compiled,
      activationMinute: minuteAt(
        SITE_PROFILES[rev.siteId].amendmentActivationDay
      ),
    });
    for (const packet of result.dispatched) {
      this.events.push({ type: "PACKET_DISPATCHED", packet });
    }
    if (
      rev.submissionId === "sub-a01-d07" &&
      this.regexBeforeNarrative === null
    ) {
      this.regexBeforeNarrative = result.regexSplitUsed;
    }
    if (result.routing) {
      this.routing.set(rev.submissionId, result.routing);
      if (result.routing.handle === "review") {
        this.applicabilityErrors += 1;
        if (result.routing.routedBy === "submittedAt") {
          const site = this.sites[rev.siteId];
          site.goodwill = clampGoodwill(
            site.goodwill + GOODWILL_RULES.hardStop
          );
          this.refreshLatency(rev.siteId);
        }
      }
    }

    this.held = this.held.filter((h) => h.submissionId !== rev.submissionId);
    this.unmatched = this.unmatched.filter(
      (u) => u.submissionId !== rev.submissionId
    );
    const raised = new Set<string>();
    const raise = (draft: IssueDraft): string => {
      const id = this.raiseIssue(rev, draft);
      raised.add(id);
      return id;
    };

    for (const issue of result.issues) raise(issue);
    result.held.forEach((h, i) => {
      const issueId = h.issue ? raise(h.issue) : undefined;
      const held: HeldPacket = {
        heldId: `hold-${rev.sourceRevisionId}-${i + 1}`,
        submissionId: rev.submissionId,
        sourceRevisionId: rev.sourceRevisionId,
        nodeId: h.nodeId,
        handle: h.handle,
        reason: h.reason,
        ...(issueId ? { issueId } : {}),
        ...(h.value !== undefined ? { value: h.value } : {}),
        ...(h.loss ? { loss: true } : {}),
      };
      this.held.push(held);
      this.events.push({ type: "PACKET_HELD", held: clone(held) });
    });
    result.unmatched.forEach((u, i) => {
      const issueId = raise(u.issue);
      this.unmatched.push({
        unmatchedId: `unm-${rev.sourceRevisionId}-${i + 1}`,
        submissionId: rev.submissionId,
        sourceRevisionId: rev.sourceRevisionId,
        nodeId: u.nodeId,
        text: u.text,
        issueId,
      });
    });

    if (rev.kind === "VS") {
      this.commitObservations(rev, result.observations, raise);
    } else {
      this.commitMh(rev, result.mh, raise);
    }

    for (const issue of this.issues.values()) {
      if (
        issue.submissionId === rev.submissionId &&
        (issue.status === "Open" || issue.status === "AwaitingEvidence") &&
        !raised.has(issue.issueId)
      ) {
        this.setIssueStatus(
          issue,
          "Resolved",
          "Condition cleared when the source was reprocessed"
        );
      }
    }
    this.syncAnalysis();
  }

  private raiseIssue(rev: SourceRevision, draft: IssueDraft): string {
    const issueId = `iss-${draft.code}-${rev.submissionId}-${draft.targetField}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
    const existing = this.issues.get(issueId);
    if (existing) {
      if (draft.evidence && !existing.evidence)
        existing.evidence = draft.evidence;
      return issueId;
    }
    const issue: Issue = {
      issueId,
      code: draft.code,
      origin: draft.origin,
      status: draft.code === "PARTIAL_DATE" ? "ReadyForReview" : "Open",
      siteId: rev.siteId,
      subjectId: rev.subjectId,
      visitDay: rev.visitDay,
      submissionId: rev.submissionId,
      targetField: draft.targetField,
      message: draft.message,
      detectedAtMinute: this.minute,
      ...(draft.evidence ? { evidence: draft.evidence } : {}),
      ...(rev.submissionId === "sub-b01-d14" && draft.code === "OUT_OF_RANGE"
        ? { scriptedStampOnGeneric: true }
        : {}),
    };
    this.issues.set(issueId, issue);
    this.appendAudit({
      type: "ISSUE_RAISED",
      subjectId: rev.subjectId,
      visit: rev.kind === "MH" ? "Baseline MH" : `Day ${rev.visitDay}`,
      variable: draft.targetField,
      oldValue: null,
      newValue: draft.code,
      actor: "SIMULATION_ENGINE",
      reason: draft.message,
    });
    this.events.push({ type: "ISSUE_UPDATED", issue: clone(issue) });
    if (!this.seenIssueCodes.has(draft.code)) {
      this.seenIssueCodes.add(draft.code);
      this.pauseReason = `NEW_ISSUE_CATEGORY:${draft.code}`;
    }
    return issueId;
  }

  private worksheetEvidence(
    rev: SourceRevision,
    testcd: VsTestCode,
    pos: string
  ): string | undefined {
    const f = this.fixtures.get(rev.submissionId);
    if (!f) return undefined;
    for (const k of TEST_PAYLOAD_KEYS[`${testcd}|${pos}`] ?? []) {
      if (
        k in f.payload &&
        k in rev.payload &&
        f.payload[k] !== rev.payload[k]
      ) {
        const sheet = SOURCE_WORKSHEETS[rev.submissionId];
        const unit = testcd === "PULSE" ? "beats/min" : "mmHg";
        return `Scanned worksheet clip${sheet ? ` (${sheet.hospital}, ${sheet.clinician})` : ""}: ${testcd} ${String(f.payload[k])} ${unit}; eCRF entry ${String(rev.payload[k])}`;
      }
    }
    return undefined;
  }

  private commitObservations(
    rev: SourceRevision,
    drafts: ReturnType<typeof runPipeline>["observations"],
    raise: (d: IssueDraft) => string
  ): void {
    const seen = new Set<string>();
    const f = this.fixtures.get(rev.submissionId) as SubmissionFixture;
    for (const draft of drafts) {
      const key = `${rev.subjectId}|${rev.visitDay}|${draft.VSTESTCD}|${draft.VSPOS}`;
      const existing = this.vs.find(
        (r) =>
          !r.superseded &&
          r.USUBJID === rev.subjectId &&
          r.VISITNUM === rev.visitDay &&
          r.VSTESTCD === draft.VSTESTCD &&
          r.VSPOS === draft.VSPOS
      );
      if (
        seen.has(key) ||
        (existing && existing.submissionId !== rev.submissionId)
      ) {
        this.collisionCount += 1;
        const message = `Unique key collision on (USUBJID, VISITNUM, VSTESTCD, VSPOS) = (${rev.subjectId}, ${rev.visitDay}, ${draft.VSTESTCD}, ${draft.VSPOS}); packet held, nothing overwritten`;
        const issueId = raise({
          code: "POSITION_COLLISION",
          origin: "pipeline",
          targetField: `${draft.VSTESTCD}/${draft.VSPOS}`,
          message,
        });
        const held: HeldPacket = {
          heldId: `hold-${rev.sourceRevisionId}-collision-${this.collisionCount}`,
          submissionId: rev.submissionId,
          sourceRevisionId: rev.sourceRevisionId,
          nodeId: "CDISCSink",
          handle: "obs_in",
          reason: message,
          issueId,
          value: draft.VSORRES,
        };
        this.held.push(held);
        this.events.push({ type: "PACKET_HELD", held: clone(held) });
        this.appendAudit({
          type: "COLLISION_REJECTED",
          subjectId: rev.subjectId,
          visit: `Day ${rev.visitDay}`,
          variable: `${draft.VSTESTCD}/${draft.VSPOS}`,
          oldValue: existing?.VSORRES ?? null,
          newValue: draft.VSORRES,
          actor: "SIMULATION_ENGINE",
          reason: message,
        });
        continue;
      }
      seen.add(key);
      const seq = existing ? existing.VSSEQ : this.nextSeq(rev.subjectId);
      const version = (this.keyVersions.get(key) ?? 0) + 1;
      const record: SDTMVitalSignRecord = {
        recordId: `vs:${rev.subjectId}:${seq}:v${version}`,
        STUDYID: STUDY_ID,
        DOMAIN: "VS",
        USUBJID: rev.subjectId,
        VSSEQ: seq,
        VSTESTCD: draft.VSTESTCD,
        VSTEST: vsTestName(draft.VSTESTCD),
        VSORRES: draft.VSORRES,
        VSORRESU: draft.VSORRESU,
        VSSTRESC: formatDisplay(draft.VSSTRESN, draft.precision),
        VSSTRESN: draft.VSSTRESN,
        VSSTRESU: draft.VSSTRESU,
        VSPOS: draft.VSPOS,
        VISIT: `Day ${rev.visitDay}`,
        VISITNUM: rev.visitDay,
        VSDTC: draft.VSDTC,
        EPOCH: rev.visitDay === 0 ? "BASELINE" : "TREATMENT",
        epistemicStatus: draft.status,
        sourceRevisionId: rev.sourceRevisionId,
        superseded: false,
        submissionId: rev.submissionId,
        siteId: rev.siteId,
        protocolVersion: f.formVersion,
        pipelineRevisionId: this.publishedRevisionId ?? "",
        precision: draft.precision,
        insertedAtMinute: this.minute,
        ...(draft.lossNote ? { lossNote: draft.lossNote } : {}),
      };
      if (existing && this.sameVs(existing, record)) {
        this.checkRange(rev, existing, raise);
        continue;
      }
      this.keyVersions.set(key, version);
      if (existing) {
        const idx = this.vs.indexOf(existing);
        const old: SDTMVitalSignRecord = Object.freeze({
          ...existing,
          superseded: true,
          supersededBy: record.recordId,
        });
        this.vs[idx] = old;
        this.appendAudit({
          type: "SOURCE_RECORD_SUPERSEDED",
          subjectId: rev.subjectId,
          visit: `Day ${rev.visitDay}`,
          variable:
            existing.VSSTRESN !== record.VSSTRESN
              ? "VSSTRESN"
              : "sourceRevisionId",
          oldValue:
            existing.VSSTRESN !== record.VSSTRESN
              ? existing.VSSTRESN
              : existing.sourceRevisionId,
          newValue:
            existing.VSSTRESN !== record.VSSTRESN
              ? record.VSSTRESN
              : record.sourceRevisionId,
          actor: rev.actor,
          reason: rev.reason,
          ...(this.pendingSource.has(rev.sourceRevisionId)
            ? { queryThreadId: this.pendingSource.get(rev.sourceRevisionId) }
            : {}),
        });
        this.events.push({
          type: "RECORD_SUPERSEDED",
          previous: clone(old),
          next: clone(record),
        });
      }
      const frozen = Object.freeze(record);
      this.vs.push(frozen);
      this.events.push({ type: "RECORD_TABULATED", record: clone(frozen) });
      this.checkRange(rev, frozen, raise);
    }
  }

  private checkRange(
    rev: SourceRevision,
    record: SDTMVitalSignRecord,
    raise: (d: IssueDraft) => string
  ): void {
    const limits = RANGE_LIMITS[record.VSTESTCD];
    const v = record.VSSTRESN;
    if (Number.isFinite(v) && v >= limits.low && v <= limits.high) return;
    const evidence = this.worksheetEvidence(rev, record.VSTESTCD, record.VSPOS);
    raise({
      code: "OUT_OF_RANGE",
      origin:
        evidence || record.epistemicStatus !== "LOSS" ? "source" : "pipeline",
      targetField: `${record.VSTESTCD}/${record.VSPOS}`,
      message: `${record.VSTESTCD} ${record.VSSTRESC} ${record.VSSTRESU} outside ${limits.low}-${limits.high}`,
      ...(evidence ? { evidence } : {}),
    });
  }

  private sameVs(a: SDTMVitalSignRecord, b: SDTMVitalSignRecord): boolean {
    return (
      a.VSORRES === b.VSORRES &&
      a.VSORRESU === b.VSORRESU &&
      a.VSSTRESN === b.VSSTRESN &&
      a.VSSTRESU === b.VSSTRESU &&
      a.VSDTC === b.VSDTC &&
      a.epistemicStatus === b.epistemicStatus &&
      a.sourceRevisionId === b.sourceRevisionId &&
      a.precision === b.precision
    );
  }

  private nextSeq(usubjid: string): number {
    const next = (this.vsSeq.get(usubjid) ?? 0) + 1;
    this.vsSeq.set(usubjid, next);
    return next;
  }

  private commitMh(
    rev: SourceRevision,
    drafts: ReturnType<typeof runPipeline>["mh"],
    raise: (d: IssueDraft) => string
  ): void {
    for (const draft of drafts.slice(0, 1)) {
      const partial = resolvePartialDate(draft.MHSTDTC, "preserve");
      const status =
        draft.status === "CONFIRMED" && partial.status === "UNCERTAIN"
          ? "UNCERTAIN"
          : draft.status;
      const existing = this.mh.find(
        (r) => !r.superseded && r.submissionId === rev.submissionId
      );
      const seq = existing
        ? existing.MHSEQ
        : this.mh.filter((r) => !r.superseded && r.USUBJID === rev.subjectId)
            .length + 1;
      const version =
        this.mh.filter((r) => r.submissionId === rev.submissionId).length + 1;
      const record: SDTMMedicalHistoryRecord = {
        recordId: `mh:${rev.subjectId}:${seq}:v${version}`,
        STUDYID: STUDY_ID,
        DOMAIN: "MH",
        USUBJID: rev.subjectId,
        MHSEQ: seq,
        MHTERM: draft.MHTERM,
        MHDECOD: draft.MHDECOD,
        MHCAT: draft.MHCAT,
        MHSTDTC: draft.MHSTDTC,
        MHENRTPT: "ONGOING",
        epistemicStatus: status,
        fabricatedBits: draft.fabricatedBits,
        sourceRevisionId: rev.sourceRevisionId,
        superseded: false,
        submissionId: rev.submissionId,
        siteId: rev.siteId,
        pipelineRevisionId: this.publishedRevisionId ?? "",
        insertedAtMinute: this.minute,
      };
      if (status === "UNCERTAIN") {
        raise({
          code: "PARTIAL_DATE",
          origin: "source",
          targetField: "MHSTDTC",
          message: `Onset ${draft.MHSTDTC} collected at month precision; day unknown (CDASH 3.6 permits partial dates)`,
          evidence: `Source onset recorded as ${draft.MHSTDTC}`,
        });
      }
      if (
        existing &&
        existing.MHSTDTC === record.MHSTDTC &&
        existing.epistemicStatus === record.epistemicStatus &&
        existing.sourceRevisionId === record.sourceRevisionId &&
        existing.MHTERM === record.MHTERM
      ) {
        continue;
      }
      if (existing) {
        const idx = this.mh.indexOf(existing);
        const old = Object.freeze({
          ...existing,
          superseded: true,
          supersededBy: record.recordId,
        });
        this.mh[idx] = old;
        this.appendAudit({
          type: "SOURCE_RECORD_SUPERSEDED",
          subjectId: rev.subjectId,
          visit: "Baseline MH",
          variable: "MHSTDTC",
          oldValue: existing.MHSTDTC,
          newValue: record.MHSTDTC,
          actor: rev.actor,
          reason: rev.reason,
        });
        this.events.push({
          type: "RECORD_SUPERSEDED",
          previous: clone(old),
          next: clone(record),
        });
      }
      const frozen = Object.freeze(record);
      this.mh.push(frozen);
      this.events.push({ type: "MH_TABULATED", record: clone(frozen) });
    }
  }

  // -------------------------------------------------------------------------
  // Analysis lane
  // -------------------------------------------------------------------------

  private syncAnalysis(): void {
    if (!this.compiled) return;
    const lane = analysisLaneWired(this.compiled);
    if (!lane.wired || !lane.pairNode) return;
    const snapshot = snapshotHandoff(this.vs);
    const joinKey =
      lane.pairNode.data?.joinKey === "subject" ? "subject" : "visit";
    const derived = pairAndDerive(snapshot, { joinKey });
    this.traceViolations = derived.traceViolations;
    const idLists = new Map<string, string[]>();
    for (const r of snapshot) {
      const k = visitKey(r.USUBJID, r.VISITNUM);
      idLists.set(k, [...(idLists.get(k) ?? []), r.recordId]);
    }
    const idsByVisit = new Map<string, string>();
    for (const [k, list] of idLists)
      idsByVisit.set(k, [...list].sort().join(","));
    const staleIds: string[] = [];
    for (const [k, ids] of idsByVisit) {
      const existing = this.derivedVisits.get(k);
      const rowsFor = (rows: ADaMVitalSignRecord[]) =>
        rows.filter((r) => visitKey(r.USUBJID, r.AVISITN) === k);
      if (existing === undefined) {
        this.derivedVisits.set(k, ids);
        for (const row of rowsFor(derived.adamRows)) {
          this.adam.push(row);
          this.events.push({ type: "ADAM_DERIVED", row: clone(row) });
        }
        for (const row of rowsFor(derived.unpaired)) {
          this.unpaired.push(row);
          this.events.push({ type: "ADAM_DERIVED", row: clone(row) });
        }
      } else if (existing !== ids) {
        for (const row of [...rowsFor(this.adam), ...rowsFor(this.unpaired)]) {
          if (!row.stale) {
            row.stale = true;
            staleIds.push(row.rowId);
          }
        }
      }
    }
    if (staleIds.length > 0) {
      this.events.push({ type: "DERIVATION_STALE", rowIds: staleIds });
      this.appendAudit({
        type: "DERIVATION_STALE",
        subjectId: STUDY_ID,
        visit: "",
        variable: "ADVS",
        oldValue: null,
        newValue: staleIds,
        actor: "SIMULATION_ENGINE",
        reason:
          "Upstream SDTM source changed after derivation; replay required",
      });
    }
  }

  private replayDerivations(): void {
    this.require(
      this.fsm === "PAUSED" || this.fsm === "WAVE_REVIEW",
      `Replay requires PAUSED or WAVE_REVIEW, not ${this.fsm}`
    );
    const staleVisits = new Set(
      [...this.adam, ...this.unpaired]
        .filter((r) => r.stale)
        .map((r) => visitKey(r.USUBJID, r.AVISITN))
    );
    if (staleVisits.size === 0) return;
    const keep = (r: ADaMVitalSignRecord) =>
      !staleVisits.has(visitKey(r.USUBJID, r.AVISITN));
    this.adam = this.adam.filter(keep);
    this.unpaired = this.unpaired.filter(keep);
    for (const k of staleVisits) this.derivedVisits.delete(k);
    this.syncAnalysis();
    this.appendAudit({
      type: "DERIVATIONS_REPLAYED",
      subjectId: STUDY_ID,
      visit: "",
      variable: "ADVS",
      oldValue: null,
      newValue: Array.from(staleVisits),
      actor: "DATA_ARCHITECT",
      reason: "Analysis re-run against the current SDTM snapshot",
    });
  }

  private replaySubmissions(ids?: string[]): void {
    this.require(
      this.fsm === "PAUSED" || this.fsm === "WAVE_REVIEW",
      `Replay requires PAUSED or WAVE_REVIEW, not ${this.fsm}`
    );
    this.require(this.compiled !== null, "Publish a revision before replaying");
    const targets = ids
      ? ids.map((id) => {
          const rev = this.currentRevision.get(id);
          this.require(
            rev !== undefined,
            `Unknown or unreceived submission ${id}`
          );
          return rev as SourceRevision;
        })
      : Array.from(this.currentRevision.values());
    for (const rev of targets) this.processRevision(rev);
  }

  // -------------------------------------------------------------------------
  // Queries and issues
  // -------------------------------------------------------------------------

  private workflowAllowed(): void {
    this.require(
      !["BRIEF", "LOCK_REVIEW", "LOCKED"].includes(this.fsm),
      `Query and issue actions are unavailable in ${this.fsm}`
    );
  }

  private issue(issueId: string): Issue {
    const issue = this.issues.get(issueId);
    this.require(issue !== undefined, `Unknown issue ${issueId}`);
    return issue as Issue;
  }

  private query(queryId: string): ClinicalQuery {
    const q = this.queries.find((x) => x.queryId === queryId);
    this.require(q !== undefined, `Unknown query ${queryId}`);
    return q as ClinicalQuery;
  }

  private setIssueStatus(
    issue: Issue,
    next: IssueStatus,
    resolution?: string
  ): void {
    issue.status = issueTransition(issue.status, next);
    if (resolution) issue.resolution = resolution;
    if (next === "Resolved") {
      this.appendAudit({
        type: "ISSUE_RESOLVED",
        subjectId: issue.subjectId,
        visit: `Day ${issue.visitDay}`,
        variable: issue.targetField,
        oldValue: issue.code,
        newValue: "Resolved",
        actor: resolution?.startsWith("Condition cleared")
          ? "SIMULATION_ENGINE"
          : "DATA_ARCHITECT",
        reason: resolution ?? "Resolved",
      });
    }
    this.events.push({ type: "ISSUE_UPDATED", issue: clone(issue) });
  }

  private refreshLatency(siteId: SiteId): void {
    const site = this.sites[siteId];
    site.latencyHours = responseLatencyHours(
      SITE_PROFILES[siteId].baseLatencyHours,
      site.goodwill
    );
    site.openQueries = this.queries.filter(
      (q) => q.siteId === siteId && isQueryOpen(q.communicationState)
    ).length;
  }

  private draftQuery(
    issueId: string,
    evidenceLinked: boolean,
    message?: string
  ): void {
    this.workflowAllowed();
    const issue = this.issue(issueId);
    this.require(
      isIssueOpen(issue.status),
      `Issue ${issueId} is already ${issue.status}`
    );
    this.require(
      !evidenceLinked || issue.evidence !== undefined,
      "No source evidence is available to attach to this query"
    );
    const queryId = `qry-${String(this.queries.length + 1).padStart(4, "0")}`;
    const text =
      message ??
      (evidenceLinked
        ? `${issue.message}. Attached source evidence: ${issue.evidence}. Please reconcile against source documents and issue a correction or explanation.`
        : `Please confirm ${issue.targetField} for ${issue.subjectId} Day ${issue.visitDay}.`);
    const q: ClinicalQuery = {
      queryId,
      issueId,
      siteId: issue.siteId,
      subjectId: issue.subjectId,
      visitDay: issue.visitDay,
      targetField: issue.targetField,
      communicationState: "Draft",
      isEvidenceLinked: evidenceLinked,
      ...(evidenceLinked ? { attachedEvidenceSnippet: issue.evidence } : {}),
      messageSent: text,
      sentAtMinute: -1,
      expectedResponseMinute: -1,
      goodwillCost: 0,
      duplicate: false,
      rubberStamped: false,
      latencyHours: this.sites[issue.siteId].latencyHours,
    };
    this.queries.push(q);
    this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
  }

  private sendQuery(queryId: string): void {
    this.workflowAllowed();
    const q = this.query(queryId);
    this.require(
      q.communicationState === "Draft",
      `Query ${queryId} is ${q.communicationState}`
    );
    const site = this.sites[q.siteId];
    const duplicate = this.queries.some(
      (x) =>
        x.queryId !== q.queryId &&
        x.issueId === q.issueId &&
        (x.communicationState === "Queued" ||
          x.communicationState === "AwaitingResponse")
    );
    q.sentAtMinute = this.minute;
    if (duplicate) {
      q.duplicate = true;
      q.goodwillCost = GOODWILL_RULES.duplicateQuery;
      site.goodwill = clampGoodwill(
        site.goodwill + GOODWILL_RULES.duplicateQuery
      );
      q.communicationState = queryTransition(q.communicationState, "Closed");
    } else {
      q.latencyHours = responseLatencyHours(
        SITE_PROFILES[q.siteId].baseLatencyHours,
        site.goodwill
      );
      this.queryGoodwill.set(q.queryId, site.goodwill);
      q.goodwillCost = GOODWILL_RULES.distinctQuery;
      site.goodwill = clampGoodwill(
        site.goodwill + GOODWILL_RULES.distinctQuery
      );
      q.communicationState = queryTransition(q.communicationState, "Queued");
      const issue = this.issue(q.issueId);
      if (q.isEvidenceLinked && issue.status === "Open") {
        this.setIssueStatus(issue, "AwaitingEvidence");
      }
      this.queue.push(
        this.minute,
        EVENT_PRIORITY.QUERY_RESPONSE,
        "QUERY_SEND",
        q.queryId
      );
    }
    this.refreshLatency(q.siteId);
    this.appendAudit({
      type: "QUERY_ISSUED",
      subjectId: q.subjectId,
      visit: `Day ${q.visitDay}`,
      variable: q.targetField,
      oldValue: null,
      newValue: q.messageSent,
      actor: "DATA_ARCHITECT",
      reason: duplicate
        ? "Duplicate query: no parallel response is created"
        : q.isEvidenceLinked
          ? "Evidence-linked query"
          : "Generic query",
      queryThreadId: q.queryId,
    });
    this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
  }

  private querySendEvent(queryId: string): void {
    const q = this.query(queryId);
    q.communicationState = queryTransition(
      q.communicationState,
      "AwaitingResponse"
    );
    q.expectedResponseMinute = this.minute + q.latencyHours * 60;
    this.queue.push(
      q.expectedResponseMinute,
      EVENT_PRIORITY.QUERY_RESPONSE,
      "QUERY_RESPONSE",
      q.queryId
    );
    this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
  }

  private queryResponse(queryId: string): void {
    const q = this.query(queryId);
    const issue = this.issue(q.issueId);
    q.communicationState = queryTransition(q.communicationState, "Answered");
    const g =
      this.queryGoodwill.get(q.queryId) ?? this.sites[q.siteId].goodwill;
    let stamped = false;
    if (!q.isEvidenceLinked) {
      stamped =
        issue.scriptedStampOnGeneric === true ||
        seededDraw(
          this.seed,
          `${q.siteId}|${q.subjectId}|${q.visitDay}|${q.targetField}|stamp|${q.queryId}`
        ) < rubberStampProbability(g);
    }
    if (stamped) {
      q.rubberStamped = true;
      q.responseReceived = RUBBER_STAMP_RESPONSE;
    } else if (isIssueOpen(issue.status)) {
      const f = this.fixtures.get(issue.submissionId);
      const current = this.currentRevision.get(issue.submissionId);
      const differs =
        f &&
        current &&
        JSON.stringify(f.payload) !== JSON.stringify(current.payload);
      if (f && differs) {
        const rev = this.addRevision(
          f,
          f.payload,
          "SITE_COORDINATOR",
          "Data entry keying transposition corrected against paper source worksheet",
          true
        );
        this.pendingSource.set(rev.sourceRevisionId, q.queryId);
        issue.pendingRevisionId = rev.sourceRevisionId;
        q.responseReceived = `Amended source record ${rev.sourceRevisionId} submitted after review of the paper worksheet.`;
      } else {
        q.responseReceived =
          SITE_CLARIFICATIONS[issue.submissionId] ??
          "Value verified against source documents; no change.";
      }
      if (issue.status === "Open" || issue.status === "AwaitingEvidence") {
        this.setIssueStatus(issue, "ReadyForReview");
      }
    } else {
      q.responseReceived = "Acknowledged; the issue was already dispositioned.";
    }
    this.refreshLatency(q.siteId);
    this.appendAudit({
      type: "QUERY_ANSWERED",
      subjectId: q.subjectId,
      visit: `Day ${q.visitDay}`,
      variable: q.targetField,
      oldValue: null,
      newValue: q.responseReceived,
      actor: "SITE_COORDINATOR",
      reason: stamped
        ? "Generic query answered without source verification"
        : "Site response received",
      queryThreadId: q.queryId,
    });
    this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
  }

  private closeQuery(queryId: string): void {
    this.workflowAllowed();
    const q = this.query(queryId);
    q.communicationState = queryTransition(q.communicationState, "Closed");
    this.refreshLatency(q.siteId);
    this.appendAudit({
      type: "QUERY_CLOSED",
      subjectId: q.subjectId,
      visit: `Day ${q.visitDay}`,
      variable: q.targetField,
      oldValue: "Answered",
      newValue: "Closed",
      actor: "DATA_ARCHITECT",
      reason: "Thread closed by the data architect",
      queryThreadId: q.queryId,
    });
    this.events.push({ type: "QUERY_UPDATED", query: clone(q) });
  }

  private acceptCorrection(issueId: string): void {
    this.workflowAllowed();
    const issue = this.issue(issueId);
    this.require(
      issue.status === "ReadyForReview",
      `Issue ${issueId} is ${issue.status}`
    );
    this.require(
      issue.code !== "PARTIAL_DATE",
      "Partial dates are dispositioned with ACCEPT_UNCERTAINTY"
    );
    const pendingId = issue.pendingRevisionId;
    const pending = pendingId
      ? this.pendingRevisions.get(pendingId)
      : undefined;
    this.setIssueStatus(
      issue,
      "Resolved",
      pending
        ? `Source correction ${pending.sourceRevisionId} accepted`
        : "Site response accepted after review"
    );
    if (issue.origin === "source") {
      const site = this.sites[issue.siteId];
      site.goodwill = clampGoodwill(
        site.goodwill + GOODWILL_RULES.resolvedDiscrepancy,
        SITE_PROFILES[issue.siteId].initialGoodwill
      );
      this.refreshLatency(issue.siteId);
    }
    if (pending && pendingId) {
      this.pendingRevisions.delete(pendingId);
      delete issue.pendingRevisionId;
      const q = this.queries.find(
        (x) => x.queryId === this.pendingSource.get(pendingId)
      );
      if (
        issue.submissionId === "sub-b01-d14" &&
        issue.code === "OUT_OF_RANGE" &&
        q?.isEvidenceLinked
      ) {
        this.sleuthResolved = true;
      }
      this.commitRevision(pending);
      if (this.compiled) this.processRevision(pending);
    }
  }

  private acceptUncertainty(issueId: string): void {
    this.workflowAllowed();
    const issue = this.issue(issueId);
    this.require(
      issue.code === "PARTIAL_DATE",
      "Only partial dates are a permitted documented uncertainty"
    );
    this.setIssueStatus(
      issue,
      "AcceptedUncertainty",
      "Accepted as documented uncertainty under CDASH 3.6"
    );
    this.appendAudit({
      type: "UNCERTAINTY_ACCEPTED",
      subjectId: issue.subjectId,
      visit: "Baseline MH",
      variable: issue.targetField,
      oldValue: null,
      newValue: "AcceptedUncertainty",
      actor: "DATA_ARCHITECT",
      reason:
        "Partial date retained at collected precision (CDASH 3.6); no day imputed",
    });
  }

  private siteCorrection(
    submissionId: string,
    payload: Record<string, unknown>,
    reason: string
  ): void {
    this.workflowAllowed();
    const f = this.fixtures.get(submissionId);
    this.require(
      f !== undefined && this.currentRevision.has(submissionId),
      `Submission ${submissionId} has not been received`
    );
    const rev = this.addRevision(
      f as SubmissionFixture,
      payload,
      "SITE_COORDINATOR",
      reason
    );
    this.processRevision(rev);
  }

  // -------------------------------------------------------------------------
  // Debt, lock, save
  // -------------------------------------------------------------------------

  private debt(): DebtSummary {
    const vs = this.vs.filter((r) => !r.superseded);
    const mh = this.mh.filter((r) => !r.superseded);
    const openUnmatched = this.unmatched.filter((u) => {
      const issue = this.issues.get(u.issueId);
      return issue ? isIssueOpen(issue.status) : true;
    });
    return {
      fabricatedBits: mh.reduce((sum, r) => sum + r.fabricatedBits, 0),
      semanticLossCount:
        vs.filter((r) => r.epistemicStatus === "LOSS").length +
        this.held.filter((h) => h.loss === true).length +
        openUnmatched.length,
      uncertainCount:
        vs.filter((r) => r.epistemicStatus === "UNCERTAIN").length +
        mh.filter((r) => r.epistemicStatus === "UNCERTAIN").length,
      traceBreaks: this.traceViolations.length,
      collisionCount: this.collisionCount,
    };
  }

  private lockInput(): LockGateInput {
    return clone({
      vsRecords: this.vs,
      mhRecords: this.mh,
      adamRows: this.adam,
      unpaired: this.unpaired,
      issues: Array.from(this.issues.values()),
      queries: this.queries,
      held: this.held,
      unmatched: this.unmatched.filter((u) => {
        const issue = this.issues.get(u.issueId);
        return issue ? isIssueOpen(issue.status) : true;
      }),
      traceViolations: this.traceViolations,
      debt: this.debt(),
    });
  }

  private evaluateLock(): LockAuditResult {
    const result = evaluateLockGate(this.lockInput());
    this.lastLockAudit = result;
    this.appendAudit({
      type: "LOCK_GATE_EVALUATED",
      subjectId: STUDY_ID,
      visit: "",
      variable: "lock",
      oldValue: null,
      newValue: {
        canLock: result.canLock,
        failures: result.discrepancies.map((d) => d.code),
      },
      actor: "SIMULATION_ENGINE",
      reason: "Dual database lock gate evaluated",
    });
    this.events.push({ type: "LOCK_AUDIT", result: clone(result) });
    return result;
  }

  private confirmLock(): void {
    this.require(
      this.fsm === "LOCK_REVIEW",
      `Confirm requires LOCK_REVIEW, not ${this.fsm}`
    );
    const result = this.evaluateLock();
    this.require(result.canLock, "Lock gate has failing checks");
    this.to("LOCKED");
    this.lockedAtMinute = this.minute;
    this.appendAudit({
      type: "DATABASE_LOCKED",
      subjectId: STUDY_ID,
      visit: "",
      variable: "lock",
      oldValue: null,
      newValue: "LOCKED",
      actor: "DATA_ARCHITECT",
      reason: "Both regulatory gates cleared; final snapshot approved",
    });
    const b24 = ["sub-b01-d24", "sub-b02-d24"].map((id) =>
      this.routing.get(id)
    );
    this.events.push({
      type: "LOCKED",
      scorecard: buildScorecard({
        lockedAtMinute: this.minute,
        queries: this.queries,
        sites: this.sites,
        regexSplitBeforeNarrative: this.regexBeforeNarrative === true,
        sleuthResolvedWithEvidence: this.sleuthResolved,
        lateBacklogRoutedV1: b24.every((r) => r?.handle === "v1"),
        applicabilityErrors: this.applicabilityErrors,
        integrityPassed: result.canLock,
      }),
    });
  }

  private buildSave(savedAt?: string): ProtocolDriftSaveFile {
    const sites: ProtocolDriftSaveFile["sites"] = {};
    for (const id of SITE_IDS) {
      const s = this.sites[id];
      sites[id] = {
        goodwill: s.goodwill,
        attention: s.attention,
        version: s.version,
      };
    }
    return clone({
      format: SAVE_FORMAT,
      version: 1,
      savedAt: savedAt ?? minuteToIso(this.minute),
      seed: this.seed,
      scenario: this.scenario,
      fsmState: this.fsm,
      clock: {
        minute: this.minute,
        speed: this.speed,
        isPaused: this.fsm !== "RUNNING",
      },
      graph: this.publishedGraph ?? this.draftGraph,
      sites,
      sdtmLedger: this.vs,
      mhLedger: this.mh,
      adamLedger: this.adam,
      queries: this.queries,
      auditTrail: [...this.audit.list()],
      commands: this.log,
      stateHash: this.stateHash(),
    });
  }

  private appendAudit(draft: AuditDraft): void {
    const event = this.audit.append(this.minute, draft);
    this.events.push({ type: "AUDIT_APPENDED", event });
  }

  private snapshot(): PDWorkerEvent {
    const activeSites: Record<
      string,
      {
        goodwill: number;
        latencyHours: number;
        attention: number;
        version: "v1" | "v2";
        openQueries: number;
      }
    > = {};
    const ids =
      this.scenario === "tracer" ? (["SITE-A"] as SiteId[]) : SITE_IDS;
    for (const id of ids) {
      const s = this.sites[id];
      activeSites[id] = {
        goodwill: s.goodwill,
        latencyHours: s.latencyHours,
        attention: s.attention,
        version: s.version,
        openQueries: s.openQueries,
      };
    }
    const debt = this.debt();
    return {
      type: "STATE_SNAPSHOT",
      minute: this.minute,
      clockLabel: formatClock(this.minute),
      fsmState: this.fsm,
      speed: this.speed,
      isPaused: this.fsm !== "RUNNING",
      waveIndex: this.currentWave(),
      publishedRevisionId: this.publishedRevisionId,
      amendmentAnnounced: this.amendmentAnnounced,
      activeSites,
      debt: {
        fabricatedBits: debt.fabricatedBits,
        semanticLossCount: debt.semanticLossCount,
        uncertainCount: debt.uncertainCount,
      },
      recordCounts: {
        sdtmVs: this.vs.filter((r) => !r.superseded).length,
        sdtmMh: this.mh.filter((r) => !r.superseded).length,
        adamRows: this.adam.filter((r) => r.AVAL !== null).length,
      },
      openIssues: Array.from(this.issues.values()).filter((i) =>
        isIssueOpen(i.status)
      ).length,
      openQueries: this.queries.filter((q) => isQueryOpen(q.communicationState))
        .length,
    };
  }
}

/**
 * Creates a deterministic Protocol Drift engine. Pass a seed (default 48291)
 * or options with a seed and scenario ("full" by default; "tracer" is the
 * Site A tracer bullet from #1091). The engine starts in BRIEF.
 */
export function createProtocolDriftEngine(
  options: number | ProtocolDriftEngineOptions = {}
): ProtocolDriftEngine {
  const opts = typeof options === "number" ? { seed: options } : options;
  return new Engine(opts.seed ?? DEFAULT_SEED, opts.scenario ?? "full");
}
