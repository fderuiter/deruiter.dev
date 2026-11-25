import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import {
  TelemetryMaintenanceErrorCode,
  type TelemetryAggregateStats,
} from "../shared";

export const GetTelemetryAggregateStatsInputSchema = z
  .object({})
  .optional()
  .default({});

export type GetTelemetryAggregateStatsInput = z.infer<
  typeof GetTelemetryAggregateStatsInputSchema
>;

export type GetTelemetryAggregateStatsResult = ServiceResult<
  TelemetryAggregateStats,
  TelemetryMaintenanceErrorCode
>;

/**
 * Service contract for reading precomputed public telemetry aggregates from Redis (Zero-Wake boundary, ADR 0043).
 */
export interface GetTelemetryAggregateStatsSpec {
  execute(
    input?: GetTelemetryAggregateStatsInput
  ): Promise<GetTelemetryAggregateStatsResult>;
}
