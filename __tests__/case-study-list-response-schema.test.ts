// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/case-studies/route";
import { prisma } from "@/lib/db";
import {
  CaseStudyListResponseSchema,
  CaseStudySummarySchema,
} from "@/lib/schemas";

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  getScopedRedisKey: (key: string) => key,
  isRedisConfigured: () => false,
}));

const dbRecord = {
  id: "cs-db-1",
  slug: "db-only-study",
  title: "Database Only Study",
  primary_language: "TypeScript",
  github_url: null,
  published: true,
  simulated_telemetry: false,
  tags: "clinical, edc, mapping",
  editorial_content: "Summary",
  architectural_narrative: "<p>Narrative</p>",
  commands_json: null,
  playback_json: null,
  hero_image_url: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("GET /api/case-studies response contract (#1426)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValue(fromAny([dbRecord]));
  });

  it("returns a body that satisfies CaseStudyListResponseSchema", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body: unknown = await res.json();
    const parsed = CaseStudyListResponseSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    const studies = parsed.data ?? [];
    expect(studies.length).toBeGreaterThan(1);
    const dbStudy = studies.find((s) => s.slug === "db-only-study");
    expect(dbStudy?.tags).toBe("clinical, edc, mapping");
  });

  it("returns tags as a comma-separated string for every item, including static fallbacks", async () => {
    const res = await GET();
    const studies = (await res.json()) as Array<Record<string, unknown>>;

    for (const study of studies) {
      expect(typeof study.tags, `tags for ${String(study.slug)}`).toBe(
        "string"
      );
    }
  });

  it("rejects the array shape the schema previously documented", () => {
    const result = CaseStudySummarySchema.safeParse({
      id: "x",
      slug: "x",
      title: "X",
      primary_language: "TypeScript",
      tags: ["clinical", "edc"],
    });
    expect(result.success).toBe(false);
  });

  it("documents tags as a described string in openapi.json", () => {
    const spec = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "openapi.json"), "utf8")
    ) as {
      components: {
        schemas: Record<
          string,
          {
            properties: Record<string, { type?: string; description?: string }>;
          }
        >;
      };
    };
    const tags = spec.components.schemas.CaseStudySummary.properties.tags;
    expect(tags.type).toBe("string");
    expect(tags.description).toMatch(/comma-separated/i);
  });
});
