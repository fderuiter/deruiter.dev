import { createFailure } from "@/lib/services/service-result";
import { validateProjectImage } from "../shared";
import {
  ValidateProjectImageInputSchema,
  type ValidateProjectImageInput,
  type ValidateProjectImageResult,
  type ValidateProjectImageSpec,
} from "./spec";

export interface ValidateProjectImageDeps {
  validator?: typeof validateProjectImage;
}

/**
 * Handler for synchronously validating image payload size, MIME type, and magic bytes.
 */
export class ValidateProjectImageHandler implements ValidateProjectImageSpec {
  private readonly validator: typeof validateProjectImage;

  constructor(deps: ValidateProjectImageDeps = {}) {
    this.validator = deps.validator ?? validateProjectImage;
  }

  execute(input: ValidateProjectImageInput): ValidateProjectImageResult {
    if (!input || !Buffer.isBuffer(input.buffer)) {
      return createFailure(
        "EMPTY_PAYLOAD",
        "Invalid image payload: File is empty or missing."
      );
    }
    const parsed = ValidateProjectImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid image validation input",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      return this.validator(parsed.data.buffer, parsed.data.mimeType);
    } catch (error) {
      return createFailure(
        "MALFORMED_HEADER",
        "Malformed or corrupt image file header.",
        { recoverable: false, details: error }
      );
    }
  }
}
