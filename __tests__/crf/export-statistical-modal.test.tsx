/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

// The preview is generated after a dynamic import, which can take longer
// than any fixed sleep under load (#2831), so wait for the loading state to
// clear instead.
async function waitForExport(container: HTMLElement) {
  await vi.waitFor(
    async () => {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(container.textContent).not.toContain(
        "Generating export representation"
      );
    },
    { timeout: 10_000 }
  );
}

describe("ExportImportModal Statistical Tabs & Domain Filtering", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const mockCreateUrl = vi.fn(() => "blob:mock-url");
    const mockRevokeUrl = vi.fn();
    window.URL.createObjectURL = mockCreateUrl;
    window.URL.revokeObjectURL = mockRevokeUrl;
    globalThis.URL.createObjectURL = mockCreateUrl;
    globalThis.URL.revokeObjectURL = mockRevokeUrl;

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("renders all export tabs including SAS Script and R Scaffolding", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    expect(container.textContent).toContain(
      "CDISC Standards & Interoperability Exporter"
    );
    expect(container.textContent).toContain("CDISC ODM-XML");
    expect(container.textContent).toContain("SAS Script (.sas)");
    expect(container.textContent).toContain("R Scaffolding (.R)");
    expect(container.textContent).toContain("HL7 FHIR R4");
    expect(container.textContent).toContain("SDTM Mapping Specs");
    expect(container.textContent).toContain("JSON Study Bundle");
  });

  it("switches to SAS Script tab and displays generated PROC FORMAT and DATA steps", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const sasTabBtn = buttons.find((b) =>
      b.textContent?.includes("SAS Script (.sas)")
    );
    expect(sasTabBtn).toBeDefined();

    await act(async () => {
      sasTabBtn?.click();
    });
    await waitForExport(container);

    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("PROC FORMAT;");
    expect(pre?.textContent).toContain("DATA raw_dm");
    expect(pre?.textContent).toContain("ATTRIB");
    expect(pre?.textContent).toContain("CARDS;");
  });

  it("switches to R Scaffolding tab and displays generated tibble code", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const rTabBtn = buttons.find((b) =>
      b.textContent?.includes("R Scaffolding (.R)")
    );
    expect(rTabBtn).toBeDefined();

    await act(async () => {
      rTabBtn?.click();
    });
    await waitForExport(container);

    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("library(tibble)");
    expect(pre?.textContent).toContain("tbl_dm <- tibble::tibble(");
    expect(pre?.textContent).toContain("labelled::var_label(tbl_dm)");
  });

  it("filters SAS output when selecting a specific domain in the domain selector", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    // Switch to SAS tab
    const sasTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("SAS Script (.sas)")
    );
    await act(async () => {
      sasTabBtn?.click();
    });

    // Select Adverse Events form
    const select = container.querySelector("select");
    expect(select).toBeDefined();

    const aeForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "AE")!;
    await act(async () => {
      if (select) {
        select.value = aeForm.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await waitForExport(container);

    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("DATA raw_ae");
    expect(pre?.textContent).not.toContain("DATA raw_dm");
  });

  it("triggers download with appropriate SAS and R filenames", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    // Switch to SAS tab
    const sasTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("SAS Script (.sas)")
    );
    await act(async () => {
      sasTabBtn?.click();
    });
    await waitForExport(container);

    // Click Download
    const downloadBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Download File")
    );
    await act(async () => {
      downloadBtn?.click();
    });

    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("copies generated code to clipboard when clicking Copy Code", async () => {
    const handleImport = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImport}
        />
      );
    });

    const copyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Copy Code")
    );
    await act(async () => {
      copyBtn?.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
