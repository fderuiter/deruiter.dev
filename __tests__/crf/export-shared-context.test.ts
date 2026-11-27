// @vitest-environment node
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  exportFormToR,
  exportFormToSas,
  exportStudyToR,
  exportStudyToSas,
  getExpandedRFields,
  getExpandedSasAttributes,
  getFieldOptions,
  importStudyFromCsvSpec,
  parseMultiSelectValue,
} from "@/lib/crf";
import { generateStudyDocx } from "@/lib/crf/export-docx";
import { generateStudyPdf } from "@/lib/crf/export-pdf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { CRFField, CRFForm, StudyProtocol } from "@/lib/crf/types";

async function readDocxXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) {
    throw new Error("Missing word/document.xml in generated DOCX");
  }
  return xml;
}

describe("CRF Studio - Shared Export Preparation & CSV Row Parsing Parity", () => {
  it("shares BOM, quoted delimiter, escaped quote, and embedded newline parsing across CDISC and REDCap CSV dialects", () => {
    const cdiscCsv =
      "\uFEFFDomain,Form,Variable,Label,Type,Core\r\n" +
      'AE,"Adverse Events, ""Primary""\nLog",AETERM,"Reported ""Term"",\r\nverbatim",text,R\r\n';

    const cdiscStudy = importStudyFromCsvSpec(cdiscCsv);
    expect(cdiscStudy.forms).toHaveLength(1);
    expect(cdiscStudy.forms[0]!.name).toBe('Adverse Events, "Primary"\nLog');
    expect(cdiscStudy.forms[0]!.sections[0]!.fields[0]!.label).toBe(
      'Reported "Term",\r\nverbatim'
    );

    const redcapCsv =
      '\uFEFF"Variable / Field Name","Form Name","Field Type","Field Label","Choices, Calculations, OR Slider Labels"\r\n' +
      '"ae_term","adverse_events","radio","Reported ""AE"",\nverbatim","1, Mild, ""Grade 1"" | 2, Moderate"\r\n';

    const redcapStudy = importStudyFromCsvSpec(redcapCsv);
    expect(redcapStudy.forms).toHaveLength(1);
    const redcapField = redcapStudy.forms[0]!.sections[0]!.fields[0]!;
    expect(redcapField.label).toBe('Reported "AE", verbatim');
    expect(redcapField.customOptions).toEqual([
      { code: "1", label: 'Mild, "Grade 1"', order: 1 },
      { code: "2", label: "Moderate", order: 2 },
    ]);

    // Imported study exports cleanly across R, SAS, DOCX, and PDF
    expect(exportStudyToR(redcapStudy)).toContain("tbl_f_adverse_events_1");
    expect(exportStudyToSas(redcapStudy)).toContain(
      "DATA raw_f_adverse_events_1"
    );
  });

  it("exports shared getFieldOptions and parseMultiSelectValue helpers from @/lib/crf without collisions", () => {
    const customField: CRFField = {
      id: "fld_custom",
      variableName: "CUSTOM",
      label: "Custom",
      dataType: "single_select",
      columnSpan: 6,
      required: false,
      customOptions: [{ code: "A", label: "Alpha", order: 1 }],
    };
    expect(getFieldOptions(customField, ONCOLOGY_RECIST_PRESET)).toEqual([
      { code: "A", label: "Alpha", order: 1 },
    ]);

    const standardCodelistField: CRFField = {
      id: "fld_std_sex",
      variableName: "SEX",
      label: "Sex",
      dataType: "radio",
      columnSpan: 6,
      required: true,
      codelistId: "CL_SEX",
    };
    const emptyCodelistStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      codelists: [],
    };
    expect(
      getFieldOptions(standardCodelistField, emptyCodelistStudy).map(
        (o) => o.code
      )
    ).toContain("M");

    const bareCheckbox: CRFField = {
      id: "fld_bare_chk",
      variableName: "CONMEDYN",
      label: "Prior ConMeds",
      dataType: "checkbox",
      columnSpan: 6,
      required: false,
    };
    expect(
      getFieldOptions(bareCheckbox, emptyCodelistStudy).map((o) => o.code)
    ).toEqual(["N", "Y"]);

    const textField: CRFField = {
      id: "fld_txt",
      variableName: "SUBJNOTE",
      label: "Note",
      dataType: "text",
      columnSpan: 6,
      required: false,
    };
    expect(getFieldOptions(textField, emptyCodelistStudy)).toEqual([]);

    expect(parseMultiSelectValue(true, "ANY")).toBe("Y");
    expect(parseMultiSelectValue(false, "ANY")).toBe("N");
    expect(parseMultiSelectValue(undefined, "ANY")).toBe("N");
    expect(parseMultiSelectValue(["a", "b"], "B")).toBe("Y");
    expect(parseMultiSelectValue("yes", "Y")).toBe("Y");
    expect(parseMultiSelectValue("A; B", "b")).toBe("Y");
  });

  it("preserves format-specific option fallbacks for bare checkboxes and uncoded selects across R, SAS, DOCX, and PDF", async () => {
    const fallbackForm: CRFForm = {
      id: "form_fallbacks",
      name: "Fallback Verification Form",
      domain: "FB",
      description: "Verifies option fallbacks per output format",
      version: "1.0",
      rules: [],
      sections: [
        {
          id: "sec_fb",
          title: "Fallback Fields",
          fields: [
            {
              id: "fld_bare_checkbox",
              variableName: "CHKYN",
              label: "Bare Checkbox Prompt",
              dataType: "checkbox",
              columnSpan: 6,
              required: false,
            },
            {
              id: "fld_bare_radio",
              variableName: "RADOPT",
              label: "Bare Radio Prompt",
              dataType: "radio",
              columnSpan: 6,
              required: false,
            },
          ],
        },
      ],
    };

    const study: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [fallbackForm],
    };

    // R and SAS expand bare checkboxes with CL_NY (N / Y)
    const rCode = exportFormToR(fallbackForm, study);
    expect(rCode).toContain("CHKYN_N");
    expect(rCode).toContain("CHKYN_Y");
    expect(rCode).toContain("cl_cl_ny_levels");

    const sasCode = exportFormToSas(fallbackForm, study);
    expect(sasCode).toContain("CHKYN_N");
    expect(sasCode).toContain("CHKYN_Y");
    expect(sasCode).toContain("VALUE $NYF");

    // DOCX renders blank "[ ] Yes    [ ] No" for bare checkboxes and Option 1 / Option 2 for bare radios
    const docxBlob = await generateStudyDocx(study, {
      mode: "blank",
      scope: "single",
      selectedFormIds: [fallbackForm.id],
    });
    const docxXml = await readDocxXml(docxBlob);
    expect(docxXml).toContain("[ ] Yes    [ ] No");
    expect(docxXml).toContain("( ) Option 1 ");
    expect(docxXml).toContain("( ) Option 2 ");

    // PDF renders blank "[ ] Yes     [ ] No" without throwing
    const pdfBlob = await generateStudyPdf(study, {
      mode: "blank",
      scope: "single",
      selectedFormIds: [fallbackForm.id],
    });
    const rawPdfText = new TextDecoder("latin1").decode(
      await pdfBlob.arrayBuffer()
    );
    const pdfText = rawPdfText.replace(/\\([()])/g, "$1");
    expect(pdfText).toContain("[ ] Yes     [ ] No");
    expect(pdfText).toContain("( ) Option 1 [1]   ( ) Option 2 [2]");
  });

  it("keeps soft selectedFormId filtering in R and SAS while enforcing strict RangeError in DOCX and PDF", async () => {
    const unmatchedR = exportStudyToR(ONCOLOGY_RECIST_PRESET, {
      selectedFormId: "non_existent_form",
    });
    expect(unmatchedR).toContain("PROGRAM:      create_raw_datasets.R");
    expect(unmatchedR).toContain("# No forms selected or available in study");

    const unmatchedSas = exportStudyToSas(ONCOLOGY_RECIST_PRESET, {
      selectedFormId: "non_existent_form",
    });
    expect(unmatchedSas).toContain("PROGRAM:      create_raw_datasets.sas");
    expect(unmatchedSas).toContain(
      "/* No forms selected or available in study */"
    );

    await expect(
      generateStudyDocx(ONCOLOGY_RECIST_PRESET, {
        mode: "blank",
        scope: "selected",
        selectedFormIds: ["non_existent_form"],
      })
    ).rejects.toThrow(
      new RangeError(
        "Cannot export with scope 'selected': selectedFormIds must match at least one study form."
      )
    );

    await expect(
      generateStudyPdf(ONCOLOGY_RECIST_PRESET, {
        mode: "blank",
        scope: "selected",
        selectedFormIds: ["non_existent_form"],
      })
    ).rejects.toThrow(
      new RangeError(
        "Cannot export with scope 'selected': selectedFormIds must match at least one study form."
      )
    );
  });

  it("deduplicates colliding 32-character identifiers identically across R and SAS", () => {
    const collidingFieldA: CRFField = {
      id: "fld_a",
      variableName: "DUPLICATE_LONG_CLINICAL_VARIABLE_IDENTIFIER_NAME",
      label: "First",
      dataType: "text",
      columnSpan: 6,
      required: false,
    };
    const collidingFieldB: CRFField = {
      id: "fld_b",
      variableName: "DUPLICATE_LONG_CLINICAL_VARIABLE_IDENTIFIER_NAME",
      label: "Second",
      dataType: "text",
      columnSpan: 6,
      required: false,
    };

    const rUsed = new Set<string>();
    const rFirst = getExpandedRFields(
      collidingFieldA,
      ONCOLOGY_RECIST_PRESET,
      rUsed
    )[0]!;
    const rSecond = getExpandedRFields(
      collidingFieldB,
      ONCOLOGY_RECIST_PRESET,
      rUsed
    )[0]!;

    const sasUsed = new Set<string>();
    const sasFirst = getExpandedSasAttributes(
      collidingFieldA,
      ONCOLOGY_RECIST_PRESET,
      sasUsed
    )[0]!;
    const sasSecond = getExpandedSasAttributes(
      collidingFieldB,
      ONCOLOGY_RECIST_PRESET,
      sasUsed
    )[0]!;

    expect(rFirst.varName).toHaveLength(32);
    expect(rSecond.varName).toHaveLength(32);
    expect(rSecond.varName.endsWith("_1")).toBe(true);
    expect(sasFirst.attrs.sasVarName).toBe(rFirst.varName);
    expect(sasSecond.attrs.sasVarName).toBe(rSecond.varName);
  });
});
