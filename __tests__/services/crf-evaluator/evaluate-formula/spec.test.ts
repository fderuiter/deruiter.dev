// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  EvaluateFormulaInputSchema,
  EvaluateFormulaErrorCode,
} from "@/lib/services";

describe("EvaluateFormulaInputSchema (Contract Test)", () => {
  it("accepts valid formula and fields", () => {
    const parsed = EvaluateFormulaInputSchema.safeParse({
      formula: "WEIGHT / (HEIGHT / 100) ^ 2",
      fieldValues: { weight: 70, height: 175 },
      fieldsList: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty formula", () => {
    const parsed = EvaluateFormulaInputSchema.safeParse({
      formula: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates typed error code union including UNKNOWN_FUNCTION", () => {
    for (const code of [
      "EMPTY_FORMULA",
      "SYNTAX_ERROR",
      "DIVISION_BY_ZERO",
      "UNRESOLVED_VARIABLE",
      "UNKNOWN_FUNCTION",
      "EVALUATION_ERROR",
    ]) {
      expect(EvaluateFormulaErrorCode.safeParse(code).success).toBe(true);
    }
    expect(EvaluateFormulaErrorCode.safeParse("BOGUS_CODE").success).toBe(
      false
    );
  });
});
