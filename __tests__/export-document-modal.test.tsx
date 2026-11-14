/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportDocumentModal } from "@/components/crf/Modes/ExportDocumentModal";
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
});
