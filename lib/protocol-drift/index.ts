/**
 * Protocol Drift: public domain API.
 *
 * A deterministic clinical-data pipeline simulation. The engine is pure
 * TypeScript with no DOM, React or Worker dependency; a Web Worker or a test
 * drives it with PDCommand messages and receives PDWorkerEvent messages.
 * Internals under `internal/` are private.
 */
export * from "./types";
export * from "./presets";
export {
  CLOCK_ORIGIN_OFFSET_MINUTES,
  MINUTES_PER_DAY,
  SIM_MINUTES_PER_REAL_SECOND,
  STEP_MINUTES,
  accumulateRealTime,
  formatClock,
  isoToMinute,
  minuteAt,
  minuteToIso,
  trialDayDate,
  trialDayOf,
} from "./internal/clock";
export { fnv1a, hashValue, mulberry32, seededDraw } from "./internal/rng";
export {
  FSM_TRANSITIONS,
  ProtocolDriftStateError,
  canTransition,
  clockAdvances,
  transition,
} from "./internal/fsm";
export {
  EVENT_PRIORITY,
  EventQueue,
  compareEvents,
  type SimEvent,
  type SimEventKind,
} from "./internal/event-queue";
export {
  CHIP_SPECS,
  analysisLaneWired,
  clampNodePosition,
  compileGraph,
  edgesFrom,
  isWireCompatible,
  laneBounds,
  validateGraph,
  type CompiledGraph,
  type ValidationOptions,
} from "./internal/graph";
export {
  PIVOT_HANDLE_MAP,
  formatDisplay,
  normalizeDate,
  regexSplit,
  routeAmendment,
  standardUnit,
  standardizeUnit,
  vsTestName,
  type DateNormalization,
  type RegexSplitResult,
  type RouterDecision,
  type RouterInput,
  type StandardizedValue,
} from "./internal/chips";
export {
  EpistemicContradictionError,
  daysInMonth,
  fabricatedBits,
  resolvePartialDate,
  worstStatus,
  type PartialDateOutcome,
} from "./internal/debt";
export {
  ATTENTION_START,
  FATIGUE_THRESHOLD,
  GOODWILL_RULES,
  HARD_STOP_ATTENTION_COST,
  baseFieldCost,
  clampGoodwill,
  fatigueErrorProbability,
  fieldCost,
  responseLatencyHours,
  rubberStampProbability,
  simulateEntrySession,
  transposeDigits,
  type EntrySessionResult,
} from "./internal/coordinator";
export {
  ISSUE_TRANSITIONS,
  ProtocolDriftWorkflowError,
  QUERY_TRANSITIONS,
  RUBBER_STAMP_RESPONSE,
  isIssueOpen,
  isQueryOpen,
  issueTransition,
  queryTransition,
} from "./internal/queries";
export { AuditTrail, type AuditDraft } from "./internal/audit";
export {
  runPipeline,
  type HeldDraft,
  type IssueDraft,
  type PipelineRunContext,
  type PipelineRunResult,
} from "./internal/pipeline";
export {
  deepFreeze,
  pairAndDerive,
  pairMeasurements,
  snapshotHandoff,
  visitKey,
  type PairOptions,
} from "./internal/analysis";
export { evaluateLockGate } from "./internal/lock";
export {
  buildScorecard,
  evaluateBadges,
  queryRestraintLabel,
  queryRestraintRatio,
} from "./internal/scorecard";
export {
  buildDatasetExport,
  csvField,
  parseCsv,
  toCsv,
} from "./internal/export";
export {
  ProtocolDriftCommandError,
  createProtocolDriftEngine,
  type ProtocolDriftEngine,
  type ProtocolDriftEngineOptions,
} from "./internal/engine";
export {
  ProtocolDriftSaveError,
  deserializeSave,
  restoreProtocolDriftEngine,
  serializeSave,
} from "./internal/save";
