import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { TelemetryMaintenanceErrorCode } from "../shared";

export const RollupAndPruneTelemetryEventsInputSchema = z.object({
  before: z.date(),
});

export type RollupAndPruneTelemetryEventsInput = z.infer<
  typeof RollupAndPruneTelemetryEventsInputSchema
>;

export interface RollupAndPruneTelemetryEventsData {
  rollupsUpserted: number;
  rawEventsDeleted: number;
}

export type RollupAndPruneTelemetryEventsResult = ServiceResult<
  RollupAndPruneTelemetryEventsData,
  TelemetryMaintenanceErrorCode
>;

/**
 * Service contract for rolling up raw telemetry events older than a cutoff into daily aggregates and pruning them atomically.
 */
export interface RollupAndPruneTelemetryEventsSpec {
  execute(
    input: RollupAndPruneTelemetryEventsInput
  ): Promise<RollupAndPruneTelemetryEventsResult>;
}
