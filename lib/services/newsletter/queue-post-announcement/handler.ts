import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  QueuePostAnnouncementInputSchema,
  type QueuePostAnnouncementInput,
  type QueuePostAnnouncementResult,
  type QueuePostAnnouncementSpec,
} from "./spec";

export interface NewsletterDispatchUpsertPort {
  upsert(args: {
    where: { blogPostId: string };
    create: { blogPostId: string };
    update: Record<string, never>;
  }): Promise<unknown>;
}

export interface QueuePostAnnouncementDeps {
  dispatches?: NewsletterDispatchUpsertPort;
}

export class QueuePostAnnouncementHandler implements QueuePostAnnouncementSpec {
  private readonly dispatches: NewsletterDispatchUpsertPort;

  constructor(deps: QueuePostAnnouncementDeps = {}) {
    this.dispatches = deps.dispatches ?? prisma.newsletterDispatch;
  }

  async execute(
    input: QueuePostAnnouncementInput
  ): Promise<QueuePostAnnouncementResult> {
    const parsed = QueuePostAnnouncementInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_ANNOUNCEMENT_INPUT",
        parsed.error.issues[0]?.message ?? "Blog post ID is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    try {
      await this.dispatches.upsert({
        where: { blogPostId: parsed.data.blogPostId },
        create: { blogPostId: parsed.data.blogPostId },
        update: {},
      });
      return createSuccess({
        queued: true,
        blogPostId: parsed.data.blogPostId,
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Could not queue newsletter post announcement",
        { recoverable: true, details: error }
      );
    }
  }
}
