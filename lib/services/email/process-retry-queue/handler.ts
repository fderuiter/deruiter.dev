import { prisma } from "@/lib/db";
import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { CheckRecipientEligibilityHandler } from "../check-recipient-eligibility/handler";
import type { CheckRecipientEligibilitySpec } from "../check-recipient-eligibility/spec";
import {
  ELIGIBILITY_DEFERRED_REASON,
  getEffectiveResendApiKey,
  getResendClient,
  getRetryDelayMs,
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_BATCH_SIZE,
  parseQueuedHeaders,
  parseQueuedTags,
  RETRY_LEASE_MS,
  shouldSimulateEmailDelivery,
  type EmailQueueEntryState,
  type LeasedQueueRow,
  type OutboundEmailStatus,
  type RawEmailOptions,
  type RecipientEligibility,
  type ResendClientLike,
} from "../shared";
import {
  ProcessRetryQueueInputSchema,
  type ProcessRetryQueueInput,
  type ProcessRetryQueueResult,
  type ProcessRetryQueueSpec,
} from "./spec";

export interface ProcessRetryQueueDeps {
  db?: {
    $queryRaw<T = unknown>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<T>;
    outboundEmailQueue: {
      update(args: {
        where: { id: string };
        data: {
          status: OutboundEmailStatus;
          attempts?: number;
          nextRetryAt?: Date;
          lastError?: string;
          updatedAt?: Date;
        };
      }): Promise<unknown>;
      findUnique(args: {
        where: { id: string };
        select: { status: true; attempts: true };
      }): Promise<EmailQueueEntryState | null>;
    };
  };
  leaseRows?: (args: {
    now: Date;
    leaseUntil: Date;
    limit: number;
    queueId: string | null;
  }) => Promise<LeasedQueueRow[]>;
  checkEligibilityHandler?: CheckRecipientEligibilitySpec;
  getClient?: () => ResendClientLike | null;
  getApiKey?: () => string | undefined;
  shouldSimulate?: (apiKey: string | undefined) => boolean;
}

/**
 * Handler for leasing and processing due `OutboundEmailQueue` rows with `FOR UPDATE SKIP LOCKED`,
 * exponential backoff, recipient eligibility re-verification, and merged post-retry entry state inspection.
 */
export class ProcessRetryQueueHandler implements ProcessRetryQueueSpec {
  private readonly db: NonNullable<ProcessRetryQueueDeps["db"]>;
  private readonly leaseRowsFn?: ProcessRetryQueueDeps["leaseRows"];
  private readonly checkEligibilityHandler: CheckRecipientEligibilitySpec;
  private readonly getClient: () => ResendClientLike | null;
  private readonly getApiKey: () => string | undefined;
  private readonly shouldSimulate: (apiKey: string | undefined) => boolean;

  constructor(deps: ProcessRetryQueueDeps = {}) {
    this.db = deps.db ?? prisma;
    this.leaseRowsFn = deps.leaseRows;
    this.checkEligibilityHandler =
      deps.checkEligibilityHandler ?? new CheckRecipientEligibilityHandler();
    this.getClient = deps.getClient ?? getResendClient;
    this.getApiKey = deps.getApiKey ?? getEffectiveResendApiKey;
    this.shouldSimulate = deps.shouldSimulate ?? shouldSimulateEmailDelivery;
  }

  private async leaseDueQueueRows(args: {
    now: Date;
    leaseUntil: Date;
    limit: number;
    queueId: string | null;
  }): Promise<LeasedQueueRow[]> {
    if (this.leaseRowsFn) {
      return this.leaseRowsFn(args);
    }
    const { now, leaseUntil, limit, queueId } = args;
    const rows = await this.db.$queryRaw<LeasedQueueRow[]>`
      WITH due AS (
        SELECT "id", "nextRetryAt" AS "dueAt"
        FROM "OutboundEmailQueue"
        WHERE "status" IN ('PENDING', 'RETRYING')
          AND "nextRetryAt" <= ${now}
          AND (${queueId}::text IS NULL OR "id" = ${queueId}::text)
        ORDER BY "nextRetryAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "OutboundEmailQueue" AS q
      SET "nextRetryAt" = ${leaseUntil}, "updatedAt" = ${new Date()}
      FROM due
      WHERE q."id" = due."id"
      RETURNING q.*, due."dueAt"
    `;
    return [...rows].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
  }

