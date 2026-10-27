import { usdmContentHash, type UsdmV4Document } from "@/lib/clinical-standards";
import {
  STUDY_WORKSPACE_VERSION,
  type OpenStudyWorkspaceResult,
  type StudyWorkspace,
} from "../types";

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
  if (change.expectedRevisionId !== workspace.revision.id) {
    throw new StudyWorkspaceConflictError(
      change.expectedRevisionId,
      workspace.revision.id
    );
  }
  return {
    ...workspace,
    usdm: structuredClone(usdm),
    revision: {
      id: `R${revisionNumber(workspace.revision.id) + 1}`,
      parentId: workspace.revision.id,
      note: change.note,
      sha256: usdmContentHash(usdm),
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

/**
 * Opens a saved workspace file. It checks the shape and version, and that
 * the working document still matches its revision's hash, so a file edited
 * by hand outside the studio is reported rather than trusted.
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
  if (value.workspaceVersion !== STUDY_WORKSPACE_VERSION) {
    return { status: "invalid", problem: "unsupported-version" };
  }
  if (usdmContentHash(value.usdm) !== value.revision.sha256) {
    return { status: "invalid", problem: "revision-hash-mismatch" };
  }
  return { status: "ok", workspace: value as unknown as StudyWorkspace };
}
