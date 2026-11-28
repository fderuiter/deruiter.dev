import { afterEach, describe, expect, it, vi } from "vitest";
import { createUsdmHandoff } from "@/lib/clinical-standards";
import {
  STUDY_DATA_HANDOFF_KEY,
  STUDY_DATA_HANDOFF_PATH,
  storeStudyHandoff,
  takeStudyHandoff,
} from "@/components/study-data/handoff-storage";
import {
  MockStorage,
  QuotaExceededStorage,
  ThrowingStorage,
  resetMockStorage,
} from "./helpers/storage-mock";

function useSessionStorage(storage: Storage | undefined) {
  resetMockStorage({ target: "sessionStorage", storage });
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
    useSessionStorage(new QuotaExceededStorage());
    expect(storeStudyHandoff({})).toBe("too-large");
  });

  it("reports a read that throws as unreadable", () => {
    useSessionStorage(new ThrowingStorage());
    expect(takeStudyHandoff()).toEqual({ status: "unreadable" });
  });
});
