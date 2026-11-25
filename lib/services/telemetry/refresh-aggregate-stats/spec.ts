import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { TelemetryMaintenanceErrorCode } from "../shared";

export const RefreshTelemetryAggregateStatsInputSchema = z
  .object({})
  .optional()
  .default({});

export type RefreshTelemetryAggregateStatsInput = z.infer<
  typeof RefreshTelemetryAggregateStatsInputSchema
>;

export interface RefreshTelemetryAggregateStatsData {
  projects: number;
}

export type RefreshTelemetryAggregateStatsResult = ServiceResult<
  RefreshTelemetryAggregateStatsData,
  TelemetryMaintenanceErrorCode
>;

/**
 * Service contract for computing PostgreSQL telemetry aggregates and refreshing the Redis snapshot.
 */
export interface RefreshTelemetryAggregateStatsSpec {
  execute(
    input?: RefreshTelemetryAggregateStatsInput
  ): Promise<RefreshTelemetryAggregateStatsResult>;
}
