import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  getBaseCaseStudyReactionCounts,
  getDefaultCaseStudyReactionCounts,
} from "../shared";
import {
  GetCaseStudyReactionsInputSchema,
  type GetCaseStudyReactionsInput,
  type GetCaseStudyReactionsResult,
  type GetCaseStudyReactionsSpec,
} from "./spec";

export interface GetCaseStudyReactionsDeps {
  redisClient?: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
    hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
      key: string
    ): Promise<T | null>;
    smembers(key: string): Promise<string[]>;
  };
  isRedisReady?: () => boolean;
  db?: {
    caseStudyReaction: {
      groupBy(args: {
        by: ["reactionType"];
        where: { caseStudySlug: string };
        _count: { id: true };
      }): Promise<Array<{ reactionType: string; _count: { id: number } }>>;
      findMany(args: {
        where: { caseStudySlug: string; connectionHash: string };
        select: { reactionType: true };
      }): Promise<Array<{ reactionType: string }>>;
    };
  };
}

/**
 * Handler for retrieving aggregated reactions for a case study via Two-Tier Compute Shield (ADR 0036).
 * Reads cached base counts and uncommitted Redis write-buffer increments without ephemeral Map fallbacks (ADR 0043).
 */
export class GetCaseStudyReactionsHandler implements GetCaseStudyReactionsSpec {
  private readonly redisClient: NonNullable<
    GetCaseStudyReactionsDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<GetCaseStudyReactionsDeps["db"]>;

  constructor(deps: GetCaseStudyReactionsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetCaseStudyReactionsInput
  ): Promise<GetCaseStudyReactionsResult> {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid case study reaction query",
        { recoverable: false, details: parsed.error }
      );
    }

    const { slug, connectionHash } = parsed.data;
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${slug}:${connectionHash}`
    );

    try {
      const baseCounts = await getBaseCaseStudyReactionCounts(slug, {
        redisClient: this.redisClient,
        isRedisReady: this.isRedisReady,
        db: this.db as never,
      });

      const [rawBuffer, userReactionsRaw] = !this.isRedisReady()
        ? [null, null]
        : await Promise.race([
            Promise.all([
              this.redisClient.hgetall<Record<string, string | number>>(
                bufferKey
              ),
              this.redisClient.smembers(userKey),
            ]),
            new Promise<[null, null]>((_, reject) => {
              const t = setTimeout(
                () => reject(new Error("Redis getReactions timeout")),
                1500
              );
              t.unref?.();
            }),
          ]);

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
        caseStudySlug: slug,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.getReactions: Redis path failed, falling back to DB:",
          err
        );
      }

      try {
        const reactions = await this.db.caseStudyReaction.groupBy({
          by: ["reactionType"],
          where: { caseStudySlug: slug },
          _count: { id: true },
        });

        const userReactionsList = await this.db.caseStudyReaction.findMany({
          where: { caseStudySlug: slug, connectionHash },
          select: { reactionType: true },
        });

        const counts = getDefaultCaseStudyReactionCounts();
        for (const r of reactions) {
          if (counts[r.reactionType] !== undefined) {
            counts[r.reactionType] = r._count.id;
          }
        }

        return createSuccess({
          caseStudySlug: slug,
          counts,
          userReactions: userReactionsList.map((ur) => ur.reactionType),
        });
      } catch (dbErr) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.error("Failed to query case study reactions from DB:", dbErr);
        }
        return createSuccess({
          caseStudySlug: slug,
          counts: getDefaultCaseStudyReactionCounts(),
          userReactions: [],
        });
      }
    }
  }
}
