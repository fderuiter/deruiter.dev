// @vitest-environment node
import { describe, it, expect } from "vitest";
import { AllocateGarminMemoryInputSchema } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { GameEngineState } from "@/lib/garmin-engine";

describe("AllocateGarminMemoryInputSchema (Contract Test)", () => {
  it("accepts valid memory allocation payload", () => {
    const mockState = fromPartial<GameEngineState>({
      device: "fenix",
      allocatedRamKb: 10,
    });

    const parsed = AllocateGarminMemoryInputSchema.safeParse({
      state: mockState,
      type: "float",
      name: "temp_sensor",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid variable type", () => {
    const mockState = fromPartial<GameEngineState>({
      device: "fenix",
    });

    const parsed = AllocateGarminMemoryInputSchema.safeParse({
      state: mockState,
      type: "invalid_type",
    });

    expect(parsed.success).toBe(false);
  });
});
