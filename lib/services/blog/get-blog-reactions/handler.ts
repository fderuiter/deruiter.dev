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
  getBaseCounts?: (slug: string) => Promise<Record<string, number>>;
}

export class GetBlogReactionsHandler implements GetBlogReactionsSpec {
  private readonly getBaseCounts: (
    slug: string
  ) => Promise<Record<string, number>>;

  constructor(deps: GetBlogReactionsDeps = {}) {
    this.getBaseCounts = deps.getBaseCounts ?? getBaseBlogReactionCounts;
  }

  async execute(input: GetBlogReactionsInput): Promise<GetBlogReactionsResult> {
    const parsed = GetBlogReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_REACTION_QUERY",
        parsed.error.issues[0]?.message ?? "Invalid reaction query",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug, connectionHash } = parsed.data;
    const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `blog:user_reactions:${slug}:${connectionHash}`
    );

    try {
      const baseCounts = await this.getBaseCounts(slug);

      const [rawBuffer, userReactionsRaw] = !isRedisConfigured()
        ? [null, null]
        : await withRedisTimeout(
            Promise.all([
              redis.hgetall<Record<string, string | number>>(bufferKey),
              redis.smembers(userKey),
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
          "GetBlogReactionsHandler: Redis path failed, returning compute-shielded defaults:";
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
