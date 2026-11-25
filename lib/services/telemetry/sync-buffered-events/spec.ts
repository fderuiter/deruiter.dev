import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { TelemetryMaintenanceErrorCode } from "../shared";

export const SyncBufferedTelemetryEventsInputSchema = z.object({
  batchSize: z.number().int().positive("batchSize must be positive"),
});

export type SyncBufferedTelemetryEventsInput = z.infer<
  typeof SyncBufferedTelemetryEventsInputSchema
>;

export interface SyncBufferedTelemetryEventsData {
  processed: number;
  inserted: number;
}

export type SyncBufferedTelemetryEventsResult = ServiceResult<
  SyncBufferedTelemetryEventsData,
  TelemetryMaintenanceErrorCode
>;

/**
 * Service contract for atomically moving buffered Redis telemetry events into PostgreSQL and acknowledging owned rows.
 */
export interface SyncBufferedTelemetryEventsSpec {
  execute(
    input: SyncBufferedTelemetryEventsInput
  ): Promise<SyncBufferedTelemetryEventsResult>;
}
