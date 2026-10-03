import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  assessScenarioFreshness,
  createScenario,
  fingerprintScenarioDependencies,
  rerunScenarios,
  upsertScenario,
} from "@/lib/crf";
import type { CRFField, StudyProtocol } from "@/lib/crf";

/**
 * #679 property gates: wording-only edits never invalidate evidence, and any
 * edit to a formula a scenario reads always does.
 */

function field(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "number",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

function ranStudy(): StudyProtocol {
  const study = {
    id: "study_prop",
    protocolNumber: "P-1",
    studyName: "Property",
    phase: "Phase I",
    sponsor: "Synthetic",
    therapeuticArea: "None",
    version: "1",
    lastModified: "2026-10-01T00:00:00.000Z",
    forms: [
      {
        id: "f",
        name: "Form",
        domain: "XX",
        description: "",
        version: "1",
        sections: [
          {
            id: "s",
            title: "S",
            fields: [
              field({ id: "a" }),
              field({ id: "b" }),
              field({
                id: "total",
                dataType: "calculated",
                calculationFormula: "A + B",
              }),
              field({
                id: "flag",
                dataType: "single_select",
                codelistId: "CL",
              }),
            ],
          },
        ],
        rules: [
          {
            id: "r",
            name: "Rule",
            description: "",
            triggerFieldIds: ["flag"],
            actionType: "hide_field",
            targetFieldId: "a",
            conditions: [{ fieldId: "flag", operator: "eq", value: "Y" }],
            logicalOperator: "AND",
          },
        ],
      },
    ],
    visits: [
      {
        id: "v",
        oid: "SE.V",
        name: "Visit",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["f"],
      },
    ],
    codelists: [
      {
        id: "CL",
        name: "Yes/No",
        options: [
          { code: "Y", label: "Yes", order: 1 },
          { code: "N", label: "No", order: 2 },
        ],
      },
    ],
  } as StudyProtocol;
  const scenario = {
    ...createScenario({
      name: "Total and visibility",
      formId: "f",
      scope: { subjectId: "S1", visitId: "v" },
      inputs: { a: 1, b: 2, flag: "N" },
      expectations: [
        {
          kind: "calculation",
          fieldId: "total",
          expectedStatus: "success",
          expectedValue: 3,
        },
        { kind: "field_visible", fieldId: "a", expected: true },
      ],
    }),
    id: "scn",
  };
  return rerunScenarios(upsertScenario(study, scenario), ["scn"]).study;
}

describe("[#679] scenario impact properties", () => {
  it("wording-only edits never change freshness or fingerprints", () => {
    const base = ranStudy();
    const scenario = base.testScenarios![0];
    const baseline = fingerprintScenarioDependencies(scenario, base);

    fc.assert(
      fc.property(
        fc.record({
          fieldLabel: fc.string(),
          fieldDescription: fc.string(),
          ruleName: fc.string(),
          ruleDescription: fc.string(),
          decode: fc.string(),
          codelistName: fc.string(),
          visitName: fc.string(),
          formName: fc.string(),
          columnSpan: fc.integer({ min: 1, max: 12 }),
        }),
        (edit) => {
          const study = JSON.parse(JSON.stringify(base)) as StudyProtocol;
          const form = study.forms[0];
          for (const f of form.sections[0].fields) {
            f.label = edit.fieldLabel;
            f.description = edit.fieldDescription;
            f.columnSpan = edit.columnSpan;
          }
          form.name = edit.formName;
          form.rules[0].name = edit.ruleName;
          form.rules[0].description = edit.ruleDescription;
          study.codelists[0].name = edit.codelistName;
          study.codelists[0].options[0].label = edit.decode;
          study.visits[0].name = edit.visitName;

          expect(fingerprintScenarioDependencies(scenario, study)).toEqual(
            baseline
          );
          expect(assessScenarioFreshness(scenario, study).freshness).toBe(
            "current"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("any change to a read formula always marks the evidence stale", () => {
    const base = ranStudy();
    const scenario = base.testScenarios![0];

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s !== "A + B"),
        (formula) => {
          const study = JSON.parse(JSON.stringify(base)) as StudyProtocol;
          study.forms[0].sections[0].fields[2].calculationFormula = formula;
          const result = assessScenarioFreshness(scenario, study);
          expect(result.freshness).toBe("stale");
          expect(result.standing).not.toBe("passing");
          expect(
            result.reasons.some(
              (reason) =>
                reason.dependency.key === "field:total" &&
                reason.aspects.includes("formula")
            )
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("never throws and never reports passing for arbitrary snapshot corruption", () => {
    const base = ranStudy();
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.string()),
        fc.integer(),
        (fingerprints, version) => {
          const study = JSON.parse(JSON.stringify(base)) as StudyProtocol;
          const scenario = study.testScenarios![0];
          scenario.lastRun!.dependencies = { version, fingerprints };
          const result = assessScenarioFreshness(scenario, study);
          expect(["stale", "unknown", "current"]).toContain(result.freshness);
          if (result.freshness !== "current") {
            expect(["stale", "unknown"]).toContain(result.standing);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
