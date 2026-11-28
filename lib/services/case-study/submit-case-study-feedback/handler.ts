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

export interface VolatileCaseStudyFeedbackEntry extends CaseStudyFeedbackStoredRow {
  takeaways: string[];
  connectionHash: string;
  operationKey?: string;
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
  fallbackStore?: Map<string, VolatileCaseStudyFeedbackEntry[]>;
}

export class SubmitCaseStudyFeedbackHandler implements SubmitCaseStudyFeedbackSpec {
  private readonly feedback: SubmitCaseStudyFeedbackPrismaPort;
  private readonly fallbackStore?: Map<
    string,
    VolatileCaseStudyFeedbackEntry[]
  >;

  constructor(deps: SubmitCaseStudyFeedbackDeps = {}) {
    this.feedback =
      deps.feedback ??
      (prisma.caseStudyFeedback as unknown as SubmitCaseStudyFeedbackPrismaPort);
    this.fallbackStore = deps.fallbackStore;
  }

  private submitToVolatileFallback(input: {
    caseStudySlug: string;
    takeaways: string[];
    comments: string;
    connectionHash: string;
    operationKey?: string;
  }): SubmitCaseStudyFeedbackResult | null {
    if (!this.fallbackStore) {
      return null;
    }

    const { caseStudySlug, takeaways, comments, connectionHash, operationKey } =
      input;
    const entries = this.fallbackStore.get(caseStudySlug) ?? [];

    if (operationKey) {
      for (const bucket of this.fallbackStore.values()) {
        const replayedEntry = bucket.find(
          (item) =>
            item.connectionHash === connectionHash &&
            item.operationKey === operationKey
        );
        if (replayedEntry) {
          return createSuccess({
            durable: false,
            replayed: true,
            message: "Feedback accepted into volatile fallback",
            feedback: {
              id: replayedEntry.id,
              caseStudySlug: replayedEntry.caseStudySlug,
              takeaways: replayedEntry.takeaways,
              comments: replayedEntry.comments,
              createdAt: replayedEntry.createdAt,
            },
          });
        }
      }
    }

    const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
    const duplicate = entries.find(
      (item) =>
        item.connectionHash === connectionHash &&
        new Date(item.createdAt).getTime() >= oneHourAgoMs
    );
    if (duplicate) {
      return createFailure(
        "RATE_LIMITED",
        "Feedback already submitted for this case study. Please try again later.",
        { recoverable: true }
      );
    }

    const volatileRow: VolatileCaseStudyFeedbackEntry = {
      id: `mem_fb_${crypto.randomUUID()}`,
      caseStudySlug,
      takeaways,
      comments,
      connectionHash,
      ...(operationKey ? { operationKey } : {}),
      createdAt: new Date().toISOString(),
    };
    this.fallbackStore.set(caseStudySlug, [...entries, volatileRow]);

    return createSuccess({
      durable: false,
      replayed: false,
      message: "Feedback accepted into volatile fallback",
      feedback: {
        id: volatileRow.id,
        caseStudySlug: volatileRow.caseStudySlug,
        takeaways: volatileRow.takeaways,
        comments: volatileRow.comments,
        createdAt: volatileRow.createdAt,
      },
    });
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
        durable: true,
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
        const fallbackResult = this.submitToVolatileFallback({
          caseStudySlug,
          takeaways,
          comments,
          connectionHash,
          operationKey,
        });
        if (fallbackResult) return fallbackResult;
        return createFailure(
          "STORAGE_UNAVAILABLE",
          "Case study feedback storage is temporarily unavailable.",
          { recoverable: true, details: createErr }
        );
      }
    } catch (dbErr) {
      const fallbackResult = this.submitToVolatileFallback({
        caseStudySlug,
        takeaways,
        comments,
        connectionHash,
        operationKey,
      });
      if (fallbackResult) return fallbackResult;
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Case study feedback storage is temporarily unavailable.",
        { recoverable: true, details: dbErr }
      );
    }
  }
}
