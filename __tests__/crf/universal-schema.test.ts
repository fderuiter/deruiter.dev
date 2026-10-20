// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CRFField,
  CRFForm,
  StudyProtocol,
  validateUniversalCrf,
  parseUniversalCrf,
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
  generateCliCommandForField,
  generateCliCommandForForm,
  diffUniversalCrfStudies,
  getUniversalCrfSchemaUrl,
  getOncologyPresetSync,
} from "@/lib/crf";

describe("Universal CRF Specification & Schema Engine", () => {
  const sampleStudy = getOncologyPresetSync();

  it("validates a compliant study protocol against Zod schema", () => {
    const result = validateUniversalCrf(sampleStudy);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.study?.protocolNumber).toBe(sampleStudy.protocolNumber);
  });

  it("rejects non-compliant schema with structured error issues", () => {
    const invalidData = {
      protocolNumber: "", // invalid: min(1)
      studyName: "Test Study",
      forms: [
        {
          id: "f1",
          name: "Test Form",
          domain: "VERY_LONG_DOMAIN_NAME", // invalid: max(8)
          sections: [],
        },
      ],
    };

    const result = validateUniversalCrf(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("parses valid JSON string into typed StudyProtocol", () => {
    const jsonString = exportUniversalCrfJson(sampleStudy);
    expect(JSON.parse(jsonString).$schema).toBe(getUniversalCrfSchemaUrl());
    const parsed = parseUniversalCrf(jsonString);

    expect(parsed.protocolNumber).toBe(sampleStudy.protocolNumber);
    expect(parsed.forms.length).toBe(sampleStudy.forms.length);
    expect(parsed.visits.length).toBe(sampleStudy.visits.length);
  });

  it("serializes protocol to clean YAML with header comments and without summary count fields", () => {
    const yamlString = exportUniversalCrfYaml(sampleStudy);
    expect(yamlString).toContain(
      "# Universal Clinical Research Form (CRF) Specification"
    );
    expect(yamlString).toContain(
      `protocolNumber: ${sampleStudy.protocolNumber}`
    );

    // Verify summary count fields are omitted
    expect(yamlString).not.toContain("formsCount:");
    expect(yamlString).not.toContain("visitsCount:");
    expect(yamlString).not.toContain("sectionsCount:");
    expect(yamlString).not.toContain("fieldsCount:");
    expect(yamlString).not.toContain("rulesCount:");
  });

  it("performs lossless 1:1 YAML export preserving all protocol, rule, codelist, branding, field, and visit schedule attributes", () => {
    const complexStudy: StudyProtocol = {
      id: "study_onc_001",
      protocolNumber: "ONC-2026-X01",
      studyName: "Lossless Universal CRF Trial",
      phase: "Phase III",
      sponsor: "Global BioPharma Corp",
      therapeuticArea: "Oncology",
      version: "3.2",
      lastModified: "2026-08-20T12:00:00.000Z",
      branding: {
        organizationName: "Global Oncology CRO",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#0284c7",
        accentColor: "#9333ea",
        headerText: "CONFIDENTIAL - SPONSOR USE ONLY",
        footerText: "Protocol ONC-2026-X01 | Page {page}",
        confidentialityNotice: "This document is confidential and proprietary.",
        showPageNumbers: true,
        showTableOfContents: true,
      },
      codelists: [
        {
          id: "CL_NYHA",
          name: "NYHA Functional Class",
          nciCodelistCode: "C66730",
          isStandard: true,
          options: [
            {
              code: "CLASS_I",
              label: "Class I: No Limitation",
              nciCode: "C25251",
              order: 1,
            },
            {
              code: "CLASS_II",
              label: "Class II: Slight Limitation",
              nciCode: "C25252",
              order: 2,
            },
          ],
        },
      ],
      rules: [
        {
          id: "RULE_GLOBAL_01",
          name: "Global Consent Rule",
          description:
            "Informed consent date must be prior to study procedures",
          triggerFieldIds: ["fld_icdat"],
          actionType: "raise_query",
          targetFieldId: "fld_icdat",
          conditions: [
            { fieldId: "fld_icdat", operator: "is_empty", value: false },
          ],
          logicalOperator: "AND",
          querySeverity: "error",
          queryMessage:
            "Informed consent date is required before baseline assessment.",
        },
      ],
      visits: [
        {
          id: "visit_c1d1",
          oid: "SE.C1D1",
          name: "Cycle 1 Day 1",
          visitType: "Scheduled",
          targetDay: 1,
          timepointDays: 1,
          windowBefore: -1,
          windowAfter: 2,
          assignedFormIds: ["form_vs", "form_ae"],
          isRepeating: true,
          repeatMax: 12,
        },
      ],
      forms: [
        {
          id: "form_vs",
          name: "Vital Signs",
          domain: "VS",
          description: "Baseline & On-Study Vital Signs",
          version: "2.0",
          isLogForm: false,
          isLocked: true,
          lockedBy: "cra_monitor_01",
          lockedAt: "2026-08-19T10:00:00.000Z",
          rules: [
            {
              id: "RULE_VS_01",
              name: "BMI Calculator Rule",
              description:
                "Automatically compute Body Mass Index from height and weight",
              triggerFieldIds: ["fld_height", "fld_weight"],
              actionType: "set_value",
              targetFieldId: "fld_bmi",
              conditions: [
                {
                  fieldId: "fld_height",
                  operator: "is_not_empty",
                  value: true,
                },
                {
                  fieldId: "fld_weight",
                  operator: "is_not_empty",
                  value: true,
                },
              ],
              logicalOperator: "AND",
              formulaExpression: "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
            },
          ],
          sections: [
            {
              id: "sec_vitals",
              title: "Anthropometrics & Blood Pressure",
              description: "Physical measurements and vital sign indicators",
              collapsible: true,
              isRepeating: false,
              fields: [
                {
                  id: "fld_sysbp",
                  variableName: "SYSBP",
                  label: "Systolic Blood Pressure",
                  description:
                    "Seated systolic blood pressure after 5 min rest",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                  unit: "mmHg",
                  unitOptions: ["mmHg", "kPa"],
                  minValue: 40,
                  maxValue: 250,
                  cdashMetadata: {
                    domain: "VS",
                    sdtmVariable: "SYSBP",
                    cdashLabel: "Systolic Blood Pressure",
                    core: "HR",
                    acrfAnnotation: "VS.SYSBP",
                    dataCategory: "Vital Signs",
                  },
                  allowPartial: false,
                  preventFutureDate: false,
                  allowNullFlavor: true,
                  requirementTier: "hard_stop",
                  requiresSdv: true,
                  isBlinded: false,
                },
                {
                  id: "fld_bmi",
                  variableName: "BMI",
                  label: "Body Mass Index",
                  dataType: "calculated",
                  columnSpan: 6,
                  required: false,
                  calculationFormula:
                    "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
                  codelistId: "CL_NYHA",
                  scaleMinLabel: "Low",
                  scaleMaxLabel: "High",
                  allowPartial: true,
                  preventFutureDate: true,
                  allowNullFlavor: true,
                  requirementTier: "auto_query",
                  requiresSdv: true,
                  isBlinded: false,
                },
              ],
            },
          ],
        },
      ],
    };

    const yamlOutput = exportUniversalCrfYaml(complexStudy);

    // 1. Top-Level Attributes & Schema Meta
    expect(yamlOutput).toContain("$schema:");
    expect(yamlOutput).toContain("schemaVersion:");
    expect(yamlOutput).toContain("protocolNumber: ONC-2026-X01");
    expect(yamlOutput).toContain("studyName: Lossless Universal CRF Trial");
    expect(yamlOutput).toContain("sponsor: Global BioPharma Corp");

    // 2. Branding Definitions
    expect(yamlOutput).toContain("branding:");
    expect(yamlOutput).toContain("organizationName: Global Oncology CRO");
    expect(yamlOutput).toContain("logoUrl:");
    expect(yamlOutput).toContain("primaryColor:");
    expect(yamlOutput).toContain("accentColor:");
    expect(yamlOutput).toContain("headerText:");
    expect(yamlOutput).toContain("footerText:");
    expect(yamlOutput).toContain("confidentialityNotice:");

    // 3. Top-Level Codelists & Options
    expect(yamlOutput).toContain("codelists:");
    expect(yamlOutput).toContain("id: CL_NYHA");
    expect(yamlOutput).toContain("nciCodelistCode: C66730");
    expect(yamlOutput).toContain("code: CLASS_I");
    expect(yamlOutput).toContain("nciCode: C25251");

    // 4. Top-Level Edit Check Rules
    expect(yamlOutput).toContain("id: RULE_GLOBAL_01");
    expect(yamlOutput).toContain("name: Global Consent Rule");
    expect(yamlOutput).toContain("queryMessage:");

    // 5. Visit Schedule & Window Parameters
    expect(yamlOutput).toContain("visits:");
    expect(yamlOutput).toContain("id: visit_c1d1");
    expect(yamlOutput).toContain("oid: SE.C1D1");
    expect(yamlOutput).toContain("timepointDays: 1");
    expect(yamlOutput).toContain("windowBefore: -1");
    expect(yamlOutput).toContain("windowAfter: 2");
    expect(yamlOutput).toContain("repeatMax: 12");
    expect(yamlOutput).toContain("assignedFormIds:");
    expect(yamlOutput).toContain("- form_vs");

    // 6. Form & Section Properties
    expect(yamlOutput).toContain("forms:");
    expect(yamlOutput).toContain("id: form_vs");
    expect(yamlOutput).toContain("domain: VS");
    expect(yamlOutput).toContain("isLocked: true");
    expect(yamlOutput).toContain("lockedBy: cra_monitor_01");
    expect(yamlOutput).toContain("collapsible: true");

    // 7. Form-Level Edit Check Rules & Formulas
    expect(yamlOutput).toContain("id: RULE_VS_01");
    expect(yamlOutput).toContain("formulaExpression:");

    // 8. Field Level Logic, Formulas, Precision Flags, & Metadata
    expect(yamlOutput).toContain("variableName: SYSBP");
    expect(yamlOutput).toContain("variableName: BMI");
    expect(yamlOutput).toContain("calculationFormula:");
    expect(yamlOutput).toContain("cdashMetadata:");
    expect(yamlOutput).toContain("acrfAnnotation: VS.SYSBP");
    expect(yamlOutput).toContain("allowPartial: true");
    expect(yamlOutput).toContain("preventFutureDate: true");
    expect(yamlOutput).toContain("allowNullFlavor: true");
    expect(yamlOutput).toContain("requirementTier:");
    expect(yamlOutput).toContain("requiresSdv: true");
    expect(yamlOutput).toContain("scaleMinLabel: Low");
    expect(yamlOutput).toContain("scaleMaxLabel: High");

    // 9. Absence of Redundant Summary Count Fields
    expect(yamlOutput).not.toContain("formsCount:");
    expect(yamlOutput).not.toContain("visitsCount:");
    expect(yamlOutput).not.toContain("sectionsCount:");
    expect(yamlOutput).not.toContain("fieldsCount:");
    expect(yamlOutput).not.toContain("rulesCount:");
  });

  it("generates correct CLI commands for forms and fields", () => {
    const field: CRFField = {
      id: "fld_sysbp",
      variableName: "SYSBP",
      label: "Systolic Blood Pressure",
      dataType: "number",
      columnSpan: 6,
      required: true,
      unit: "mmHg",
    };

    const cliCmd = generateCliCommandForField("VS", field);
    expect(cliCmd).toBe(
      'crf add field VS --var SYSBP --type number --label "Systolic Blood Pressure" --required --unit "mmHg"'
    );

    const form: CRFForm = {
      id: "form_dm",
      domain: "DM",
      name: "Demographics",
      description: "Subject demographics",
      version: "1.0",
      sections: [],
      rules: [],
    };

    const formCmd = generateCliCommandForForm(form);
    expect(formCmd).toBe('crf add form DM --name "Demographics"');
  });

  it("computes semantic protocol diffs between two study versions", () => {
    const studyA = JSON.parse(JSON.stringify(sampleStudy)) as StudyProtocol;
    const studyB = JSON.parse(JSON.stringify(sampleStudy)) as StudyProtocol;

    // Modify studyB
    studyB.forms[0].sections[0].fields.push({
      id: "fld_new",
      variableName: "NEWVAR",
      label: "New Variable",
      dataType: "text",
      columnSpan: 6,
      required: false,
    });

    const diff = diffUniversalCrfStudies(studyA, studyB);
    expect(diff.hasChanges).toBe(true);
    expect(diff.modifiedForms.length).toBeGreaterThan(0);
    expect(diff.modifiedForms[0].addedFields).toContain("NEWVAR");
  });
});
