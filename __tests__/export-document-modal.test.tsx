/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ExportDocumentModal,
  exportModalReducer,
  initialExportState,
} from "@/components/crf/Modes/ExportDocumentModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

const mockDownloadFile = vi.fn();
vi.mock("@/lib/download", () => ({
  downloadFile: (...args: any[]) => mockDownloadFile(...args),
}));

const mockGenerateStudyDocx = vi.fn();
vi.mock("@/lib/crf/export-docx", () => ({
  generateStudyDocx: (...args: any[]) => mockGenerateStudyDocx(...args),
}));

const mockGenerateStudyPdf = vi.fn();
vi.mock("@/lib/crf/export-pdf", () => ({
  generateStudyPdf: (...args: any[]) => mockGenerateStudyPdf(...args),
}));

describe("ExportDocumentModal Error Handling & Retry Banner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders export document modal without error banner initially", async () => {
    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const alertBanner = container.querySelector('[role="alert"]');
    expect(alertBanner).toBeNull();
  });

  it("displays error banner when handleDownloadDocx rejects", async () => {
    mockGenerateStudyDocx.mockRejectedValueOnce(
      new Error("Docx export service error")
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );
    expect(docxButton).toBeDefined();

    await act(async () => {
      docxButton?.click();
    });

    const alertBanner = container.querySelector('[role="alert"]');
    expect(alertBanner).not.toBeNull();
    expect(alertBanner?.textContent).toContain(
      "Failed to generate Word document (.docx)"
    );
    expect(alertBanner?.textContent).toContain("Retry");
  });

  it("displays error banner when handleDownloadPdf rejects", async () => {
    mockGenerateStudyPdf.mockRejectedValueOnce(
      new Error("PDF export service error")
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const pdfButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export PDF")
    );
    expect(pdfButton).toBeDefined();

    await act(async () => {
      pdfButton?.click();
    });

    const alertBanner = container.querySelector('[role="alert"]');
    expect(alertBanner).not.toBeNull();
    expect(alertBanner?.textContent).toContain(
      "Failed to generate PDF document (.pdf)"
    );
    expect(alertBanner?.textContent).toContain("Retry");
  });

  it("retries docx export when retry button on error banner is clicked", async () => {
    mockGenerateStudyDocx.mockRejectedValueOnce(
      new Error("Docx export failure 1")
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );

    await act(async () => {
      docxButton?.click();
    });

    expect(mockGenerateStudyDocx).toHaveBeenCalledTimes(1);

    mockGenerateStudyDocx.mockResolvedValueOnce(new Blob(["test docx"]));

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Retry")
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
    });

    expect(mockGenerateStudyDocx).toHaveBeenCalledTimes(2);
    expect(mockDownloadFile).toHaveBeenCalled();
  });

  it("dismisses error banner when close/dismiss button is clicked", async () => {
    mockGenerateStudyDocx.mockRejectedValueOnce(
      new Error("Docx export failure")
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );

    await act(async () => {
      docxButton?.click();
    });

    let alertBanner = container.querySelector('[role="alert"]');
    expect(alertBanner).not.toBeNull();

    const dismissButton = container.querySelector(
      'button[aria-label="Dismiss error"]'
    );
    expect(dismissButton).not.toBeNull();

    await act(async () => {
      (dismissButton as HTMLButtonElement).click();
    });

    alertBanner = container.querySelector('[role="alert"]');
    expect(alertBanner).toBeNull();
  });

  it("clears previous error when a new export starts", async () => {
    mockGenerateStudyDocx.mockRejectedValueOnce(
      new Error("Docx export failure")
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
        />
      );
    });

    const docxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export Word")
    );

    await act(async () => {
      docxButton?.click();
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    mockGenerateStudyPdf.mockResolvedValueOnce(new Blob(["test pdf"]));
    const pdfButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Export PDF")
    );

    await act(async () => {
      pdfButton?.click();
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("calls onClose when header close button is clicked", async () => {
    const handleClose = vi.fn();

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={() => {}}
        />
      );
    });

    const headerCloseButton = container.querySelector(
      "div.border-b button"
    ) as HTMLButtonElement;
    expect(headerCloseButton).not.toBeNull();

    await act(async () => {
      headerCloseButton.click();
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it("disables print, docx, and pdf trigger buttons while an export is in flight", async () => {
    let resolveExport!: (blob: Blob) => void;
    mockGenerateStudyDocx.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveExport = resolve;
        })
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
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
    mockGenerateStudyDocx.mockResolvedValueOnce(new Blob(["mock docx"]));

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
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
    mockGenerateStudyDocx.mockResolvedValueOnce(new Blob(["mock docx"]));
    const handleClose = vi.fn();

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={handleClose}
          onOpenBranding={() => {}}
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

  it("blocks concurrent triggers and re-entrancy while export is running", async () => {
    let resolveExport!: (blob: Blob) => void;
    mockGenerateStudyDocx.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveExport = resolve;
        })
    );

    await act(async () => {
      root.render(
        <ExportDocumentModal
          study={ONCOLOGY_RECIST_PRESET}
          activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
          onClose={() => {}}
          onOpenBranding={() => {}}
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
      // Concurrent rapid clicks while in flight
      docxButton?.click();
      pdfButton?.click();
      printButton?.click();
    });

    expect(mockGenerateStudyDocx).toHaveBeenCalledTimes(1);
    expect(mockGenerateStudyPdf).not.toHaveBeenCalled();

    await act(async () => {
      resolveExport(new Blob(["mock docx"]));
    });
  });
});

