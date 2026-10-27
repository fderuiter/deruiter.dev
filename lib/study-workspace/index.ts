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
export { TAVR_DEVICE_USDM, TAVR_SAVR_USDM } from "./reference";
