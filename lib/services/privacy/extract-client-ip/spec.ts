import { z } from "zod";
import type { RequestOrHeaders } from "@/lib/privacy";
import type { ServiceResult } from "../../service-result";

export const ExtractClientIpInputSchema = z.object({
  request: z.custom<RequestOrHeaders>().optional(),
});

export type ExtractClientIpInput = z.infer<typeof ExtractClientIpInputSchema>;

export const ExtractClientIpErrorCode = z.enum(["INVALID_INPUT"]);
export type ExtractClientIpErrorCode = z.infer<typeof ExtractClientIpErrorCode>;

export interface ExtractClientIpOutput {
  ip: string;
}

export type ExtractClientIpResult = ServiceResult<
  ExtractClientIpOutput,
  ExtractClientIpErrorCode
>;

export interface ExtractClientIpSpec {
  execute(input: ExtractClientIpInput): ExtractClientIpResult;
}
