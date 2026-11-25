import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { RecipientEligibility } from "../shared";

export const CheckRecipientEligibilityInputSchema = z.object({
  email: z.string().min(1, "Email is required"),
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
