import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  ELIGIBILITY_DEFERRED_REASON,
  MAX_RETRY_ATTEMPTS,
  type OutboundEmailStatus,
} from "../shared";
import {
  GetEmailRetryQueueHealthInputSchema,
  type GetEmailRetryQueueHealthInput,
  type GetEmailRetryQueueHealthResult,
  type GetEmailRetryQueueHealthSpec,
} from "./spec";

export interface GetEmailRetryQueueHealthDeps {
  db?: {
    outboundEmailQueue: {
      count(args: { where: Record<string, unknown> }): Promise<number>;
      findFirst(args: {
        where: Record<string, unknown>;
        orderBy: { createdAt: "asc" };
        select: { createdAt: true };
      }): Promise<{ createdAt: Date } | null>;
    };
  };
}

/**
 * Handler for computing secret-free operational health metrics for `OutboundEmailQueue`.
 */
export class GetEmailRetryQueueHealthHandler implements GetEmailRetryQueueHealthSpec {
  private readonly db: NonNullable<GetEmailRetryQueueHealthDeps["db"]>;

  constructor(deps: GetEmailRetryQueueHealthDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetEmailRetryQueueHealthInput = {}
  ): Promise<GetEmailRetryQueueHealthResult> {
    const parsed = GetEmailRetryQueueHealthInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid queue health input",
        { recoverable: false, details: parsed.error }
      );
    }

    const now = parsed.data.now ?? new Date();
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
        "Failed to query outbound email queue health",
        { recoverable: true, details: error }
      );
    }
  }
}
