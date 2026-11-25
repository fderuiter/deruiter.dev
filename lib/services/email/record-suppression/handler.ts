import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { SuppressionReason } from "../shared";
import {
  RecordEmailSuppressionInputSchema,
  type RecordEmailSuppressionInput,
  type RecordEmailSuppressionResult,
  type RecordEmailSuppressionSpec,
} from "./spec";

export interface RecordEmailSuppressionDeps {
  db?: {
    suppressionList: {
      upsert(args: {
        where: { email: string };
        create: { email: string; reason: SuppressionReason };
        update: { reason: SuppressionReason };
      }): Promise<unknown>;
    };
  };
}

/**
 * Handler for idempotently recording an email address in the suppression list.
 * Returns `STORAGE_UNAVAILABLE` on database write failure so webhook callers return non-2xx for provider redelivery.
 */
export class RecordEmailSuppressionHandler implements RecordEmailSuppressionSpec {
  private readonly db: NonNullable<RecordEmailSuppressionDeps["db"]>;

  constructor(deps: RecordEmailSuppressionDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: RecordEmailSuppressionInput
  ): Promise<RecordEmailSuppressionResult> {
    const parsed = RecordEmailSuppressionInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid suppression input",
        { recoverable: false, details: parsed.error }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const reason = parsed.data.reason as SuppressionReason;

    try {
      await this.db.suppressionList.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail, reason },
        update: { reason },
      });
      return createSuccess({ email: normalizedEmail, reason });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to record email suppression",
        { recoverable: true, details: error }
      );
    }
  }
}
