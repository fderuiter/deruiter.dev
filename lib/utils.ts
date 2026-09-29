import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface EscapeXmlOptions {
  /**
   * Entity format for single quote escaping.
   * - '&apos;' for standard XML (default)
   * - '&#39;' for numeric single quote entity (used in term validation and attribute escaping)
   */
  singleQuoteEntity?: "&apos;" | "&#39;" | boolean;
}

/**
 * Parameterized text escaper.
 * Escapes XML special characters securely.
 * Supports configurable single quote entity formatting.
 */
export function escapeXml(
  unsafe: unknown,
  options?: EscapeXmlOptions | "&apos;" | "&#39;" | boolean
): string {
  if (unsafe === null || unsafe === undefined) return "";
  const str = typeof unsafe === "string" ? unsafe : String(unsafe);
  if (!str) return "";

  let singleQuote = "&apos;";
  if (typeof options === "boolean") {
    singleQuote = options ? "&#39;" : "&apos;";
  } else if (typeof options === "string") {
    singleQuote = options;
  } else if (options && options.singleQuoteEntity !== undefined) {
    if (typeof options.singleQuoteEntity === "boolean") {
      singleQuote = options.singleQuoteEntity ? "&#39;" : "&apos;";
    } else {
      singleQuote = options.singleQuoteEntity;
    }
  }

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, singleQuote);
}

import {
  extractClientIp,
  generateClientConnectionHashSync,
  extractHeaderValue,
  type RequestOrHeaders,
} from "@/lib/services/privacy-service";

export type { RequestOrHeaders };

/**
 * Extracts client IP address from proxy request headers with trimmed whitespace.
 * Utility alias wrapper over primary privacy service implementation.
 */
export function getClientIp(reqOrHeaders?: RequestOrHeaders): string {
  return extractClientIp(reqOrHeaders);
}

/**
 * Computes an anonymous device hash incorporating trimmed proxy IP and optional User-Agent.
 * Utility alias wrapper forwarding callers to standard privacy service hashing primitives.
 */
export function getAnonymousDeviceHash(
  reqOrHeaders?: RequestOrHeaders,
  includeUserAgent: boolean = true
): string {
  const ip = extractClientIp(reqOrHeaders);

  let userAgent = "";
  if (includeUserAgent && reqOrHeaders) {
    userAgent = extractHeaderValue(reqOrHeaders, "user-agent") || "";
  }

  const input = includeUserAgent && userAgent ? `${ip}:${userAgent}` : ip;
  return generateClientConnectionHashSync(input);
}

/**
 * Standardized random identifier generator.
 * Generates element or component IDs using a clean hash string.
 */
export function generateId(prefix?: string): string {
  let randomPart = "";
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 9);
    } catch {
      randomPart = Math.random().toString(36).substring(2, 11);
    }
  } else {
    randomPart = Math.random().toString(36).substring(2, 11);
  }

  if (!prefix) return randomPart;
  return prefix.endsWith("-") || prefix.endsWith("_")
    ? `${prefix}${randomPart}`
    : `${prefix}-${randomPart}`;
}

export const generateRandomId = generateId;

/**
 * Validates whether a date string is valid clinical ISO-8601 format.
 */
export function isValidIsoDate(dateString?: string | null): boolean {
  if (!dateString || typeof dateString !== "string") return false;
  const isoRegex =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!isoRegex.test(dateString.trim())) return false;

  const timestamp = Date.parse(dateString);
  return !isNaN(timestamp);
}

/**
 * Formats a date into clinical ISO-8601 UTC timestamp format.
 */
export function formatIsoDate(date?: Date | string | number | null): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString();
  } catch {
    return "";
  }
}

/**
 * Formats a date for user presentation (UI timestamps).
 */
export function formatDisplayDate(
  date?: Date | string | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    };

    return new Intl.DateTimeFormat("en-US", defaultOptions).format(d);
  } catch {
    return "";
  }
}

/**
 * Formats a date relative to now (e.g. 'Just now', '5m ago', '2h ago', '3d ago').
 */
export function formatRelativeTime(
  date?: Date | string | number | null
): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    const time = d.getTime();
    if (isNaN(time)) return "";

    const now = Date.now();
    const diffMs = now - time;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 30) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    return formatDisplayDate(d);
  } catch {
    return "";
  }
}

export { cloneDeep } from "./utils/clone";
