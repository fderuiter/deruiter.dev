// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LintFormHandler } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { CRFForm } from "@/lib/crf/types";

describe("LintFormHandler (Logic Test)", () => {
  const handler = new LintFormHandler();

  it("identifies duplicate variable names and missing names", () => {
    const mockForm = fromPartial<CRFForm>({
      id: "form_1",
      rules: [],
      sections: [
        {
          id: "sec_1",
          title: "Vital Signs",
          fields: [
            fromPartial({
              id: "f1",
              label: "Systolic BP",
              variableName: "SYSBP",
              dataType: "number",
            }),
            fromPartial({
              id: "f2",
              label: "Duplicate SYSBP",
              variableName: "SYSBP",
              dataType: "number",
            }),
            fromPartial({
              id: "f3",
              label: "Missing Variable",
              variableName: "",
              dataType: "text",
            }),
          ],
        },
      ],
    });

    const result = handler.execute({ form: mockForm });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(
        result.data.some((d) => d.message.includes("Duplicate variable name"))
      ).toBe(true);
      expect(
        result.data.some((d) =>
          d.message.includes("missing a CDASH/SDTM Variable Name")
        )
      ).toBe(true);
    }
  });

  it("handles empty or invalid form safely", () => {
    const result = handler.execute({
      form: fromPartial<CRFForm>({ sections: undefined }),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_FORM");
    }
  });
});
