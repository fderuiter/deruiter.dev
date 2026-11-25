import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  GetSuppressedEmailsInputSchema,
  type GetSuppressedEmailsInput,
  type GetSuppressedEmailsResult,
  type GetSuppressedEmailsSpec,
} from "./spec";

export interface GetSuppressedEmailsDeps {
  db?: {
    suppressionList: {
      findMany(args: {
        where: { email: { in: string[] } };
        select: { email: true };
      }): Promise<Array<{ email: string }>>;
    };
  };
}

/**
 * Handler for querying suppressed email addresses in batch without failing open (#3806).
 * Returns `STORAGE_UNAVAILABLE` when PostgreSQL fails so callers abort dispatch safely.
 */
export class GetSuppressedEmailsHandler implements GetSuppressedEmailsSpec {
  private readonly db: NonNullable<GetSuppressedEmailsDeps["db"]>;

  constructor(deps: GetSuppressedEmailsDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetSuppressedEmailsInput
  ): Promise<GetSuppressedEmailsResult> {
    const parsed = GetSuppressedEmailsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid email list",
        { recoverable: false, details: parsed.error }
      );
    }

    if (parsed.data.emails.length === 0) {
      return createSuccess(new Set());
    }

    try {
      const normalized = parsed.data.emails.map((e) => e.toLowerCase().trim());
      const records = await this.db.suppressionList.findMany({
        where: { email: { in: normalized } },
        select: { email: true },
      });
      return createSuccess(
        new Set(records.map((r) => r.email.toLowerCase().trim()))
      );
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        error instanceof Error ? error.message : "Suppression lookup failed",
        { recoverable: true, details: error }
      );
    }
  }
}
