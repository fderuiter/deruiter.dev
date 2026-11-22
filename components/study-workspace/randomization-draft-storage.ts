import {
  openStudyWorkspace,
  type StudyWorkspace,
  type StudyWorkspaceFileProblem,
} from "@/lib/study-workspace";
import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "@/lib/safe-storage";

/**
 * Browser drafts of a study workspace, with its randomization plans (#4003).
 *
 * The workspace is the draft: plans, arms and ratios live in its payload,
 * so one record restores all of them, plus the studio's own view state
 * (the step a wizard is on, a selected cell). A record is versioned, and
 * a record that cannot be read is moved to quarantine with its original
 * text, never deleted, so it can be exported by hand. Nothing here throws:
 * a store that is missing, full or refusing access reports a status and the
 * caller keeps the in-memory workspace.
 */

/** localStorage key of the current draft record. */
export const STUDY_WORKSPACE_DRAFT_KEY = "study_workspace_draft_v1";

/** localStorage key of the quarantine list. */
export const STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY =
  "study_workspace_draft_v1_quarantine";

/** Version of the draft record envelope. */
export const STUDY_WORKSPACE_DRAFT_RECORD_VERSION = 1;

/** View state saved with a draft. Kept as plain JSON values. */
export type StudyWorkspaceDraftUi = Readonly<Record<string, unknown>>;

/** A stored draft. */
export interface StudyWorkspaceDraftRecord {
  readonly recordVersion: typeof STUDY_WORKSPACE_DRAFT_RECORD_VERSION;
  readonly savedAt: string;
  /** Changes on every write; a writer compares it to spot another tab. */
  readonly writeId: string;
  readonly workspace: StudyWorkspace;
  readonly ui: StudyWorkspaceDraftUi;
}

/** Why a stored draft was quarantined. */
export type StudyWorkspaceDraftProblem =
  | "not-json"
  | "not-a-draft"
  | "unsupported-record-version"
  | StudyWorkspaceFileProblem;

/** A draft that could not be read, kept with its original text. */
export interface QuarantinedStudyWorkspaceDraft {
  readonly id: string;
  readonly quarantinedAt: string;
  readonly problem: StudyWorkspaceDraftProblem;
  /** The stored text exactly as it was found. */
  readonly raw: string;
}

/** Result of `loadStudyWorkspaceDraft`. */
export type LoadStudyWorkspaceDraftResult =
  | { readonly status: "empty" }
  | { readonly status: "unavailable" }
  | {
      readonly status: "recovered";
      readonly record: StudyWorkspaceDraftRecord;
      /** True when an older format was read and converted. */
      readonly migrated: boolean;
    }
  | {
      readonly status: "quarantined";
      readonly entry: QuarantinedStudyWorkspaceDraft;
      /**
       * False when the quarantine could not be written; the original then
       * stays under the draft key untouched.
       */
      readonly moved: boolean;
    };

/** Result of `saveStudyWorkspaceDraft`. */
export type SaveStudyWorkspaceDraftResult =
  | {
      readonly status: "saved";
      readonly savedAt: string;
      readonly writeId: string;
    }
  | { readonly status: "unavailable" }
  | {
      readonly status: "error";
      readonly reason: "quota" | "storage";
      readonly message: string;
    }
  | {
      /** Another writer saved since this one last read or wrote. */
      readonly status: "conflict";
      readonly stored: StudyWorkspaceDraftRecord;
    };

/** Options for reads and writes. */
export interface StudyWorkspaceDraftStorageOptions {
  /** The store to use. Defaults to localStorage through `safeRawStorage`. */
  readonly storage?: RawStorage;
  /** The clock. Defaults to `Date.now`. */
  readonly now?: () => Date;
  /** Makes write ids. Defaults to `crypto.randomUUID` where it exists. */
  readonly makeId?: () => string;
}

