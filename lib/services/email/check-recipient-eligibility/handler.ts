import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  CheckRecipientEligibilityInputSchema,
  type CheckRecipientEligibilityInput,
  type CheckRecipientEligibilityResult,
  type CheckRecipientEligibilitySpec,
} from "./spec";

export interface CheckRecipientEligibilityDeps {
  db?: {
    suppressionList: {
      findUnique(args: {
        where: { email: string };
      }): Promise<{ reason: string } | null>;
    };
  };
}

/**
 * Handler for checking recipient eligibility against the suppression list (#3806).
 * Failed database lookups return `{ status: "unknown" }` inside a successful envelope so callers never fail open.
 */
export class CheckRecipientEligibilityHandler implements CheckRecipientEligibilitySpec {
  private readonly db: NonNullable<CheckRecipientEligibilityDeps["db"]>;

  constructor(deps: CheckRecipientEligibilityDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: CheckRecipientEligibilityInput
  ): Promise<CheckRecipientEligibilityResult> {
    const parsed = CheckRecipientEligibilityInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid email input",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      const record = await this.db.suppressionList.findUnique({
        where: { email: parsed.data.email.toLowerCase().trim() },
      });
      if (record) {
        return createSuccess({
          status: "suppressed",
          reason: record.reason,
        });
      }
      return createSuccess({ status: "eligible" });
    } catch (err) {
      logger.error(
        "Suppression lookup failed; recipient eligibility unknown:",
        err
      );
      return createSuccess({
        status: "unknown",
        code: "SUPPRESSION_LOOKUP_FAILED",
      });
    }
  }
}
