import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import { EnqueueEmailOptionsSchema } from "../enqueue-email/spec";
import type { RawEmailOptions } from "../shared";

export const SendRawEmailInputSchema = EnqueueEmailOptionsSchema;

export type SendRawEmailInput = RawEmailOptions;

export interface SendRawEmailData {
  id: string;
  simulated?: boolean;
  queued?: boolean;
  deferred?: boolean;
  queueId?: string;
}

export const SendRawEmailErrorCode = z.enum([
  "RECIPIENT_SUPPRESSED",
  "RECIPIENT_ELIGIBILITY_UNKNOWN",
  "TRANSPORT_UNCONFIGURED",
  "STORAGE_UNAVAILABLE",
  "DELIVERY_FAILED",
  "INVALID_INPUT",
]);
export type SendRawEmailErrorCode = z.infer<typeof SendRawEmailErrorCode>;

export type SendRawEmailResult = ServiceResult<
  SendRawEmailData,
  SendRawEmailErrorCode
>;

export interface SendRawEmailSpec {
  execute(input: SendRawEmailInput): Promise<SendRawEmailResult>;
}
