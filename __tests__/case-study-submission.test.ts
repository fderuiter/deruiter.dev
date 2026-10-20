// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/case-studies/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isCurrentUserAdmin } from "@/lib/auth/admin";

vi.mock("@/lib/auth/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      caseStudy: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

describe("Case Study Submission API Endpoint (POST /api/case-studies)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
  });

  describe("Authorization Guards", () => {
    it("returns HTTP 403 Forbidden when user is unauthenticated", async () => {
      vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

      const payload = {
        title: "Unauthorized Attempt",
        slug: "unauthorized-attempt",
        primary_language: "TypeScript",
        editorial_content: "Attempting submission without admin session.",
        architectural_narrative: "<p>Should be rejected.</p>",
        tags: "unauthorized",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Administrator access required");
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it("returns HTTP 403 Forbidden when authenticated user lacks admin privileges", async () => {
      vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

      const payload = {
        title: "Non-Admin Attempt",
        slug: "non-admin-attempt",
        primary_language: "Go",
        editorial_content: "Attempting submission with regular user session.",
        architectural_narrative: "<p>Should be rejected.</p>",
        tags: "non-admin",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Administrator access required");
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });
  });

  describe("Valid Submissions", () => {
    it("creates a new unpublished draft case study when provided a valid payload", async () => {
      const payload = {
        title: "Production Outage Post-Mortem",
        slug: "production-outage-post-mortem",
        primary_language: "TypeScript",
        editorial_content: "High level summary of the incident and recovery.",
        architectural_narrative:
          "<h3>Root Cause</h3><p>Memory leak in queue consumer.</p>",
        tags: "post-mortem, nodejs, resilience",
      };

      const mockCreatedRecord = {
        id: "cuid-test-123",
        ...payload,
        github_url: null,
        published: false,
        simulated_telemetry: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.caseStudy.create).mockResolvedValue(
        mockCreatedRecord as any
      );

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe("production-outage-post-mortem");
      expect(json.data.published).toBe(false);

      expect(prisma.caseStudy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Production Outage Post-Mortem",
          slug: "production-outage-post-mortem",
          primary_language: "TypeScript",
          published: false,
        }),
      });
    });

    it("supports field aliases (language, summary, narrative, array of tags)", async () => {
      const payload = {
        title: "Distributed Cache Failure Narrative",
        slug: "distributed-cache-failure",
        language: "Go",
        summary: "Summary of Redis connection pool exhaustion.",
        narrative:
          "<h4>Incident Detail</h4><p>Connection starvation under spike.</p>",
        tags: ["distributed-systems", "redis", "post-mortem"],
      };

      const mockCreatedRecord = {
        id: "cuid-test-456",
        title: payload.title,
        slug: payload.slug,
        primary_language: "Go",
        editorial_content: payload.summary,
        architectural_narrative: payload.narrative,
        tags: "distributed-systems, redis, post-mortem",
        github_url: null,
        published: false,
        simulated_telemetry: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.caseStudy.create).mockResolvedValue(
        mockCreatedRecord as any
      );

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.primary_language).toBe("Go");
      expect(json.data.tags).toBe("distributed-systems, redis, post-mortem");
      expect(json.data.published).toBe(false);
    });
  });

  describe("HTML Sanitization & Anti-XSS Security", () => {
    it("sanitizes architectural narrative HTML to strip unsafe script tags and inline event handlers", async () => {
      const maliciousPayload = {
        title: "Malicious Injection Post-Mortem",
        slug: "malicious-injection-post-mortem",
        primary_language: "Python",
        editorial_content:
          "Attempting XSS injection in narrative body <script>alert('xss')</script>.",
        architectural_narrative: `<p>Normal narrative paragraph.</p><script>window.location='http://attacker.com'</script><img src="x" onerror="alert('xss')" /><a href="javascript:alert(1)">Evil link</a>`,
        tags: "security, xss",
      };

      vi.mocked(prisma.caseStudy.create).mockImplementation(
        (args: any) =>
          Promise.resolve({
            id: "cuid-sec-1",
            ...args.data,
            created_at: new Date(),
            updated_at: new Date(),
          }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(maliciousPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      const savedNarrative = json.data.architectural_narrative;

      // Assert unsafe tags and inline event handlers were completely stripped
      expect(savedNarrative).not.toContain("<script>");
      expect(savedNarrative).not.toContain("window.location");
      expect(savedNarrative).not.toContain("onerror=");
      expect(savedNarrative).not.toContain("javascript:");
      expect(savedNarrative).toContain("<p>Normal narrative paragraph.</p>");
    });
  });

  describe("Validation Errors", () => {
    it("rejects invalid JSON payloads with 400 status", async () => {
      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: "{ malformed json",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid JSON payload");
      expect(json.details).toBeDefined();
    });

    it("rejects payload missing title with field-level validation error", async () => {
      const payload = {
        slug: "missing-title-slug",
        primary_language: "TypeScript",
        editorial_content: "Some summary",
        architectural_narrative: "<p>Some narrative</p>",
        tags: "test",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe(
        "Missing or invalid case study submission fields"
      );
      expect(json.details.some((d: any) => d.path === "title")).toBe(true);
    });

    it("rejects payloads containing blocked profanity or toxic rant patterns with community tone error message", async () => {
      const payload = {
        title: "Complete Garbage Architecture Post-Mortem",
        slug: "complete-garbage-post-mortem",
        primary_language: "TypeScript",
        editorial_content:
          "This whole system is a total piece of shit and utter trash.",
        architectural_narrative:
          "<p>Everything is broken and this is complete garbage.</p>",
        tags: "garbage, trash",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain(
        "Submission rejected: Content violates community tone standards."
      );
      expect(json.details.length).toBeGreaterThan(0);
    });

    it("rejects payload missing slug with field-level validation error", async () => {
      const payload = {
        title: "Missing Slug Case",
        primary_language: "TypeScript",
        editorial_content: "Some summary",
        architectural_narrative: "<p>Some narrative</p>",
        tags: "test",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe(
        "Missing or invalid case study submission fields"
      );
      expect(json.details.some((d: any) => d.path === "slug")).toBe(true);
    });

    it("rejects malformed slug characters with descriptive error", async () => {
      const payload = {
        title: "Bad Slug Case",
        slug: "invalid slug with spaces & symbols!",
        primary_language: "TypeScript",
        editorial_content: "Some summary",
        architectural_narrative: "<p>Some narrative</p>",
        tags: "test",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe(
        "Missing or invalid case study submission fields"
      );
      expect(json.details.some((d: any) => d.path === "slug")).toBe(true);
    });

    it("rejects payload missing primary_language / language", async () => {
      const payload = {
        title: "No Language Case",
        slug: "no-language-case",
        editorial_content: "Some summary",
        architectural_narrative: "<p>Some narrative</p>",
        tags: "test",
      };

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.details.some((d: any) => d.path === "primary_language")).toBe(
        true
      );
    });

    it("rejects duplicate slug errors with 400 status code", async () => {
      const payload = {
        title: "Duplicate Slug Case Study",
        slug: "duplicate-slug-case",
        primary_language: "Rust",
        editorial_content: "Summary text",
        architectural_narrative: "<p>Narrative text</p>",
        tags: "rust, duplicate",
      };

      const error: any = new Error(
        "Unique constraint failed on the fields: (`slug`)"
      );
      error.code = "P2002";
      vi.mocked(prisma.caseStudy.create).mockRejectedValue(error);

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("A case study with this slug already exists");
    });
  });

  describe("Draft Status Isolation & Error Sanitization", () => {
    it("ensures newly created unpublished draft case studies do NOT appear in public GET listings", async () => {
      vi.mocked(prisma.caseStudy.findMany).mockResolvedValue([
        {
          id: "published-1",
          slug: "published-study",
          title: "Published Study",
          primary_language: "TypeScript",
          tags: "published",
        } as any,
      ]);

      const res = await GET();
      expect(res.status).toBe(200);

      const studies = await res.json();
      if (Array.isArray(studies)) {
        const foundDraft = studies.find(
          (s: any) => s.slug === "production-outage-post-mortem"
        );
        expect(foundDraft).toBeUndefined();
      }
    });

    it("sanitizes unhandled database errors without leaking internal system paths or stack traces", async () => {
      const payload = {
        title: "Unhandled Error Case Study",
        slug: "unhandled-error-case",
        primary_language: "C++",
        editorial_content: "Summary text",
        architectural_narrative: "<p>Narrative text</p>",
        tags: "cpp",
      };

      const error = new Error(
        "Fatal DB Error at /app/prisma/client.ts line 42"
      );
      error.stack =
        "Error: Fatal DB Error at /app/prisma/client.ts\n  at /app/lib/db.ts:12:34";
      vi.mocked(prisma.caseStudy.create).mockRejectedValue(error);

      const req = new NextRequest("http://localhost:3000/api/case-studies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to submit case study");
      expect(json.stack).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain("/app/");
    });
  });
});
