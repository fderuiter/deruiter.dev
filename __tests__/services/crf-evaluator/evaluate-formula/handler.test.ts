// @vitest-environment node
import { describe, it, expect } from "vitest";
import { EvaluateFormulaHandler } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { CRFField } from "@/lib/crf/types";

describe("EvaluateFormulaHandler (Logic Test)", () => {
  const handler = new EvaluateFormulaHandler();

  it("returns success with evaluated result", () => {
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
});
