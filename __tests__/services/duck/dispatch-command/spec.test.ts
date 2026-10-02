// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DuckCommandInputSchema } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { WorkingWithDuckState } from "@/lib/working-with-duck-engine";

describe("DuckCommandInputSchema (Contract Test)", () => {
  it("accepts valid trick command", () => {
    const mockState = fromPartial<WorkingWithDuckState>({
      currentLevel: 1,
      totalScore: 0,
    });

    const parsed = DuckCommandInputSchema.safeParse({
      type: "trick",
      state: mockState,
      trick: "SPIN",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown trick name", () => {
    const mockState = fromPartial<WorkingWithDuckState>({
      currentLevel: 1,
    });

    const parsed = DuckCommandInputSchema.safeParse({
      type: "trick",
      state: mockState,
      trick: "FLY_TO_SPACE",
    });

    expect(parsed.success).toBe(false);
  });
});
