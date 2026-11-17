// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { BlogPostService } from "@/lib/services/blog-service";
import { prisma } from "@/lib/db";
import { getScopedRedisKey } from "@/lib/redis";
import { NextRequest } from "next/server";
import { GET as maintenanceRouteGET } from "@/app/api/cron/maintenance/route";

const pipelineInstances: any[] = [];

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
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    caseStudyReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    blogPost: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    blogPostReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) =>
      cb({
        $executeRaw: vi.fn().mockResolvedValue(0),
        telemetryEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      })
    ),
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
      pipeline: vi.fn(() => {
        const inst: any = {
          commands: [] as { method: string; args: any[] }[],
          sadd: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "sadd", args });
            return inst;
          }),
          expire: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "expire", args });
            return inst;
          }),
          hincrby: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hincrby", args });
            return inst;
          }),
          rpush: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "rpush", args });
            return inst;
          }),
          lmove: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "lmove", args });
            return inst;
          }),
          lrem: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "lrem", args });
            return inst;
          }),
          del: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "del", args });
            return inst;
          }),
          set: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "set", args });
            return inst;
          }),
          hgetall: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hgetall", args });
            return inst;
          }),
          hdel: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hdel", args });
            return inst;
          }),
          srem: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "srem", args });
            return inst;
          }),
          exec: vi.fn().mockResolvedValue([]),
        };
        pipelineInstances.push(inst);
        return inst;
      }),
    },
  };
});

