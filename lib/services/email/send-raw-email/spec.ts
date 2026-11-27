import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import type { RawEmailOptions } from "../shared";

export const SendRawEmailInputSchema = z.object({
  to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  skipQueue: z.boolean().optional(),
});

export type SendRawEmailInput = RawEmailOptions;

export const SendRawEmailErrorCode = z.enum([
  "INVALID_INPUT",
  "RECIPIENT_SUPPRESSED",
  "RECIPIENT_ELIGIBILITY_UNKNOWN",
  "TRANSPORT_UNCONFIGURED",
  "PROVIDER_REJECTED",
  "STORAGE_UNAVAILABLE",
]);
export type SendRawEmailErrorCode = z.infer<typeof SendRawEmailErrorCode>;

export interface SendRawEmailOutput {
  id: string;
  simulated?: boolean;
  queued?: boolean;
  deferred?: boolean;
  queueId?: string;
}

export type SendRawEmailResult = ServiceResult<
  SendRawEmailOutput,
  SendRawEmailErrorCode
>;

export interface SendRawEmailSpec {
  execute(input: SendRawEmailInput): Promise<SendRawEmailResult>;
}
