import { z } from "zod";
import type { MediaStorageErrorCode } from "@/lib/services/media-storage";
import type { ServiceResult } from "@/lib/services/service-result";

export const DeleteMediaAssetInputSchema = z.object({
  key: z.string().min(1, "Media asset key is required"),
});

export type DeleteMediaAssetInput = z.infer<typeof DeleteMediaAssetInputSchema>;

export type DeleteMediaAssetErrorCode = MediaStorageErrorCode | "INVALID_INPUT";

export type DeleteMediaAssetResult = ServiceResult<
  null,
  DeleteMediaAssetErrorCode
>;

/**
 * Service contract for deleting a media asset from the active storage provider by key.
 */
export interface DeleteMediaAssetSpec {
  execute(input: DeleteMediaAssetInput): Promise<DeleteMediaAssetResult>;
}
