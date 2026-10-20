// @vitest-environment node
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  generateStudyDocx,
  generateFormDocx,
  TABLE_WIDTH_DXA,
  STANDARD_COL_WIDTH_1,
  STANDARD_COL_WIDTH_2,
  ANNOTATED_COL_WIDTH_1,
  ANNOTATED_COL_WIDTH_2,
  ANNOTATED_COL_WIDTH_3,
  TOC_COL_WIDTH_1,
  TOC_COL_WIDTH_2,
  TOC_COL_WIDTH_3,
  TOC_COL_WIDTH_4,
  TOC_COL_WIDTH_5,
  SDTM_COL_WIDTH_1,
  SDTM_COL_WIDTH_2,
  SDTM_COL_WIDTH_3,
  SDTM_COL_WIDTH_4,
  SDTM_COL_WIDTH_5,
  SDTM_COL_WIDTH_6,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET, CNS_NEURO_PRESET } from "@/lib/crf/presets";
import { StudyBranding } from "@/lib/crf/types";
import {
  createExportScopeStudy,
  EXPORT_SCOPE_SENTINELS,
} from "./export-scope-fixtures";

// 1x1 transparent PNG Base64 for logo testing
const SAMPLE_BASE64_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const SDTM_APPENDIX_TITLE =
  "Appendix: CDISC SDTM Target Mapping Specifications";

async function getDocxDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Generated DOCX is missing word/document.xml.");
  }

  return documentXml;
}

function getSdtmAppendixXml(documentXml: string): string {
  const appendixStart = documentXml.indexOf(SDTM_APPENDIX_TITLE);
  expect(appendixStart).toBeGreaterThanOrEqual(0);
  return documentXml.slice(appendixStart);
}

function expectDocxScopeSentinels(
  documentXml: string,
  appendixXml: string,
  includedIndexes: number[]
): void {
  const included = new Set(includedIndexes);

  EXPORT_SCOPE_SENTINELS.forEach((sentinel, index) => {
    if (included.has(index)) {
      expect(documentXml).toContain(sentinel.formName);
      expect(appendixXml).toContain(sentinel.fieldLabel);
      expect(appendixXml).toContain(sentinel.variableName);
      return;
    }

    expect(documentXml).not.toContain(sentinel.formName);
    expect(appendixXml).not.toContain(sentinel.fieldLabel);
    expect(appendixXml).not.toContain(sentinel.variableName);
  });
}

describe("CRF Studio - Microsoft Word (.docx) Exporter", () => {
  it("should use 9,360 DXA table width matching 1-inch margins on Letter paper", () => {
    expect(TABLE_WIDTH_DXA).toBe(9360);
  });

  it("should have proportional cell column widths summing to 9,360 DXA in standard and annotated modes", () => {
    expect(STANDARD_COL_WIDTH_1 + STANDARD_COL_WIDTH_2).toBe(TABLE_WIDTH_DXA);
    expect(
      ANNOTATED_COL_WIDTH_1 + ANNOTATED_COL_WIDTH_2 + ANNOTATED_COL_WIDTH_3
    ).toBe(TABLE_WIDTH_DXA);
    expect(
      TOC_COL_WIDTH_1 +
        TOC_COL_WIDTH_2 +
        TOC_COL_WIDTH_3 +
        TOC_COL_WIDTH_4 +
        TOC_COL_WIDTH_5
    ).toBe(TABLE_WIDTH_DXA);
    expect(
      SDTM_COL_WIDTH_1 +
        SDTM_COL_WIDTH_2 +
        SDTM_COL_WIDTH_3 +
        SDTM_COL_WIDTH_4 +
        SDTM_COL_WIDTH_5 +
        SDTM_COL_WIDTH_6
    ).toBe(TABLE_WIDTH_DXA);
  });

  it("should generate a valid Word document (.docx Blob) for an entire study in blank mode", async () => {
    const blob = await generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
      mode: "blank",
      scope: "all",
      includeTableOfContents: true,
      includeSdtmAppendix: true,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should generate a valid Word document (.docx Blob) in annotated regulatory aCRF mode", async () => {
    const blob = await generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
      mode: "annotated",
      scope: "all",
      includeTableOfContents: true,
      includeSdtmAppendix: true,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should generate a single form Word document using generateFormDocx", async () => {
    const form = ONCOLOGY_RECIST_PRESET.forms[0];
    const blob = await generateFormDocx(form, ONCOLOGY_RECIST_PRESET, {
      mode: "blank",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });

  it("should apply custom sponsor branding and logo image to generated Word document", async () => {
    const customBranding: StudyBranding = {
      organizationName: "BioNexus Global Therapeutics",
      primaryColor: "#047857",
      accentColor: "#059669",
      headerText: "CONFIDENTIAL • PROTOCOL BNT-2026",
      footerText: "Investigator Master Copy",
      confidentialityNotice:
        "Proprietary clinical trial protocol documentation.",
      logoBase64: SAMPLE_BASE64_LOGO,
      showPageNumbers: true,
      showTableOfContents: true,
    };

    const blob = await generateStudyDocx(CNS_NEURO_PRESET, {
      mode: "annotated",
      scope: "all",
      branding: customBranding,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should export a selective subset of forms when scope is selected", async () => {
    const selectedIds = [
      ONCOLOGY_RECIST_PRESET.forms[0].id,
      ONCOLOGY_RECIST_PRESET.forms[1].id,
    ];
    const blob = await generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
      mode: "blank",
      scope: "selected",
      selectedFormIds: selectedIds,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should limit selected forms and SDTM mappings to the selected IDs", async () => {
    const study = createExportScopeStudy();
    const selectedFormIds = study.forms.slice(0, 2).map((form) => form.id);
    const blob = await generateStudyDocx(study, {
      mode: "blank",
      scope: "selected",
      selectedFormIds,
      includeSdtmAppendix: true,
    });

    const documentXml = await getDocxDocumentXml(blob);
    expectDocxScopeSentinels(
      documentXml,
      getSdtmAppendixXml(documentXml),
      [0, 1]
    );
  });

  it("should include only the requested form in a single-form DOCX and its appendix", async () => {
    const study = createExportScopeStudy();
    const blob = await generateStudyDocx(study, {
      mode: "blank",
      scope: "single",
      selectedFormIds: [study.forms[1]!.id],
      includeSdtmAppendix: true,
    });

    const documentXml = await getDocxDocumentXml(blob);
    expectDocxScopeSentinels(documentXml, getSdtmAppendixXml(documentXml), [1]);
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
          generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
            mode: "blank",
            scope,
            selectedFormIds,
          })
        ).rejects.toThrow(RangeError);
      }

      if (scope === "single") {
        await expect(
          generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
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
});
