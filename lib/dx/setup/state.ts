import fs from "fs";
import path from "path";
import { isSetupProfileId, writeFileAtomic } from "./environment";
import {
  SETUP_STAGE_IDS,
  type SetupProfileId,
  type SetupStageId,
  type SetupStageRecord,
  type SetupStageStatus,
} from "./types";

/** Gitignored file, relative to the workspace root, that remembers stage progress. */
export const SETUP_STATE_FILE = ".setup-state.json";

/** Persisted progress. Holds stage outcomes only, never a value. */
export interface SetupState {
  version: 1;
  profile?: SetupProfileId;
  updatedAt?: string;
  stages: Partial<
    Record<
      SetupStageId,
      { status: SetupStageStatus; detail: string; at: string }
    >
  >;
}

function emptyState(): SetupState {
  return { version: 1, stages: {} };
}

/** Reads the state file; a missing or unreadable file means a fresh start. */
export function readSetupState(root: string): SetupState {
  const file = path.join(root, SETUP_STATE_FILE);
  if (!fs.existsSync(file)) return emptyState();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as SetupState;
    if (parsed?.version !== 1 || typeof parsed.stages !== "object") {
      return emptyState();
    }
    const stages: SetupState["stages"] = {};
    for (const id of SETUP_STAGE_IDS) {
      const entry = parsed.stages[id];
      if (entry && typeof entry.status === "string") stages[id] = entry;
    }
    return {
      version: 1,
      profile: isSetupProfileId(parsed.profile) ? parsed.profile : undefined,
      updatedAt: parsed.updatedAt,
      stages,
    };
  } catch {
    return emptyState();
  }
}

/** Records a stage outcome in memory. */
export function recordStage(
  state: SetupState,
  record: SetupStageRecord,
  now: Date
): void {
  state.stages[record.id] = {
    status: record.status,
    detail: record.detail,
    at: now.toISOString(),
  };
  state.updatedAt = now.toISOString();
}

/** Writes the state file atomically. */
export function writeSetupState(root: string, state: SetupState): void {
  writeFileAtomic(
    path.join(root, SETUP_STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`
  );
}

/** True when `--resume` may skip the stage because it already completed. */
export function canResumePast(state: SetupState, id: SetupStageId): boolean {
  return state.stages[id]?.status === "completed";
}
