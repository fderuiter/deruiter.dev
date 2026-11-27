import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const EvictCaseStudyCacheInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
});

export type EvictCaseStudyCacheInput = z.infer<
  typeof EvictCaseStudyCacheInputSchema
>;

export interface EvictCaseStudyCacheData {
  evicted: boolean;
}

export const EvictCaseStudyCacheErrorCode = z.enum(["INVALID_CASE_STUDY_SLUG"]);

export type EvictCaseStudyCacheErrorCode = z.infer<
  typeof EvictCaseStudyCacheErrorCode
>;

export type EvictCaseStudyCacheResult = ServiceResult<
  EvictCaseStudyCacheData,
  EvictCaseStudyCacheErrorCode
>;

export interface EvictCaseStudyCacheSpec {
  execute(input: EvictCaseStudyCacheInput): Promise<EvictCaseStudyCacheResult>;
}
