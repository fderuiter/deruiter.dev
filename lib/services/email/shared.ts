import crypto from "crypto";
import { Resend } from "resend";
import { z } from "zod";
import { env, getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { type OutboundEmailStatus, type SuppressionReason } from "@/lib/db";
import type { ServiceResult } from "../service-result";

export type { OutboundEmailStatus, SuppressionReason };

export interface RawEmailOptions {
  to: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
  skipQueue?: boolean;
}

export interface EmailQueueEntryState {
  status: OutboundEmailStatus;
  attempts: number;
}

export const EmailRetryErrorCode = z.enum([
  "QUEUE_LEASE_FAILED",
  "QUEUE_UPDATE_FAILED",
  "QUEUE_STATE_READ_FAILED",
  "TRANSPORT_UNCONFIGURED",
]);
export type EmailRetryErrorCode = z.infer<typeof EmailRetryErrorCode>;

export interface EmailRetryCounts {
  processed: number;
  succeeded: number;
  failed: number;
  deferred: number;
  entryState?: EmailQueueEntryState | null;
}

export type RecipientEligibility =
  | { status: "eligible" }
  | { status: "suppressed"; reason: string }
  | { status: "unknown"; code: "SUPPRESSION_LOOKUP_FAILED" };

export const ELIGIBILITY_DEFERRED_REASON =
  "ELIGIBILITY_UNKNOWN: suppression lookup failed before send";

export type EmailRetryResult = ServiceResult<
  EmailRetryCounts,
  EmailRetryErrorCode
>;

export interface SvixVerifyParams {
  payload: string;
  svixId?: string | null;
  svixTimestamp?: string | null;
  svixSignature?: string | null;
  secret?: string;
}

export const DEFAULT_FROM_EMAIL =
  "Frederick de Ruiter <notifications@deruiter.dev>";
export const MAX_RETRY_ATTEMPTS = 5;
export const BASE_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 600000;
export const RETRY_LEASE_MS = 5 * 60 * 1000;
export const MAX_RETRY_BATCH_SIZE = 20;
export const EMAIL_RETRY_BATCH_SIZE = 15;

let resendClient: Resend | null = null;

export function resetResendClient(): void {
  resendClient = null;
}

export function getEffectiveResendApiKey(): string | undefined {
  const runtimeKey = getEnv().RESEND_API_KEY;
  if (runtimeKey !== undefined) {
    return runtimeKey;
  }
  return env.RESEND_API_KEY;
}

export interface ResendTransportPort {
  emails: {
    send(
      payload: {
        from: string;
        to: string | string[];
        replyTo?: string;
        subject: string;
        html: string;
        text?: string;
        tags?: Array<{ name: string; value: string }>;
        headers?: Record<string, string>;
      },
      options?: { idempotencyKey?: string }
    ): Promise<{
      data?: { id?: string } | null;
      error?: { message: string } | null;
    }>;
  };
}

export function getResendClient(): ResendTransportPort | null {
  if (resendClient) return resendClient as unknown as ResendTransportPort;
  const apiKey = getEffectiveResendApiKey();
  if (!apiKey || apiKey.trim() === "") return null;
  resendClient = new Resend(apiKey);
  return resendClient as unknown as ResendTransportPort;
}

export function shouldSimulateEmailDelivery(
  apiKey: string | undefined
): boolean {
  const currentEnv = getEnv();
  if (
    currentEnv.NODE_ENV === "development" ||
    currentEnv.VERCEL_ENV === "preview" ||
    currentEnv.VERCEL_ENV === "development"
  ) {
    return true;
  }

  if (
    currentEnv.VERCEL_ENV === "production" ||
    currentEnv.NODE_ENV === "production"
  ) {
    return false;
  }

  if (currentEnv.NODE_ENV === "test") {
    return !apiKey?.startsWith("re_test_");
  }

  return false;
}

export function getRetryDelayMs(queueId: string, attempt: number): number {
  const digest = crypto
    .createHash("sha256")
    .update(`${queueId}:${attempt}`)
    .digest();
  const jitterFactor = 0.75 + (digest.readUInt16BE(0) / 65535) * 0.5;
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.round(exponentialDelay * jitterFactor)
  );
}

export function isRetryableEmailError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate_limit") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("internal server error") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  );
}

export function parseQueuedTags(
  raw: unknown
): Array<{ name: string; value: string }> | undefined {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  const tags = value.filter(
    (t): t is { name: string; value: string } =>
      !!t &&
      typeof t === "object" &&
      typeof (t as { name?: unknown }).name === "string" &&
      typeof (t as { value?: unknown }).value === "string"
  );
  return tags.length > 0 ? tags : undefined;
}

export function parseQueuedHeaders(
  raw: unknown
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Verifies Svix cryptographic signature for incoming Resend deliverability webhooks.
 */
export function verifySvixSignature({
  payload,
  svixId,
  svixTimestamp,
  svixSignature,
  secret,
}: SvixVerifyParams): boolean {
  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const effectiveSecret = secret || getEnv().RESEND_WEBHOOK_SECRET;
  if (!effectiveSecret || effectiveSecret.trim() === "") {
    return false;
  }

  const timestampNum = parseInt(svixTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(timestampNum) || Math.abs(nowSec - timestampNum) > 300) {
    return false;
  }

  try {
    const rawSecret = effectiveSecret.startsWith("whsec_")
      ? effectiveSecret.substring(6)
      : effectiveSecret;
    const secretBuffer = Buffer.from(rawSecret, "base64");

    const toSign = `${svixId}.${svixTimestamp}.${payload}`;
    const expectedHmac = crypto
      .createHmac("sha256", secretBuffer)
      .update(toSign)
      .digest("base64");

    const signatures = svixSignature.split(" ");
    for (const versionedSig of signatures) {
      const [version, sig] = versionedSig.split(",");
      if (version === "v1" && sig) {
        const sigBuffer = Buffer.from(sig, "base64");
        const expectedBuffer = Buffer.from(expectedHmac, "base64");
        if (
          sigBuffer.length === expectedBuffer.length &&
          crypto.timingSafeEqual(sigBuffer, expectedBuffer)
        ) {
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    logger.error("Failed to verify Svix signature:", err);
    return false;
  }
}
