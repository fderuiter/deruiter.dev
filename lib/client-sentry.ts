import {
  isBenignClientNoise,
  isReportableEnvironment,
  resolveTracesSampleRate,
  SENTRY_DATA_COLLECTION,
} from "./sentry-policy";
import { getEnv } from "./env";
import { logger } from "@/lib/logger";

export const isDummyOrMissingDsn = (dsn?: string): boolean => {
  if (!dsn || !dsn.trim()) return true;
  const lower = dsn.toLowerCase();
  return (
    lower.includes("dummy") ||
    lower.includes("example") ||
    lower.includes("0000") ||
    lower === "https://dummy@o0.ingest.sentry.io/0"
  );
};

let isInitialized = false;

export function resetSentryInitializationForTesting() {
  isInitialized = false;
}

/**
 * Dynamically initializes Sentry SDK if a valid DSN is provided.
 */
export async function initClientSentry(): Promise<boolean | null> {
  const dsn = getEnv().NEXT_PUBLIC_SENTRY_DSN;
  if (isDummyOrMissingDsn(dsn)) {
    return null;
  }

  if (isInitialized) {
    return true;
  }

  const Sentry = await import("@sentry/nextjs");
  const initFn =
    Sentry.init ||
    (Sentry as unknown as { default: typeof Sentry }).default?.init;
  if (typeof initFn === "function") {
    initFn({
      dsn,
      tracesSampleRate: resolveTracesSampleRate(),
      debug: false,
      dataCollection: SENTRY_DATA_COLLECTION,
      beforeSend(event, hint) {
        if (!isReportableEnvironment()) {
          return null;
        }
        if (isBenignClientNoise(hint?.originalException)) {
          return null;
        }
        return event;
      },
    });
  }
  isInitialized = true;
  return true;
}

/**
 * Dynamically captures exceptions in client error boundaries without statically bundling Sentry SDK.
 */
export async function reportClientError(error: unknown): Promise<void> {
  const dsn = getEnv().NEXT_PUBLIC_SENTRY_DSN;
  if (isDummyOrMissingDsn(dsn)) {
    return;
  }

  try {
    const isReady = await initClientSentry();
    if (isReady) {
      const Sentry = await import("@sentry/nextjs");
      const captureFn =
        Sentry.captureException ||
        (Sentry as unknown as { default: typeof Sentry }).default
          ?.captureException;
      if (typeof captureFn === "function") {
        captureFn(error);
      }
    }
  } catch (err) {
    logger.warn("Failed to dynamically load error telemetry SDK:", err);
  }
}
