import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { isPrismaUniqueViolation } from "../shared";
import {
  SubmitCaseStudyFeedbackInputSchema,
  type SubmitCaseStudyFeedbackInput,
  type SubmitCaseStudyFeedbackResult,
  type SubmitCaseStudyFeedbackSpec,
} from "./spec";

export interface CaseStudyFeedbackStoredRow {
  id: string;
  caseStudySlug: string;
  comments: string;
  createdAt: Date | string;
}

export interface SubmitCaseStudyFeedbackPrismaPort {
  findFirst(args: {
    where:
      | { connectionHash: string; operationKey: string }
      | {
          caseStudySlug: string;
          connectionHash: string;
          createdAt: { gte: Date };
        };
  }): Promise<CaseStudyFeedbackStoredRow | null>;
  create(args: {
    data: {
      caseStudySlug: string;
      takeaways: string;
      comments: string;
      connectionHash: string;
      operationKey?: string;
    };
  }): Promise<CaseStudyFeedbackStoredRow>;
}

export interface SubmitCaseStudyFeedbackDeps {
  feedback?: SubmitCaseStudyFeedbackPrismaPort;
}

export class SubmitCaseStudyFeedbackHandler implements SubmitCaseStudyFeedbackSpec {
  private readonly feedback: SubmitCaseStudyFeedbackPrismaPort;

  constructor(deps: SubmitCaseStudyFeedbackDeps = {}) {
    this.feedback =
      deps.feedback ??
      (prisma.caseStudyFeedback as unknown as SubmitCaseStudyFeedbackPrismaPort);
  }

  async execute(
    input: SubmitCaseStudyFeedbackInput
  ): Promise<SubmitCaseStudyFeedbackResult> {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_FEEDBACK_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid feedback submission",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { caseStudySlug, takeaways, comments, connectionHash, operationKey } =
      parsed.data;

    const accepted = (
      row: CaseStudyFeedbackStoredRow,
      replayed: boolean
    ): SubmitCaseStudyFeedbackResult =>
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
        ? this.feedback.findFirst({
            where: { connectionHash, operationKey },
          })
        : Promise.resolve(null);

    try {
      const replay = await findReplay();
      if (replay) return accepted(replay, true);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await this.feedback.findFirst({
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
        const created = await this.feedback.create({
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
        if (operationKey && isPrismaUniqueViolation(createErr)) {
          const winner = await findReplay();
          if (winner) return accepted(winner, true);
        }
        return createFailure(
          "STORAGE_UNAVAILABLE",
          "Case study feedback storage is temporarily unavailable.",
          { recoverable: true, details: createErr }
        );
      }
    } catch (dbErr) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Case study feedback storage is temporarily unavailable.",
        { recoverable: true, details: dbErr }
      );
    }
  }
}
