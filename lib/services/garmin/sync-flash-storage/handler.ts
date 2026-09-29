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
        savePersistedFlashStorage(input.variables);
        const totalKb = input.variables.reduce((sum, v) => sum + v.sizeKb, 0);
        return createSuccess({
          variables: input.variables,
          totalAllocatedKb: Number(totalKb.toFixed(2)),
          syncedAt: Date.now(),
        });
      }

      if (input.action === "clear") {
        // Store an empty list rather than removing the key, so the next
        // boot keeps the storage empty instead of re-seeding sys_log.dat.
        savePersistedFlashStorage([]);
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
