import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "../../service-result";
import type { SuppressionReason } from "../shared";
import {
  RecordSuppressionInputSchema,
  type RecordSuppressionInput,
  type RecordSuppressionResult,
  type RecordSuppressionSpec,
} from "./spec";

export interface RecordSuppressionPrismaPort {
  suppressionList: {
    upsert(args: {
      where: { email: string };
      create: { email: string; reason: SuppressionReason };
      update: { reason: SuppressionReason };
    }): Promise<unknown>;
  };
}

export interface RecordSuppressionDeps {
  prisma?: RecordSuppressionPrismaPort;
}

export class RecordSuppressionHandler implements RecordSuppressionSpec {
  private readonly db: RecordSuppressionPrismaPort;

  constructor(deps?: RecordSuppressionDeps) {
    this.db = deps?.prisma ?? prisma;
  }

  async execute(
    input: RecordSuppressionInput
  ): Promise<RecordSuppressionResult> {
    const parsed = RecordSuppressionInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid suppression input", {
        recoverable: false,
        details: parsed.error,
      });
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
