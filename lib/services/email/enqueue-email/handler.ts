import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { DEFAULT_FROM_EMAIL } from "../shared";
import {
  EnqueueEmailOptionsSchema,
  type EnqueueEmailInput,
  type EnqueueEmailResult,
  type EnqueueEmailSpec,
  type OutboundEmailQueueWriterLike,
} from "./spec";

export interface EnqueueEmailDeps {
  db?: OutboundEmailQueueWriterLike;
}

/**
 * Handler for adding an email directly to `OutboundEmailQueue` as `PENDING` without an inline attempt.
 * Supports optional transactional Prisma client injection for atomic newsletter delivery claims.
 */
export class EnqueueEmailHandler implements EnqueueEmailSpec {
  private readonly db: OutboundEmailQueueWriterLike;

  constructor(deps: EnqueueEmailDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
    if (!input || typeof input !== "object" || !input.options) {
      return createFailure("INVALID_INPUT", "Email options are required", {
        recoverable: false,
      });
    }

    const parsed = EnqueueEmailOptionsSchema.safeParse(input.options);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid outbound email payload",
        { recoverable: false, details: parsed.error }
      );
    }

    const options = parsed.data;
    const client = input.client ?? this.db;
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;

    try {
      const entry = await client.outboundEmailQueue.create({
        data: {
          to,
          from: options.from || env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
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
        "Failed to enqueue outbound email to database",
        { recoverable: true, details: err }
      );
    }
  }
}
