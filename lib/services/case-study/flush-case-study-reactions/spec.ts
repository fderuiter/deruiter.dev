import { z } from "zod";
import {
  CaseStudyReactionFlushErrorCode,
  type CaseStudyReactionFlushResult,
} from "../shared";

export const FlushCaseStudyReactionsInputSchema = z.object({
  batchSize: z.number().int().min(1).max(5000).optional(),
});

export type FlushCaseStudyReactionsInput = z.infer<
  typeof FlushCaseStudyReactionsInputSchema
>;

export { CaseStudyReactionFlushErrorCode, type CaseStudyReactionFlushResult };

export interface FlushCaseStudyReactionsSpec {
  execute(
    input?: FlushCaseStudyReactionsInput
  ): Promise<CaseStudyReactionFlushResult>;
}
