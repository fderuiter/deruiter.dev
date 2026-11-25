import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { RedisTimeoutError, withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  getBaseBlogReactionCounts,
  getDefaultBlogReactionCounts,
} from "../shared";
import {
  GetBlogReactionsInputSchema,
  type GetBlogReactionsInput,
  type GetBlogReactionsResult,
  type GetBlogReactionsSpec,
} from "./spec";

export interface GetBlogReactionsDeps {
  redisClient?: {
    get<T = unknown>(key: string): Promise<T | null>;
    hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
      key: string
    ): Promise<T | null>;
    smembers(key: string): Promise<string[]>;
  };
  isRedisReady?: () => boolean;
}

/**
 * Handler for retrieving aggregated blog reactions via Zero-Neon-Wake Two-Tier Compute Shield (ADR 0036, ADR 0043 §3).
 * Never queries PostgreSQL or ephemeral in-memory Maps on public visitor read paths.
 */
export class GetBlogReactionsHandler implements GetBlogReactionsSpec {
  private readonly redisClient: NonNullable<
    GetBlogReactionsDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;

  constructor(deps: GetBlogReactionsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
  }

  async execute(input: GetBlogReactionsInput): Promise<GetBlogReactionsResult> {
    const parsed = GetBlogReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog reaction query",
        { recoverable: false, details: parsed.error }
      );
    }

    const { slug, connectionHash } = parsed.data;
    const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `blog:user_reactions:${slug}:${connectionHash}`
    );

    try {
      const baseCounts = await getBaseBlogReactionCounts(slug, {
        redisClient: this.redisClient,
        isRedisReady: this.isRedisReady,
      });

      const [rawBuffer, userReactionsRaw] = !this.isRedisReady()
        ? [null, null]
        : await withRedisTimeout(
            Promise.all([
              this.redisClient.hgetall<Record<string, string | number>>(
                bufferKey
              ),
              this.redisClient.smembers(userKey),
            ]),
            1500,
            "Redis getBlogReactions timeout"
          );

      const counts = { ...baseCounts };
      if (rawBuffer && typeof rawBuffer === "object") {
        for (const [r, inc] of Object.entries(rawBuffer)) {
          if (counts[r] !== undefined) {
            counts[r] = (counts[r] || 0) + Math.max(0, Number(inc) || 0);
          }
        }
      }

      const userReactions: string[] = Array.isArray(userReactionsRaw)
        ? userReactionsRaw
        : [];

      return createSuccess({
        blogPostSlug: slug,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        const message =
          "BlogPostService.getReactions: Redis path failed, returning compute-shielded defaults:";
        if (err instanceof RedisTimeoutError) {
          logger.warn(message, err, { skipTelemetry: true });
        } else {
          logger.warn(message, err);
        }
      }

      return createSuccess({
        blogPostSlug: slug,
        counts: getDefaultBlogReactionCounts(),
        userReactions: [],
      });
    }
  }
}
