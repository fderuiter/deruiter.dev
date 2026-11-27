// @vitest-environment node
import { describe, it, expect } from "vitest";
import { EvaluateFormulaHandler } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { CRFField } from "@/lib/crf/types";

describe("EvaluateFormulaHandler (Logic Test)", () => {
  const handler = new EvaluateFormulaHandler();

  const weightField = fromPartial<CRFField>({
    id: "f_weight",
    variableName: "WEIGHT",
    dataType: "number",
  });
  const heightField = fromPartial<CRFField>({
    id: "f_height",
    variableName: "HEIGHT",
    dataType: "number",
  });

  it("returns success with evaluated result", () => {
    const result = handler.execute({
      formula: "WEIGHT / ((HEIGHT / 100) ^ 2)",
      fieldValues: { WEIGHT: 70, HEIGHT: 175 },
      fieldsList: [weightField, heightField],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isCalculated).toBe(true);
      expect(result.data.value).toBeCloseTo(22.857, 2);
    }
  });

  it("returns error on empty formula without throwing", () => {
    const result = handler.execute({
      formula: "   ",
      fieldValues: {},
      fieldsList: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMPTY_FORMULA");
      expect(result.error.recoverable).toBe(true);
    }
  });

  it("returns SYNTAX_ERROR on invalid operators, trailing tokens, and invalid arity", () => {
    for (const formula of ["WEIGHT == 70", "WEIGHT 70", "sqrt(16, 2)"]) {
      const result = handler.execute({
        formula,
        fieldValues: { WEIGHT: 78 },
        fieldsList: [weightField],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SYNTAX_ERROR");
        expect(result.error.recoverable).toBe(true);
      }
    }
  });

  it("returns UNKNOWN_FUNCTION on unrecognized function calls", () => {
    const result = handler.execute({
      formula: "typoFn(WEIGHT, 100)",
      fieldValues: { WEIGHT: 78 },
      fieldsList: [weightField],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNKNOWN_FUNCTION");
      expect(result.error.message).toContain("typoFn");
    }
  });

  it("returns UNRESOLVED_VARIABLE when referencing undeclared variables", () => {
    const result = handler.execute({
      formula: "WEIGHT + UNDECLARED_VAR",
      fieldValues: { WEIGHT: 70 },
      fieldsList: [weightField],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNRESOLVED_VARIABLE");
      expect(result.error.message).toContain("UNDECLARED_VAR");
    }
  });

  it("returns DIVISION_BY_ZERO on zero divisors", () => {
    const result = handler.execute({
      formula: "WEIGHT / ((HEIGHT / 100) ^ 2)",
      fieldValues: { WEIGHT: 70, HEIGHT: 0 },
      fieldsList: [weightField, heightField],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DIVISION_BY_ZERO");
    }
  });

  it("returns EVALUATION_ERROR on math domain violations", () => {
    const result = handler.execute({
      formula: "sqrt(-9)",
      fieldValues: {},
      fieldsList: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EVALUATION_ERROR");
    }
  });

  it("returns success with null value and isCalculated false when declared clinical inputs are empty or null-flavored", () => {
    for (const fieldValues of [
      {},
      { WEIGHT: "", HEIGHT: 175 },
      { WEIGHT: null, HEIGHT: 175 },
      { WEIGHT: "ND", HEIGHT: 175 },
      { WEIGHT: 70, HEIGHT: "ASKU" },
    ]) {
      const result = handler.execute({
        formula: "WEIGHT / ((HEIGHT / 100) ^ 2)",
        fieldValues,
        fieldsList: [weightField, heightField],
      });
      expect(result).toEqual({
        success: true,
        data: {
          value: null,
          formula: "WEIGHT / ((HEIGHT / 100) ^ 2)",
          isCalculated: false,
        },
      });
    }
  });
});
