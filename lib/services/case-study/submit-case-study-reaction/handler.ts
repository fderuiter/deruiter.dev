import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  getBaseCaseStudyReactionCounts,
  getDefaultCaseStudyReactionCounts,
  type BufferedReactionEvent,
} from "../shared";
import {
  SubmitCaseStudyReactionInputSchema,
  type SubmitCaseStudyReactionInput,
  type SubmitCaseStudyReactionResult,
  type SubmitCaseStudyReactionSpec,
} from "./spec";

export interface SubmitCaseStudyReactionPrismaPort {
  createMany(args: {
    data: Array<{
      caseStudySlug: string;
      reactionType: string;
      connectionHash: string;
    }>;
    skipDuplicates: true;
  }): Promise<{ count: number }>;
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

export interface SubmitCaseStudyReactionDeps {
  reactions?: SubmitCaseStudyReactionPrismaPort;
  getBaseCounts?: (slug: string) => Promise<Record<string, number>>;
}

export class SubmitCaseStudyReactionHandler implements SubmitCaseStudyReactionSpec {
  private readonly reactions: SubmitCaseStudyReactionPrismaPort;
  private readonly getBaseCounts: (
    slug: string
  ) => Promise<Record<string, number>>;

  constructor(deps: SubmitCaseStudyReactionDeps = {}) {
    this.reactions =
      deps.reactions ??
      (prisma.caseStudyReaction as unknown as SubmitCaseStudyReactionPrismaPort);
    this.getBaseCounts = deps.getBaseCounts ?? getBaseCaseStudyReactionCounts;
  }

  private async submitDirectToPostgres(
    caseStudySlug: string,
    reactionType: string,
    connectionHash: string
  ): Promise<SubmitCaseStudyReactionResult> {
    try {
      await this.reactions.createMany({
        data: [
          {
            caseStudySlug,
            reactionType,
            connectionHash,
          },
        ],
        skipDuplicates: true,
      });

      const grouped = await this.reactions.groupBy({
        by: ["reactionType"],
        where: { caseStudySlug },
        _count: { id: true },
      });

      const userReactionsList = await this.reactions.findMany({
        where: { caseStudySlug, connectionHash },
        select: { reactionType: true },
      });

      const counts = getDefaultCaseStudyReactionCounts();
      for (const r of grouped) {
        if (counts[r.reactionType] !== undefined) {
          counts[r.reactionType] = r._count.id;
        }
      }

      return createSuccess({
        reactionType,
        counts,
        userReactions: userReactionsList.map((ur) => ur.reactionType),
      });
    } catch (dbErr) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Case study reaction storage is temporarily unavailable.",
        { recoverable: true, details: dbErr }
      );
    }
  }

  async execute(
    input: SubmitCaseStudyReactionInput
  ): Promise<SubmitCaseStudyReactionResult> {
    const parsed = SubmitCaseStudyReactionInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_REACTION_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid reaction payload",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { caseStudySlug, reactionType, connectionHash } = parsed.data;
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${caseStudySlug}:${connectionHash}`
    );
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${caseStudySlug}`);
    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    if (!isRedisConfigured()) {
      return this.submitDirectToPostgres(
        caseStudySlug,
        reactionType,
        connectionHash
      );
    }

    try {
      const isMember = await withRedisTimeout(
        redis.sismember(userKey, reactionType),
        1500,
        "Redis sismember timeout"
      );

      let userReactions: string[] = [];

      if (isMember === 1) {
        let members: unknown = null;
        try {
          members = await redis.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];
      } else {
        const eventId = crypto.randomUUID();
        const event: BufferedReactionEvent = {
          id: eventId,
          caseStudySlug,
          reactionType,
          connectionHash,
          createdAt: new Date().toISOString(),
        };

        const p = redis.pipeline();
        p.sadd(userKey, reactionType);
        p.expire(userKey, 30 * 24 * 60 * 60);
        p.hincrby(bufferKey, reactionType, 1);
        p.rpush(queueKey, event);
        p.sadd(dirtyKey, caseStudySlug);

        await withRedisTimeout(
          p.exec(),
          1500,
          "Redis submitReaction pipeline timeout"
        );

        let members: unknown = null;
        try {
          members = await redis.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];
        if (!userReactions.includes(reactionType)) {
          userReactions.push(reactionType);
        }
      }

      const baseCounts = await this.getBaseCounts(caseStudySlug);
      let rawBuffer: Record<string, string | number> | null = null;
      try {
        rawBuffer =
          await redis.hgetall<Record<string, string | number>>(bufferKey);
      } catch {
        // Tolerated
      }
      const counts = { ...baseCounts };
      if (rawBuffer && typeof rawBuffer === "object") {
        for (const [r, inc] of Object.entries(rawBuffer)) {
          if (counts[r] !== undefined) {
            counts[r] = (counts[r] || 0) + Math.max(0, Number(inc) || 0);
          }
        }
      }

      return createSuccess({
        reactionType,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "SubmitCaseStudyReactionHandler: Redis buffering failed, falling back to DB:",
          err
        );
      }

      return this.submitDirectToPostgres(
        caseStudySlug,
        reactionType,
        connectionHash
      );
    }
  }
}
