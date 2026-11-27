import { z } from "zod";
import {
  CaseStudyImageErrorCode,
  type CaseStudyData,
  type UpdateCaseStudyImageResult,
} from "../shared";

export const UpdateCaseStudyImageInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
  heroImageUrl: z.string().nullable(),
});

export type UpdateCaseStudyImageInput = z.infer<
  typeof UpdateCaseStudyImageInputSchema
>;

export {
  CaseStudyImageErrorCode,
  type CaseStudyData,
  type UpdateCaseStudyImageResult,
};

export interface UpdateCaseStudyImageSpec {
  execute(
    input: UpdateCaseStudyImageInput
  ): Promise<UpdateCaseStudyImageResult>;
}
