import { prisma } from "@/lib/db";
import { resolveBaseUrl } from "@/lib/domain";

import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  EMAIL_RETRY_BATCH_SIZE,
  type RawEmailOptions,
} from "../../email/shared";
import {
  EnqueueEmailHandler,
  type EnqueueEmailPrismaPort,
} from "../../email/enqueue-email/handler";
import type { EnqueueEmailResult } from "../../email/enqueue-email/spec";
import { GetSuppressedEmailsHandler } from "../../email/get-suppressed-emails/handler";
import type { GetSuppressedEmailsResult } from "../../email/get-suppressed-emails/spec";
import { QueuePostAnnouncementHandler } from "../queue-post-announcement/handler";
import {
  ANNOUNCE_DISCOVERY_WINDOW_MS,
  listUnsubscribeHeaders,
  NEWSLETTER_DISPATCH_CAP,
  unsubscribeUrl,
  type NewsletterDispatchCounts,
  type NewsletterDispatchResult,
} from "../shared";
import {
  DispatchNewsletterAnnouncementsInputSchema,
  type DispatchNewsletterAnnouncementsInput,
  type DispatchNewsletterAnnouncementsSpec,
} from "./spec";

export interface DispatchDeliveryTransactionClient extends EnqueueEmailPrismaPort {
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

export interface DispatchNewsletterPrismaPort {
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
      where: { status: { in: Array<"PENDING" | "RETRYING"> } };
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
    fn: (tx: DispatchDeliveryTransactionClient) => Promise<T>
  ): Promise<T>;
}

export interface DispatchNewsletterAnnouncementsDeps {
  db?: DispatchNewsletterPrismaPort;
  queuePostAnnouncement?: (blogPostId: string) => Promise<unknown>;
  getSuppressedEmails?: (
    emails: string[]
  ) => Promise<GetSuppressedEmailsResult>;
  enqueueEmail?: (
    options: RawEmailOptions,
    tx?: EnqueueEmailPrismaPort
  ) => Promise<EnqueueEmailResult>;
}

export class DispatchNewsletterAnnouncementsHandler implements DispatchNewsletterAnnouncementsSpec {
  private readonly db: DispatchNewsletterPrismaPort;
  private readonly queuePostAnnouncement: (
    blogPostId: string
  ) => Promise<unknown>;
  private readonly getSuppressedEmails: (
    emails: string[]
  ) => Promise<GetSuppressedEmailsResult>;
  private readonly enqueueEmail: (
    options: RawEmailOptions,
    tx?: EnqueueEmailPrismaPort
  ) => Promise<EnqueueEmailResult>;

  constructor(deps: DispatchNewsletterAnnouncementsDeps = {}) {
    this.db = deps.db ?? (prisma as unknown as DispatchNewsletterPrismaPort);
    const defaultQueueAnnouncement = new QueuePostAnnouncementHandler();
    this.queuePostAnnouncement =
      deps.queuePostAnnouncement ??
      ((blogPostId) => defaultQueueAnnouncement.execute({ blogPostId }));
    const defaultSuppression = new GetSuppressedEmailsHandler();
    this.getSuppressedEmails =
      deps.getSuppressedEmails ??
      ((emails) => defaultSuppression.execute({ emails }));
    const defaultEnqueue = new EnqueueEmailHandler();
    this.enqueueEmail =
      deps.enqueueEmail ??
      ((options, tx) => {
        const handler = tx
          ? new EnqueueEmailHandler({ prisma: tx })
          : defaultEnqueue;
        return handler.execute({ options, mode: "pending" });
      });
  }

  async execute(
    input: DispatchNewsletterAnnouncementsInput = {}
  ): Promise<NewsletterDispatchResult> {
    const parsed = DispatchNewsletterAnnouncementsInputSchema.safeParse(input);
    const now =
      parsed.success && parsed.data.now ? parsed.data.now : new Date();

    try {
      const { renderNewsletterDispatchEmail } =
        await import("@/lib/email-templates");
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
        const queuedRes = await this.queuePostAnnouncement(post.id);
        if (
          queuedRes &&
          typeof queuedRes === "object" &&
          "success" in queuedRes &&
          queuedRes.success === false
        ) {
          return createFailure(
            "DISPATCH_FAILED",
            "Newsletter dispatch phase could not complete",
            { details: queuedRes }
          );
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

        let suppressedEmails: Set<string>;
        try {
          const suppressedResult = await this.getSuppressedEmails(
            recipients.map((r) => r.email)
          );
          if (!suppressedResult.success) {
            return createFailure(
              "DISPATCH_FAILED",
              suppressedResult.error.message,
              {
                details: {
                  dispatchId: dispatch.id,
                  counts,
                  error: suppressedResult.error,
                },
              }
            );
          }
          suppressedEmails = suppressedResult.data;
        } catch (error) {
          return createFailure(
            "DISPATCH_FAILED",
            error instanceof Error
              ? error.message
              : "Suppression lookup failed",
            { details: { dispatchId: dispatch.id, counts, error } }
          );
        }

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
            const txOutcome = await this.db.$transaction(async (tx) => {
              const enqueued = await this.enqueueEmail(
                {
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
                tx
              );
              if (!enqueued.success) {
                return { enqueueFailed: true as const };
              }
              const delivery = await tx.newsletterDelivery.create({
                data: { dispatchId: dispatch.id, subscriberId: subscriber.id },
              });
              await tx.newsletterDelivery.update({
                where: { id: delivery.id },
                data: { queueId: enqueued.data.queueId },
              });
              return { enqueueFailed: false as const };
            });

            if (txOutcome.enqueueFailed) {
              return createFailure(
                "ENQUEUE_FAILED",
                "Could not enqueue a newsletter dispatch email",
                { details: { dispatchId: dispatch.id, counts } }
              );
            }
          } catch (error) {
            return createFailure(
              "DISPATCH_FAILED",
              error instanceof Error
                ? error.message
                : "Dispatch transaction failed",
              { details: { dispatchId: dispatch.id, counts, error } }
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
    } catch (error) {
      return createFailure(
        "DISPATCH_FAILED",
        "Newsletter dispatch phase could not complete",
        { details: error }
      );
    }
  }
}
