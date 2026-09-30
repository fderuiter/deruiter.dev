import crypto from "crypto";
import { prisma } from "@/lib/db";
import { env, getEnv } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/domain";
import { logger } from "@/lib/logger";
import { clamp } from "@/lib/game-utils";
import { z } from "zod";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";
import {
  renderNewsletterConfirmationEmail,
  renderNewsletterDispatchEmail,
  renderNewsletterWelcomeEmail,
} from "@/lib/email-templates";
import {
  EmailService,
  EMAIL_RETRY_BATCH_SIZE,
  type EmailDispatchResult,
} from "@/lib/services/email-service";

/**
 * Most announcement emails a single maintenance run may enqueue (#841).
 *
 * The daily cron drains the outbound queue at most `EMAIL_RETRY_BATCH_SIZE`
 * (15) messages per run, and the dispatch phase also never enqueues past the
 * queue's remaining room in that batch. Queued mail therefore uses at most 15
 * of Resend's 100 emails a day however many posts are published the same day,
 * newsletter mail at most 10 of those, and at least 85 stay free for contact,
 * feedback and signup mail sent inline.
 */
export const NEWSLETTER_DISPATCH_CAP = 10;

/**
 * Posts published this recently without a dispatch are announced even when
 * they were published outside `BlogPostService` (for example directly in the
 * database). The blog treats `created_at` as the publication date; older posts
 * are never back-announced.
 */
const ANNOUNCE_DISCOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A pending subscriber is re-sent a confirmation at most this often. */
const CONFIRMATION_RESEND_INTERVAL_MS = 60 * 60 * 1000;

/** Result of a signup attempt. Every outcome reads the same to the visitor. */
export interface NewsletterSubscribeResult {
  success: boolean;
  /** Whether a confirmation email was sent (or simulated) for this attempt. */
  confirmationSent: boolean;
  simulated?: boolean;
  error?: string;
}

/** Outcome of following a confirmation or unsubscribe link. */
export type NewsletterTokenOutcome =
  | "confirmed"
  | "already_confirmed"
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid";

/** Counts reported by one dispatch phase run. */
export interface NewsletterDispatchCounts extends Record<string, number> {
  openDispatches: number;
  queued: number;
  skippedSuppressed: number;
  completedDispatches: number;
  capacity: number;
}

/**
 * Error codes returned by {@link NewsletterService.dispatchDue} (ADR 0028).
 *
 * `ENQUEUE_FAILED` means an announcement could not be written to the outbound
 * queue; its delivery claim is released so the next run retries that
 * recipient. `DISPATCH_FAILED` means a database read or write in the phase
 * failed. Either way the dispatch stays open for the next run.
 */
export const NewsletterDispatchErrorCode = z.enum([
  "ENQUEUE_FAILED",
  "DISPATCH_FAILED",
]);
export type NewsletterDispatchErrorCode = z.infer<
  typeof NewsletterDispatchErrorCode
>;

/** Result envelope of {@link NewsletterService.dispatchDue}. */
export type NewsletterDispatchResult = ServiceResult<
  NewsletterDispatchCounts,
  NewsletterDispatchErrorCode
>;

