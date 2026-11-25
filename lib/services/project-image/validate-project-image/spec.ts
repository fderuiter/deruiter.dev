import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { ProjectImageErrorCode } from "../shared";

export const ValidateProjectImageInputSchema = z.object({
  buffer: z.custom<Buffer>((val) => Buffer.isBuffer(val), "Buffer is required"),
  mimeType: z.string(),
});

export type ValidateProjectImageInput = z.infer<
  typeof ValidateProjectImageInputSchema
>;

export type ValidateProjectImageResult = ServiceResult<
  null,
  ProjectImageErrorCode
>;

/**
 * Service contract for validating project image payload size, MIME type, and magic bytes.
 */
export interface ValidateProjectImageSpec {
  execute(input: ValidateProjectImageInput): ValidateProjectImageResult;
}
