import {
  InteractHazardSpec,
  InteractHazardInput,
  InteractHazardResult,
} from "./spec";
import {
  applySqueakyToy,
  applyKongToy,
  WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class InteractHazardHandler implements InteractHazardSpec {
  execute(input: InteractHazardInput): InteractHazardResult {
    if (!input.state || typeof input.state !== "object") {
      return createFailure(
        "INVALID_STATE",
        "Invalid Duck game state provided",
        {
          suggestion: "Initialize state with createInitialDuckGameState()",
          recoverable: true,
        }
      );
    }

    // A paused sprint freezes play (#1645): the toys are already no-ops in
    // the engine, and fixing a hazard must not bank points either.
    if (input.state.status === "paused") {
      return createSuccess({
        state: input.state,
        activeHazardTarget: input.state.activeHazardTarget,
        scoreBonus: 0,
      });
    }

    try {
      let nextState: WorkingWithDuckState = input.state;
      const initialScore = input.state.totalScore ?? 0;
      const targetX = input.x ?? 400;
      const targetY = input.y ?? 250;

      if (input.action === "distract_with_squeaky") {
        nextState = applySqueakyToy(input.state, targetX, targetY);
      } else if (input.action === "distract_with_kong") {
        nextState = applyKongToy(input.state, targetX, targetY);
      } else if (input.action === "fix_hazard" && input.hazardId) {
        const found = input.state.hazards.find((h) => h.id === input.hazardId);
        if (!found) {
          return createFailure(
            "HAZARD_NOT_FOUND",
            `Hazard "${input.hazardId}" does not exist`
          );
        }
        nextState = {
          ...input.state,
          hazards: input.state.hazards.map((h) =>
            h.id === input.hazardId ? { ...h, isChewed: false } : h
          ),
          totalScore: (input.state.totalScore ?? 0) + 15,
        };
      }

      const scoreBonus = Math.max(
        0,
        (nextState.totalScore ?? 0) - initialScore
      );

      return createSuccess({
        state: nextState,
        activeHazardTarget: nextState.activeHazardTarget,
        scoreBonus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("ACTION_FAILED", message, {
        suggestion: "Verify hazard state and duck behavior mode",
        recoverable: true,
        details: err,
      });
    }
  }
}
