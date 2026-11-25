import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import {
  TelemetryMaintenanceErrorCode,
  type TelemetryAggregateStats,
} from "../shared";

export const ComputeTelemetryAggregateStatsInputSchema = z
  .object({})
  .optional()
  .default({});

export type ComputeTelemetryAggregateStatsInput = z.infer<
  typeof ComputeTelemetryAggregateStatsInputSchema
>;

export type ComputeTelemetryAggregateStatsResult = ServiceResult<
  TelemetryAggregateStats,
  TelemetryMaintenanceErrorCode
>;

/**
 * Service contract for computing per-project views and clicks from raw events and daily rollups in one RepeatableRead transaction.
 */
export interface ComputeTelemetryAggregateStatsSpec {
  execute(
    input?: ComputeTelemetryAggregateStatsInput
  ): Promise<ComputeTelemetryAggregateStatsResult>;
}
