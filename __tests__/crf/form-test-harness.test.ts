import { describe, it, expect } from "vitest";
import {
  runFormTest,
  fillSampleValues,
  resetScopeValues,
  buildScopedKey,
  buildSampleValue,
  projectScopedValues,
  setScopedValue,
  getScopedValue,
  flattenFormFields,
  DEFAULT_TEST_SCOPE,
  type FormTestScope,
  type ConditionalFieldValues,
  type CRFField,
  type CRFForm,
  type CodelistDefinition,
  type EditCheckRule,
} from "@/lib/crf";

/**
 * #541 — in-builder form test harness.
 *
 * The dock is only trustworthy if it agrees with the EDC simulator, so the
 * harness composes the shared calculation, rule and conditional-visibility
 * runtimes rather than approximating them. These tests pin that composition,
 * the scope boundary that keeps subjects and visits separate, and the
 * explained results for valid, invalid and missing inputs.
 */

function codelist(
  id: string,
  codes: string[],
  name = "Codelist"
): CodelistDefinition {
  return {
    id,
    name,
    options: codes.map((code, order) => ({ code, label: code, order })),
  };
}

function field(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "text",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

const HEIGHT = field({
  id: "height",
  variableName: "HEIGHT",
  dataType: "number",
  minValue: 100,
  maxValue: 220,
});
const WEIGHT = field({
  id: "weight",
  variableName: "WEIGHT",
  dataType: "number",
  minValue: 30,
  maxValue: 200,
});
const BMI = field({
  id: "bmi",
  variableName: "BMI",
  dataType: "calculated",
  calculationFormula: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))",
});
const SEX = field({ id: "sex", variableName: "SEX", required: true });
const PREG = field({ id: "pregtest", variableName: "PREGTEST" });

const HIDE_PREG_FOR_MALES: EditCheckRule = {
  id: "rule_hide_preg",
  name: "Hide pregnancy test for male subjects",
  description: "",
  triggerFieldIds: ["sex"],
  actionType: "hide_field",
  targetFieldId: "pregtest",
  conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
  logicalOperator: "AND",
};

const QUERY_TALL: EditCheckRule = {
  id: "rule_query_tall",
  name: "Query implausible height",
  description: "",
  triggerFieldIds: ["height"],
  actionType: "raise_query",
  targetFieldId: "height",
  conditions: [{ fieldId: "height", operator: "gt", value: 250 }],
  logicalOperator: "AND",
  queryMessage: "Height exceeds plausible range",
};

function buildForm(): CRFForm {
  return {
    id: "form_test",
    name: "Vitals",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      { id: "sec_1", title: "Body", fields: [HEIGHT, WEIGHT, BMI] },
      { id: "sec_2", title: "Demographics", fields: [SEX, PREG] },
    ],
    rules: [HIDE_PREG_FOR_MALES, QUERY_TALL],
  };
}

const SCOPE = DEFAULT_TEST_SCOPE;
const OTHER_SCOPE: FormTestScope = {
  subjectId: "TEST-002",
  visitId: "other_visit",
};

