import { prisma } from "@/lib/db";
import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "../../service-result";
import {
  CheckRecipientEligibilityHandler,
  type CheckRecipientEligibilityPrismaPort,
} from "../check-recipient-eligibility/handler";
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
  type OutboundEmailStatus,
  type RawEmailOptions,
  type ResendTransportPort,
} from "../shared";
import type {
  ProcessRetryQueueInput,
  ProcessRetryQueueResult,
  ProcessRetryQueueSpec,
} from "./spec";

export interface LeasedQueueRow {
  id: string;
  to: string;
  from: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string | null;
  tags: unknown;
  headers?: unknown;
  attempts: number;
  status: OutboundEmailStatus;
  nextRetryAt: Date;
  lastError: string | null;
  dueAt: Date;
}

export interface ProcessRetryQueuePrismaPort extends CheckRecipientEligibilityPrismaPort {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  outboundEmailQueue: {
    update(args: {
      where: { id: string };
      data: {
        status?: OutboundEmailStatus;
        attempts?: number;
        nextRetryAt?: Date;
        lastError?: string | null;
        updatedAt?: Date;
      };
    }): Promise<unknown>;
    findUnique(args: {
      where: { id: string };
      select: { status: true; attempts: true };
    }): Promise<EmailQueueEntryState | null>;
  };
}

export interface ProcessRetryQueueDeps {
  prisma?: ProcessRetryQueuePrismaPort;
  eligibilityHandler?: CheckRecipientEligibilitySpec;
  getClient?: () => ResendTransportPort | null;
  getApiKey?: () => string | undefined;
}

export class ProcessRetryQueueHandler implements ProcessRetryQueueSpec {
  private readonly db: ProcessRetryQueuePrismaPort;
  private readonly eligibilityHandler: CheckRecipientEligibilitySpec;
  private readonly resolveClient: () => ResendTransportPort | null;
  private readonly resolveApiKey: () => string | undefined;

  constructor(deps?: ProcessRetryQueueDeps) {
    this.db =
      deps?.prisma ?? (prisma as unknown as ProcessRetryQueuePrismaPort);
    this.eligibilityHandler =
      deps?.eligibilityHandler ??
      new CheckRecipientEligibilityHandler({ prisma: this.db });
    this.resolveClient = deps?.getClient ?? getResendClient;
    this.resolveApiKey = deps?.getApiKey ?? getEffectiveResendApiKey;
  }

