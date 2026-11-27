import { extractClientIp, generateClientConnectionHash } from "@/lib/privacy";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "../../service-result";
import {
  checkAndSwapTelemetryPassive,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  getCircuitBreakerCooldownUntil,
  getTelemetryActiveGeneration,
  getTelemetryInactiveGeneration,
  getTelemetryRateLimiter,
  MAX_REQUESTS_PER_WINDOW,
  RATE_LIMIT_TIMEOUT_MS,
  setCircuitBreakerCooldownUntil,
  type LocalCacheEntry,
} from "../shared";
import {
  CheckTelemetryRateLimitInputSchema,
  type CheckTelemetryRateLimitInput,
  type CheckTelemetryRateLimitResult,
  type CheckTelemetryRateLimitSpec,
} from "./spec";

const TIMEOUT_SENTINEL = Symbol("rate-limit-timeout");

export interface TelemetryRateLimiterPort {
  limit(identifier: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
}

export interface CheckTelemetryRateLimitDeps {
  getRateLimiter?: () => TelemetryRateLimiterPort;
  hashIp?: (ip: string) => Promise<string>;
}

export class CheckTelemetryRateLimitHandler implements CheckTelemetryRateLimitSpec {
  private readonly resolveLimiter: () => TelemetryRateLimiterPort;
  private readonly hashIpFn: (ip: string) => Promise<string>;

  constructor(deps?: CheckTelemetryRateLimitDeps) {
    this.resolveLimiter = deps?.getRateLimiter ?? getTelemetryRateLimiter;
    this.hashIpFn = deps?.hashIp ?? generateClientConnectionHash;
  }

  async execute(
    input: CheckTelemetryRateLimitInput
  ): Promise<CheckTelemetryRateLimitResult> {
    const parsed = CheckTelemetryRateLimitInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid rate-limit request", {
        recoverable: false,
        details: parsed.error,
      });
    }

    checkAndSwapTelemetryPassive();

    const activeGeneration = getTelemetryActiveGeneration();
    const inactiveGeneration = getTelemetryInactiveGeneration();
    const buildLocalHeaders = (entry: LocalCacheEntry) => ({
      "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
      "X-RateLimit-Remaining": String(
        Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count)
      ),
      "X-RateLimit-Reset": String(Math.ceil(entry.expiresAt / 1000)),
    });

    try {
      const ip = extractClientIp(parsed.data.request);
      const ipHash = await this.hashIpFn(ip);
      const now = Date.now();
      const cooldownUntil = getCircuitBreakerCooldownUntil();
      const isCircuitActive = now < cooldownUntil;

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
        const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>(
          (resolve) => {
            timer = setTimeout(
              () => resolve(TIMEOUT_SENTINEL),
              RATE_LIMIT_TIMEOUT_MS
            );
            timer.unref?.();
          }
        );

        let raced:
          | Awaited<ReturnType<TelemetryRateLimiterPort["limit"]>>
          | typeof TIMEOUT_SENTINEL;
        try {
          raced = await Promise.race([
            this.resolveLimiter().limit(ipHash),
            timeoutPromise,
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }

        if (raced === TIMEOUT_SENTINEL) {
          const timeoutErr = new Error(
            `Upstream rate limiting request timed out after ${RATE_LIMIT_TIMEOUT_MS}ms`
          );
          logger.error(
            "Upstream rate limiting check failed, activating 30s circuit breaker fallback:",
            timeoutErr
          );
          const nextCooldown = now + CIRCUIT_BREAKER_COOLDOWN_MS;
          setCircuitBreakerCooldownUntil(nextCooldown);

          if (cached && now < cached.expiresAt) {
            cached.count += 1;
            cached.expiresAt = Math.max(cached.expiresAt, nextCooldown);
          } else {
            cached = { count: 1, expiresAt: nextCooldown };
            activeGeneration.set(ipHash, cached);
          }

          return createSuccess({
            limited: cached.count > MAX_REQUESTS_PER_WINDOW,
            headers: buildLocalHeaders(cached),
          });
        }

        const headers = {
          "X-RateLimit-Limit": String(raced.limit),
          "X-RateLimit-Remaining": String(raced.remaining),
          "X-RateLimit-Reset": String(Math.ceil(raced.reset / 1000)),
        };

        if (raced.success) {
          activeGeneration.set(ipHash, {
            count: MAX_REQUESTS_PER_WINDOW - raced.remaining,
            expiresAt: Math.min(raced.reset, now + 5000),
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
          cached = { count: 1, expiresAt: nextCooldown };
          activeGeneration.set(ipHash, cached);
        }

        return createSuccess({
          limited: cached.count > MAX_REQUESTS_PER_WINDOW,
          headers: buildLocalHeaders(cached),
        });
      } finally {
        if (activeGeneration.size > 5000) {
          for (const [key, entry] of activeGeneration.entries()) {
            if (Date.now() >= entry.expiresAt) {
              activeGeneration.delete(key);
            }
          }
        }
      }
    } catch (error) {
      return createFailure("INVALID_INPUT", "Failed to evaluate rate limit", {
        recoverable: true,
        details: error,
      });
    }
  }
}
