import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  QueuePostAnnouncementInputSchema,
  type QueuePostAnnouncementInput,
  type QueuePostAnnouncementResult,
  type QueuePostAnnouncementSpec,
} from "./spec";

export interface QueuePostAnnouncementDeps {
  db?: {
    newsletterDispatch: {
      upsert(args: {
        where: { blogPostId: string };
        create: { blogPostId: string };
        update: Record<string, never>;
      }): Promise<unknown>;
    };
  };
}

/**
 * Handler for idempotently recording that a newly published blog post should be announced in the daily Systems Dispatch (#841).
 */
export class QueuePostAnnouncementHandler implements QueuePostAnnouncementSpec {
  private readonly db: NonNullable<QueuePostAnnouncementDeps["db"]>;

  constructor(deps: QueuePostAnnouncementDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: QueuePostAnnouncementInput
  ): Promise<QueuePostAnnouncementResult> {
    const parsed = QueuePostAnnouncementInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post ID",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      await this.db.newsletterDispatch.upsert({
        where: { blogPostId: parsed.data.blogPostId },
        create: { blogPostId: parsed.data.blogPostId },
        update: {},
      });
      return createSuccess({ blogPostId: parsed.data.blogPostId });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to queue newsletter post announcement",
        { recoverable: true, details: error }
      );
    }
  }
}