  async execute(
    options?: ProcessRetryQueueInput
  ): Promise<ProcessRetryQueueResult> {
    const limit = clamp(
      options?.maxBatchSize || MAX_RETRY_BATCH_SIZE,
      1,
      MAX_RETRY_BATCH_SIZE
    );
    const now = options?.now || new Date();
    const leaseUntil = new Date(now.getTime() + RETRY_LEASE_MS);
    const targetedQueueId = options?.queueId || null;

    let items: LeasedQueueRow[];
    try {
      const rows = await this.db.$queryRaw<LeasedQueueRow[]>`
        WITH due AS (
          SELECT "id", "nextRetryAt" AS "dueAt"
          FROM "OutboundEmailQueue"
          WHERE "status" IN ('PENDING', 'RETRYING')
            AND "nextRetryAt" <= ${now}
            AND (${targetedQueueId}::text IS NULL OR "id" = ${targetedQueueId}::text)
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
      items = [...rows].sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
    } catch (err) {
      logger.error("Error reading OutboundEmailQueue:", err);
      return createFailure(
        "QUEUE_LEASE_FAILED",
        "Could not lease due rows from the outbound email queue",
        { details: err }
      );
    }

    const apiKey = this.resolveApiKey();
    const isSimulated = shouldSimulateEmailDelivery(apiKey);
    const client = this.resolveClient();

    if (!client && !isSimulated) {
      logger.error(
        "Outbound email retry aborted: production transport is unconfigured (missing or blank RESEND_API_KEY)"
      );
      return createFailure(
        "TRANSPORT_UNCONFIGURED",
        "Production email transport is unconfigured (missing or blank RESEND_API_KEY)",
        { details: { leased: items.length } }
      );
    }

    let succeeded = 0;
    let failed = 0;
    let deferred = 0;
    let trackedEntryState: EmailQueueEntryState | null | undefined = undefined;

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
        const eligibilityResult = await this.eligibilityHandler.execute({
          recipients: toRecipients,
        });
        const eligibility = eligibilityResult.success
          ? eligibilityResult.data
          : {
              status: "unknown" as const,
              code: "SUPPRESSION_LOOKUP_FAILED" as const,
            };

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
          if (targetedQueueId && item.id === targetedQueueId) {
            trackedEntryState = {
              status: "RETRYING",
              attempts: item.attempts,
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
          if (targetedQueueId && item.id === targetedQueueId) {
            trackedEntryState = {
              status: "FAILED",
              attempts: item.attempts,
            };
          }
          failed++;
          continue;
        }

        if (isSimulated) {
          await this.db.outboundEmailQueue.update({
            where: { id: item.id },
            data: { status: "DELIVERED", updatedAt: new Date() },
          });
          if (targetedQueueId && item.id === targetedQueueId) {
            trackedEntryState = {
              status: "DELIVERED",
              attempts: item.attempts,
            };
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
            const nextStatus: OutboundEmailStatus =
              nextAttempts >= MAX_RETRY_ATTEMPTS ? "FAILED" : "RETRYING";
            if (nextStatus === "FAILED") {
              await this.db.outboundEmailQueue.update({
                where: { id: item.id },
                data: {
                  status: "FAILED",
                  attempts: nextAttempts,
                  lastError: error.message,
                },
              });
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
            }
            if (targetedQueueId && item.id === targetedQueueId) {
              trackedEntryState = {
                status: nextStatus,
                attempts: nextAttempts,
              };
            }
            failed++;
          } else {
            await this.db.outboundEmailQueue.update({
              where: { id: item.id },
              data: { status: "DELIVERED", updatedAt: new Date() },
            });
            if (targetedQueueId && item.id === targetedQueueId) {
              trackedEntryState = {
                status: "DELIVERED",
                attempts: item.attempts,
              };
            }
            succeeded++;
          }
        } catch (sendErr) {
          const nextAttempts = item.attempts + 1;
          const msg =
            sendErr instanceof Error
              ? sendErr.message
              : "Network dispatch failure";
          const nextStatus: OutboundEmailStatus =
            nextAttempts >= MAX_RETRY_ATTEMPTS ? "FAILED" : "RETRYING";
          if (nextStatus === "FAILED") {
            await this.db.outboundEmailQueue.update({
              where: { id: item.id },
              data: {
                status: "FAILED",
                attempts: nextAttempts,
                lastError: msg,
              },
            });
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
          }
          if (targetedQueueId && item.id === targetedQueueId) {
            trackedEntryState = {
              status: nextStatus,
              attempts: nextAttempts,
            };
          }
          failed++;
        }
      }
    } catch (err) {
      logger.error("Error updating OutboundEmailQueue during retry:", err);
      return createFailure(
        "QUEUE_UPDATE_FAILED",
        "An outbound email queue row could not be updated during retry",
        {
          details: {
            error: err,
            succeeded,
            failed,
            deferred,
            leased: items.length,
          },
        }
      );
    }

    if (targetedQueueId && trackedEntryState === undefined) {
      try {
        const row = await this.db.outboundEmailQueue.findUnique({
          where: { id: targetedQueueId },
          select: { status: true, attempts: true },
        });
        trackedEntryState = row ?? null;
      } catch (err) {
        logger.error("Failed to read outbound email queue entry:", err);
        return createFailure(
          "QUEUE_STATE_READ_FAILED",
          "Could not inspect outbound email queue entry state after retry",
          { recoverable: true, details: err }
        );
      }
    }

    return createSuccess({
      processed: items.length,
      succeeded,
      failed,
      deferred,
      ...(targetedQueueId ? { entryState: trackedEntryState ?? null } : {}),
    });
  }
}
