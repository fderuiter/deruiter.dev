/**
 * Protocol Drift: public type contracts.
 *
 * Every value here is plain JSON so a run can be posted between a Web Worker
 * and the main thread, saved, and replayed. The engine itself lives under
 * `internal/` and is reached only through `index.ts`.
 */

// ---------------------------------------------------------------------------
// Clock and state machine
// ---------------------------------------------------------------------------

/** Simulation phases of the workbench state machine. */
export type SimulationState =
  | "BRIEF"
  | "DRAFT"
  | "VALIDATE"
  | "DEPLOY_READY"
  | "PAUSED"
  | "RUNNING"
  | "WAVE_REVIEW"
  | "LOCK_REVIEW"
  | "LOCKED";

/** Clock speed multipliers. At 1x one simulated hour passes per real second. */
export type SimSpeed = 1 | 2 | 5;

/** Index of a release wave. */
export type WaveIndex = 1 | 2 | 3;

/** Scenario selector: the Site A tracer bullet (#1091) or the full level. */
export type ScenarioId = "tracer" | "full";

/** Protocol version a visit was collected under. */
export type ProtocolVersion = "v1" | "v2";

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/** Every chip the toolbox offers. */
export type ChipKind =
  | "SourceIngest"
  | "AmendmentRouter"
  | "ExtractField"
  | "RegexSplit"
  | "DateLocaleNormalizer"
  | "UnitStandardizer"
  | "PivotToObservation"
  | "CDISCSink"
  | "SnapshotHandoff"
  | "PairAndDerive";

/** Which canvas lane a chip belongs to. Snapshot handoff sits on the wall. */
export type ChipLane = "TABULATION" | "WALL" | "ANALYSIS";

/** Data carried on a port; a wire is legal only between equal port types. */
export type PortType =
  | "submission"
  | "mh"
  | "field"
  | "text"
  | "date"
  | "unit"
  | "observation"
  | "snapshot"
  | "records"
  | "adam";

/** One input or output handle on a chip. */
export interface PortSpec {
  handle: string;
  type: PortType;
}

/** Static description of a chip: lane, ports and a one-line contract. */
export interface ChipSpec {
  kind: ChipKind;
  lane: ChipLane;
  inputs: PortSpec[];
  outputs: PortSpec[];
  summary: string;
}

/** Canvas coordinates of a node's top-left corner. */
export interface CanvasPosition {
  x: number;
  y: number;
}

/** Per-chip configuration. Only the keys a chip reads have meaning. */
export interface ChipConfig {
  /** AmendmentRouter: which timestamp decides applicability. */
  routeBy?: "assessedAt" | "submittedAt";
  /** DateLocaleNormalizer: keep partial dates or impute a first day. */
  partialDates?: "preserve" | "impute-day";
  /** PairAndDerive: join sitting and standing on visit or on subject only. */
  joinKey?: "visit" | "subject";
  [key: string]: unknown;
}

/** A node placed on the canvas. */
export interface CanvasNode {
  id: string;
  type: ChipKind;
  position: CanvasPosition;
  data?: ChipConfig;
}

/** A wire between two handles. */
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** A graph as the canvas holds it. */
export interface PipelineGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/** Outcome of a graph validation run ("Run Local Test"). */
export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Node positions after lane clamping. */
  clampedNodes: CanvasNode[];
}

// ---------------------------------------------------------------------------
// Packets
// ---------------------------------------------------------------------------

/** Epistemic status of a token or record. */
export type EpistemicStatus = "CONFIRMED" | "UNCERTAIN" | "FABRICATED" | "LOSS";

/** Short badges the UI prints next to tokens. */
export type EpistemicMarker = "?" | "FAB" | "LOSS" | "TRACE" | "A";

/** Measurement fields an extractor can route. */
export type MeasurementField =
  "sbp" | "dbp" | "pulse" | "sbp_stand" | "dbp_stand";

