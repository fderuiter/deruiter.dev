import { describe, it, expect, beforeEach } from "vitest";
import {
  saveStudyDraft,
  loadStudyDraft,
  STUDY_DRAFT_STORAGE_KEY,
  STUDY_DRAFT_CORRUPT_BACKUP_KEY,
  STUDY_DRAFT_ENVELOPE_VERSION,
} from "@/lib/crf/study-draft-storage";
import type { StudyProtocol } from "@/lib/crf/types";
import { listStudyBaselines } from "@/lib/crf/study-baselines";
import { loadPersonalLibrary } from "@/lib/crf/personal-library";

// Regression coverage for #657: authors must be able to recover their most
// recently acknowledged local draft after a refresh, and a corrupt or
// version-mismatched entry must be preserved for recovery rather than
// silently overwritten.

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class ThrowingReadStorage extends MockStorage {
  getItem(): string | null {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
}

class QuotaExceededStorage extends MockStorage {
  setItem(): void {
    const err = new DOMException("Quota exceeded", "QuotaExceededError");
    throw err;
  }
}

function buildStudy(overrides: Partial<StudyProtocol> = {}): StudyProtocol {
  return {
    id: "study-1",
    protocolNumber: "ONC-001",
    studyName: "Test Study",
    phase: "Phase II",
    sponsor: "Acme",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [],
    visits: [],
    codelists: [],
    ...overrides,
  };
}

describe("study draft storage (#657)", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("returns empty when no draft has ever been saved", () => {
    expect(loadStudyDraft(storage)).toEqual({ status: "empty" });
  });

  it("recovers an identical study after a save/load round trip (simulating a refresh)", () => {
    const study = buildStudy({
      forms: [{ id: "f1" } as StudyProtocol["forms"][number]],
    });

    const saveResult = saveStudyDraft(study, storage);
    expect(saveResult.status).toBe("saved");

    const loaded = loadStudyDraft(storage);
    expect(loaded.status).toBe("recovered");
    if (loaded.status === "recovered") {
      expect(loaded.study).toEqual(study);
    }
  });

  it("versions the stored envelope", () => {
    const study = buildStudy();
    saveStudyDraft(study, storage);
    const raw = storage.getItem(STUDY_DRAFT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.envelopeVersion).toBe(STUDY_DRAFT_ENVELOPE_VERSION);
  });

  it("preserves an unreadable original instead of silently overwriting it", () => {
    storage.setItem(STUDY_DRAFT_STORAGE_KEY, "{not valid json");

    const result = loadStudyDraft(storage);
    expect(result.status).toBe("corrupt");
    expect(storage.getItem(STUDY_DRAFT_CORRUPT_BACKUP_KEY)).toBe(
      "{not valid json"
    );
  });

  it("treats a version-mismatched envelope as corrupt and preserves it", () => {
    storage.setItem(
      STUDY_DRAFT_STORAGE_KEY,
      JSON.stringify({
        envelopeVersion: 999,
        savedAt: "2026-01-01T00:00:00.000Z",
        study: buildStudy(),
      })
    );

    const result = loadStudyDraft(storage);
    expect(result.status).toBe("corrupt");
    expect(storage.getItem(STUDY_DRAFT_CORRUPT_BACKUP_KEY)).toBeTruthy();
  });

  it("reports a quota/unavailable storage failure without throwing", () => {
    const failing = new QuotaExceededStorage();
    const result = saveStudyDraft(buildStudy(), failing);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBeTruthy();
    }
  });

  it("returns empty instead of throwing when reading storage throws (#1632)", () => {
    const throwing = new ThrowingReadStorage();
    expect(() => loadStudyDraft(throwing)).not.toThrow();
    expect(loadStudyDraft(throwing)).toEqual({ status: "empty" });
    // The baseline manager and personal library read on the same mount.
    expect(listStudyBaselines(throwing)).toEqual([]);
    expect(loadPersonalLibrary(throwing)).toEqual({ status: "empty" });
  });
});
