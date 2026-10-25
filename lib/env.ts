import { z } from "zod";

/**
 * Server-side environment variables schema.
 * Secret keys that must never be exposed to the browser.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  VERCEL_ENV: z
    .enum(["production", "preview", "development"])
    .optional()
    .or(z.literal("")),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  PGHOST: z.string().optional(),
  PGHOST_UNPOOLED: z.string().optional(),
  PGUSER: z.string().optional(),
  PGDATABASE: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRES_URL_NO_SSL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  UPSTASH_REDIS_KEY_PREFIX: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  QSTASH_URL: z.string().url().optional().or(z.literal("")),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ADMIN_USER_IDS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .default("Frederick de Ruiter <notifications@deruiter.dev>"),
  CONTACT_NOTIFICATION_EMAIL: z.string().default("fpderuiter@gmail.com"),
  PLAYWRIGHT_TEST: z.string().optional(),
  PLAYWRIGHT_BROWSERS_PATH: z.string().optional(),
  npm_config_user_agent: z.string().optional(),
  CI: z.string().optional(),
  SKIP_DB_HEALTH_CHECK: z.string().optional(),
  ALLOW_FALLBACK_PRODUCTION_BUILD: z.string().optional(),
  ALLOW_DESTRUCTIVE_MIGRATIONS: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  VERCEL_GIT_COMMIT_REF: z.string().optional(),
  NEXT_PHASE: z.string().optional(),
  NEXT_RUNTIME: z.string().optional(),
  GITHUB_ACTIONS: z.string().optional(),
  VITEST: z.string().optional(),
  WS_NO_BUFFER_UTIL: z.string().optional(),
  WS_NO_UTF_8_VALIDATE: z.string().optional(),
});

// Enforce fallback WebSocket masking flags for bundled serverless runtimes
if (typeof process !== "undefined" && process.env) {
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
}

/**
 * Client-side environment variables schema (prefixed with NEXT_PUBLIC_).
 * Safe to be bundled and exposed in the browser.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AppEnv = ServerEnv & ClientEnv;

/**
 * Validate and parse environment variables against the defined schemas.
 * Returns parsed object and validation issues (if any).
 */
export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env
): {
  success: boolean;
  data: AppEnv;
  errors: Record<string, string[]>;
} {
  const serverResult = serverEnvSchema.safeParse(rawEnv);
  const clientResult = clientEnvSchema.safeParse(rawEnv);

  const errors: Record<string, string[]> = {};

  if (!serverResult.success) {
    for (const issue of serverResult.error.issues) {
      const key = issue.path.join(".");
      errors[key] = errors[key] || [];
      errors[key].push(issue.message);
    }
  }

  if (!clientResult.success) {
    for (const issue of clientResult.error.issues) {
      const key = issue.path.join(".");
      errors[key] = errors[key] || [];
      errors[key].push(issue.message);
    }
  }

  const data = {
    ...(rawEnv as Record<string, string>),
    ...(serverResult.success ? serverResult.data : ({} as ServerEnv)),
    ...(clientResult.success ? clientResult.data : ({} as ClientEnv)),
  } as AppEnv;

  return {
    success: serverResult.success && clientResult.success,
    data,
    errors,
  };
}

/**
 * The variables a browser bundle can see, each written out as
 * `process.env.NAME`.
 *
 * Next inlines a variable at build time only where code names it this way. A
 * browser bundle carries no populated `process.env` object, so parsing the
 * object alone gives every client module the schema defaults: `NODE_ENV`
 * reads "development" in a production build and every `NEXT_PUBLIC_*` value
 * is undefined (#2780). Every key of `clientEnvSchema` belongs here, and a
 * test holds the two lists together.
 */
function inlinedEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };
}

/**
 * Merge the runtime `process.env` object with the inlined values.
 *
 * On the server the two agree. In the browser the object is empty and the
 * inlined values are the only source, so an inlined value wins wherever it is
 * defined.
 *
 * @param processEnv - The runtime `process.env` object.
 * @param inlined - The values the bundler substituted, by name.
 * @returns The environment to validate.
 */
export function mergeInlinedEnv(
  processEnv: Record<string, string | undefined>,
  inlined: Record<string, string | undefined>
): Record<string, string | undefined> {
  const merged = { ...processEnv };
  for (const [key, value] of Object.entries(inlined)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

let cachedEnv: AppEnv | null = null;

/**
 * Get validated application environment object.
 * In development / production, logs formatted warnings if schema validation fails.
 */
export function getEnv(): AppEnv {
  if (cachedEnv && process.env.NODE_ENV === "production" && !process.env.VITEST)
    return cachedEnv;

  const result = validateEnv(mergeInlinedEnv(process.env, inlinedEnv()));
  if (
    !result.success &&
    process.env.NODE_ENV === "production" &&
    !process.env.VITEST
  ) {
    console.warn(
      "⚠️ [ENV VALIDATION WARNING] Environment schema issues detected:",
      result.errors
    );
  }

  if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
    cachedEnv = result.data;
  }
  return result.data;
}

/**
 * Centered dynamic helper to check if current deployment is production.
 * Uses the existing environment validation schema to prevent unvalidated configurations.
 */
export function isProductionEnvironment(): boolean {
  const currentEnv = getEnv();
  return currentEnv.VERCEL_ENV === "production";
}

/**
 * Reports whether the current process is a build rather than a running server.
 *
 * Next sets NEXT_PHASE itself while prerendering and the end-to-end harness sets
 * PLAYWRIGHT_TEST, so together they identify every context where modules are
 * imported to generate output rather than to serve a request.
 *
 * A production build has VERCEL_ENV set to "production", so a check for
 * production alone cannot distinguish static generation from serving traffic.
 * Callers that log only in production must combine the two, or a single build
 * emits one message per page per worker.
 */
export function isBuildPhase(): boolean {
  const currentEnv = getEnv();
  return (
    currentEnv.NEXT_PHASE === "phase-production-build" ||
    currentEnv.PLAYWRIGHT_TEST === "true"
  );
}

export const env = getEnv();

/**
 * Reports whether this is a production build, in the browser as on the server.
 *
 * It reads the inlined `process.env.NODE_ENV` directly, so it needs no schema
 * parse. `env.NODE_ENV` gives the same answer now that `getEnv` merges the
 * inlined values (#2780).
 */
export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * When this build ran, as an ISO 8601 timestamp, or null outside a build.
 *
 * `next.config.ts` sets `BUILD_TIMESTAMP` in its `env` block, so Next inlines
 * the value into the bundle at build time. It is not a deployment variable and
 * is not in the schema. Tests and `next dev` see null.
 */
export function buildTimestamp(): string | null {
  return process.env.BUILD_TIMESTAMP ?? null;
}
