// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as feedbackRoute from "@/app/api/case-studies/feedback/route";
import { EmailService } from "@/lib/services/email-service";
import {
  POST as reactionPOST,
  GET as reactionGET,
} from "@/app/api/case-studies/reactions/route";

describe("Case Study Feedback & Reaction API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
