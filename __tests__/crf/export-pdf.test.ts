// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type jsPDF from "jspdf";
import { generateStudyPdf, generateFormPdf } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { StudyBranding } from "@/lib/crf/types";
import { createNearFooterSectionStudy } from "./pdf-export-fixtures";
import {
  createExportScopeStudy,
  EXPORT_SCOPE_SENTINELS,
} from "./export-scope-fixtures";

const pdfTextCalls = vi.hoisted(
  () =>
    [] as Array<{
      text: string;
      section: string;
      page: number;
      y: number;
    }>
);
const pdfCurrentSection = vi.hoisted(() => ({ title: "" }));

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();

  class InstrumentedJsPDF extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      const originalText = this.text.bind(this);

      this.text = (...textArgs: Parameters<jsPDF["text"]>) => {
        const [content, , y] = textArgs;
        const text = Array.isArray(content) ? content.join("\n") : content;

        if (text.startsWith("Section: ")) {
          pdfCurrentSection.title = text;
        }
        if (text === "Appendix: CDISC SDTM Mapping Specification") {
          pdfCurrentSection.title = "SDTM Appendix";
        }
        if (
          text.startsWith("Section: ") ||
          text === "Question / Variable Prompt" ||
          text.includes("Boundary footer safety field") ||
          text === "Appendix: CDISC SDTM Mapping Specification" ||
          text.includes("EXPORT_SCOPE_") ||
          text.includes("EXPSCOPE")
        ) {
          pdfTextCalls.push({
            text,
            section: pdfCurrentSection.title,
            page: this.getCurrentPageInfo().pageNumber,
            y,
          });
        }

        return originalText(...textArgs);
      };
    }
  }

  return { ...actual, default: InstrumentedJsPDF };
});

// 1x1 transparent PNG Base64 for logo testing
const SAMPLE_BASE64_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function getPdfScopeSentinelText(location: "body" | "appendix"): string {
  return pdfTextCalls
    .filter(
      (call) =>
        (location === "appendix"
          ? call.section === "SDTM Appendix"
          : call.section !== "SDTM Appendix") &&
        (call.text.includes("EXPORT_SCOPE_") || call.text.includes("EXPSCOPE"))
    )
    .map((call) => call.text)
    .join("\n");
}

function expectPdfScopeSentinels(includedIndexes: number[]): void {
  const bodyText = getPdfScopeSentinelText("body");
  const appendixText = getPdfScopeSentinelText("appendix");
  const included = new Set(includedIndexes);

  EXPORT_SCOPE_SENTINELS.forEach((sentinel, index) => {
    if (included.has(index)) {
      expect(bodyText).toContain(sentinel.formName);
      expect(bodyText).toContain(sentinel.fieldLabel);
      expect(bodyText).toContain(sentinel.variableName);
      expect(appendixText).toContain(sentinel.fieldLabel);
      expect(appendixText).toContain(sentinel.variableName);
      return;
    }

    expect(bodyText).not.toContain(sentinel.formName);
    expect(bodyText).not.toContain(sentinel.fieldLabel);
    expect(bodyText).not.toContain(sentinel.variableName);
    expect(appendixText).not.toContain(sentinel.fieldLabel);
    expect(appendixText).not.toContain(sentinel.variableName);
  });
}

