import { z } from "zod";
import type {
  MediaAssetRecord,
  MediaStorageErrorCode,
} from "@/lib/services/media-storage";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetMediaAssetInputSchema = z.object({
  key: z.string().min(1, "Media asset key is required"),
});

export type GetMediaAssetInput = z.infer<typeof GetMediaAssetInputSchema>;

export type GetMediaAssetErrorCode = MediaStorageErrorCode | "INVALID_INPUT";

export type GetMediaAssetResult = ServiceResult<
  MediaAssetRecord | null,
  GetMediaAssetErrorCode
>;

/**
 * Service contract for retrieving a media asset from the active storage provider by key.
 */
export interface GetMediaAssetSpec {
  execute(input: GetMediaAssetInput): Promise<GetMediaAssetResult>;
}
