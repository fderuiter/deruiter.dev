// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GarbageCollectHandler } from "@/lib/services";

import { createInitialState, startGame } from "@/lib/garmin-engine";

describe("GarbageCollectHandler (Logic Test)", () => {
  const handler = new GarbageCollectHandler();

  it("successfully triggers GC when playing", () => {
    let state = createInitialState("fenix");
    state = startGame(state);
    // Add extra variables to free
    state = {
      ...state,
      variables: [
        ...state.variables,
        { id: 10, name: "temp1", type: "array", sizeKb: 1.6, allocatedAt: 1 },
        { id: 11, name: "temp2", type: "array", sizeKb: 1.6, allocatedAt: 2 },
        { id: 12, name: "temp3", type: "array", sizeKb: 1.6, allocatedAt: 3 },
      ],
      allocatedRamKb: 6.6,
    };

    const result = handler.execute({ state });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state.isGcActive).toBe(true);
      expect(result.data.freedKb).toBeGreaterThan(0);
    }
  });

  it("returns error if GC is already active", () => {
    let state = createInitialState("fenix");
    state = { ...state, gameState: "playing", isGcActive: true };

    const result = handler.execute({ state });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("GC_ALREADY_ACTIVE");
    }
  });
});
