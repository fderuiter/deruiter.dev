/**
 * Safe error reporting for the randomization work area (ticket #4005).
 *
 * Study names, protocol IDs, seeds, factor values, arm labels, rows and
 * imported documents stay in the visitor's browser. Anything that may reach
 * analytics, error reporting, breadcrumbs or a URL carries only a stable
 * code from the closed list below.
 */

import type { ValidationFindingCode } from "../../types";
import type { DisclosureDenialCode } from "./policy";

/** Codes for runtime failures that are not validation findings. */
export type RandomizationRuntimeErrorCode =
  | "SUBJECT_ID_COLLISION"
  | "SUBJECT_ID_MASK_INVALID"
  | "RANDOMIZATION_UNKNOWN_ERROR";

/** Every code the work area may report outside the browser. */
export type RandomizationSafeErrorCode =
  ValidationFindingCode | DisclosureDenialCode | RandomizationRuntimeErrorCode;

const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

const RUNTIME_CODES: ReadonlySet<string> =
  new Set<RandomizationRuntimeErrorCode>([
    "SUBJECT_ID_COLLISION",
    "SUBJECT_ID_MASK_INVALID",
    "RANDOMIZATION_UNKNOWN_ERROR",
  ]);

/**
 * Error thrown by the randomization engine. `message` is always the code,
 * so a captured exception carries no study content.
 */
export class RandomizationError extends Error {
  readonly code: RandomizationSafeErrorCode;

  constructor(code: RandomizationSafeErrorCode) {
    super(code);
    this.name = "RandomizationError";
    this.code = code;
  }
}

/** A report that is safe to send to telemetry or error reporting. */
export interface SafeRandomizationErrorReport {
  readonly source: "randomization";
  readonly code: RandomizationSafeErrorCode;
}

function isSafeCode(value: unknown): value is RandomizationSafeErrorCode {
  return typeof value === "string" && SAFE_CODE_PATTERN.test(value);
}

/**
 * Reduces any thrown value or validation finding to a stable code. Messages,
 * field paths, estimated values and stacks are dropped.
 */
export function toSafeRandomizationErrorReport(
  error: unknown
): SafeRandomizationErrorReport {
  if (error instanceof RandomizationError && isSafeCode(error.code)) {
    return { source: "randomization", code: error.code };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    !(error instanceof Error)
  ) {
    const finding = error as Record<string, unknown>;
    // A validation finding: its code comes from the closed finding list.
    if (
      isSafeCode(finding.code) &&
      typeof finding.severity === "string" &&
      typeof finding.fieldPath === "string"
    ) {
      return { source: "randomization", code: finding.code };
    }
  }
  if (error instanceof Error && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && RUNTIME_CODES.has(code)) {
      return {
        source: "randomization",
        code: code as RandomizationRuntimeErrorCode,
      };
    }
  }
  return { source: "randomization", code: "RANDOMIZATION_UNKNOWN_ERROR" };
}

/**
 * Returns an Error whose message and name hold only the safe code, for
 * passing to an error reporter.
 */
export function toReportableRandomizationError(error: unknown): Error {
  const report = toSafeRandomizationErrorReport(error);
  const reportable = new Error(`randomization:${report.code}`);
  reportable.name = "RandomizationError";
  reportable.stack = undefined;
  return reportable;
}
