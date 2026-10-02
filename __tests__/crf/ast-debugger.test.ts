// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateRuleDebugTrace,
  SAMPLE_SUBJECT_PROFILES,
} from "@/lib/crf/ast-debugger";
import { EditCheckRule, CRFField } from "@/lib/crf/types";

function mockField(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "number",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

const FIELDS: CRFField[] = [
  mockField({ id: "age", variableName: "AGE", dataType: "number" }),
  mockField({ id: "weight", variableName: "WEIGHT", dataType: "number" }),
  mockField({ id: "height", variableName: "HEIGHT", dataType: "number" }),
  mockField({ id: "sex", variableName: "SEX", dataType: "text" }),
  mockField({ id: "sysbp", variableName: "SYSBP", dataType: "number" }),
];

describe("AST Step Debugger Engine Suite", () => {
  it("evaluates a single-condition rule step-by-step", () => {
    const rule: EditCheckRule = {
      id: "rule_age_check",
      name: "Age check over 18",
      description: "",
      triggerFieldIds: ["age"],
      actionType: "require_field",
      targetFieldId: "sysbp",
      logicalOperator: "AND",
      conditions: [{ fieldId: "age", operator: "gt", value: 18 }],
    };

    const trace = generateRuleDebugTrace(rule, { age: 25 }, FIELDS);

    expect(trace.finalResult).toBe("true");
    expect(trace.totalSteps).toBe(2); // 1 leaf condition + 1 rule summary
    expect(trace.steps[0].nodeType).toBe("condition");
    expect(trace.steps[0].result).toBe("true");
    expect(trace.steps[0].sentence).toContain("AGE (25) > 18 → TRUE");
    expect(trace.hasShortCircuit).toBe(false);
  });

  it("detects short-circuit evaluation in AND rule logic when condition 1 is false", () => {
    const rule: EditCheckRule = {
      id: "rule_and_short",
      name: "Multi-condition AND rule",
      description: "",
      triggerFieldIds: ["sex", "age"],
      actionType: "raise_query",
      targetFieldId: "age",
      logicalOperator: "AND",
      conditions: [
        { fieldId: "sex", operator: "eq", value: "F" },
        { fieldId: "age", operator: "gt", value: 50 },
      ],
      querySeverity: "error",
      queryMessage: "Female age > 50 requirement",
    };

    // Subject is Male (sex = M), so condition 1 is false
    const trace = generateRuleDebugTrace(rule, { sex: "M", age: 60 }, FIELDS);

    expect(trace.finalResult).toBe("false");
    expect(trace.hasShortCircuit).toBe(true);
    expect(trace.steps[0].result).toBe("false");
    expect(trace.steps[1].shortCircuited).toBe(true);
    expect(trace.steps[1].sentence).toContain("SKIPPED");
    expect(trace.steps[1].shortCircuitReason).toContain("Short-circuited");
  });

  it("detects short-circuit evaluation in OR rule logic when condition 1 is true", () => {
    const rule: EditCheckRule = {
      id: "rule_or_short",
      name: "Multi-condition OR rule",
      description: "",
      triggerFieldIds: ["weight", "height"],
      actionType: "show_field",
      targetFieldId: "sysbp",
      logicalOperator: "OR",
      conditions: [
        { fieldId: "weight", operator: "gt", value: 70 },
        { fieldId: "height", operator: "gt", value: 180 },
      ],
    };

    // Weight is 80 (> 70 is true), so condition 2 should short-circuit
    const trace = generateRuleDebugTrace(
      rule,
      { weight: 80, height: 160 },
      FIELDS
    );

    expect(trace.finalResult).toBe("true");
    expect(trace.hasShortCircuit).toBe(true);
    expect(trace.steps[0].result).toBe("true");
    expect(trace.steps[1].shortCircuited).toBe(true);
  });

  it("identifies missing inputs and reports undecidable status", () => {
    const rule: EditCheckRule = {
      id: "rule_missing",
      name: "Weight threshold rule",
      description: "",
      triggerFieldIds: ["weight"],
      actionType: "raise_query",
      targetFieldId: "weight",
      logicalOperator: "AND",
      conditions: [{ fieldId: "weight", operator: "gt", value: 100 }],
    };

    const trace = generateRuleDebugTrace(rule, { weight: null }, FIELDS);

    expect(trace.finalResult).toBe("missing");
    expect(trace.missingFields).toContain("WEIGHT");
    expect(trace.steps[0].diagnostics[0]).toContain("missing");
  });

  it("identifies type incompatibility errors", () => {
    const dateField = mockField({
      id: "visit_dt",
      variableName: "VISIT_DT",
      dataType: "date",
    });
    const allFields = [...FIELDS, dateField];

    const rule: EditCheckRule = {
      id: "rule_incompatible",
      name: "Compare date to number",
      description: "",
      triggerFieldIds: ["visit_dt", "age"],
      actionType: "raise_query",
      targetFieldId: "visit_dt",
      logicalOperator: "AND",
      conditions: [
        {
          fieldId: "visit_dt",
          compareFieldId: "age",
          operator: "gt",
          value: 0,
        },
      ],
    };

    const trace = generateRuleDebugTrace(
      rule,
      { visit_dt: "2026-01-01", age: 50 },
      allFields
    );

    expect(trace.finalResult).toBe("incompatible");
    expect(trace.incompatibleFields).toContain("VISIT_DT");
  });

  it("ships 4 pre-populated sample subject data profiles", () => {
    expect(SAMPLE_SUBJECT_PROFILES).toHaveLength(4);
    const profileIds = SAMPLE_SUBJECT_PROFILES.map((p) => p.id);
    expect(profileIds).toContain("standard_subject");
    expect(profileIds).toContain("missing_vitals");
    expect(profileIds).toContain("protocol_deviation");
    expect(profileIds).toContain("type_incompatible");
  });
});
