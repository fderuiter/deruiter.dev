import { z } from "zod";
import { ContactSubmissionSchema, type ContactSubmission } from "@/lib/schemas";
import type { ServiceResult } from "@/lib/services/service-result";
import type { SendRawEmailResult } from "../send-raw-email/spec";

export const SendContactInquiryInputSchema = z.object({
  submission: ContactSubmissionSchema,
  connectionHash: z.string().optional(),
});

export interface SendContactInquiryInput {
  submission: ContactSubmission;
  connectionHash?: string;
}

export interface SendContactInquiryData {
  messageId: string;
  simulated?: boolean;
  adminResult: SendRawEmailResult;
  confirmationResult: SendRawEmailResult;
}

export const SendContactInquiryErrorCode = z.enum([
  "RECIPIENT_SUPPRESSED",
  "RECIPIENT_ELIGIBILITY_UNKNOWN",
  "TRANSPORT_UNCONFIGURED",
  "STORAGE_UNAVAILABLE",
  "DELIVERY_FAILED",
  "INVALID_INPUT",
]);
export type SendContactInquiryErrorCode = z.infer<
  typeof SendContactInquiryErrorCode
>;

export type SendContactInquiryResult = ServiceResult<
  SendContactInquiryData,
  SendContactInquiryErrorCode
>;

export interface SendContactInquirySpec {
  execute(input: SendContactInquiryInput): Promise<SendContactInquiryResult>;
}
