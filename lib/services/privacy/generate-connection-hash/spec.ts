import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

/**
 * Zod input schema for privacy-preserving SHA-256 client connection hashing.
 */
export const GenerateConnectionHashInputSchema = z.object({
  ip: z.string().default("127.0.0.1"),
});

export type GenerateConnectionHashInput = z.infer<
  typeof GenerateConnectionHashInputSchema
>;

/**
 * Domain error codes for connection hash generation.
 */
export const GenerateConnectionHashErrorCode = z.enum([
  "INVALID_INPUT",
  "HASH_FAILED",
]);
export type GenerateConnectionHashErrorCode = z.infer<
  typeof GenerateConnectionHashErrorCode
>;

export interface GenerateConnectionHashData {
  hash: string;
}

export type GenerateConnectionHashResult = ServiceResult<
  GenerateConnectionHashData,
  GenerateConnectionHashErrorCode
>;

/**
 * Service contract for computing an anonymous SHA-256 connection hash from an IP string.
 */
export interface GenerateConnectionHashSpec {
  execute(
    input: GenerateConnectionHashInput
  ): Promise<GenerateConnectionHashResult>;
}
