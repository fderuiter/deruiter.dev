/**
 * Study Director: "Everything Is Fine" — public domain API.
 *
 * A clinical study management simulator. The core is pure and deterministic:
 * the same seed and the same decisions always replay to the same study.
 * React components are thin adapters over it. Internals under `internal/`
 * are private (ADR 0054).
 */
export * from "./types";
export {
  AUDIT_ATTENTION,
  AUDIT_WINDOW_DAYS,
  ATTENTION_PER_DAY,
  DOCUMENTATION_ATTENTION,
  advanceDay,
  auditSite,
  computeMeters,
  createStudy,
  dashboard,
  dataManagerCapacity,
  phaseForDay,
  projectedFinishDay,
  resolveDecision,
  totalOpenQueries,
} from "./internal/model";
export { STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM } from "./presets";
export { STUDY_EVENTS } from "./internal/events-data";
export {
  beginStudy,
  endDay,
  getEvent,
  inbox,
  resolveEvent,
} from "./internal/events";
export {
  classifyProfile,
  evaluate,
  finalizeStudy,
  inspectionReadiness,
  lockDatabase,
  runInspection,
} from "./internal/endgame";
