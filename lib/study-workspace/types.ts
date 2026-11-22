import type { UsdmV4Document } from "@/lib/clinical-standards";

/**
 * Type contracts for the study workspace: one file that holds a USDM study
 * together with where it came from, which version and design are being
 * worked on, and which revision this is (epic #3071, step 2).
 */

/** Version of the workspace file shape. Bump it when the fields change. */
export const STUDY_WORKSPACE_VERSION = 1;

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

/** A reversible edit: the patch, the patch that undoes it, and its note. */
export interface StudyEdit {
  readonly note: string;
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
