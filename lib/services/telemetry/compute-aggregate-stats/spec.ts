import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import {
  TelemetryMaintenanceErrorCode,
  type TelemetryAggregateStats,
} from "../shared";

export const ComputeTelemetryAggregateStatsInputSchema = z
  .object({})
  .optional();
export type ComputeTelemetryAggregateStatsInput = z.infer<
  typeof ComputeTelemetryAggregateStatsInputSchema
>;

export type ComputeTelemetryAggregateStatsResult = ServiceResult<
  TelemetryAggregateStats,
  TelemetryMaintenanceErrorCode
>;

export interface ComputeTelemetryAggregateStatsSpec {
  execute(
    input?: ComputeTelemetryAggregateStatsInput
  ): Promise<ComputeTelemetryAggregateStatsResult>;
}
