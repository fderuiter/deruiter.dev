import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { ProjectImageErrorCode } from "../shared";

export const UploadProjectImageInputSchema = z.object({
  slug: z.string().min(1, "Case study slug is required"),
  fileBuffer: z.custom<Buffer>(
    (val) => Buffer.isBuffer(val),
    "Buffer is required"
  ),
  mimeType: z.string(),
});

export type UploadProjectImageInput = z.infer<
  typeof UploadProjectImageInputSchema
>;

export interface UploadProjectImageData {
  key: string;
  hero_image_url: string;
}

export type UploadProjectImageResult = ServiceResult<
  UploadProjectImageData,
  ProjectImageErrorCode
>;

/**
 * Service contract for validating, sanitizing, uploading, and linking a project hero image to a case study.
 */
export interface UploadProjectImageSpec {
  execute(input: UploadProjectImageInput): Promise<UploadProjectImageResult>;
}
