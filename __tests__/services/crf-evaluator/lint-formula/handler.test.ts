// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LintFormulaHandler } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { CRFField } from "@/lib/crf/types";

describe("LintFormulaHandler (Logic Test)", () => {
  const handler = new LintFormulaHandler();

  it("identifies valid formula without diagnostics", () => {
    const valField = fromPartial<CRFField>({
      id: "val1",
      variableName: "VAL1",
      dataType: "number",
    });

    const result = handler.execute({
      formula: "VAL1 * 2",
      fieldsList: [valField],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isValid).toBe(true);
      expect(result.data.diagnostics.length).toBe(0);
    }
  });

  it("detects syntax errors gracefully", () => {
    const result = handler.execute({
      formula: "VAL1 * ",
      fieldsList: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isValid).toBe(false);
      expect(result.data.diagnostics.length).toBeGreaterThan(0);
    }
  });
});
