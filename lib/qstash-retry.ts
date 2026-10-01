import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/domain";
import { logger } from "@/lib/logger";
import { clamp } from "@/lib/game-utils";

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
  const index = clamp(attempts - 1, 0, QSTASH_RETRY_DELAYS_SECONDS.length - 1);
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
    const baseUrl = e.QSTASH_URL?.trim() || "https://qstash.upstash.io";
    const targetUrl = getQStashRetryUrl();
    const delaySeconds = getQStashRetryDelaySeconds(attempts);

    const publishEndpoint = `${baseUrl.replace(/\/$/, "")}/v2/publish/${targetUrl}`;
    const response = await fetch(publishEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${delaySeconds}s`,
        "Upstash-Retries": "0",
      },
      body: JSON.stringify({ queueId }),
    });

    if (!response.ok) {
      throw new Error(`QStash publish HTTP ${response.status}`);
    }
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
 * Verifies a JWT signature against a single signing key using HMAC-SHA256.
 */
function verifySingleKey(
  parts: string[],
  body: string,
  key: string,
  targetUrl: string
): boolean {
  const [headerB64, payloadB64, sigB64] = parts;

  // Compute expected HMAC-SHA256 signature
  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  // Constant-time signature comparison
  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  // Parse payload JSON
  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    // Verify claims
    if (payload.iss !== "Upstash") return false;
    if (payload.sub !== targetUrl) return false;

    // Verify body hash
    const bodyHash = crypto
      .createHash("sha256")
      .update(body)
      .digest("base64url");
    if (payload.body !== bodyHash) return false;

    // Verify exp / nbf if present
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && now > payload.exp) return false;
    if (typeof payload.nbf === "number" && now < payload.nbf - 10) return false;

    return true;
  } catch {
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

  const parts = signature.split(".");
  if (parts.length !== 3) return false;

  const e = getEnv();
  const targetUrl = getQStashRetryUrl();

  const keys = [
    e.QSTASH_CURRENT_SIGNING_KEY as string,
    e.QSTASH_NEXT_SIGNING_KEY as string,
  ].filter(Boolean);

  for (const key of keys) {
    if (verifySingleKey(parts, body, key, targetUrl)) {
      return true;
    }
  }

  return false;
}
