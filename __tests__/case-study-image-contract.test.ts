// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return { ...actual, isRedisConfigured: () => false };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const fallback = FALLBACK_CASE_STUDIES[0];

function row(heroImageUrl: string | null) {
  return {
    id: "cs-1",
    slug: fallback.slug,
    title: fallback.title,
    primary_language: fallback.primary_language,
    github_url: fallback.github_url,
    published: true,
    simulated_telemetry: false,
    tags: fallback.tags,
    editorial_content: fallback.editorial_content,
    architectural_narrative: fallback.architectural_narrative,
    commands_json: null,
    playback_json: null,
    hero_image_url: heroImageUrl,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-02T00:00:00Z"),
  };
}

describe("CaseStudyService.updateCaseStudyImage ServiceResult contract (ADR 0028, #1140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the updated record in a success envelope", async () => {
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(
      fromPartial(row("/api/media/old.png"))
    );
    vi.mocked(prisma.caseStudy.update).mockResolvedValue(
      fromPartial(row("/api/media/new.png"))
    );

    const result = await CaseStudyService.updateCaseStudyImage(
      fallback.slug,
      "/api/media/new.png"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hero_image_url).toBe("/api/media/new.png");
      expect(result.data.slug).toBe(fallback.slug);
    }
  });

  it("returns CASE_STUDY_NOT_FOUND instead of throwing for an unknown slug", async () => {
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(null);

    const result = await CaseStudyService.updateCaseStudyImage(
      "no-such-study",
      "/api/media/new.png"
    );

    expect(result).toMatchObject({
      success: false,
      error: {
        code: "CASE_STUDY_NOT_FOUND",
        message: 'Case study with slug "no-such-study" not found',
        recoverable: false,
      },
    });
    expect(prisma.caseStudy.create).not.toHaveBeenCalled();
  });

  it("returns PERSISTENCE_FAILED instead of throwing when the database write fails", async () => {
    const dbError = new Error("Database connection lost");
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(
      fromPartial(row(null))
    );
    vi.mocked(prisma.caseStudy.update).mockRejectedValue(dbError);

    const result = await CaseStudyService.updateCaseStudyImage(
      fallback.slug,
      "/api/media/new.png"
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: "PERSISTENCE_FAILED", recoverable: true },
    });
    if (!result.success) {
      // The raw database error is carried for server logs, not the message.
      expect(result.error.details).toBe(dbError);
      expect(result.error.message).not.toContain("connection lost");
    }
  });
});
