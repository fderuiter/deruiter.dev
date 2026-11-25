import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetBlogRssFeedInputSchema = z.object({
  baseUrl: z.string().url().optional(),
});

export type GetBlogRssFeedInput = z.infer<typeof GetBlogRssFeedInputSchema>;

export interface GetBlogRssFeedData {
  xml: string;
  itemCount: number;
}

export const GetBlogRssFeedErrorCode = z.enum([
  "INVALID_RSS_FEED_INPUT",
  "RSS_GENERATION_FAILED",
]);

export type GetBlogRssFeedErrorCode = z.infer<typeof GetBlogRssFeedErrorCode>;

export type GetBlogRssFeedResult = ServiceResult<
  GetBlogRssFeedData,
  GetBlogRssFeedErrorCode
>;

export interface GetBlogRssFeedSpec {
  execute(input?: GetBlogRssFeedInput): Promise<GetBlogRssFeedResult>;
}
