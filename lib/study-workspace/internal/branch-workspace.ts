import { usdmContentHash } from "@/lib/clinical-standards";
import type { StudyWorkspace } from "../types";
import { payloadContentHash, payloadOf } from "./revision";

/** Options when branching a conflicted local study workspace into its own record. */
export interface BranchStudyWorkspaceOptions {
  /** Optional protocol code / study name assigned to the branched USDM study. */
  readonly protocolCode?: string;
  /** Optional revision note explaining where the branch came from. */
  readonly note?: string;
}

/**
 * Creates a clean branch workspace from an edited local workspace so concurrent
 * edits detected by `StudyWorkspaceConflictError` can be saved as a separate
 * study record without losing either tab's work.
 */
export function branchStudyWorkspace(
  localWorkspace: StudyWorkspace,
  options: BranchStudyWorkspaceOptions = {}
): StudyWorkspace {
  const cloned = structuredClone(localWorkspace);
  const trimmedCode = options.protocolCode?.trim();
  const nextUsdm =
    trimmedCode && trimmedCode.length > 0
      ? {
          ...cloned.usdm,
          study: {
            ...cloned.usdm.study,
            name: trimmedCode,
          },
        }
      : cloned.usdm;

  const nextPayload = {
    ...payloadOf(cloned),
    usdm: nextUsdm,
  };
  const note =
    options.note?.trim() ||
    `Branched from ${localWorkspace.revision.id} after concurrent edit`;

  return {
    ...cloned,
    usdm: nextUsdm,
    revision: {
      id: "R1",
      parentId: localWorkspace.revision.id,
      note,
      sha256: usdmContentHash(nextUsdm),
      payloadSha256: payloadContentHash(nextPayload),
    },
  };
}
