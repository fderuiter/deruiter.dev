// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as telemetryPOST } from "@/app/api/telemetry/route";
import { GET as syncGET } from "@/app/api/telemetry/sync/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { openApiSpec } from "@/scripts/generate-openapi";

// Mock database
vi.mock("@/lib/db", () => {
  return {
    prisma: {
      telemetryEvent: {
        create: vi.fn(),
        groupBy: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

// Mock Upstash Redis
vi.mock("@upstash/redis", () => {
  class MockRedis {
    pipeline() {
      return {
        lpush: vi.fn(),
        expire: vi.fn(),
        rpop: vi.fn(),
        lmove: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
    }
    lrange = vi.fn().mockResolvedValue([]);
    del = vi.fn().mockResolvedValue(1);
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
        pending: Promise.resolve(),
      });
    },
  };
});

describe("Declarative Zod Validation Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Telemetry POST Validation", () => {
    it("successfully validates and accepts a correct payload", async () => {
      const payload = {
        projectSlug: "portfolio-website",
        eventType: "page_view",
      };

      vi.mocked(prisma.telemetryEvent.create).mockResolvedValue({
        id: "mock-uuid",
        projectSlug: "portfolio-website",
        eventType: "page_view",
        createdAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await telemetryPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("fails validation if projectSlug is missing", async () => {
      const payload = {
        eventType: "page_view",
      };

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await telemetryPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Missing or invalid projectSlug identifier");
      expect(data.details).toBeDefined();
    });

    it("fails validation if eventType is invalid", async () => {
      const payload = {
        projectSlug: "portfolio-website",
        eventType: "invalid_type",
      };

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await telemetryPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Missing or invalid eventType");
      expect(data.details).toBeDefined();
    });
  });

  describe("Sync Cron GET Validation", () => {
    it("successfully validates default query params", async () => {
      vi.mocked(prisma.telemetryEvent.createMany).mockResolvedValue({
        count: 0,
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry/sync", {
        method: "GET",
      });

      const res = await syncGET(req);
      expect(res.status).toBe(200);
    });

    it("fails validation if batch parameter is invalid", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/telemetry/sync?batch=-5",
        {
          method: "GET",
        }
      );

      const res = await syncGET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
      expect(data.details[0].path).toBe("batch");
    });
  });

  describe("Admin blog draft collection contract", () => {
    it("declares both authorized collection methods and their bounded contracts", () => {
      const route = openApiSpec.paths["/api/admin/blog"];

      expect(route.get).toBeDefined();
      expect(route.post).toBeDefined();
      expect(route.get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "page" }),
          expect.objectContaining({ name: "pageSize" }),
        ])
      );
      expect(route.post?.requestBody).toBeDefined();
      expect(openApiSpec.components.schemas.BlogDraftCreate).toBeDefined();
      expect(openApiSpec.components.schemas.BlogDraftCollection).toBeDefined();
    });
  });

  describe("Admin blog draft item contract", () => {
    it("declares authorized draft read and partial edit contracts", () => {
      const route = openApiSpec.paths["/api/admin/blog/{id}"];

      expect(route.get).toBeDefined();
      expect(route.patch).toBeDefined();
      expect(route.get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "id", in: "path", required: true }),
        ])
      );
      expect(route.patch?.requestBody).toBeDefined();
      expect(openApiSpec.components.schemas.BlogDraftUpdate).toBeDefined();
      expect(
        openApiSpec.components.schemas.BlogDraftUpdateResponse
      ).toBeDefined();
    });
  });
});
