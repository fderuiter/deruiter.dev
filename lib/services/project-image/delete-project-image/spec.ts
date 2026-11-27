import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const DeleteProjectImageInputSchema = z.object({
  slug: z.string().trim().min(1, "Project slug parameter is required"),
});

export type DeleteProjectImageInput = z.infer<
  typeof DeleteProjectImageInputSchema
>;

export interface DeleteProjectImageData {
  slug: string;
  hero_image_url: null;
}

export const DeleteProjectImageErrorCode = z.enum([
  "INVALID_PROJECT_IMAGE_SLUG",
  "CASE_STUDY_NOT_FOUND",
  "CASE_STUDY_LOOKUP_FAILED",
  "PERSISTENCE_FAILED",
]);

export type DeleteProjectImageErrorCode = z.infer<
  typeof DeleteProjectImageErrorCode
>;

export type DeleteProjectImageResult = ServiceResult<
  DeleteProjectImageData,
  DeleteProjectImageErrorCode
>;

export interface DeleteProjectImageSpec {
  execute(input: DeleteProjectImageInput): Promise<DeleteProjectImageResult>;
}
