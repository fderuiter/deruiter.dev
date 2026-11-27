// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ImportDropzone } from "@/components/crf/ImportDropzone";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import {
  exportFormToFhirQuestionnaire,
  exportStudyToCdiscOdmXml,
  exportStudyToFhirQuestionnaire,
} from "@/lib/crf";
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
    expect(dropzone?.getAttribute("aria-label")).toContain("HL7 FHIR R4 JSON");
    expect(container.textContent).toContain("CDISC ODM-XML (.xml)");
    expect(container.textContent).toContain("USDM JSON (.json)");
    expect(container.textContent).toContain("HL7 FHIR R4 (.json)");
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

  it("displays HL7 FHIR R4 Questionnaire label upon dropping a FHIR Questionnaire JSON file", async () => {
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

    const dmForm = ONCOLOGY_RECIST_PRESET.forms[0];
    const fhirJson = JSON.stringify(
      exportFormToFhirQuestionnaire(dmForm, ONCOLOGY_RECIST_PRESET)
    );
    const fhirBlob = new Blob([fhirJson], { type: "application/fhir+json" });
    const fhirFile = new File([fhirBlob], "fhir-questionnaire-dm.json", {
      type: "application/fhir+json",
    });

    const dropEvent: DragEvent = fromAny(new Event("drop", { bubbles: true }));
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [fhirFile],
        clearData: vi.fn(),
      },
    });

    await act(async () => {
      dropzone.dispatchEvent(dropEvent);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(handleParsed).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("HL7 FHIR R4 Questionnaire");
  });

  it("surfaces FHIR JSON copy in ExportImportModal, imports valid FHIR Bundles, and protects active study on non-Questionnaire FHIR resources", async () => {
    const handleImportStudy = vi.fn();

    await act(async () => {
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={handleImportStudy}
        />
      );
    });

    expect(container.textContent).toContain("HL7 FHIR R4");
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.placeholder).toContain("HL7 FHIR R4 JSON");

    const setTextareaValue = (val: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(textarea, val);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    // 1. Non-Questionnaire FHIR resource must show error and never wipe active study
    await act(async () => {
      setTextareaValue(JSON.stringify({ resourceType: "Patient", id: "p-1" }));
    });

    const importBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Import Protocol into Studio")
    );
    await act(async () => {
      importBtn?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(handleImportStudy).not.toHaveBeenCalled();
    expect(container.textContent).toContain("HL7 FHIR R4 Parsing Error");

    // 2. Valid FHIR Bundle imports cleanly with HL7 FHIR R4 Questionnaire provenance
    const validBundleJson = JSON.stringify(
      exportStudyToFhirQuestionnaire(ONCOLOGY_RECIST_PRESET)
    );
    await act(async () => {
      setTextareaValue(validBundleJson);
    });
    await act(async () => {
      importBtn?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(handleImportStudy).toHaveBeenCalledTimes(1);
    const imported = handleImportStudy.mock.calls[0][0];
    expect(imported.forms).toHaveLength(ONCOLOGY_RECIST_PRESET.forms.length);
    expect(imported.provenance?.sourceFormat).toBe("HL7 FHIR R4 Questionnaire");
  });
});
