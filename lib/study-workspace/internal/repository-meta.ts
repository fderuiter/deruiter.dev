import {
  resolveUsdmStudyDesign,
  type UsdmV4Document,
} from "@/lib/clinical-standards";
import type {
  StudyRepositoryRecord,
  StudyRepositorySeed,
  StudyRepositorySummary,
  StudyWorkspace,
} from "../types";
import { importUsdmStudy } from "./import";

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Derives human title and protocol code from a workspace's selected version. */
export function describeStudyWorkspace(workspace: StudyWorkspace): {
  readonly title: string;
  readonly protocolCode: string;
} {
  const study = workspace.usdm.study;
  const version = (study.versions ?? []).find(
    (entry) => entry.id === workspace.selection.studyVersionId
  );
  const identifier = cleanString(version?.studyIdentifiers?.[0]?.text);
  const officialTitle = cleanString(version?.titles?.[0]?.text);
  const protocolCode =
    identifier ?? cleanString(study.name) ?? cleanString(study.id) ?? "STUDY";
  const title =
    officialTitle ??
    cleanString(study.label) ??
    cleanString(study.description) ??
    protocolCode;
  return { title, protocolCode };
}

/** Projects a persisted study record into a lightweight UI summary. */
export function summarizeStudyRepositoryRecord(
  record: StudyRepositoryRecord
): StudyRepositorySummary {
  const resolved = resolveUsdmStudyDesign(
    record.workspace.usdm.study,
    record.workspace.selection
  );
  const design = resolved.ok ? resolved.design : null;
  return {
    studyId: record.studyId,
    kind: record.kind,
    title: record.title,
    protocolCode: record.protocolCode,
    revisionId: record.workspace.revision.id,
    sha256: record.workspace.revision.sha256,
    selection: record.workspace.selection,
    activityCount: design?.activities?.length ?? 0,
    encounterCount: design?.encounters?.length ?? 0,
    armCount: design?.arms?.length ?? 0,
    epochCount: design?.epochs?.length ?? 0,
    updatedAt: record.updatedAt,
  };
}

/** Builds a persisted study record from a reference seed specification. */
export async function buildSeedRepositoryRecord(
  seed: StudyRepositorySeed,
  now = "2026-01-01T00:00:00.000Z"
): Promise<StudyRepositoryRecord> {
  const imported = await importUsdmStudy(
    { document: seed.usdm as UsdmV4Document },
    {
      fileName: `${seed.studyId.toLowerCase()}.usdm.json`,
      selection: seed.selection,
    }
  );
  if (imported.status !== "ok") {
    throw new Error(
      `Reference seed ${seed.studyId} did not import cleanly: ${imported.status}.`
    );
  }
  const derived = describeStudyWorkspace(imported.workspace);
  return {
    studyId: seed.studyId,
    kind: "reference",
    title: seed.title ?? derived.title,
    protocolCode: seed.protocolCode ?? derived.protocolCode,
    workspace: imported.workspace,
    createdAt: now,
    updatedAt: now,
  };
}
