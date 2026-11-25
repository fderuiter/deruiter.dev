import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogReactionFlushErrorCode } from "../shared";

export const FlushBlogReactionsInputSchema = z
  .object({
    batchSize: z.number().int().min(1).max(5000).default(500),
  })
  .optional()
  .default({ batchSize: 500 });

export type FlushBlogReactionsInput = z.input<
  typeof FlushBlogReactionsInputSchema
>;

export type FlushBlogReactionsResult = ServiceResult<
  { processed: number; inserted: number },
  BlogReactionFlushErrorCode
>;

export interface FlushBlogReactionsSpec {
  execute(input?: FlushBlogReactionsInput): Promise<FlushBlogReactionsResult>;
}
