import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  UnsubscribeSubscriberInputSchema,
  type UnsubscribeSubscriberInput,
  type UnsubscribeSubscriberResult,
  type UnsubscribeSubscriberSpec,
} from "./spec";

export interface UnsubscribeSubscriberPort {
  findUnique(args: { where: { unsubscribeToken: string } }): Promise<{
    id: string;
    status: string;
  } | null>;
  update(args: {
    where: { id: string };
    data: {
      status: "UNSUBSCRIBED";
      unsubscribedAt: Date;
      confirmationToken: null;
    };
  }): Promise<unknown>;
}

export interface UnsubscribeDeliveryPort {
  findMany(args: {
    where: { subscriberId: string; queueId: { not: null } };
    select: { queueId: true };
  }): Promise<Array<{ queueId: string | null }>>;
}

export interface UnsubscribeQueuePort {
  updateMany(args: {
    where: {
      id: { in: string[] };
      status: { in: Array<"PENDING" | "RETRYING"> };
    };
    data: { status: "FAILED"; lastError: string };
  }): Promise<unknown>;
}

export interface UnsubscribeSubscriberDeps {
  subscribers?: UnsubscribeSubscriberPort;
  deliveries?: UnsubscribeDeliveryPort;
  queue?: UnsubscribeQueuePort;
}

export class UnsubscribeSubscriberHandler implements UnsubscribeSubscriberSpec {
  private readonly subscribers: UnsubscribeSubscriberPort;
  private readonly deliveries: UnsubscribeDeliveryPort;
  private readonly queue: UnsubscribeQueuePort;

  constructor(deps: UnsubscribeSubscriberDeps = {}) {
    this.subscribers = deps.subscribers ?? prisma.newsletterSubscriber;
    this.deliveries = deps.deliveries ?? prisma.newsletterDelivery;
    this.queue = deps.queue ?? prisma.outboundEmailQueue;
  }

  async execute(
    input: UnsubscribeSubscriberInput
  ): Promise<UnsubscribeSubscriberResult> {
    const parsed = UnsubscribeSubscriberInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_TOKEN", "Unsubscribe link is invalid.", {
        recoverable: false,
        details: parsed.error.issues,
      });
    }

    const token = parsed.data.token;
    const now = parsed.data.now ?? new Date();

    try {
      const subscriber = await this.subscribers.findUnique({
        where: { unsubscribeToken: token },
      });
      if (!subscriber) {
        return createFailure("INVALID_TOKEN", "Unsubscribe link is invalid.", {
          recoverable: false,
        });
      }
      if (subscriber.status === "UNSUBSCRIBED") {
        return createSuccess({ outcome: "already_unsubscribed" });
      }

      await this.subscribers.update({
        where: { id: subscriber.id },
        data: {
          status: "UNSUBSCRIBED",
          unsubscribedAt: now,
          confirmationToken: null,
        },
      });

      const queued = await this.deliveries.findMany({
        where: { subscriberId: subscriber.id, queueId: { not: null } },
        select: { queueId: true },
      });
      const queueIds = queued
        .map((d) => d.queueId)
        .filter((id): id is string => typeof id === "string");

      if (queueIds.length > 0) {
        await this.queue.updateMany({
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
        "Newsletter unsubscribe is temporarily unavailable.",
        { recoverable: true, details: error }
      );
    }
  }
}