describe("Multi-Phase Redis Pipelining and Multi-Slug Aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineInstances.length = 0;
    mockRedisConfigured.value = true;
    mockRedisLlen.mockResolvedValue(0);
    mockRedisDel.mockResolvedValue(1);
    mockRedisSet.mockResolvedValue("OK");
  });

  describe("Requirement 1 & 2: Case Study Reaction Buffer Cleanup via Pipelining", () => {
    it("executes buffer cleanup with exactly 2 batched pipeline requests and 0 sequential round trips", async () => {
      const events = [
        {
          id: "evt-cs-1",
          caseStudySlug: "study-alpha",
          reactionType: "insightful",
          connectionHash: "hash-1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-cs-2",
          caseStudySlug: "study-beta",
          reactionType: "thorough",
          connectionHash: "hash-2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-cs-3",
          caseStudySlug: "study-gamma",
          reactionType: "mind_blowing",
          connectionHash: "hash-3",
          createdAt: new Date().toISOString(),
        },
      ];

      // Backlog of events in processing queue
      mockRedisLrange.mockResolvedValueOnce(events);
      vi.mocked(prisma.caseStudyReaction.createMany).mockResolvedValueOnce({
        count: 3,
      });

      // Pipeline calls expected:
      // 1. ack pipeline (lrem x 3, hincrby x 3, del x 3)
      // 2. inspect pipeline (hgetall x 3 for the 3 slugs)
      // 3. cleanup pipeline (batch del/srem/hdel for all 3 slugs)

      // We will intercept the pipeline instances created
      // For inspect pipeline (2nd pipeline), mock inspection results:
      // study-alpha: empty/zero buffer -> should del buffer and srem dirty
      // study-beta: remaining positive buffer -> should NOT del buffer or srem dirty, but prune zero key
      // study-gamma: null buffer -> should del buffer and srem dirty
      const originalPipeline = vi.mocked(
        (await import("@/lib/redis")).redis.pipeline
      );
      let callCount = 0;
      originalPipeline.mockImplementation(() => {
        callCount++;
        const inst: any = {
          commands: [] as { method: string; args: any[] }[],
          sadd: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "sadd", args });
            return inst;
          }),
          expire: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "expire", args });
            return inst;
          }),
          hincrby: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hincrby", args });
            return inst;
          }),
          rpush: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "rpush", args });
            return inst;
          }),
          lmove: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "lmove", args });
            return inst;
          }),
          lrem: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "lrem", args });
            return inst;
          }),
          del: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "del", args });
            return inst;
          }),
          set: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "set", args });
            return inst;
          }),
          hgetall: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hgetall", args });
            return inst;
          }),
          hdel: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "hdel", args });
            return inst;
          }),
          srem: vi.fn((...args: any[]) => {
            inst.commands.push({ method: "srem", args });
            return inst;
          }),
          exec: vi.fn().mockImplementation(async () => {
            if (callCount === 2) {
              // Inspect pipeline results for [study-alpha, study-beta, study-gamma]
              return [{ insightful: 0 }, { thorough: 2, insightful: 0 }, null];
            }
            return [];
          }),
        };
        pipelineInstances.push(inst);
        return inst;
      });

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 3, inserted: 3 },
      });

      // Check sequential redis methods were NOT called directly
      expect(mockRedisHgetall).not.toHaveBeenCalled();
      expect(mockRedisHdel).not.toHaveBeenCalled();

      // We should have 3 pipeline instances:
      // Pipeline 1: ack
      // Pipeline 2: inspect (Phase 1 buffer cleanup)
      // Pipeline 3: cleanup (Phase 2 buffer cleanup)
      expect(pipelineInstances.length).toBe(3);

      const inspectPipe = pipelineInstances[1];
      const cleanupPipe = pipelineInstances[2];

      // Inspect pipeline queued hgetall for each of the 3 slugs
      expect(inspectPipe.commands).toEqual([
        {
          method: "hgetall",
          args: [getScopedRedisKey("cs:reactions_buffer:study-alpha")],
        },
        {
          method: "hgetall",
          args: [getScopedRedisKey("cs:reactions_buffer:study-beta")],
        },
        {
          method: "hgetall",
          args: [getScopedRedisKey("cs:reactions_buffer:study-gamma")],
        },
      ]);
      expect(inspectPipe.exec).toHaveBeenCalledTimes(1);

      // Cleanup pipeline executed in a single request:
      // study-alpha (all zero): del buffer, srem dirty
      // study-beta (thorough=2, insightful=0): hdel buffer insightful
      // study-gamma (null): del buffer, srem dirty
      const alphaBuffer = getScopedRedisKey("cs:reactions_buffer:study-alpha");
      const betaBuffer = getScopedRedisKey("cs:reactions_buffer:study-beta");
      const gammaBuffer = getScopedRedisKey("cs:reactions_buffer:study-gamma");
      const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

      expect(cleanupPipe.commands).toEqual([
        { method: "del", args: [alphaBuffer] },
        { method: "srem", args: [dirtyKey, "study-alpha"] },
        { method: "hdel", args: [betaBuffer, "insightful"] },
        { method: "del", args: [gammaBuffer] },
        { method: "srem", args: [dirtyKey, "study-gamma"] },
      ]);
      expect(cleanupPipe.exec).toHaveBeenCalledTimes(1);
    });

    it("tolerates missing keys or pipeline inspection failure without failing the flush", async () => {
      const events = [
        {
          id: "evt-cs-missing",
          caseStudySlug: "study-missing-key",
          reactionType: "insightful",
          connectionHash: "hash-1",
          createdAt: new Date().toISOString(),
        },
      ];

      mockRedisLrange.mockResolvedValueOnce(events);
      vi.mocked(prisma.caseStudyReaction.createMany).mockResolvedValueOnce({
        count: 1,
      });

      let callCount = 0;
      const originalPipeline = vi.mocked(
        (await import("@/lib/redis")).redis.pipeline
      );
      originalPipeline.mockImplementation(() => {
        callCount++;
        const inst: any = {
          commands: [] as { method: string; args: any[] }[],
          sadd: vi.fn(),
          expire: vi.fn(),
          hincrby: vi.fn(),
          rpush: vi.fn(),
          lmove: vi.fn(),
          lrem: vi.fn(),
          del: vi.fn(),
          set: vi.fn(),
          hgetall: vi.fn(),
          hdel: vi.fn(),
          srem: vi.fn(),
          exec: vi.fn().mockImplementation(async () => {
            if (callCount === 2) {
              // Inspect pipeline throws network failure
              throw new Error("Upstash inspection timeout");
            }
            if (callCount === 3) {
              // Cleanup pipeline throws
              throw new Error("Upstash cleanup failure");
            }
            return [];
          }),
        };
        pipelineInstances.push(inst);
        return inst;
      });

      const result = await CaseStudyService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 1, inserted: 1 },
      });
    });
  });

  describe("Requirement 3 & 4: Blog Post Reaction Count Hydration Batching", () => {
    it("queries database reaction counts for all active slugs in a single Prisma groupBy query and writes via a single pipeline", async () => {
      const slugs = ["post-alpha", "post-beta", "post-gamma"];

      vi.mocked(prisma.blogPostReaction.groupBy).mockResolvedValueOnce([
        {
          blogPostSlug: "post-alpha",
          reactionType: "insightful",
          _count: { id: 5 },
        },
        {
          blogPostSlug: "post-alpha",
          reactionType: "mind_blowing",
          _count: { id: 2 },
        },
        {
          blogPostSlug: "post-beta",
          reactionType: "thorough",
          _count: { id: 7 },
        },
      ] as any);

      const result = await BlogPostService.hydrateBlogReactionCounts(slugs);

      // Exactly 1 Prisma groupBy query with multi-slug 'in' filter
      expect(prisma.blogPostReaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.blogPostReaction.groupBy).toHaveBeenCalledWith({
        by: ["blogPostSlug", "reactionType"],
        where: { blogPostSlug: { in: slugs } },
        _count: { id: true },
      });

      // Validates counts aggregation
      expect(result["post-alpha"]).toMatchObject({
        insightful: 5,
        mind_blowing: 2,
        actionable: 0,
        thorough: 0,
      });
      expect(result["post-beta"]).toMatchObject({
        insightful: 0,
        mind_blowing: 0,
        actionable: 0,
        thorough: 7,
      });
      expect(result["post-gamma"]).toMatchObject({
        insightful: 0,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });

      // Exactly 1 Redis pipeline call to write updated cache objects
      expect(pipelineInstances.length).toBe(1);
      const pipe = pipelineInstances[0];
      expect(pipe.set).toHaveBeenCalledTimes(3);
      expect(pipe.set).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_counts:post-alpha"),
        expect.objectContaining({ insightful: 5, mind_blowing: 2 })
      );
      expect(pipe.set).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_counts:post-beta"),
        expect.objectContaining({ thorough: 7 })
      );
      expect(pipe.set).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_counts:post-gamma"),
        expect.objectContaining({ insightful: 0, thorough: 0 })
      );
      expect(pipe.exec).toHaveBeenCalledTimes(1);
    });

    it("backward compatibility: single-slug hydration queries by reactionType and writes via pipeline", async () => {
      vi.mocked(prisma.blogPostReaction.groupBy).mockResolvedValueOnce([
        {
          reactionType: "insightful",
          _count: { id: 3 },
        },
      ] as any);

      const result =
        await BlogPostService.hydrateBlogReactionCounts("single-post");

      expect(prisma.blogPostReaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.blogPostReaction.groupBy).toHaveBeenCalledWith({
        by: ["reactionType"],
        where: { blogPostSlug: "single-post" },
        _count: { id: true },
      });

      expect(result).toMatchObject({
        insightful: 3,
        mind_blowing: 0,
        actionable: 0,
        thorough: 0,
      });
      expect(pipelineInstances.length).toBe(1);
      expect(pipelineInstances[0].set).toHaveBeenCalledWith(
        getScopedRedisKey("blog:reactions_counts:single-post"),
        expect.objectContaining({ insightful: 3 })
      );
    });

    it("flushBufferedReactionsToDatabase uses batch hydration for all flushed slugs", async () => {
      const events = [
        {
          id: "evt-blog-1",
          blogPostSlug: "post-1",
          reactionType: "insightful",
          connectionHash: "hash-1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-blog-2",
          blogPostSlug: "post-2",
          reactionType: "actionable",
          connectionHash: "hash-2",
          createdAt: new Date().toISOString(),
        },
      ];

      mockRedisLrange.mockResolvedValueOnce(events);
      vi.mocked(prisma.blogPostReaction.createMany).mockResolvedValueOnce({
        count: 2,
      });
      mockRedisHgetall.mockResolvedValue({}); // buffer empty

      const hydrateSpy = vi.spyOn(BlogPostService, "hydrateBlogReactionCounts");

      const result = await BlogPostService.flushBufferedReactionsToDatabase();

      expect(result).toEqual({
        success: true,
        data: { processed: 2, inserted: 2 },
      });

      // Verifies batch hydration was invoked once with array of slugs, rather than once per slug
      expect(hydrateSpy).toHaveBeenCalledTimes(1);
      expect(hydrateSpy).toHaveBeenCalledWith(["post-1", "post-2"]);
    });
  });

  describe("Acceptance Criteria: Maintenance Endpoint Integration", () => {
    it("returns HTTP 200 with completed phase statuses under test workloads", async () => {
      const { MaintenanceService } =
        await import("@/lib/services/maintenance-service");
      vi.spyOn(MaintenanceService, "run").mockResolvedValueOnce({
        success: true,
        partial: false,
        startedAt: "2026-11-17T00:00:00.000Z",
        completedAt: "2026-11-17T00:00:00.420Z",
        durationMs: 420,
        deadlineMs: 7000,
        phases: {
          telemetry: {
            status: "completed",
            durationMs: 120,
            counts: {
              processed: 10,
              inserted: 10,
              reactionsProcessed: 5,
              reactionsInserted: 5,
              blogReactionsProcessed: 5,
              blogReactionsInserted: 5,
            },
          },
          newsletter: { status: "completed", durationMs: 50, counts: {} },
          emailRetry: { status: "completed", durationMs: 50, counts: {} },
          retention: { status: "completed", durationMs: 100, counts: {} },
        },
      });

      const req = new NextRequest("http://localhost/api/cron/maintenance");
      const res = await maintenanceRouteGET(req, {} as any);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.partial).toBe(false);
      expect(json.durationMs).toBeLessThan(500);
      expect(json.phases.telemetry.status).toBe("completed");
      expect(json.phases.retention.status).toBe("completed");
      expect(json.phases.newsletter.status).toBe("completed");
      expect(json.phases.emailRetry.status).toBe("completed");
    });
  });
});
