// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LintFormulaInputSchema } from "@/lib/services";

describe("LintFormulaInputSchema (Contract Test)", () => {
  it("accepts valid formula lint payload with defaults", () => {
    const parsed = LintFormulaInputSchema.safeParse({
      formula: "round(VAL1 + VAL2, 2)",
    });
    expect(parsed.success).toBe(true);
  });
});
