// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  resolveFormConditionalState,
  resolveFormConditionalStateForForm,
  getUnsatisfiedRequiredFields,
  getRetainedHiddenValues,
  describeFieldConditionalState,
  CONDITIONAL_PRECEDENCE_NOTES,
  type ConditionalFieldValues,
} from "@/lib/crf";
import type { CRFField, CRFForm, EditCheckRule } from "@/lib/crf";

/**
 * #670 — show, hide and require actions resolved at runtime.
 *
 * The authoring surface could already declare these actions, but nothing
 * applied them while a form was being filled in. These tests pin the resolved
 * contract: precedence between contradictory actions, what a false or
 * undecidable condition does, that hidden values survive, and that validation
 * and rendering read the same state.
 */

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

function rule(
  overrides: Partial<EditCheckRule> & { id: string }
): EditCheckRule {
  return {
    name: overrides.id,
    description: "",
    triggerFieldIds: [],
    actionType: "show_field",
    targetFieldId: "target",
    conditions: [],
    logicalOperator: "AND",
    ...overrides,
  } as EditCheckRule;
}

const SEX = field({ id: "sex", variableName: "SEX" });
const PREGNANCY = field({ id: "pregtest", variableName: "PREGTEST" });
const FIELDS = [SEX, PREGNANCY];

/** Show the pregnancy test only for female subjects. */
const SHOW_WHEN_FEMALE = rule({
  id: "r_show",
  name: "Show pregnancy test for female subjects",
  actionType: "show_field",
  targetFieldId: "pregtest",
  conditions: [{ fieldId: "sex", operator: "eq", value: "F" }],
});

/** Require it once shown. */
const REQUIRE_WHEN_FEMALE = rule({
  id: "r_require",
  name: "Require pregnancy test for female subjects",
  actionType: "require_field",
  targetFieldId: "pregtest",
  conditions: [{ fieldId: "sex", operator: "eq", value: "F" }],
});

/** Hide it for male subjects. */
const HIDE_WHEN_MALE = rule({
  id: "r_hide",
  name: "Hide pregnancy test for male subjects",
  actionType: "hide_field",
  targetFieldId: "pregtest",
  conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
});

function resolve(
  values: ConditionalFieldValues,
  rules: EditCheckRule[] = [
    SHOW_WHEN_FEMALE,
    REQUIRE_WHEN_FEMALE,
    HIDE_WHEN_MALE,
  ]
) {
  return resolveFormConditionalState(FIELDS, rules, values);
}

