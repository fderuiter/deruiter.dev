import { createFailure, createSuccess } from "@/lib/services/service-result";
import { verifySvixSignature } from "../shared";
import {
  VerifySvixSignatureInputSchema,
  type VerifySvixSignatureInput,
  type VerifySvixSignatureResult,
  type VerifySvixSignatureSpec,
} from "./spec";

export interface VerifySvixSignatureDeps {
  verifyFn?: typeof verifySvixSignature;
}

/**
 * Handler for verifying Svix cryptographic signatures on inbound Resend deliverability webhooks.
 */
export class VerifySvixSignatureHandler implements VerifySvixSignatureSpec {
  private readonly verifyFn: typeof verifySvixSignature;

  constructor(deps: VerifySvixSignatureDeps = {}) {
    this.verifyFn = deps.verifyFn ?? verifySvixSignature;
  }

  execute(input: VerifySvixSignatureInput): VerifySvixSignatureResult {
    const parsed = VerifySvixSignatureInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid Svix verification input",
        { recoverable: false, details: parsed.error }
      );
    }

    const { payload, svixId, svixTimestamp, svixSignature, secret } =
      parsed.data;

    if (!svixId || !svixTimestamp || !svixSignature) {
      return createFailure(
        "MISSING_HEADERS",
        "Missing required Svix webhook verification headers",
        { recoverable: false }
      );
    }

    const valid = this.verifyFn({
      payload,
      svixId,
      svixTimestamp,
      svixSignature,
      secret,
    });

    if (!valid) {
      return createFailure(
        "INVALID_SIGNATURE",
        "Invalid Svix webhook signature",
        { recoverable: false }
      );
    }

    return createSuccess({ valid: true });
  }
}
