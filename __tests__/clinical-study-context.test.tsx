import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  CLINICAL_STUDIES,
  CLINICAL_STUDY_STORAGE_KEY,
  DEMO_STUDY_ID,
  readSelectedStudy,
  writeSelectedStudy,
  type ClinicalStudyId,
} from "@/lib/clinical-study-context";
import {
  buildTlfOutputs,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
} from "@/lib/study-data";
import { StudyPicker } from "@/components/clinical/StudyPicker";

class MockStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ThrowingStorage extends MockStorage {
  override getItem(): string | null {
    throw new DOMException("blocked", "SecurityError");
  }
  override setItem(): void {
    throw new DOMException("blocked", "SecurityError");
  }
}

function useStorage(store: Storage) {
  vi.spyOn(window, "sessionStorage", "get").mockReturnValue(store);
}

describe("clinical study context (#3157)", () => {
  beforeEach(() => useStorage(new MockStorage()));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("defaults to DEMO-301 when nothing is stored", () => {
    expect(readSelectedStudy()).toBe(DEMO_STUDY_ID);
  });

  it("reads back a written study from the tab's storage", () => {
    expect(writeSelectedStudy(DEMO_STUDY_ID)).toBe(true);
    expect(window.sessionStorage.getItem(CLINICAL_STUDY_STORAGE_KEY)).toBe(
      DEMO_STUDY_ID
    );
    expect(readSelectedStudy()).toBe(DEMO_STUDY_ID);
  });

  it("ignores a stored value that is not a known study", () => {
    window.sessionStorage.setItem(CLINICAL_STUDY_STORAGE_KEY, "DEMO-999");
    expect(readSelectedStudy()).toBe(DEMO_STUDY_ID);
    expect(writeSelectedStudy("DEMO-999" as ClinicalStudyId)).toBe(false);
  });

  it("falls back to DEMO-301 when sessionStorage throws", () => {
    useStorage(new ThrowingStorage());
    expect(readSelectedStudy()).toBe(DEMO_STUDY_ID);
    expect(writeSelectedStudy(DEMO_STUDY_ID)).toBe(false);
  });

  it("falls back to DEMO-301 when the sessionStorage getter throws", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readSelectedStudy()).toBe(DEMO_STUDY_ID);
    expect(writeSelectedStudy(DEMO_STUDY_ID)).toBe(false);
  });

  it("keeps the summary counts in step with a default pipeline run", () => {
    const run = runPipeline(DEMO_301_STUDY, {
      seed: DEFAULT_SEED,
      nSubjects: DEFAULT_SUBJECT_COUNT,
    });
    const layer = (name: string) =>
      run.datasets.filter((dataset) => dataset.layer === name).length;
    const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
    const summary = CLINICAL_STUDIES[DEMO_STUDY_ID];
    expect(summary.datasets).toBe(layer("sdtm") + layer("adam"));
    expect(summary.tlfs).toBe(outputs.tables.length + outputs.figures.length);
    expect(summary.forms).toBe(DEMO_301_STUDY.design.activities.length);
    expect(summary.title).toBe(DEMO_301_STUDY.title);
  });
});

describe("StudyPicker (#3157)", () => {
  beforeEach(() => useStorage(new MockStorage()));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows DEMO-301 in a labelled select with the synthetic label and summary", () => {
    render(<StudyPicker />);
    const select = screen.getByLabelText("Study") as HTMLSelectElement;
    expect(select.value).toBe(DEMO_STUDY_ID);
    expect(select.options).toHaveLength(1);
    expect(screen.getByText("Synthetic data")).toBeTruthy();
    const summary = screen.getByTestId("study-picker-summary").textContent;
    expect(summary).toContain(DEMO_301_STUDY.title);
    expect(summary).toContain("8\u00a0forms · 28\u00a0datasets · 5\u00a0TLFs");
  });

  it("re-renders when the stored study changes in the tab", () => {
    render(<StudyPicker />);
    act(() => {
      writeSelectedStudy(DEMO_STUDY_ID);
    });
    expect((screen.getByLabelText("Study") as HTMLSelectElement).value).toBe(
      DEMO_STUDY_ID
    );
  });

  it("still renders DEMO-301 when storage throws", () => {
    useStorage(new ThrowingStorage());
    render(<StudyPicker />);
    expect((screen.getByLabelText("Study") as HTMLSelectElement).value).toBe(
      DEMO_STUDY_ID
    );
  });
});