function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function confirmUrl(token: string): string {
  return `${resolveBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

/** One-click unsubscribe URL; also the List-Unsubscribe target (RFC 8058). */
export function unsubscribeUrl(token: string): string {
  return `${resolveBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Headers that let mail clients offer one-click unsubscribe (RFC 2369, 8058). */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Deep module for the Systems Dispatch subscriber lifecycle: double opt-in
 * signup, confirmation, one-click unsubscribe, and the capped announcement
 * phase that the daily maintenance run drives (#841).
 */
export class NewsletterService {
  /**
   * Records a signup as PENDING and sends a confirmation link. Confirmed
   * addresses are left alone and nothing is revealed about whether an address
   * was already subscribed.
   */
  static async subscribe(
    rawEmail: string,
    now: Date = new Date()
  ): Promise<NewsletterSubscribeResult> {
    const email = normalizeEmail(rawEmail);
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing?.status === "CONFIRMED") {
      return { success: true, confirmationSent: false };
    }
    if (
      existing?.status === "PENDING" &&
      existing.confirmationSentAt &&
      now.getTime() - existing.confirmationSentAt.getTime() <
        CONFIRMATION_RESEND_INTERVAL_MS
    ) {
      // Throttle re-sends so the form cannot be used to flood an inbox or
      // spend the daily Resend allowance.
      return { success: true, confirmationSent: false };
    }

    const confirmationToken = newToken();
    if (existing) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          confirmationToken,
          confirmationSentAt: now,
          unsubscribedAt: null,
        },
      });
    } else {
      await prisma.newsletterSubscriber.create({
        data: {
          email,
          status: "PENDING",
          confirmationToken,
          confirmationSentAt: now,
          unsubscribeToken: newToken(),
        },
      });
    }

    const template = renderNewsletterConfirmationEmail({
      email,
      confirmUrl: confirmUrl(confirmationToken),
    });
    const sent: EmailDispatchResult = await EmailService.sendRawEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "category", value: "newsletter-confirmation" }],
    });
    if (!sent.success) {
      return { success: false, confirmationSent: false, error: sent.error };
    }
    return { success: true, confirmationSent: true, simulated: sent.simulated };
  }

  /**
   * Confirms a PENDING subscriber from its single-use token, then sends the
   * welcome email and the admin alert.
   */
  static async confirm(
    token: string,
    now: Date = new Date()
  ): Promise<NewsletterTokenOutcome> {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { confirmationToken: token },
    });
    if (!subscriber) return "invalid";
    if (subscriber.status === "CONFIRMED") return "already_confirmed";

    const updated = await prisma.newsletterSubscriber.updateMany({
      where: { id: subscriber.id, confirmationToken: token },
      data: {
        status: "CONFIRMED",
        confirmedAt: now,
        confirmationToken: null,
        unsubscribedAt: null,
      },
    });
    if (updated.count !== 1) return "invalid";

    const welcome = renderNewsletterWelcomeEmail({
      email: subscriber.email,
      unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
    });
    await EmailService.sendRawEmail({
      to: subscriber.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
      headers: listUnsubscribeHeaders(subscriber.unsubscribeToken),
      tags: [{ name: "category", value: "newsletter-welcome" }],
    });

    const adminEmail =
      getEnv().CONTACT_NOTIFICATION_EMAIL || env.CONTACT_NOTIFICATION_EMAIL;
    if (adminEmail) {
      await EmailService.sendRawEmail({
        to: adminEmail,
        subject: "[Newsletter] Subscriber confirmed",
        html: "<p>A Systems Dispatch subscriber confirmed their address.</p>",
        text: "A Systems Dispatch subscriber confirmed their address.",
        tags: [{ name: "category", value: "newsletter-admin-alert" }],
      });
    }
    return "confirmed";
  }

  /**
   * Unsubscribes from the long-lived token in every dispatch. Works without
   * signing in and needs no second step.
   */
  static async unsubscribe(
    token: string,
    now: Date = new Date()
  ): Promise<NewsletterTokenOutcome> {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!subscriber) return "invalid";
    if (subscriber.status === "UNSUBSCRIBED") return "already_unsubscribed";

    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: now,
        confirmationToken: null,
      },
    });

    // Announcements already queued for this address must not go out either.
    const queued = await prisma.newsletterDelivery.findMany({
      where: { subscriberId: subscriber.id, queueId: { not: null } },
      select: { queueId: true },
    });
    const queueIds = queued
      .map((d) => d.queueId)
      .filter((id): id is string => typeof id === "string");
    if (queueIds.length > 0) {
      await prisma.outboundEmailQueue.updateMany({
        where: {
          id: { in: queueIds },
          status: { in: ["PENDING", "RETRYING"] },
        },
        data: { status: "FAILED", lastError: "Recipient unsubscribed" },
      });
    }
    return "unsubscribed";
  }

  /**
   * Records that a newly published post should be announced. Idempotent:
   * republishing a post never announces it twice. Nothing is sent here; the
   * daily maintenance run drains dispatches under the cap.
   */
  static async queuePostAnnouncement(blogPostId: string): Promise<void> {
    await prisma.newsletterDispatch.upsert({
      where: { blogPostId },
      create: { blogPostId },
      update: {},
    });
  }

  /**
   * Maintenance phase: enqueues announcement emails for open dispatches into
   * the outbound queue, oldest dispatch first. Only subscribers who were
   * CONFIRMED when the post was queued receive it, the suppression list is
   * rechecked for every recipient, and no run enqueues more than
   * `NEWSLETTER_DISPATCH_CAP` or the queue's remaining room in one batch.
   *
   * Never throws: failures are returned as a typed
   * {@link NewsletterDispatchErrorCode}.
   */
  static async dispatchDue(
    now: Date = new Date()
  ): Promise<NewsletterDispatchResult> {
    try {
      return await NewsletterService.runDispatch(now);
    } catch (error) {
      return createFailure(
        "DISPATCH_FAILED",
        "Newsletter dispatch phase could not complete",
        { details: error }
      );
    }
  }

  /** Body of {@link NewsletterService.dispatchDue}, which catches its database errors. */
  private static async runDispatch(
    now: Date
  ): Promise<NewsletterDispatchResult> {
    const unannounced = await prisma.blogPost.findMany({
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
      await NewsletterService.queuePostAnnouncement(post.id);
    }

    const pendingInQueue = await prisma.outboundEmailQueue.count({
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

    const dispatches = await prisma.newsletterDispatch.findMany({
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
      // A post unpublished after it was queued is not announced.
      if (!dispatch.blogPost.published) {
        await prisma.newsletterDispatch.update({
          where: { id: dispatch.id },
          data: { completedAt: now },
        });
        counts.completedDispatches++;
        continue;
      }
      if (remaining <= 0) break;

      const recipients = await prisma.newsletterSubscriber.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: { lte: dispatch.createdAt },
          deliveries: { none: { dispatchId: dispatch.id } },
        },
        orderBy: { confirmedAt: "asc" },
        take: remaining,
      });

      for (const subscriber of recipients) {
        const suppressed = await EmailService.isSuppressed(subscriber.email);
        if (suppressed.suppressed) {
          // Recorded so the dispatch can complete, but nothing is sent.
          await prisma.newsletterDelivery.create({
            data: { dispatchId: dispatch.id, subscriberId: subscriber.id },
          });
          counts.skippedSuppressed++;
          continue;
        }

        const template = renderNewsletterDispatchEmail({
          title: dispatch.blogPost.title,
          dek: dispatch.blogPost.dek,
          postUrl: `${resolveBaseUrl()}/blog/${dispatch.blogPost.slug}`,
          unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
        });
        // Claim the pair first: the unique (dispatch, subscriber) key makes a
        // concurrent or replayed run fail here instead of sending twice.
        const delivery = await prisma.newsletterDelivery.create({
          data: { dispatchId: dispatch.id, subscriberId: subscriber.id },
        });
        const queueId = await EmailService.enqueueEmail({
          to: subscriber.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          headers: listUnsubscribeHeaders(subscriber.unsubscribeToken),
          tags: [
            { name: "category", value: "newsletter-dispatch" },
            { name: "dispatch", value: dispatch.id },
          ],
        });
        if (!queueId) {
          // Release the claim so the next run retries this recipient.
          await prisma.newsletterDelivery.delete({
            where: { id: delivery.id },
          });
          return createFailure(
            "ENQUEUE_FAILED",
            "Could not enqueue a newsletter dispatch email",
            { details: { dispatchId: dispatch.id, counts } }
          );
        }
        await prisma.newsletterDelivery.update({
          where: { id: delivery.id },
          data: { queueId },
        });
        counts.queued++;
        remaining--;
      }

      const outstanding = await prisma.newsletterSubscriber.count({
        where: {
          status: "CONFIRMED",
          confirmedAt: { lte: dispatch.createdAt },
          deliveries: { none: { dispatchId: dispatch.id } },
        },
      });
      if (outstanding === 0) {
        await prisma.newsletterDispatch.update({
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
