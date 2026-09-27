import { describe, it, expect } from "vitest";
import {
  sanitizeSasName,
  getSasFormatName,
  escapeSasString,
  getFieldSasAttributes,
  getExpandedSasAttributes,
  parseMultiSelectValue,
  generateSasProcFormat,
  generateSasDataStepForForm,
  exportFormToSas,
  exportStudyToSas,
} from "@/lib/crf/export-sas";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { StudyProtocol, CRFForm, CRFField } from "@/lib/crf/types";

describe("CRF Studio - Automated SAS Statistical Exporter", () => {
  describe("Sanitization & Utility Functions", () => {
    it("sanitizes SAS variable and dataset names properly", () => {
      expect(sanitizeSasName("123badname")).toBe("V_123BADNAME");
      expect(sanitizeSasName("patient_weight_kg")).toBe("PATIENT_WEIGHT_KG");
      expect(sanitizeSasName("var-with-dashes.and.dots")).toBe(
        "VAR_WITH_DASHES_AND_DOTS"
      );
      expect(sanitizeSasName("a".repeat(40), 32)).toHaveLength(32);
      expect(sanitizeSasName("")).toBe("VAR");
    });

    it("generates correct SAS format names for character and numeric formats", () => {
      expect(getSasFormatName("CL_SEX", true)).toBe("$SEXF");
      expect(getSasFormatName("CL_AESEV", false)).toBe("AESEVF");
      expect(getSasFormatName("CUSTOM_GRADE", true)).toBe("$CUSTOM_GRADEF");
    });

    it("escapes single quotes for SAS string literals", () => {
      expect(escapeSasString("Patient's Baseline Assessment")).toBe(
        "Patient''s Baseline Assessment"
      );
      expect(escapeSasString("No quotes here")).toBe("No quotes here");
      expect(escapeSasString("")).toBe("");
    });
  });

  describe("Field SAS Attributes Mapping", () => {
    it("maps numeric types correctly to SAS best12 format", () => {
      const numField: CRFField = {
        id: "f_weight",
        variableName: "WEIGHT",
        label: "Weight (kg)",
        dataType: "number",
        columnSpan: 6,
        required: true,
      };

      const attrs = getFieldSasAttributes(numField, ONCOLOGY_RECIST_PRESET);
      expect(attrs.sasVarName).toBe("WEIGHT");
      expect(attrs.isNumeric).toBe(true);
      expect(attrs.length).toBe("8");
      expect(attrs.format).toBe("BEST12.");
    });

    it("maps date and datetime types to ISO 8601 character formats", () => {
      const dateField: CRFField = {
        id: "f_dtc",
        variableName: "AESTDTC",
        label: "Adverse Event Start Date",
        dataType: "date",
        columnSpan: 6,
        required: true,
      };

      const attrs = getFieldSasAttributes(dateField, ONCOLOGY_RECIST_PRESET);
      expect(attrs.sasVarName).toBe("AESTDTC");
      expect(attrs.isNumeric).toBe(false);
      expect(attrs.length).toBe("$10");
      expect(attrs.format).toBe("$10.");
    });

    it("maps codelist select fields to format definitions", () => {
      const sexField: CRFField = {
        id: "f_sex",
        variableName: "SEX",
        label: "Biological Sex",
        dataType: "single_select",
        columnSpan: 6,
        required: true,
        codelistId: "CL_SEX",
      };

      const attrs = getFieldSasAttributes(sexField, ONCOLOGY_RECIST_PRESET);
      expect(attrs.sasVarName).toBe("SEX");
      expect(attrs.format).toBe("$SEXF.");
      expect(attrs.codelistRef).toBeDefined();
    });
  });

  describe("PROC FORMAT Generation", () => {
    it("keeps NCI metadata inside one closed SAS comment before each format", () => {
      const procFormatCode = generateSasProcFormat(
        ONCOLOGY_RECIST_PRESET,
        ONCOLOGY_RECIST_PRESET.forms
      );

      expect(procFormatCode).toContain(
        "/* Codelist: No Yes Response (NY) | NCI Codelist: C66741 */\n  VALUE $NYF"
      );
      expect(procFormatCode).not.toMatch(/\/\*[^\n]*\/\*/);
    });

    it("generates PROC FORMAT block for study codelists", () => {
      const procFormatCode = generateSasProcFormat(
        ONCOLOGY_RECIST_PRESET,
        ONCOLOGY_RECIST_PRESET.forms
      );

      expect(procFormatCode).toContain("PROC FORMAT;");
      expect(procFormatCode).toContain("VALUE $SEXF");
      expect(procFormatCode).toContain("'M' = 'Male'");
      expect(procFormatCode).toContain("'F' = 'Female'");
      expect(procFormatCode).toContain("OTHER = 'Unknown / Unmapped'");
      expect(procFormatCode).toContain("RUN;");
    });

    it("handles studies with no codelists gracefully", () => {
      const emptyStudy: StudyProtocol = {
        ...ONCOLOGY_RECIST_PRESET,
        codelists: [],
      };
      const code = generateSasProcFormat(emptyStudy, emptyStudy.forms);
      expect(code).toContain("/* No codelists defined for this study */");
    });
  });

  describe("DATA Step & Full Study Suite Generation", () => {
    it("generates a complete SAS DATA step for a CRF Form with ATTRIB and test records", () => {
      const dmForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "DM"
      )!;
      const dataStep = generateSasDataStepForForm(
        dmForm,
        ONCOLOGY_RECIST_PRESET,
        {
          includeSampleData: true,
          includeProcContents: true,
          includeProcFreq: true,
        }
      );

      expect(dataStep).toContain("DATA raw_dm");
      expect(dataStep).toContain("ATTRIB");
      expect(dataStep).toContain("STUDYID");
      expect(dataStep).toContain("USUBJID");
      expect(dataStep).toContain("INFILE DATALINES");
      expect(dataStep).toContain("CARDS;");
      expect(dataStep).toContain("PROC CONTENTS DATA=raw_dm");
      expect(dataStep).toContain("PROC FREQ DATA=raw_dm");
    });

    it("exports a single form to a self-contained SAS program", () => {
      const vsForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "VS"
      )!;
      const sasProgram = exportFormToSas(vsForm, ONCOLOGY_RECIST_PRESET);

      expect(sasProgram).toContain(
        "/*============================================================================="
      );
      expect(sasProgram).toContain("PROGRAM:      create_raw_vs.sas");
      expect(sasProgram).toContain(ONCOLOGY_RECIST_PRESET.protocolNumber);
      expect(sasProgram).toContain("DATA raw_vs");
      expect(sasProgram).toContain("RUN;");
    });

    it("exports entire study to a multi-domain SAS suite", () => {
      const fullSuite = exportStudyToSas(ONCOLOGY_RECIST_PRESET);

      expect(fullSuite).toContain("PROGRAM:      create_raw_suite.sas");
      expect(fullSuite).toContain("SECTION 1:");
      expect(fullSuite).toContain("DATA raw_dm");
      expect(fullSuite).toContain("DATA raw_vs");
      expect(fullSuite).toContain("DATA raw_ae");
    });

    it("filters to a selected form when selectedFormId option is provided", () => {
      const aeForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "AE"
      )!;
      const filtered = exportStudyToSas(ONCOLOGY_RECIST_PRESET, {
        selectedFormId: aeForm.id,
      });

      expect(filtered).toContain("DATA raw_ae");
      expect(filtered).not.toContain("DATA raw_dm");
    });
  });

  describe("Dichotomous Sub-Variable Expansion (SAS)", () => {
    const multiSelectField: CRFField = {
      id: "f_mh_cat",
      variableName: "MH",
      label: "Medical History Category",
      dataType: "multi_select",
      columnSpan: 6,
      required: false,
      customOptions: [
        { code: "HYPERTEN", label: "Hypertension", order: 1 },
        { code: "DIABETES", label: "Diabetes Mellitus", order: 2 },
        { code: "ASTHMA", label: "Asthma", order: 3 },
      ],
    };

    const multiForm: CRFForm = {
      id: "form_mh",
      name: "Medical History",
      domain: "MH",
      description: "Medical History Questionnaire",
      version: "1.0",
      sections: [
        {
          id: "sec_mh",
          title: "Medical History",
          fields: [multiSelectField],
        },
      ],
      rules: [],
    };

    it("expands multi-select choices into distinct dichotomous sub-variables with $NYF. format", () => {
      const usedNames = new Set<string>();
      const expanded = getExpandedSasAttributes(
        multiSelectField,
        ONCOLOGY_RECIST_PRESET,
        usedNames
      );

      expect(expanded).toHaveLength(3);
      expect(expanded[0].attrs.sasVarName).toBe("MH_HYPERTEN");
      expect(expanded[0].attrs.format).toBe("$NYF.");
      expect(expanded[0].attrs.length).toBe("$1");
      expect(expanded[0].attrs.label).toBe(
        "Medical History Category - Hypertension"
      );

      expect(expanded[1].attrs.sasVarName).toBe("MH_DIABETES");
      expect(expanded[1].attrs.label).toBe(
        "Medical History Category - Diabetes Mellitus"
      );

      expect(expanded[2].attrs.sasVarName).toBe("MH_ASTHMA");
    });

    it("prevents variable name collisions and enforces SAS 32 character limit", () => {
      const longField: CRFField = {
        id: "f_long",
        variableName: "VERY_LONG_BASE_VARIABLE_NAME_THAT_EXCEEDS_LIMIT",
        label: "Long Category",
        dataType: "multi_select",
        columnSpan: 6,
        required: false,
        customOptions: [
          { code: "LONG_OPTION_CODE_1", label: "Option 1", order: 1 },
          { code: "LONG_OPTION_CODE_2", label: "Option 2", order: 2 },
        ],
      };

      const usedNames = new Set<string>();
      const expanded = getExpandedSasAttributes(
        longField,
        ONCOLOGY_RECIST_PRESET,
        usedNames
      );

      expect(expanded).toHaveLength(2);
      expect(expanded[0].attrs.sasVarName.length).toBeLessThanOrEqual(32);
      expect(expanded[1].attrs.sasVarName.length).toBeLessThanOrEqual(32);
      expect(expanded[0].attrs.sasVarName).not.toBe(
        expanded[1].attrs.sasVarName
      );
    });

    it("parses comma-separated multi-select EDC values accurately", () => {
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "HYPERTEN")).toBe("Y");
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "DIABETES")).toBe("N");
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "ASTHMA")).toBe("Y");
      expect(parseMultiSelectValue('"HYPERTEN", "ASTHMA"', "HYPERTEN")).toBe(
        "Y"
      );
      expect(parseMultiSelectValue(null, "HYPERTEN")).toBe("N");
    });

    it("generates PROC FORMAT and DATA step with dichotomous ATTRIB definitions and synthetic Yes/No records", () => {
      const sasCode = exportFormToSas(multiForm, ONCOLOGY_RECIST_PRESET);

      expect(sasCode).toContain("PROC FORMAT;");
      expect(sasCode).toContain("VALUE $NYF");
      expect(sasCode).toContain("'N' = 'No'");
      expect(sasCode).toContain("'Y' = 'Yes'");

      expect(sasCode).toContain("MH_HYPERTEN");
      expect(sasCode).toContain("MH_DIABETES");
      expect(sasCode).toContain("MH_ASTHMA");

      expect(sasCode).toContain("LENGTH=$1");
      expect(sasCode).toContain("FORMAT=$NYF.");

      // Check synthetic mock data has Y or N
      expect(sasCode).toContain("CARDS;");
      expect(sasCode).not.toContain("TEST_MH_HYPERTEN_1");
    });
  });
});
