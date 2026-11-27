import { z } from "zod";
import type { EmailRetryResult } from "../shared";

export const ProcessRetryQueueInputSchema = z
  .object({
    maxBatchSize: z.number().int().positive().optional(),
    now: z.date().optional(),
    queueId: z.string().trim().min(1).optional(),
  })
  .optional();

export type ProcessRetryQueueInput = z.infer<
  typeof ProcessRetryQueueInputSchema
>;

export type ProcessRetryQueueResult = EmailRetryResult;

export interface ProcessRetryQueueSpec {
  execute(input?: ProcessRetryQueueInput): Promise<ProcessRetryQueueResult>;
}
