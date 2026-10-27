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
