// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import * as feedbackRoute from "@/app/api/case-studies/feedback/route";
import { SendFeedbackNotificationHandler, createSuccess } from "@/lib/services";
import {
  POST as reactionPOST,
  GET as reactionGET,
} from "@/app/api/case-studies/reactions/route";
import { resetSubmissionAttemptRateLimit } from "@/lib/moderation";
import {
  createMemoryOfflineQueueStore,
  createOfflineDispatcher,
} from "@/lib/offline-queue";

interface MockFeedbackRow {
  id: string;
  caseStudySlug: string;
  takeaways: string;
  comments: string;
  connectionHash: string;
  operationKey?: string;
  createdAt: Date;
}

interface MockReactionRow {
  id: string;
  caseStudySlug: string;
  reactionType: string;
  connectionHash: string;
  createdAt: Date;
}

const storedFeedback: MockFeedbackRow[] = [];
const storedReactions: MockReactionRow[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudyFeedback: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    caseStudyReaction: {
      createMany: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Case Study Feedback & Reaction API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSubmissionAttemptRateLimit();
    storedFeedback.length = 0;
    storedReactions.length = 0;

    vi.mocked(prisma.caseStudyFeedback.findFirst).mockImplementation(
      (async (args: {
        where: {
          connectionHash?: string;
          operationKey?: string;
          caseStudySlug?: string;
          createdAt?: { gte: Date };
        };
      }) => {
        if (args.where.operationKey) {
          return (
            storedFeedback.find(
              (row) =>
                row.connectionHash === args.where.connectionHash &&
                row.operationKey === args.where.operationKey
            ) ?? null
          );
        }
        return (
          storedFeedback.find(
            (row) =>
              row.caseStudySlug === args.where.caseStudySlug &&
              row.connectionHash === args.where.connectionHash &&
              (!args.where.createdAt ||
                row.createdAt >= args.where.createdAt.gte)
          ) ?? null
        );
      }) as never
    );

    vi.mocked(prisma.caseStudyFeedback.create).mockImplementation(
      (async (args: {
        data: {
          caseStudySlug: string;
          takeaways: string;
          comments: string;
          connectionHash: string;
          operationKey?: string;
        };
      }) => {
        const created: MockFeedbackRow = {
          id: `fb-${storedFeedback.length + 1}`,
          caseStudySlug: args.data.caseStudySlug,
          takeaways: args.data.takeaways,
          comments: args.data.comments,
          connectionHash: args.data.connectionHash,
          operationKey: args.data.operationKey,
          createdAt: new Date(),
        };
        storedFeedback.push(created);
        return created;
      }) as never
    );

    vi.mocked(prisma.caseStudyReaction.createMany).mockImplementation(
      (async (args: {
        data: Array<{
          caseStudySlug: string;
          reactionType: string;
          connectionHash: string;
        }>;
      }) => {
        let count = 0;
        for (const item of args.data) {
          const dup = storedReactions.some(
            (r) =>
              r.caseStudySlug === item.caseStudySlug &&
              r.reactionType === item.reactionType &&
              r.connectionHash === item.connectionHash
          );
          if (!dup) {
            storedReactions.push({
              id: `rx-${storedReactions.length + 1}`,
              ...item,
              createdAt: new Date(),
            });
            count++;
          }
        }
        return { count };
      }) as never
    );

    vi.mocked(prisma.caseStudyReaction.groupBy).mockImplementation(
      (async (args: { where?: { caseStudySlug?: string } }) => {
        const slug = args?.where?.caseStudySlug;
        const counts = new Map<string, number>();
        for (const r of storedReactions) {
          if (r.caseStudySlug === slug) {
            counts.set(r.reactionType, (counts.get(r.reactionType) ?? 0) + 1);
          }
        }
        return [...counts.entries()].map(([reactionType, id]) => ({
          reactionType,
          _count: { id },
        }));
      }) as never
    );

    vi.mocked(prisma.caseStudyReaction.findMany).mockImplementation(
      (async (args: {
        where?: { caseStudySlug?: string; connectionHash?: string };
      }) =>
        storedReactions
          .filter(
            (r) =>
              r.caseStudySlug === args?.where?.caseStudySlug &&
              r.connectionHash === args?.where?.connectionHash
          )
          .map((r) => ({ reactionType: r.reactionType }))) as never
    );

    vi.spyOn(
      SendFeedbackNotificationHandler.prototype,
      "execute"
    ).mockResolvedValue(createSuccess({ id: "sim_1", simulated: true }));
  });

  describe("Feedback API (/api/case-studies/feedback)", () => {
    it("serves no GET, so a case study view never reads feedback (#3199)", () => {
      expect("GET" in feedbackRoute).toBe(false);
    });

    it("should reject feedback submission with missing or empty fields with 400", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          body: JSON.stringify({
            caseStudySlug: "",
            takeaways: [],
            comments: "hi",
          }),
        }
      );

      const res = await feedbackRoute.POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details.length).toBeGreaterThan(0);
    });

    it("should reject feedback submission with comments exceeding max length with 400", async () => {
      const longComment = "a".repeat(2001);
      const req = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            takeaways: ["Architecture & System Design"],
            comments: longComment,
          }),
        }
      );

      const res = await feedbackRoute.POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });

    it("should reject feedback submission containing profanity or toxic rant patterns with 400", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            takeaways: ["Architecture & System Design"],
            comments:
              "This whole case study is complete garbage and total trash.",
          }),
        }
      );

      const res = await feedbackRoute.POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain(
        "Submission rejected: Content violates community tone standards."
      );
      expect(json.details.length).toBeGreaterThan(0);
    });

    it("should accept valid feedback submission with 201", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          headers: {
            "x-forwarded-for": "192.168.1.100",
            "user-agent": "test-agent",
          },
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            takeaways: [
              "Architecture & System Design",
              "Error Handling & Resilience",
            ],
            comments:
              "Great breakdown of the clinical trial architecture and error handling patterns.",
          }),
        }
      );

      const res = await feedbackRoute.POST(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedback.caseStudySlug).toBe("imednet-python-sdk");
      expect(json.feedback.comments).toContain("Great breakdown");
    });

    it("should prevent duplicate submissions from same connection hash with 429", async () => {
      const uniqueIp = `10.0.0.${Math.floor(Math.random() * 200) + 10}`;
      const uniqueSlug = `test-study-${Date.now()}`;

      const req1 = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          headers: { "x-forwarded-for": uniqueIp, "user-agent": "dup-agent" },
          body: JSON.stringify({
            caseStudySlug: uniqueSlug,
            takeaways: ["Testing Protocols & QA"],
            comments: "Initial thorough review of QA procedures.",
          }),
        }
      );

      const res1 = await feedbackRoute.POST(req1);
      expect(res1.status).toBe(201);

      const req2 = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          headers: { "x-forwarded-for": uniqueIp, "user-agent": "dup-agent" },
          body: JSON.stringify({
            caseStudySlug: uniqueSlug,
            takeaways: ["Performance Optimization"],
            comments: "Second submission attempt within short window.",
          }),
        }
      );

      const res2 = await feedbackRoute.POST(req2);
      expect(res2.status).toBe(429);
      const json = await res2.json();
      expect(json.error).toContain("already submitted");
    });

    it("returns 503 on database failure and preserves queued offline feedback instead of falsely returning 201", async () => {
      vi.mocked(prisma.caseStudyFeedback.findFirst).mockRejectedValueOnce(
        new Error("Neon compute unavailable")
      );

      const req = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          headers: {
            "x-forwarded-for": "10.9.9.9",
            "user-agent": "offline-feedback-agent",
          },
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            takeaways: ["Architecture & System Design"],
            comments: "Thoughtful feedback submitted during a database outage.",
          }),
        }
      );

      const res = await feedbackRoute.POST(req);
      expect(res.status).toBe(503);

      const store = createMemoryOfflineQueueStore();
      await store.enqueue(
        {
          id: "fb_offline_1",
          type: "feedback",
          endpoint: "/api/case-studies/feedback",
          body: {
            caseStudySlug: "imednet-python-sdk",
            takeaways: ["Architecture & System Design"],
            comments: "Thoughtful feedback submitted during a database outage.",
          },
        },
        1000
      );
      const dispatcher = createOfflineDispatcher({
        store,
        now: () => 2000,
        setTimer: () => 0,
        send: async () =>
          res.ok
            ? { kind: "ok" }
            : { kind: "transient", status: res.status, reason: "HTTP 503" },
      });

      const flushResult = await dispatcher.flush();
      expect(flushResult.processed).toBe(0);
      const remaining = await store.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.retries).toBe(1);
    });
  });

  describe("Feedback replays with an Idempotency-Key (#3807)", () => {
    const post = (ip: string, slug: string, key?: string, comments?: string) =>
      feedbackRoute.POST(
        new NextRequest("http://localhost/api/case-studies/feedback", {
          method: "POST",
          headers: {
            "x-forwarded-for": ip,
            "user-agent": "replay-agent",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          body: JSON.stringify({
            caseStudySlug: slug,
            takeaways: ["Testing Protocols & QA"],
            comments: comments ?? "A careful look at the replay path.",
          }),
        })
      );

    it("returns the first row for a replay instead of a duplicate or a 429", async () => {
      const email = vi
        .spyOn(SendFeedbackNotificationHandler.prototype, "execute")
        .mockResolvedValue(createSuccess({ id: "sim_1", simulated: true }));
      const ip = `10.1.0.${Math.floor(Math.random() * 200) + 10}`;
      const slug = `replay-study-${Date.now()}`;

      const first = await post(ip, slug, "feedback_1:0");
      const replay = await post(ip, slug, "feedback_1:0");
      const other = await post(
        ip,
        slug,
        "feedback_2:0",
        "A second, separate submission."
      );

      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      const firstJson = await first.json();
      const replayJson = await replay.json();
      expect(replayJson.success).toBe(true);
      expect(replayJson.feedback.comments).toBe(firstJson.feedback.comments);
      // A new key is a new submission, so the hourly limit still applies.
      expect(other.status).toBe(429);
      // One stored row, one notification.
      expect(email).toHaveBeenCalledTimes(1);
    });

    it("rejects a malformed Idempotency-Key with 400", async () => {
      const res = await post("10.2.0.1", "any-study", "has spaces in it");
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid Idempotency-Key header");
    });
  });

  describe("Reactions API (/api/case-studies/reactions)", () => {
    it("should reject GET requests missing slug with 400", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/reactions"
      );
      const res = await reactionGET(req);
      expect(res.status).toBe(400);
    });

    it("should return default reaction counts on GET for valid slug", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/reactions?slug=imednet-python-sdk"
      );
      const res = await reactionGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.counts).toHaveProperty("insightful");
      expect(json.counts).toHaveProperty("mind_blowing");
      expect(json.counts).toHaveProperty("actionable");
      expect(json.counts).toHaveProperty("thorough");
    });

    it("should reject invalid reaction type with 400", async () => {
      const req = new NextRequest(
        "http://localhost/api/case-studies/reactions",
        {
          method: "POST",
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            reactionType: "invalid_type",
          }),
        }
      );

      const res = await reactionPOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });

    it("should increment reaction count upon POST with 200", async () => {
      const uniqueSlug = `rx-study-${Date.now()}`;
      const req = new NextRequest(
        "http://localhost/api/case-studies/reactions",
        {
          method: "POST",
          headers: { "x-forwarded-for": "10.0.1.1", "user-agent": "rx-agent" },
          body: JSON.stringify({
            caseStudySlug: uniqueSlug,
            reactionType: "insightful",
          }),
        }
      );

      const res = await reactionPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.counts.insightful).toBeGreaterThanOrEqual(1);
    });

    it("returns 503 on database failure and preserves queued offline reactions instead of falsely returning 200", async () => {
      vi.mocked(prisma.caseStudyReaction.createMany).mockRejectedValueOnce(
        new Error("Neon compute unavailable")
      );

      const req = new NextRequest(
        "http://localhost/api/case-studies/reactions",
        {
          method: "POST",
          headers: {
            "x-forwarded-for": "10.8.8.8",
            "user-agent": "offline-rx-agent",
          },
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            reactionType: "insightful",
          }),
        }
      );

      const res = await reactionPOST(req);
      expect(res.status).toBe(503);

      const store = createMemoryOfflineQueueStore();
      await store.enqueue(
        {
          id: "cs_rx_offline_1",
          type: "reaction",
          endpoint: "/api/case-studies/reactions",
          body: {
            caseStudySlug: "imednet-python-sdk",
            reactionType: "insightful",
          },
        },
        1000
      );
      const dispatcher = createOfflineDispatcher({
        store,
        now: () => 2000,
        setTimer: () => 0,
        send: async () =>
          res.ok
            ? { kind: "ok" }
            : { kind: "transient", status: res.status, reason: "HTTP 503" },
      });

      const flushResult = await dispatcher.flush();
      expect(flushResult.processed).toBe(0);
      const remaining = await store.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.retries).toBe(1);
    });

    it("returns HTTP 202 with durable: false on feedback and reaction routes when CaseStudyService falls back to memory", async () => {
      const services = await import("@/lib/services");

      const fbFallbackHandler = new services.SubmitCaseStudyFeedbackHandler({
        feedback: {
          findFirst: vi
            .fn()
            .mockRejectedValue(new Error("Neon compute unavailable")),
          create: vi.fn(),
        },
        fallbackStore: new Map(),
      });
      const emailSpy = vi
        .spyOn(services.SendFeedbackNotificationHandler.prototype, "execute")
        .mockResolvedValue(createSuccess({ id: "sim_mem", simulated: true }));
      const fbExecSpy = vi
        .spyOn(services.SubmitCaseStudyFeedbackHandler.prototype, "execute")
        .mockImplementationOnce((input) => fbFallbackHandler.execute(input));

      const rxFallbackHandler = new services.SubmitCaseStudyReactionHandler({
        reactions: {
          createMany: vi
            .fn()
            .mockRejectedValue(new Error("Neon compute unavailable")),
          groupBy: vi.fn(),
          findMany: vi.fn(),
        },
        fallbackStore: new Map(),
      });
      const rxExecSpy = vi
        .spyOn(services.SubmitCaseStudyReactionHandler.prototype, "execute")
        .mockImplementationOnce((input) => rxFallbackHandler.execute(input));

      try {
        const fbRes = await feedbackRoute.POST(
          new NextRequest("http://localhost/api/case-studies/feedback", {
            method: "POST",
            headers: {
              "x-forwarded-for": "10.9.9.42",
              "user-agent": "volatile-feedback-agent",
            },
            body: JSON.stringify({
              caseStudySlug: "oxidizemath",
              takeaways: ["Architecture & System Design"],
              comments: "Submitted while primary storage fell back to memory.",
            }),
          })
        );
        expect(fbRes.status).toBe(202);
        const fbJson = await fbRes.json();
        expect(fbJson.success).toBe(true);
        expect(fbJson.durable).toBe(false);
        expect(emailSpy).not.toHaveBeenCalled();

        const rxRes = await reactionPOST(
          new NextRequest("http://localhost/api/case-studies/reactions", {
            method: "POST",
            headers: {
              "x-forwarded-for": "10.9.9.43",
              "user-agent": "volatile-rx-agent",
            },
            body: JSON.stringify({
              caseStudySlug: "oxidizemath",
              reactionType: "thorough",
            }),
          })
        );
        expect(rxRes.status).toBe(202);
        const rxJson = await rxRes.json();
        expect(rxJson.success).toBe(true);
        expect(rxJson.durable).toBe(false);
        expect(rxJson.counts.thorough).toBe(1);
      } finally {
        fbExecSpy.mockRestore();
        rxExecSpy.mockRestore();
        emailSpy.mockRestore();
      }
    });
  });
});
