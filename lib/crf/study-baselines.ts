import type { StudyProtocol, StudyBaseline, StudyBaselineActor } from "./types";
import {
  isStudyProtocolShape,
  resolveStorage,
  deterministicStringify,
} from "./study-draft-storage";
import { generateEngineId } from "./precision-date";
import { cloneDeep } from "../utils";
import type { RawStorage } from "../safe-storage";

/**
 * localStorage key holding the author's immutable, version-tagged study baseline snapshots.
 */
export const STUDY_BASELINES_STORAGE_KEY = "crf_studio_baselines_v1";

/**
 * Backup key an unreadable or corrupt baselines collection is copied to before the primary key
 * is reset or purged, ensuring historical data is never silently destroyed.
 */
export const STUDY_BASELINES_CORRUPT_BACKUP_KEY =
  "crf_studio_baselines_v1_corrupt";

/**
 * Maximum number of baselines retained in local storage to avoid storage exhaustion.
 */
export const STUDY_BASELINES_MAX_COUNT = 50;

export interface SaveStudyBaselineOptions {
  versionTag: string;
  label: string;
  description?: string;
  actor: StudyBaselineActor;
  parentBaselineId?: string;
}

export type SaveStudyBaselineResult =
  | { status: "saved"; baseline: StudyBaseline }
  | { status: "unavailable" }
  | { status: "validation_error"; message: string }
  | { status: "error"; message: string };

export interface RestoreStudyBaselineOptions {
  actorName?: string;
  incrementVersion?: boolean;
  notes?: string;
}

export type RestoreStudyBaselineResult =
  | {
      status: "restored";
      study: StudyProtocol;
      baseline: StudyBaseline;
      provenanceNote: string;
    }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string };

export interface BaselinesExportBundle {
  bundleVersion: number;
  exportedAt: string;
  count: number;
  baselines: StudyBaseline[];
}

/**
 * Type guard asserting whether an unknown object complies with the StudyBaseline contract.
 */
export function isStudyBaselineShape(value: unknown): value is StudyBaseline {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.versionTag === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.createdAt === "string" &&
    candidate.actor !== null &&
    typeof candidate.actor === "object" &&
    typeof (candidate.actor as Record<string, unknown>).name === "string" &&
    isStudyProtocolShape(candidate.study)
  );
}

/**
 * Computes a deterministic hexadecimal hash for a study protocol snapshot to guard against tampering.
 */
