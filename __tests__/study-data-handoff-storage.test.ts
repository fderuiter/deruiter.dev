import { afterEach, describe, expect, it, vi } from "vitest";
import { createUsdmHandoff } from "@/lib/clinical-standards";
import {
  STUDY_DATA_HANDOFF_KEY,
  STUDY_DATA_HANDOFF_PATH,
  storeStudyHandoff,
  takeStudyHandoff,
} from "@/components/study-data/handoff-storage";

class MockStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

function useSessionStorage(storage: unknown) {
  vi.spyOn(window, "sessionStorage", "get").mockReturnValue(storage as Storage);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("study-data handoff storage", () => {
  it("stores a study and takes it exactly once", () => {
    const storage = new MockStorage();
    useSessionStorage(storage);
    const usdm = { usdmVersion: "4.0.0", study: { name: "S" } };
    expect(storeStudyHandoff(usdm)).toBeNull();
    expect(JSON.parse(storage.getItem(STUDY_DATA_HANDOFF_KEY)!)).toEqual(
      createUsdmHandoff(usdm, { source: "crf-studio", target: "study-data" })
    );
    expect(takeStudyHandoff()).toEqual({ status: "found", usdm });
    expect(storage.getItem(STUDY_DATA_HANDOFF_KEY)).toBeNull();
    expect(takeStudyHandoff()).toEqual({ status: "missing" });
  });

  it("sends the visitor to /study-data with the CRF source", () => {
    expect(STUDY_DATA_HANDOFF_PATH).toBe("/study-data?source=crf");
  });

  it.each([
    ["not JSON", "{"],
    [
      "the version 1 payload",
      JSON.stringify({ version: 1, source: "crf-studio", usdm: {} }),
    ],
    [
      "an envelope from another tool",
      JSON.stringify(
        createUsdmHandoff({}, { source: "study-data", target: "study-data" })
      ),
    ],
    [
      "an envelope for another tool",
      JSON.stringify(
        createUsdmHandoff({}, { source: "crf-studio", target: "crf-studio" })
      ),
    ],
    [
      "an envelope whose study was changed after hashing",
      JSON.stringify({
        ...createUsdmHandoff(
          { study: { name: "A" } },
          { source: "crf-studio", target: "study-data" }
        ),
        usdm: { study: { name: "B" } },
      }),
    ],
    ["null", "null"],
  ])("treats %s as unreadable and still removes it", (_label, raw) => {
    const storage = new MockStorage();
    storage.setItem(STUDY_DATA_HANDOFF_KEY, raw);
    useSessionStorage(storage);
    expect(takeStudyHandoff()).toEqual({ status: "unreadable" });
    expect(storage.getItem(STUDY_DATA_HANDOFF_KEY)).toBeNull();
  });

  it("reports unavailable storage instead of throwing", () => {
    useSessionStorage(undefined);
    expect(storeStudyHandoff({})).toBe("unavailable");
    expect(takeStudyHandoff()).toEqual({ status: "unreadable" });
  });

  it("reports storage that throws on access as unavailable", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(storeStudyHandoff({})).toBe("unavailable");
    expect(takeStudyHandoff()).toEqual({ status: "unreadable" });
  });

  it("reports a study too large for the tab's storage", () => {
    const storage = new MockStorage();
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    useSessionStorage(storage);
    expect(storeStudyHandoff({})).toBe("too-large");
  });

  it("reports a read that throws as unreadable", () => {
    const storage = new MockStorage();
    storage.getItem = () => {
      throw new Error("denied");
    };
    useSessionStorage(storage);
    expect(takeStudyHandoff()).toEqual({ status: "unreadable" });
  });
});
