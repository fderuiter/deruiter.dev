import { z } from "zod";
import type { ServiceResult } from "../../service-result";

export const GetRetryQueueHealthInputSchema = z
  .object({
    now: z.date().optional(),
  })
  .optional();

export type GetRetryQueueHealthInput = z.infer<
  typeof GetRetryQueueHealthInputSchema
>;

export const GetRetryQueueHealthErrorCode = z.enum(["STORAGE_UNAVAILABLE"]);
export type GetRetryQueueHealthErrorCode = z.infer<
  typeof GetRetryQueueHealthErrorCode
>;

export interface RetryQueueHealthOutput {
  depth: number;
  oldestPendingAgeMs: number | null;
  terminalFailures: number;
  retryExhausted: number;
  eligibilityDeferred: number;
}

export type GetRetryQueueHealthResult = ServiceResult<
  RetryQueueHealthOutput,
  GetRetryQueueHealthErrorCode
>;

export interface GetRetryQueueHealthSpec {
  execute(input?: GetRetryQueueHealthInput): Promise<GetRetryQueueHealthResult>;
}
