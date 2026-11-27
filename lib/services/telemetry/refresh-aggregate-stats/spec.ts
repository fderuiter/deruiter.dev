import { z } from "zod";
import type { TelemetryAggregateRefreshResult } from "../shared";

export const RefreshTelemetryAggregateStatsInputSchema = z
  .object({})
  .optional();
export type RefreshTelemetryAggregateStatsInput = z.infer<
  typeof RefreshTelemetryAggregateStatsInputSchema
>;

export type RefreshTelemetryAggregateStatsResult =
  TelemetryAggregateRefreshResult;

export interface RefreshTelemetryAggregateStatsSpec {
  execute(
    input?: RefreshTelemetryAggregateStatsInput
  ): Promise<RefreshTelemetryAggregateStatsResult>;
}
