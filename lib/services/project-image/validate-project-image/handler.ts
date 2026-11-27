import { createFailure } from "@/lib/services/service-result";
import {
  validateProjectImage,
  type ProjectImageValidationResult,
} from "../shared";
import {
  ValidateProjectImageInputSchema,
  type ValidateProjectImageInput,
  type ValidateProjectImageSpec,
} from "./spec";

export class ValidateProjectImageHandler implements ValidateProjectImageSpec {
  execute(input: ValidateProjectImageInput): ProjectImageValidationResult {
    const parsed = ValidateProjectImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "EMPTY_PAYLOAD",
        "Invalid image payload: File is empty or missing.",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    return validateProjectImage(parsed.data.buffer, parsed.data.mimeType);
  }
}
