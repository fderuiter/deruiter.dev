// @vitest-environment node
import { describe, it, expect } from "vitest";
import { InteractHazardInputSchema } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { WorkingWithDuckState } from "@/lib/working-with-duck-engine";

describe("InteractHazardInputSchema (Contract Test)", () => {
  it("accepts valid hazard distract action", () => {
    const mockState = fromPartial<WorkingWithDuckState>({
      currentLevel: 1,
    });

    const parsed = InteractHazardInputSchema.safeParse({
      state: mockState,
      action: "distract_with_squeaky",
    });

    expect(parsed.success).toBe(true);
  });
});
