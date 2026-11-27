import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
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

export interface GetCaseStudyReactionsPrismaPort {
  groupBy(args: {
    by: ["reactionType"];
    where: { caseStudySlug: string };
    _count: { id: true };
  }): Promise<Array<{ reactionType: string; _count: { id: number } }>>;
  findMany(args: {
    where: { caseStudySlug: string; connectionHash: string };
    select: { reactionType: true };
  }): Promise<Array<{ reactionType: string }>>;
}

export interface GetCaseStudyReactionsDeps {
  reactions?: GetCaseStudyReactionsPrismaPort;
  getBaseCounts?: (slug: string) => Promise<Record<string, number>>;
}

export class GetCaseStudyReactionsHandler implements GetCaseStudyReactionsSpec {
  private readonly reactions: GetCaseStudyReactionsPrismaPort;
  private readonly getBaseCounts: (
    slug: string
  ) => Promise<Record<string, number>>;

  constructor(deps: GetCaseStudyReactionsDeps = {}) {
    this.reactions =
      deps.reactions ??
      (prisma.caseStudyReaction as unknown as GetCaseStudyReactionsPrismaPort);
    this.getBaseCounts = deps.getBaseCounts ?? getBaseCaseStudyReactionCounts;
  }

  async execute(
    input: GetCaseStudyReactionsInput
  ): Promise<GetCaseStudyReactionsResult> {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_REACTION_QUERY",
        parsed.error.issues[0]?.message ?? "Invalid reaction query",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug, connectionHash } = parsed.data;
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${slug}:${connectionHash}`
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
            "Redis getReactions timeout"
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
        caseStudySlug: slug,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "GetCaseStudyReactionsHandler: Redis path failed, falling back to DB:",
          err
        );
      }

      try {
        const grouped = await this.reactions.groupBy({
          by: ["reactionType"],
          where: { caseStudySlug: slug },
          _count: { id: true },
        });

        const userReactionsList = await this.reactions.findMany({
          where: { caseStudySlug: slug, connectionHash },
          select: { reactionType: true },
        });

        const counts = getDefaultCaseStudyReactionCounts();
        for (const r of grouped) {
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