/** Fields of a save. */
export interface SaveStudyWorkspaceDraftInput {
  readonly workspace: StudyWorkspace;
  readonly ui?: StudyWorkspaceDraftUi;
  /**
   * The write id this writer last saw in storage: from its last load or
   * save, or null when it saw no draft. A stored draft with any other id
   * was written by someone else, and the save reports a conflict.
   */
  readonly expectedWriteId: string | null;
  /** Overwrite a conflicting draft, once the person has chosen to. */
  readonly force?: boolean;
}

function resolve(options: StudyWorkspaceDraftStorageOptions) {
  const storage =
    options.storage ?? (safeIsAvailable() ? safeRawStorage : undefined);
  const now = options.now ?? (() => new Date());
  const makeId =
    options.makeId ??
    (() =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  return { storage, now, makeId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuotaError(error: unknown): boolean {
  if (!isRecord(error) && !(error instanceof Error)) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

type Parsed =
  | {
      readonly ok: true;
      readonly record: StudyWorkspaceDraftRecord;
      readonly migrated: boolean;
    }
  | { readonly ok: false; readonly problem: StudyWorkspaceDraftProblem };

/**
 * Reads stored text as a draft. A record of this version is checked by
 * opening its workspace, with the file's own hash checks. A bare workspace
 * file, the shape a draft had before records were versioned, is read as a
 * record with no view state.
 */
function parseDraft(raw: string): Parsed {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, problem: "not-json" };
  }
  if (!isRecord(value)) return { ok: false, problem: "not-a-draft" };

  if (!("recordVersion" in value) && "workspaceVersion" in value) {
    const opened = openStudyWorkspace(raw);
    if (opened.status !== "ok") return { ok: false, problem: opened.problem };
    return {
      ok: true,
      migrated: true,
      record: {
        recordVersion: STUDY_WORKSPACE_DRAFT_RECORD_VERSION,
        savedAt: "",
        writeId: "",
        workspace: opened.workspace,
        ui: {},
      },
    };
  }
  if (value.recordVersion !== STUDY_WORKSPACE_DRAFT_RECORD_VERSION) {
    return { ok: false, problem: "unsupported-record-version" };
  }
  if (
    typeof value.savedAt !== "string" ||
    typeof value.writeId !== "string" ||
    !isRecord(value.workspace) ||
    !isRecord(value.ui)
  ) {
    return { ok: false, problem: "not-a-draft" };
  }
  const opened = openStudyWorkspace(JSON.stringify(value.workspace));
  if (opened.status !== "ok") return { ok: false, problem: opened.problem };
  return {
    ok: true,
    // A version 1 workspace inside a record opens as version 2.
    migrated:
      opened.workspace.workspaceVersion !== value.workspace.workspaceVersion,
    record: {
      recordVersion: STUDY_WORKSPACE_DRAFT_RECORD_VERSION,
      savedAt: value.savedAt,
      writeId: value.writeId,
      workspace: opened.workspace,
      ui: value.ui,
    },
  };
}

function readQuarantine(storage: RawStorage): QuarantinedStudyWorkspaceDraft[] {
  let raw: string | null;
  try {
    raw = storage.getItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is QuarantinedStudyWorkspaceDraft =>
            isRecord(entry) &&
            typeof entry.id === "string" &&
            typeof entry.quarantinedAt === "string" &&
            typeof entry.problem === "string" &&
            typeof entry.raw === "string"
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Moves the draft key's text into quarantine. The draft key is cleared only
 * after the quarantine write succeeded, so the original bytes always stay
 * somewhere.
 */
function quarantine(
  storage: RawStorage,
  raw: string,
  problem: StudyWorkspaceDraftProblem,
  now: () => Date,
  makeId: () => string
): { entry: QuarantinedStudyWorkspaceDraft; moved: boolean } {
  const entry: QuarantinedStudyWorkspaceDraft = {
    id: makeId(),
    quarantinedAt: now().toISOString(),
    problem,
    raw,
  };
  try {
    storage.setItem(
      STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
      JSON.stringify([...readQuarantine(storage), entry])
    );
  } catch {
    return { entry, moved: false };
  }
  try {
    storage.removeItem(STUDY_WORKSPACE_DRAFT_KEY);
  } catch {
    // The copy is safe in quarantine; the next load quarantines it again.
  }
  return { entry, moved: true };
}

/**
 * Reads the stored draft. A draft that cannot be read is quarantined and
 * reported, so the studio can offer its export instead of failing on it
 * again at every load.
 */
export function loadStudyWorkspaceDraft(
  options: StudyWorkspaceDraftStorageOptions = {}
): LoadStudyWorkspaceDraftResult {
  const { storage, now, makeId } = resolve(options);
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(STUDY_WORKSPACE_DRAFT_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (!raw) return { status: "empty" };
  const parsed = parseDraft(raw);
  if (parsed.ok) {
    return {
      status: "recovered",
      record: parsed.record,
      migrated: parsed.migrated,
    };
  }
  const { entry, moved } = quarantine(
    storage,
    raw,
    parsed.problem,
    now,
    makeId
  );
  return { status: "quarantined", entry, moved };
}

/**
 * Saves the workspace as the draft. It refuses, with `conflict`, to
 * overwrite a draft another writer saved since this one last saw storage,
 * unless `force` is set. A stored draft that cannot be read is quarantined
 * before it is replaced.
 */
export function saveStudyWorkspaceDraft(
  input: SaveStudyWorkspaceDraftInput,
  options: StudyWorkspaceDraftStorageOptions = {}
): SaveStudyWorkspaceDraftResult {
  const { storage, now, makeId } = resolve(options);
  if (!storage) return { status: "unavailable" };

  let current: string | null;
  try {
    current = storage.getItem(STUDY_WORKSPACE_DRAFT_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (current) {
    const parsed = parseDraft(current);
    if (!parsed.ok) {
      const { moved } = quarantine(
        storage,
        current,
        parsed.problem,
        now,
        makeId
      );
      if (!moved) {
        return {
          status: "error",
          reason: "storage",
          message:
            "The stored draft could not be read or moved aside, so it was left in place.",
        };
      }
    } else if (
      !input.force &&
      parsed.record.writeId !== (input.expectedWriteId ?? "")
    ) {
      return { status: "conflict", stored: parsed.record };
    }
  }

  const record: StudyWorkspaceDraftRecord = {
    recordVersion: STUDY_WORKSPACE_DRAFT_RECORD_VERSION,
    savedAt: now().toISOString(),
    writeId: makeId(),
    workspace: input.workspace,
    ui: input.ui ?? {},
  };
  try {
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, JSON.stringify(record));
  } catch (error) {
    return {
      status: "error",
      reason: isQuotaError(error) ? "quota" : "storage",
      message: error instanceof Error ? error.message : "The store refused.",
    };
  }
  return { status: "saved", savedAt: record.savedAt, writeId: record.writeId };
}

/** Removes the current draft, once the person has dismissed it. */
export function discardStudyWorkspaceDraft(
  options: StudyWorkspaceDraftStorageOptions = {}
): boolean {
  const { storage } = resolve(options);
  if (!storage) return false;
  try {
    storage.removeItem(STUDY_WORKSPACE_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Quarantined drafts, oldest first. */
export function listQuarantinedStudyWorkspaceDrafts(
  options: StudyWorkspaceDraftStorageOptions = {}
): QuarantinedStudyWorkspaceDraft[] {
  const { storage } = resolve(options);
  return storage ? readQuarantine(storage) : [];
}

/** Drops one quarantined draft, once the person has exported or dismissed it. */
export function dismissQuarantinedStudyWorkspaceDraft(
  id: string,
  options: StudyWorkspaceDraftStorageOptions = {}
): boolean {
  const { storage } = resolve(options);
  if (!storage) return false;
  const rest = readQuarantine(storage).filter((entry) => entry.id !== id);
  try {
    if (rest.length === 0) {
      storage.removeItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY);
    } else {
      storage.setItem(
        STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
        JSON.stringify(rest)
      );
    }
    return true;
  } catch {
    return false;
  }
}
