import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { RequestOrHeaders } from "@/lib/services/privacy";

/**
 * Zod input schema for anonymous telemetry rate-limit evaluation.
 */
export const CheckTelemetryRateLimitInputSchema = z.object({
  request: z.custom<RequestOrHeaders>(),
});

export type CheckTelemetryRateLimitInput = z.infer<
  typeof CheckTelemetryRateLimitInputSchema
>;

export const CheckTelemetryRateLimitErrorCode = z.enum([
  "INVALID_INPUT",
  "RATE_LIMIT_CHECK_FAILED",
]);
export type CheckTelemetryRateLimitErrorCode = z.infer<
  typeof CheckTelemetryRateLimitErrorCode
>;

export interface CheckTelemetryRateLimitData {
  limited: boolean;
  headers?: Record<string, string>;
}

export type CheckTelemetryRateLimitResult = ServiceResult<
  CheckTelemetryRateLimitData,
  CheckTelemetryRateLimitErrorCode
>;

/**
 * Service contract for evaluating anonymous sliding-window rate limits with passive circuit breaking.
 */
export interface CheckTelemetryRateLimitSpec {
  execute(
    input: CheckTelemetryRateLimitInput
  ): Promise<CheckTelemetryRateLimitResult>;
}
