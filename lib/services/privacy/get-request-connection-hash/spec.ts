import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { RequestOrHeaders } from "../shared";

/**
 * Zod input schema for computing a connection hash from incoming request headers.
 */
export const GetRequestConnectionHashInputSchema = z.object({
  requestOrHeaders: z.custom<RequestOrHeaders>().optional(),
});

export type GetRequestConnectionHashInput = z.infer<
  typeof GetRequestConnectionHashInputSchema
>;

/**
 * Domain error codes for request connection hashing.
 */
export const GetRequestConnectionHashErrorCode = z.enum([
  "INVALID_INPUT",
  "HASH_FAILED",
]);
export type GetRequestConnectionHashErrorCode = z.infer<
  typeof GetRequestConnectionHashErrorCode
>;

export interface GetRequestConnectionHashData {
  hash: string;
}

export type GetRequestConnectionHashResult = ServiceResult<
  GetRequestConnectionHashData,
  GetRequestConnectionHashErrorCode
>;

/**
 * Service contract for deriving an anonymous SHA-256 connection hash from a request's IP and user-agent.
 */
export interface GetRequestConnectionHashSpec {
  execute(
    input: GetRequestConnectionHashInput
  ): Promise<GetRequestConnectionHashResult>;
}
