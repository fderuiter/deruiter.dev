import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { getDefaultBlogReactionCounts } from "../shared";
import {
  HydrateBlogReactionCountsInputSchema,
  type HydrateBlogReactionCountsInput,
  type HydrateBlogReactionCountsResult,
  type HydrateBlogReactionCountsSpec,
} from "./spec";

export interface HydrateBlogReactionCountsDeps {
  redisClient?: {
    set(key: string, value: unknown): Promise<unknown>;
  };
  isRedisReady?: () => boolean;
  db?: {
    blogPostReaction: {
      groupBy(args: {
        by: ["reactionType"];
        where: { blogPostSlug: string };
        _count: { id: true };
      }): Promise<Array<{ reactionType: string; _count: { id: number } }>>;
    };
  };
}

/**
 * Handler for hydrating authoritative blog reaction counts in Upstash Redis from PostgreSQL during maintenance or seed.
 * Never invoked on public visitor read paths per ADR 0043 §3.
 */
export class HydrateBlogReactionCountsHandler implements HydrateBlogReactionCountsSpec {
  private readonly redisClient: NonNullable<
    HydrateBlogReactionCountsDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<HydrateBlogReactionCountsDeps["db"]>;

  constructor(deps: HydrateBlogReactionCountsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: HydrateBlogReactionCountsInput
  ): Promise<HydrateBlogReactionCountsResult> {
    const parsed = HydrateBlogReactionCountsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post slug",
        { recoverable: false, details: parsed.error }
      );
    }

    const { slug } = parsed.data;
    const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);
    const counts = getDefaultBlogReactionCounts();

    try {
      const reactions = await this.db.blogPostReaction.groupBy({
        by: ["reactionType"],
        where: { blogPostSlug: slug },
        _count: { id: true },
      });
      for (const r of reactions) {
        if (counts[r.reactionType] !== undefined) {
          counts[r.reactionType] = r._count.id;
        }
      }

      if (this.isRedisReady()) {
        await Promise.race([
          this.redisClient.set(baseKey, counts),
          new Promise((_, reject) => {
            const t = setTimeout(
              () =>
                reject(new Error("Redis hydrateBlogReactionCounts timeout")),
              1500
            );
            t.unref?.();
          }),
        ]);
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService: Failed to hydrate base reactions for ${slug}:`,
          err
        );
      }
    }

    return createSuccess({ counts });
  }
}
