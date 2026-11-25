import { z } from "zod";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubmitBlogReactionInputSchema = z.object({
  blogPostSlug: z.string().min(1, "Blog post slug is required"),
  reactionType: z.enum(ALLOWED_REACTIONS),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type SubmitBlogReactionInput = {
  blogPostSlug: string;
  reactionType: string;
  connectionHash: string;
};

export interface SubmitBlogReactionData {
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export interface DuplicateBlogReactionDetails {
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export const SubmitBlogReactionErrorCode = z.enum([
  "NOT_FOUND",
  "RATE_LIMITED",
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
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
