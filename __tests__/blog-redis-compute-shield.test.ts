// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlogPostService } from "@/lib/services/blog-service";
import { prisma } from "@/lib/db";
import { getScopedRedisKey } from "@/lib/redis";

const {
  mockRedisGet,
  mockRedisSet,
  mockRedisDel,
  mockRedisHgetall,
  mockRedisHincrby,
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

const mockPublishedPost = {
  id: "blog-1",
  slug: "cdisc-crf-compiler-architecture",
  title: "CDISC CRF Compiler Architecture",
  dek: "Deep dive into CDISC ODM and CRF standards.",
  body: "<p>Content body</p>",
  pillar: "formal-verification",
  tags: "cdisc, compiler",
  published: true,
  reading_time_minutes: 5,
  hero_image_url: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-01T00:00:00Z"),
};

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    blogPostReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return {
    ...actual,
    isRedisConfigured: () => mockRedisConfigured.value,
    redis: {
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel,
      hgetall: mockRedisHgetall,
      hincrby: mockRedisHincrby,
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

describe("BlogPostService - Two-Tier Redis Compute Shield & Reaction Buffering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisConfigured.value = true;
    mockPipelineExec.mockResolvedValue([]);

    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(
      mockPublishedPost as never
    );
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(
      mockPublishedPost as never
    );
  });

  describe("Read Path: getReactions", () => {
    it("merges cached base counts and Redis buffer increments without hitting Neon Postgres", async () => {
      mockRedisGet.mockResolvedValueOnce({
        insightful: 5,
        mind_blowing: 2,
        actionable: 0,
        thorough: 1,
      });

      mockRedisHgetall.mockResolvedValueOnce({
        insightful: 3,
        mind_blowing: 1,
      });

      mockRedisSmembers.mockResolvedValueOnce(["insightful"]);

      const result = await BlogPostService.getReactions(
        "cdisc-crf-compiler-architecture",
        "test-conn-hash"
      );

      expect(result.success).toBe(true);
      expect(result.counts).toEqual({
        insightful: 8,
        mind_blowing: 3,
        actionable: 0,
        thorough: 1,
      });
      expect(result.userReactions).toEqual(["insightful"]);

      expect(prisma.blogPostReaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.blogPostReaction.findMany).not.toHaveBeenCalled();
    });

    it("returns zeroed base counts on Redis cache miss without querying Neon Postgres (Zero-Neon-Wake)", async () => {
      mockRedisGet.mockResolvedValueOnce(null); // Cache miss

      mockRedisHgetall.mockResolvedValueOnce({});
      mockRedisSmembers.mockResolvedValueOnce([]);

      const result = await BlogPostService.getReactions(
        "cdisc-crf-compiler-architecture",
        "conn-123"
      );

      expect(result.success).toBe(true);
      expect(result.counts).toEqual({
        insightful: 0,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      expect(prisma.blogPostReaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.blogPostReaction.findMany).not.toHaveBeenCalled();
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it("returns zeroed base counts on Redis timeout without querying Neon Postgres (Zero-Neon-Wake)", async () => {
      mockRedisGet.mockRejectedValueOnce(
        new Error("Redis getBaseBlogReactionCounts timeout")
      );

      mockRedisHgetall.mockResolvedValueOnce({});
      mockRedisSmembers.mockResolvedValueOnce([]);

      const result = await BlogPostService.getReactions(
        "cdisc-crf-compiler-architecture",
        "conn-123"
      );

      expect(result.success).toBe(true);
      expect(result.counts).toEqual({
        insightful: 0,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      expect(prisma.blogPostReaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.blogPostReaction.findMany).not.toHaveBeenCalled();
      expect(mockRedisSet).not.toHaveBeenCalled();
    });
  });

  describe("Write Path: submitReaction", () => {
    it("buffers reaction via Upstash Redis pipeline without waking Neon Postgres", async () => {
      // Mock post lookup in Redis (cache hit for getBlogPostBySlug)
      mockRedisGet.mockResolvedValueOnce(mockPublishedPost);

      mockRedisSismember.mockResolvedValueOnce(0); // Not yet reacted
      mockPipelineExec.mockResolvedValueOnce(["OK", 1, 1, 1, 1]);
      mockRedisSmembers.mockResolvedValueOnce(["insightful"]);

      mockRedisGet.mockResolvedValueOnce({
        insightful: 10,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      mockRedisHgetall.mockResolvedValueOnce({ insightful: 1 });

      const result = await BlogPostService.submitReaction(
        {
          blogPostSlug: "cdisc-crf-compiler-architecture",
          reactionType: "insightful",
        },
        "conn-hash-abc"
      );

      expect(result.success).toBe(true);
      expect(mockRedisSadd).toHaveBeenCalledWith(
        getScopedRedisKey(
          "blog:user_reactions:cdisc-crf-compiler-architecture:conn-hash-abc"
        ),
        "insightful"
      );
      expect(mockRedisHincrby).toHaveBeenCalledWith(
        getScopedRedisKey(
          "blog:reactions_buffer:cdisc-crf-compiler-architecture"
        ),
        "insightful",
        1
      );
      expect(mockRedisRpush).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_queue"),
        expect.objectContaining({
          blogPostSlug: "cdisc-crf-compiler-architecture",
          reactionType: "insightful",
          connectionHash: "conn-hash-abc",
        })
      );
      expect(mockRedisSadd).toHaveBeenCalledWith(
        getScopedRedisKey("blog:dirty_reactions"),
        "cdisc-crf-compiler-architecture"
      );
      expect(prisma.blogPostReaction.create).not.toHaveBeenCalled();
    });

    it("prevents duplicate reaction increment if user already reacted", async () => {
      mockRedisGet.mockResolvedValueOnce(mockPublishedPost);

      mockRedisSismember.mockResolvedValueOnce(1); // Already reacted
      mockRedisSmembers.mockResolvedValueOnce(["insightful"]);

      mockRedisGet.mockResolvedValueOnce({
        insightful: 10,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      mockRedisHgetall.mockResolvedValueOnce({});

      const result = await BlogPostService.submitReaction(
        {
          blogPostSlug: "cdisc-crf-compiler-architecture",
          reactionType: "insightful",
        },
        "conn-hash-abc"
      );

      expect(result.success).toBe(false);
      expect((result as any).duplicate).toBe(true);
      expect(mockRedisHincrby).not.toHaveBeenCalled();
      expect(mockRedisRpush).not.toHaveBeenCalled();
      expect(prisma.blogPostReaction.create).not.toHaveBeenCalled();
    });
  });

  describe("Unconfigured Upstash credentials", () => {
    it("writes reactions directly to Postgres without touching Redis", async () => {
      mockRedisConfigured.value = false;

      vi.mocked(prisma.blogPostReaction.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.blogPostReaction.groupBy).mockResolvedValueOnce(
        [] as never
      );
      vi.mocked(prisma.blogPostReaction.findMany).mockResolvedValueOnce([]);

      const result = await BlogPostService.submitReaction(
        {
          blogPostSlug: "cdisc-crf-compiler-architecture",
          reactionType: "insightful",
        },
        "hash-nored"
      );

      expect(result.success).toBe(true);
      expect(prisma.blogPostReaction.create).toHaveBeenCalled();
      expect(mockRedisSismember).not.toHaveBeenCalled();
      expect(mockPipelineExec).not.toHaveBeenCalled();
    });

    it("skips scheduled drain when Redis is unconfigured", async () => {
      mockRedisConfigured.value = false;

      const result = await BlogPostService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 0, inserted: 0 },
      });
      expect(mockRedisLrange).not.toHaveBeenCalled();
      expect(prisma.blogPostReaction.createMany).not.toHaveBeenCalled();
    });
  });

  describe("Scheduled Maintenance: flushBufferedReactionsToDatabase", () => {
    it("returns PERSISTENCE_FAILED and keeps events queued when the DB write fails (#1532)", async () => {
      const pending = {
        id: "evt-fail",
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "insightful",
        connectionHash: "hash-fail",
        createdAt: new Date().toISOString(),
      };
      mockRedisLrange.mockResolvedValueOnce([pending]);
      const dbError = new Error("Database connection failure");
      vi.mocked(prisma.blogPostReaction.createMany).mockRejectedValueOnce(
        dbError
      );

      const result = await BlogPostService.flushBufferedReactionsToDatabase();

      expect(result).toMatchObject({
        success: false,
        error: { code: "PERSISTENCE_FAILED", details: dbError },
      });
      expect(mockRedisLrem).not.toHaveBeenCalled();
      expect(mockRedisHincrby).not.toHaveBeenCalled();
    });

    it("returns FLUSH_FAILED when Redis cannot be read (#1532)", async () => {
      const redisError = new Error("Redis connection refused");
      mockRedisLrange.mockRejectedValueOnce(redisError);

      const result = await BlogPostService.flushBufferedReactionsToDatabase();

      expect(result).toMatchObject({
        success: false,
        error: { code: "FLUSH_FAILED", details: redisError },
      });
      expect(prisma.blogPostReaction.createMany).not.toHaveBeenCalled();
    });

    it("pops buffered reaction events via atomic LMOVE, inserts into Postgres, and adjusts buffer", async () => {
      mockRedisLrange.mockResolvedValueOnce([]); // No items in processing
      mockRedisLlen.mockResolvedValueOnce(2); // 2 queued items

      const mockEvent1 = {
        id: "evt-1",
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "insightful",
        connectionHash: "hash-1",
        createdAt: new Date().toISOString(),
      };
      const mockEvent2 = {
        id: "evt-2",
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "mind_blowing",
        connectionHash: "hash-2",
        createdAt: new Date().toISOString(),
      };

      mockPipelineExec.mockResolvedValueOnce([mockEvent1, mockEvent2]);

      vi.mocked(prisma.blogPostReaction.createMany).mockResolvedValueOnce({
        count: 2,
      });

      mockPipelineExec.mockResolvedValueOnce([]); // Ack pipeline
      mockRedisHgetall.mockResolvedValueOnce({}); // Buffer empty

      const result = await BlogPostService.flushBufferedReactionsToDatabase(50);

      expect(result).toEqual({
        success: true,
        data: { processed: 2, inserted: 2 },
      });
      expect(prisma.blogPostReaction.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "evt-1",
            blogPostSlug: "cdisc-crf-compiler-architecture",
            reactionType: "insightful",
            connectionHash: "hash-1",
          }),
        ]),
        skipDuplicates: true,
      });

      expect(mockRedisLrem).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_processing"),
        1,
        mockEvent1
      );
      expect(mockRedisHincrby).toHaveBeenCalledWith(
        getScopedRedisKey(
          "blog:reactions_buffer:cdisc-crf-compiler-architecture"
        ),
        "insightful",
        -1
      );
      expect(mockRedisDel).toHaveBeenCalledWith(
        getScopedRedisKey(
          "blog:reactions_counts:cdisc-crf-compiler-architecture"
        )
      );
    });
  });
});