/** A single collected value travelling on a field, text or date port. */
export interface FieldValue {
  name: string;
  /** Original result exactly as collected. */
  orres: string;
  /** Original unit as collected or as declared by the site profile. */
  orresu: string;
  /** Standardized numeric result, unrounded. */
  stresn?: number;
  stresu?: string;
  /** Decimal places used for display of the standardized value. */
  precision?: number;
  /** True once a UnitStandardizer handled the value. */
  standardized: boolean;
  /** ISO date or partial date, set by a date normalizer. */
  iso?: string;
}

/** An observation row ready for the sink. */
export interface ObservationDraft {
  VSTESTCD: VsTestCode;
  VSPOS: VsPosition;
  VSORRES: string;
  VSORRESU: string;
  VSSTRESN: number;
  VSSTRESU: string;
  precision: number;
  VSDTC: string;
  status: EpistemicStatus;
  lossNote?: string;
}

/** A medical history row ready for the sink. */
export interface MhDraft {
  MHTERM: string;
  MHDECOD: string;
  MHCAT: MhCategory;
  MHSTDTC: string;
  MHENRTPT: "ONGOING";
  status: EpistemicStatus;
  fabricatedBits: number;
}

/** A token moving along a wire. */
export interface PipelinePacket {
  id: string;
  sourceNodeId: string;
  targetNodeId?: string;
  submissionId: string;
  sourceRevisionId: string;
  siteId: SiteId;
  subjectId: string;
  visitDay: number;
  /** ISO 8601, e.g. "2025-11-01T09:00:00Z". */
  assessedAt: string;
  /** ISO 8601, e.g. "2025-11-01T09:15:00Z". */
  submittedAt: string;
  formVersion?: ProtocolVersion;
  portType: PortType;
  payload: Record<string, unknown>;
  field?: FieldValue;
  observation?: ObservationDraft;
  mh?: MhDraft;
  epistemicBadges: EpistemicStatus[];
  fabricatedBits: number;
  /** Visited node IDs, in order. */
  trace: string[];
}

// ---------------------------------------------------------------------------
// Sites and coordinators
// ---------------------------------------------------------------------------

/** Site identifiers. */
export type SiteId = "SITE-A" | "SITE-B" | "SITE-C";

/** A site's verified setup questionnaire. */
export interface SiteProfile {
  siteId: SiteId;
  name: string;
  country: string;
  locale: "en-US" | "en-GB";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY";
  defaultPressureUnit: "mmHg" | "kPa";
  baseLatencyHours: number;
  initialGoodwill: number;
  /** Trial day on which Amendment 01 (v2) activates at 00:00. */
  amendmentActivationDay: number;
}

/** Live state of a site as the engine tracks it. */
export interface SiteState {
  siteId: SiteId;
  goodwill: number;
  /** Attention at the end of the most recent entry session. */
  attention: number;
  version: ProtocolVersion;
  latencyHours: number;
  openQueries: number;
}

/** eCRF field kinds that the attention model prices. */
export type EntryFieldType = "numeric" | "date" | "freetext" | "dropdown";

/** One eCRF field as the attention model sees it. */
export interface EntryFieldSpec {
  key: string;
  type: EntryFieldType;
  options?: number;
  nesting?: number;
  hardStop?: boolean;
}

/** One field entered during a coordinator session. */
export interface AttentionStep {
  submissionId: string;
  field: string;
  cost: number;
  attentionBefore: number;
  attentionAfter: number;
  errorProbability: number;
  transposed: boolean;
}

// ---------------------------------------------------------------------------
// Source ledger and fixtures
// ---------------------------------------------------------------------------

/** Domain of a source submission. */
export type SourceKind = "VS" | "MH";

/** A scheduled site submission authored in the scenario. */
export interface SubmissionFixture {
  submissionId: string;
  siteId: SiteId;
  /** USUBJID, e.g. "PD-101-A01". */
  subjectId: string;
  kind: SourceKind;
  visitDay: number;
  assessedAt: string;
  submittedAt: string;
  formVersion: ProtocolVersion;
  /** Values as written on the paper source worksheet. */
  payload: Record<string, unknown>;
  waveIndex: WaveIndex;
  /** Entry session this submission was keyed in. */
  sessionId: string;
}

