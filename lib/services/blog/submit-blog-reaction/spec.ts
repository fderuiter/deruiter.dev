import { z } from "zod";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubmitBlogReactionInputSchema = z.object({
  blogPostSlug: z.string().trim().min(1, "Blog post slug is required"),
  reactionType: z.enum(ALLOWED_REACTIONS),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type SubmitBlogReactionInput = z.infer<
  typeof SubmitBlogReactionInputSchema
>;

export interface SubmitBlogReactionData {
  durable: boolean;
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export interface DuplicateBlogReactionDetails {
  counts: Record<string, number>;
  userReactions: string[];
}

export const SubmitBlogReactionErrorCode = z.enum([
  "INVALID_REACTION_INPUT",
  "BLOG_POST_NOT_FOUND",
  "RATE_LIMITED",
  "STORAGE_UNAVAILABLE",
]);

export type SubmitBlogReactionErrorCode = z.infer<
  typeof SubmitBlogReactionErrorCode
>;

export type SubmitBlogReactionResult = ServiceResult<
  SubmitBlogReactionData,
  SubmitBlogReactionErrorCode
>;

export interface SubmitBlogReactionSpec {
  execute(input: SubmitBlogReactionInput): Promise<SubmitBlogReactionResult>;
}
