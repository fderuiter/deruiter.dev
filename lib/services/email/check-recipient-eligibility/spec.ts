import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import type { RecipientEligibility } from "../shared";

export const CheckRecipientEligibilityInputSchema = z.object({
  recipients: z.union([
    z.string().trim().min(1),
    z.array(z.string().trim().min(1)).min(1),
  ]),
});

export type CheckRecipientEligibilityInput = z.infer<
  typeof CheckRecipientEligibilityInputSchema
>;

export const CheckRecipientEligibilityErrorCode = z.enum(["INVALID_INPUT"]);
export type CheckRecipientEligibilityErrorCode = z.infer<
  typeof CheckRecipientEligibilityErrorCode
>;

export type CheckRecipientEligibilityResult = ServiceResult<
  RecipientEligibility,
  CheckRecipientEligibilityErrorCode
>;

export interface CheckRecipientEligibilitySpec {
  execute(
    input: CheckRecipientEligibilityInput
  ): Promise<CheckRecipientEligibilityResult>;
}