/** An immutable source revision. */
export interface SourceRevision {
  sourceRevisionId: string;
  submissionId: string;
  revision: number;
  siteId: SiteId;
  subjectId: string;
  kind: SourceKind;
  visitDay: number;
  assessedAt: string;
  submittedAt: string;
  formVersion: ProtocolVersion;
  /** Values as entered into the eCRF. */
  payload: Record<string, unknown>;
  actor: AuditActor;
  reason: string;
  receivedAtMinute: number;
}

// ---------------------------------------------------------------------------
// SDTM
// ---------------------------------------------------------------------------

/** VS test codes. */
export type VsTestCode = "SYSBP" | "DIABP" | "PULSE";

/** VS positions. */
export type VsPosition = "SITTING" | "STANDING";

/** MH categories. */
export type MhCategory = "PRIMARY CONDITION" | "BASELINE ABNORMALITY";

/** A CDISC SDTM Vital Signs row. */
export interface SDTMVitalSignRecord {
  recordId: string;
  STUDYID: "PD-101";
  DOMAIN: "VS";
  USUBJID: string;
  VSSEQ: number;
  VSTESTCD: VsTestCode;
  VSTEST: "Systolic Blood Pressure" | "Diastolic Blood Pressure" | "Pulse Rate";
  VSORRES: string;
  VSORRESU: string;
  VSSTRESC: string;
  /** Unrounded standardized value; round only for display. */
  VSSTRESN: number;
  VSSTRESU: string;
  VSPOS: VsPosition;
  VISIT: string;
  VISITNUM: number;
  VSDTC: string;
  EPOCH: "BASELINE" | "TREATMENT";
  epistemicStatus: EpistemicStatus;
  sourceRevisionId: string;
  superseded: boolean;
  supersededBy?: string;
  submissionId: string;
  siteId: SiteId;
  /** Protocol version the visit was collected under. */
  protocolVersion: ProtocolVersion;
  pipelineRevisionId: string;
  /** Decimal places used for display. */
  precision: number;
  lossNote?: string;
  insertedAtMinute: number;
}

/** A CDISC SDTM Medical History row. */
export interface SDTMMedicalHistoryRecord {
  recordId: string;
  STUDYID: "PD-101";
  DOMAIN: "MH";
  USUBJID: string;
  MHSEQ: number;
  MHTERM: string;
  MHDECOD: string;
  MHCAT: MhCategory;
  /** ISO date or partial ISO date. */
  MHSTDTC: string;
  MHENRTPT: "ONGOING";
  epistemicStatus: EpistemicStatus;
  fabricatedBits: number;
  sourceRevisionId: string;
  superseded: boolean;
  supersededBy?: string;
  submissionId: string;
  siteId: SiteId;
  pipelineRevisionId: string;
  insertedAtMinute: number;
}

/** A packet parked in the hold tray instead of reaching the ledger. */
export interface HeldPacket {
  heldId: string;
  submissionId: string;
  sourceRevisionId: string;
  nodeId: string;
  handle: string;
  reason: string;
  issueId?: string;
  value?: string;
  /** True when the held token is a collected dimension that was dropped. */
  loss?: boolean;
}

/** Text that a parser could not map, kept and counted until dispositioned. */
export interface UnmatchedEntry {
  unmatchedId: string;
  submissionId: string;
  sourceRevisionId: string;
  nodeId: string;
  text: string;
  issueId: string;
}

// ---------------------------------------------------------------------------
// ADaM
// ---------------------------------------------------------------------------

/** ADVS parameter codes. */
export type AdvsParamCode = "OSBPDRP" | "ODBPDRP" | "ORTHOST";

/** A derived ADVS row or a NOT EVALUABLE ledger entry. */
export interface ADaMVitalSignRecord {
  rowId: string;
  STUDYID: "PD-101";
  USUBJID: string;
  PARAMCD: AdvsParamCode;
  PARAM:
    | "Orthostatic Systolic Pressure Drop"
    | "Orthostatic Diastolic Pressure Drop"
    | "Orthostatic Assessment Status";
  AVISIT: string;
  AVISITN: number;
  /** Unrounded derived value; null when not evaluable. */
  AVAL: number | null;
  /** Display value, or "NOT EVALUABLE". */
  AVALC: string;
  /** Sitting value; null when not evaluable. */
  BASE: number | null;
  /** Standing minus sitting; null when not evaluable. */
  CHG: number | null;
  CRIT1?: "Orthostatic Hypotension";
  CRIT1FL?: "Y" | "N";
  ANL01FL: "Y" | "N";
  sourceSittingRecordId: string | null;
  sourceStandingRecordId: string | null;
  derivationRule: "ORTHO_DELTA_V1";
  stale: boolean;
  /** Authorized Assumption badge: derived by an approved rule. */
  marker: "A";
  precision: number;
  reason?: string;
}

