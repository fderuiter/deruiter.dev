// @vitest-environment node
import { describe, it, expect } from "vitest";
import { AllocateGarminMemoryHandler } from "@/lib/services";

import { createInitialState } from "@/lib/garmin-engine";

describe("AllocateGarminMemoryHandler (Logic Test)", () => {
  const handler = new AllocateGarminMemoryHandler();

  it("allocates memory variable successfully within budget", () => {
    const state = createInitialState("fenix");
    const result = handler.execute({
      state,
      type: "float",
      name: "cadence",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allocatedSizeKb).toBe(0.4);
      expect(result.data.newRamKb).toBeGreaterThan(state.allocatedRamKb);
    }
  });

  it("returns OUT_OF_MEMORY error when RAM ceiling is breached", () => {
    let state = createInitialState("fenix");
    // Fenix limit is 32KB. Force allocation past limit.
    state = { ...state, allocatedRamKb: 31.9 };

    const result = handler.execute({
      state,
      type: "array", // 1.6KB
      name: "massive_array",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("OUT_OF_MEMORY");
      expect(result.error.recoverable).toBe(true);
      expect(result.error.suggestion).toBeDefined();
    }
  });
});