describe("exportModalReducer State Machine Transitions", () => {
  it("transitions from idle to exporting and ignores concurrent export requests", () => {
    let state = initialExportState;
    expect(state).toEqual({ status: "idle" });

    state = exportModalReducer(state, { type: "START_EXPORT", format: "docx" });
    expect(state).toEqual({ status: "exporting", format: "docx" });

    // Block concurrent export transition
    const sameState = exportModalReducer(state, {
      type: "START_EXPORT",
      format: "pdf",
    });
    expect(sameState).toBe(state);
  });

  it("transitions from exporting to success and resets cleanly", () => {
    let state = exportModalReducer(initialExportState, {
      type: "START_EXPORT",
      format: "docx",
    });

    state = exportModalReducer(state, {
      type: "EXPORT_SUCCESS",
      format: "docx",
    });
    expect(state).toEqual({ status: "success", format: "docx" });

    state = exportModalReducer(state, { type: "RESET" });
    expect(state).toEqual({ status: "idle" });
  });

  it("transitions from exporting to error and allows clearing or retrying", () => {
    let state = exportModalReducer(initialExportState, {
      type: "START_EXPORT",
      format: "pdf",
    });

    state = exportModalReducer(state, {
      type: "EXPORT_ERROR",
      format: "pdf",
      message: "Export failed",
    });
    expect(state).toEqual({
      status: "error",
      format: "pdf",
      message: "Export failed",
    });

    // Clear error
    const cleared = exportModalReducer(state, { type: "CLEAR_ERROR" });
    expect(cleared).toEqual({ status: "idle" });

    // Can also start new export from error state directly (retry)
    const retried = exportModalReducer(state, {
      type: "START_EXPORT",
      format: "pdf",
    });
    expect(retried).toEqual({ status: "exporting", format: "pdf" });
  });

  it("ignores invalid or mismatched transitions", () => {
    const idleState = initialExportState;

    // Cannot succeed or error when idle
    expect(
      exportModalReducer(idleState, { type: "EXPORT_SUCCESS", format: "docx" })
    ).toBe(idleState);
    expect(
      exportModalReducer(idleState, {
        type: "EXPORT_ERROR",
        format: "docx",
        message: "err",
      })
    ).toBe(idleState);

    // Mismatched format is rejected
    const exportingDocx = exportModalReducer(idleState, {
      type: "START_EXPORT",
      format: "docx",
    });
    expect(
      exportModalReducer(exportingDocx, {
        type: "EXPORT_SUCCESS",
        format: "pdf",
      })
    ).toBe(exportingDocx);
    expect(
      exportModalReducer(exportingDocx, {
        type: "EXPORT_ERROR",
        format: "pdf",
        message: "err",
      })
    ).toBe(exportingDocx);
  });
});
