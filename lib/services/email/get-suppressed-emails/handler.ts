import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "../../service-result";
import {
  GetSuppressedEmailsInputSchema,
  type GetSuppressedEmailsInput,
  type GetSuppressedEmailsResult,
  type GetSuppressedEmailsSpec,
} from "./spec";

export interface GetSuppressedEmailsPrismaPort {
  suppressionList: {
    findMany(args: {
      where: { email: { in: string[] } };
      select: { email: true };
    }): Promise<Array<{ email: string }>>;
  };
}

export interface GetSuppressedEmailsDeps {
  prisma?: GetSuppressedEmailsPrismaPort;
}

export class GetSuppressedEmailsHandler implements GetSuppressedEmailsSpec {
  private readonly db: GetSuppressedEmailsPrismaPort;

  constructor(deps?: GetSuppressedEmailsDeps) {
    this.db = deps?.prisma ?? prisma;
  }

  async execute(
    input: GetSuppressedEmailsInput
  ): Promise<GetSuppressedEmailsResult> {
    const parsed = GetSuppressedEmailsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid email list", {
        recoverable: false,
        details: parsed.error,
      });
    }

    if (parsed.data.emails.length === 0) {
      return createSuccess(new Set<string>());
    }

    const normalized = parsed.data.emails.map((e) => e.toLowerCase().trim());

    try {
      const records = await this.db.suppressionList.findMany({
        where: { email: { in: normalized } },
        select: { email: true },
      });
      return createSuccess(
        new Set(records.map((r) => r.email.toLowerCase().trim()))
      );
    } catch (error) {
      return createFailure(
        "SUPPRESSION_LOOKUP_FAILED",
        error instanceof Error ? error.message : "Suppression lookup failed",
        { recoverable: true, details: error }
      );
    }
  }
}
