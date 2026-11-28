import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { ALLOWED_CASE_STUDY_REACTIONS } from "../shared";

export const SubmitCaseStudyReactionInputSchema = z.object({
  caseStudySlug: z.string().trim().min(1, "Case study slug is required"),
  reactionType: z.enum(ALLOWED_CASE_STUDY_REACTIONS),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type SubmitCaseStudyReactionInput = z.infer<
  typeof SubmitCaseStudyReactionInputSchema
>;

export interface SubmitCaseStudyReactionData {
  durable: boolean;
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export const SubmitCaseStudyReactionErrorCode = z.enum([
  "INVALID_REACTION_INPUT",
  "STORAGE_UNAVAILABLE",
]);

export type SubmitCaseStudyReactionErrorCode = z.infer<
  typeof SubmitCaseStudyReactionErrorCode
>;

export type SubmitCaseStudyReactionResult = ServiceResult<
  SubmitCaseStudyReactionData,
  SubmitCaseStudyReactionErrorCode
>;

export interface SubmitCaseStudyReactionSpec {
  execute(
    input: SubmitCaseStudyReactionInput
  ): Promise<SubmitCaseStudyReactionResult>;
}
