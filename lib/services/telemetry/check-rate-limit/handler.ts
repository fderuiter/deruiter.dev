import { logger } from "@/lib/logger";
import {
  extractClientIp,
  generateClientConnectionHash,
} from "@/lib/services/privacy";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  CIRCUIT_BREAKER_COOLDOWN_MS,
  MAX_REQUESTS_PER_WINDOW,
  RATE_LIMIT_TIMEOUT_MS,
  checkAndSwapTelemetryPassive,
  getActiveGeneration,
  getCircuitBreakerCooldownUntil,
  getInactiveGeneration,
  getTelemetryRateLimiter,
  setCircuitBreakerCooldownUntil,
  type LocalCacheEntry,
} from "../shared";
import {
  CheckTelemetryRateLimitInputSchema,
  type CheckTelemetryRateLimitInput,
  type CheckTelemetryRateLimitResult,
  type CheckTelemetryRateLimitSpec,
} from "./spec";

export interface RateLimiterLike {
  limit(identifier: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
}

export interface CheckTelemetryRateLimitDeps {
  getRateLimiter?: () => RateLimiterLike;
  extractIp?: typeof extractClientIp;
  hashIp?: typeof generateClientConnectionHash;
  clock?: () => number;
}

/**
 * Handler for anonymous telemetry rate-limit checks backed by double-buffered passive generation maps and a 30s circuit breaker.
 */
export class CheckTelemetryRateLimitHandler implements CheckTelemetryRateLimitSpec {
  private readonly getRateLimiter: () => RateLimiterLike;
  private readonly extractIp: typeof extractClientIp;
  private readonly hashIp: typeof generateClientConnectionHash;
  private readonly clock: () => number;

  constructor(deps: CheckTelemetryRateLimitDeps = {}) {
    this.getRateLimiter = deps.getRateLimiter ?? getTelemetryRateLimiter;
    this.extractIp = deps.extractIp ?? extractClientIp;
    this.hashIp = deps.hashIp ?? generateClientConnectionHash;
    this.clock = deps.clock ?? Date.now;
  }

  async execute(
    input: CheckTelemetryRateLimitInput
  ): Promise<CheckTelemetryRateLimitResult> {
    const parsed = CheckTelemetryRateLimitInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid rate-limit request input",
        { recoverable: true, details: parsed.error }
      );
    }

    try {
      checkAndSwapTelemetryPassive();

      const ip = this.extractIp(parsed.data.request);
      const ipHash = await this.hashIp(ip);
      const now = this.clock();

      const activeGeneration = getActiveGeneration();
      const inactiveGeneration = getInactiveGeneration();
      const cooldownUntil = getCircuitBreakerCooldownUntil();
      const isCircuitActive = now < cooldownUntil;

      const buildLocalHeaders = (entry: LocalCacheEntry) => ({
        "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
        "X-RateLimit-Remaining": String(
          Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count)
        ),
        "X-RateLimit-Reset": String(Math.ceil(entry.expiresAt / 1000)),
      });

      let cached = activeGeneration.get(ipHash);
      if (!cached) {
        cached = inactiveGeneration.get(ipHash);
      }

      if (isCircuitActive) {
        if (cached && now < cached.expiresAt) {
          cached.count += 1;
          cached.expiresAt = Math.max(cached.expiresAt, cooldownUntil);
        } else {
          cached = {
            count: 1,
            expiresAt: Math.max(cooldownUntil, now + 5000),
          };
          activeGeneration.set(ipHash, cached);
        }

        return createSuccess({
          limited: cached.count > MAX_REQUESTS_PER_WINDOW,
          headers: buildLocalHeaders(cached),
        });
      }

      if (cached && now < cached.expiresAt) {
        if (cached.count < MAX_REQUESTS_PER_WINDOW) {
          cached.count += 1;
          return createSuccess({
            limited: false,
            headers: buildLocalHeaders(cached),
          });
        }
      }

      try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `Upstream rate limiting request timed out after ${RATE_LIMIT_TIMEOUT_MS}ms`
              )
            );
          }, RATE_LIMIT_TIMEOUT_MS);
          timer.unref?.();
        });

        let result;
        try {
          result = await Promise.race([
            this.getRateLimiter().limit(ipHash),
            timeoutPromise,
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }

        const headers = {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
        };

        if (result.success) {
          activeGeneration.set(ipHash, {
            count: MAX_REQUESTS_PER_WINDOW - result.remaining,
            expiresAt: Math.min(result.reset, now + 5000),
          });
          return createSuccess({ limited: false, headers });
        }

        activeGeneration.delete(ipHash);
        inactiveGeneration.delete(ipHash);
        return createSuccess({ limited: true, headers });
      } catch (err) {
        logger.error(
          "Upstream rate limiting check failed, activating 30s circuit breaker fallback:",
          err
        );
        const nextCooldown = now + CIRCUIT_BREAKER_COOLDOWN_MS;
        setCircuitBreakerCooldownUntil(nextCooldown);

        if (cached && now < cached.expiresAt) {
          cached.count += 1;
          cached.expiresAt = Math.max(cached.expiresAt, nextCooldown);
        } else {
          cached = {
            count: 1,
            expiresAt: nextCooldown,
          };
          activeGeneration.set(ipHash, cached);
        }

        return createSuccess({
          limited: cached.count > MAX_REQUESTS_PER_WINDOW,
          headers: buildLocalHeaders(cached),
        });
      } finally {
        if (activeGeneration.size > 5000) {
          for (const [key, entry] of activeGeneration.entries()) {
            if (this.clock() >= entry.expiresAt) {
              activeGeneration.delete(key);
            }
          }
        }
      }
    } catch (error) {
      return createFailure(
        "RATE_LIMIT_CHECK_FAILED",
        "Failed to evaluate telemetry rate limit",
        { recoverable: true, details: error }
      );
    }
  }
}
