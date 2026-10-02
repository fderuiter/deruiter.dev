// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DuckCommandHandler } from "@/lib/services";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

describe("DuckCommandHandler (Logic Test)", () => {
  const handler = new DuckCommandHandler();

  it("dispatches trick and updates state", () => {
    const state = createInitialDuckGameState();
    const result = handler.execute({
      type: "trick",
      state,
      trick: "HIGH_FIVE",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.commandExecuted).toBe("trick");
      expect(result.data.state.duck.state).toBe("PERFORMING_TRICK");
    }
  });

  it("dispatches accessory equip safely", () => {
    let state = createInitialDuckGameState();
    state = {
      ...state,
      unlockedAccessories: [...state.unlockedAccessories, "bucket-hat"],
    };
    const result = handler.execute({
      type: "accessory",
      state,
      accessory: "bucket-hat",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state.activeAccessory).toBe("bucket-hat");
    }
  });
});
