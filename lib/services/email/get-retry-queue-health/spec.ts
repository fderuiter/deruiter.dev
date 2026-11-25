import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetEmailRetryQueueHealthInputSchema = z
  .object({
    now: z.date().optional(),
  })
  .optional()
  .default({});

export interface GetEmailRetryQueueHealthInput {
  now?: Date;
}

export interface EmailRetryQueueHealthData {
  depth: number;
  oldestPendingAgeMs: number | null;
  terminalFailures: number;
  retryExhausted: number;
  eligibilityDeferred: number;
}

export const GetEmailRetryQueueHealthErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
]);
export type GetEmailRetryQueueHealthErrorCode = z.infer<
  typeof GetEmailRetryQueueHealthErrorCode
>;

export type GetEmailRetryQueueHealthResult = ServiceResult<
  EmailRetryQueueHealthData,
  GetEmailRetryQueueHealthErrorCode
>;

export interface GetEmailRetryQueueHealthSpec {
  execute(
    input?: GetEmailRetryQueueHealthInput
  ): Promise<GetEmailRetryQueueHealthResult>;
}