/** A rejected attempt to pair records across visits or subjects. */
export interface TraceViolation {
  code: "TRACE";
  USUBJID: string;
  sittingRecordId: string;
  standingRecordId: string;
  message: string;
}

/** Output of the PairAndDerive chip. */
export interface PairAndDeriveResult {
  adamRows: ADaMVitalSignRecord[];
  unpaired: ADaMVitalSignRecord[];
  traceViolations: TraceViolation[];
}

// ---------------------------------------------------------------------------
// Issues, queries, audit
// ---------------------------------------------------------------------------

/** Issue categories the engine raises. */
export type IssueCode =
  | "OUT_OF_RANGE"
  | "NARRATIVE_REPEAT"
  | "PARTIAL_DATE"
  | "APPLICABILITY_DISCREPANCY"
  | "POSITION_COLLISION"
  | "UNMAPPED_FIELD"
  | "DATE_WINDOW"
  | "DATE_UNPARSEABLE"
  | "UNKNOWN_UNIT";

/** Issue Resolution FSM states. */
export type IssueStatus =
  | "Open"
  | "AwaitingEvidence"
  | "ReadyForReview"
  | "Resolved"
  | "AcceptedUncertainty";

/** Where an issue came from: the site's source data or the pipeline. */
export type IssueOrigin = "source" | "pipeline";

/** A study issue tracked by the Issue Resolution FSM. */
export interface Issue {
  issueId: string;
  code: IssueCode;
  origin: IssueOrigin;
  status: IssueStatus;
  siteId: SiteId;
  subjectId: string;
  visitDay: number;
  submissionId: string;
  targetField: string;
  message: string;
  /** Evidence the player can attach to a query, if any. */
  evidence?: string;
  detectedAtMinute: number;
  /** Source revision awaiting acceptance, from an amended record. */
  pendingRevisionId?: string;
  resolution?: string;
  /** True for the scripted Wave 1 B01 Day 14 rubber-stamp lesson. */
  scriptedStampOnGeneric?: boolean;
}

/** Query Communication FSM states. */
export type QueryState =
  "Draft" | "Queued" | "AwaitingResponse" | "Answered" | "Closed";

/** A clinical query thread. */
export interface ClinicalQuery {
  queryId: string;
  issueId: string;
  siteId: SiteId;
  subjectId: string;
  visitDay: number;
  targetField: string;
  communicationState: QueryState;
  isEvidenceLinked: boolean;
  attachedEvidenceSnippet?: string;
  messageSent: string;
  sentAtMinute: number;
  expectedResponseMinute: number;
  responseReceived?: string;
  goodwillCost: number;
  duplicate: boolean;
  rubberStamped: boolean;
  /** Latency hours computed at send time. */
  latencyHours: number;
}

/** Audit event categories. */
export type AuditEventType =
  | "SOURCE_RECEIVED"
  | "SOURCE_RECORD_SUPERSEDED"
  | "QUERY_ISSUED"
  | "QUERY_ANSWERED"
  | "QUERY_CLOSED"
  | "UNCERTAINTY_ACCEPTED"
  | "ISSUE_RAISED"
  | "ISSUE_RESOLVED"
  | "REVISION_PUBLISHED"
  | "AMENDMENT_ANNOUNCED"
  | "SITE_ACTIVATED"
  | "COLLISION_REJECTED"
  | "DERIVATION_STALE"
  | "DERIVATIONS_REPLAYED"
  | "LOCK_GATE_EVALUATED"
  | "DATABASE_LOCKED";

