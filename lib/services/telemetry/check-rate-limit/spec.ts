import { z } from "zod";
import type { RequestOrHeaders } from "@/lib/privacy";
import type { ServiceResult } from "../../service-result";

export const CheckTelemetryRateLimitInputSchema = z.object({
  request: z.custom<RequestOrHeaders>(),
});

export type CheckTelemetryRateLimitInput = z.infer<
  typeof CheckTelemetryRateLimitInputSchema
>;

export const CheckTelemetryRateLimitErrorCode = z.enum(["INVALID_INPUT"]);
export type CheckTelemetryRateLimitErrorCode = z.infer<
  typeof CheckTelemetryRateLimitErrorCode
>;

export interface CheckTelemetryRateLimitOutput {
  limited: boolean;
  headers?: Record<string, string>;
}

export type CheckTelemetryRateLimitResult = ServiceResult<
  CheckTelemetryRateLimitOutput,
  CheckTelemetryRateLimitErrorCode
>;

export interface CheckTelemetryRateLimitSpec {
  execute(
    input: CheckTelemetryRateLimitInput
  ): Promise<CheckTelemetryRateLimitResult>;
}
