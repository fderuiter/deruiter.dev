import { NextResponse } from "next/server";
import { QStashRetryPayloadSchema } from "@/lib/schemas";
import {
  isQStashReceivingConfigured,
  scheduleEmailRetry,
  verifyQStashSignature,
} from "@/lib/qstash-retry";
import { ProcessRetryQueueHandler } from "@/lib/services";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createApiHandler, serviceFailureResponse } from "@/lib/route-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * QStash email-retry webhook (#715).
 *
 * Verifies the `Upstash-Signature` header against both signing keys, then runs
 * a targeted retry for one OutboundEmailQueue row. If the row is still
 * retrying afterwards (or if transient storage failure prevents queue state
 * inspection), it schedules the next sub-daily attempt conservatively before
 * answering so `retries: 0` QStash messages are never dropped.
 */
export const POST = createApiHandler(
  async (req) => {
    if (!isQStashReceivingConfigured()) {
      return NextResponse.json(
        { error: "QStash signature verification is not configured" },
        { status: 503 }
      );
    }

    const rawBody = await req.text();
    const valid = await verifyQStashSignature(
      req.headers.get("upstash-signature"),
      rawBody
    );
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid QStash signature" },
        { status: 401 }
      );
    }

    // The signing keys are shared with preview deployments (#622); only the
    // production deployment may act on deliveries.
    if (getEnv().VERCEL_ENV !== "production") {
      return NextResponse.json(
        { received: true, ignored: "non-production deployment" },
        { status: 202 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }
    const parsed = QStashRetryPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload does not match QStash retry schema" },
        { status: 422 }
      );
    }
    const { queueId } = parsed.data;

    try {
      const retry = await new ProcessRetryQueueHandler().execute({
        queueId,
        maxBatchSize: 1,
      });
      if (!retry.success) {
        const details = retry.error.details as
          { attempts?: unknown } | undefined;
        const fallbackAttempts =
          typeof details?.attempts === "number" && details.attempts >= 1
            ? details.attempts
            : 1;
        await scheduleEmailRetry(queueId, fallbackAttempts);
        return serviceFailureResponse(retry, {
          status: 503,
          errorMessage: "Failed to process email retry",
          logContext: `QStash email retry failed (${retry.error.code}):`,
        });
      }
      const result = retry.data;

      let rescheduled = false;
      if (result.processed > 0 && result.succeeded === 0) {
        const state = result.entryState;
        if (
          !state ||
          state.status === "RETRYING" ||
          state.status === "PENDING"
        ) {
          rescheduled = await scheduleEmailRetry(queueId, state?.attempts ?? 1);
        }
      }

      return NextResponse.json(
        {
          received: true,
          queueId,
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          rescheduled,
        },
        { status: 200 }
      );
    } catch (err) {
      await scheduleEmailRetry(queueId, 1);
      logger.error("QStash email retry failed:", err);
      return NextResponse.json(
        { error: "Failed to process email retry" },
        { status: 503 }
      );
    }
  },
  { auth: "public" }
);
