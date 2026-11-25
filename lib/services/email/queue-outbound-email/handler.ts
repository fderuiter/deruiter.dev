import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { scheduleEmailRetry } from "@/lib/qstash-retry";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  BASE_RETRY_DELAY_MS,
  DEFAULT_FROM_EMAIL,
  type OutboundEmailStatus,
} from "../shared";
import {
  QueueOutboundEmailInputSchema,
  type QueueOutboundEmailInput,
  type QueueOutboundEmailResult,
  type QueueOutboundEmailSpec,
} from "./spec";

export interface QueueOutboundEmailDeps {
  db?: {
    outboundEmailQueue: {
      create(args: {
        data: {
          to: string;
          from: string;
          replyTo?: string;
          subject: string;
          html: string;
          text?: string;
          tags?: Array<{ name: string; value: string }>;
          headers?: Record<string, string>;
          attempts: number;
          status: OutboundEmailStatus;
          nextRetryAt: Date;
          lastError: string;
        };
      }): Promise<{ id: string }>;
    };
  };
  scheduleRetry?: (queueId: string, attempts: number) => Promise<boolean>;
}

/**
 * Handler for persisting a failed or deferred outbound email in `OutboundEmailQueue` as `RETRYING`
 * and scheduling a best-effort sub-daily QStash retry (#715).
 */
export class QueueOutboundEmailHandler implements QueueOutboundEmailSpec {
  private readonly db: NonNullable<QueueOutboundEmailDeps["db"]>;
  private readonly scheduleRetry: NonNullable<
    QueueOutboundEmailDeps["scheduleRetry"]
  >;

  constructor(deps: QueueOutboundEmailDeps = {}) {
    this.db = deps.db ?? prisma;
    this.scheduleRetry = deps.scheduleRetry ?? scheduleEmailRetry;
  }

  async execute(
    input: QueueOutboundEmailInput
  ): Promise<QueueOutboundEmailResult> {
    const parsed = QueueOutboundEmailInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid outbound email payload",
        { recoverable: false, details: parsed.error }
      );
    }

    const { options, fromAddress, errorReason } = parsed.data;
    const toAddress = Array.isArray(options.to)
      ? options.to.join(", ")
      : options.to;
    const from =
      fromAddress ||
      options.from ||
      env.RESEND_FROM_EMAIL ||
      DEFAULT_FROM_EMAIL;
    const nextRetryAt = new Date(Date.now() + BASE_RETRY_DELAY_MS);

    try {
      const entry = await this.db.outboundEmailQueue.create({
        data: {
          to: toAddress,
          from,
          replyTo: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          tags: options.tags ?? undefined,
          headers: options.headers ?? undefined,
          attempts: 1,
          status: "RETRYING",
          nextRetryAt,
          lastError: errorReason || "Initial dispatch failed",
        },
      });
      await this.scheduleRetry(entry.id, 1);
      return createSuccess({ queueId: entry.id });
    } catch (err) {
      logger.error("Failed to enqueue outbound email to database:", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to enqueue outbound email to database",
        { recoverable: true, details: err }
      );
    }
  }
}
