import { prisma } from "@/lib/db";
import { clamp } from "@/lib/game-utils";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { NullQueueAuditResult, NullQueueDeliveriesAudit } from "../shared";
import {
  AuditNullQueueDeliveriesInputSchema,
  type AuditNullQueueDeliveriesInput,
  type AuditNullQueueDeliveriesSpec,
} from "./spec";

export interface AuditNullQueuePrismaPort {
  newsletterDelivery: {
    findMany(args: {
      where: { queueId: null };
      include: { subscriber: true };
      orderBy: { createdAt: "asc" };
      skip: number;
      take: number;
    }): Promise<
      Array<{
        id: string;
        dispatchId: string;
        subscriberId: string;
        subscriber: { email: string };
      }>
    >;
    count(args: { where: { queueId: null } }): Promise<number>;
  };
  suppressionList: {
    findMany(args: {
      where: { email: { in: string[] } };
    }): Promise<Array<{ email: string; reason: string }>>;
  };
}

export interface AuditNullQueueDeliveriesDeps {
  db?: AuditNullQueuePrismaPort;
}

export class AuditNullQueueDeliveriesHandler implements AuditNullQueueDeliveriesSpec {
  private readonly db: AuditNullQueuePrismaPort;

  constructor(deps: AuditNullQueueDeliveriesDeps = {}) {
    this.db = deps.db ?? (prisma as unknown as AuditNullQueuePrismaPort);
  }

  async execute(
    input: AuditNullQueueDeliveriesInput = {}
  ): Promise<NullQueueAuditResult> {
    const parsed = AuditNullQueueDeliveriesInputSchema.safeParse(input);
    const opts = parsed.success ? parsed.data : {};

    try {
      const page = clamp(opts.page ?? 1, 1, Number.MAX_SAFE_INTEGER);
      const pageSize = clamp(opts.pageSize ?? 100, 1, 500);
      const skip = (page - 1) * pageSize;

      const [nullDeliveries, totalNullQueue] = await Promise.all([
        this.db.newsletterDelivery.findMany({
          where: { queueId: null },
          include: { subscriber: true },
          orderBy: { createdAt: "asc" },
          skip,
          take: pageSize,
        }),
        this.db.newsletterDelivery.count({
          where: { queueId: null },
        }),
      ]);

      const intentionalSkips: NullQueueDeliveriesAudit["intentionalSkips"] = [];
      const orphanedClaims: NullQueueDeliveriesAudit["orphanedClaims"] = [];

      if (nullDeliveries.length === 0) {
        return createSuccess({
          totalNullQueue,
          page,
          pageSize,
          intentionalSkips,
          orphanedClaims,
        });
      }

      const emails = [
        ...new Set(
          nullDeliveries.map((d) => d.subscriber.email.toLowerCase().trim())
        ),
      ];
      const suppressions = await this.db.suppressionList.findMany({
        where: { email: { in: emails } },
      });
      const suppressionMap = new Map(
        suppressions.map((s) => [s.email.toLowerCase().trim(), s.reason])
      );

      for (const delivery of nullDeliveries) {
        const normalizedEmail = delivery.subscriber.email.toLowerCase().trim();
        const reason = suppressionMap.get(normalizedEmail);
        if (reason) {
          intentionalSkips.push({
            deliveryId: delivery.id,
            dispatchId: delivery.dispatchId,
            subscriberId: delivery.subscriberId,
            suppressionReason: reason,
          });
        } else {
          orphanedClaims.push({
            deliveryId: delivery.id,
            dispatchId: delivery.dispatchId,
            subscriberId: delivery.subscriberId,
          });
        }
      }

      return createSuccess({
        totalNullQueue,
        page,
        pageSize,
        intentionalSkips,
        orphanedClaims,
      });
    } catch (error) {
      return createFailure(
        "AUDIT_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to audit null deliveries",
        { details: error }
      );
    }
  }
}
