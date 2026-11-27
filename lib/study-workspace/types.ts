import type { UsdmV4Document } from "@/lib/clinical-standards";
import type {
  RandomizationAlgorithmId,
  RandomizationRequest,
  ValidationFinding,
} from "@/lib/randomization";

/**
 * Type contracts for the study workspace: one file that holds a USDM study
 * together with where it came from, which version and design are being
 * worked on, and which revision this is (epic #3071, step 2).
 */

/**
 * Version of the workspace file shape. Bump it when the fields change.
 * Version 2 adds `analyses`, `randomizationPlans` and the revision's
 * `payloadSha256` (#4003, ADR 0073 section 6); version 1 files still open
 * and are read as version 2 with empty collections.
 */
export const STUDY_WORKSPACE_VERSION = 2;

/** Where the study came from. Never edited after import. */
export interface StudyWorkspaceSource {
  /** The file name the person opened, when there was one. */
  readonly fileName: string | null;
  /** SHA-256 of the imported document's canonical JSON. */
  readonly sha256: string;
  /** `systemName` the producing tool wrote, or null. */
  readonly systemName: string | null;
  /** `systemVersion` the producing tool wrote, or null. */
  readonly systemVersion: string | null;
  /** `usdmVersion` of the imported document. */
  readonly usdmVersion: string;
  /** The imported document exactly as parsed. */
  readonly original: unknown;
}

/** The study version and design the workspace works on. */
export interface StudyWorkspaceSelection {
  readonly studyVersionId: string;
  readonly studyDesignId: string;
}

/** One immutable revision of the working study. */
export interface StudyWorkspaceRevision {
  /** `R1` for the import, then `R2`, `R3`, ... */
  readonly id: string;
  /** The revision this one was made from; null for the import. */
  readonly parentId: string | null;
  /** What changed, in the author's words. */
  readonly note: string;
  /** SHA-256 of the working USDM document's canonical JSON. */
  readonly sha256: string;
  /**
   * SHA-256 of the canonical JSON of the whole working payload: `usdm`,
   * `analyses` and `randomizationPlans`. `sha256` keeps the USDM-only
   * meaning version 1 files had, so a plan edit changes this hash only.
   */
  readonly payloadSha256: string;
}

/** Standards versions the workspace was checked against. */
export interface StudyWorkspaceLocks {
  readonly USDM: string;
  readonly ctPackageDate: string;
}

/** Why some content is kept but not edited here. */
export type PreservedReason =
  "other-study-version" | "other-study-design" | "extension-attributes";

/** Content the workspace keeps untouched and writes back on export. */
export interface PreservedItem {
  /** Dotted path into the USDM document, e.g. `study.versions.1`. */
  readonly path: string;
  readonly reason: PreservedReason;
  /** A short human label, e.g. the version identifier or design name. */
  readonly label: string;
}

/** A study open for work. */
export interface StudyWorkspace {
  readonly workspaceVersion: typeof STUDY_WORKSPACE_VERSION;
  readonly source: StudyWorkspaceSource;
  readonly selection: StudyWorkspaceSelection;
  readonly revision: StudyWorkspaceRevision;
  /** The working study definition. */
  readonly usdm: UsdmV4Document;
  readonly locks: StudyWorkspaceLocks;
  readonly preserved: readonly PreservedItem[];
  /**
   * Analysis specifications (#3423). The workspace keeps them exactly as
   * written and never edits or drops them; their shape belongs to #3423.
   */
  readonly analyses: readonly unknown[];
  /** Randomization plans bound to the selected design (#4003). */
  readonly randomizationPlans: readonly StudyRandomizationPlan[];
}

/** One study version and its designs, offered when a choice is needed. */
export interface StudyVersionChoice {
  readonly studyVersionId: string;
  readonly versionIdentifier: string;
  readonly designs: readonly { readonly id: string; readonly name: string }[];
}

/** Counts of what the selected design holds, all read from the file. */
export interface StudyContentCounts {
  readonly arms: number;
  readonly epochs: number;
  readonly encounters: number;
  readonly activities: number;
  readonly objectives: number;
  readonly endpoints: number;
  readonly estimands: number;
  readonly eligibilityCriteria: number;
}

