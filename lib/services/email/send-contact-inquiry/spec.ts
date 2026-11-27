import { z } from "zod";
import { ContactSubmissionSchema, type ContactSubmission } from "@/lib/schemas";
import type { ServiceResult } from "../../service-result";
import {
  SendRawEmailErrorCode,
  type SendRawEmailOutput,
  type SendRawEmailResult,
} from "../send-raw-email/spec";

export const SendContactInquiryInputSchema = z.object({
  submission: ContactSubmissionSchema,
  connectionHash: z.string().optional(),
});

export interface SendContactInquiryInput {
  submission: ContactSubmission;
  connectionHash?: string;
}

export const SendContactInquiryErrorCode = SendRawEmailErrorCode;
export type SendContactInquiryErrorCode = z.infer<
  typeof SendContactInquiryErrorCode
>;

export interface SendContactInquiryOutput {
  adminDelivery: SendRawEmailOutput;
  confirmationResult: SendRawEmailResult;
}

export type SendContactInquiryResult = ServiceResult<
  SendContactInquiryOutput,
  SendContactInquiryErrorCode
>;

export interface SendContactInquirySpec {
  execute(input: SendContactInquiryInput): Promise<SendContactInquiryResult>;
}
