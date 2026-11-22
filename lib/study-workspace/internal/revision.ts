import { usdmContentHash, type UsdmV4Document } from "@/lib/clinical-standards";
import {
  STUDY_WORKSPACE_VERSION,
  type OpenStudyWorkspaceResult,
  type PreservedReason,
  type StudyRandomizationPlan,
  type StudyWorkspace,
} from "../types";

/** The parts of a workspace that one revision fixes. */
export interface StudyWorkspacePayload {
  readonly usdm: UsdmV4Document;
  readonly analyses: readonly unknown[];
  readonly randomizationPlans: readonly StudyRandomizationPlan[];
}

/** SHA-256 of the canonical JSON of the working payload. */
export function payloadContentHash(payload: StudyWorkspacePayload): string {
  return usdmContentHash({
    usdm: payload.usdm,
    analyses: payload.analyses,
    randomizationPlans: payload.randomizationPlans,
  });
}

/** The working payload of a workspace. */
export function payloadOf(workspace: StudyWorkspace): StudyWorkspacePayload {
  return {
    usdm: workspace.usdm,
    analyses: workspace.analyses,
    randomizationPlans: workspace.randomizationPlans,
  };
}

/** Thrown when an edit was made against a revision that is no longer current. */
export class StudyWorkspaceConflictError extends Error {
  constructor(
    readonly expectedRevisionId: string,
    readonly currentRevisionId: string
  ) {
    super(
      `The edit was made on ${expectedRevisionId}, but the workspace is at ${currentRevisionId}.`
    );
    this.name = "StudyWorkspaceConflictError";
  }
}