/** What an import found. */
export interface StudyImportReport {
  /** Schema issues as `path: message`; the import still succeeds. */
  readonly schemaIssues: readonly string[];
  readonly counts: StudyContentCounts;
  readonly preserved: readonly PreservedItem[];
}

/** Why a document could not be imported at all. */
export type StudyImportProblem =
  | { readonly code: "not-json"; readonly message: string }
  | { readonly code: "not-usdm-v4"; readonly message: string }
  | { readonly code: "no-study-version"; readonly message: string }
  | { readonly code: "no-study-design"; readonly message: string }
  | { readonly code: "duplicate-id"; readonly message: string }
  | { readonly code: "unknown-selection"; readonly message: string };

/** The result of importing a USDM document. */
export type StudyImportResult =
  | {
      readonly status: "ok";
      readonly workspace: StudyWorkspace;
      readonly report: StudyImportReport;
    }
  | {
      readonly status: "needs-selection";
      readonly choices: readonly StudyVersionChoice[];
    }
  | {
      readonly status: "rejected";
      readonly problems: readonly StudyImportProblem[];
    };

/** Why a saved workspace file could not be opened. */
export type StudyWorkspaceFileProblem =
  | "not-json"
  | "not-a-workspace"
  | "unsupported-version"
  | "revision-hash-mismatch";

/** The result of opening a saved workspace file. */
export type OpenStudyWorkspaceResult =
  | { readonly status: "ok"; readonly workspace: StudyWorkspace }
  | { readonly status: "invalid"; readonly problem: StudyWorkspaceFileProblem };

/** A value a blank study holds only because the USDM v4 schema needs it. */
export interface BlankStudyPlaceholder {
  /** Dotted path into the USDM document, e.g. `study.versions.0.titles`. */
  readonly path: string;
  /** A short human label for the studio to show. */
  readonly label: string;
  /** The value filled in, as the studio shows it. */
  readonly value: string;
}

/** A workspace started from a blank study (#3399). */
export interface BlankStudyWorkspace {
  readonly workspace: StudyWorkspace;
  /** Schema issues of the blank document; empty unless this module is wrong. */
  readonly schemaIssues: readonly string[];
  /** Every value filled in only to satisfy the schema, for the studio to show. */
  readonly placeholders: readonly BlankStudyPlaceholder[];
}

/**
 * One RFC 6902 JSON Patch operation on the working USDM document. `path` is
 * an RFC 6901 JSON Pointer such as `/study/versions/0/studyDesigns/0/name`.
 */
export type StudyPatchOperation =
  | { readonly op: "add"; readonly path: string; readonly value: unknown }
  | { readonly op: "remove"; readonly path: string }
  | { readonly op: "replace"; readonly path: string; readonly value: unknown };

/**
 * A reversible edit: the patch, the patch that undoes it, and its note.
 * Paths are rooted at the USDM document, or with `scope: "payload"` at the
 * working payload `{ usdm, analyses, randomizationPlans }`.
 */
export interface StudyEdit {
  readonly note: string;
  readonly scope?: "usdm" | "payload";
  /**
   * The revision the edit was made on. `applyStudyEdit` refuses the edit
   * on any other revision, so an edit from a stale view never lands.
   */
  readonly madeOn?: string;
  readonly forward: readonly StudyPatchOperation[];
  readonly inverse: readonly StudyPatchOperation[];
}

/** Edits that can be undone and redone, most recent last. */
export interface StudyEditHistory {
  readonly undo: readonly StudyEdit[];
  readonly redo: readonly StudyEdit[];
}

/** The result of a validating USDM export. */
export type ValidatedStudyExport =
  | {
      readonly status: "ok";
      /** Canonical JSON: sorted keys, no whitespace. */
      readonly json: string;
      /** SHA-256 of `json`, the current revision's hash. */
      readonly sha256: string;
    }
  | { readonly status: "invalid"; readonly issues: readonly string[] };