/** Who caused an audit event. */
export type AuditActor =
  "SITE_COORDINATOR" | "DATA_ARCHITECT" | "SIMULATION_ENGINE";

/** An immutable audit trail entry. */
export interface AuditTrailEvent {
  eventId: string;
  /** ISO 8601. */
  timestamp: string;
  trialDay: number;
  type: AuditEventType;
  subjectId: string;
  visit: string;
  variable: string;
  oldValue: unknown;
  newValue: unknown;
  actor: AuditActor;
  reason: string;
  queryThreadId?: string;
}

// ---------------------------------------------------------------------------
// Debt, waves, lock, scorecard
// ---------------------------------------------------------------------------

/** Live epistemic debt counters. */
export interface DebtSummary {
  /** Fabricated precision over current records, in bits. */
  fabricatedBits: number;
  semanticLossCount: number;
  uncertainCount: number;
  traceBreaks: number;
  collisionCount: number;
}

/** Summary shown in the wave review modal. */
export interface WaveSummary {
  waveIndex: WaveIndex;
  vsRecords: number;
  mhRecords: number;
  newVsRecords: number;
  confirmedRecords: number;
  openIssues: number;
  openQueries: number;
  debt: DebtSummary;
}

/** Codes a failed lock check reports. */
export type LockDiscrepancyCode =
  | "VS_COUNT_MISMATCH"
  | "MH_COUNT_MISMATCH"
  | "OPEN_QUERIES_REMAINING"
  | "UNRESOLVED_ISSUES"
  | "FABRICATED_DEBT_EXCEEDED"
  | "SEMANTIC_LOSS_PRESENT"
  | "UNCERTAINTY_UNDOCUMENTED"
  | "BROKEN_TRACES"
  | "HELD_PACKETS_REMAINING"
  | "ADAM_COUNT_MISMATCH"
  | "UNEVALUABLE_MISHANDLED"
  | "CROSS_VISIT_COLLISIONS"
  | "STALE_DERIVATIONS_EXIST";

/** One failed check with an inspectable entity. */
export interface LockDiscrepancy {
  code: LockDiscrepancyCode;
  message: string;
  entityId: string;
}

/** Result of the dual database lock gate. */
export interface LockAuditResult {
  canLock: boolean;
  sdtmChecklist: {
    vsRecordCount: { expected: 110; actual: number; passed: boolean };
    mhRecordCount: { expected: 6; actual: number; passed: boolean };
    openQueries: { actual: number; passed: boolean };
    unresolvedIssues: { actual: number; passed: boolean };
    fabricatedDebtBits: { actual: number; passed: boolean };
    semanticLoss: { actual: number; passed: boolean };
    honestUncertaintyDocumented: { count: number; passed: boolean };
    brokenTraces: { actual: number; passed: boolean };
    heldPackets: { actual: number; passed: boolean };
  };
  adamChecklist: {
    derivedRecordsCount: { expected: 20; actual: number; passed: boolean };
    unevaluableHandledCorrectly: { count: number; passed: boolean };
    crossVisitCollisions: { actual: number; passed: boolean };
    staleDerivations: { actual: number; passed: boolean };
  };
  discrepancies: LockDiscrepancy[];
}

/** Everything the lock gate reads. All of it is inspectable state. */
export interface LockGateInput {
  vsRecords: SDTMVitalSignRecord[];
  mhRecords: SDTMMedicalHistoryRecord[];
  adamRows: ADaMVitalSignRecord[];
  unpaired: ADaMVitalSignRecord[];
  issues: Issue[];
  queries: ClinicalQuery[];
  held: HeldPacket[];
  unmatched: UnmatchedEntry[];
  traceViolations: TraceViolation[];
  debt: DebtSummary;
}

/** Preventative badges. */
export type BadgeId =
  "PREVENTATIVE_ARCHITECT" | "FORENSIC_SLEUTH" | "AMENDMENT_NAVIGATOR";

/** A badge with whether it was earned and why. */
export interface BadgeAward {
  id: BadgeId;
  title: "Preventative Architect" | "Forensic Sleuth" | "Amendment Navigator";
  earned: boolean;
  reason: string;
}

