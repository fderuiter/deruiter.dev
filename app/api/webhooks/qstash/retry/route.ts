import { NextRequest, NextResponse } from "next/server";
import { QStashRetryPayloadSchema } from "@/lib/schemas";
import {
  isQStashReceivingConfigured,
  scheduleEmailRetry,
  verifyQStashSignature,
} from "@/lib/qstash-retry";
import { EmailService } from "@/lib/services/email-service";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * QStash email-retry webhook (#715).
 *
 * Verifies the `Upstash-Signature` header against both signing keys, then runs
 * a targeted retry for one OutboundEmailQueue row. If the row is still
 * retrying afterwards, it schedules the next sub-daily attempt. Without QStash
 * configuration nothing calls this route and the daily maintenance retry
 * remains the only retry path.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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
    const result = await EmailService.processRetryQueue({
      queueId,
      maxBatchSize: 1,
    });

    let rescheduled = false;
    if (result.processed > 0 && result.succeeded === 0) {
      const state = await EmailService.getQueueEntryState(queueId);
      if (state?.status === "RETRYING" || state?.status === "PENDING") {
        rescheduled = await scheduleEmailRetry(queueId, state.attempts);
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
    // Non-2xx lets QStash redeliver; the row lease makes that safe.
    logger.error("QStash email retry failed:", err);
    return NextResponse.json(
      { error: "Failed to process email retry" },
      { status: 500 }
    );
  }
}
