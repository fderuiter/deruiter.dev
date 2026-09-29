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

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(handleImport).toHaveBeenCalledTimes(1);
    const importedStudy: StudyProtocol = handleImport.mock.calls[0][0];
    expect(importedStudy.provenance).toBeDefined();
    expect(importedStudy.provenance?.importedAt).toBeDefined();
    expect(importedStudy.provenance?.importedBy).toBe("CDISC Ingestion Engine");
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

    await act(async () => {
      await Promise.resolve();
    });

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

    await act(async () => {
      await Promise.resolve();
    });

    expect(handleImport).not.toHaveBeenCalled();

    // Find and click the Auto-Fix button
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

    expect(handleImport).toHaveBeenCalledTimes(1);
    const remediatedStudy: StudyProtocol = handleImport.mock.calls[0][0];
    const fixedField = remediatedStudy.forms[0].sections[0].fields[0];
    expect(fixedField.variableName.length).toBeLessThanOrEqual(8);
    expect(remediatedStudy.provenance).toBeDefined();
    expect(remediatedStudy.provenance?.importedBy).toBe(
      "CDISC Ingestion Engine"
    );
  });
});
