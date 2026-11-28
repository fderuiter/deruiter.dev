/**
 * Public type contracts for the unified secret-scanning catalog.
 */

/**
 * Which scanning surfaces a detector is safe/intended to run under.
 *
 * - `contentGuard`: repository working-tree and pre-commit staged-file scans
 *   outside `__tests__/`. Includes every `historyAudit` detector plus broader
 *   assignment and bare-connection heuristics (`database-url-bare` and
 *   `generic-assigned-secret`).
 * - `historyAudit`: high-confidence, low-false-positive detectors run across
 *   every eligible non-binary repository file (including `__tests__/`) and
 *   across reachable Git history via pickaxe search.
 */
export type ScannerSurface = "contentGuard" | "historyAudit";

/** Raw text or byte buffer accepted by repository-policy scanners. */
export type RepositoryScanContent = string | Uint8Array;

/**
 * A single secret detector: its identity, its live-text regex, and its
 * pickaxe-compatible (`git log -G`) representation for history scanning.
 */
export interface SecretDetector {
  readonly id: string;
  readonly description: string;
  readonly regex: RegExp;
  /** POSIX extended-regex form consumed by `git log -G<pattern>`. */
  readonly gitPattern: string;
  readonly appliesTo: readonly ScannerSurface[];
}

/**
 * Safe diagnostic metadata for a match: enough to locate and triage a
 * finding without ever carrying the candidate secret value itself.
 */
export interface ScanFinding {
  readonly detectorId: string;
  readonly category: string;
  readonly file: string;
  readonly line: number;
}

/** A {@link ScanFinding} located at a specific reachable commit. */
export interface HistoryFinding extends ScanFinding {
  readonly commit: string;
}

/** Safe (non-functional) positive and negative fixtures for a detector. */
export interface SecretDetectorFixtureSet {
  /** Values that MUST be reported when scanned (and are not allowlisted). */
  readonly positive: readonly string[];
  /** Values that MUST NOT be reported by this detector. */
  readonly negative: readonly string[];
}
