import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { CaseStudyReactionFlushErrorCode } from "../shared";

export const FlushCaseStudyReactionsInputSchema = z
  .object({
    batchSize: z.number().int().positive().optional().default(500),
  })
  .optional()
  .default({ batchSize: 500 });

export type FlushCaseStudyReactionsInput = z.input<
  typeof FlushCaseStudyReactionsInputSchema
>;

export interface FlushCaseStudyReactionsData {
  processed: number;
  inserted: number;
}

export type FlushCaseStudyReactionsResult = ServiceResult<
  FlushCaseStudyReactionsData,
  CaseStudyReactionFlushErrorCode
>;

/**
 * Service contract for flushing buffered Upstash Redis case study reactions into PostgreSQL.
 */
export interface FlushCaseStudyReactionsSpec {
  execute(
    input?: FlushCaseStudyReactionsInput
  ): Promise<FlushCaseStudyReactionsResult>;
}