/** Facts the scorecard needs about how the run went. */
export interface ScorecardInput {
  lockedAtMinute: number;
  queries: ClinicalQuery[];
  sites: Record<SiteId, SiteState>;
  regexSplitBeforeNarrative: boolean;
  sleuthResolvedWithEvidence: boolean;
  lateBacklogRoutedV1: boolean;
  applicabilityErrors: number;
  integrityPassed: boolean;
}

/** Systems efficiency scorecard shown after lock. */
export interface Scorecard {
  trialDurationDays: number;
  queryRestraintRatio: number | null;
  queryRestraintLabel:
    | "Gold Standard Auditor"
    | "Query Spammer"
    | "Balanced Inquirer"
    | "No Queries Sent";
  queriesSent: number;
  evidenceLinkedQueries: number;
  goodwill: Record<SiteId, number>;
  meanGoodwill: number;
  badges: BadgeAward[];
  integrityPassed: boolean;
}

/** CSV and JSON files produced at lock. */
export interface DatasetExportBundle {
  "VS.csv": string;
  "MH.csv": string;
  "ADVS.csv": string;
  "audit_trail.json": string;
}

// ---------------------------------------------------------------------------
// Worker protocol
// ---------------------------------------------------------------------------

/** Main thread to worker commands. */
export type PDCommand =
  | { type: "INIT"; seed: number; scenario?: ScenarioId }
  | { type: "ACCEPT_BRIEF" }
  | { type: "SET_SPEED"; speed: SimSpeed }
  | { type: "SET_PAUSED"; isPaused: boolean }
  | { type: "STEP_TICK" }
  | { type: "TICK"; realMs: number }
  | { type: "ADVANCE_TO"; minute: number }
  | { type: "LOAD_GRAPH"; nodes: CanvasNode[]; edges: CanvasEdge[] }
  | { type: "VALIDATE_GRAPH"; nodes: CanvasNode[]; edges: CanvasEdge[] }
  | {
      type: "PUBLISH_REVISION";
      revisionId: string;
      nodes: CanvasNode[];
      edges: CanvasEdge[];
    }
  | {
      type: "DRAFT_QUERY";
      issueId: string;
      evidenceLinked: boolean;
      message?: string;
    }
  | { type: "SEND_QUERY"; queryId: string }
  | { type: "CANCEL_QUERY"; queryId: string }
  | { type: "CLOSE_QUERY"; queryId: string }
  | { type: "ACCEPT_CORRECTION"; issueId: string }
  | { type: "ACCEPT_UNCERTAINTY"; issueId: string }
  | { type: "REJECT_RESPONSE"; issueId: string }
  | {
      type: "SITE_SOURCE_CORRECTION";
      submissionId: string;
      payload: Record<string, unknown>;
      reason: string;
    }
  | { type: "REPLAY_SUBMISSIONS"; submissionIds?: string[] }
  | { type: "REPLAY_DERIVATIONS" }
  | { type: "REQUEST_LOCK" }
  | { type: "RETURN_TO_WORKBENCH" }
  | { type: "CONFIRM_LOCK" }
  | { type: "EXPORT_SAVE"; savedAt?: string }
  | { type: "EXPORT_DATASETS" };

/** Snapshot of the live state after every command. */
export interface StateSnapshotEvent {
  type: "STATE_SNAPSHOT";
  minute: number;
  clockLabel: string;
  fsmState: SimulationState;
  speed: SimSpeed;
  isPaused: boolean;
  waveIndex: WaveIndex;
  publishedRevisionId: string | null;
  amendmentAnnounced: boolean;
  activeSites: Record<
    string,
    {
      goodwill: number;
      latencyHours: number;
      attention: number;
      version: ProtocolVersion;
      openQueries: number;
    }
  >;
  debt: {
    fabricatedBits: number;
    semanticLossCount: number;
    uncertainCount: number;
  };
  recordCounts: { sdtmVs: number; sdtmMh: number; adamRows: number };
  openIssues: number;
  openQueries: number;
}

