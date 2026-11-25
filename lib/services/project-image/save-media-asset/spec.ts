import { z } from "zod";
import type { MediaStorageErrorCode } from "@/lib/services/media-storage";
import type { ServiceResult } from "@/lib/services/service-result";

export const SaveMediaAssetInputSchema = z.object({
  key: z.string().min(1, "Media asset key is required"),
  buffer: z.custom<Buffer>((val) => Buffer.isBuffer(val), "Buffer is required"),
  contentType: z.string().min(1, "contentType is required"),
});

export type SaveMediaAssetInput = z.infer<typeof SaveMediaAssetInputSchema>;

export type SaveMediaAssetErrorCode = MediaStorageErrorCode | "INVALID_INPUT";

export type SaveMediaAssetResult = ServiceResult<
  string,
  SaveMediaAssetErrorCode
>;

/**
 * Service contract for storing a validated media buffer in the active provider and returning its asset URL.
 */
export interface SaveMediaAssetSpec {
  execute(input: SaveMediaAssetInput): Promise<SaveMediaAssetResult>;
}
