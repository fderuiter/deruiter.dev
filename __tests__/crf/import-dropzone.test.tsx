// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ImportDropzone } from "@/components/crf/ImportDropzone";
import { exportStudyToCdiscOdmXml } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("ImportDropzone - Drag and Drop File Upload Component", () => {
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

  it("renders dropzone target with accessible WAI-ARIA role and format badges", async () => {
    const handleParsed = vi.fn();
    const handleError = vi.fn();

    await act(async () => {
      root.render(
        <ImportDropzone onFileParsed={handleParsed} onError={handleError} />
      );
    });

    const dropzone = container.querySelector('[role="button"]');
    expect(dropzone).not.toBeNull();
    expect(dropzone?.getAttribute("aria-label")).toContain(
      "Upload study protocol dropzone"
    );
    expect(container.textContent).toContain("CDISC ODM-XML (.xml)");
    expect(container.textContent).toContain("USDM JSON (.json)");
    expect(container.textContent).toContain("CSV Spec (.csv)");
  });

  it("handles file dragover, dragenter, dragleave, and drop events", async () => {
    const handleParsed = vi.fn();
    const handleError = vi.fn();

    await act(async () => {
      root.render(
        <ImportDropzone onFileParsed={handleParsed} onError={handleError} />
      );
    });

    const dropzone = container.querySelector(
      '[role="button"]'
    ) as HTMLDivElement;
    expect(dropzone).not.toBeNull();

    await act(async () => {
      dropzone.dispatchEvent(new Event("dragover", { bubbles: true }));
    });

    await act(async () => {
      dropzone.dispatchEvent(new Event("dragleave", { bubbles: true }));
    });

    const xmlContent = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);
    const xmlBlob = new Blob([xmlContent], { type: "application/xml" });
    const xmlFile = new File([xmlBlob], "oncology.xml", {
      type: "application/xml",
    });

    const dropEvent: DragEvent = fromAny(new Event("drop", { bubbles: true }));
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [xmlFile],
        clearData: vi.fn(),
      },
    });

    await act(async () => {
      dropzone.dispatchEvent(dropEvent);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(handleParsed).toHaveBeenCalledTimes(1);
    const parsedResult = handleParsed.mock.calls[0][0];
    expect(parsedResult.formatLabel).toBe("CDISC ODM-XML v1.3.2/v2.0");
    expect(parsedResult.study.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
  });

  it("triggers error when file exceeds 50MB limit", async () => {
    const handleParsed = vi.fn();
    const handleError = vi.fn();

    await act(async () => {
      root.render(
        <ImportDropzone onFileParsed={handleParsed} onError={handleError} />
      );
    });

    const dropzone = container.querySelector(
      '[role="button"]'
    ) as HTMLDivElement;

    // Create a mock large file
    const largeBlob = new Blob(["a"]);
    const largeFile = new File([largeBlob], "huge.json", {
      type: "application/json",
    });
    Object.defineProperty(largeFile, "size", { value: 51 * 1024 * 1024 });

    const dropEvent: DragEvent = fromAny(new Event("drop", { bubbles: true }));
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [largeFile],
        clearData: vi.fn(),
      },
    });

    await act(async () => {
      dropzone.dispatchEvent(dropEvent);
    });

    expect(handleError).toHaveBeenCalledWith(
      expect.stringContaining("exceeds maximum supported limit of 50MB")
    );
  });

  it("displays REDCap CSV Data Dictionary label upon successful ingestion of REDCap CSV", async () => {
    const handleParsed = vi.fn();
    const handleError = vi.fn();

    await act(async () => {
      root.render(
        <ImportDropzone onFileParsed={handleParsed} onError={handleError} />
      );
    });

    const dropzone = container.querySelector(
      '[role="button"]'
    ) as HTMLDivElement;

    const redcapCsv = `"Variable / Field Name","Form Name","Section Header","Field Type","Field Label","Choices, Calculations, OR Slider Labels","Field Note","Text Validation Type OR Show Slider Number","Text Validation Min","Text Validation Max","Identifier?","Branching Logic (Show field only if...)","Required?","Custom Alignment","Question Number (surveys only)","Matrix Group Name","Matrix Ranking?","Field Annotation"
"record_id","demographics","Subject Info","text","Record ID","","","","","","","","y","","","","",""
"gender","demographics","","radio","Gender","1, Male | 2, Female","","","","","","","y","","","","",""`;

    const csvBlob = new Blob([redcapCsv], { type: "text/csv" });
    const csvFile = new File([csvBlob], "redcap_instrument.csv", {
      type: "text/csv",
    });

    const dropEvent: DragEvent = fromAny(new Event("drop", { bubbles: true }));
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [csvFile],
        clearData: vi.fn(),
      },
    });

    await act(async () => {
      dropzone.dispatchEvent(dropEvent);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(handleParsed).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("REDCap CSV Data Dictionary");
  });
});
