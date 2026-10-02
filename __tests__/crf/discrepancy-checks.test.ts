// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  evaluateConditionResult,
  combineConditionResults,
  getRuleGroups,
  evaluateRuleResult,
  explainRule,
} from "@/lib/crf/ast-evaluator";
import {
  CRFField,
  EditCheckRule,
  AstCondition,
  ConditionGroup,
} from "@/lib/crf/types";

// #540: grouped AND/OR, field/field and field/literal discrepancy checks
// with a Raise Query action, explained truth-table style, that round-trips
// through native serialization without silently simplifying unsupported
// imported expressions.
describe("CRF Studio - Explainable Discrepancy Checks (#540)", () => {
  const fields: CRFField[] = [
    {
      id: "f_sysbp",
      variableName: "SYSBP",
      label: "Systolic BP",
      dataType: "integer",
      columnSpan: 6,
      required: true,
    },
    {
      id: "f_diabp",
      variableName: "DIABP",
      label: "Diastolic BP",
      dataType: "integer",
      columnSpan: 6,
      required: true,
    },
    {
      id: "f_weight",
      variableName: "WEIGHT",
      label: "Weight",
      dataType: "number",
      columnSpan: 6,
      required: true,
    },
    {
      id: "f_visit_date",
      variableName: "VISITDT",
      label: "Visit Date",
      dataType: "date",
      columnSpan: 6,
      required: true,
    },
    {
      id: "f_aeterm",
      variableName: "AETERM",
      label: "AE Term",
      dataType: "text",
      columnSpan: 6,
      required: true,
    },
  ];

  describe("field/literal operands - true, false, missing, incompatible", () => {
    it("returns true when the field value satisfies the literal comparison", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "gt",
        value: 140,
      };
      expect(evaluateConditionResult(cond, { f_sysbp: 160 }, fields)).toBe(
        "true"
      );
    });

    it("returns false when the field value does not satisfy the literal comparison", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "gt",
        value: 140,
      };
      expect(evaluateConditionResult(cond, { f_sysbp: 100 }, fields)).toBe(
        "false"
      );
    });

    it("returns missing when the field has no value yet", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "gt",
        value: 140,
      };
      expect(evaluateConditionResult(cond, { f_sysbp: null }, fields)).toBe(
        "missing"
      );
      expect(evaluateConditionResult(cond, {}, fields)).toBe("missing");
    });

    it("returns incompatible for an ordering operator against a non-orderable text field", () => {
      const cond: AstCondition = {
        fieldId: "f_aeterm",
        operator: "gt",
        value: "abc",
      };
      expect(
        evaluateConditionResult(cond, { f_aeterm: "Headache" }, fields)
      ).toBe("incompatible");
    });

    it("allows equality operators on text fields (no ordering implied)", () => {
      const cond: AstCondition = {
        fieldId: "f_aeterm",
        operator: "eq",
        value: "Headache",
      };
      expect(
        evaluateConditionResult(cond, { f_aeterm: "Headache" }, fields)
      ).toBe("true");
    });
  });

  describe("field/field operands - true, false, missing, incompatible", () => {
    it("returns true when one field's value exceeds another's", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "gt",
        compareFieldId: "f_diabp",
        value: 0,
      };
      expect(
        evaluateConditionResult(cond, { f_sysbp: 140, f_diabp: 90 }, fields)
      ).toBe("true");
    });

    it("returns false when the comparison field/field does not hold", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "lt",
        compareFieldId: "f_diabp",
        value: 0,
      };
      expect(
        evaluateConditionResult(cond, { f_sysbp: 140, f_diabp: 90 }, fields)
      ).toBe("false");
    });

    it("returns missing when either compared field has no value", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "gt",
        compareFieldId: "f_diabp",
        value: 0,
      };
      expect(
        evaluateConditionResult(cond, { f_sysbp: 140, f_diabp: null }, fields)
      ).toBe("missing");
      expect(
        evaluateConditionResult(cond, { f_sysbp: null, f_diabp: 90 }, fields)
      ).toBe("missing");
    });

    it("returns incompatible when comparing fields from different type families", () => {
      const cond: AstCondition = {
        fieldId: "f_visit_date",
        operator: "eq",
        compareFieldId: "f_weight",
        value: 0,
      };
      expect(
        evaluateConditionResult(
          cond,
          { f_visit_date: "2024-01-01", f_weight: 70 },
          fields
        )
      ).toBe("incompatible");
    });

    it("allows field/field comparisons within the same type family", () => {
      const cond: AstCondition = {
        fieldId: "f_sysbp",
        operator: "neq",
        compareFieldId: "f_diabp",
        value: 0,
      };
      expect(
        evaluateConditionResult(cond, { f_sysbp: 140, f_diabp: 90 }, fields)
      ).toBe("true");
    });
  });

  describe("unsupported operators are reported, never silently simplified to false", () => {
    it("reports incompatible for an operator this evaluator does not recognize", () => {
      // Simulates data arriving from an external/import source whose
      // runtime shape doesn't actually match the AstOperator union the
      // TypeScript type claims, e.g. an older or foreign expression form.
      const cond = fromAny<AstCondition, unknown>({
        fieldId: "f_sysbp",
        operator: "before",
        value: 100,
      });
      expect(evaluateConditionResult(cond, { f_sysbp: 90 }, fields)).toBe(
        "incompatible"
      );
    });
  });

  describe("combineConditionResults - AND/OR truth table", () => {
    const cases: Array<
      [
        "AND" | "OR",
        Array<"true" | "false" | "missing" | "incompatible">,
        "true" | "false" | "missing" | "incompatible",
      ]
    > = [
      ["AND", ["true", "true"], "true"],
      ["AND", ["true", "false"], "false"],
      ["AND", ["true", "missing"], "missing"],
      ["AND", ["false", "missing"], "false"],
      ["AND", ["true", "incompatible"], "incompatible"],
      ["AND", ["false", "incompatible"], "false"],
      ["AND", ["missing", "incompatible"], "incompatible"],
      ["OR", ["false", "false"], "false"],
      ["OR", ["true", "false"], "true"],
      ["OR", ["false", "missing"], "missing"],
      ["OR", ["true", "missing"], "true"],
      ["OR", ["false", "incompatible"], "incompatible"],
      ["OR", ["true", "incompatible"], "true"],
      ["OR", ["missing", "incompatible"], "incompatible"],
    ];

    it.each(cases)("%s(%j) = %s", (operator, results, expected) => {
      expect(combineConditionResults(operator, results)).toBe(expected);
    });
  });

  describe("grouped AND/OR rule evaluation", () => {
    const groupedRule: EditCheckRule = {
      id: "rule_hypertension",
      name: "Hypertension discrepancy",
      description: "SYSBP > 140 AND DIABP > 90, OR WEIGHT is missing",
      triggerFieldIds: ["f_sysbp", "f_diabp", "f_weight"],
      actionType: "raise_query",
      targetFieldId: "f_sysbp",
      conditions: [],
      logicalOperator: "AND",
      conditionGroups: [
        {
          id: "g1",
          logicalOperator: "AND",
          conditions: [
            { fieldId: "f_sysbp", operator: "gt", value: 140 },
            { fieldId: "f_diabp", operator: "gt", value: 90 },
          ],
        },
        {
          id: "g2",
          logicalOperator: "OR",
          conditions: [
            { fieldId: "f_weight", operator: "is_empty", value: "" },
          ],
        },
      ],
      groupLogicalOperator: "OR",
      querySeverity: "warning",
      queryMessage: "Confirm hypertensive reading or provide missing weight.",
    };

    it("evaluates (A AND B) OR (C) across two groups", () => {
      // Group 1 true (both conditions hold) -> overall true regardless of group 2.
      expect(
        evaluateRuleResult(
          groupedRule,
          { f_sysbp: 150, f_diabp: 95, f_weight: 70 },
          fields
        )
      ).toBe("true");

      // Group 1 false, group 2 true (weight missing) -> overall true.
      expect(
        evaluateRuleResult(
          groupedRule,
          { f_sysbp: 120, f_diabp: 80, f_weight: null },
          fields
        )
      ).toBe("true");

      // Both groups false -> overall false.
      expect(
        evaluateRuleResult(
          groupedRule,
          { f_sysbp: 120, f_diabp: 80, f_weight: 70 },
          fields
        )
      ).toBe("false");
    });

    it("getRuleGroups returns the explicit groups verbatim when present", () => {
      const { groups, groupLogicalOperator } = getRuleGroups(groupedRule);
      expect(groups).toBe(groupedRule.conditionGroups);
      expect(groupLogicalOperator).toBe("OR");
    });

    it("getRuleGroups wraps legacy flat conditions as a single implicit group", () => {
      const legacyRule: EditCheckRule = {
        id: "rule_legacy",
        name: "Legacy rule",
        description: "",
        triggerFieldIds: ["f_sysbp"],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        conditions: [{ fieldId: "f_sysbp", operator: "gt", value: 140 }],
        logicalOperator: "AND",
      };
      const { groups, groupLogicalOperator } = getRuleGroups(legacyRule);
      expect(groups).toHaveLength(1);
      expect(groups[0].conditions).toBe(legacyRule.conditions);
      expect(groups[0].logicalOperator).toBe("AND");
      expect(groupLogicalOperator).toBe("AND");
    });

    it("a rule with no conditions in any group evaluates true (legacy no-op default)", () => {
      const emptyRule: EditCheckRule = {
        id: "rule_empty",
        name: "Empty",
        description: "",
        triggerFieldIds: [],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        conditions: [],
        logicalOperator: "AND",
      };
      expect(evaluateRuleResult(emptyRule, {}, fields)).toBe("true");
    });

    it("an unsupportedExpression rule never evaluates to true and reports incompatible", () => {
      const unsupportedRule: EditCheckRule = {
        id: "rule_unsupported",
        name: "Unsupported",
        description: "",
        triggerFieldIds: [],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        conditions: [],
        logicalOperator: "AND",
        unsupportedExpression: {
          raw: { weird: "shape" },
          reason: "test fixture",
        },
      };
      expect(evaluateRuleResult(unsupportedRule, {}, fields)).toBe(
        "incompatible"
      );
    });
  });

  describe("explainRule - truth-table-style readable explanations", () => {
    it("explains a fired field/field AND group with the Raise Query message", () => {
      const rule: EditCheckRule = {
        id: "rule_bp",
        name: "Diastolic exceeds systolic",
        description: "",
        triggerFieldIds: ["f_sysbp", "f_diabp"],
        actionType: "raise_query",
        targetFieldId: "f_diabp",
        conditions: [],
        logicalOperator: "AND",
        conditionGroups: [
          {
            id: "g1",
            logicalOperator: "AND",
            conditions: [
              {
                fieldId: "f_diabp",
                operator: "gt",
                compareFieldId: "f_sysbp",
                value: 0,
              },
            ],
          },
        ],
        querySeverity: "error",
        queryMessage: "DIABP cannot exceed SYSBP.",
      };

      const explanation = explainRule(
        rule,
        { f_sysbp: 90, f_diabp: 120 },
        fields
      );
      expect(explanation.result).toBe("true");
      expect(explanation.summary).toContain("DIABP");
      expect(explanation.summary).toContain("SYSBP");
      expect(explanation.summary).toContain("TRUE");
      expect(explanation.summary).toContain("Raise Query");
      expect(explanation.summary).toContain("DIABP cannot exceed SYSBP.");
      expect(
        explanation.groupExplanations[0].conditionExplanations[0].sentence
      ).toContain("is greater than");
    });

    it("explains a missing operand distinctly from a false result", () => {
      const rule: EditCheckRule = {
        id: "rule_missing",
        name: "Missing weight",
        description: "",
        triggerFieldIds: ["f_weight"],
        actionType: "raise_query",
        targetFieldId: "f_weight",
        conditions: [{ fieldId: "f_weight", operator: "gt", value: 50 }],
        logicalOperator: "AND",
      };
      const explanation = explainRule(rule, {}, fields);
      expect(explanation.result).toBe("missing");
      expect(explanation.summary).toContain("MISSING");
      expect(explanation.summary).not.toContain("Raise Query");
    });

    it("explains an incompatible comparison distinctly from missing or false", () => {
      const rule: EditCheckRule = {
        id: "rule_incompatible",
        name: "Bad comparison",
        description: "",
        triggerFieldIds: ["f_aeterm"],
        actionType: "raise_query",
        targetFieldId: "f_aeterm",
        conditions: [{ fieldId: "f_aeterm", operator: "gt", value: "x" }],
        logicalOperator: "AND",
      };
      const explanation = explainRule(rule, { f_aeterm: "Headache" }, fields);
      expect(explanation.result).toBe("incompatible");
      expect(explanation.summary).toContain("INCOMPATIBLE");
    });

    it("surfaces a preserved unsupportedExpression instead of a normal explanation", () => {
      const rule: EditCheckRule = {
        id: "rule_unsupported",
        name: "Unsupported",
        description: "",
        triggerFieldIds: [],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        conditions: [],
        logicalOperator: "AND",
        unsupportedExpression: {
          raw: { anything: true },
          reason: "unrecognized shape from import",
        },
      };
      const explanation = explainRule(rule, {}, fields);
      expect(explanation.result).toBe("incompatible");
      expect(explanation.summary).toContain("does not support");
      expect(explanation.summary).toContain("unrecognized shape from import");
    });
  });

  describe("native serialization round-trip preserves equivalent meaning", () => {
    it("round-trips a grouped, field/field rule through JSON with identical evaluation results", () => {
      const rule: EditCheckRule = {
        id: "rule_roundtrip",
        name: "Round trip rule",
        description: "",
        triggerFieldIds: ["f_sysbp", "f_diabp"],
        actionType: "raise_query",
        targetFieldId: "f_diabp",
        conditions: [],
        logicalOperator: "AND",
        conditionGroups: [
          {
            id: "g1",
            logicalOperator: "OR",
            conditions: [
              { fieldId: "f_sysbp", operator: "gt", value: 180 },
              {
                fieldId: "f_diabp",
                operator: "gt",
                compareFieldId: "f_sysbp",
                value: 0,
              },
            ],
          },
        ],
        groupLogicalOperator: "AND",
        querySeverity: "warning",
        queryMessage: "Check blood pressure readings.",
      };

      const reopened: EditCheckRule = JSON.parse(JSON.stringify(rule));
      expect(reopened).toEqual(rule);

      const values = { f_sysbp: 90, f_diabp: 120 };
      expect(evaluateRuleResult(reopened, values, fields)).toBe(
        evaluateRuleResult(rule, values, fields)
      );
      expect(explainRule(reopened, values, fields).summary).toBe(
        explainRule(rule, values, fields).summary
      );
    });

    it("does not inject new fields into a rule lacking optional properties on JSON round-trip", () => {
      const rule: EditCheckRule = {
        id: "rule_minimal",
        name: "Minimal",
        description: "",
        triggerFieldIds: [],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        conditions: [{ fieldId: "f_sysbp", operator: "gt", value: 140 }],
        logicalOperator: "AND",
      };
      const serialized = JSON.stringify(rule);
      expect(serialized).not.toContain("conditionGroups");
      expect(serialized).not.toContain("groupLogicalOperator");
      expect(serialized).not.toContain("unsupportedExpression");
    });
  });
});

describe("CRF Studio - ConditionGroup type shape sanity", () => {
  it("a ConditionGroup carries its own id and logicalOperator alongside its conditions", () => {
    const group: ConditionGroup = {
      id: "g1",
      logicalOperator: "OR",
      conditions: [{ fieldId: "f_sysbp", operator: "eq", value: 1 }],
    };
    expect(group.logicalOperator).toBe("OR");
  });
});
