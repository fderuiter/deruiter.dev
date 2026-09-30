import * as Sentry from "@sentry/nextjs";
import { sanitizeError, sanitizeString } from "@/lib/error-sanitization";

/**
 * Supported severity levels for structured telemetry logging.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Internal structured log entry payload representation.
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Options for configuring the StructuredLogger instance.
 */
export interface LoggerOptions {
  /** Enables telemetry and Sentry reporting (defaults to true). */
  enableTelemetry?: boolean;
  /** Silence console output in specific test environments if set. */
  silent?: boolean;
}

/** Nesting depth beyond which metadata values are replaced rather than walked. */
const MAX_META_DEPTH = 5;

/**
 * Applies the same scrubbing to metadata that the message and error receive:
 * strings go through sanitizeString and nested errors through sanitizeError.
 * Plain objects and arrays are copied, never mutated, and circular or overly
 * deep structures are replaced with a placeholder.
 */
function sanitizeMetaValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) return sanitizeError(value);
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_META_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    seen.add(value);
    const copy = value.map((item) => sanitizeMetaValue(item, depth + 1, seen));
    seen.delete(value);
    return copy;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    // Dates, Maps and class instances pass through unchanged.
    return value;
  }

  seen.add(value);
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = sanitizeMetaValue(item, depth + 1, seen);
  }
  seen.delete(value);
  return copy;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return sanitizeMetaValue(meta, 0, new WeakSet()) as Record<string, unknown>;
}

/**
 * Centralized Telemetry Logger Wrapper.
 * Standardizes structured logging across client views, server components, and API routes.
 * Integrates error sanitization, Sentry error tracking, and telemetry event dispatching.
 */
export class StructuredLogger {
  private enableTelemetry: boolean;
  private silent: boolean;

  constructor(options: LoggerOptions = {}) {
    this.enableTelemetry = options.enableTelemetry ?? true;
    this.silent = options.silent ?? false;
  }

  /**
   * Logs a debug-level message with optional metadata.
   *
   * @param message Primary log message description.
   * @param meta Optional metadata context object.
   */
  public debug(message: string, meta?: Record<string, unknown>): LogEntry {
    return this.log("debug", message, undefined, meta);
  }

  /**
   * Logs an info-level message with optional metadata.
   *
   * @param message Primary log message description.
   * @param meta Optional metadata context object.
   */
  public info(message: string, meta?: Record<string, unknown>): LogEntry {
    return this.log("info", message, undefined, meta);
  }

  /**
   * Logs a warning-level message with optional error or metadata.
   *
   * @param message Primary log message description.
   * @param errorOrMeta Optional error instance, error description, or metadata object.
   * @param meta Optional metadata context object when second argument is an error.
   */
  public warn(
    message: string,
    errorOrMeta?: unknown,
    meta?: Record<string, unknown>
  ): LogEntry {
    let err: unknown = undefined;
    let metadata = meta;

    if (errorOrMeta !== undefined) {
      if (
        errorOrMeta !== null &&
        typeof errorOrMeta === "object" &&
        !(errorOrMeta instanceof Error) &&
        typeof (errorOrMeta as Record<string, unknown>).message !== "string" &&
        !metadata
      ) {
        metadata = errorOrMeta as Record<string, unknown>;
      } else {
        err = errorOrMeta;
      }
    }

    return this.log("warn", message, err, metadata);
  }

  /**
   * Logs an error-level message with optional error object and metadata context.
   *
   * @param message Primary error summary description.
   * @param error Optional error object or cause.
   * @param meta Optional metadata context object.
   */
  public error(
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>
  ): LogEntry {
    return this.log("error", message, error, meta);
  }

  /**
   * Central dispatch method for structured logging.
   *
   * @param level Log severity level.
   * @param message Log message text.
   * @param error Optional caught error or exception object.
   * @param meta Optional structured key-value metadata.
   */
  public log(
    level: LogLevel,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>
  ): LogEntry {
    const timestamp = new Date().toISOString();
    const sanitizedMsg =
      typeof message === "string" ? sanitizeString(message) : String(message);
    const consoleErr = error !== undefined ? sanitizeError(error) : undefined;
    const sanitizedMeta = meta ? sanitizeMeta(meta) : undefined;

    const entry: LogEntry = {
      level,
      message: sanitizedMsg,
      timestamp,
      ...(sanitizedMeta && Object.keys(sanitizedMeta).length > 0
        ? { meta: sanitizedMeta }
        : {}),
      ...(consoleErr !== undefined ? { error: consoleErr } : {}),
    };

    if (this.enableTelemetry && !meta?.skipTelemetry) {
      this.dispatchTelemetry(level, sanitizedMsg, error, sanitizedMeta);
    }

    if (!this.silent) {
      this.writeToConsole(level, sanitizedMsg, consoleErr, sanitizedMeta);
    }

    return entry;
  }

  private dispatchTelemetry(
    level: LogLevel,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>
  ): void {
    try {
      if (level === "error") {
        if (error) {
          Sentry.captureException(error, {
            extra: { message, ...meta },
          });
        } else {
          Sentry.captureMessage(message, {
            level: "error",
            extra: meta,
          });
        }
      } else if (level === "warn") {
        if (error) {
          Sentry.captureException(error, {
            level: "warning",
            extra: { message, ...meta },
          });
        } else if (meta && Object.keys(meta).length > 0) {
          Sentry.addBreadcrumb({
            category: "logger",
            message,
            level: "warning",
            data: meta,
          });
        }
      } else if (level === "info" && meta) {
        Sentry.addBreadcrumb({
          category: "logger",
          message,
          level: "info",
          data: meta,
        });
      }
    } catch {
      // Telemetry dispatch safety guard
    }
  }

  private writeToConsole(
    level: LogLevel,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>
  ): void {
    const args: unknown[] = [message];
    if (error !== undefined) args.push(error);
    if (meta !== undefined && Object.keys(meta).length > 0) args.push(meta);

    switch (level) {
      case "error":
        console.error(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "info":
        console.info(...args);
        break;
      case "debug":
        console.debug(...args);
        break;
    }
  }
}

/**
 * Shared singleton structured logger wrapper instance.
 */
export const logger = new StructuredLogger();
