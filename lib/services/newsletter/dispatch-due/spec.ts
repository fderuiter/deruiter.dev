import { z } from "zod";
import {
  NewsletterDispatchErrorCode,
  type NewsletterDispatchCounts,
  type NewsletterDispatchResult,
} from "../shared";

export const DispatchNewsletterAnnouncementsInputSchema = z.object({
  now: z.date().optional(),
});

export type DispatchNewsletterAnnouncementsInput = z.infer<
  typeof DispatchNewsletterAnnouncementsInputSchema
>;

export {
  NewsletterDispatchErrorCode,
  type NewsletterDispatchCounts,
  type NewsletterDispatchResult,
};

export interface DispatchNewsletterAnnouncementsSpec {
  execute(
    input?: DispatchNewsletterAnnouncementsInput
  ): Promise<NewsletterDispatchResult>;
}
