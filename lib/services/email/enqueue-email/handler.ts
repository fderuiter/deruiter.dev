import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { scheduleEmailRetry } from "@/lib/qstash-retry";
import { createFailure, createSuccess } from "../../service-result";
import {
  BASE_RETRY_DELAY_MS,
  DEFAULT_FROM_EMAIL,
  type OutboundEmailStatus,
} from "../shared";
import {
  EnqueueEmailInputSchema,
  type EnqueueEmailInput,
  type EnqueueEmailResult,
  type EnqueueEmailSpec,
} from "./spec";

export interface EnqueueEmailPrismaPort {
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
        lastError?: string;
      };
    }): Promise<{ id: string }>;
  };
}

export interface EnqueueEmailDeps {
  prisma?: EnqueueEmailPrismaPort;
  scheduleRetry?: typeof scheduleEmailRetry;
}

export class EnqueueEmailHandler implements EnqueueEmailSpec {
  private readonly db: EnqueueEmailPrismaPort;
  private readonly scheduleRetryFn: typeof scheduleEmailRetry;

  constructor(deps?: EnqueueEmailDeps) {
    this.db = deps?.prisma ?? prisma;
    this.scheduleRetryFn = deps?.scheduleRetry ?? scheduleEmailRetry;
  }

  async execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
    const parsed = EnqueueEmailInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid outbound email queue payload",
        { recoverable: false, details: parsed.error }
      );
    }

    const { options, mode, fromAddress, errorReason } = parsed.data;
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    const from =
      fromAddress ||
      options.from ||
      env.RESEND_FROM_EMAIL ||
      DEFAULT_FROM_EMAIL;

    try {
      if (mode === "retry") {
        const entry = await this.db.outboundEmailQueue.create({
          data: {
            to,
            from,
            replyTo: options.replyTo,
            subject: options.subject,
            html: options.html,
            text: options.text,
            tags: options.tags ?? undefined,
            headers: options.headers ?? undefined,
            attempts: 1,
            status: "RETRYING",
            nextRetryAt: new Date(Date.now() + BASE_RETRY_DELAY_MS),
            lastError: errorReason || "Initial dispatch failed",
          },
        });
        await this.scheduleRetryFn(entry.id, 1);
        return createSuccess({ queueId: entry.id });
      }

      const entry = await this.db.outboundEmailQueue.create({
        data: {
          to,
          from,
          replyTo: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          tags: options.tags ?? undefined,
          headers: options.headers ?? undefined,
          attempts: 0,
          status: "PENDING",
          nextRetryAt: new Date(),
        },
      });
      return createSuccess({ queueId: entry.id });
    } catch (err) {
      logger.error("Failed to enqueue outbound email to database:", err);
      return createFailure(
        "ENQUEUE_FAILED",
        "Failed to persist email to outbound queue",
        { recoverable: true, details: err }
      );
    }
  }
}
