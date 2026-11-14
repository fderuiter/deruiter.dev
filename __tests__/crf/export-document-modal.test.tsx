/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportDocumentModal } from "@/components/crf/Modes/ExportDocumentModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { generateStudyDocx } from "@/lib/crf/export-docx";
import { generateStudyPdf } from "@/lib/crf/export-pdf";

vi.mock("@/lib/crf/export-docx", () => ({
  generateStudyDocx: vi.fn().mockResolvedValue(
    new Blob(["mock-docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  ),
}));

vi.mock("@/lib/crf/export-pdf", () => ({
  generateStudyPdf: vi
    .fn()
    .mockResolvedValue(new Blob(["mock-pdf"], { type: "application/pdf" })),
}));

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

describe("ExportDocumentModal Component", () => {
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

  it("renders export mode toggles, scope selectors, and action buttons", async () => {
    const handleClose = vi.fn();
    const handleOpenBranding = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={handleOpenBranding}
        />
      );
    });

    expect(container.textContent).toContain(
      "Clinical Word (.docx) & PDF Exporter"
    );
    expect(container.textContent).toContain("Blank Data Collection Forms");
    expect(container.textContent).toContain("Annotated Submission aCRF");
    expect(container.textContent).toContain("Entire Study Book");
    expect(container.textContent).toContain("Export Word (.docx)");
    expect(container.textContent).toContain("Export PDF (.pdf)");
  });

  it("switches document mode and triggers Word export without crashing", async () => {
    const handleClose = vi.fn();
    const handleOpenBranding = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={handleOpenBranding}
        />
      );
    });

    // Select Annotated aCRF mode
    const buttons = Array.from(container.querySelectorAll("button"));
    const acrfModeBtn = buttons.find((b) =>
      b.textContent?.includes("Annotated Submission aCRF")
    );
    expect(acrfModeBtn).toBeDefined();

    await act(async () => {
      acrfModeBtn?.click();
    });

    // Click Export Word
    const exportWordBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word (.docx)")
    );
    expect(exportWordBtn).toBeDefined();

    await act(async () => {
      exportWordBtn?.click();
      await new Promise((r) => setTimeout(r, 1000));
    });

    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("invokes onOpenBranding when clicking Customize Branding", async () => {
    const handleClose = vi.fn();
    const handleOpenBranding = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={handleOpenBranding}
        />
      );
    });

    const brandingBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Customize Branding")
    );
    expect(brandingBtn).toBeDefined();

    await act(async () => {
      brandingBtn?.click();
    });

    expect(handleOpenBranding).toHaveBeenCalledTimes(1);
  });

  it("triggers PDF export with dynamic loading state without crashing", async () => {
    const handleClose = vi.fn();
    const handleOpenBranding = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={handleOpenBranding}
        />
      );
    });

    const exportPdfBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export PDF (.pdf)")
    );
    expect(exportPdfBtn).toBeDefined();

    await act(async () => {
      exportPdfBtn?.click();
      await new Promise((r) => setTimeout(r, 1000));
    });

    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("disables print, docx, and pdf trigger buttons while an export is in flight", async () => {
    let resolveExport!: (blob: Blob) => void;
    vi.mocked(generateStudyDocx).mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveExport = resolve;
        })
    );

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={vi.fn()}
          onOpenBranding={vi.fn()}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );
    const pdfButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export PDF")
    );
    const printButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Print / Preview")
    );

    expect(docxButton?.disabled).toBe(false);
    expect(pdfButton?.disabled).toBe(false);
    expect(printButton?.disabled).toBe(false);

    // Start docx export
    await act(async () => {
      docxButton?.click();
    });

    // All export and preview triggers must be disabled during active operation
    expect(docxButton?.disabled).toBe(true);
    expect(pdfButton?.disabled).toBe(true);
    expect(printButton?.disabled).toBe(true);

    // Resolve export
    await act(async () => {
      resolveExport(new Blob(["mock docx"]));
    });

    // Triggers are re-enabled
    expect(docxButton?.disabled).toBe(false);
    expect(pdfButton?.disabled).toBe(false);
    expect(printButton?.disabled).toBe(false);
  });

  it("cleans up active success timer when component unmounts", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.mocked(generateStudyDocx).mockResolvedValueOnce(new Blob(["mock docx"]));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={vi.fn()}
          onOpenBranding={vi.fn()}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );

    await act(async () => {
      docxButton?.click();
    });

    expect(docxButton?.textContent).toContain("Downloaded Word!");

    // Unmount while success timer is scheduled
    await act(async () => {
      root.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("clears pending success timer and resets on close", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.mocked(generateStudyDocx).mockResolvedValueOnce(new Blob(["mock docx"]));
    const handleClose = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={vi.fn()}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );

    await act(async () => {
      docxButton?.click();
    });

    const headerCloseButton = container.querySelector(
      "div.border-b button"
    ) as HTMLButtonElement;

    await act(async () => {
      headerCloseButton.click();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("blocks concurrent triggers while export is running", async () => {
    let resolveExport!: (blob: Blob) => void;
    vi.mocked(generateStudyDocx).mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveExport = resolve;
        })
    );

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={vi.fn()}
          onOpenBranding={vi.fn()}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );
    const pdfButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export PDF")
    );
    const printButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Print / Preview")
    );

    await act(async () => {
      docxButton?.click();
    });

    // Attempt concurrent clicks while in flight
    await act(async () => {
      docxButton?.click();
      pdfButton?.click();
      printButton?.click();
    });

    expect(generateStudyDocx).toHaveBeenCalledTimes(1);
    expect(generateStudyPdf).not.toHaveBeenCalled();

    await act(async () => {
      resolveExport(new Blob(["mock docx"]));
    });
  });
});
