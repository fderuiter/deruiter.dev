// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GarbageCollectInputSchema } from "@/lib/services";

import { fromPartial } from "@total-typescript/shoehorn";
import type { GameEngineState } from "@/lib/garmin-engine";

describe("GarbageCollectInputSchema (Contract Test)", () => {
  it("accepts valid game state", () => {
    const mockState = fromPartial<GameEngineState>({
      gameState: "playing",
      isGcActive: false,
    });

    const parsed = GarbageCollectInputSchema.safeParse({ state: mockState });
    expect(parsed.success).toBe(true);
  });
});