/** Worker to main thread events. */
export type PDWorkerEvent =
  | StateSnapshotEvent
  | {
      type: "VALIDATION_RESULT";
      valid: boolean;
      errors: string[];
      warnings: string[];
    }
  | { type: "REVISION_PUBLISHED"; revisionId: string }
  | { type: "PACKET_DISPATCHED"; packet: PipelinePacket }
  | { type: "RECORD_TABULATED"; record: SDTMVitalSignRecord }
  | { type: "MH_TABULATED"; record: SDTMMedicalHistoryRecord }
  | {
      type: "RECORD_SUPERSEDED";
      previous: SDTMVitalSignRecord | SDTMMedicalHistoryRecord;
      next: SDTMVitalSignRecord | SDTMMedicalHistoryRecord;
    }
  | { type: "PACKET_HELD"; held: HeldPacket }
  | { type: "ISSUE_UPDATED"; issue: Issue }
  | { type: "QUERY_UPDATED"; query: ClinicalQuery }
  | { type: "ADAM_DERIVED"; row: ADaMVitalSignRecord }
  | { type: "DERIVATION_STALE"; rowIds: string[] }
  | { type: "AUDIT_APPENDED"; event: AuditTrailEvent }
  | { type: "WAVE_COMPLETED"; waveIndex: WaveIndex; summary: WaveSummary }
  | { type: "AUTO_PAUSED"; reason: string }
  | { type: "LOCK_AUDIT"; result: LockAuditResult }
  | { type: "LOCKED"; scorecard: Scorecard }
  | { type: "SAVE_EXPORTED"; save: ProtocolDriftSaveFile }
  | { type: "DATASETS_EXPORTED"; bundle: DatasetExportBundle }
  | { type: "COMMAND_REJECTED"; command: PDCommand["type"]; reason: string };

// ---------------------------------------------------------------------------
// Engine view and save file
// ---------------------------------------------------------------------------

/** A read-only copy of the engine state, for tests, the inspector and saves. */
export interface ProtocolDriftView {
  seed: number;
  scenario: ScenarioId;
  minute: number;
  fsmState: SimulationState;
  speed: SimSpeed;
  waveIndex: WaveIndex;
  completedWaves: WaveIndex[];
  amendmentAnnounced: boolean;
  draftGraph: PipelineGraph;
  publishedRevisionId: string | null;
  publishedGraph: PipelineGraph | null;
  sites: Record<SiteId, SiteState>;
  sourceLedger: SourceRevision[];
  vsLedger: SDTMVitalSignRecord[];
  mhLedger: SDTMMedicalHistoryRecord[];
  adamRows: ADaMVitalSignRecord[];
  unpaired: ADaMVitalSignRecord[];
  traceViolations: TraceViolation[];
  held: HeldPacket[];
  unmatched: UnmatchedEntry[];
  issues: Issue[];
  queries: ClinicalQuery[];
  auditTrail: AuditTrailEvent[];
  attentionLog: AttentionStep[];
  debt: DebtSummary;
  routing: RoutingRecord[];
  lastLockAudit: LockAuditResult | null;
}

/** How the AmendmentRouter routed one submission. */
export interface RoutingRecord {
  submissionId: string;
  sourceRevisionId: string;
  handle: "v1" | "v2" | "review";
  requiredVersion: ProtocolVersion;
  formVersion: ProtocolVersion | null;
  routedBy: "assessedAt" | "submittedAt";
}

/** Versioned save file (pd-101-save-v1.json). */
export interface ProtocolDriftSaveFile {
  format: "pd-101-save-v1";
  version: 1;
  savedAt: string;
  seed: number;
  scenario: ScenarioId;
  fsmState: SimulationState;
  clock: { minute: number; speed: SimSpeed; isPaused: boolean };
  graph: PipelineGraph;
  sites: Record<
    string,
    { goodwill: number; attention: number; version: ProtocolVersion }
  >;
  sdtmLedger: SDTMVitalSignRecord[];
  mhLedger: SDTMMedicalHistoryRecord[];
  adamLedger: ADaMVitalSignRecord[];
  queries: ClinicalQuery[];
  auditTrail: AuditTrailEvent[];
  /** The ordered command log; replaying it rebuilds the run exactly. */
  commands: PDCommand[];
  /** Hash of the ledgers, checked after replay on import. */
  stateHash: string;
}
