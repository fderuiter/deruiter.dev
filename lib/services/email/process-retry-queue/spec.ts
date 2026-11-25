import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { EmailRetryCounts, EmailRetryErrorCode } from "../shared";

export const ProcessRetryQueueInputSchema = z
  .object({
    maxBatchSize: z.number().int().min(1).optional(),
    now: z.date().optional(),
    queueId: z.string().min(1).optional(),
  })
  .optional()
  .default({});

export interface ProcessRetryQueueInput {
  maxBatchSize?: number;
  now?: Date;
  queueId?: string;
}

export type ProcessRetryQueueData = EmailRetryCounts;

export type ProcessRetryQueueResult = ServiceResult<
  ProcessRetryQueueData,
  EmailRetryErrorCode
>;

export interface ProcessRetryQueueSpec {
  execute(input?: ProcessRetryQueueInput): Promise<ProcessRetryQueueResult>;
}