  private async checkMessageEligibility(
    recipients: string[]
  ): Promise<RecipientEligibility> {
    let unknown: RecipientEligibility | null = null;
    for (const recipient of recipients) {
      const checkRes = await this.checkEligibilityHandler.execute({
        email: recipient,
      });
      if (!checkRes.success) {
        unknown = { status: "unknown", code: "SUPPRESSION_LOOKUP_FAILED" };
        continue;
      }
      if (checkRes.data.status === "suppressed") {
        return checkRes.data;
      }
      if (checkRes.data.status === "unknown") {
        unknown = checkRes.data;
      }
    }
    return unknown ?? { status: "eligible" };
  }

  async execute(
    input: ProcessRetryQueueInput = {}
  ): Promise<ProcessRetryQueueResult> {
    const parsed = ProcessRetryQueueInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid retry queue options",
        { recoverable: false, details: parsed.error }
      );
    }

    const options = parsed.data;
    const limit = clamp(
      options.maxBatchSize || MAX_RETRY_BATCH_SIZE,
      1,
      MAX_RETRY_BATCH_SIZE
    );
    const now = options.now || new Date();
    const leaseUntil = new Date(now.getTime() + RETRY_LEASE_MS);
    const targetedQueueId = options.queueId || null;

    let items: LeasedQueueRow[];
    try {
      items = await this.leaseDueQueueRows({
        now,
        leaseUntil,
        limit,
        queueId: targetedQueueId,
      });
    } catch (err) {
      logger.error("Error reading OutboundEmailQueue:", err);
      return createFailure(
        "QUEUE_LEASE_FAILED",
        "Could not lease due rows from the outbound email queue",
        { recoverable: true, details: err }
      );
    }

    const apiKey = this.getApiKey();
    const isSimulated = this.shouldSimulate(apiKey);
    const client = this.getClient();

    if (!client && !isSimulated) {
      logger.error(
        "Outbound email retry aborted: production transport is unconfigured (missing or blank RESEND_API_KEY)"
      );
      const leasedTarget = targetedQueueId
        ? items.find((i) => i.id === targetedQueueId)
        : undefined;
      return createFailure(
        "TRANSPORT_UNCONFIGURED",
        "Production email transport is unconfigured (missing or blank RESEND_API_KEY)",
        {
          recoverable: true,
          details: {
            leased: items.length,
            attempts: leasedTarget ? Math.max(1, leasedTarget.attempts) : 1,
          },
        }
      );
    }

    let succeeded = 0;
    let failed = 0;
    let deferred = 0;
    let trackedState: EmailQueueEntryState | null = null;

    try {
      for (const item of items) {
        const rawOptions: RawEmailOptions = {
          to: item.to.includes(",")
            ? item.to.split(",").map((s) => s.trim())
            : item.to,
          from: item.from,
          replyTo: item.replyTo || undefined,
          subject: item.subject,
          html: item.html,
          text: item.text || undefined,
          tags: parseQueuedTags(item.tags),
          headers: parseQueuedHeaders(item.headers),
          skipQueue: true,
        };

        const toRecipients = Array.isArray(rawOptions.to)
          ? rawOptions.to
          : [rawOptions.to];
        const eligibility = await this.checkMessageEligibility(toRecipients);

        if (eligibility.status === "unknown") {
          const delay = getRetryDelayMs(item.id, Math.max(1, item.attempts));
          await this.db.outboundEmailQueue.update({
            where: { id: item.id },
            data: {
              status: "RETRYING",
              nextRetryAt: new Date(now.getTime() + delay),
              lastError: ELIGIBILITY_DEFERRED_REASON,
            },
          });
          if (item.id === targetedQueueId) {
            trackedState = {
              status: "RETRYING",
              attempts: Math.max(1, item.attempts),
            };
          }
          deferred++;
          continue;
        }

        if (eligibility.status === "suppressed") {
          await this.db.outboundEmailQueue.update({
            where: { id: item.id },
            data: {
              status: "FAILED",
              lastError: "Recipient is on suppression list",
            },
          });
          if (item.id === targetedQueueId) {
            trackedState = { status: "FAILED", attempts: item.attempts };
          }
          failed++;
          continue;
        }

        if (isSimulated) {
          await this.db.outboundEmailQueue.update({
            where: { id: item.id },
            data: { status: "DELIVERED", updatedAt: new Date() },
          });
          if (item.id === targetedQueueId) {
            trackedState = { status: "DELIVERED", attempts: item.attempts };
          }
          succeeded++;
          continue;
        }

        try {
          const { error } = await client!.emails.send(
            {
              from: item.from,
              to: rawOptions.to,
              replyTo: item.replyTo || undefined,
              subject: item.subject,
              html: item.html,
              text: item.text || undefined,
              tags: rawOptions.tags,
              headers: rawOptions.headers,
            },
            { idempotencyKey: `portfolio-email-${item.id}` }
          );

          if (error) {
            const nextAttempts = item.attempts + 1;
            if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
              await this.db.outboundEmailQueue.update({
                where: { id: item.id },
                data: {
                  status: "FAILED",
                  attempts: nextAttempts,
                  lastError: error.message,
                },
              });
              if (item.id === targetedQueueId) {
                trackedState = { status: "FAILED", attempts: nextAttempts };
              }
              failed++;
            } else {
              const delay = getRetryDelayMs(item.id, nextAttempts);
              await this.db.outboundEmailQueue.update({
                where: { id: item.id },
                data: {
                  status: "RETRYING",
                  attempts: nextAttempts,
                  nextRetryAt: new Date(now.getTime() + delay),
                  lastError: error.message,
                },
              });
              if (item.id === targetedQueueId) {
                trackedState = { status: "RETRYING", attempts: nextAttempts };
              }
              failed++;
            }
          } else {
            await this.db.outboundEmailQueue.update({
              where: { id: item.id },
              data: { status: "DELIVERED", updatedAt: new Date() },
            });
            if (item.id === targetedQueueId) {
              trackedState = { status: "DELIVERED", attempts: item.attempts };
            }
            succeeded++;
          }
        } catch (sendErr) {
          const nextAttempts = item.attempts + 1;
          const msg =
            sendErr instanceof Error
              ? sendErr.message
              : "Network dispatch failure";
          if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
            await this.db.outboundEmailQueue.update({
              where: { id: item.id },
              data: {
                status: "FAILED",
                attempts: nextAttempts,
                lastError: msg,
              },
            });
            if (item.id === targetedQueueId) {
              trackedState = { status: "FAILED", attempts: nextAttempts };
            }
            failed++;
          } else {
            const delay = getRetryDelayMs(item.id, nextAttempts);
            await this.db.outboundEmailQueue.update({
              where: { id: item.id },
              data: {
                status: "RETRYING",
                attempts: nextAttempts,
                nextRetryAt: new Date(now.getTime() + delay),
                lastError: msg,
              },
            });
            if (item.id === targetedQueueId) {
              trackedState = { status: "RETRYING", attempts: nextAttempts };
            }
            failed++;
          }
        }
      }
    } catch (err) {
      logger.error("Error updating OutboundEmailQueue during retry:", err);
      const leasedTarget = targetedQueueId
        ? items.find((i) => i.id === targetedQueueId)
        : undefined;
      return createFailure(
        "QUEUE_UPDATE_FAILED",
        "An outbound email queue row could not be updated during retry",
        {
          recoverable: true,
          details: {
            error: err,
            succeeded,
            failed,
            deferred,
            leased: items.length,
            attempts:
              trackedState?.attempts ??
              (leasedTarget ? leasedTarget.attempts + 1 : 1),
          },
        }
      );
    }

    if (targetedQueueId) {
      if (typeof this.db.outboundEmailQueue?.findUnique !== "function") {
        return createSuccess({
          processed: items.length,
          succeeded,
          failed,
          deferred,
          entryState: trackedState ?? null,
        });
      }
      try {
        const row = await this.db.outboundEmailQueue.findUnique({
          where: { id: targetedQueueId },
          select: { status: true, attempts: true },
        });
        return createSuccess({
          processed: items.length,
          succeeded,
          failed,
          deferred,
          entryState: row ?? trackedState ?? null,
        });
      } catch (readErr) {
        logger.error("Failed to read outbound email queue entry:", readErr);
        return createFailure(
          "QUEUE_STATE_READ_FAILED",
          "Could not inspect outbound email queue entry state after retry",
          {
            recoverable: true,
            details: {
              error: readErr,
              processed: items.length,
              succeeded,
              failed,
              deferred,
              attempts: trackedState?.attempts ?? 1,
            },
          }
        );
      }
    }

    return createSuccess({
      processed: items.length,
      succeeded,
      failed,
      deferred,
    });
  }
}
