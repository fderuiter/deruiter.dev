/**
 * Shared synthetic fixtures for the #679 saved-test impact suites: a vitals
 * form with a calculation, a coded field, a visibility rule and two visits,
 * plus two saved scenarios that depend on disjoint parts of it.
 */
import { createScenario, rerunScenarios, upsertScenario } from "@/lib/crf";
import type { CRFField, CRFForm, StudyProtocol, TestScenario } from "@/lib/crf";

export const NOW = new Date("2026-10-01T12:00:00.000Z");

export function field(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "number",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

export function buildForm(): CRFForm {
  return {
    id: "form_vs",
    name: "Vitals",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec_1",
        title: "Vitals",
        fields: [
          field({ id: "height", label: "Height", unit: "cm" }),
          field({ id: "weight", label: "Weight", unit: "kg" }),
          field({
            id: "bmi",
            label: "BMI",
            dataType: "calculated",
            calculationFormula: "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
          }),
          field({
            id: "sex",
            label: "Sex",
            dataType: "single_select",
            codelistId: "CL_SEX",
          }),
          field({ id: "pregtest", label: "Pregnancy test", dataType: "text" }),
        ],
      },
    ],
    rules: [
      {
        id: "rule_hide_preg",
        name: "Hide pregnancy test for male subjects",
        description: "",
        triggerFieldIds: ["sex"],
        actionType: "hide_field",
        targetFieldId: "pregtest",
        conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
        logicalOperator: "AND",
      },
    ],
  };
}

export function buildStudy(): StudyProtocol {
  return {
    id: "study_679",
    protocolNumber: "TST-679",
    studyName: "Amendment impact",
    phase: "Phase II",
    sponsor: "Synthetic",
    therapeuticArea: "Cardiology",
    version: "1.0",
    lastModified: NOW.toISOString(),
    forms: [buildForm()],
    visits: [
      {
        id: "v_screen",
        oid: "SE.SCREEN",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 3,
        windowAfter: 3,
        assignedFormIds: ["form_vs"],
      },
      {
        id: "v_week4",
        oid: "SE.WEEK4",
        name: "Week 4",
        visitType: "Scheduled",
        targetDay: 28,
        windowBefore: 3,
        windowAfter: 3,
        assignedFormIds: [],
      },
    ],
    codelists: [
      {
        id: "CL_SEX",
        name: "Sex",
        options: [
          { code: "M", label: "Male", order: 1 },
          { code: "F", label: "Female", order: 2 },
        ],
      },
    ],
  } as StudyProtocol;
}

export const SCOPE = { subjectId: "TEST-001", visitId: "v_screen" };

export function bmiScenario(): TestScenario {
  return {
    ...createScenario({
      name: "BMI derives from height and weight",
      formId: "form_vs",
      scope: SCOPE,
      inputs: { height: 180, weight: 81 },
      expectations: [
        {
          kind: "calculation",
          fieldId: "bmi",
          expectedStatus: "success",
          expectedValue: 25,
        },
      ],
      now: NOW,
    }),
    id: "scn_bmi",
  };
}

export function pregScenario(): TestScenario {
  return {
    ...createScenario({
      name: "Male subject hides pregnancy test",
      formId: "form_vs",
      scope: SCOPE,
      inputs: { sex: "M" },
      expectations: [
        { kind: "field_visible", fieldId: "pregtest", expected: false },
        { kind: "rule_result", ruleId: "rule_hide_preg", expected: "true" },
      ],
      now: NOW,
    }),
    id: "scn_preg",
  };
}

/** A study with both scenarios saved and freshly run with dependency tracking. */
export function ranStudy(): StudyProtocol {
  let study = buildStudy();
  for (const scenario of [bmiScenario(), pregScenario()]) {
    study = upsertScenario(study, scenario);
  }
  return rerunScenarios(study, ["scn_bmi", "scn_preg"], NOW).study;
}

export function amend(
  study: StudyProtocol,
  mutate: (draft: StudyProtocol) => void
): StudyProtocol {
  const draft = JSON.parse(JSON.stringify(study)) as StudyProtocol;
  mutate(draft);
  return draft;
}

export function fieldOf(study: StudyProtocol, id: string): CRFField {
  const found = study.forms[0].sections[0].fields.find((f) => f.id === id);
  if (!found) throw new Error(`fixture field ${id} missing`);
  return found;
}
