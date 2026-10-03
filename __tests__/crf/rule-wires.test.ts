import { describe, it, expect } from "vitest";
import type { CRFField, EditCheckRule } from "@/lib/crf/types";
import { fromAny } from "@total-typescript/shoehorn";
import { STUDY_PRESETS } from "@/lib/crf/presets";
import {
  buildRuleWireGraph,
  configureWireRule,
  connectWireSource,
  createWireRule,
  describeRuleLogic,
  removeWireCondition,
  rulesFromWireGraph,
  setWireGroupOperator,
  setWireOuterOperator,
  updateWireCondition,
} from "@/lib/crf/rule-wires";

// Synthetic fields and rules only (#674).
const fields: CRFField[] = [
  {
    id: "f_sys",
    variableName: "SYSBP",
    label: "Systolic BP",
    dataType: "integer",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_dia",
    variableName: "DIABP",
    label: "Diastolic BP",
    dataType: "integer",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_preg",
    variableName: "PREGYN",
    label: "Pregnant",
    dataType: "radio",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_wt",
    variableName: "WEIGHT",
    label: "Weight",
    dataType: "number",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_bmi",
    variableName: "BMI",
    label: "BMI",
    dataType: "number",
    columnSpan: 6,
    required: false,
  },
];

const legacyQuery: EditCheckRule = {
  id: "r_legacy",
  name: "Systolic over threshold",
  description: "synthetic",
  triggerFieldIds: ["f_sys"],
  actionType: "raise_query",
  targetFieldId: "f_sys",
  conditions: [{ fieldId: "f_sys", operator: "gt", value: 180 }],
  logicalOperator: "AND",
  querySeverity: "warning",
  queryMessage: "Confirm systolic value.",
};

const groupedShow: EditCheckRule = {
  id: "r_grouped",
  name: "Show pregnancy follow-up",
  description: "synthetic",
  triggerFieldIds: ["f_preg", "f_sys", "f_wt"],
  actionType: "show_field",
  targetFieldId: "f_dia",
  // A stale flat mirror, as an import might leave it: must survive verbatim.
  conditions: [{ fieldId: "f_wt", operator: "lt", value: 1 }],
  logicalOperator: "OR",
  conditionGroups: [
    {
      id: "g1",
      logicalOperator: "AND",
      conditions: [
        { fieldId: "f_preg", operator: "eq", value: "Y" },
        {
          fieldId: "f_sys",
          operator: "gte",
          value: 140,
          crossVisitId: "v_screen",
        },
      ],
    },
    {
      id: "g2",
      logicalOperator: "OR",
      conditions: [
        { fieldId: "f_dia", operator: "gt", value: 0, compareFieldId: "f_sys" },
      ],
    },
    { id: "g3", logicalOperator: "AND", conditions: [] },
  ],
  groupLogicalOperator: "OR",
};

const listMembership: EditCheckRule = {
  id: "r_in",
  name: "Mandatory when listed",
  description: "synthetic",
  triggerFieldIds: ["PREGYN"],
  actionType: "require_field",
  targetFieldId: "f_wt",
  conditions: [{ fieldId: "PREGYN", operator: "in", value: ["Y", "U"] }],
  logicalOperator: "AND",
};

const derivation: EditCheckRule = {
  id: "r_bmi",
  name: "Derive BMI",
  description: "synthetic",
  triggerFieldIds: [],
  actionType: "set_value",
  targetFieldId: "f_bmi",
  conditions: [],
  logicalOperator: "AND",
  formulaExpression: "WEIGHT / 3",
};

const unsupported: EditCheckRule = {
  id: "r_unsupported",
  name: "Imported XPath check",
  description: "synthetic",
  triggerFieldIds: ["f_sys"],
  actionType: "hide_field",
  targetFieldId: "f_dia",
  conditions: [],
  logicalOperator: "AND",
  unsupportedExpression: {
    raw: { xpath: "count(//x) > 2" },
    reason: "XPath expression",
  },
};

const unknownOperator = fromAny<EditCheckRule, Record<string, unknown>>({
  id: "r_unknown_op",
  name: "Unknown operator",
  description: "synthetic",
  triggerFieldIds: ["f_sys"],
  actionType: "raise_query",
  targetFieldId: "f_sys",
  conditions: [{ fieldId: "f_sys", operator: "matches", value: "^1" }],
  logicalOperator: "AND",
  conditionGroups: [],
});

