import crypto from "crypto";
import { z } from "zod";
import { resolveBaseUrl } from "@/lib/domain";
import type { ServiceResult } from "@/lib/services/service-result";

/**
 * Most announcement emails a single maintenance run may enqueue (#841).
 */
export const NEWSLETTER_DISPATCH_CAP = 10;

/**
 * Posts published this recently without a dispatch are announced even when published directly in DB.
 */
export const ANNOUNCE_DISCOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A pending subscriber is re-sent a confirmation at most this often. */
export const CONFIRMATION_RESEND_INTERVAL_MS = 60 * 60 * 1000;

export type NewsletterTokenOutcome =
  | "confirmed"
  | "already_confirmed"
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid";

export interface NewsletterDispatchCounts extends Record<string, number> {
  openDispatches: number;
  queued: number;
  skippedSuppressed: number;
  completedDispatches: number;
  capacity: number;
}

export const NewsletterDispatchErrorCode = z.enum([
  "ENQUEUE_FAILED",
  "DISPATCH_FAILED",
  "INVALID_INPUT",
]);
export type NewsletterDispatchErrorCode = z.infer<
  typeof NewsletterDispatchErrorCode
>;

export type NewsletterDispatchResult = ServiceResult<
  NewsletterDispatchCounts,
  NewsletterDispatchErrorCode
>;

export interface NullQueueDeliveriesAuditOptions {
  page?: number;
  pageSize?: number;
}

export interface NullQueueDeliveriesAudit {
  totalNullQueue: number;
  page: number;
  pageSize: number;
  intentionalSkips: Array<{
    deliveryId: string;
    dispatchId: string;
    subscriberId: string;
    suppressionReason?: string;
  }>;
  orphanedClaims: Array<{
    deliveryId: string;
    dispatchId: string;
    subscriberId: string;
  }>;
}

export const NullQueueAuditErrorCode = z.enum([
  "AUDIT_FAILED",
  "INVALID_INPUT",
]);
export type NullQueueAuditErrorCode = z.infer<typeof NullQueueAuditErrorCode>;

export type NullQueueAuditResult = ServiceResult<
  NullQueueDeliveriesAudit,
  NullQueueAuditErrorCode
>;

export function newNewsletterToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function confirmUrl(token: string): string {
  return `${resolveBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

/** One-click unsubscribe URL; also the List-Unsubscribe target (RFC 8058). */
export function unsubscribeUrl(token: string): string {
  return `${resolveBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Headers that let mail clients offer one-click unsubscribe (RFC 2369, 8058). */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
