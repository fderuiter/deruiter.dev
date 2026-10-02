// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LintFormInputSchema } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { CRFForm } from "@/lib/crf/types";

describe("LintFormInputSchema (Contract Test)", () => {
  it("accepts valid form structure", () => {
    const mockForm = fromPartial<CRFForm>({
      id: "form_1",
      name: "Demo Form",
      sections: [],
    });

    const parsed = LintFormInputSchema.safeParse({ form: mockForm });
    expect(parsed.success).toBe(true);
  });

  it("rejects null form", () => {
    const parsed = LintFormInputSchema.safeParse({ form: null });
    expect(parsed.success).toBe(false);
  });
});
