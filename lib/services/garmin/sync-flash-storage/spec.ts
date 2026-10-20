import { z } from "zod";
import type { FlashVariable } from "@/lib/garmin/engine";
import type { ServiceResult } from "@/lib/services/service-result";

export const FlashVariableSchema = z.object({
  id: z.number(),
  name: z.string(),
  sizeKb: z.number(),
  allocatedAt: z.number(),
});

export const SyncFlashStorageInputSchema = z.object({
  action: z.enum(["load", "save", "clear"]),
  variables: z.array(FlashVariableSchema).optional(),
});

export type SyncFlashStorageInput = z.infer<typeof SyncFlashStorageInputSchema>;

export const SyncFlashStorageErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "PARSE_ERROR",
  "INVALID_PAYLOAD",
]);

export type SyncFlashStorageErrorCode = z.infer<
  typeof SyncFlashStorageErrorCode
>;

export interface SyncFlashStorageData {
  variables: FlashVariable[];
  totalAllocatedKb: number;
  syncedAt: number;
}

export type SyncFlashStorageResult = ServiceResult<
  SyncFlashStorageData,
  SyncFlashStorageErrorCode
>;

export interface SyncFlashStorageSpec {
  execute(input: SyncFlashStorageInput): Promise<SyncFlashStorageResult>;
}
