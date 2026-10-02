// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  sanitizeRName,
  escapeRString,
  getExpandedRFields,
  parseMultiSelectValue,
  generateRCodelists,
  generateRDataStepForForm,
  exportFormToR,
  exportStudyToR,
} from "@/lib/crf/export-r";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { StudyProtocol, CRFForm, CRFField } from "@/lib/crf/types";

describe("CRF Studio - Automated R & Pharmaverse Scaffolding Exporter", () => {
  describe("Sanitization & String Escaping", () => {
    it("sanitizes R variable and tibble names cleanly", () => {
      expect(sanitizeRName("123badname")).toBe("v_123badname");
      expect(sanitizeRName("subject_age")).toBe("subject_age");
      expect(sanitizeRName("var-with-dash")).toBe("var_with_dash");
      expect(sanitizeRName("")).toBe("var");
    });

    it("escapes quotes and backslashes in R literals", () => {
      expect(escapeRString('Label with "quotes"')).toBe(
        'Label with \\"quotes\\"'
      );
      expect(escapeRString("Path\\To\\File")).toBe("Path\\\\To\\\\File");
    });
  });

  describe("Codelist Factor Level Generation", () => {
    it("generates factor level and label vectors for study codelists", () => {
      const code = generateRCodelists(
        ONCOLOGY_RECIST_PRESET,
        ONCOLOGY_RECIST_PRESET.forms
      );

      expect(code).toContain("cl_cl_sex_levels <- c(");
      expect(code).toContain('"M", "F"');
      expect(code).toContain("cl_cl_sex_labels <- c(");
      expect(code).toContain('"Male", "Female"');
    });

    it("handles studies without codelists gracefully", () => {
      const emptyStudy: StudyProtocol = {
        ...ONCOLOGY_RECIST_PRESET,
        codelists: [],
      };
      const code = generateRCodelists(emptyStudy, emptyStudy.forms);
      expect(code).toContain("# No codelists defined for this study");
    });
  });

  describe("Tibble Data Steps & Full R Suite Generation", () => {
    it("generates a valid tibble creation block with typed vectors and labelled attributes", () => {
      const dmForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "DM"
      )!;
      const rCode = generateRDataStepForForm(dmForm, ONCOLOGY_RECIST_PRESET, {
        includeSampleData: true,
        includeGlimpse: true,
        useLabelledPackage: true,
      });

      expect(rCode).toContain("tbl_dm <- tibble::tibble(");
      expect(rCode).toContain("STUDYID");
      expect(rCode).toContain("USUBJID");
      expect(rCode).toContain("labelled::var_label(tbl_dm) <- list(");
      expect(rCode).toContain("dplyr::glimpse(tbl_dm)");
      expect(rCode).toContain("summary(tbl_dm)");
    });

    it("exports a single form to an independent R script", () => {
      const vsForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "VS"
      )!;
      const rScript = exportFormToR(vsForm, ONCOLOGY_RECIST_PRESET);

      expect(rScript).toContain(
        "#=============================================================================="
      );
      expect(rScript).toContain("PROGRAM:      create_raw_vs.R");
      expect(rScript).toContain("tbl_vs <- tibble::tibble(");
    });

    it("exports full study into a complete multi-domain R script suite", () => {
      const fullScript = exportStudyToR(ONCOLOGY_RECIST_PRESET);

      expect(fullScript).toContain("PROGRAM:      create_raw_suite.R");
      expect(fullScript).toContain("SECTION 1:");
      expect(fullScript).toContain("tbl_dm <- tibble::tibble(");
      expect(fullScript).toContain("tbl_vs <- tibble::tibble(");
      expect(fullScript).toContain("tbl_ae <- tibble::tibble(");
    });

    it("filters to selected form when selectedFormId is specified", () => {
      const aeForm = ONCOLOGY_RECIST_PRESET.forms.find(
        (f) => f.domain === "AE"
      )!;
      const filtered = exportStudyToR(ONCOLOGY_RECIST_PRESET, {
        selectedFormId: aeForm.id,
      });

      expect(filtered).toContain("tbl_ae <- tibble::tibble(");
      expect(filtered).not.toContain("tbl_dm <- tibble::tibble(");
    });
  });

  describe("Dichotomous Sub-Variable Expansion (R)", () => {
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

    it("expands multi-select choices into distinct dichotomous R sub-variable factors bound to CL_NY", () => {
      const usedNames = new Set<string>();
      const expanded = getExpandedRFields(
        multiSelectField,
        ONCOLOGY_RECIST_PRESET,
        usedNames
      );

      expect(expanded).toHaveLength(3);
      expect(expanded[0].varName).toBe("MH_HYPERTEN");
      expect(expanded[0].optLabel).toBe("Hypertension");

      expect(expanded[1].varName).toBe("MH_DIABETES");
      expect(expanded[2].varName).toBe("MH_ASTHMA");
    });

    it("prevents sub-variable name collisions and enforces 32 character limit", () => {
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
      const expanded = getExpandedRFields(
        longField,
        ONCOLOGY_RECIST_PRESET,
        usedNames
      );

      expect(expanded).toHaveLength(2);
      expect(expanded[0].varName.length).toBeLessThanOrEqual(32);
      expect(expanded[1].varName.length).toBeLessThanOrEqual(32);
      expect(expanded[0].varName).not.toBe(expanded[1].varName);
    });

    it("parses multi-select EDC values into discrete Y and N flags", () => {
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "HYPERTEN")).toBe("Y");
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "DIABETES")).toBe("N");
      expect(parseMultiSelectValue("HYPERTEN, ASTHMA", "ASTHMA")).toBe("Y");
      expect(parseMultiSelectValue('"HYPERTEN", "ASTHMA"', "HYPERTEN")).toBe(
        "Y"
      );
    });

    it("generates R script with factor vectors using cl_cl_ny_levels and cl_cl_ny_labels and labelled attributes", () => {
      const rScript = exportFormToR(multiForm, ONCOLOGY_RECIST_PRESET);

      expect(rScript).toContain("cl_cl_ny_levels <- c(");
      expect(rScript).toContain('"N", "Y"');
      expect(rScript).toContain("cl_cl_ny_labels <- c(");
      expect(rScript).toContain('"No", "Yes"');

      expect(rScript).toContain("MH_HYPERTEN");
      expect(rScript).toContain("MH_DIABETES");
      expect(rScript).toContain("MH_ASTHMA");

      expect(rScript).toContain("factor(c(");
      expect(rScript).toContain(
        "levels = cl_cl_ny_levels, labels = cl_cl_ny_labels"
      );

      expect(rScript).toContain(
        'MH_HYPERTEN = "Medical History Category - Hypertension"'
      );
      expect(rScript).not.toContain("OPTION_A, OPTION_B");
    });
  });
});