describe("CRF Studio - Direct PDF Exporter", () => {
  it("should generate a valid PDF document (Blob) for an entire study in blank mode", async () => {
    const blob = await generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
      mode: "blank",
      scope: "all",
      includeTableOfContents: true,
      includeSdtmAppendix: true,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should generate a valid PDF document (Blob) in annotated regulatory aCRF mode", async () => {
    const blob = await generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
      mode: "annotated",
      scope: "all",
      includeTableOfContents: true,
      includeSdtmAppendix: true,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should generate a single form PDF document using generateFormPdf", async () => {
    const form = ONCOLOGY_RECIST_PRESET.forms[0];
    const blob = await generateFormPdf(form, ONCOLOGY_RECIST_PRESET, {
      mode: "blank",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });

  it("should apply custom sponsor branding and logo image to generated PDF document", async () => {
    const customBranding: StudyBranding = {
      organizationName: "Vanguard Therapeutics Corp",
      primaryColor: "#be123c",
      accentColor: "#e11d48",
      headerText: "CONFIDENTIAL • CLINICAL INVESTIGATION PLAN",
      footerText: "Institutional Review Board (IRB) Copy",
      confidentialityNotice:
        "Contains proprietary clinical investigation data.",
      logoBase64: SAMPLE_BASE64_LOGO,
      showPageNumbers: true,
      showTableOfContents: true,
    };

    const blob = await generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
      mode: "annotated",
      scope: "all",
      branding: customBranding,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should limit selected forms and SDTM mappings to the selected IDs", async () => {
    const study = createExportScopeStudy();
    const selectedFormIds = [study.forms[0]!.id, study.forms[2]!.id];
    pdfTextCalls.length = 0;
    pdfCurrentSection.title = "";

    const blob = await generateStudyPdf(study, {
      mode: "blank",
      scope: "selected",
      selectedFormIds,
      includeTableOfContents: false,
      includeSdtmAppendix: true,
    });

    expect(blob.size).toBeGreaterThan(1000);
    expectPdfScopeSentinels([0, 2]);
  });

  it("should include only the requested form in a single-form PDF and its appendix", async () => {
    const study = createExportScopeStudy();
    pdfTextCalls.length = 0;
    pdfCurrentSection.title = "";

    const blob = await generateStudyPdf(study, {
      mode: "blank",
      scope: "single",
      selectedFormIds: [study.forms[1]!.id],
      includeTableOfContents: false,
      includeSdtmAppendix: true,
    });

    expect(blob.size).toBeGreaterThan(1000);
    expectPdfScopeSentinels([1]);
  });

  it.each(["single", "selected"] as const)(
    "should reject missing, empty, or unmatched IDs for %s scope",
    async (scope) => {
      const invalidSelections: Array<string[] | undefined> = [
        undefined,
        [],
        ["unmatched-form-id"],
      ];

      for (const selectedFormIds of invalidSelections) {
        await expect(
          generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
            mode: "blank",
            scope,
            selectedFormIds,
          })
        ).rejects.toThrow(RangeError);
      }

      if (scope === "single") {
        await expect(
          generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
            mode: "blank",
            scope,
            selectedFormIds: [
              "unmatched-form-id",
              ONCOLOGY_RECIST_PRESET.forms[0]!.id,
            ],
          })
        ).rejects.toThrow(
          "the first selectedFormIds entry must match a study form"
        );
      }
    }
  );

  it.each(["blank", "annotated"] as const)(
    "keeps a near-footer section heading with its table header in %s mode",
    async (mode) => {
      const study = createNearFooterSectionStudy();
      pdfTextCalls.length = 0;
      pdfCurrentSection.title = "";
      const blob = await generateStudyPdf(study, {
        mode,
        scope: "all",
        includeTableOfContents: false,
        includeSdtmAppendix: false,
      });
      expect(blob.size).toBeGreaterThan(1000);

      const headings = pdfTextCalls.filter((call) =>
        call.text.startsWith("Section: ")
      );
      const tableHeaders = pdfTextCalls.filter(
        (call) =>
          call.text === "Question / Variable Prompt" &&
          call.section === "Section: Near-footer boundary"
      );
      const fieldText = pdfTextCalls.find((call) =>
        call.text.includes("Boundary footer safety field")
      );
      expect(headings).toHaveLength(2);
      expect(tableHeaders).toHaveLength(1);
      expect(fieldText).toBeDefined();
      expect(headings[1]!.page).toBeGreaterThan(headings[0]!.page);
      expect(headings[1]!.page).toBe(tableHeaders[0]!.page);
      expect(headings[1]!.y).toBeLessThanOrEqual(297 - 14 - 40);
      expect(tableHeaders[0]!.y).toBeLessThan(297 - 15);
      expect(fieldText!.page).toBe(tableHeaders[0]!.page);
      expect(fieldText!.y).toBeLessThan(297 - 15);
    }
  );
});
