import { z } from "zod";
import {
  BlogReactionFlushErrorCode,
  type BlogReactionFlushResult,
} from "../shared";

export const FlushBlogReactionsInputSchema = z.object({
  batchSize: z.number().int().min(1).max(5000).optional(),
});

export type FlushBlogReactionsInput = z.infer<
  typeof FlushBlogReactionsInputSchema
>;

export { BlogReactionFlushErrorCode, type BlogReactionFlushResult };

export interface FlushBlogReactionsSpec {
  execute(input?: FlushBlogReactionsInput): Promise<BlogReactionFlushResult>;
}