/** A coded term the design view shows: its NCI code and decode. */
/** An intervention the selected design uses (#3406). */
export interface StudyInterventionView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The coded role, or null when the study leaves it out. */
  readonly role: StudyDesignTerm | null;
  /** The coded type, or null when the study leaves it out. */
  readonly type: StudyDesignTerm | null;
  /** Whether the design's `studyInterventionIds` lists it. */
  readonly listed: boolean;
  /** The design's elements that give it. */
  readonly elementIds: readonly string[];
}

export interface StudyDesignTerm {
  readonly code: string;
  readonly decode: string;
}

/** One arm of the design grid, keyed by its USDM id. */
export interface StudyDesignArm {
  readonly id: string;
  readonly name: string;
  /** The arm type, or null when the study leaves it out. */
  readonly type: StudyDesignTerm | null;
  /** The data origin type, or null when the study leaves it out. */
  readonly dataOrigin: StudyDesignTerm | null;
}

/** One epoch of the design grid, keyed by its USDM id. */
export interface StudyDesignEpoch {
  readonly id: string;
  readonly name: string;
  /** The epoch type, or null when the study leaves it out. */
  readonly type: StudyDesignTerm | null;
}

/** A study element placed in a cell. */
export interface StudyDesignElement {
  readonly id: string;
  readonly name: string;
}

/** The cell at one arm and epoch. `cellId` is null when there is none. */
export interface StudyDesignGridCell {
  readonly armId: string;
  readonly epochId: string;
  readonly cellId: string | null;
  readonly elements: readonly StudyDesignElement[];
}

/** One row of the grid: an arm and its cell in each epoch, in epoch order. */
export interface StudyDesignGridRow {
  readonly arm: StudyDesignArm;
  readonly cells: readonly StudyDesignGridCell[];
}

/** What the design view found the study leaves out or gets wrong. */
export type StudyDesignFindingKind =
  | "missing-cell"
  | "duplicate-cell"
  | "orphan-cell"
  | "unknown-element"
  | "epoch-order";

/** A finding, with the USDM ids it is about. */
export interface StudyDesignFinding {
  readonly kind: StudyDesignFindingKind;
  readonly message: string;
  readonly ids: readonly string[];
}

/** The arms-by-epochs view of the selected study design. */
export interface StudyDesignGrid {
  readonly designId: string;
  readonly arms: readonly StudyDesignArm[];
  /** Epochs in study order: the `previousId`/`nextId` chain when it holds. */
  readonly epochs: readonly StudyDesignEpoch[];
  readonly rows: readonly StudyDesignGridRow[];
  readonly findings: readonly StudyDesignFinding[];
}

/** An arm and epoch pair that names one cell. */
export interface StudyDesignCellRef {
  readonly armId: string;
  readonly epochId: string;
}

/**
 * Where a randomization plan stands. None of these means clinical approval:
 * "acknowledged-reference" only records that someone marked the plan as the
 * one to compare against (RND-WORKS-009).
 */
export type StudyRandomizationPlanState =
  "draft" | "exploration" | "acknowledged-reference";

/** One USDM arm in a plan, by its USDM id, with its allocation ratio. */
export interface StudyRandomizationPlanArm {
  readonly armId: string;
  /** The short code shown in schedules, such as "A". */
  readonly code: string;
  readonly allocationRatio: number;
}

/**
 * A randomization plan kept in the workspace. Arms refer to the selected
 * design by USDM id and take their labels from it. Everything else the
 * engine needs (method, algorithm, sites, factors, caps, seed, subject id
 * mask, enrollment target and settings) is in `mechanics` as written, and
 * is checked when the plan is resolved, never guessed. Sites and
 * recruitment weights are simulation assumptions, not USDM facts.
 */
export interface StudyRandomizationPlan {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly name: string;
  readonly state: StudyRandomizationPlanState;
  readonly studyVersionId: string;
  readonly studyDesignId: string;
  readonly arms: readonly StudyRandomizationPlanArm[];
  readonly mechanics: Readonly<Record<string, unknown>>;
}

/** Why a plan cannot be run yet. */
export type StudyRandomizationPlanFindingCode =
  | "unknown-plan"
  | "different-design"
  | "unknown-arm"
  | "unmapped-arm"
  | "duplicate-arm"
  | "invalid-request";

