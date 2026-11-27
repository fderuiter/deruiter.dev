import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const QueuePostAnnouncementInputSchema = z.object({
  blogPostId: z.string().trim().min(1, "Blog post ID is required"),
});

export type QueuePostAnnouncementInput = z.infer<
  typeof QueuePostAnnouncementInputSchema
>;

export interface QueuePostAnnouncementData {
  queued: true;
  blogPostId: string;
}

export const QueuePostAnnouncementErrorCode = z.enum([
  "INVALID_ANNOUNCEMENT_INPUT",
  "STORAGE_UNAVAILABLE",
]);

export type QueuePostAnnouncementErrorCode = z.infer<
  typeof QueuePostAnnouncementErrorCode
>;

export type QueuePostAnnouncementResult = ServiceResult<
  QueuePostAnnouncementData,
  QueuePostAnnouncementErrorCode
>;

export interface QueuePostAnnouncementSpec {
  execute(
    input: QueuePostAnnouncementInput
  ): Promise<QueuePostAnnouncementResult>;
}
