// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

interface StoredFeedbackRow {
  id: string;
  caseStudySlug: string;
  takeaways: string;
  comments: string;
  connectionHash: string;
  operationKey?: string;
  createdAt: Date;
}

interface StoredReactionRow {
  id: string;
  caseStudySlug: string;
  reactionType: string;
  connectionHash: string;
}

const { feedbackRows, reactionRows, dbFailureState } = vi.hoisted(() => ({
  feedbackRows: [] as StoredFeedbackRow[],
  reactionRows: [] as StoredReactionRow[],
  dbFailureState: { failFeedback: false, failReactions: false },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudyFeedback: {
      findFirst: vi.fn(
        async (args: {
          where: {
            caseStudySlug?: string;
            connectionHash: string;
            operationKey?: string;
            createdAt?: { gte: Date };
          };
        }) => {
          if (dbFailureState.failFeedback) {
            throw new Error("Neon connection refused");
          }
          const { where } = args;
          return (
            feedbackRows.find((row) => {
              if (row.connectionHash !== where.connectionHash) return false;
              if (where.operationKey !== undefined) {
                return row.operationKey === where.operationKey;
              }
              if (
                where.caseStudySlug !== undefined &&
                row.caseStudySlug !== where.caseStudySlug
              ) {
                return false;
              }
              if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) {
                return false;
              }
              return true;
            }) ?? null
          );
        }
      ),
      create: vi.fn(
        async (args: {
          data: {
            caseStudySlug: string;
            takeaways: string;
            comments: string;
            connectionHash: string;
            operationKey?: string;
          };
        }) => {
          if (dbFailureState.failFeedback) {
            throw new Error("Neon connection refused");
          }
          const row: StoredFeedbackRow = {
            id: `fb_${feedbackRows.length + 1}`,
            caseStudySlug: args.data.caseStudySlug,
            takeaways: args.data.takeaways,
            comments: args.data.comments,
            connectionHash: args.data.connectionHash,
            operationKey: args.data.operationKey,
            createdAt: new Date(),
          };
          feedbackRows.push(row);
          return row;
        }
      ),
    },
    caseStudyReaction: {
      createMany: vi.fn(
        async (args: {
          data: Array<{
            caseStudySlug: string;
            reactionType: string;
            connectionHash: string;
          }>;
          skipDuplicates: boolean;
        }) => {
          if (dbFailureState.failReactions) {
            throw new Error("Neon connection refused");
          }
          let count = 0;
          for (const item of args.data) {
            const exists = reactionRows.some(
              (r) =>
                r.caseStudySlug === item.caseStudySlug &&
                r.reactionType === item.reactionType &&
                r.connectionHash === item.connectionHash
            );
            if (!exists || !args.skipDuplicates) {
              reactionRows.push({
                id: `rx_${reactionRows.length + 1}`,
                ...item,
              });
              count++;
            }
          }
          return { count };
        }
      ),
      groupBy: vi.fn(async (args: { where: { caseStudySlug: string } }) => {
        if (dbFailureState.failReactions) {
          throw new Error("Neon connection refused");
        }
        const map = new Map<string, number>();
        for (const r of reactionRows) {
          if (r.caseStudySlug === args.where.caseStudySlug) {
            map.set(r.reactionType, (map.get(r.reactionType) ?? 0) + 1);
          }
        }
        return Array.from(map.entries()).map(([reactionType, idCount]) => ({
          reactionType,
          _count: { id: idCount },
        }));
      }),
      findMany: vi.fn(
        async (args: {
          where: { caseStudySlug: string; connectionHash: string };
        }) => {
          if (dbFailureState.failReactions) {
            throw new Error("Neon connection refused");
          }
          return reactionRows
            .filter(
              (r) =>
                r.caseStudySlug === args.where.caseStudySlug &&
                r.connectionHash === args.where.connectionHash
            )
            .map((r) => ({ reactionType: r.reactionType }));
        }
      ),
    },
  },
}));

import * as feedbackRoute from "@/app/api/case-studies/feedback/route";
import { EmailService } from "@/__tests__/helpers/legacy-domain-facades";
import {
  POST as reactionPOST,
  GET as reactionGET,
} from "@/app/api/case-studies/reactions/route";

describe("Case Study Feedback & Reaction API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedbackRows.length = 0;
    reactionRows.length = 0;
    dbFailureState.failFeedback = false;
    dbFailureState.failReactions = false;
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
        .spyOn(EmailService, "sendFeedbackNotification")
        .mockResolvedValue(undefined as never);
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

    it("returns HTTP 503 on feedback and reaction writes when storage fails (ADR 0043)", async () => {
      dbFailureState.failFeedback = true;
      dbFailureState.failReactions = true;

      const fbReq = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        {
          method: "POST",
          headers: { "x-forwarded-for": "10.9.0.1", "user-agent": "outage" },
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            takeaways: ["Architecture & System Design"],
            comments:
              "Thoughtful architectural feedback during storage outage.",
          }),
        }
      );
      const fbRes = await feedbackRoute.POST(fbReq);
      expect(fbRes.status).toBe(503);

      const rxReq = new NextRequest(
        "http://localhost/api/case-studies/reactions",
        {
          method: "POST",
          headers: { "x-forwarded-for": "10.9.0.1", "user-agent": "outage" },
          body: JSON.stringify({
            caseStudySlug: "imednet-python-sdk",
            reactionType: "insightful",
          }),
        }
      );
      const rxRes = await reactionPOST(rxReq);
      expect(rxRes.status).toBe(503);
    });
  });
});
