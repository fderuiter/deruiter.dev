import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubmitCaseStudyReactionInputSchema = z.object({
  caseStudySlug: z.string().min(1, "caseStudySlug is required"),
  reactionType: z.string().min(1, "reactionType is required"),
  connectionHash: z.string().min(1, "connectionHash is required"),
});

export type SubmitCaseStudyReactionInput = z.infer<
  typeof SubmitCaseStudyReactionInputSchema
>;

export const SubmitCaseStudyReactionErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type SubmitCaseStudyReactionErrorCode = z.infer<
  typeof SubmitCaseStudyReactionErrorCode
>;

export interface SubmitCaseStudyReactionData {
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export type SubmitCaseStudyReactionResult = ServiceResult<
  SubmitCaseStudyReactionData,
  SubmitCaseStudyReactionErrorCode
>;

/**
 * Service contract for recording a visitor reaction on a case study via Upstash Redis write-buffering or direct PostgreSQL fallback.
 */
export interface SubmitCaseStudyReactionSpec {
  execute(
    input: SubmitCaseStudyReactionInput
  ): Promise<SubmitCaseStudyReactionResult>;
}
