import {
  extractClientIp,
  generateClientConnectionHashSync,
  type RequestOrHeaders,
} from "@/lib/services/privacy";

/**
 * Synchronous Rule-Based Profanity & Rant Barrier
 * Lightweight, zero-dependency content moderation engine and anonymous rate limiter.
 */

export interface ModerationResult {
  isValid: boolean;
  reason?: string;
  matchedPattern?: string;
}

export const COMMUNITY_TONE_ERROR_MESSAGE =
  "Submission rejected: Content violates community tone standards. Please ensure your submission uses constructive and respectful language.";

/**
 * Normalizes input text by converting to lowercase, replacing common leetspeak substitutions,
 * and stripping obstructive character separators between letters.
 */
export function normalizeText(input: string): string {
  if (!input) return "";

  let text = input.toLowerCase();

  // Strip punctuation embedded between word characters (e.g. f.u.c.k, s!h!i!t, s-h-i-t)
  text = text.replace(
    /([a-z0-9])[\.\*\-\_\!\@\#\$\%\^\&\(\)]+(?=[a-z0-9])/gi,
    "$1"
  );

  // Replace common leetspeak character substitutions for remaining standalone characters
  text = text
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[1|]/g, "i")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/7/g, "t");

  return text;
}

/**
 * Predefined profanity patterns with word boundaries to prevent false positives.
 */
const PROFANITY_PATTERNS: RegExp[] = [
  /\b(f+[u*@]+c+k+|f+[u*@]+c+k+i+n+g*|f+[u*@]+c+k+e+r+|f+[u*@]+c+k+o+f+f+)\b/i,
  /\b(s+h+[i!1]*t+|s+h+[i!1]*t+t+y+|b+u+l+l+s+h+[i!1]*t+)\b/i,
  /\b(b+[i!1]+t+c+h+|b+[i!1]+t+c+h+e+s+|b+[i!1]+t+c+h+i+n+g+)\b/i,
  /\b(a+s+s+h+o+l+e+|a+s+s+h+o+l+e+s+|@+s+s+h+o+l+e+)\b/i,
  /\b(b+a+s+t+a+r+d+|b+a+s+t+a+r+d+s+)\b/i,
  /\b(c+u+n+t+|c+u+n+t+s+)\b/i,
  /\b(d+i+c+k+|d+i+c+k+h+e+a+d+)\b/i,
  /\b(p+i+s+s+|p+i+s+s+e+d+|p+i+s+s+i+n+g+)\b/i,
  /\b(m+o+t+h+e+r+f+[u*@]+c+k+e+r+|m+o+t+h+e+r+f+[u*@]+c+k+i+n+g+)\b/i,
  /\b(c+o+c+k+|c+o+c+k+s+u+c+k+e+r+)\b/i,
  /\b(p+r+i+c+k+|p+r+i+c+k+s+)\b/i,
  /\b(w+h+o+r+e+|s+l+u+t+)\b/i,
];

/**
 * Predefined toxic and unconstructive rant patterns.
 */
const TOXIC_RANT_PATTERNS: RegExp[] = [
  /\b(complete|total|utter|useless|worthless|pure|absolute)\s+(garbage|trash|junk|bs|crap)\b/i,
  /\bthis\s+(is\s+)?(garbage|trash|shit|bs|junk|useless|worthless)\b/i,
  /\b(waste\s+of\s+time|waste\s+of\s+space)\b/i,
  /\b(this\s+sucks|it\s+sucks|everything\s+sucks)\b/i,
  /\b(piece\s+of\s+shit|piece\s+of\s+junk)\b/i,
  /\b(screw\s+this|screw\s+you)\b/i,
  /\b(complete\s+idiot|total\s+idiot|utter\s+idiot)\b/i,
  /\bstop\s+posting\s+(garbage|trash|shit|bs)\b/i,
  /\b(worst\s+ever|worst\s+code\s+ever|garbage\s+code|trash\s+code)\b/i,
];

/**
 * Validates text input against profanity and toxic rant pattern rules.
 * Synchronous, zero-dependency, and completes in < 1ms.
 */
export function validateConstructiveContent(input: string): ModerationResult {
  if (!input || typeof input !== "string") {
    return { isValid: true };
  }

  const raw = input.trim();
  const normalized = normalizeText(raw);

  // Check profanity patterns on raw and normalized text
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        isValid: false,
        reason: COMMUNITY_TONE_ERROR_MESSAGE,
        matchedPattern: "blocked_profanity",
      };
    }
  }

  // Check toxic rant patterns on raw and normalized text
  for (const pattern of TOXIC_RANT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        isValid: false,
        reason: COMMUNITY_TONE_ERROR_MESSAGE,
        matchedPattern: "toxic_rant_pattern",
      };
    }
  }

  return { isValid: true };
}

/**
 * Submission attempt tracking store (indexed purely by anonymous connection hash).
 * Stores timestamps only — zero PII recorded or stored.
 */
const submissionAttempts = new Map<string, number[]>();

/**
 * Enforces anonymous rate limiting on content submission attempts using request hashes.
 */
export function checkSubmissionAttemptRateLimit(
  connectionHash: string,
  maxAttempts = 10,
  windowMs = 60000
): { isRateLimited: boolean; remaining: number } {
  if (!connectionHash) {
    return { isRateLimited: false, remaining: maxAttempts };
  }

  const now = Date.now();
  const cutoff = now - windowMs;

  const attempts = submissionAttempts.get(connectionHash) || [];
  const validAttempts = attempts.filter((ts) => ts > cutoff);

  if (validAttempts.length >= maxAttempts) {
    submissionAttempts.set(connectionHash, validAttempts);
    return { isRateLimited: true, remaining: 0 };
  }

  validAttempts.push(now);
  submissionAttempts.set(connectionHash, validAttempts);

  return {
    isRateLimited: false,
    remaining: maxAttempts - validAttempts.length,
  };
}

/**
 * Synchronously computes anonymous connection hash and checks submission rate limit.
 */
export function checkRequestSubmissionRateLimit(
  reqOrHeaders?: RequestOrHeaders,
  maxAttempts = 10,
  windowMs = 60000
): { isRateLimited: boolean; remaining: number; connectionHash: string } {
  const ip = extractClientIp(reqOrHeaders);
  const hash = generateClientConnectionHashSync(ip);
  const result = checkSubmissionAttemptRateLimit(hash, maxAttempts, windowMs);
  return { ...result, connectionHash: hash };
}

/**
 * Resets submission attempt history for a connection hash (used in unit tests).
 */
export function resetSubmissionAttemptRateLimit(): void {
  submissionAttempts.clear();
}
