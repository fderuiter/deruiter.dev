// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  createStudy,
} from "@/lib/study-director";
import {
  CAREER_KEY,
  emptyCareer,
  loadCareer,
  saveCareer,
} from "@/components/study-director/career";
import {
  clearStudySave,
  loadStudySave,
  saveStudy,
} from "@/components/study-director/useStudySave";

// #1641: the Study Director career and run save go through lib/safe-storage
// with the same keys and bytes, and a storage that throws or refuses a write
// leaves the game on its defaults instead of a value held only in memory.

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

const SAVE_KEY = "study_director_save_v1";

function study() {
  return createStudy(
    "storage-seed",
    STUDY_24_081,
    STUDY_24_081_SITES,
    STUDY_24_081_TEAM
  );
}

describe("Study Director storage through lib/safe-storage (#1641)", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores the career and the run under their keys as plain JSON", () => {
    const career = { ...emptyCareer(), finished: 2, bestStars: 3 };
    saveCareer(career);
    expect(storage.getItem(CAREER_KEY)).toBe(JSON.stringify(career));
    expect(loadCareer()).toEqual(career);

    const state = study();
    saveStudy(state);
    expect(storage.getItem(SAVE_KEY)).toBe(JSON.stringify(state));
    expect(loadStudySave()).toEqual(state);

    clearStudySave();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(loadStudySave()).toBeNull();
  });

  it("falls back to defaults when reading storage throws", () => {
    storage.setItem(CAREER_KEY, JSON.stringify(emptyCareer()));
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(loadCareer()).toEqual(emptyCareer());
    expect(loadStudySave()).toBeNull();
  });

  it("keeps no in-memory copy of a write storage refused", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(() => saveStudy(study())).not.toThrow();
    expect(() => saveCareer({ ...emptyCareer(), finished: 5 })).not.toThrow();
    expect(loadStudySave()).toBeNull();
    expect(loadCareer()).toEqual(emptyCareer());
  });
});
