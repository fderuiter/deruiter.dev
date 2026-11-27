import { z } from "zod";
import type { ServiceResult } from "../../service-result";

export const GetSuppressedEmailsInputSchema = z.object({
  emails: z.array(z.string()),
});

export type GetSuppressedEmailsInput = z.infer<
  typeof GetSuppressedEmailsInputSchema
>;

export const GetSuppressedEmailsErrorCode = z.enum([
  "INVALID_INPUT",
  "SUPPRESSION_LOOKUP_FAILED",
]);
export type GetSuppressedEmailsErrorCode = z.infer<
  typeof GetSuppressedEmailsErrorCode
>;

export type GetSuppressedEmailsResult = ServiceResult<
  Set<string>,
  GetSuppressedEmailsErrorCode
>;

export interface GetSuppressedEmailsSpec {
  execute(input: GetSuppressedEmailsInput): Promise<GetSuppressedEmailsResult>;
}
