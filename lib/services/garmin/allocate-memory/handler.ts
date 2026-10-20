import {
  AllocateGarminMemorySpec,
  AllocateGarminMemoryInput,
  AllocateGarminMemoryResult,
} from "./spec";
import {
  allocateVariable,
  DEVICE_PROFILES,
  VARIABLE_RAM_COSTS,
} from "@/lib/garmin/engine";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class AllocateGarminMemoryHandler implements AllocateGarminMemorySpec {
  execute(input: AllocateGarminMemoryInput): AllocateGarminMemoryResult {
    if (!input.state || typeof input.state !== "object") {
      return createFailure("INVALID_STATE", "Invalid game engine state", {
        suggestion: "Initialize state with createInitialState()",
        recoverable: true,
      });
    }

    const { state, crashed } = allocateVariable(
      input.state,
      input.type,
      input.name
    );

    const sizeKb = VARIABLE_RAM_COSTS[input.type] ?? 0.2;
    const profile = DEVICE_PROFILES[state.device];
    const ramLimit = profile ? profile.ramLimitKb : 32.0;

    if (crashed) {
      return createFailure(
        "OUT_OF_MEMORY",
        `Heap allocation exceeded ${ramLimit}KB RAM limit on ${profile?.name || state.device}`,
        {
          suggestion:
            "Trigger Garbage Collection (GC) or select a device with larger RAM profile",
          recoverable: true,
          details: state.crashReport,
        }
      );
    }

    return createSuccess({
      state,
      allocatedSizeKb: sizeKb,
      newRamKb: state.allocatedRamKb,
      ramLimitKb: ramLimit,
    });
  }
}