describe("[#670] CRF conditional visibility and requiredness runtime", () => {
  describe("Show, Hide and Require actions share one runtime contract", () => {
    it("shows and requires a field when its condition is true", () => {
      const state = resolve({ sex: "F" });
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(true);
      expect(preg.required).toBe(true);
      expect(preg.visibilitySource?.ruleId).toBe("r_show");
      expect(preg.requirednessSource?.ruleId).toBe("r_require");
    });

    it("hides a field when a hide condition is true", () => {
      const state = resolve({ sex: "M" });
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(false);
      expect(preg.visibilitySource?.ruleId).toBe("r_hide");
    });

    it("leaves declared defaults alone when every condition is false", () => {
      // Sex is captured but matches neither rule.
      const state = resolve({ sex: "U" });
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(true); // default on screen
      expect(preg.required).toBe(false); // declared optional
      expect(preg.visibilitySource).toBeNull();
      expect(preg.requirednessSource).toBeNull();
      expect(preg.indeterminate).toHaveLength(0);
    });

    it("resolves identically whether values are keyed by id or variable name", () => {
      const byId = resolve({ sex: "F" }).fields.pregtest;
      const byName = resolve({ SEX: "F" }).fields.pregtest;

      expect(byName.visible).toBe(byId.visible);
      expect(byName.required).toBe(byId.required);
      expect(byName.visibilitySource?.ruleId).toBe(
        byId.visibilitySource?.ruleId
      );
    });
  });

  describe("Contradictory-action precedence is explicit", () => {
    const CONTRADICTORY = [
      rule({
        id: "always_show",
        name: "Always show",
        actionType: "show_field",
        targetFieldId: "pregtest",
        conditions: [{ fieldId: "sex", operator: "is_not_empty", value: "" }],
      }),
      rule({
        id: "always_hide",
        name: "Always hide",
        actionType: "hide_field",
        targetFieldId: "pregtest",
        conditions: [{ fieldId: "sex", operator: "is_not_empty", value: "" }],
      }),
    ];

    it("resolves hide over show and records the conflict rather than dropping it", () => {
      const state = resolve({ sex: "F" }, CONTRADICTORY);
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(false);
      expect(preg.visibilitySource?.ruleId).toBe("always_hide");

      expect(state.conflicts).toHaveLength(1);
      expect(state.conflicts[0].fieldId).toBe("pregtest");
      expect(state.conflicts[0].winner.ruleId).toBe("always_hide");
      expect(state.conflicts[0].overridden.map((a) => a.ruleId)).toEqual([
        "always_show",
      ]);
      expect(state.conflicts[0].reason).toMatch(/precedence/i);
    });

    it("suppresses requiredness on a hidden field but preserves the declared flag", () => {
      const mandatory = field({
        id: "pregtest",
        variableName: "PREGTEST",
        required: true,
      });
      const state = resolveFormConditionalState(
        [SEX, mandatory],
        [HIDE_WHEN_MALE],
        { sex: "M" }
      );
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(false);
      expect(preg.required).toBe(false); // cannot block an unsubmittable form
      expect(preg.declaredRequired).toBe(true); // authored intent retained
    });

    it("restores declared requiredness once the field becomes visible again", () => {
      const mandatory = field({
        id: "pregtest",
        variableName: "PREGTEST",
        required: true,
      });
      const hidden = resolveFormConditionalState(
        [SEX, mandatory],
        [HIDE_WHEN_MALE],
        { sex: "M" }
      ).fields.pregtest;
      const shown = resolveFormConditionalState(
        [SEX, mandatory],
        [HIDE_WHEN_MALE],
        { sex: "F" }
      ).fields.pregtest;

      expect(hidden.required).toBe(false);
      expect(shown.visible).toBe(true);
      expect(shown.required).toBe(true);
    });

    it("never lets require_field make an authored-required field optional", () => {
      const mandatory = field({
        id: "pregtest",
        variableName: "PREGTEST",
        required: true,
      });
      // The require rule's condition is false here.
      const state = resolveFormConditionalState(
        [SEX, mandatory],
        [REQUIRE_WHEN_FEMALE],
        { sex: "M" }
      );

      expect(state.fields.pregtest.required).toBe(true);
    });
  });

  describe("Missing and incompatible conditions never fire an action", () => {
    it("treats a missing operand as undecidable, not as false", () => {
      // sex has no value at all.
      const state = resolve({});
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(true); // default preserved
      expect(preg.required).toBe(false);
      expect(preg.visibilitySource).toBeNull();

      const results = preg.indeterminate.map((a) => a.result);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r === "missing")).toBe(true);
    });

    it("reports an unrecognized operator as incompatible without acting", () => {
      const broken = rule({
        id: "r_broken",
        name: "Imported rule with an unknown operator",
        actionType: "hide_field",
        targetFieldId: "pregtest",
        conditions: [
          {
            fieldId: "sex",
            // Shape that can arrive from an import this evaluator cannot map.
            operator: "matches_regex" as never,
            value: "F",
          },
        ],
      });

      const state = resolve({ sex: "F" }, [broken]);
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(true); // never hidden on an undecidable rule
      expect(preg.indeterminate).toHaveLength(1);
      expect(preg.indeterminate[0].result).toBe("incompatible");
    });

    it("walks a field through true, false and missing transitions", () => {
      const missing = resolve({}).fields.pregtest;
      const truthy = resolve({ sex: "F" }).fields.pregtest;
      const falsy = resolve({ sex: "M" }).fields.pregtest;

      expect(missing.indeterminate.length).toBeGreaterThan(0);
      expect(missing.visible).toBe(true);

      expect(truthy.visible).toBe(true);
      expect(truthy.required).toBe(true);

      expect(falsy.visible).toBe(false);
    });
  });

  describe("Hidden values are retained, never silently deleted", () => {
    it("flags a hidden field that still holds a captured value", () => {
      const values = { sex: "M", pregtest: "Negative" };
      const state = resolve(values);
      const preg = state.fields.pregtest;

      expect(preg.visible).toBe(false);
      expect(preg.retainsHiddenValue).toBe(true);
      // The engine is pure: the caller's values are untouched.
      expect(values.pregtest).toBe("Negative");

      const retained = getRetainedHiddenValues(state);
      expect(retained.map((f) => f.fieldId)).toEqual(["pregtest"]);
    });

    it("does not flag a hidden field that was never filled in", () => {
      const state = resolve({ sex: "M" });
      expect(state.fields.pregtest.retainsHiddenValue).toBe(false);
      expect(getRetainedHiddenValues(state)).toHaveLength(0);
    });

    it("treats whitespace-only text as no captured value", () => {
      const state = resolve({ sex: "M", pregtest: "   " });
      expect(state.fields.pregtest.retainsHiddenValue).toBe(false);
    });
  });

  describe("Validation and rendered controls agree on the same state", () => {
    it("reports a visible, required, empty field as unsatisfied", () => {
      const state = resolve({ sex: "F" });
      const unsatisfied = getUnsatisfiedRequiredFields(state);

      expect(unsatisfied.map((f) => f.fieldId)).toEqual(["pregtest"]);
    });

    it("does not demand a value from a hidden field", () => {
      const mandatory = field({
        id: "pregtest",
        variableName: "PREGTEST",
        required: true,
      });
      const state = resolveFormConditionalState(
        [SEX, mandatory],
        [HIDE_WHEN_MALE],
        { sex: "M" }
      );

      expect(getUnsatisfiedRequiredFields(state)).toHaveLength(0);
    });

    it("clears once the required field is answered", () => {
      const state = resolve({ sex: "F", pregtest: "Negative" });
      expect(getUnsatisfiedRequiredFields(state)).toHaveLength(0);
    });
  });

  describe("Every resolved state explains which rule produced it", () => {
    it("names the rule behind a hidden field", () => {
      const preg = resolve({ sex: "M" }).fields.pregtest;
      const sentence = describeFieldConditionalState(preg);

      expect(sentence).toContain("Hide pregnancy test for male subjects");
      expect(preg.visibilitySource?.summary).toBeTruthy();
    });

    it("names the rule behind a required field", () => {
      const preg = resolve({ sex: "F" }).fields.pregtest;
      const sentence = describeFieldConditionalState(preg);

      expect(sentence).toContain("Require pregnancy test for female subjects");
    });

    it("says so when a rule could not be evaluated", () => {
      const preg = resolve({}).fields.pregtest;
      expect(describeFieldConditionalState(preg)).toMatch(
        /could not evaluate/i
      );
    });

    it("reports a retained hidden value in the explanation", () => {
      const preg = resolve({ sex: "M", pregtest: "Negative" }).fields.pregtest;
      expect(describeFieldConditionalState(preg)).toMatch(/retained/i);
    });

    it("falls back to the field definition when no rule applies", () => {
      const mandatory = field({
        id: "pregtest",
        variableName: "PREGTEST",
        required: true,
      });
      const state = resolveFormConditionalState([SEX, mandatory], [], {
        sex: "F",
      });

      expect(describeFieldConditionalState(state.fields.pregtest)).toContain(
        "required by field definition"
      );
    });
  });

  describe("Form-level convenience wrapper", () => {
    const form: CRFForm = {
      id: "f1",
      name: "Demographics",
      domain: "DM",
      description: "",
      version: "1.0",
      sections: [{ id: "s1", title: "Subject", fields: [SEX, PREGNANCY] }],
      rules: [SHOW_WHEN_FEMALE, REQUIRE_WHEN_FEMALE, HIDE_WHEN_MALE],
    };

    it("flattens sections and uses the form's own rules", () => {
      const state = resolveFormConditionalStateForForm(form, { sex: "M" });

      expect(Object.keys(state.fields).sort()).toEqual(["pregtest", "sex"]);
      expect(state.fields.pregtest.visible).toBe(false);
    });

    it("ignores raise_query and set_value actions", () => {
      const withQuery: CRFForm = {
        ...form,
        rules: [
          rule({
            id: "r_query",
            actionType: "raise_query",
            targetFieldId: "pregtest",
            conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
            queryMessage: "Check this",
          }),
        ],
      };
      const state = resolveFormConditionalStateForForm(withQuery, { sex: "M" });

      // A query rule must not move the field off screen.
      expect(state.fields.pregtest.visible).toBe(true);
      expect(state.fields.pregtest.visibilitySource).toBeNull();
    });

    it("tolerates a form with no rules at all", () => {
      const bare: CRFForm = { ...form, rules: [] };
      const state = resolveFormConditionalStateForForm(bare, {});

      expect(state.conflicts).toHaveLength(0);
      expect(state.fields.pregtest.visible).toBe(true);
    });
  });

  it("publishes its precedence rules for authors and tests to share", () => {
    expect(CONDITIONAL_PRECEDENCE_NOTES.length).toBeGreaterThan(0);
    expect(CONDITIONAL_PRECEDENCE_NOTES.join(" ")).toMatch(/hide_field/);
  });
});
