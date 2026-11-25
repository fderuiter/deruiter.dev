import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { isUniqueViolation } from "../shared";
import {
  SubmitCaseStudyFeedbackInputSchema,
  type SubmitCaseStudyFeedbackInput,
  type SubmitCaseStudyFeedbackResult,
  type SubmitCaseStudyFeedbackSpec,
} from "./spec";

export interface FeedbackDbRowLike {
  id: string;
  caseStudySlug: string;
  comments: string;
  createdAt: Date | string;
}

export interface SubmitCaseStudyFeedbackDeps {
  db?: {
    caseStudyFeedback: {
      findFirst(args: {
        where: {
          caseStudySlug?: string;
          connectionHash: string;
          operationKey?: string;
          createdAt?: { gte: Date };
        };
      }): Promise<FeedbackDbRowLike | null>;
      create(args: {
        data: {
          caseStudySlug: string;
          takeaways: string;
          comments: string;
          connectionHash: string;
          operationKey?: string;
        };
      }): Promise<FeedbackDbRowLike>;
    };
  };
  now?: () => number;
}

/**
 * Handler for persisting visitor case study feedback directly to PostgreSQL.
 * Omits ephemeral in-memory Map fallbacks per ADR 0043 so storage outages return `STORAGE_UNAVAILABLE` (HTTP 503) and client offline queues preserve queued items.
 */
export class SubmitCaseStudyFeedbackHandler implements SubmitCaseStudyFeedbackSpec {
  private readonly db: NonNullable<SubmitCaseStudyFeedbackDeps["db"]>;
  private readonly now: () => number;

  constructor(deps: SubmitCaseStudyFeedbackDeps = {}) {
    this.db = deps.db ?? prisma;
    this.now = deps.now ?? Date.now;
  }

  async execute(
    input: SubmitCaseStudyFeedbackInput
  ): Promise<SubmitCaseStudyFeedbackResult> {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid feedback submission",
        { recoverable: false, details: parsed.error }
      );
    }

    const { caseStudySlug, takeaways, comments, connectionHash, operationKey } =
      parsed.data;

    const accepted = (row: FeedbackDbRowLike, replayed: boolean) =>
      createSuccess({
        replayed,
        message: "Feedback submitted successfully",
        feedback: {
          id: row.id,
          caseStudySlug: row.caseStudySlug,
          takeaways,
          comments: row.comments,
          createdAt: row.createdAt,
        },
      });

    const findReplay = () =>
      operationKey
        ? this.db.caseStudyFeedback.findFirst({
            where: { connectionHash, operationKey },
          })
        : Promise.resolve(null);

    try {
      const replay = await findReplay();
      if (replay) return accepted(replay, true);

      const oneHourAgo = new Date(this.now() - 60 * 60 * 1000);
      const existing = await this.db.caseStudyFeedback.findFirst({
        where: {
          caseStudySlug,
          connectionHash,
          createdAt: { gte: oneHourAgo },
        },
      });

      if (existing) {
        return createFailure(
          "RATE_LIMITED",
          "Feedback already submitted for this case study. Please try again later.",
          { recoverable: true }
        );
      }

      try {
        const created = await this.db.caseStudyFeedback.create({
          data: {
            caseStudySlug,
            takeaways: JSON.stringify(takeaways),
            comments,
            connectionHash,
            ...(operationKey ? { operationKey } : {}),
          },
        });
        return accepted(created, false);
      } catch (createErr) {
        if (operationKey && isUniqueViolation(createErr)) {
          const winner = await findReplay();
          if (winner) return accepted(winner, true);
        }
        return createFailure(
          "STORAGE_UNAVAILABLE",
          "Feedback service temporarily unavailable. Please try again.",
          { recoverable: true, details: createErr }
        );
      }
    } catch (dbErr) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Feedback service temporarily unavailable. Please try again.",
        { recoverable: true, details: dbErr }
      );
    }
  }
}
