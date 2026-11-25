import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const QueuePostAnnouncementInputSchema = z.object({
  blogPostId: z.string().min(1, "Blog post ID is required"),
});

export type QueuePostAnnouncementInput = z.infer<
  typeof QueuePostAnnouncementInputSchema
>;

export interface QueuePostAnnouncementData {
  blogPostId: string;
}

export const QueuePostAnnouncementErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
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
