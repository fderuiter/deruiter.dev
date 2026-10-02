// @vitest-environment node
import { describe, it, expect } from "vitest";
import { InteractHazardHandler } from "@/lib/services";

import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

describe("InteractHazardHandler (Logic Test)", () => {
  const handler = new InteractHazardHandler();

  it("distracts duck with squeaky toy successfully", () => {
    let state = createInitialDuckGameState();
    state = {
      ...state,
      duck: { ...state.duck, state: "SNEAKY_CHEW" },
      activeHazardTarget: "pitch-deck",
    };

    const result = handler.execute({
      state,
      action: "distract_with_squeaky",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeHazardTarget).toBeNull();
      expect(result.data.state.totalScore).toBeGreaterThan(state.totalScore);
    }
  });

  it("repairs hazard directly", () => {
    let state = createInitialDuckGameState();
    state = {
      ...state,
      hazards: state.hazards.map((h) =>
        h.id === "pitch-deck" ? { ...h, isChewed: true } : h
      ),
    };

    const result = handler.execute({
      state,
      action: "fix_hazard",
      hazardId: "pitch-deck",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const fixed = result.data.state.hazards.find(
        (h) => h.id === "pitch-deck"
      );
      expect(fixed?.isChewed).toBe(false);
    }
  });
});
