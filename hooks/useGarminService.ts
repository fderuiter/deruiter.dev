import { useCallback, useMemo } from "react";
import {
  AllocateGarminMemoryHandler,
  AllocateGarminMemoryInput,
  AllocateGarminMemoryInputSchema,
  AllocateGarminMemoryResult,
  GarbageCollectHandler,
  GarbageCollectInput,
  GarbageCollectInputSchema,
  GarbageCollectResult,
  SyncFlashStorageHandler,
  SyncFlashStorageInput,
  SyncFlashStorageInputSchema,
  SyncFlashStorageResult,
  createFailure,
} from "@/lib/services/client";

/**
 * Custom React hook providing access to Garmin Watch Simulator domain service operations.
 * Wraps AllocateGarminMemoryHandler, GarbageCollectHandler, and SyncFlashStorageHandler
 * with Zod input validation and zero-exception ServiceResult error handling.
 */
export function useGarminService() {
  const allocateHandler = useMemo(() => new AllocateGarminMemoryHandler(), []);
  const gcHandler = useMemo(() => new GarbageCollectHandler(), []);
  const syncFlashHandler = useMemo(() => new SyncFlashStorageHandler(), []);

  const allocateMemory = useCallback(
    (input: AllocateGarminMemoryInput): AllocateGarminMemoryResult => {
      const parsed = AllocateGarminMemoryInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_STATE",
          parsed.error.issues[0]?.message ||
            "Invalid memory allocation parameters",
          {
            suggestion:
              "Ensure valid GameEngineState and variable type are provided",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return allocateHandler.execute(parsed.data);
    },
    [allocateHandler]
  );

  const garbageCollect = useCallback(
    (input: GarbageCollectInput): GarbageCollectResult => {
      const parsed = GarbageCollectInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_GAME_STATE",
          parsed.error.issues[0]?.message ||
            "Invalid garbage collection parameters",
          {
            suggestion: "Ensure a valid GameEngineState is provided",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return gcHandler.execute(parsed.data);
    },
    [gcHandler]
  );

  const syncFlashStorage = useCallback(
    async (input: SyncFlashStorageInput): Promise<SyncFlashStorageResult> => {
      const parsed = SyncFlashStorageInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_PAYLOAD",
          parsed.error.issues[0]?.message || "Invalid flash storage payload",
          {
            suggestion: "Provide valid flash storage action and variables",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return syncFlashHandler.execute(parsed.data);
    },
    [syncFlashHandler]
  );

  return useMemo(
    () => ({
      allocateMemory,
      garbageCollect,
      syncFlashStorage,
    }),
    [allocateMemory, garbageCollect, syncFlashStorage]
  );
}
