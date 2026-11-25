import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { CaseStudyImageErrorCode, type CaseStudyData } from "../shared";

export const UpdateCaseStudyImageInputSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  heroImageUrl: z.string().nullable(),
});

export type UpdateCaseStudyImageInput = z.infer<
  typeof UpdateCaseStudyImageInputSchema
>;

export type UpdateCaseStudyImageSliceResult = ServiceResult<
  CaseStudyData,
  CaseStudyImageErrorCode
>;

/**
 * Service contract for updating a case study's hero image URL and evicting its cache.
 */
export interface UpdateCaseStudyImageSpec {
  execute(
    input: UpdateCaseStudyImageInput
  ): Promise<UpdateCaseStudyImageSliceResult>;
}
