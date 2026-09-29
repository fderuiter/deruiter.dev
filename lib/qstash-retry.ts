import { Client, Receiver } from "@upstash/qstash";
import { getEnv } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/domain";
import { logger } from "@/lib/logger";

/** Path of the webhook QStash delivers retry messages to. */
export const QSTASH_RETRY_PATH = "/api/webhooks/qstash/retry";

/**
 * Delay, in seconds, before each successive QStash-driven retry: 5 minutes,
 * 15 minutes, then 1 hour. The last entry repeats. Attempts are bounded by the
 * queue's own retry ceiling, so one email costs at most a handful of the 500
 * free-tier messages per day (ADR 0036).
 */
export const QSTASH_RETRY_DELAYS_SECONDS: readonly number[] = [300, 900, 3600];

/** Picks the delay for the given number of attempts already made (1-based). */
export function getQStashRetryDelaySeconds(attempts: number): number {
  const index = Math.min(
    Math.max(0, attempts - 1),
    QSTASH_RETRY_DELAYS_SECONDS.length - 1
  );
  return QSTASH_RETRY_DELAYS_SECONDS[index];
}

/**
 * Whether QStash may publish. Needs a token, and only the production
 * deployment publishes: the QStash variables are shared with preview
 * deployments (#622), which must not enqueue jobs against production state.
 */
export function isQStashPublishingEnabled(): boolean {
  const e = getEnv();
  return !!e.QSTASH_TOKEN?.trim() && e.VERCEL_ENV === "production";
}

/** Whether the webhook has the keys it needs to verify a delivery. */
export function isQStashReceivingConfigured(): boolean {
  const e = getEnv();
  return (
    !!e.QSTASH_CURRENT_SIGNING_KEY?.trim() &&
    !!e.QSTASH_NEXT_SIGNING_KEY?.trim()
  );
}

/** Absolute callback URL QStash delivers to (the canonical origin). */
export function getQStashRetryUrl(): string {
  return `${resolveBaseUrl().replace(/\/$/, "")}${QSTASH_RETRY_PATH}`;
}

/**
 * Publishes a delayed message asking the webhook to retry one queued email.
 * Best effort: returns false, never throws, so a QStash outage or missing
 * configuration leaves the durable queue and the daily maintenance retry as
 * the fallback.
 */
export async function scheduleEmailRetry(
  queueId: string,
  attempts: number
): Promise<boolean> {
  if (!isQStashPublishingEnabled()) return false;
  const e = getEnv();
  try {
    const client = new Client({
      token: e.QSTASH_TOKEN as string,
      ...(e.QSTASH_URL?.trim() ? { baseUrl: e.QSTASH_URL.trim() } : {}),
    });
    await client.publishJSON({
      url: getQStashRetryUrl(),
      body: { queueId },
      delay: getQStashRetryDelaySeconds(attempts),
      // Retries beyond the first delivery attempt consume the daily message
      // budget; the handler reschedules explicitly instead.
      retries: 0,
    });
    return true;
  } catch (err) {
    logger.warn("QStash publish failed; daily maintenance will retry", {
      queueId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Verifies an inbound QStash delivery against both signing keys (current, then
 * next, so key rotation never drops messages). Returns false for a missing
 * signature, missing keys, wrong signature or wrong target URL.
 */
export async function verifyQStashSignature(
  signature: string | null,
  body: string
): Promise<boolean> {
  if (!signature || !isQStashReceivingConfigured()) return false;
  const e = getEnv();
  try {
    const receiver = new Receiver({
      currentSigningKey: e.QSTASH_CURRENT_SIGNING_KEY as string,
      nextSigningKey: e.QSTASH_NEXT_SIGNING_KEY as string,
    });
    return await receiver.verify({
      signature,
      body,
      url: getQStashRetryUrl(),
    });
  } catch {
    return false;
  }
}
