/**
 * The study workspace (epic #3071, step 2): one file that holds a USDM v4
 * study with where it came from, the study version and design chosen for
 * work, and an immutable revision history. CRF Studio, the study-data
 * pipeline and the design views open the same workspace, so each fact about
 * the study has one owner.
 *
 * Import keeps the original document unchanged, never picks a study
 * version or design on the person's behalf, lists schema issues without
 * refusing the study, and lists what it keeps but does not edit (other
 * versions and designs, extension attributes). The plan is in
 * `plans/2026-10-27-clinical-study-studio/02-workspace.md` in project files.
 */
export * from "./types";
export {
  importUsdmStudy,
  type ImportUsdmStudyOptions,
} from "./internal/import";
export {
  StudyWorkspaceConflictError,
  commitStudyRevision,
  exportStudyUsdm,
  openStudyWorkspace,
  serializeStudyWorkspace,
} from "./internal/revision";
export {
  createBlankStudyWorkspace,
  type CreateBlankStudyOptions,
} from "./internal/workspace";
export {
  StudyPatchError,
  applyStudyEdit,
  applyStudyPatch,
  createStudyEdit,
  emptyStudyEditHistory,
  redoStudyEdit,
  undoStudyEdit,
  type StudyEditResult,
} from "./internal/ops";
export { exportValidatedStudyUsdm } from "./internal/export";
export { TAVR_DEVICE_USDM, TAVR_SAVR_USDM } from "./reference";
export {
  StudyDesignError,
  projectStudyDesignGrid,
} from "./internal/design-grid";
export {
  addStudyArm,
  addStudyElement,
  addStudyEpoch,
  moveStudyArm,
  moveStudyElement,
  moveStudyEpoch,
  removeStudyArm,
  removeStudyElement,
  removeStudyEpoch,
  renameStudyArm,
  renameStudyElement,
  renameStudyEpoch,
} from "./internal/design-ops";
export {
  DATA_GENERATED_WITHIN_STUDY,
  STUDY_ARM_TYPES,
  STUDY_EPOCH_TYPES,
  STUDY_INTERVENTION_ROLES,
  STUDY_INTERVENTION_TYPES,
} from "./internal/design-terms";
export {
  addStudyIntervention,
  assignStudyIntervention,
  projectStudyInterventions,
  removeStudyIntervention,
  unassignStudyIntervention,
  updateStudyIntervention,
  type NewStudyIntervention,
  type StudyInterventionChanges,
} from "./internal/interventions";
export { applyStudyPayloadPatch, createStudyPayloadEdit } from "./internal/ops";
export {
  addStudyRandomizationPlan,
  bindStudyRandomizationEvidence,
  checkStudyRandomizationEvidence,
  removeStudyRandomizationPlan,
  resolveStudyRandomizationPlan,
  updateStudyRandomizationPlan,
  type NewStudyRandomizationPlan,
  type StudyRandomizationPlanChanges,
} from "./internal/randomization";
export type { StudyWorkspacePayload } from "./internal/revision";
export {
  STUDY_REPOSITORY_DB_NAME,
  STUDY_REPOSITORY_DB_VERSION,
  StudyRepositoryStoreError,
  openStudyRepositoryStore,
} from "./internal/repository-idb";
export { createMemoryStudyRepositoryStore } from "./internal/repository-memory";
export {
  buildSeedRepositoryRecord,
  describeStudyWorkspace,
  summarizeStudyRepositoryRecord,
} from "./internal/repository-meta";
export {
  STUDY_REPOSITORY_CHANNEL_NAME,
  openStudyRepositorySync,
} from "./internal/repository-sync";
export { importStudyRepositoryFile } from "./internal/repository-file";
export { reconcileUsdmStudyRevision } from "./internal/reconcile-usdm";

