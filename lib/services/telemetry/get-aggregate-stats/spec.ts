import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import type { TelemetryAggregateStats } from "../shared";

export const GetTelemetryAggregateStatsInputSchema = z.object({}).optional();
export type GetTelemetryAggregateStatsInput = z.infer<
  typeof GetTelemetryAggregateStatsInputSchema
>;

export const GetTelemetryAggregateStatsErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
]);
export type GetTelemetryAggregateStatsErrorCode = z.infer<
  typeof GetTelemetryAggregateStatsErrorCode
>;

export type GetTelemetryAggregateStatsResult = ServiceResult<
  TelemetryAggregateStats,
  GetTelemetryAggregateStatsErrorCode
>;

export interface GetTelemetryAggregateStatsSpec {
  execute(
    input?: GetTelemetryAggregateStatsInput
  ): Promise<GetTelemetryAggregateStatsResult>;
}