const syntheticRules = [
  legacyQuery,
  groupedShow,
  listMembership,
  derivation,
  unsupported,
  unknownOperator,
];

describe("rule wires: sentence to wires to sentence equivalence (#674)", () => {
  it("rebuilds every synthetic rule deep-equal from its wire projection", () => {
    const graph = buildRuleWireGraph(syntheticRules, fields);
    const rebuilt = rulesFromWireGraph(graph);
    expect(rebuilt).toEqual(syntheticRules);
    rebuilt.forEach((rule, i) => {
      expect(describeRuleLogic(rule, fields)).toBe(
        describeRuleLogic(syntheticRules[i], fields)
      );
      expect(graph.rules[i].sentence).toBe(
        describeRuleLogic(syntheticRules[i], fields)
      );
    });
  });

  it("round-trips every rule in every bundled preset study", () => {
    let count = 0;
    STUDY_PRESETS.forEach(({ study }) => {
      study.forms.forEach((form) => {
        const formFields = form.sections.flatMap((s) => s.fields);
        const rebuilt = rulesFromWireGraph(
          buildRuleWireGraph(form.rules, formFields)
        );
        expect(rebuilt).toEqual(form.rules);
        count += form.rules.length;
      });
    });
    expect(count).toBeGreaterThan(0);
  });

  it("keeps groups, cross-visit comparators and field comparisons in the sentence", () => {
    expect(describeRuleLogic(groupedShow, fields)).toBe(
      'When (PREGYN equals "Y" AND SYSBP at visit v_screen is greater than or equal to 140) OR (DIABP is greater than field SYSBP) OR (always true), show DIABP.'
    );
    expect(describeRuleLogic(legacyQuery, fields)).toBe(
      'When (SYSBP is greater than 180), raise a warning query on SYSBP (message: "Confirm systolic value.").'
    );
    expect(describeRuleLogic(derivation, fields)).toBe(
      "Always derive BMI = WEIGHT / 3."
    );
  });

  it("projects one wire per condition, comparison and trigger-only reference", () => {
    const view = buildRuleWireGraph([groupedShow], fields).rules[0];
    expect(
      view.wires.map((w) => [w.role, w.sourceFieldId, w.targetFieldId])
    ).toEqual([
      ["condition", "f_preg", "f_dia"],
      ["condition", "f_sys", "f_dia"],
      ["condition", "f_dia", "f_dia"],
      ["comparison", "f_sys", "f_dia"],
      ["trigger", "f_wt", "f_dia"],
    ]);
    expect(view.groups.map((g) => g.conditionWireIds.length)).toEqual([
      2, 1, 0,
    ]);
    expect(view.wires[0].description).toBe(
      'PREGYN to DIABP: Show field when PREGYN equals "Y" (condition 1 of group 1, rule "Show pregnancy follow-up").'
    );
  });

  it("marks unsupported expressions, operators and lists read-only instead of dropping them", () => {
    const graph = buildRuleWireGraph(syntheticRules, fields);
    const byId = new Map(graph.rules.map((v) => [v.ruleId, v]));
    expect(byId.get("r_unsupported")?.supported).toBe(false);
    expect(byId.get("r_unsupported")?.sentence).toContain(
      "Unsupported expression preserved read-only (XPath expression)"
    );
    expect(byId.get("r_unsupported")?.wires.every((w) => !w.editable)).toBe(
      true
    );
    const unknownWire = byId.get("r_unknown_op")?.wires[0];
    expect(unknownWire?.editable).toBe(false);
    expect(unknownWire?.readOnlyReason).toContain(
      'Unsupported operator "matches"'
    );
    expect(byId.get("r_unknown_op")?.sentence).toContain(
      '[unsupported operator "matches"]'
    );
    expect(byId.get("r_in")?.wires[0].editable).toBe(false);
    expect(byId.get("r_in")?.sentence).toContain("PREGYN is one of [Y, U]");

    // Edits aimed at read-only content are refused, not partially applied.
    expect(
      updateWireCondition(
        unknownOperator,
        { groupIndex: 0, conditionIndex: 0 },
        { value: 1 }
      )
    ).toBe(unknownOperator);
    expect(
      removeWireCondition(listMembership, { groupIndex: 0, conditionIndex: 0 })
    ).toBe(listMembership);
    expect(connectWireSource(unsupported, "f_wt")).toBe(unsupported);
    expect(configureWireRule(unsupported, { actionType: "show_field" })).toBe(
      unsupported
    );
  });

  it("derives wire ids from rule structure only, so they are stable across reprojection", () => {
    const first = buildRuleWireGraph(syntheticRules, fields).wires.map(
      (w) => w.id
    );
    const reordered = [...fields].reverse();
    const second = buildRuleWireGraph(syntheticRules, reordered).wires.map(
      (w) => w.id
    );
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe("rule wires: edits write the shared rule representation (#674)", () => {
  it("creates a flat rule the sentence view already understands", () => {
    const rule = createWireRule({
      id: "r_new",
      sourceFieldId: "f_preg",
      targetFieldId: "f_dia",
      actionType: "require_field",
      fields,
    });
    expect(rule).toMatchObject({
      triggerFieldIds: ["f_preg"],
      targetFieldId: "f_dia",
      actionType: "require_field",
      conditions: [{ fieldId: "f_preg", operator: "is_not_empty", value: "" }],
      logicalOperator: "AND",
    });
    expect(rule.conditionGroups).toBeUndefined();
    expect(describeRuleLogic(rule, fields)).toBe(
      "When (PREGYN is not empty), make DIABP mandatory."
    );
    expect(
      createWireRule({
        id: "q",
        sourceFieldId: "f_sys",
        targetFieldId: "f_sys",
        actionType: "raise_query",
        fields,
      }).querySeverity
    ).toBe("warning");
    expect(
      createWireRule({
        id: "d",
        sourceFieldId: "f_wt",
        targetFieldId: "f_bmi",
        actionType: "set_value",
        fields,
      }).formulaExpression
    ).toBe("WEIGHT");
  });

  it("keeps a legacy rule legacy and a grouped rule grouped when wires change", () => {
    const connected = connectWireSource(legacyQuery, "f_dia");
    expect(connected.conditionGroups).toBeUndefined();
    expect(connected.conditions).toHaveLength(2);
    expect(connected.triggerFieldIds).toEqual(["f_sys", "f_dia"]);

    const updated = updateWireCondition(
      groupedShow,
      { groupIndex: 1, conditionIndex: 0 },
      { operator: "lt" }
    );
    expect(updated.conditionGroups).toHaveLength(3);
    expect(updated.conditionGroups?.[1].conditions[0]).toEqual({
      fieldId: "f_dia",
      operator: "lt",
      value: 0,
      compareFieldId: "f_sys",
    });
    expect(updated.conditionGroups?.[0]).toEqual(
      groupedShow.conditionGroups?.[0]
    );
    // Mirror follows the first group, as the sentence view writes it.
    expect(updated.conditions).toEqual(
      groupedShow.conditionGroups?.[0].conditions
    );

    const literal = updateWireCondition(
      groupedShow,
      { groupIndex: 1, conditionIndex: 0 },
      { compareFieldId: undefined }
    );
    expect(
      "compareFieldId" in (literal.conditionGroups?.[1].conditions[0] ?? {})
    ).toBe(false);

    expect(
      setWireGroupOperator(groupedShow, 0, "OR").conditionGroups?.[0]
        .logicalOperator
    ).toBe("OR");
    expect(setWireOuterOperator(groupedShow, "AND").groupLogicalOperator).toBe(
      "AND"
    );
    expect(setWireOuterOperator(legacyQuery, "OR")).toBe(legacyQuery);

    const removed = removeWireCondition(groupedShow, {
      groupIndex: 0,
      conditionIndex: 1,
    });
    expect(removed.conditionGroups?.[0].conditions).toEqual([
      { fieldId: "f_preg", operator: "eq", value: "Y" },
    ]);
    expect(removed.conditionGroups?.[2]).toEqual({
      id: "g3",
      logicalOperator: "AND",
      conditions: [],
    });
  });

  it("round-trips again after a wire edit, so the edited rule is fully representable", () => {
    const edited = [
      connectWireSource(groupedShow, "f_bmi", 2),
      configureWireRule(legacyQuery, { actionType: "hide_field" }),
    ];
    expect(rulesFromWireGraph(buildRuleWireGraph(edited, fields))).toEqual(
      edited
    );
    expect(describeRuleLogic(edited[0], fields)).toContain(
      "OR (BMI is not empty), show DIABP."
    );
    expect(describeRuleLogic(edited[1], fields)).toBe(
      "When (SYSBP is greater than 180), hide SYSBP."
    );
  });
});
