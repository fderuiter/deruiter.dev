// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  exportFormToFhirQuestionnaire,
  exportStudyToFhirQuestionnaire,
  importFormFromFhirQuestionnaire,
  importStudyFromFhirQuestionnaire,
  validateStudyCompliance,
  generateAcrfHtml,
} from "@/lib/crf";
import {
  ONCOLOGY_RECIST_PRESET,
  PK_ESCALATION_PRESET,
} from "@/lib/crf/presets";

describe("CRF Studio - FHIR Questionnaire & aCRF Generator", () => {
  it("converts a CRF form into a valid FHIR R4 Questionnaire Resource", () => {
    const dmForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "DM")!;
    const fhir = exportFormToFhirQuestionnaire(
      dmForm,
      ONCOLOGY_RECIST_PRESET
    ) as {
      resourceType: string;
      status: string;
      item: Array<{
        linkId: string;
        type: string;
        item: Array<{ linkId: string; type: string }>;
      }>;
    };

    expect(fhir.resourceType).toBe("Questionnaire");
    expect(fhir.status).toBe("active");
    expect(fhir.item.length).toBeGreaterThan(0);
    expect(fhir.item[0].type).toBe("group");
  });

  it("generates publication-ready Annotated CRF (aCRF) HTML", () => {
    const vsForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;
    const html = generateAcrfHtml(vsForm, ONCOLOGY_RECIST_PRESET);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Annotated CRF");
    expect(html).toContain(ONCOLOGY_RECIST_PRESET.protocolNumber);
    expect(html).toContain("VS.VSSTRESN [VSTESTCD=HEIGHT]");
  });

  it("round-trips a single exported FHIR Questionnaire back to a CRFForm without consultation suffix or data loss", () => {
    const vsForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;
    const fhirJson = JSON.stringify(
      exportFormToFhirQuestionnaire(vsForm, ONCOLOGY_RECIST_PRESET)
    );
    const importedForm = importFormFromFhirQuestionnaire(fhirJson);

    expect(importedForm.id).toBe(vsForm.id);
    expect(importedForm.name).toBe(vsForm.name);
    expect(importedForm.domain).toBe("VS");
    expect(importedForm.description).toBe(vsForm.description);
    expect(importedForm.description).not.toContain("Schedule Consultation:");
    expect(importedForm.sections).toHaveLength(vsForm.sections.length);

    const originalFields = vsForm.sections.flatMap((s) => s.fields);
    const importedFields = importedForm.sections.flatMap((s) => s.fields);
    expect(importedFields).toHaveLength(originalFields.length);
    expect(importedFields.map((f) => f.variableName)).toEqual(
      originalFields.map((f) => f.variableName)
    );

    // UCUM unit extension round-trip
    const origHeight = originalFields.find((f) => f.variableName === "HEIGHT")!;
    const impHeight = importedFields.find((f) => f.variableName === "HEIGHT")!;
    expect(impHeight.unit).toBe(origHeight.unit);
  });

  it("round-trips full preset study FHIR Bundles into valid StudyProtocols assigned to a default Screening visit", () => {
    for (const preset of [ONCOLOGY_RECIST_PRESET, PK_ESCALATION_PRESET]) {
      const bundle = exportStudyToFhirQuestionnaire(preset);
      const importedStudy = importStudyFromFhirQuestionnaire(
        JSON.stringify(bundle)
      );

      expect(importedStudy.protocolNumber).toBe(preset.protocolNumber);
      expect(importedStudy.sponsor).toBe(preset.sponsor);
      expect(importedStudy.forms).toHaveLength(preset.forms.length);
      expect(importedStudy.provenance?.sourceFormat).toBe(
        "HL7 FHIR R4 Questionnaire"
      );

      // Default screening visit holds all imported forms
      expect(importedStudy.visits).toHaveLength(1);
      expect(importedStudy.visits[0].oid).toBe("SE.SCREENING");
      expect(importedStudy.visits[0].assignedFormIds).toEqual(
        importedStudy.forms.map((f) => f.id)
      );

      // Standard NCI codelists (e.g. CL_SEX) and custom options (e.g. AEACN) round-trip cleanly
      const dmForm = importedStudy.forms.find((f) => f.domain === "DM");
      if (dmForm) {
        const sexField = dmForm.sections
          .flatMap((s) => s.fields)
          .find((f) => f.variableName === "SEX");
        expect(sexField?.codelistId).toBe("CL_SEX");
        const sexCl = importedStudy.codelists.find((cl) => cl.id === "CL_SEX");
        expect(sexCl?.nciCodelistCode).toBe("C66731");
        expect(sexCl?.options.map((o) => o.code)).toContain("M");
      }

      // Preset round-trips pass CDISC conformance validation without errors
      const violations = validateStudyCompliance(importedStudy);
      expect(violations.filter((v) => v.severity === "error")).toEqual([]);

      // Re-exporting the imported study produces equivalent FHIR Questionnaire items
      const reExported = exportStudyToFhirQuestionnaire(importedStudy) as {
        entry: Array<{ resource: { id: string; item: unknown[] } }>;
      };
      expect(reExported.entry).toHaveLength(preset.forms.length);
    }
  });

  it("parses external LHC-Forms Questionnaires with itemControl extensions, top-level leaf questions, display items, and UCUM unitOptions", () => {
    const lhcPhqQuestionnaire = {
      resourceType: "Questionnaire",
      id: "lhc-phq-intake",
      title: "Patient Health Intake (LHC-Forms)",
      status: "active",
      version: "2.1",
      publisher: "National Library of Medicine",
      contained: [
        {
          resourceType: "ValueSet",
          id: "vs-smoking",
          expansion: {
            contains: [
              {
                system: "http://loinc.org",
                code: "LA18976-3",
                display: "Current every day smoker",
              },
              {
                system: "http://loinc.org",
                code: "LA18978-9",
                display: "Never smoker",
              },
            ],
          },
        },
      ],
      item: [
        {
          linkId: "intro-banner",
          text: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
          type: "display",
        },
        {
          linkId: "PHQ_Q1",
          text: "Little interest or pleasure in doing things",
          type: "choice",
          required: true,
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
              valueCodeableConcept: {
                coding: [
                  {
                    system: "http://hl7.org/fhir/questionnaire-item-control",
                    code: "radio-button",
                    display: "Radio Button",
                  },
                ],
              },
            },
          ],
          answerOption: [
            {
              valueCoding: {
                system: "http://loinc.org",
                code: "LA6568-5",
                display: "Not at all",
              },
            },
            {
              valueCoding: {
                system: "http://loinc.org",
                code: "LA6569-3",
                display: "Several days",
              },
            },
          ],
        },
        {
          linkId: "SYMPTOMS",
          text: "Associated Symptoms",
          type: "open-choice",
          repeats: true,
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
              valueCodeableConcept: {
                coding: [{ code: "check-box" }],
              },
            },
          ],
          answerOption: [
            { valueString: "Fatigue" },
            { valueString: "Insomnia" },
          ],
        },
        {
          linkId: "SMKSTAT",
          text: "Smoking Status",
          type: "choice",
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
              valueCodeableConcept: {
                coding: [{ code: "drop-down" }],
              },
            },
          ],
          answerValueSet: "#vs-smoking",
        },
        {
          linkId: "PAINVAS",
          text: "Pain Severity Slider",
          type: "integer",
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
              valueCodeableConcept: {
                coding: [{ code: "slider" }],
              },
            },
          ],
        },
        {
          linkId: "BODYWT",
          text: "Body Weight",
          type: "decimal",
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption",
              valueCoding: {
                system: "http://unitsofmeasure.org",
                code: "kg",
                display: "kg",
              },
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption",
              valueCoding: {
                system: "http://unitsofmeasure.org",
                code: "[lb_av]",
                display: "[lb_av]",
              },
            },
          ],
        },
        {
          linkId: "grp-meds",
          text: "Prior Medications Table",
          type: "group",
          item: [
            {
              linkId: "grp-note",
              text: "Record active prescriptions below.",
              type: "display",
            },
            {
              linkId: "MEDTBL",
              text: "Medication Grid",
              type: "group",
              repeats: true,
              extension: [
                {
                  url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
                  valueCodeableConcept: {
                    coding: [{ code: "gtable" }],
                  },
                },
              ],
              item: [
                {
                  linkId: "MEDNAME",
                  text: "Drug Name",
                  type: "string",
                  required: true,
                },
                {
                  linkId: "MEDONGO",
                  text: "Currently Taking",
                  type: "boolean",
                },
              ],
            },
          ],
        },
      ],
    };

    const study = importStudyFromFhirQuestionnaire(lhcPhqQuestionnaire);
    expect(study.forms).toHaveLength(1);
    const form = study.forms[0];
    expect(form.name).toBe("Patient Health Intake (LHC-Forms)");
    expect(form.version).toBe("2.1");
    // Top-level leaf questions grouped into default section + explicit group section
    expect(form.sections).toHaveLength(2);

    const topFields = form.sections[0].fields;
    // Read-only display item 'intro-banner' must be skipped
    expect(topFields.map((f) => f.variableName)).toEqual([
      "PHQ_Q1",
      "SYMPTOMS",
      "SMKSTAT",
      "PAINVAS",
      "BODYWT",
    ]);

    expect(topFields[0].dataType).toBe("radio");
    expect(topFields[0].required).toBe(true);
    expect(topFields[0].customOptions).toEqual([
      { code: "LA6568-5", label: "Not at all", order: 1 },
      { code: "LA6569-3", label: "Several days", order: 2 },
    ]);

    expect(topFields[1].dataType).toBe("checkbox");
    expect(topFields[1].customOptions?.map((o) => o.label)).toEqual([
      "Fatigue",
      "Insomnia",
    ]);

    expect(topFields[2].dataType).toBe("single_select");
    expect(topFields[2].customOptions?.map((o) => o.code)).toEqual([
      "LA18976-3",
      "LA18978-9",
    ]);

    expect(topFields[3].dataType).toBe("vas_scale");

    expect(topFields[4].dataType).toBe("number");
    expect(topFields[4].unit).toBe("kg");
    expect(topFields[4].unitOptions).toEqual(["kg", "[lb_av]"]);

    const medTable = form.sections[1].fields[0];
    expect(medTable.variableName).toBe("MEDTBL");
    expect(medTable.dataType).toBe("repeating_table");
    expect(medTable.repeatingColumns).toHaveLength(2);
    expect(medTable.repeatingColumns?.[1].codelistId).toBe("CL_NY");

    expect(study.codelists.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves long external linkId codes so CDISC conformance pre-flight checks flag SD0001", () => {
    const externalLongLinkId = {
      resourceType: "Questionnaire",
      id: "ext-loinc",
      title: "External Assessment",
      status: "active",
      item: [
        {
          linkId: "PATIENT_SYSTOLIC_BLOOD_PRESSURE_MMHG",
          text: "Systolic Blood Pressure",
          type: "integer",
        },
      ],
    };

    const study = importStudyFromFhirQuestionnaire(externalLongLinkId);
    const violations = validateStudyCompliance(study);
    expect(
      violations.some(
        (v) =>
          v.ruleId === "SD0001" &&
          v.variableName === "PATIENT_SYSTOLIC_BLOOD_PRESSURE_MMHG"
      )
    ).toBe(true);
  });

  it("rejects non-Questionnaire FHIR resources and empty Bundles with clear errors", () => {
    expect(() =>
      importFormFromFhirQuestionnaire({
        resourceType: "Patient",
        id: "pat-1",
      })
    ).toThrow(/Unsupported HL7 FHIR resourceType "Patient"/);

    expect(() =>
      importStudyFromFhirQuestionnaire({
        resourceType: "Observation",
        id: "obs-1",
      })
    ).toThrow(/Unsupported HL7 FHIR resourceType "Observation"/);

    expect(() =>
      importStudyFromFhirQuestionnaire({
        resourceType: "Bundle",
        type: "collection",
        entry: [],
      })
    ).toThrow(/contains no Questionnaire resources/i);

    expect(() =>
      importStudyFromFhirQuestionnaire({
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
      })
    ).toThrow(/contains no Questionnaire resources/i);

    expect(() => importFormFromFhirQuestionnaire("   ")).toThrow(
      /Empty HL7 FHIR JSON payload/
    );
    expect(() => importFormFromFhirQuestionnaire("[1, 2, 3]")).toThrow(
      /root value must be an object/
    );
  });

  it("bounds Questionnaire item nesting depth at 32 levels for both nested groups and repeating table groups", () => {
    const buildNestedQuestionnaire = (
      nestedLevels: number,
      repeats: boolean
    ): Record<string, unknown> => {
      let current: Record<string, unknown> = {
        linkId: "DEEP_LEAF",
        text: "Deep Leaf Question",
        type: "string",
      };
      for (let level = nestedLevels; level >= 1; level--) {
        current = {
          linkId: `GRP_${level}`,
          text: `Group ${level}`,
          type: "group",
          ...(repeats ? { repeats: true } : {}),
          item: [current],
        };
      }
      return {
        resourceType: "Questionnaire",
        id: "depth-check",
        title: "Depth Check",
        status: "active",
        item: [current],
      };
    };

    // Exactly at the 32-level nesting limit still imports cleanly
    const groupAtLimit = importFormFromFhirQuestionnaire(
      buildNestedQuestionnaire(32, false)
    );
    expect(groupAtLimit.sections[0].fields.map((f) => f.variableName)).toEqual([
      "DEEP_LEAF",
    ]);

    const repeatingAtLimit = importFormFromFhirQuestionnaire(
      buildNestedQuestionnaire(32, true)
    );
    expect(repeatingAtLimit.sections[0].isRepeating).toBe(true);
    expect(repeatingAtLimit.sections[0].fields[0].dataType).toBe(
      "repeating_table"
    );

    // Nested past the 32-level limit fails with a readable error on both paths
    expect(() =>
      importFormFromFhirQuestionnaire(buildNestedQuestionnaire(33, false))
    ).toThrow("Questionnaire items are nested more than 32 levels deep.");

    expect(() =>
      importStudyFromFhirQuestionnaire(buildNestedQuestionnaire(33, true))
    ).toThrow("Questionnaire items are nested more than 32 levels deep.");
  });

  it("handles missing answerValueSet lookups, boolean fallback to CL_NY, canonical ValueSet compose concepts, and alternative FHIR item metadata", () => {
    const bundleWithValueSetAndEdgeCases = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "ValueSet",
            url: "https://example.org/fhir/ValueSet/tumor-response",
            compose: {
              include: [
                {
                  system: "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl",
                  concept: [
                    { code: "C4870", display: "Complete Response" },
                    { code: "C999999", display: "Unmapped NCIt Term" },
                  ],
                },
              ],
            },
          },
        },
        {
          resource: {
            resourceType: "Questionnaire",
            name: "StandaloneEligibility",
            url: "https://sponsor.example.org/fhir/Questionnaire/PROTO-77/IE",
            status: "active",
            item: [
              {
                linkId: "UNMATCHED_VS_CHOICE",
                text: "Choice With Missing ValueSet",
                type: "choice",
                answerValueSet:
                  "https://example.org/fhir/ValueSet/does-not-exist",
              },
              {
                linkId: "BLANK_VS_BOOL",
                text: "Eligible for Enrollment",
                type: "boolean",
                answerValueSet: "   ",
              },
              {
                linkId: "DIRECT_BOOL",
                text: "Signed Informed Consent",
                type: "boolean",
              },
              {
                linkId: "COMPOSE_VS",
                text: "Overall Response",
                type: "choice",
                repeats: true,
                extension: [
                  {
                    url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
                    valueCode: "autocomplete",
                  },
                ],
                answerValueSet:
                  "https://example.org/fhir/ValueSet/tumor-response",
              },
              {
                linkId: "NOTES_BOX",
                text: "Investigator Notes",
                type: "string",
                readOnly: true,
                extension: [
                  {
                    url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
                    valueCoding: { code: "text-box" },
                  },
                ],
              },
              {
                linkId: "SYSBP_STR_UNIT",
                text: "Systolic BP",
                type: "quantity",
                extension: [
                  {
                    url: "http://hl7.org/fhir/StructureDefinition/questionnaire-unit",
                    valueString: "mm[Hg]",
                  },
                ],
              },
              {
                linkId: "GLUC_INIT_UNIT",
                text: "Baseline Glucose",
                type: "decimal",
                initial: [
                  {
                    valueQuantity: {
                      value: 95,
                      unit: "mg/dL",
                    },
                  },
                ],
              },
              {
                linkId: "DUP_OPT",
                text: "Primary Cohort",
                type: "choice",
                answerOption: [{ valueInteger: 1 }, { valueInteger: 2 }],
              },
              {
                linkId: "DUP_OPT_SAME_FP",
                text: "Secondary Cohort",
                type: "choice",
                answerOption: [{ valueInteger: 1 }, { valueInteger: 2 }],
              },
              {
                linkId: "DUP_OPT",
                text: "Conflicting Same-Variable Cohort",
                type: "choice",
                answerOption: [{ valueInteger: 3 }, { valueInteger: 4 }],
              },
              {
                linkId: "VISIT_TS",
                text: "Assessment Timestamp",
                type: "dateTime",
              },
              {
                linkId: "DOSE_TIME",
                text: "Dose Time",
                type: "time",
              },
              {
                linkId: "FREE_TEXT",
                text: "Comments",
                type: "text",
              },
              {
                linkId: "EXT_REF",
                text: "External Reference URL",
                type: "url",
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Questionnaire",
            name: "StandaloneEligibility",
            status: "active",
            item: [],
          },
        },
      ],
    };

    const study = importStudyFromFhirQuestionnaire(
      bundleWithValueSetAndEdgeCases
    );
    expect(study.protocolNumber).toBe("PROTO-77");
    expect(study.forms).toHaveLength(2);
    // Duplicate form IDs in a Bundle are disambiguated
    expect(study.forms[0].id).not.toBe(study.forms[1].id);
    // Empty Questionnaire still yields a default section
    expect(study.forms[1].sections).toHaveLength(1);
    expect(study.forms[1].sections[0].fields).toEqual([]);

    const fields = study.forms[0].sections[0].fields;
    const unmatchedChoice = fields.find(
      (f) => f.variableName === "UNMATCHED_VS_CHOICE"
    )!;
    expect(unmatchedChoice.dataType).toBe("single_select");
    expect(unmatchedChoice.codelistId).toBeUndefined();
    expect(unmatchedChoice.customOptions).toBeUndefined();

    const blankVsBool = fields.find((f) => f.variableName === "BLANK_VS_BOOL")!;
    expect(blankVsBool.dataType).toBe("radio");
    expect(blankVsBool.codelistId).toBe("CL_NY");

    const directBool = fields.find((f) => f.variableName === "DIRECT_BOOL")!;
    expect(directBool.dataType).toBe("radio");
    expect(directBool.codelistId).toBe("CL_NY");
    expect(study.codelists.some((cl) => cl.id === "CL_NY")).toBe(true);

    const composeVs = fields.find((f) => f.variableName === "COMPOSE_VS")!;
    expect(composeVs.dataType).toBe("multi_select");
    expect(composeVs.customOptions).toHaveLength(2);

    const notesBox = fields.find((f) => f.variableName === "NOTES_BOX")!;
    expect(notesBox.dataType).toBe("textarea");
    expect(notesBox.readOnly).toBe(true);

    const sysBp = fields.find((f) => f.variableName === "SYSBP_STR_UNIT")!;
    expect(sysBp.unit).toBe("mm[Hg]");

    const gluc = fields.find((f) => f.variableName === "GLUC_INIT_UNIT")!;
    expect(gluc.unit).toBe("mg/dL");

    const dup1 = fields[7];
    const dupSameFp = fields[8];
    const dupConflict = fields[9];
    expect(dupSameFp.codelistId).toBe(dup1.codelistId);
    expect(dupConflict.codelistId).toBe(`${dup1.codelistId}_1`);

    expect(fields.find((f) => f.variableName === "VISIT_TS")?.dataType).toBe(
      "datetime"
    );
    expect(fields.find((f) => f.variableName === "DOSE_TIME")?.dataType).toBe(
      "time"
    );
    expect(fields.find((f) => f.variableName === "FREE_TEXT")?.dataType).toBe(
      "textarea"
    );
    expect(fields.find((f) => f.variableName === "EXT_REF")?.dataType).toBe(
      "text"
    );

    // Re-exporting covers checkbox/multi_select and repeating_table FHIR item types
    const exported = exportFormToFhirQuestionnaire(study.forms[0], study) as {
      item: Array<{ item: Array<{ type: string }> }>;
    };
    expect(exported.item[0].item.some((i) => i.type === "open-choice")).toBe(
      true
    );
  });
});
