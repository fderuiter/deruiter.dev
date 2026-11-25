import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { EnqueueEmailOptionsSchema } from "../enqueue-email/spec";
import type { RawEmailOptions } from "../shared";

export const QueueOutboundEmailInputSchema = z.object({
  options: EnqueueEmailOptionsSchema,
  fromAddress: z.string().optional(),
  errorReason: z.string().optional(),
});

export interface QueueOutboundEmailInput {
  options: RawEmailOptions;
  fromAddress?: string;
  errorReason?: string;
}

export interface QueueOutboundEmailData {
  queueId: string;
}

export const QueueOutboundEmailErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
]);
export type QueueOutboundEmailErrorCode = z.infer<
  typeof QueueOutboundEmailErrorCode
>;

export type QueueOutboundEmailResult = ServiceResult<
  QueueOutboundEmailData,
  QueueOutboundEmailErrorCode
>;

export interface QueueOutboundEmailSpec {
  execute(input: QueueOutboundEmailInput): Promise<QueueOutboundEmailResult>;
}
