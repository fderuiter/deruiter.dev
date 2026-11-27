import { z } from "zod";
import type { RequestOrHeaders } from "@/lib/privacy";
import type { ServiceResult } from "../../service-result";

export const HashConnectionInputSchema = z.object({
  request: z.custom<RequestOrHeaders>().optional(),
  ip: z.string().optional(),
  includeUserAgent: z.boolean().optional(),
});

export type HashConnectionInput = z.infer<typeof HashConnectionInputSchema>;

export const HashConnectionErrorCode = z.enum([
  "INVALID_INPUT",
  "HASHING_FAILED",
]);
export type HashConnectionErrorCode = z.infer<typeof HashConnectionErrorCode>;

export interface HashConnectionOutput {
  hash: string;
}

export type HashConnectionResult = ServiceResult<
  HashConnectionOutput,
  HashConnectionErrorCode
>;

export interface HashConnectionSpec {
  execute(input: HashConnectionInput): Promise<HashConnectionResult>;
}
