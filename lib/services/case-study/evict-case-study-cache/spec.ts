import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const EvictCaseStudyCacheInputSchema = z.object({
  slug: z.string(),
});

export type EvictCaseStudyCacheInput = z.infer<
  typeof EvictCaseStudyCacheInputSchema
>;

export const EvictCaseStudyCacheErrorCode = z.enum(["INVALID_INPUT"]);
export type EvictCaseStudyCacheErrorCode = z.infer<
  typeof EvictCaseStudyCacheErrorCode
>;

export interface EvictCaseStudyCacheData {
  evicted: boolean;
}

export type EvictCaseStudyCacheResult = ServiceResult<
  EvictCaseStudyCacheData,
  EvictCaseStudyCacheErrorCode
>;

/**
 * Service contract for evicting Upstash Redis case study cache keys and dispatching Next.js ISR revalidations.
 */
export interface EvictCaseStudyCacheSpec {
  execute(input: EvictCaseStudyCacheInput): Promise<EvictCaseStudyCacheResult>;
}
