import { prisma, type OutboundEmailStatus } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  UnsubscribeSubscriberInputSchema,
  type UnsubscribeSubscriberInput,
  type UnsubscribeSubscriberResult,
  type UnsubscribeSubscriberSpec,
} from "./spec";

export interface UnsubscribeSubscriberDeps {
  db?: {
    newsletterSubscriber: {
      findUnique(args: {
        where: { unsubscribeToken: string };
      }): Promise<{ id: string; status: string } | null>;
      update(args: {
        where: { id: string };
        data: {
          status: "UNSUBSCRIBED";
          unsubscribedAt: Date;
          confirmationToken: null;
        };
      }): Promise<unknown>;
    };
    newsletterDelivery: {
      findMany(args: {
        where: { subscriberId: string; queueId: { not: null } };
        select: { queueId: true };
      }): Promise<Array<{ queueId: string | null }>>;
    };
    outboundEmailQueue: {
      updateMany(args: {
        where: {
          id: { in: string[] };
          status: { in: OutboundEmailStatus[] };
        };
        data: { status: "FAILED"; lastError: string };
      }): Promise<unknown>;
    };
  };
}

/**
 * Handler for one-click newsletter unsubscription via long-lived token (RFC 8058).
 * Cancels any pending or retrying announcements queued for the subscriber and returns `STORAGE_UNAVAILABLE` on DB outages.
 */
export class UnsubscribeSubscriberHandler implements UnsubscribeSubscriberSpec {
  private readonly db: NonNullable<UnsubscribeSubscriberDeps["db"]>;

  constructor(deps: UnsubscribeSubscriberDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: UnsubscribeSubscriberInput
  ): Promise<UnsubscribeSubscriberResult> {
    const parsed = UnsubscribeSubscriberInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid unsubscribe token",
        { recoverable: false, details: parsed.error }
      );
    }

    const { token } = parsed.data;
    const now = parsed.data.now ?? new Date();

    try {
      const subscriber = await this.db.newsletterSubscriber.findUnique({
        where: { unsubscribeToken: token },
      });
      if (!subscriber) {
        return createFailure("NOT_FOUND", "Unknown token", {
          recoverable: false,
        });
      }
      if (subscriber.status === "UNSUBSCRIBED") {
        return createSuccess({ outcome: "already_unsubscribed" });
      }

      await this.db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          status: "UNSUBSCRIBED",
          unsubscribedAt: now,
          confirmationToken: null,
        },
      });

      const queued = await this.db.newsletterDelivery.findMany({
        where: { subscriberId: subscriber.id, queueId: { not: null } },
        select: { queueId: true },
      });
      const queueIds = queued
        .map((d) => d.queueId)
        .filter((id): id is string => typeof id === "string");
      if (queueIds.length > 0) {
        await this.db.outboundEmailQueue.updateMany({
          where: {
            id: { in: queueIds },
            status: { in: ["PENDING", "RETRYING"] },
          },
          data: { status: "FAILED", lastError: "Recipient unsubscribed" },
        });
      }

      return createSuccess({ outcome: "unsubscribed" });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Unable to process unsubscribe request right now. Please try again shortly.",
        { recoverable: true, details: error }
      );
    }
  }
}
