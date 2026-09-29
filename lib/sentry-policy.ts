/**
 * Shared Sentry quota and noise policy.
 *
 * AGENTS.md section 22 and ADR 0036 bound Sentry to its free-tier entitlement of
 * 5k errors and 10k spans per month. The three init sites (server, edge and the
 * lazy browser client) previously each hardcoded full sampling, so the stated
 * bound held only on paper. They now share this module.
 */

import { isProductionEnvironment } from "./env";

/** Ceiling on production trace sampling imposed by ADR 0036. */
export const MAX_PRODUCTION_TRACES_SAMPLE_RATE = 0.05;

/**
 * Sentry 11 removed `sendDefaultPii` and now collects user info, cookies,
 * headers, bodies and query parameters unless told otherwise. This is the
 * explicit opt-out that preserves the previous `sendDefaultPii: false`
 * behaviour at every init site.
 */
export const SENTRY_DATA_COLLECTION: {
  userInfo: boolean;
  cookies: boolean;
  httpHeaders: boolean;
  httpBodies: never[];
  urlQueryParams: boolean;
} = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
};

/**
 * Resolves the trace sampling rate for the current deployment.
 *
 * Production is decided by `isProductionEnvironment`, which reads the validated
 * `VERCEL_ENV`. That distinction matters: `NODE_ENV` is `"production"` for
 * preview builds as well, so branching on it would spend span quota on every
 * preview deployment. Anything that is not a production deployment, including
 * preview, development and test, samples nothing.
 *
 * @param isProduction - Override for the deployment check, for tests.
 * @returns The sampling rate, either the production ceiling or zero.
 */
export function resolveTracesSampleRate(
  isProduction: boolean = isProductionEnvironment()
): number {
  return isProduction ? MAX_PRODUCTION_TRACES_SAMPLE_RATE : 0;
}

/**
 * Reports whether captured events belong in Sentry at all.
 *
 * Span sampling alone does not bound the error budget: `beforeSend` runs for
 * every captured exception regardless of `tracesSampleRate`, so a developer
 * running `next dev` against the production DSN spends the 5k monthly error
 * allowance on hot-reload aborts and local timeouts. Only a production
 * deployment produces errors anyone can act on, so only production reports.
 *
 * @param isProduction - Override for the deployment check, for tests.
 * @returns True when the event should be transmitted.
 */
export function isReportableEnvironment(
  isProduction: boolean = isProductionEnvironment()
): boolean {
  return isProduction;
}

/** Error names and message fragments that carry no diagnostic value. */
const BENIGN_ERROR_NAMES = new Set(["AbortError", "GameEngineException"]);

const BENIGN_MESSAGE_FRAGMENTS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Raised by the streaming renderer when a visitor navigates away before the
  // response finishes. The abort is the visitor's, not a fault in the route.
  "The destination stream closed early",
];

/** Extension schemes that report faults belonging to the visitor's browser. */
const EXTENSION_SOURCE_FRAGMENTS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
];

/**
 * Reports whether a captured exception is benign client noise that should never
 * consume error quota.
 *
 * Covers aborted fetches, the two benign `ResizeObserver` notifications, faults
 * originating in browser extensions, and the simulated game engine exceptions
 * the arcade raises deliberately.
 *
 * @param error - The original exception from the Sentry hint.
 * @param stack - Optional stack or source URL to test for an extension origin.
 * @returns True when the event should be discarded.
 */
export function isBenignClientNoise(error: unknown, stack?: string): boolean {
  const name =
    error instanceof Error
      ? error.name
      : typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name)
        : (error as { constructor?: { name?: string } })?.constructor?.name;

  if (name && BENIGN_ERROR_NAMES.has(name)) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : typeof error === "string"
          ? error
          : "";

  if (BENIGN_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))) {
    return true;
  }

  const source = stack ?? (error instanceof Error ? (error.stack ?? "") : "");
  return EXTENSION_SOURCE_FRAGMENTS.some((fragment) =>
    source.includes(fragment)
  );
}
