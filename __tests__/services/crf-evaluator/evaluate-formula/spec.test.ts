// @vitest-environment node
import { describe, it, expect } from "vitest";
import { EvaluateFormulaInputSchema } from "@/lib/services";

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
});
