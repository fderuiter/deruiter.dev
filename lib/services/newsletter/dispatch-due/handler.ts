import { prisma, type OutboundEmailStatus } from "@/lib/db";
import { resolveBaseUrl } from "@/lib/domain";
import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { EnqueueEmailHandler } from "@/lib/services/email/enqueue-email/handler";
import type {
  EnqueueEmailSpec,
  OutboundEmailQueueWriterLike,
} from "@/lib/services/email/enqueue-email/spec";
import { GetSuppressedEmailsHandler } from "@/lib/services/email/get-suppressed-emails/handler";
import type { GetSuppressedEmailsSpec } from "@/lib/services/email/get-suppressed-emails/spec";
import { EMAIL_RETRY_BATCH_SIZE } from "@/lib/services/email/shared";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { QueuePostAnnouncementHandler } from "../queue-post-announcement/handler";
import type { QueuePostAnnouncementSpec } from "../queue-post-announcement/spec";
import {
  ANNOUNCE_DISCOVERY_WINDOW_MS,
  listUnsubscribeHeaders,
  NEWSLETTER_DISPATCH_CAP,
  unsubscribeUrl,
  type NewsletterDispatchCounts,
  type NewsletterDispatchResult,
} from "../shared";
import {
  DispatchDueNewsletterInputSchema,
  type DispatchDueNewsletterInput,
  type DispatchDueNewsletterSpec,
} from "./spec";

const ENQUEUE_ROLLBACK_SENTINEL = new Error("ENQUEUE_ROLLBACK_SENTINEL");

export interface NewsletterDispatchTxClient extends OutboundEmailQueueWriterLike {
  newsletterDelivery: {
    create(args: {
      data: { dispatchId: string; subscriberId: string };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: { queueId: string };
    }): Promise<unknown>;
  };
}

export interface DispatchDueNewsletterDeps {
  db?: {
    blogPost: {
      findMany(args: {
        where: {
          published: true;
          created_at: { gte: Date };
          newsletterDispatch: { is: null };
        };
        select: { id: true };
      }): Promise<Array<{ id: string }>>;
    };
    outboundEmailQueue: {
      count(args: {
        where: { status: { in: OutboundEmailStatus[] } };
      }): Promise<number>;
    };
    newsletterDispatch: {
      findMany(args: {
        where: { completedAt: null };
        orderBy: { createdAt: "asc" };
        include: {
          blogPost: {
            select: { title: true; dek: true; slug: true; published: true };
          };
        };
      }): Promise<
        Array<{
          id: string;
          createdAt: Date;
          blogPost: {
            title: string;
            dek: string;
            slug: string;
            published: boolean;
          };
        }>
      >;
      update(args: {
        where: { id: string };
        data: { completedAt: Date };
      }): Promise<unknown>;
    };
    newsletterSubscriber: {
      findMany(args: {
        where: {
          status: "CONFIRMED";
          confirmedAt: { lte: Date };
          deliveries: { none: { dispatchId: string } };
        };
        orderBy: { confirmedAt: "asc" };
        take: number;
      }): Promise<
        Array<{
          id: string;
          email: string;
          unsubscribeToken: string;
        }>
      >;
      count(args: {
        where: {
          status: "CONFIRMED";
          confirmedAt: { lte: Date };
          deliveries: { none: { dispatchId: string } };
        };
      }): Promise<number>;
    };
    newsletterDelivery: {
      createMany(args: {
        data: Array<{ dispatchId: string; subscriberId: string }>;
        skipDuplicates: boolean;
      }): Promise<unknown>;
    };
    $transaction<T>(
      fn: (tx: NewsletterDispatchTxClient) => Promise<T>
    ): Promise<T>;
  };
  queueAnnouncementHandler?: QueuePostAnnouncementSpec;
  getSuppressedEmailsHandler?: GetSuppressedEmailsSpec;
  enqueueEmailHandler?: EnqueueEmailSpec;
}

/**
 * Handler for the daily maintenance newsletter announcement phase (#841).
 * Enqueues capped announcements transactionally per recipient and aborts safely if suppression lookup fails (#3806).
 */
export class DispatchDueNewsletterHandler implements DispatchDueNewsletterSpec {
  private readonly db: NonNullable<DispatchDueNewsletterDeps["db"]>;
  private readonly queueAnnouncementHandler: QueuePostAnnouncementSpec;
  private readonly getSuppressedEmailsHandler: GetSuppressedEmailsSpec;
  private readonly enqueueEmailHandler: EnqueueEmailSpec;

  constructor(deps: DispatchDueNewsletterDeps = {}) {
    this.db = deps.db ?? prisma;
    this.queueAnnouncementHandler =
      deps.queueAnnouncementHandler ?? new QueuePostAnnouncementHandler();
    this.getSuppressedEmailsHandler =
      deps.getSuppressedEmailsHandler ?? new GetSuppressedEmailsHandler();
    this.enqueueEmailHandler =
      deps.enqueueEmailHandler ?? new EnqueueEmailHandler();
  }