function revisionNumber(id: string): number {
  const match = /^R(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

/**
 * Makes the next revision from an edited USDM document. The workspace
 * passed in is left as it was; the result is a new workspace whose parent
 * is that revision. `expectedRevisionId` guards against applying an edit
 * to a workspace that moved on in the meantime (another tab, a stale undo).
 *
 * @throws StudyWorkspaceConflictError when `expectedRevisionId` is not the
 *   current revision.
 */
export function commitStudyRevision(
  workspace: StudyWorkspace,
  usdm: UsdmV4Document,
  change: { readonly expectedRevisionId: string; readonly note: string }
): StudyWorkspace {
  return commitStudyPayload(
    workspace,
    { ...payloadOf(workspace), usdm },
    change
  );
}

/**
 * Makes the next revision from an edited payload: the USDM document,
 * analyses and randomization plans together.
 *
 * @throws StudyWorkspaceConflictError when `expectedRevisionId` is not the
 *   current revision.
 */
export function commitStudyPayload(
  workspace: StudyWorkspace,
  payload: StudyWorkspacePayload,
  change: { readonly expectedRevisionId: string; readonly note: string }
): StudyWorkspace {
  if (change.expectedRevisionId !== workspace.revision.id) {
    throw new StudyWorkspaceConflictError(
      change.expectedRevisionId,
      workspace.revision.id
    );
  }
  const next = structuredClone({
    usdm: payload.usdm,
    analyses: payload.analyses,
    randomizationPlans: payload.randomizationPlans,
  });
  return {
    ...workspace,
    ...next,
    revision: {
      id: `R${revisionNumber(workspace.revision.id) + 1}`,
      parentId: workspace.revision.id,
      note: change.note,
      sha256: usdmContentHash(next.usdm),
      payloadSha256: payloadContentHash(next),
    },
  };
}

/** The working USDM document, for export or a hand-off. */
export function exportStudyUsdm(workspace: StudyWorkspace): UsdmV4Document {
  return structuredClone(workspace.usdm);
}

/** The workspace as the text of a `.study.json` file. */
export function serializeStudyWorkspace(workspace: StudyWorkspace): string {
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringOrNull(value: unknown): boolean {
  return value === null || isString(value);
}

const PRESERVED_REASONS: ReadonlySet<unknown> = new Set<PreservedReason>([
  "other-study-version",
  "other-study-design",
  "extension-attributes",
]);

/**
 * Whether the parts of a version-1 workspace hold what readers of
 * `StudyWorkspace` rely on: the envelope's fields, and a USDM v4 study with
 * a name whose versions include the selected version and design. The
 * revision hash proves the document is the one the revision recorded, not
 * that it is well formed (#3619).
 */
function hasWorkspaceShape(value: Record<string, unknown>): boolean {
  const source = value.source as Record<string, unknown>;
  const selection = value.selection as Record<string, unknown>;
  const revision = value.revision as Record<string, unknown>;
  const locks = value.locks as Record<string, unknown>;
  const usdm = value.usdm as Record<string, unknown>;
  if (
    !isStringOrNull(source.fileName) ||
    !isString(source.sha256) ||
    !isStringOrNull(source.systemName) ||
    !isStringOrNull(source.systemVersion) ||
    !isString(source.usdmVersion) ||
    !isString(selection.studyVersionId) ||
    !isString(selection.studyDesignId) ||
    !isString(revision.id) ||
    !isStringOrNull(revision.parentId) ||
    !isString(revision.note) ||
    !isString(revision.sha256) ||
    !isString(locks.USDM) ||
    !isString(locks.ctPackageDate)
  ) {
    return false;
  }
  const preservedOk = (value.preserved as unknown[]).every(
    (item) =>
      isRecord(item) &&
      isString(item.path) &&
      isString(item.label) &&
      PRESERVED_REASONS.has(item.reason)
  );
  if (!preservedOk) return false;

  const study = usdm.study;
  if (
    !isString(usdm.usdmVersion) ||
    !usdm.usdmVersion.startsWith("4.") ||
    !isRecord(study) ||
    !isString(study.name) ||
    !Array.isArray(study.versions)
  ) {
    return false;
  }
  const version = study.versions.find(
    (v) => isRecord(v) && v.id === selection.studyVersionId
  ) as Record<string, unknown> | undefined;
  return (
    version !== undefined &&
    Array.isArray(version.studyDesigns) &&
    version.studyDesigns.some(
      (d) => isRecord(d) && d.id === selection.studyDesignId
    )
  );
}

/**
 * Opens a saved workspace file. It checks the shape and version, that the
 * nested parts and the working USDM study are well formed, and that the
 * working document still matches its revision's hash, so a file edited by
 * hand outside the studio is reported rather than trusted.
 */
export function openStudyWorkspace(text: string): OpenStudyWorkspaceResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { status: "invalid", problem: "not-json" };
  }
  if (
    !isRecord(value) ||
    !isRecord(value.source) ||
    !isRecord(value.selection) ||
    !isRecord(value.revision) ||
    !isRecord(value.usdm) ||
    !isRecord(value.locks) ||
    !Array.isArray(value.preserved)
  ) {
    return { status: "invalid", problem: "not-a-workspace" };
  }
  if (
    value.workspaceVersion !== 1 &&
    value.workspaceVersion !== STUDY_WORKSPACE_VERSION
  ) {
    return { status: "invalid", problem: "unsupported-version" };
  }
  if (!hasWorkspaceShape(value)) {
    return { status: "invalid", problem: "not-a-workspace" };
  }
  if (usdmContentHash(value.usdm) !== value.revision.sha256) {
    return { status: "invalid", problem: "revision-hash-mismatch" };
  }
  if (value.workspaceVersion === 1) {
    // A version 1 file has no analyses or plans; it opens as version 2
    // with empty collections and keeps its USDM-only revision hash.
    const migrated = {
      ...value,
      workspaceVersion: STUDY_WORKSPACE_VERSION,
      analyses: [],
      randomizationPlans: [],
    } as unknown as StudyWorkspace;
    return {
      status: "ok",
      workspace: {
        ...migrated,
        revision: {
          ...migrated.revision,
          payloadSha256: payloadContentHash(migrated),
        },
      },
    };
  }
  if (
    !Array.isArray(value.analyses) ||
    !Array.isArray(value.randomizationPlans) ||
    !value.randomizationPlans.every(isPlanShape) ||
    !isString(value.revision.payloadSha256)
  ) {
    return { status: "invalid", problem: "not-a-workspace" };
  }
  const workspace = value as unknown as StudyWorkspace;
  if (payloadContentHash(workspace) !== workspace.revision.payloadSha256) {
    return { status: "invalid", problem: "revision-hash-mismatch" };
  }
  return { status: "ok", workspace };
}

/** Whether a saved plan holds the fields readers rely on. */
function isPlanShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.schemaVersion === 1 &&
    isString(value.name) &&
    (value.state === "draft" ||
      value.state === "exploration" ||
      value.state === "acknowledged-reference") &&
    isString(value.studyVersionId) &&
    isString(value.studyDesignId) &&
    Array.isArray(value.arms) &&
    value.arms.every(
      (arm) =>
        isRecord(arm) &&
        isString(arm.armId) &&
        isString(arm.code) &&
        typeof arm.allocationRatio === "number"
    ) &&
    isRecord(value.mechanics)
  );
}
