import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BufferedTelemetryEvent } from "../shared";

/**
 * Zod input schema for recording a buffered telemetry event.
 */
export const RecordTelemetryEventInputSchema = z.object({
  projectSlug: z.string().min(1, "projectSlug must not be empty"),
  eventType: z.string().min(1, "eventType must not be empty"),
});

export type RecordTelemetryEventInput = z.infer<
  typeof RecordTelemetryEventInputSchema
>;

export const RecordTelemetryEventErrorCode = z.enum([
  "INVALID_INPUT",
  "RECORD_EVENT_FAILED",
]);
export type RecordTelemetryEventErrorCode = z.infer<
  typeof RecordTelemetryEventErrorCode
>;

export interface RecordTelemetryEventData {
  event: BufferedTelemetryEvent;
  buffered: boolean;
}

export type RecordTelemetryEventResult = ServiceResult<
  RecordTelemetryEventData,
  RecordTelemetryEventErrorCode
>;

/**
 * Service contract for recording a telemetry interaction event into the Redis buffer queue.
 */
export interface RecordTelemetryEventSpec {
  execute(
    input: RecordTelemetryEventInput
  ): Promise<RecordTelemetryEventResult>;
}