  async execute(
    input: DispatchDueNewsletterInput = {}
  ): Promise<NewsletterDispatchResult> {
    const parsed = DispatchDueNewsletterInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid newsletter dispatch input",
        { recoverable: false, details: parsed.error }
      );
    }

    const now = parsed.data.now ?? new Date();

    try {
      return await this.runDispatch(now);
    } catch (error) {
      return createFailure(
        "DISPATCH_FAILED",
        "Newsletter dispatch phase could not complete",
        { recoverable: true, details: error }
      );
    }
  }

  private async runDispatch(now: Date): Promise<NewsletterDispatchResult> {
    const unannounced = await this.db.blogPost.findMany({
      where: {
        published: true,
        created_at: {
          gte: new Date(now.getTime() - ANNOUNCE_DISCOVERY_WINDOW_MS),
        },
        newsletterDispatch: { is: null },
      },
      select: { id: true },
    });

    for (const post of unannounced) {
      const queuedPost = await this.queueAnnouncementHandler.execute({
        blogPostId: post.id,
      });
      if (!queuedPost.success) {
        return createFailure("DISPATCH_FAILED", queuedPost.error.message, {
          recoverable: true,
          details: queuedPost.error.details,
        });
      }
    }

    const pendingInQueue = await this.db.outboundEmailQueue.count({
      where: { status: { in: ["PENDING", "RETRYING"] } },
    });
    const capacity = clamp(
      EMAIL_RETRY_BATCH_SIZE - pendingInQueue,
      0,
      NEWSLETTER_DISPATCH_CAP
    );
    const counts: NewsletterDispatchCounts = {
      openDispatches: 0,
      queued: 0,
      skippedSuppressed: 0,
      completedDispatches: 0,
      capacity,
    };

    const dispatches = await this.db.newsletterDispatch.findMany({
      where: { completedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        blogPost: {
          select: { title: true, dek: true, slug: true, published: true },
        },
      },
    });
    counts.openDispatches = dispatches.length;

    const { renderNewsletterDispatchEmail } =
      await import("@/lib/email-templates");

    let remaining = capacity;
    for (const dispatch of dispatches) {
      if (!dispatch.blogPost.published) {
        await this.db.newsletterDispatch.update({
          where: { id: dispatch.id },
          data: { completedAt: now },
        });
        counts.completedDispatches++;
        continue;
      }
      if (remaining <= 0) break;

      const recipients = await this.db.newsletterSubscriber.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: { lte: dispatch.createdAt },
          deliveries: { none: { dispatchId: dispatch.id } },
        },
        orderBy: { confirmedAt: "asc" },
        take: remaining,
      });

      const suppressedRes = await this.getSuppressedEmailsHandler.execute({
        emails: recipients.map((r) => r.email),
      });
      if (!suppressedRes.success) {
        return createFailure(
          "DISPATCH_FAILED",
          suppressedRes.error.message || "Suppression lookup failed",
          {
            recoverable: true,
            details: {
              dispatchId: dispatch.id,
              counts,
              error: suppressedRes.error.details,
            },
          }
        );
      }

      const suppressedEmails = suppressedRes.data;
      const suppressedRecipients = recipients.filter((subscriber) =>
        suppressedEmails.has(subscriber.email.toLowerCase().trim())
      );
      const eligibleRecipients = recipients.filter(
        (subscriber) =>
          !suppressedEmails.has(subscriber.email.toLowerCase().trim())
      );

      if (suppressedRecipients.length > 0) {
        await this.db.newsletterDelivery.createMany({
          data: suppressedRecipients.map((subscriber) => ({
            dispatchId: dispatch.id,
            subscriberId: subscriber.id,
          })),
          skipDuplicates: true,
        });
        counts.skippedSuppressed += suppressedRecipients.length;
      }

      for (const subscriber of eligibleRecipients) {
        if (remaining <= 0) break;

        const template = renderNewsletterDispatchEmail({
          title: dispatch.blogPost.title,
          dek: dispatch.blogPost.dek,
          postUrl: `${resolveBaseUrl()}/blog/${dispatch.blogPost.slug}`,
          unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
        });

        try {
          await this.db.$transaction(async (tx) => {
            const delivery = await tx.newsletterDelivery.create({
              data: { dispatchId: dispatch.id, subscriberId: subscriber.id },
            });
            const enqueueRes = await this.enqueueEmailHandler.execute({
              options: {
                to: subscriber.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                headers: listUnsubscribeHeaders(subscriber.unsubscribeToken),
                tags: [
                  { name: "category", value: "newsletter-dispatch" },
                  { name: "dispatch", value: dispatch.id },
                ],
              },
              client: tx,
            });
            if (!enqueueRes.success) {
              return Promise.reject(ENQUEUE_ROLLBACK_SENTINEL);
            }
            await tx.newsletterDelivery.update({
              where: { id: delivery.id },
              data: { queueId: enqueueRes.data.queueId },
            });
          });
        } catch (error) {
          if (error === ENQUEUE_ROLLBACK_SENTINEL) {
            return createFailure(
              "ENQUEUE_FAILED",
              "Could not enqueue a newsletter dispatch email",
              {
                recoverable: true,
                details: { dispatchId: dispatch.id, counts },
              }
            );
          }
          return createFailure(
            "DISPATCH_FAILED",
            error instanceof Error
              ? error.message
              : "Dispatch transaction failed",
            {
              recoverable: true,
              details: { dispatchId: dispatch.id, counts, error },
            }
          );
        }

        counts.queued++;
        remaining--;
      }

      const outstanding = await this.db.newsletterSubscriber.count({
        where: {
          status: "CONFIRMED",
          confirmedAt: { lte: dispatch.createdAt },
          deliveries: { none: { dispatchId: dispatch.id } },
        },
      });
      if (outstanding === 0) {
        await this.db.newsletterDispatch.update({
          where: { id: dispatch.id },
          data: { completedAt: now },
        });
        counts.completedDispatches++;
      }
    }

    if (counts.queued > 0) {
      logger.info(
        `[newsletter] Queued ${counts.queued} dispatch email(s); capacity ${capacity}.`
      );
    }
    return createSuccess(counts);
  }
}
