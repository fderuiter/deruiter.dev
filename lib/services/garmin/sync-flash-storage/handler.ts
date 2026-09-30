import {
  SyncFlashStorageSpec,
  SyncFlashStorageInput,
  SyncFlashStorageResult,
} from "./spec";
import {
  loadPersistedFlashStorage,
  savePersistedFlashStorage,
} from "@/lib/garmin-engine";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class SyncFlashStorageHandler implements SyncFlashStorageSpec {
  async execute(input: SyncFlashStorageInput): Promise<SyncFlashStorageResult> {
    try {
      if (input.action === "load") {
        const variables = loadPersistedFlashStorage();
        const totalKb = variables.reduce((sum, v) => sum + v.sizeKb, 0);
        return createSuccess({
          variables,
          totalAllocatedKb: Number(totalKb.toFixed(2)),
          syncedAt: Date.now(),
        });
      }

      if (input.action === "save") {
        if (!input.variables) {
          return createFailure(
            "INVALID_PAYLOAD",
            "Missing variables payload for save operation",
            {
              suggestion: "Provide FlashVariable array when saving storage",
              recoverable: true,
            }
          );
        }
        const saved = savePersistedFlashStorage(input.variables);
        if (!saved) {
          return createFailure(
            "STORAGE_UNAVAILABLE",
            "Failed to save flash storage to localStorage",
            {
              suggestion: "Check localStorage availability and quota limits",
              recoverable: true,
            }
          );
        }
        const totalKb = input.variables.reduce((sum, v) => sum + v.sizeKb, 0);
        return createSuccess({
          variables: input.variables,
          totalAllocatedKb: Number(totalKb.toFixed(2)),
          syncedAt: Date.now(),
        });
      }

      if (input.action === "clear") {
        // Persist an explicit empty array (not removeItem) so a restart does
        // not re-seed the default flash entry (#1210).
        const saved = savePersistedFlashStorage([]);
        if (!saved) {
          return createFailure(
            "STORAGE_UNAVAILABLE",
            "Failed to clear flash storage in localStorage",
            {
              suggestion: "Check localStorage availability and quota limits",
              recoverable: true,
            }
          );
        }
        return createSuccess({
          variables: [],
          totalAllocatedKb: 0,
          syncedAt: Date.now(),
        });
      }

      return createFailure(
        "INVALID_PAYLOAD",
        `Unknown action: ${String(input.action)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("STORAGE_UNAVAILABLE", message, {
        suggestion: "Check localStorage availability and quota limits",
        recoverable: true,
        details: err,
      });
    }
  }
}