/** A draft finding on a plan, with the engine's own finding when it has one. */
export interface StudyRandomizationPlanFinding {
  readonly code: StudyRandomizationPlanFindingCode;
  readonly message: string;
  readonly engineFinding?: ValidationFinding;
}

/** A plan resolved against the current workspace revision. */
export type ResolvedStudyRandomizationPlan =
  | {
      readonly status: "ready";
      readonly request: RandomizationRequest;
      /** Digest of the whole request, provenance included. */
      readonly planDigest: string;
      /** Digest of the request without provenance: the numerical inputs. */
      readonly inputsDigest: string;
    }
  | {
      readonly status: "draft";
      readonly findings: readonly StudyRandomizationPlanFinding[];
    };

/**
 * What a randomization artifact was made from. It is kept with the
 * artifact, outside the workspace payload, so it never changes the hash of
 * the revision it names.
 */
export interface StudyRandomizationEvidenceBinding {
  readonly planId: string;
  readonly sourceSha256: string;
  readonly studyVersionId: string;
  readonly studyDesignId: string;
  readonly workspaceRevisionId: string;
  readonly usdmSha256: string;
  readonly payloadSha256: string;
  readonly planDigest: string;
  readonly inputsDigest: string;
  readonly algorithmId: RandomizationAlgorithmId;
  readonly contractVersion: number;
  readonly planSchemaVersion: number;
  readonly artifactSchemaVersion: number;
}

/** Why evidence no longer matches the workspace. */
export type StudyRandomizationStaleReason =
  | "different-source"
  | "different-design"
  | "plan-removed"
  | "plan-not-ready"
  | "inputs-changed"
  | "engine-changed";

/**
 * Whether evidence still matches: `current` when nothing changed,
 * `provenance-changed` when the revision moved on but the numerical inputs
 * are the same, and `stale` with the reasons otherwise.
 */
export type StudyRandomizationEvidenceStatus =
  | { readonly status: "current" }
  | { readonly status: "provenance-changed" }
  | {
      readonly status: "stale";
      readonly reasons: readonly StudyRandomizationStaleReason[];
    };

/** Largest `.usdm.json` or `.study.json` file import accepted (25 MiB). */
export const MAX_STUDY_IMPORT_BYTES = 25 * 1024 * 1024;

/** Where the study repository holds its records in the current browser tab. */
export type StudyRepositoryPersistence = "indexeddb" | "memory";

/** How a study entered the local repository catalog. */
export type StudyRepositoryKind =
  "reference" | "imported" | "authored" | "migrated";

