import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "../../service-result";
import type { RecipientEligibility } from "../shared";
import {
  CheckRecipientEligibilityInputSchema,
  type CheckRecipientEligibilityInput,
  type CheckRecipientEligibilityResult,
  type CheckRecipientEligibilitySpec,
} from "./spec";

export interface CheckRecipientEligibilityPrismaPort {
  suppressionList: {
    findUnique(args: {
      where: { email: string };
    }): Promise<{ reason: string } | null>;
  };
}

export interface CheckRecipientEligibilityDeps {
  prisma?: CheckRecipientEligibilityPrismaPort;
}

export class CheckRecipientEligibilityHandler implements CheckRecipientEligibilitySpec {
  private readonly db: CheckRecipientEligibilityPrismaPort;

  constructor(deps?: CheckRecipientEligibilityDeps) {
    this.db = deps?.prisma ?? prisma;
  }

  async execute(
    input: CheckRecipientEligibilityInput
  ): Promise<CheckRecipientEligibilityResult> {
    const parsed = CheckRecipientEligibilityInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "At least one recipient email is required",
        { recoverable: false, details: parsed.error }
      );
    }

    const recipients = Array.isArray(parsed.data.recipients)
      ? parsed.data.recipients
      : [parsed.data.recipients];

    let unknown: RecipientEligibility | null = null;

    for (const recipient of recipients) {
      try {
        const record = await this.db.suppressionList.findUnique({
          where: { email: recipient.toLowerCase().trim() },
        });
        if (record) {
          return createSuccess({
            status: "suppressed",
            reason: record.reason,
          });
        }
      } catch (err) {
        logger.error(
          "Suppression lookup failed; recipient eligibility unknown:",
          err
        );
        unknown = { status: "unknown", code: "SUPPRESSION_LOOKUP_FAILED" };
      }
    }

    return createSuccess(unknown ?? { status: "eligible" });
  }
}
