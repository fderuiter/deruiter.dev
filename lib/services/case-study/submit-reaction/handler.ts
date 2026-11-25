import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
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

export interface CaseStudyReactionPipelineLike {
  sadd(key: string, ...members: string[]): unknown;
  expire(key: string, seconds: number): unknown;
  hincrby(key: string, field: string, increment: number): unknown;
  rpush(key: string, ...elements: unknown[]): unknown;
  exec(): Promise<unknown[]>;
}

export interface CaseStudyReactionRedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  sismember(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
    key: string
  ): Promise<T | null>;
  pipeline(): CaseStudyReactionPipelineLike;
}

export interface SubmitCaseStudyReactionDeps {
  redisClient?: CaseStudyReactionRedisLike;
  isRedisReady?: () => boolean;
  db?: {
    caseStudyReaction: {
      createMany(args: {
        data: Array<{
          caseStudySlug: string;
          reactionType: string;
          connectionHash: string;
        }>;
        skipDuplicates: boolean;
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
    };
  };
  idGenerator?: () => string;
}

/**
 * Handler for submitting a case study reaction via Redis write-buffering with direct PostgreSQL fallback.
 * Omits ephemeral in-memory Map fallbacks per ADR 0043 and returns `STORAGE_UNAVAILABLE` (HTTP 503) when storage backends fail.
 */
export class SubmitCaseStudyReactionHandler implements SubmitCaseStudyReactionSpec {
  private readonly redisClient: CaseStudyReactionRedisLike;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<SubmitCaseStudyReactionDeps["db"]>;
  private readonly idGenerator: () => string;

  constructor(deps: SubmitCaseStudyReactionDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
    this.idGenerator = deps.idGenerator ?? (() => crypto.randomUUID());
  }

  private async submitReactionDirect(
    caseStudySlug: string,
    reactionType: string,
    connectionHash: string
  ): Promise<SubmitCaseStudyReactionResult> {
    try {
      await this.db.caseStudyReaction.createMany({
        data: [
          {
            caseStudySlug,
            reactionType,
            connectionHash,
          },
        ],
        skipDuplicates: true,
      });

      const reactions = await this.db.caseStudyReaction.groupBy({
        by: ["reactionType"],
        where: { caseStudySlug },
        _count: { id: true },
      });

      const userReactionsList = await this.db.caseStudyReaction.findMany({
        where: { caseStudySlug, connectionHash },
        select: { reactionType: true },
      });

      const counts = getDefaultCaseStudyReactionCounts();
      for (const r of reactions) {
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
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("Database reaction creation failed:", dbErr);
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Reaction service temporarily unavailable. Please try again.",
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
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid reaction submission",
        { recoverable: false, details: parsed.error }
      );
    }

    const { caseStudySlug, reactionType, connectionHash } = parsed.data;
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${caseStudySlug}:${connectionHash}`
    );
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${caseStudySlug}`);
    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    if (!this.isRedisReady()) {
      return this.submitReactionDirect(
        caseStudySlug,
        reactionType,
        connectionHash
      );
    }

    try {
      const isMember = await Promise.race([
        this.redisClient.sismember(userKey, reactionType),
        new Promise<number>((_, reject) => {
          const t = setTimeout(
            () => reject(new Error("Redis sismember timeout")),
            1500
          );
          t.unref?.();
        }),
      ]);

      let userReactions: string[] = [];

      if (isMember === 1) {
        let members: unknown = null;
        try {
          members = await this.redisClient.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];
      } else {
        const event: BufferedReactionEvent = {
          id: this.idGenerator(),
          caseStudySlug,
          reactionType,
          connectionHash,
          createdAt: new Date().toISOString(),
        };

        const p = this.redisClient.pipeline();
        p.sadd(userKey, reactionType);
        p.expire(userKey, 30 * 24 * 60 * 60);
        p.hincrby(bufferKey, reactionType, 1);
        p.rpush(queueKey, event);
        p.sadd(dirtyKey, caseStudySlug);

        await Promise.race([
          p.exec(),
          new Promise((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Redis submitReaction pipeline timeout")),
              1500
            );
            t.unref?.();
          }),
        ]);

        let members: unknown = null;
        try {
          members = await this.redisClient.smembers(userKey);
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

      const baseCounts = await getBaseCaseStudyReactionCounts(caseStudySlug, {
        redisClient: this.redisClient,
        isRedisReady: this.isRedisReady,
        db: this.db as never,
      });
      let rawBuffer: Record<string, string | number> | null = null;
      try {
        rawBuffer =
          await this.redisClient.hgetall<Record<string, string | number>>(
            bufferKey
          );
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
          "CaseStudyService.submitReaction: Redis buffering failed, falling back to DB:",
          err
        );
      }

      return this.submitReactionDirect(
        caseStudySlug,
        reactionType,
        connectionHash
      );
    }
  }
}
