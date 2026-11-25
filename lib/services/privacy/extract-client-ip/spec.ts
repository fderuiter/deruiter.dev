import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { RequestOrHeaders } from "../shared";

/**
 * Zod input schema for client IP extraction from request headers.
 */
export const ExtractClientIpInputSchema = z.object({
  requestOrHeaders: z.custom<RequestOrHeaders>().optional(),
});

export type ExtractClientIpInput = z.infer<typeof ExtractClientIpInputSchema>;

/**
 * Domain error codes for client IP extraction.
 */
export const ExtractClientIpErrorCode = z.enum(["INVALID_INPUT"]);
export type ExtractClientIpErrorCode = z.infer<typeof ExtractClientIpErrorCode>;

export interface ExtractClientIpData {
  ip: string;
}

export type ExtractClientIpResult = ServiceResult<
  ExtractClientIpData,
  ExtractClientIpErrorCode
>;

/**
 * Service contract for extracting a normalized client IP from proxy headers.
 */
export interface ExtractClientIpSpec {
  execute(input: ExtractClientIpInput): ExtractClientIpResult;
}
