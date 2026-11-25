import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  GetCaseStudyFeedbackInputSchema,
  type GetCaseStudyFeedbackInput,
  type GetCaseStudyFeedbackResult,
  type GetCaseStudyFeedbackSpec,
} from "./spec";

export interface GetCaseStudyFeedbackDeps {
  db?: {
    caseStudyFeedback: {
      findMany(args: {
        where: { caseStudySlug: string };
        select: {
          id: true;
          takeaways: true;
          comments: true;
          createdAt: true;
          connectionHash: true;
        };
        orderBy: { createdAt: "desc" };
        take: number;
      }): Promise<
        Array<{
          id: string;
          takeaways: string;
          comments: string;
          createdAt: Date | string;
          connectionHash: string;
        }>
      >;
    };
  };
}

/**
 * Handler for retrieving persisted visitor feedback for a case study without ephemeral in-memory fallbacks.
 */
export class GetCaseStudyFeedbackHandler implements GetCaseStudyFeedbackSpec {
  private readonly db: NonNullable<GetCaseStudyFeedbackDeps["db"]>;

  constructor(deps: GetCaseStudyFeedbackDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetCaseStudyFeedbackInput
  ): Promise<GetCaseStudyFeedbackResult> {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid feedback query input",
        { recoverable: false, details: parsed.error }
      );
    }

    const { caseStudySlug, connectionHash } = parsed.data;

    try {
      const feedbackList = await this.db.caseStudyFeedback.findMany({
        where: { caseStudySlug },
        select: {
          id: true,
          takeaways: true,
          comments: true,
          createdAt: true,
          connectionHash: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const hasSubmitted = feedbackList.some(
        (f) => f.connectionHash === connectionHash
      );

      return createSuccess({
        caseStudySlug,
        hasSubmitted,
        totalFeedback: feedbackList.length,
        feedback: feedbackList.map((f) => ({
          id: f.id,
          takeaways: JSON.parse(f.takeaways || "[]") as string[],
          comments: f.comments,
          createdAt: f.createdAt,
        })),
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("Failed to query case study feedback:", err);
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to query case study feedback",
        { recoverable: true, details: err }
      );
    }
  }
}
