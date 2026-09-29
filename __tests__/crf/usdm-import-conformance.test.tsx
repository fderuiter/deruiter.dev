// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { StudyProtocol } from "@/lib/crf/types";
import { exportStudyToUsdm } from "@/lib/crf/usdm-adapter";
import {
  validateUniversalCrf,
  exportUniversalCrfJson,
} from "@/lib/crf/universal-schema";

async function waitForCondition(
  predicate: () => boolean,
  maxIterations = 100
): Promise<void> {
  let count = 0;
  while (!predicate()) {
    count++;
    if (count > maxIterations) {
      throw new Error("Condition timed out after max iterations");
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe("ExportImportModal USDM Import Conformance Gating & Provenance Logging", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("imports compliant USDM study protocol, attaching provenance and calling onImportStudy", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const compliantUsdmJson = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, compliantUsdmJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );
    expect(importBtn).toBeDefined();

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(() => handleImport.mock.calls.length > 0);

    expect(handleImport).toHaveBeenCalledTimes(1);
    const importedStudy: StudyProtocol = handleImport.mock.calls[0][0];
    expect(importedStudy.provenance).toBeDefined();
    expect(importedStudy.provenance?.importedAt).toBeDefined();
    expect(importedStudy.provenance?.importedBy).toBe("CRF Studio User");
    expect(importedStudy.provenance?.sourceFormat).toBe("CDISC USDM JSON");
  });

  it("halts import and displays pre-flight violation report when critical CDISC violations exist", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    // Construct a protocol with a critical violation (variable name > 8 chars)
    const invalidStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "f_dm",
          name: "Demographics",
          domain: "DM",
          description: "Demographics Form",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "Demographics Section",
              fields: [
                {
                  id: "fld_invalid_1",
                  variableName: "VERY_LONG_VARIABLE_NAME_EXCEEDING_LIMIT",
                  label: "Excessive Variable Length",
                  dataType: "text",
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      visits: [],
    };

    const invalidJson = JSON.stringify(invalidStudy);

    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, invalidJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(
      () =>
        container.textContent?.includes(
          "CDISC Conformance Pre-Flight Violations"
        ) ?? false
    );

    // Import MUST be halted
    expect(handleImport).not.toHaveBeenCalled();

    // Violation report must be displayed in the modal
    expect(container.textContent).toContain(
      "CDISC Conformance Pre-Flight Violations"
    );
    expect(container.textContent).toContain("SD0001");
    expect(container.textContent).toContain(
      "VERY_LONG_VARIABLE_NAME_EXCEEDING_LIMIT"
    );
  });

  it("remediates violations when clicking Auto-Fix and completes import with provenance", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const invalidStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "f_dm",
          name: "Demographics",
          domain: "DM",
          description: "Demographics Form",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "Demographics Section",
              fields: [
                {
                  id: "fld_invalid_1",
                  variableName: "VERY_LONG_VARIABLE_NAME_EXCEEDING_LIMIT",
                  label: "Excessive Variable Length",
                  dataType: "text",
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      visits: [
        {
          id: "v_1",
          oid: "v_1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["f_dm"],
        },
      ],
    };

    const invalidJson = JSON.stringify(invalidStudy);

    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, invalidJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(
      () =>
        container.textContent?.includes(
          "CDISC Conformance Pre-Flight Violations"
        ) ?? false
    );

    expect(handleImport).not.toHaveBeenCalled();

    // Find and click the Auto-Fix button
    const autoFixBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Auto-Fix & Import Protocol")
    );
    expect(autoFixBtn).toBeDefined();

    await act(async () => {
      autoFixBtn?.click();
    });

    await waitForCondition(() => handleImport.mock.calls.length > 0);

    expect(handleImport).toHaveBeenCalledTimes(1);
    const remediatedStudy: StudyProtocol = handleImport.mock.calls[0][0];
    const fixedField = remediatedStudy.forms[0].sections[0].fields[0];
    expect(fixedField.variableName.length).toBeLessThanOrEqual(8);
    expect(remediatedStudy.provenance).toBeDefined();
    expect(remediatedStudy.provenance?.importedBy).toBe("CRF Studio User");
  });

  it("pauses warning-only import and allows user to Proceed with Warnings explicitly", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    // Study with non-critical warning (e.g. non-standard domain with no critical errors)
    const warningStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "f_custom",
          name: "Custom Assessment",
          domain: "CUSTOM",
          description: "Custom non-standard domain",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "Custom Section",
              fields: [
                {
                  id: "fld_c1",
                  variableName: "CSTVAL",
                  label: "Custom Value",
                  dataType: "text",
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      visits: [],
    };

    const warningJson = JSON.stringify(warningStudy);

    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, warningJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(
      () =>
        container.textContent?.includes(
          "CDISC Conformance Pre-Flight Violations"
        ) ?? false
    );

    // Import MUST remain paused/pending so user can review warnings
    expect(handleImport).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "CDISC Conformance Pre-Flight Violations"
    );

    // Proceed with Warnings button must be present
    const proceedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Proceed with Warnings")
    );
    expect(proceedBtn).toBeDefined();

    await act(async () => {
      proceedBtn?.click();
    });

    await waitForCondition(() => handleImport.mock.calls.length > 0);

    expect(handleImport).toHaveBeenCalledTimes(1);
  });

  it("revalidates auto-fixed study and keeps active study unchanged if residual errors remain", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const invalidStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "f_dm",
          name: "Demographics",
          domain: "DM",
          description: "Demographics Form",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "Demographics Section",
              fields: [
                {
                  id: "fld_1",
                  variableName: "VERY_LONG_VARIABLE_NAME_EXCEEDING_LIMIT",
                  label: "Long Variable Name",
                  dataType: "text",
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      visits: [
        {
          id: "v_1",
          oid: "v_1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["f_dm"],
        },
      ],
    };

    const invalidJson = JSON.stringify(invalidStudy);

    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, invalidJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(
      () =>
        container.textContent?.includes(
          "CDISC Conformance Pre-Flight Violations"
        ) ?? false
    );

    expect(handleImport).not.toHaveBeenCalled();

    // Mock autoFixAllViolations to return an updated study that still has a critical error
    const linter = await import("@/lib/crf/cdisc-conformance-linter");
    vi.spyOn(linter, "autoFixAllViolations").mockReturnValue({
      updatedStudy: invalidStudy, // still contains VERY_LONG_VARIABLE_NAME_EXCEEDING_LIMIT error
      fixedCount: 0,
    });

    const autoFixBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Auto-Fix & Import Protocol")
    );
    expect(autoFixBtn).toBeDefined();

    await act(async () => {
      autoFixBtn?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Active study must remain unchanged (onImportStudy NOT called) due to residual unfixable error
    expect(handleImport).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "CDISC Conformance Pre-Flight Violations"
    );
  });

  it("preserves lineage, prior authorship, and distinguishes Universal CRF JSON source format", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const studyWithPriorLineage: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      provenance: {
        author: "Dr. Alice Vance",
        derivedFromBaselineId: "baseline_oncology_01",
        restoredAt: "2026-05-10T10:00:00.000Z",
        restoredBy: "Dr. Alice Vance",
        sourceFormat: "Universal CRF JSON",
        notes: "Initial trial protocol design",
      },
    };

    const universalJson = exportUniversalCrfJson(studyWithPriorLineage);

    // Schema validation test: validateUniversalCrf must preserve provenance
    const schemaValidation = validateUniversalCrf(studyWithPriorLineage);
    expect(schemaValidation.success).toBe(true);
    expect(schemaValidation.study?.provenance).toBeDefined();
    expect(schemaValidation.study?.provenance?.author).toBe("Dr. Alice Vance");

    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (textarea) {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeTextareaSetter?.call(textarea, universalJson);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );

    await act(async () => {
      importBtn?.click();
    });

    await waitForCondition(() => handleImport.mock.calls.length > 0);

    expect(handleImport).toHaveBeenCalledTimes(1);
    const imported: StudyProtocol = handleImport.mock.calls[0][0];
    expect(imported.provenance).toBeDefined();

    // Must preserve prior author and restoration lineage
    expect(imported.provenance?.author).toBe("Dr. Alice Vance");
    expect(imported.provenance?.derivedFromBaselineId).toBe(
      "baseline_oncology_01"
    );
    expect(imported.provenance?.restoredAt).toBe("2026-05-10T10:00:00.000Z");
    expect(imported.provenance?.restoredBy).toBe("Dr. Alice Vance");

    // Must distinguish source format
    expect(imported.provenance?.sourceFormat).toBe("Universal CRF JSON");
    expect(imported.provenance?.importedBy).toBe("CRF Studio User");
    expect(imported.provenance?.importedAt).toBeDefined();
  });
});