/** One persisted study workspace record in the shared browser repository. */
export interface StudyRepositoryRecord {
  readonly studyId: string;
  readonly kind: StudyRepositoryKind;
  readonly title: string;
  readonly protocolCode: string;
  readonly workspace: StudyWorkspace;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lightweight summary of a repository study for selectors and drawers. */
export interface StudyRepositorySummary {
  readonly studyId: string;
  readonly kind: StudyRepositoryKind;
  readonly title: string;
  readonly protocolCode: string;
  readonly revisionId: string;
  readonly sha256: string;
  readonly selection: StudyWorkspaceSelection;
  readonly activityCount: number;
  readonly encounterCount: number;
  readonly armCount: number;
  readonly epochCount: number;
  readonly updatedAt: string;
}

/** Built-in reference study seed specification. */
export interface StudyRepositorySeed {
  readonly studyId: string;
  readonly title?: string;
  readonly protocolCode?: string;
  readonly usdm: UsdmV4Document;
  readonly selection?: StudyWorkspaceSelection;
}

/** Concurrency options when writing a study record into the repository. */
export interface StudyRepositorySaveOptions {
  /**
   * Expected current `workspace.revision.id` in storage. When set and
   * `force` is not true, a missing or mismatched stored revision rejects with
   * `StudyWorkspaceConflictError`.
   */
  readonly expectedRevisionId?: string;
  /** Explicit user-confirmed overwrite after a concurrent edit conflict. */
  readonly force?: boolean;
}

/** Stable failure codes raised by {@link StudyRepositoryStore}. */
export type StudyRepositoryStoreErrorCode =
  "STORE_UNAVAILABLE" | "QUOTA_EXCEEDED" | "TRANSACTION_ABORTED";

/** Storage engine contract implemented by IndexedDB and in-memory fallback. */
export interface StudyRepositoryStore {
  readonly persistence: StudyRepositoryPersistence;
  list(): Promise<readonly StudyRepositoryRecord[]>;
  get(studyId: string): Promise<StudyRepositoryRecord | null>;
  put(
    record: StudyRepositoryRecord,
    options?: StudyRepositorySaveOptions
  ): Promise<StudyRepositoryRecord>;
  seedIfMissing(seeds: readonly StudyRepositorySeed[]): Promise<void>;
  remove(studyId: string): Promise<void>;
  getActiveStudyId(): Promise<string | null>;
  setActiveStudyId(studyId: string | null): Promise<void>;
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
  close(): void;
}

/** Outcome of opening the IndexedDB study repository store. */
export type OpenStudyRepositoryStoreResult =
  | { readonly ok: true; readonly store: StudyRepositoryStore }
  | { readonly ok: false; readonly code: "STORE_UNAVAILABLE" };

/** Cross-tab synchronization messages sent over `BroadcastChannel`. */
export type StudyRepositorySyncEvent =
  | {
      readonly type: "active-study-changed";
      readonly studyId: string | null;
      readonly tabId: string;
      readonly updatedAt: string;
    }
  | {
      readonly type: "study-saved";
      readonly studyId: string;
      readonly revisionId: string;
      readonly sha256: string;
      readonly tabId: string;
      readonly updatedAt: string;
    }
  | {
      readonly type: "study-imported";
      readonly studyId: string;
      readonly revisionId: string;
      readonly tabId: string;
      readonly updatedAt: string;
    }
  | {
      readonly type: "study-deleted";
      readonly studyId: string;
      readonly nextActiveStudyId: string | null;
      readonly tabId: string;
      readonly updatedAt: string;
    };

/** Minimal `BroadcastChannel` shape accepted for dependency injection in tests. */
export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  close(): void;
}

/** Connected cross-tab notification handle. */
export interface StudyRepositorySyncHandle {
  readonly tabId: string;
  publish(
    event:
      | Omit<
          Extract<StudyRepositorySyncEvent, { type: "active-study-changed" }>,
          "tabId"
        >
      | Omit<
          Extract<StudyRepositorySyncEvent, { type: "study-saved" }>,
          "tabId"
        >
      | Omit<
          Extract<StudyRepositorySyncEvent, { type: "study-imported" }>,
          "tabId"
        >
      | Omit<
          Extract<StudyRepositorySyncEvent, { type: "study-deleted" }>,
          "tabId"
        >
  ): void;
  subscribe(listener: (event: StudyRepositorySyncEvent) => void): () => void;
  close(): void;
}

/** Input file descriptor for `.usdm.json` or `.study.json` import. */
export interface StudyRepositoryFileInput {
  readonly byteLength: number;
  readonly readText: () => Promise<string> | string;
  readonly fileName?: string | null;
  readonly selection?: StudyWorkspaceSelection;
}

/** Result of importing a `.usdm.json` or `.study.json` payload. */
export type ImportStudyRepositoryFileResult =
  | {
      readonly status: "ok";
      readonly format: "usdm" | "workspace";
      readonly workspace: StudyWorkspace;
      readonly report?: StudyImportReport;
    }
  | {
      readonly status: "needs-selection";
      readonly choices: readonly StudyVersionChoice[];
      readonly document: unknown;
      readonly fileName: string | null;
    }
  | {
      readonly status: "too-large";
      readonly maxBytes: number;
      readonly actualBytes: number;
    }
  | {
      readonly status: "invalid-workspace";
      readonly problem: StudyWorkspaceFileProblem;
    }
  | {
      readonly status: "rejected";
      readonly problems: readonly StudyImportProblem[];
    };

/** Options for reconciling an edited USDM v4 document back into a workspace. */
export interface ReconcileUsdmStudyOptions {
  readonly expectedRevisionId: string;
  readonly note: string;
  /** When true, returns the existing workspace if the canonical USDM hash did not change. */
  readonly skipIfUnchanged?: boolean;
}
