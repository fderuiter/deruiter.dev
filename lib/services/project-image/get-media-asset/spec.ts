import { z } from "zod";
import {
  MediaStorageErrorCode,
  type MediaAssetRecord,
} from "@/lib/services/media-storage";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetMediaAssetInputSchema = z.object({
  key: z.string().trim().min(1, "Media asset key is required"),
});

export type GetMediaAssetInput = z.infer<typeof GetMediaAssetInputSchema>;

export const GetMediaAssetErrorCode = z.enum([
  ...MediaStorageErrorCode.options,
  "INVALID_MEDIA_KEY",
]);

export type GetMediaAssetErrorCode = z.infer<typeof GetMediaAssetErrorCode>;

export type GetMediaAssetResult = ServiceResult<
  MediaAssetRecord | null,
  GetMediaAssetErrorCode
>;

export type { MediaAssetRecord, MediaStorageErrorCode };

export interface GetMediaAssetSpec {
  execute(input: GetMediaAssetInput): Promise<GetMediaAssetResult>;
}
