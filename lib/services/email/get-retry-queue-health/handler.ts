import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "../../service-result";
import {
  ELIGIBILITY_DEFERRED_REASON,
  MAX_RETRY_ATTEMPTS,
  type OutboundEmailStatus,
} from "../shared";
import type {
  GetRetryQueueHealthInput,
  GetRetryQueueHealthResult,
  GetRetryQueueHealthSpec,
} from "./spec";

export interface GetRetryQueueHealthPrismaPort {
  outboundEmailQueue: {
    count(args: {
      where: {
        status?: OutboundEmailStatus | { in: OutboundEmailStatus[] };
        attempts?: { gte: number };
        lastError?: string;
      };
    }): Promise<number>;
    findFirst(args: {
      where: { status: { in: OutboundEmailStatus[] } };
      orderBy: { createdAt: "asc" };
      select: { createdAt: true };
    }): Promise<{ createdAt: Date } | null>;
  };
}

export interface GetRetryQueueHealthDeps {
  prisma?: GetRetryQueueHealthPrismaPort;
}

export class GetRetryQueueHealthHandler implements GetRetryQueueHealthSpec {
  private readonly db: GetRetryQueueHealthPrismaPort;

  constructor(deps?: GetRetryQueueHealthDeps) {
    this.db = deps?.prisma ?? prisma;
  }

  async execute(
    input?: GetRetryQueueHealthInput
  ): Promise<GetRetryQueueHealthResult> {
    const now = input?.now ?? new Date();
    const pendingStatuses: OutboundEmailStatus[] = ["PENDING", "RETRYING"];
    const pendingWhere = { status: { in: pendingStatuses } };

    try {
      const [
        depth,
        oldest,
        terminalFailures,
        retryExhausted,
        eligibilityDeferred,
      ] = await Promise.all([
        this.db.outboundEmailQueue.count({ where: pendingWhere }),
        this.db.outboundEmailQueue.findFirst({
          where: pendingWhere,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        this.db.outboundEmailQueue.count({ where: { status: "FAILED" } }),
        this.db.outboundEmailQueue.count({
          where: { status: "FAILED", attempts: { gte: MAX_RETRY_ATTEMPTS } },
        }),
        this.db.outboundEmailQueue.count({
          where: { ...pendingWhere, lastError: ELIGIBILITY_DEFERRED_REASON },
        }),
      ]);

      return createSuccess({
        depth,
        oldestPendingAgeMs: oldest
          ? Math.max(0, now.getTime() - oldest.createdAt.getTime())
          : null,
        terminalFailures,
        retryExhausted,
        eligibilityDeferred,
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to read outbound email queue health",
        { recoverable: true, details: error }
      );
    }
  }
}
