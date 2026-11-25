import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import type { BufferedTelemetryEvent } from "../shared";

export const RecordTelemetryEventInputSchema = z.object({
  projectSlug: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(100),
});

export type RecordTelemetryEventInput = z.infer<
  typeof RecordTelemetryEventInputSchema
>;

export const RecordTelemetryEventErrorCode = z.enum(["INVALID_INPUT"]);
export type RecordTelemetryEventErrorCode = z.infer<
  typeof RecordTelemetryEventErrorCode
>;

export interface RecordTelemetryEventOutput {
  event: BufferedTelemetryEvent;
  buffered: boolean;
}

export type RecordTelemetryEventResult = ServiceResult<
  RecordTelemetryEventOutput,
  RecordTelemetryEventErrorCode
>;

export interface RecordTelemetryEventSpec {
  execute(
    input: RecordTelemetryEventInput
  ): Promise<RecordTelemetryEventResult>;
}
