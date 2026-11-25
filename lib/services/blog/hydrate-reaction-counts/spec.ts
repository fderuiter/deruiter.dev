import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const HydrateBlogReactionCountsInputSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
});

export type HydrateBlogReactionCountsInput = z.infer<
  typeof HydrateBlogReactionCountsInputSchema
>;

export interface HydrateBlogReactionCountsData {
  counts: Record<string, number>;
}

export const HydrateBlogReactionCountsErrorCode = z.enum(["INVALID_INPUT"]);
export type HydrateBlogReactionCountsErrorCode = z.infer<
  typeof HydrateBlogReactionCountsErrorCode
>;

export type HydrateBlogReactionCountsResult = ServiceResult<
  HydrateBlogReactionCountsData,
  HydrateBlogReactionCountsErrorCode
>;

export interface HydrateBlogReactionCountsSpec {
  execute(
    input: HydrateBlogReactionCountsInput
  ): Promise<HydrateBlogReactionCountsResult>;
}
