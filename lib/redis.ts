import { Redis } from "@upstash/redis";
import { getEnv } from "./env";

/**
 * Checks whether Upstash Redis is actively configured with valid credentials.
 * Returns false in local, test, or offline environments where dummy fallback
 * URLs or tokens are detected.
 *
 * @returns True if valid Upstash Redis credentials are present in environment variables.
 */
export function isRedisConfigured(): boolean {
  const currentEnv = getEnv();
  const rawUrl = currentEnv.UPSTASH_REDIS_REST_URL;
  const rawToken = currentEnv.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(
    rawUrl &&
    rawToken &&
    !rawUrl.includes("localhost:8079") &&
    rawToken !== "example_token" &&
    rawToken !== "example_dev_token"
  );
}

const createRedisClient = () => {
  const currentEnv = getEnv();
  return new Redis({
    url: currentEnv.UPSTASH_REDIS_REST_URL || "http://localhost:8079",
    token: currentEnv.UPSTASH_REDIS_REST_TOKEN || "example_token",
    // Without this, @upstash/redis sends every command with fetch cache
    // "no-store", and a no-store fetch during render makes Next render the
    // page per request: every ISR page that reads Redis (home, blog, case
    // studies) lost its cache in production (#3031). "default" is what Next
    // treats as no cache option: the POST is still never stored in the data
    // cache, but the route stays static and regenerates on its revalidate.
    cache: "default",
  });
};

type RedisClientType = ReturnType<typeof createRedisClient>;

const globalForRedis = globalThis as unknown as {
  redis: RedisClientType | undefined;
};

export const redis = globalForRedis.redis ?? createRedisClient();

if (getEnv().NODE_ENV !== "production") globalForRedis.redis = redis;

/**
 * Resolves the active key prefix for Upstash Redis operations.
 *
 * Isolation policy:
 * 1. If explicit UPSTASH_REDIS_KEY_PREFIX is provided, use it.
 * 2. If VERCEL_ENV === "preview", isolate with "preview:" prefix to prevent
 *    ephemeral PR deployments from colliding with production queues or rate limits.
 * 3. In production, default is "" (unprefixed) to maintain backward compatibility
 *    with existing queues and keys.
 * 4. In test / dev environments, default is "" unless explicitly configured.
 */
export function getRedisKeyPrefix(): string {
  const currentEnv = getEnv();
  if (currentEnv.UPSTASH_REDIS_KEY_PREFIX) {
    return currentEnv.UPSTASH_REDIS_KEY_PREFIX;
  }
  if (currentEnv.VERCEL_ENV === "preview") {
    return "preview:";
  }
  return "";
}

/**
 * Returns a namespaced key prefixed with the active environment namespace.
 */
export function getScopedRedisKey(key: string): string {
  const prefix = getRedisKeyPrefix();
  return prefix ? `${prefix}${key}` : key;
}
