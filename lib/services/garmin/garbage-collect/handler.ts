import {
  GarbageCollectSpec,
  GarbageCollectInput,
  GarbageCollectResult,
} from "./spec";
import {
  triggerGarbageCollection,
  getCooldownRemainingMs,
  GC_COOLDOWN_MS,
} from "@/lib/garmin-engine";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class GarbageCollectHandler implements GarbageCollectSpec {
  execute(input: GarbageCollectInput): GarbageCollectResult {
    if (input.state.isGcActive) {
      return createFailure(
        "GC_ALREADY_ACTIVE",
        "Garbage collection cycle is currently in progress",
        {
          suggestion: "Wait for the 500ms GC freeze duration to complete",
          recoverable: true,
        }
      );
    }

    if (input.state.gameState !== "playing") {
      return createFailure(
        "INVALID_GAME_STATE",
        `Cannot trigger GC in state "${input.state.gameState}"`,
        {
          suggestion: "Ensure game state is 'playing' before triggering GC",
          recoverable: true,
        }
      );
    }

    const recharge = getCooldownRemainingMs(
      input.state.lastGcAt,
      GC_COOLDOWN_MS
    );
    if (recharge > 0) {
      return createFailure(
        "GC_COOLDOWN",
        `GC recharging: ${(recharge / 1000).toFixed(1)}s`,
        {
          suggestion: "Pop a variable (Down) while GC recharges",
          recoverable: true,
        }
      );
    }

    const { state, freedKb } = triggerGarbageCollection(input.state);

    return createSuccess({
      state,
      freedKb,
      remainingRamKb: state.allocatedRamKb,
    });
  }
}
