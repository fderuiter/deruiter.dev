import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const VerifySvixSignatureInputSchema = z.object({
  payload: z.string(),
  svixId: z.string().nullable().optional(),
  svixTimestamp: z.string().nullable().optional(),
  svixSignature: z.string().nullable().optional(),
  secret: z.string().optional(),
});

export type VerifySvixSignatureInput = z.infer<
  typeof VerifySvixSignatureInputSchema
>;

export interface VerifySvixSignatureData {
  valid: boolean;
}

export const VerifySvixSignatureErrorCode = z.enum([
  "MISSING_HEADERS",
  "INVALID_SIGNATURE",
  "INVALID_INPUT",
]);
export type VerifySvixSignatureErrorCode = z.infer<
  typeof VerifySvixSignatureErrorCode
>;

export type VerifySvixSignatureResult = ServiceResult<
  VerifySvixSignatureData,
  VerifySvixSignatureErrorCode
>;

export interface VerifySvixSignatureSpec {
  execute(input: VerifySvixSignatureInput): VerifySvixSignatureResult;
}
