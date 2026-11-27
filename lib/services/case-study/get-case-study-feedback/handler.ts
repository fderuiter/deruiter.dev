import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  GetCaseStudyFeedbackInputSchema,
  type GetCaseStudyFeedbackInput,
  type GetCaseStudyFeedbackResult,
  type GetCaseStudyFeedbackSpec,
} from "./spec";

export interface GetCaseStudyFeedbackPrismaPort {
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
    take: 20;
  }): Promise<
    Array<{
      id: string;
      takeaways: string;
      comments: string;
      createdAt: Date | string;
      connectionHash: string;
    }>
  >;
}

export interface GetCaseStudyFeedbackDeps {
  feedback?: GetCaseStudyFeedbackPrismaPort;
}

function safeParseTakeaways(raw: string): unknown {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export class GetCaseStudyFeedbackHandler implements GetCaseStudyFeedbackSpec {
  private readonly feedback: GetCaseStudyFeedbackPrismaPort;

  constructor(deps: GetCaseStudyFeedbackDeps = {}) {
    this.feedback = deps.feedback ?? prisma.caseStudyFeedback;
  }

  async execute(
    input: GetCaseStudyFeedbackInput
  ): Promise<GetCaseStudyFeedbackResult> {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_FEEDBACK_QUERY",
        parsed.error.issues[0]?.message ?? "Invalid feedback query",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug, connectionHash } = parsed.data;

    try {
      const feedbackList = await this.feedback.findMany({
        where: { caseStudySlug: slug },
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
        caseStudySlug: slug,
        hasSubmitted,
        totalFeedback: feedbackList.length,
        feedback: feedbackList.map((f) => ({
          id: f.id,
          takeaways: safeParseTakeaways(f.takeaways),
          comments: f.comments,
          createdAt: f.createdAt,
        })),
      });
    } catch (err) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Case study feedback storage is temporarily unavailable.",
        { recoverable: true, details: err }
      );
    }
  }
}
