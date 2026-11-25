import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type {
  NewsletterDispatchCounts,
  NewsletterDispatchErrorCode,
} from "../shared";

export const DispatchDueNewsletterInputSchema = z
  .object({
    now: z.date().optional(),
  })
  .optional()
  .default({});

export interface DispatchDueNewsletterInput {
  now?: Date;
}

export type DispatchDueNewsletterResult = ServiceResult<
  NewsletterDispatchCounts,
  NewsletterDispatchErrorCode
>;

export interface DispatchDueNewsletterSpec {
  execute(
    input?: DispatchDueNewsletterInput
  ): Promise<DispatchDueNewsletterResult>;
}
