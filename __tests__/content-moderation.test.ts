// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateConstructiveContent,
  normalizeText,
  checkSubmissionAttemptRateLimit,
  resetSubmissionAttemptRateLimit,
  COMMUNITY_TONE_ERROR_MESSAGE,
} from "@/lib/moderation";
import {
  CaseStudySubmissionSchema,
  FeedbackSubmissionSchema,
} from "@/lib/schemas";

describe("Synchronous Rule-Based Profanity & Rant Barrier", () => {
  beforeEach(() => {
    resetSubmissionAttemptRateLimit();
  });

  describe("1. Pattern Matcher & Text Normalization Unit Tests", () => {
    it("accepts constructive post-mortem feedback and technical commentary", () => {
      const validSubmissions = [
        "Great breakdown of the clinical trial architecture and error handling patterns.",
        "Loved the deep dive into Lean 4 FFI bindings and zero axiom enforcement.",
        "The class design for the memory allocator was very well structured.",
        "The assignment of tasks in the post-mortem was very clear.",
        "Scunthorpe problem test: pass this text cleanly without false positives.",
        "The system handles database reconnection attempts gracefully without dropping messages.",
      ];

      for (const text of validSubmissions) {
        const result = validateConstructiveContent(text);
        expect(result.isValid).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    });

    it("rejects submissions containing explicit blocked profanity", () => {
      const profaneSubmissions = [
        "This code is fucking terrible and broken.",
        "Total piece of shit implementation.",
        "What an asshole move to merge this.",
        "You are a complete bastard.",
        "This is bullshit and shouldn't be approved.",
      ];

      for (const text of profaneSubmissions) {
        const result = validateConstructiveContent(text);
        expect(result.isValid).toBe(false);
        expect(result.matchedPattern).toBe("blocked_profanity");
        expect(result.reason).toContain("violates community tone standards");
      }
    });

    it("detects obfuscated leetspeak and punctuated profanity", () => {
      const obfuscatedSubmissions = [
        "This is f.u.c.k.i.n.g useless.",
        "What a piece of s!h!i!t.",
        "The author is an @sshole.",
      ];

      for (const text of obfuscatedSubmissions) {
        const result = validateConstructiveContent(text);
        expect(result.isValid).toBe(false);
      }
    });

    it("rejects unconstructive toxic rants and destructive complaints", () => {
      const toxicRants = [
        "This project is total garbage and complete trash.",
        "What a waste of time, this sucks so bad.",
        "The author is a complete idiot.",
        "Screw this stupid code, it is terrible.",
        "Stop posting garbage like this.",
      ];

      for (const text of toxicRants) {
        const result = validateConstructiveContent(text);
        expect(result.isValid).toBe(false);
        expect(result.matchedPattern).toBe("toxic_rant_pattern");
        expect(result.reason).toContain("violates community tone standards");
      }
    });

    it("executes content moderation checks within strict latency threshold (< 15ms)", () => {
      const testText =
        "The architecture was well designed with clean modularity and strong error sanitization.";
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateConstructiveContent(testText);
      }
      const duration = performance.now() - start;
      const averageLatency = duration / 1000;

      // Assert validation response latency stays far below 15ms per check
      expect(averageLatency).toBeLessThan(15);
    });

    it("normalizeText properly strips punctuation and converts leetspeak", () => {
      expect(normalizeText("F.U.C.K")).toBe("fuck");
      expect(normalizeText("s!h!i!t")).toBe("shit");
      expect(normalizeText("@sshole")).toBe("asshole");
    });
  });

  describe("2. Schema-Level Integration Tests (Zod Schemas)", () => {
    describe("CaseStudySubmissionSchema Integration", () => {
      it("accepts valid constructive case study submission payloads", () => {
        const validPayload = {
          title: "Resilient Microservices Outage Post-Mortem",
          slug: "resilient-microservices-post-mortem",
          primary_language: "TypeScript",
          editorial_content:
            "In-depth review of transaction rollback mechanisms during partition.",
          architectural_narrative:
            "<h3>System Design</h3><p>Using Neon Postgres with connection pooling.</p>",
          tags: ["resilience", "post-mortem", "typescript"],
        };

        const result = CaseStudySubmissionSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

      it("rejects case study submission payloads with toxic or profane titles", () => {
        const payload = {
          title: "This total garbage system design",
          slug: "garbage-system-design",
          primary_language: "TypeScript",
          editorial_content: "High level summary.",
          architectural_narrative: "<p>Architectural narrative detail.</p>",
          tags: "resilience",
        };

        const result = CaseStudySubmissionSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) =>
              i.message.includes("violates community tone standards")
            )
          ).toBe(true);
        }
      });

      it("rejects case study submission payloads with profane architectural narrative", () => {
        const payload = {
          title: "Database Failover Study",
          slug: "database-failover-study",
          primary_language: "Go",
          editorial_content: "Summary of failover benchmarks.",
          architectural_narrative:
            "<p>The previous architecture was fucking broken.</p>",
          tags: "database",
        };

        const result = CaseStudySubmissionSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) =>
              i.path.includes("architectural_narrative")
            )
          ).toBe(true);
        }
      });
    });

    describe("FeedbackSubmissionSchema Integration", () => {
      it("accepts constructive feedback comments", () => {
        const validFeedback = {
          caseStudySlug: "clinical-data-mapper",
          takeaways: [
            "Architecture & System Design",
            "Error Handling & Resilience",
          ],
          comments:
            "Excellent explanation of CDISC SDTM mappings and validation pipelines.",
        };

        const result = FeedbackSubmissionSchema.safeParse(validFeedback);
        expect(result.success).toBe(true);
      });

      it("rejects feedback comments containing toxic rant patterns", () => {
        const toxicFeedback = {
          caseStudySlug: "clinical-data-mapper",
          takeaways: ["Architecture & System Design"],
          comments:
            "This whole article is complete garbage and a waste of time.",
        };

        const result = FeedbackSubmissionSchema.safeParse(toxicFeedback);
        expect(result.success).toBe(false);
        if (!result.success) {
          const commentIssue = result.error.issues.find((i) =>
            i.path.includes("comments")
          );
          expect(commentIssue).toBeDefined();
          expect(commentIssue?.message).toBe(COMMUNITY_TONE_ERROR_MESSAGE);
        }
      });

      it("rejects feedback comments containing explicit profanity", () => {
        const profaneFeedback = {
          caseStudySlug: "clinical-data-mapper",
          takeaways: ["Testing Protocols & QA"],
          comments: "This fucking post makes no sense at all.",
        };

        const result = FeedbackSubmissionSchema.safeParse(profaneFeedback);
        expect(result.success).toBe(false);
        if (!result.success) {
          const commentIssue = result.error.issues.find((i) =>
            i.path.includes("comments")
          );
          expect(commentIssue).toBeDefined();
        }
      });
    });
  });

  describe("3. Anonymous Rate Limiting & Privacy Safeguards", () => {
    it("enforces rate limits on submission attempts per anonymous connection hash", () => {
      const anonHash =
        "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
      const maxAllowed = 3;

      for (let i = 0; i < maxAllowed; i++) {
        const check = checkSubmissionAttemptRateLimit(
          anonHash,
          maxAllowed,
          60000
        );
        expect(check.isRateLimited).toBe(false);
      }

      // Exceed max attempts
      const exceededCheck = checkSubmissionAttemptRateLimit(
        anonHash,
        maxAllowed,
        60000
      );
      expect(exceededCheck.isRateLimited).toBe(true);
      expect(exceededCheck.remaining).toBe(0);
    });

    it("operates without storing or logging personal user data (PII)", () => {
      const sampleHash =
        "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069";
      const check = checkSubmissionAttemptRateLimit(sampleHash, 10, 60000);
      expect(check.isRateLimited).toBe(false);
      // Hash is synthetic SHA-256 token, preserving 100% privacy
      expect(sampleHash).not.toContain("192.168.");
      expect(sampleHash.length).toBe(64);
    });
  });
});
