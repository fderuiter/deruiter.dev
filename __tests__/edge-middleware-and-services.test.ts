// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";

// Mock database and upstash redis dependencies
vi.mock("@/lib/db", () => {
  return {
    prisma: {
      caseStudy: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      caseStudyFeedback: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      caseStudyReaction: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      telemetryEvent: {
        createMany: vi.fn(),
        groupBy: vi.fn(),
      },
    },
  };
});

const {
  mockLpush,
  mockExpire,
  mockExec,
  mockRpop,
  mockLmove,
  mockLrem,
  mockLrange,
  mockDel,
} = vi.hoisted(() => ({
  mockLpush: vi.fn(),
  mockExpire: vi.fn(),
  mockExec: vi.fn(),
  mockRpop: vi.fn(),
  mockLmove: vi.fn(),
  mockLrem: vi.fn(),
  mockLrange: vi.fn().mockResolvedValue([]),
  mockDel: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  class MockRedis {
    pipeline() {
      return {
        lpush: mockLpush,
        expire: mockExpire,
        exec: mockExec,
        rpop: mockRpop,
        lmove: mockLmove,
        lrem: mockLrem,
      };
    }
    lrange = mockLrange;
    del = mockDel;
  }
  return { Redis: MockRedis };
});

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class {
      static slidingWindow = vi.fn();
      limit = vi.fn().mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
      });
    },
  };
});

import { proxy } from "@/proxy";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { TelemetryService } from "@/lib/services/telemetry-service";
import {
  generateClientConnectionHash,
  extractClientIp,
} from "@/lib/services/privacy-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { SECURITY_HEADERS } from "@/lib/security-headers";
import { prisma } from "@/lib/db";
import { z } from "zod";

describe("Next.js 16 Proxy & Modular Domain Services Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Proxy & Security Headers", () => {
    it("attaches all standard HTTP security headers to API responses", async () => {
      const req = new NextRequest("http://localhost/api/case-studies", {
        headers: { "x-forwarded-for": "203.0.113.195" },
      });

      const mockEvent = fromPartial<NextFetchEvent>({
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      });

      const res = await proxy(req, mockEvent);

      expect(res).toBeDefined();
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        if (header === "Content-Security-Policy" || header === "x-nonce") {
          expect(res?.headers.get(header)).toBeTruthy();
        } else {
          expect(res?.headers.get(header)).toBe(value);
        }
      });
      const csp = res?.headers.get("Content-Security-Policy");
      const scriptDirective = csp
        ?.split(";")
        .find((d) => d.trim().startsWith("script-src"));
      expect(scriptDirective).toContain("'strict-dynamic'");
      expect(scriptDirective).not.toContain("'unsafe-inline'");
      expect(scriptDirective).not.toContain("'unsafe-eval'");
    });

    it("generates privacy-preserving SHA-256 client token without leaking raw IP address", async () => {
      const rawIp = "198.51.100.42";
      const hash = await generateClientConnectionHash(rawIp);

      expect(hash).toHaveLength(64); // SHA-256 hex string length
      expect(hash).not.toContain(rawIp);
    });

    it("extracts client IP correctly from proxy headers", () => {
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
      });
      const ip = extractClientIp(req);
      expect(ip).toBe("198.51.100.1");
    });
  });

  describe("CaseStudyService Domain Service", () => {
    it("sanitizes HTML content in submissions before database persistence", async () => {
      const input = {
        title: "XSS Defense Case",
        slug: "xss-defense-case",
        primary_language: "TypeScript",
        editorial_content: "Editorial body <script>alert(1)</script>",
        architectural_narrative:
          "<h3>Heading</h3><iframe src='evil.com'></iframe><p>Safe content</p>",
        tags: "security, xss",
      };

      const mockCreate = vi.mocked(prisma.caseStudy.create);
      mockCreate.mockImplementation(
        (args) =>
          Promise.resolve({
            id: "cuid-1",
            ...(args as { data: Record<string, unknown> }).data,
          }) as ReturnType<typeof prisma.caseStudy.create>
      );

      await CaseStudyService.submitCaseStudy(input);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editorial_content: expect.not.stringContaining("<script>"),
          architectural_narrative: expect.not.stringContaining("<iframe"),
        }),
      });
    });
  });

  describe("TelemetryService Domain Service", () => {
    it("buffers telemetry events to Redis list with 48h expiration", async () => {
      mockExec.mockResolvedValueOnce([1]);

      const { event, buffered } = await TelemetryService.recordEvent({
        projectSlug: "/dashboard",
        eventType: "page_view",
      });

      expect(buffered).toBe(true);
      expect(event.projectSlug).toBe("/dashboard");
      expect(mockLpush).toHaveBeenCalledWith(
        "telemetry_buffer",
        expect.objectContaining({
          projectSlug: "/dashboard",
          eventType: "page_view",
        })
      );
      expect(mockExpire).toHaveBeenCalledWith("telemetry_buffer", 172800);
    });

    it("synchronizes buffered telemetry events in batches and skips duplicates", async () => {
      const mockEvents = [
        {
          id: "e-1",
          projectSlug: "/p1",
          eventType: "page_view",
          createdAt: new Date(),
        },
        {
          id: "e-2",
          projectSlug: "/p2",
          eventType: "project_click",
          createdAt: new Date(),
        },
      ];
      mockExec.mockResolvedValueOnce(mockEvents);

      const mockCreateMany = vi.mocked(prisma.telemetryEvent.createMany);
      mockCreateMany.mockResolvedValueOnce({ count: 2 });

      const result = await TelemetryService.syncBufferedEvents(10);

      expect(result).toEqual({
        success: true,
        data: { processed: 2, inserted: 2 },
      });
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ id: "e-1" }),
          expect.objectContaining({ id: "e-2" }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe("Higher-Order API Route Wrapper", () => {
    it("validates request payload schema and formats 400 validation response", async () => {
      const DummySchema = z.object({
        name: z.string().min(3, "Name too short"),
      });

      const handler = createApiHandler(
        async (_req, { data }) => {
          return NextResponse.json({ success: true, name: data.name });
        },
        { schema: DummySchema, type: "body" }
      );

      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ name: "a" }),
      });

      const res = await handler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details[0].message).toBe("Name too short");
    });

    it("catches unhandled handler exceptions and returns sanitized 500 error", async () => {
      const handler = createApiHandler(async () => {
        throw new Error("Secret DB credentials leaked at /var/app/db.ts");
      });

      const req = new NextRequest("http://localhost/api/test");
      const res = await handler(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Internal server error");
      expect(JSON.stringify(json)).not.toContain("/var/app");
    });
  });
});