export function computeStudyChecksum(study: StudyProtocol): string {
  const serialized = deterministicStringify(study);
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Increments a semver or dotted version string for a restored draft.
 * Examples: "1.0" -> "1.1", "v1.0.0" -> "v1.0.1", "1" -> "2".
 */
export function incrementStudyVersion(version: string): string {
  if (!version || typeof version !== "string") return "1.0";
  const trimmed = version.trim();
  const vPrefix =
    trimmed.startsWith("v") || trimmed.startsWith("V") ? trimmed[0] : "";
  const core = vPrefix ? trimmed.slice(1) : trimmed;

  const parts = core.split(".");
  if (parts.length >= 1 && parts.every((p) => /^\d+$/.test(p))) {
    const lastIdx = parts.length - 1;
    const nextLast = parseInt(parts[lastIdx], 10) + 1;
    parts[lastIdx] = nextLast.toString();
    return `${vPrefix}${parts.join(".")}`;
  }

  return `${trimmed}-draft`;
}

/**
 * Backs up unparseable or corrupted baselines storage content before recovery.
 */
function preserveCorruptBaselines(storage: RawStorage, raw: string): void {
  try {
    storage.setItem(STUDY_BASELINES_CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Best-effort preservation
  }
}

/**
 * Lists all persisted study baselines in reverse chronological order.
 */
export function listStudyBaselines(storage?: RawStorage): StudyBaseline[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  // A store that throws on access reads as empty, never as a crash (#1632).
  let raw: string | null;
  try {
    raw = target.getItem(STUDY_BASELINES_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    preserveCorruptBaselines(target, raw);
    return [];
  }

  if (!Array.isArray(parsed)) {
    preserveCorruptBaselines(target, raw);
    return [];
  }

  return parsed
    .filter(isStudyBaselineShape)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Retrieves a single persisted study baseline by its unique ID or exact version tag.
 */
export function getStudyBaseline(
  baselineIdOrTag: string,
  storage?: RawStorage
): StudyBaseline | null {
  const baselines = listStudyBaselines(storage);
  return (
    baselines.find(
      (b) => b.id === baselineIdOrTag || b.versionTag === baselineIdOrTag
    ) || null
  );
}

/**
 * Persists an immutable, version-tagged study baseline snapshot.
 * Deep-clones the study snapshot so subsequent mutations to the working draft
 * cannot alter the historical baseline.
 */
export function saveStudyBaseline(
  study: StudyProtocol,
  options: SaveStudyBaselineOptions,
  storage?: RawStorage
): SaveStudyBaselineResult {
  const target = resolveStorage(storage);
  if (!target) return { status: "unavailable" };

  const versionTag = options.versionTag?.trim();
  if (!versionTag) {
    return {
      status: "validation_error",
      message: "Version tag is required for baseline snapshot (e.g. 'v1.0').",
    };
  }

  const label = options.label?.trim();
  if (!label) {
    return {
      status: "validation_error",
      message: "A descriptive label is required for the baseline snapshot.",
    };
  }

  const actorName = options.actor?.name?.trim();
  if (!actorName) {
    return {
      status: "validation_error",
      message:
        "Author/actor name is required to establish baseline provenance.",
    };
  }

  // Deep clone the study to guarantee complete reference isolation and immutability
  const clonedStudy: StudyProtocol = cloneDeep(study);
  const checksum = computeStudyChecksum(clonedStudy);
  const createdAt = new Date().toISOString();

  // Compute provenance statistics
  const totalForms = clonedStudy.forms.length;
  const totalVisits = clonedStudy.visits.length;
  const totalRules =
    (clonedStudy.rules?.length || 0) +
    clonedStudy.forms.reduce((acc, f) => acc + (f.rules?.length || 0), 0);
  const totalFields = clonedStudy.forms.reduce(
    (acc, f) =>
      acc +
      f.sections.reduce((sAcc, sec) => sAcc + (sec.fields?.length || 0), 0),
    0
  );

  const baseline: StudyBaseline = {
    id: generateEngineId("base"),
    versionTag,
    label,
    description: options.description?.trim() || undefined,
    createdAt,
    actor: {
      name: actorName,
      role: options.actor.role?.trim() || "Clinical Data Manager",
      email: options.actor.email?.trim() || undefined,
    },
    study: clonedStudy,
    checksum,
    provenance: {
      parentBaselineId: options.parentBaselineId,
      totalForms,
      totalVisits,
      totalRules,
      totalFields,
    },
  };

  try {
    const existing = listStudyBaselines(target);
    // Disallow duplicate version tags to prevent ambiguous version references
    const hasDuplicateTag = existing.some(
      (b) => b.versionTag.toLowerCase() === versionTag.toLowerCase()
    );
    if (hasDuplicateTag) {
      return {
        status: "validation_error",
        message: `A baseline with version tag '${versionTag}' already exists. Use a unique tag.`,
      };
    }

    const updated = [baseline, ...existing].slice(0, STUDY_BASELINES_MAX_COUNT);
    target.setItem(STUDY_BASELINES_STORAGE_KEY, JSON.stringify(updated));
    return { status: "saved", baseline };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to persist study baseline",
    };
  }
}

/**
 * Restores an immutable baseline snapshot into a fresh working draft.
 * The original baseline snapshot in storage is kept 100% intact and untouched.
 * The restored study receives clear provenance metadata documenting its origin.
 */
export function restoreBaselineAsDraft(
  baselineOrId: StudyBaseline | string,
  options?: RestoreStudyBaselineOptions,
  storage?: RawStorage
): RestoreStudyBaselineResult {
  let baseline: StudyBaseline | null = null;
  if (typeof baselineOrId === "string") {
    baseline = getStudyBaseline(baselineOrId, storage);
    if (!baseline) {
      return {
        status: "not_found",
        message: `Study baseline with identifier '${baselineOrId}' was not found.`,
      };
    }
  } else if (isStudyBaselineShape(baselineOrId)) {
    baseline = baselineOrId;
  } else {
    return {
      status: "error",
      message: "Invalid study baseline provided for restoration.",
    };
  }

  // Deep clone the baseline study so mutations to the new draft never affect the baseline
  const draftStudy: StudyProtocol = cloneDeep(baseline.study);

  const restoredAt = new Date().toISOString();
  const actorName = options?.actorName?.trim() || baseline.actor.name;
  const provenanceNote = `Draft restored from immutable baseline ${
    baseline.versionTag
  } ("${baseline.label}") on ${new Date(restoredAt).toLocaleDateString()}`;

  draftStudy.provenance = {
    derivedFromBaselineId: baseline.id,
    derivedFromVersionTag: baseline.versionTag,
    restoredAt,
    restoredBy: actorName,
    notes: options?.notes?.trim() || provenanceNote,
  };

  if (options?.incrementVersion) {
    draftStudy.version = incrementStudyVersion(
      draftStudy.version || baseline.versionTag
    );
  }

  draftStudy.lastModified = restoredAt;

  return {
    status: "restored",
    study: draftStudy,
    baseline,
    provenanceNote,
  };
}

/**
 * Removes a specific baseline from storage by ID.
 */
export function deleteStudyBaseline(
  baselineId: string,
  storage?: RawStorage
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    const existing = listStudyBaselines(target);
    const filtered = existing.filter((b) => b.id !== baselineId);
    if (filtered.length === existing.length) return false;
    target.setItem(STUDY_BASELINES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all stored study baselines from storage.
 */
export function clearStudyBaselines(storage?: RawStorage): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(STUDY_BASELINES_STORAGE_KEY);
  } catch {
    // Best-effort
  }
}

/**
 * Exports all persisted study baselines as a serialized JSON bundle.
 */
export function exportBaselinesBundle(storage?: RawStorage): string {
  const baselines = listStudyBaselines(storage);
  const bundle: BaselinesExportBundle = {
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    count: baselines.length,
    baselines,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Imports a JSON bundle of baselines into local storage, skipping duplicates.
 */
export function importBaselinesBundle(
  rawJson: string,
  storage?: RawStorage
): { imported: number; skipped: number } {
  const target = resolveStorage(storage);
  if (!target) return { imported: 0, skipped: 0 };

  try {
    const parsed = JSON.parse(rawJson);
    const candidateList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.baselines)
        ? parsed.baselines
        : [];

    const existing = listStudyBaselines(target);
    const existingIds = new Set(existing.map((b) => b.id));
    const existingTags = new Set(
      existing.map((b) => b.versionTag.toLowerCase())
    );

    let imported = 0;
    let skipped = 0;
    const toAdd: StudyBaseline[] = [];

    for (const item of candidateList) {
      if (!isStudyBaselineShape(item)) {
        skipped++;
        continue;
      }
      if (
        existingIds.has(item.id) ||
        existingTags.has(item.versionTag.toLowerCase())
      ) {
        skipped++;
        continue;
      }

      toAdd.push(item);
      existingIds.add(item.id);
      existingTags.add(item.versionTag.toLowerCase());
      imported++;
    }

    if (toAdd.length > 0) {
      const combined = [...toAdd, ...existing].slice(
        0,
        STUDY_BASELINES_MAX_COUNT
      );
      target.setItem(STUDY_BASELINES_STORAGE_KEY, JSON.stringify(combined));
    }

    return { imported, skipped };
  } catch {
    return { imported: 0, skipped: 0 };
  }
}
