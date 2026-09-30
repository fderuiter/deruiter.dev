/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { prisma } from "@/lib/db";
import { getScopedRedisKey } from "@/lib/redis";
import * as nextCache from "next/cache";

const {
  mockRedisGet,
  mockRedisSet,
  mockRedisDel,
  mockRedisHgetall,
  mockRedisHincrby,
  mockRedisHdel,
  mockRedisSismember,
  mockRedisSadd,
  mockRedisSrem,
  mockRedisSmembers,
  mockRedisLlen,
  mockRedisConfigured,
  mockRedisLrange,
  mockRedisLmove,
  mockRedisLrem,
  mockRedisRpush,
  mockRedisExpire,
  mockPipelineExec,
} = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
  mockRedisHgetall: vi.fn(),
  mockRedisHincrby: vi.fn(),
  mockRedisHdel: vi.fn(),
  mockRedisSismember: vi.fn(),
  mockRedisSadd: vi.fn(),
  mockRedisSrem: vi.fn(),
  mockRedisSmembers: vi.fn(),
  mockRedisLlen: vi.fn(),
  mockRedisConfigured: { value: true },
  mockRedisLrange: vi.fn(),
  mockRedisLmove: vi.fn(),
  mockRedisLrem: vi.fn(),
  mockRedisRpush: vi.fn(),
  mockRedisExpire: vi.fn(),
  mockPipelineExec: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    caseStudyReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    caseStudyFeedback: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return {
    ...actual,
    // These suites exercise the buffered Redis path specifically, so report
    // Upstash as configured even though the test env has no credentials.
    isRedisConfigured: () => mockRedisConfigured.value,
    redis: {
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel,
      hgetall: mockRedisHgetall,
      hincrby: mockRedisHincrby,
      hdel: mockRedisHdel,
      sismember: mockRedisSismember,
      sadd: mockRedisSadd,
      srem: mockRedisSrem,
      smembers: mockRedisSmembers,
      llen: mockRedisLlen,
      lrange: mockRedisLrange,
      lmove: mockRedisLmove,
      lrem: mockRedisLrem,
      rpush: mockRedisRpush,
      expire: mockRedisExpire,
      pipeline: vi.fn(() => ({
        sadd: mockRedisSadd,
        expire: mockRedisExpire,
        hincrby: mockRedisHincrby,
        rpush: mockRedisRpush,
        lmove: mockRedisLmove,
        lrem: mockRedisLrem,
        del: mockRedisDel,
        exec: mockPipelineExec,
      })),
    },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("CaseStudyService - Two-Tier Redis Compute Shield & Reaction Buffering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelineExec.mockResolvedValue([]);
    mockRedisLlen.mockResolvedValue(0);
    mockRedisConfigured.value = true;
    mockRedisDel.mockResolvedValue(1);
    mockRedisSet.mockResolvedValue("OK");
  });

  describe("Tier 2: Redis Read-Through Caching for getCaseStudyBySlug", () => {
    it("returns cached case study on Redis hit without calling Prisma", async () => {
      const cachedStudy = {
        id: "cached-id-1",
        slug: "clinical-data-mapper",
        title: "Cached Clinical Data Mapper",
        primary_language: "TypeScript",
        github_url: "https://github.com/fderuiter/clinical-data-mapper",
        published: true,
        simulated_telemetry: false,
        tags: "clinical, edc",
        editorial_content: "<p>Cached editorial</p>",
        architectural_narrative: "<p>Cached narrative</p>",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockRedisGet.mockResolvedValueOnce(cachedStudy);

      const result = await CaseStudyService.getCaseStudyBySlug(
        "clinical-data-mapper"
      );

      expect(mockRedisGet).toHaveBeenCalledWith(
        getScopedRedisKey("cs:slug:clinical-data-mapper")
      );
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Cached Clinical Data Mapper");
      expect(result?.created_at).toBeInstanceOf(Date);
    });

    it("queries Prisma on cache miss, populates Redis with 3600s TTL, and returns result", async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      const dbStudy = {
        id: "db-id-1",
        slug: "custom-db-study",
        title: "Custom DB Study",
        primary_language: "Rust",
        github_url: "https://github.com/fderuiter/custom",
        published: true,
        simulated_telemetry: false,
        tags: "rust, systems",
        editorial_content: "<p>DB content</p>",
        architectural_narrative: "<p>DB narrative</p>",
        commands_json: null,
        playback_json: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(
        dbStudy as any
      );

      const result =
        await CaseStudyService.getCaseStudyBySlug("custom-db-study");

      expect(prisma.caseStudy.findUnique).toHaveBeenCalledWith({
        where: { slug: "custom-db-study" },
      });
      expect(mockRedisSet).toHaveBeenCalledWith(
        getScopedRedisKey("cs:slug:custom-db-study"),
        expect.objectContaining({
          slug: "custom-db-study",
          title: "Custom DB Study",
        }),
        { ex: 3600 }
      );
      expect(result?.slug).toBe("custom-db-study");
    });

    it("falls back to static FALLBACK_CASE_STUDIES on DB miss and caches it", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const result = await CaseStudyService.getCaseStudyBySlug(
        "clinical-data-mapper"
      );

      expect(result).not.toBeNull();
      expect(result?.slug).toBe("clinical-data-mapper");
      expect(mockRedisSet).toHaveBeenCalledWith(
        getScopedRedisKey("cs:slug:clinical-data-mapper"),
        expect.objectContaining({ slug: "clinical-data-mapper" }),
        { ex: 3600 }
      );
    });

    it("gracefully tolerates Redis get timeout or error and falls back to DB", async () => {
      mockRedisGet.mockRejectedValueOnce(new Error("Redis connection timeout"));

      const dbStudy = {
        id: "db-fallback-id",
        slug: "fallback-study",
        title: "Fallback DB Study",
        primary_language: "TypeScript",
        github_url: "",
        published: true,
        simulated_telemetry: false,
        tags: "ts",
        editorial_content: "<p>Content</p>",
        architectural_narrative: "<p>Narrative</p>",
        commands_json: null,
        playback_json: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(
        dbStudy as any
      );

      const result =
        await CaseStudyService.getCaseStudyBySlug("fallback-study");

      expect(result?.title).toBe("Fallback DB Study");
    });
  });

  describe("Cache Invalidation & Next.js ISR Tag Revalidation", () => {
    it("evicts Redis cache keys and dispatches revalidateTag with profile 'max'", async () => {
      mockRedisDel.mockResolvedValue(1);

      const evicted =
        await CaseStudyService.evictCaseStudyCache("cadence-clinical");

      expect(evicted).toBe(true);
      expect(mockRedisDel).toHaveBeenCalledWith(
        getScopedRedisKey("cs:slug:cadence-clinical")
      );
      expect(mockRedisDel).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_counts:cadence-clinical")
      );
      expect(mockRedisDel).toHaveBeenCalledWith(
        getScopedRedisKey("cs:all_published")
      );

      expect(nextCache.revalidateTag).toHaveBeenCalledWith(
        "case-study-cadence-clinical",
        "max"
      );
      expect(nextCache.revalidateTag).toHaveBeenCalledWith(
        "case-studies",
        "max"
      );
    });
  });

  describe("getAllPublishedCaseStudies with Redis Caching", () => {
    it("returns cached list on Redis hit without querying Prisma", async () => {
      const cachedList = [
        {
          id: "cs-1",
          slug: "study-1",
          title: "Study One",
          primary_language: "Python",
          published: true,
          tags: "python",
          editorial_content: "",
          architectural_narrative: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockRedisGet.mockResolvedValueOnce(cachedList);

      const results = await CaseStudyService.getAllPublishedCaseStudies();

      expect(mockRedisGet).toHaveBeenCalledWith(
        getScopedRedisKey("cs:all_published")
      );
      expect(prisma.caseStudy.findMany).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe("study-1");
      expect(results[0].created_at).toBeInstanceOf(Date);
    });

    it("queries Prisma on cache miss, caches result, and returns merged list", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
      vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([]);

      const results = await CaseStudyService.getAllPublishedCaseStudies();

      expect(prisma.caseStudy.findMany).toHaveBeenCalled();
      expect(mockRedisSet).toHaveBeenCalledWith(
        getScopedRedisKey("cs:all_published"),
        expect.any(Array),
        { ex: 3600 }
      );
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Reaction Write-Buffering & Zero-Compute Reads", () => {
    it("returns merged reaction counts and user reactions without querying Prisma when cached", async () => {
      const cachedCounts = {
        insightful: 5,
        mind_blowing: 2,
        actionable: 1,
        thorough: 0,
      };
      const bufferIncrements = {
        insightful: "3", // string as returned from HGETALL
        actionable: "2",
      };

      mockRedisGet.mockResolvedValueOnce(cachedCounts); // base counts hit
      mockRedisHgetall.mockResolvedValueOnce(bufferIncrements); // buffer increments
      mockRedisSmembers.mockResolvedValueOnce(["insightful"]); // user reactions

      const result = await CaseStudyService.getReactions(
        "cadence-clinical",
        "hash-visitor-1"
      );

      expect(result.success).toBe(true);
      expect(result.counts.insightful).toBe(8); // 5 base + 3 buffer
      expect(result.counts.actionable).toBe(3); // 1 base + 2 buffer
      expect(result.counts.mind_blowing).toBe(2); // 2 base + 0 buffer
      expect(result.counts.thorough).toBe(0);
      expect(result.userReactions).toEqual(["insightful"]);
      expect(prisma.caseStudyReaction.groupBy).not.toHaveBeenCalled();
    });

    it("buffers new reaction via HINCRBY without waking Postgres Prisma create", async () => {
      mockRedisSismember.mockResolvedValueOnce(0); // Not yet reacted
      mockPipelineExec.mockResolvedValueOnce(["OK", 1, 1, 1, 1]);
      mockRedisSmembers.mockResolvedValueOnce(["insightful"]);

      // Mock base counts and buffer for final result calculation
      mockRedisGet.mockResolvedValueOnce({
        insightful: 10,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      mockRedisHgetall.mockResolvedValueOnce({ insightful: 1 });

      const result = await CaseStudyService.submitReaction(
        { caseStudySlug: "cadence-clinical", reactionType: "insightful" },
        "conn-hash-abc"
      );

      expect(result.success).toBe(true);
      expect(mockRedisSadd).toHaveBeenCalledWith(
        getScopedRedisKey("cs:user_reactions:cadence-clinical:conn-hash-abc"),
        "insightful"
      );
      expect(mockRedisHincrby).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_buffer:cadence-clinical"),
        "insightful",
        1
      );
      expect(mockRedisRpush).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_queue"),
        expect.objectContaining({
          caseStudySlug: "cadence-clinical",
          reactionType: "insightful",
          connectionHash: "conn-hash-abc",
        })
      );
      expect(mockRedisSadd).toHaveBeenCalledWith(
        getScopedRedisKey("cs:dirty_reactions"),
        "cadence-clinical"
      );
      expect(prisma.caseStudyReaction.create).not.toHaveBeenCalled();
    });

    it("prevents duplicate reaction increment if user already reacted", async () => {
      mockRedisSismember.mockResolvedValueOnce(1); // Already reacted
      mockRedisSmembers.mockResolvedValueOnce(["insightful"]);

      mockRedisGet.mockResolvedValueOnce({
        insightful: 10,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      mockRedisHgetall.mockResolvedValueOnce({});

      const result = await CaseStudyService.submitReaction(
        { caseStudySlug: "cadence-clinical", reactionType: "insightful" },
        "conn-hash-abc"
      );

      expect(result.success).toBe(true);
      expect(mockRedisHincrby).not.toHaveBeenCalled();
      expect(mockRedisRpush).not.toHaveBeenCalled();
      expect(prisma.caseStudyReaction.create).not.toHaveBeenCalled();
    });
  });

  describe("Unconfigured Upstash credentials", () => {
    it("writes reactions straight to Postgres without touching Redis", async () => {
      mockRedisConfigured.value = false;

      vi.mocked(prisma.caseStudyReaction.createMany).mockResolvedValueOnce({
        count: 1,
      });
      vi.mocked(prisma.caseStudyReaction.groupBy).mockResolvedValueOnce(
        [] as never
      );
      vi.mocked(prisma.caseStudyReaction.findMany).mockResolvedValueOnce([]);

      const result = await CaseStudyService.submitReaction(
        { caseStudySlug: "cadence-clinical", reactionType: "insightful" },
        "hash-nored"
      );

      expect(result.success).toBe(true);
      expect(prisma.caseStudyReaction.createMany).toHaveBeenCalledWith({
        data: [
          {
            caseStudySlug: "cadence-clinical",
            reactionType: "insightful",
            connectionHash: "hash-nored",
          },
        ],
        skipDuplicates: true,
      });
      // No dummy-endpoint round trips, and no 1500ms timeout per reaction.
      expect(mockRedisSismember).not.toHaveBeenCalled();
      expect(mockPipelineExec).not.toHaveBeenCalled();
    });

    it("persists only one reaction when identical submissions arrive concurrently", async () => {
      mockRedisConfigured.value = false;
      const persistedReactions: Array<{
        caseStudySlug: string;
        reactionType: string;
        connectionHash: string;
      }> = [];

      const createMany = vi.mocked(prisma.caseStudyReaction.createMany);
      const persistUniqueReaction = async (
        args: Parameters<typeof createMany>[0]
      ) => {
        const { data, skipDuplicates } = args;
        expect(skipDuplicates).toBe(true);
        const rows = Array.isArray(data) ? data : [data];
        let inserted = 0;

        for (const row of rows) {
          const duplicate = persistedReactions.some(
            (persisted) =>
              persisted.caseStudySlug === row.caseStudySlug &&
              persisted.reactionType === row.reactionType &&
              persisted.connectionHash === row.connectionHash
          );

          if (duplicate) continue;

          persistedReactions.push({
            caseStudySlug: row.caseStudySlug,
            reactionType: row.reactionType,
            connectionHash: row.connectionHash,
          });
          inserted += 1;
        }

        return { count: inserted };
      };
      createMany
        .mockImplementationOnce(persistUniqueReaction as never)
        .mockImplementationOnce(persistUniqueReaction as never);
      const groupedReactionCounts = async () =>
        [
          {
            reactionType: "insightful",
            _count: {
              id: persistedReactions.filter(
                (reaction) => reaction.reactionType === "insightful"
              ).length,
            },
          },
        ] as never;
      vi.mocked(prisma.caseStudyReaction.groupBy)
        .mockImplementationOnce(groupedReactionCounts as never)
        .mockImplementationOnce(groupedReactionCounts as never);
      const listPersistedReactions = async () =>
        persistedReactions.map(({ reactionType }) => ({
          reactionType,
        })) as never;
      vi.mocked(prisma.caseStudyReaction.findMany)
        .mockImplementationOnce(listPersistedReactions as never)
        .mockImplementationOnce(listPersistedReactions as never);

      const input = {
        caseStudySlug: "cadence-clinical",
        reactionType: "insightful",
      };
      const connectionHash = "hash-concurrent";
      const [firstSubmission, secondSubmission] = await Promise.all([
        CaseStudyService.submitReaction(input, connectionHash),
        CaseStudyService.submitReaction(input, connectionHash),
      ]);

      expect(persistedReactions).toHaveLength(1);
      expect(prisma.caseStudyReaction.createMany).toHaveBeenCalledTimes(2);
      expect(prisma.caseStudyReaction.createMany).toHaveBeenNthCalledWith(1, {
        data: [{ ...input, connectionHash }],
        skipDuplicates: true,
      });
      expect(prisma.caseStudyReaction.createMany).toHaveBeenNthCalledWith(2, {
        data: [{ ...input, connectionHash }],
        skipDuplicates: true,
      });
      expect(firstSubmission).toMatchObject({
        success: true,
        counts: { insightful: 1 },
        userReactions: ["insightful"],
      });
      expect(secondSubmission).toMatchObject({
        success: true,
        counts: { insightful: 1 },
        userReactions: ["insightful"],
      });
      expect(prisma.caseStudyReaction.findFirst).not.toHaveBeenCalled();
      expect(prisma.caseStudyReaction.create).not.toHaveBeenCalled();
    });

    it("skips the scheduled drain entirely", async () => {
      mockRedisConfigured.value = false;

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 0, inserted: 0 },
      });
      expect(mockRedisLrange).not.toHaveBeenCalled();
      expect(prisma.caseStudyReaction.createMany).not.toHaveBeenCalled();
    });
  });

  describe("Scheduled Maintenance: flushBufferedReactionsToDatabase", () => {
    it("returns FLUSH_FAILED instead of an empty success when Redis cannot be read (#1532)", async () => {
      const redisError = new Error("Redis connection refused");
      mockRedisLrange.mockRejectedValueOnce(redisError);

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      expect(result).toMatchObject({
        success: false,
        error: { code: "FLUSH_FAILED", details: redisError },
      });
      expect(prisma.caseStudyReaction.createMany).not.toHaveBeenCalled();
    });

    it("returns { processed: 0, inserted: 0 } when no events in queue", async () => {
      mockRedisLrange.mockResolvedValueOnce([]); // no pending in processing
      mockRedisLlen.mockResolvedValueOnce(0); // queue is empty

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 0, inserted: 0 },
      });
      expect(prisma.caseStudyReaction.createMany).not.toHaveBeenCalled();
      // An empty queue must not spend a single LMOVE against the daily budget.
      expect(mockPipelineExec).not.toHaveBeenCalled();
      expect(mockRedisLmove).not.toHaveBeenCalled();
    });

    it("persists buffered reactions in batch, decrements buffer counts, and clears processing queue", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          caseStudySlug: "cadence-clinical",
          reactionType: "insightful",
          connectionHash: "hash-1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-2",
          caseStudySlug: "cadence-clinical",
          reactionType: "insightful",
          connectionHash: "hash-2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-3",
          caseStudySlug: "cadence-clinical",
          reactionType: "mind_blowing",
          connectionHash: "hash-3",
          createdAt: new Date().toISOString(),
        },
      ];

      mockRedisLrange.mockResolvedValueOnce([]); // no pending
      mockRedisLlen.mockResolvedValueOnce(mockEvents.length); // queue depth
      mockPipelineExec.mockResolvedValueOnce(mockEvents); // newly moved events

      vi.mocked(prisma.caseStudyReaction.createMany).mockResolvedValueOnce({
        count: 3,
      });
      mockRedisHgetall.mockResolvedValueOnce({}); // remaining buffer empty

      const result =
        await CaseStudyService.flushBufferedReactionsToDatabase(100);

      expect(result).toEqual({
        success: true,
        data: { processed: 3, inserted: 3 },
      });
      expect(prisma.caseStudyReaction.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            caseStudySlug: "cadence-clinical",
            reactionType: "insightful",
          }),
        ]),
        skipDuplicates: true,
      });

      // Buffer decrement assertions
      expect(mockRedisHincrby).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_buffer:cadence-clinical"),
        "insightful",
        -2
      );
      expect(mockRedisHincrby).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_buffer:cadence-clinical"),
        "mind_blowing",
        -1
      );
      // Eviction of base counts to ensure fresh read next time
      expect(mockRedisDel).toHaveBeenCalledWith(
        getScopedRedisKey("cs:reactions_counts:cadence-clinical")
      );
    });

    it("pins the buffered event id so a replayed batch cannot double-insert", async () => {
      const mockEvents = [
        {
          id: "evt-replay-1",
          caseStudySlug: "cadence-clinical",
          reactionType: "insightful",
          connectionHash: "hash-1",
          createdAt: new Date().toISOString(),
        },
      ];

      // Events already sat in the processing queue: the previous run persisted
      // them but died before acknowledging, so this run replays them.
      mockRedisLrange.mockResolvedValueOnce(mockEvents);
      vi.mocked(prisma.caseStudyReaction.createMany).mockResolvedValueOnce({
        count: 0,
      });
      mockRedisHgetall.mockResolvedValueOnce({});

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      // The compound key blocks duplicate visitor payloads, and the event ID
      // still makes replaying this exact queued write a no-op.
      expect(prisma.caseStudyReaction.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            id: "evt-replay-1",
            caseStudySlug: "cadence-clinical",
            reactionType: "insightful",
          }),
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({
        success: true,
        data: { processed: 1, inserted: 0 },
      });
    });

    it("leaves events in processing queue if Prisma batch insert throws", async () => {
      const mockEvents = [
        {
          id: "evt-fail",
          caseStudySlug: "cadence-clinical",
          reactionType: "insightful",
          connectionHash: "hash-fail",
          createdAt: new Date().toISOString(),
        },
      ];

      mockRedisLrange.mockResolvedValueOnce(mockEvents);
      vi.mocked(prisma.caseStudyReaction.createMany).mockRejectedValueOnce(
        new Error("Database connection failure")
      );

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      // #1532: the DB failure is reported instead of reading as an empty run.
      expect(result).toMatchObject({
        success: false,
        error: { code: "PERSISTENCE_FAILED" },
      });
      // Verify buffer was NOT decremented when DB write failed
      expect(mockRedisHincrby).not.toHaveBeenCalled();
      // Verify processing items were NOT removed via lrem
      expect(mockRedisLrem).not.toHaveBeenCalled();
    });
  });
});
