import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { BaselineCompareModal } from "@/components/crf/BaselineCompareModal";
import { saveStudyBaseline } from "@/lib/crf/study-baselines";
import type { StudyProtocol, CRFForm } from "@/lib/crf/types";

vi.mock("@/lib/download", () => ({
  downloadFile: vi.fn().mockReturnValue(true),
}));

import { downloadFile } from "@/lib/download";

// Regression coverage for #676: authors must be able to open the baseline
// comparison panel, pick a saved baseline, see a readable diff grouped by
// category with text-equivalent change badges (never color alone), and
// navigate to a changed field/rule/visit. Also covers the required
// no-change demonstration.

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

function buildTestStudy(): StudyProtocol {
  const form: CRFForm = {
    id: "form_vs",
    name: "Vital Signs",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec_vs",
        title: "Vital Signs",
        fields: [
          {
            id: "fld_sysbp",
            variableName: "SYSBP",
            label: "Systolic Blood Pressure",
            dataType: "number",
            required: true,
            columnSpan: 4,
          },
        ],
      },
    ],
    rules: [],
  };

  return {
    id: "study-1",
    protocolNumber: "ONC-2026-TEST",
    studyName: "Phase III Study",
    phase: "Phase III",
    sponsor: "Acme",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [form],
    visits: [],
    codelists: [],
  };
}

describe("BaselineCompareModal (#676)", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty-state message when no baselines are saved yet", () => {
    const storage = new MockStorage();
    const study = buildTestStudy();

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={study}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    expect(screen.getByText(/No saved baselines yet/i)).toBeTruthy();
  });

  it("reports no differences when the draft matches the baseline exactly", () => {
    const storage = new MockStorage();
    const study = buildTestStudy();
    saveStudyBaseline(
      study,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={study}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    expect(screen.getByText(/No differences detected/i)).toBeTruthy();
  });

  it("lists a modified field with text-equivalent change badges and jumps to it on navigation", () => {
    const storage = new MockStorage();
    const baselineStudy = buildTestStudy();
    saveStudyBaseline(
      baselineStudy,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    const amendedStudy: StudyProtocol = {
      ...baselineStudy,
      forms: [
        {
          ...baselineStudy.forms[0],
          sections: [
            {
              ...baselineStudy.forms[0].sections[0],
              fields: [
                {
                  ...baselineStudy.forms[0].sections[0].fields[0],
                  label: "Systolic BP (Sitting)",
                },
              ],
            },
          ],
        },
      ],
    };

    const handleNavigate = vi.fn();
    const handleClose = vi.fn();

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={handleClose}
        study={amendedStudy}
        onSelectBaseline={vi.fn()}
        onNavigate={handleNavigate}
        storage={storage}
      />
    );

    // Change type is conveyed with a visible text label, not just color.
    expect(screen.getByText("Modified")).toBeTruthy();
    expect(
      screen.getByText(/Vital Signs › Vital Signs › Systolic BP/i)
    ).toBeTruthy();

    const jumpButton = screen.getByRole("button", { name: /Jump to/i });
    fireEvent.click(jumpButton);

    expect(handleNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "designer",
        formId: "form_vs",
        fieldId: "fld_sysbp",
      })
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("filters the diff list by category tab", () => {
    const storage = new MockStorage();
    const baselineStudy = buildTestStudy();
    saveStudyBaseline(
      baselineStudy,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    const amendedStudy: StudyProtocol = {
      ...baselineStudy,
      studyName: "Phase III Study (Amendment 1)",
      forms: [
        {
          ...baselineStudy.forms[0],
          sections: [
            {
              ...baselineStudy.forms[0].sections[0],
              fields: [
                {
                  ...baselineStudy.forms[0].sections[0].fields[0],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    };

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={amendedStudy}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    // Both a study metadata change and a field change should be listed under "All".
    expect(screen.getAllByText(/Modified/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Study Metadata › Study Name/i)).toBeTruthy();

    const fieldsTab = screen.getByRole("button", { name: /^Fields \(1\)$/i });
    fireEvent.click(fieldsTab);

    // The category tab bar itself is always visible, but the study-metadata
    // diff row should now be filtered out of the entry list.
    expect(screen.queryByText(/Study Metadata › Study Name/i)).toBeNull();
  });

  it("keeps export toolbar buttons disabled when there are no differences", () => {
    const storage = new MockStorage();
    const study = buildTestStudy();
    saveStudyBaseline(
      study,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={study}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    const csvButton = screen.getByRole("button", {
      name: "Export CSV",
    }) as HTMLButtonElement;
    const jsonButton = screen.getByRole("button", {
      name: "Export JSON",
    }) as HTMLButtonElement;
    const textButton = screen.getByRole("button", {
      name: "Export Text",
    }) as HTMLButtonElement;
    const copyButton = screen.getByRole("button", {
      name: "Copy Summary",
    }) as HTMLButtonElement;

    expect(csvButton.disabled).toBe(true);
    expect(jsonButton.disabled).toBe(true);
    expect(textButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);
  });

  it("enables export toolbar buttons and triggers downloads on click when differences exist", () => {
    const storage = new MockStorage();
    const baselineStudy = buildTestStudy();
    saveStudyBaseline(
      baselineStudy,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    const amendedStudy: StudyProtocol = {
      ...baselineStudy,
      studyName: "Phase III Study (Amendment 1)",
    };

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={amendedStudy}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    const csvButton = screen.getByRole("button", {
      name: "Export CSV",
    }) as HTMLButtonElement;
    const jsonButton = screen.getByRole("button", {
      name: "Export JSON",
    }) as HTMLButtonElement;
    const textButton = screen.getByRole("button", {
      name: "Export Text",
    }) as HTMLButtonElement;

    expect(csvButton.disabled).toBe(false);
    expect(jsonButton.disabled).toBe(false);
    expect(textButton.disabled).toBe(false);

    fireEvent.click(csvButton);
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('"Category","Change Type"'),
      expect.stringMatching(/\.csv$/),
      { mimeType: "text/csv;charset=utf-8" }
    );

    fireEvent.click(jsonButton);
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('"baselineId"'),
      expect.stringMatching(/\.json$/),
      { mimeType: "application/json;charset=utf-8" }
    );

    fireEvent.click(textButton);
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringContaining("PROTOCOL AMENDMENT BASELINE COMPARISON REPORT"),
      expect.stringMatching(/\.txt$/),
      { mimeType: "text/plain;charset=utf-8" }
    );
  });

  it("copies plain text summary report to clipboard on Copy Summary click", async () => {
    const storage = new MockStorage();
    const baselineStudy = buildTestStudy();
    saveStudyBaseline(
      baselineStudy,
      { versionTag: "v1.0", label: "Lock", actor: { name: "Author" } },
      storage
    );

    const amendedStudy: StudyProtocol = {
      ...baselineStudy,
      studyName: "Phase III Study (Amendment 1)",
    };

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <BaselineCompareModal
        isOpen={true}
        onClose={vi.fn()}
        study={amendedStudy}
        onSelectBaseline={vi.fn()}
        onNavigate={vi.fn()}
        storage={storage}
      />
    );

    const copyButton = screen.getByRole("button", { name: "Copy Summary" });
    expect((copyButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("PROTOCOL AMENDMENT BASELINE COMPARISON REPORT")
      );
    });
  });
});