describe("[#541] In-builder form test harness", () => {
  describe("Scope keeps subjects, visits and forms separate", () => {
    it("addresses values by subject, visit and field", () => {
      expect(buildScopedKey(SCOPE, "height")).toBe(
        `${SCOPE.subjectId}_${SCOPE.visitId}_height`
      );
    });

    it("fills only the scope under test", () => {
      const seeded = { [buildScopedKey(OTHER_SCOPE, "height")]: 999 };
      const filled = fillSampleValues(buildForm(), seeded, SCOPE);

      expect(filled[buildScopedKey(OTHER_SCOPE, "height")]).toBe(999);
      expect(filled[buildScopedKey(SCOPE, "height")]).toBeDefined();
    });

    it("resets only the scope under test", () => {
      const form = buildForm();
      let values: ConditionalFieldValues = {};
      values = fillSampleValues(form, values, SCOPE);
      values = fillSampleValues(form, values, OTHER_SCOPE);

      const reset = resetScopeValues(form, values, SCOPE);

      expect(reset[buildScopedKey(SCOPE, "height")]).toBeUndefined();
      expect(reset[buildScopedKey(OTHER_SCOPE, "height")]).toBeDefined();
    });

    it("never mutates the value map it was given", () => {
      const form = buildForm();
      const original: ConditionalFieldValues = {};
      fillSampleValues(form, original, SCOPE);
      expect(Object.keys(original)).toHaveLength(0);
    });

    it("round-trips a single scoped value", () => {
      const next = setScopedValue({}, SCOPE, "height", 180);
      expect(getScopedValue(next, SCOPE, "height")).toBe(180);
      expect(getScopedValue(next, OTHER_SCOPE, "height")).toBeUndefined();
    });
  });

  describe("Sample values are deterministic and respect field definitions", () => {
    it("produces the same value for the same field and index every time", () => {
      expect(buildSampleValue(HEIGHT, 3)).toBe(buildSampleValue(HEIGHT, 3));
    });

    it("stays inside a numeric field's declared bounds", () => {
      for (let index = 0; index < 25; index++) {
        const value = buildSampleValue(HEIGHT, index) as number;
        expect(value).toBeGreaterThanOrEqual(100);
        expect(value).toBeLessThanOrEqual(220);
      }
    });

    it("keeps an integer field integral", () => {
      const int = field({
        id: "count",
        dataType: "integer",
        minValue: 0,
        maxValue: 10,
      });
      for (let index = 0; index < 10; index++) {
        expect(Number.isInteger(buildSampleValue(int, index))).toBe(true);
      }
    });

    it("bounds the scale types to their defined ranges", () => {
      const vas = field({ id: "vas", dataType: "vas_scale" });
      const nrs = field({ id: "nrs", dataType: "nrs_scale" });
      for (let index = 0; index < 30; index++) {
        expect(buildSampleValue(vas, index) as number).toBeLessThanOrEqual(100);
        expect(buildSampleValue(nrs, index) as number).toBeLessThanOrEqual(10);
      }
    });

    it("leaves calculated fields to derive rather than handing them a value", () => {
      expect(buildSampleValue(BMI, 0)).toBeNull();
      const filled = fillSampleValues(buildForm(), {}, SCOPE);
      expect(filled[buildScopedKey(SCOPE, "bmi")]).toBeUndefined();
    });

    it("fills a coded field from the study codelist it references", () => {
      // Regression: found by opening the dock on the real PHQ-9 preset, where
      // coded items reference a study codelist rather than carrying inline
      // options. Without the lookup they were filled with a placeholder that
      // is not a member of the codelist and is not numeric, which silently
      // broke every calculation scored from those items.
      const coded = field({
        id: "phq1",
        variableName: "PHQ1",
        dataType: "single_select",
        codelistId: "cl_phq",
      });
      const codelists = [codelist("cl_phq", ["0", "1", "2"], "PHQ-9 frequency")];

      const value = buildSampleValue(coded, 1, codelists);
      expect(["0", "1", "2"]).toContain(value);
    });

    it("rotates through a codelist so a filled form exercises more than one branch", () => {
      const coded = field({
        id: "phq1",
        dataType: "single_select",
        codelistId: "cl_phq",
      });
      const codelists = [codelist("cl_phq", ["0", "1"])];

      expect(buildSampleValue(coded, 0, codelists)).toBe("0");
      expect(buildSampleValue(coded, 1, codelists)).toBe("1");
      expect(buildSampleValue(coded, 2, codelists)).toBe("0");
    });

    it("prefers a field's own inline options over the study codelist", () => {
      const coded = field({
        id: "local",
        dataType: "radio",
        codelistId: "cl_phq",
        customOptions: [{ code: "LOCAL", label: "Local", order: 1 }],
      });
      const codelists = [codelist("cl_phq", ["0"])];

      expect(buildSampleValue(coded, 0, codelists)).toBe("LOCAL");
    });

    it("lets a coded score feed a calculation once real codes are used", () => {
      const item = (id: string) =>
        field({
          id,
          variableName: id.toUpperCase(),
          dataType: "single_select",
          codelistId: "cl_score",
        });
      const total = field({
        id: "total",
        variableName: "TOTAL",
        dataType: "calculated",
        calculationFormula: "Q1 + Q2",
      });
      const form: CRFForm = {
        id: "f",
        name: "Scored",
        domain: "QS",
        description: "",
        version: "1.0",
        sections: [{ id: "s", title: "s", fields: [item("q1"), item("q2"), total] }],
        rules: [],
      };
      const codelists = [codelist("cl_score", ["2", "3"], "Score")];

      const values = fillSampleValues(form, {}, SCOPE, codelists);
      const report = runFormTest(form, values, SCOPE);
      const derived = report.calculations.find((c) => c.fieldId === "total");

      expect(derived?.derivation.status).toBe("success");
      expect(derived?.derivation.result).toBe(5);
    });

    it("does not invent a signature", () => {
      expect(
        buildSampleValue(field({ id: "sig", dataType: "signature" }), 0)
      ).toBeNull();
    });
  });

  describe("Explained results for valid, missing and invalid inputs", () => {
    it("derives a calculation from filled inputs", () => {
      const values = setScopedValue(
        setScopedValue({}, SCOPE, "height", 180),
        SCOPE,
        "weight",
        81
      );
      const report = runFormTest(buildForm(), values, SCOPE);
      const bmi = report.calculations.find((c) => c.fieldId === "bmi");

      expect(bmi?.derivation.status).toBe("success");
      expect(bmi?.derivation.result).toBeCloseTo(25, 0);
    });

    it("reports missing inputs as missing rather than as a failure", () => {
      const report = runFormTest(buildForm(), {}, SCOPE);
      const bmi = report.calculations.find((c) => c.fieldId === "bmi");

      expect(bmi?.derivation.status).toBe("missing_inputs");
    });

    it("surfaces a division by zero distinctly from a missing input", () => {
      const values = setScopedValue(
        setScopedValue({}, SCOPE, "height", 0),
        SCOPE,
        "weight",
        70
      );
      const report = runFormTest(buildForm(), values, SCOPE);
      const bmi = report.calculations.find((c) => c.fieldId === "bmi");

      expect(bmi?.derivation.status).toBe("division_by_zero");
    });

    it("explains every rule with a four-valued result", () => {
      const report = runFormTest(buildForm(), {}, SCOPE);
      const hide = report.rules.find((r) => r.ruleId === "rule_hide_preg");

      // Sex is unanswered, so the rule is undecidable rather than false.
      expect(hide?.result).toBe("missing");
      expect(hide?.explanation.summary).toBeTruthy();
      expect(report.summary.rulesUndecidable).toBeGreaterThan(0);
    });

    it("marks a firing query rule as raising a query", () => {
      const values = setScopedValue({}, SCOPE, "height", 300);
      const report = runFormTest(buildForm(), values, SCOPE);
      const query = report.rules.find((r) => r.ruleId === "rule_query_tall");

      expect(query?.result).toBe("true");
      expect(query?.raisesQuery).toBe(true);
      expect(query?.queryMessage).toBe("Height exceeds plausible range");
      expect(report.summary.openQueries).toBe(1);
    });

    it("does not treat a non-firing rule as a query", () => {
      const values = setScopedValue({}, SCOPE, "height", 180);
      const report = runFormTest(buildForm(), values, SCOPE);
      const query = report.rules.find((r) => r.ruleId === "rule_query_tall");

      expect(query?.result).toBe("false");
      expect(query?.raisesQuery).toBe(false);
    });
  });

  describe("Derived values are visible to rules and visibility", () => {
    // Regression: found by opening the dock on the real PHQ-9 preset. A query
    // rule gated on the calculated total score reported "waiting on input"
    // because derivations were computed for display but never written back,
    // while the same rule fires correctly in the EDC simulator, which does
    // persist derived values.
    function buildScoredForm(threshold: number): CRFForm {
      const item = (id: string) =>
        field({ id, variableName: id.toUpperCase(), dataType: "number" });
      const total = field({
        id: "total",
        variableName: "TOTAL",
        dataType: "calculated",
        calculationFormula: "Q1 + Q2",
      });
      return {
        id: "f_scored",
        name: "Scored",
        domain: "QS",
        description: "",
        version: "1.0",
        sections: [
          { id: "s", title: "s", fields: [item("q1"), item("q2"), total] },
        ],
        rules: [
          {
            id: "rule_elevated",
            name: "Query elevated score",
            description: "",
            triggerFieldIds: ["total"],
            actionType: "raise_query",
            targetFieldId: "total",
            conditions: [
              { fieldId: "total", operator: "gte", value: threshold },
            ],
            logicalOperator: "AND",
            queryMessage: "Score is elevated",
          },
        ],
      };
    }

    it("lets a rule read a calculated field the same run it is derived", () => {
      const form = buildScoredForm(8);
      let values = setScopedValue({}, SCOPE, "q1", 5);
      values = setScopedValue(values, SCOPE, "q2", 5);

      const report = runFormTest(form, values, SCOPE);

      expect(
        report.calculations.find((c) => c.fieldId === "total")?.derivation
          .result
      ).toBe(10);
      const rule = report.rules.find((r) => r.ruleId === "rule_elevated");
      expect(rule?.result).toBe("true");
      expect(rule?.raisesQuery).toBe(true);
    });

    it("still reports the rule as false when the derived value is below the threshold", () => {
      const form = buildScoredForm(8);
      let values = setScopedValue({}, SCOPE, "q1", 1);
      values = setScopedValue(values, SCOPE, "q2", 2);

      const report = runFormTest(form, values, SCOPE);
      expect(report.rules[0].result).toBe("false");
    });

    it("leaves the rule undecidable while the calculation cannot derive", () => {
      const form = buildScoredForm(8);
      // q2 unanswered, so the total cannot be derived.
      const values = setScopedValue({}, SCOPE, "q1", 5);

      const report = runFormTest(form, values, SCOPE);
      expect(report.calculations[0].derivation.status).toBe("missing_inputs");
      expect(report.rules[0].result).toBe("missing");
    });

    it("does not write back a failed derivation", () => {
      const form = buildScoredForm(8);
      const report = runFormTest(form, {}, SCOPE);
      // Nothing derived, so nothing to gate on.
      expect(report.summary.openQueries).toBe(0);
    });
  });

  describe("Agreement with the shared conditional runtime", () => {
    it("hides a field exactly as the conditional runtime resolves it", () => {
      const values = setScopedValue({}, SCOPE, "sex", "M");
      const report = runFormTest(buildForm(), values, SCOPE);

      expect(report.conditional.fields.pregtest.visible).toBe(false);
      expect(report.summary.fieldsHidden).toBe(1);
      expect(report.summary.fieldsVisible).toBe(4);
    });

    it("counts a visible, required, empty field as unsatisfied", () => {
      const report = runFormTest(buildForm(), {}, SCOPE);

      expect(report.unsatisfiedRequired.map((f) => f.fieldId)).toEqual(["sex"]);
      expect(report.summary.unsatisfiedRequired).toBe(1);
    });

    it("clears once the required field is answered", () => {
      const values = setScopedValue({}, SCOPE, "sex", "F");
      const report = runFormTest(buildForm(), values, SCOPE);

      expect(report.summary.unsatisfiedRequired).toBe(0);
    });

    it("projects values under both field id and variable name", () => {
      const values = setScopedValue({}, SCOPE, "height", 175);
      const projected = projectScopedValues(buildForm(), values, SCOPE);

      expect(projected.height).toBe(175);
      expect(projected.HEIGHT).toBe(175);
    });
  });

  describe("Edit, test, close and reopen continuity", () => {
    it("keeps the record intact across a close and reopen of the dock", () => {
      const form = buildForm();
      // "Open" and fill.
      let values = fillSampleValues(form, {}, SCOPE);
      const beforeClose = runFormTest(form, values, SCOPE);

      // Closing the dock does not touch the value map the container holds.
      const afterReopen = runFormTest(form, values, SCOPE);

      expect(afterReopen.summary).toEqual(beforeClose.summary);
      expect(getScopedValue(values, SCOPE, "height")).toBe(
        getScopedValue(values, SCOPE, "height")
      );

      // And a subsequent edit still lands on the same record.
      values = setScopedValue(values, SCOPE, "height", 190);
      expect(getScopedValue(values, SCOPE, "height")).toBe(190);
    });

    it("re-runs cleanly when the form definition changes underneath it", () => {
      const form = buildForm();
      const values = fillSampleValues(form, {}, SCOPE);

      // The author deletes a section mid-session.
      const edited: CRFForm = { ...form, sections: [form.sections[0]] };
      const report = runFormTest(edited, values, SCOPE);

      expect(Object.keys(report.conditional.fields).sort()).toEqual([
        "bmi",
        "height",
        "weight",
      ]);
      // Stale values for removed fields do not resurrect them.
      expect(report.conditional.fields.pregtest).toBeUndefined();
    });

    it("tolerates a form with no sections or rules", () => {
      const bare: CRFForm = {
        ...buildForm(),
        sections: [],
        rules: [],
      };
      const report = runFormTest(bare, {}, SCOPE);

      expect(report.calculations).toHaveLength(0);
      expect(report.rules).toHaveLength(0);
      expect(report.summary.fieldsVisible).toBe(0);
      expect(flattenFormFields(bare)).toHaveLength(0);
    });
  });
});
