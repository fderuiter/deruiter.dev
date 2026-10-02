// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calculateRelatedReading, normalizeTag } from "@/lib/blog/related";
import type { BlogPostSummary } from "@/lib/blog/types";
import type { CaseStudyData } from "@/lib/case-studies-data";

describe("normalizeTag", () => {
  it("normalizes casing, hyphens, and whitespace consistently", () => {
    expect(normalizeTag("Web Workers")).toBe("webworkers");
    expect(normalizeTag("web-workers")).toBe("webworkers");
    expect(normalizeTag("CDISC ODM")).toBe("cdiscodm");
    expect(normalizeTag("cdisc-odm")).toBe("cdiscodm");
  });
});

describe("calculateRelatedReading", () => {
  const currentPost = {
    slug: "current-clinical-post",
    pillar: "clinical-data-engineering" as const,
    tags: ["cdisc", "odm", "typescript", "clinical-trials"],
  };

  const sampleBlogPosts: BlogPostSummary[] = [
    {
      slug: "current-clinical-post",
      title: "Current Post (Self)",
      dek: "Should be excluded",
      pillar: "clinical-data-engineering",
      tags: ["cdisc", "odm"],
      publishedAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-03-01"),
      readingTimeMinutes: 5,
      heroImageUrl: null,
    },
    {
      slug: "audit-trail-design",
      title: "21 CFR Part 11 Audit Trail Design",
      dek: "Immutable audit logs for clinical systems",
      pillar: "clinical-data-engineering", // +10 points
      tags: ["clinical-trials", "typescript", "gxp"], // 2 matching tags -> +8 points = 18
      publishedAt: new Date("2026-02-15"),
      updatedAt: new Date("2026-02-15"),
      readingTimeMinutes: 6,
      heroImageUrl: null,
    },
    {
      slug: "lean4-formal-methods",
      title: "Formal Verification in Lean 4",
      dek: "Mathematical proofs in production",
      pillar: "formal-verification", // 0
      tags: ["lean4", "math", "algorithms"], // 0
      publishedAt: new Date("2026-01-20"),
      updatedAt: new Date("2026-01-20"),
      readingTimeMinutes: 7,
      heroImageUrl: null,
    },
    {
      slug: "typescript-compiler-dx",
      title: "TypeScript Compiler DX",
      dek: "Speeding up typechecks",
      pillar: "agent-first-dx", // 0
      tags: ["typescript", "compiler"], // 1 matching tag -> +4
      publishedAt: new Date("2026-01-10"),
      updatedAt: new Date("2026-01-10"),
      readingTimeMinutes: 4,
      heroImageUrl: null,
    },
  ];

  const sampleCaseStudies: CaseStudyData[] = [
    {
      id: "cs-1",
      slug: "clinical-data-mapper",
      title: "Clinical Data Mapper: From ODM to SDTM",
      primary_language: "TypeScript",
      github_url: "https://github.com/test/mapper",
      published: true,
      simulated_telemetry: false,
      tags: "TypeScript, CDISC, ODM, SDTM, XML Parser, Clinical Trials, HIPAA", // 4 matching tags (typescript, cdisc, odm, clinical-trials) = +16, plus pillar keyword = +6 -> 22
      editorial_content: "Automated mapping pipeline.",
      architectural_narrative: "Narrative details.",
      created_at: new Date("2025-10-01"),
      updated_at: new Date("2025-10-01"),
    },
    {
      id: "cs-2",
      slug: "draft-study",
      title: "Unpublished Draft",
      primary_language: "Rust",
      github_url: "",
      published: false, // Must be excluded
      simulated_telemetry: false,
      tags: "CDISC, ODM",
      editorial_content: "Draft content.",
      architectural_narrative: "Draft narrative.",
      created_at: new Date("2025-09-01"),
      updated_at: new Date("2025-09-01"),
    },
  ];

  it("excludes the current post from recommendations", () => {
    const related = calculateRelatedReading(currentPost, {
      posts: sampleBlogPosts,
    });
    expect(related.some((item) => item.slug === currentPost.slug)).toBe(false);
  });

  it("correctly ranks items by calculated relevance score", () => {
    const related = calculateRelatedReading(currentPost, {
      posts: sampleBlogPosts,
      caseStudies: sampleCaseStudies,
      limit: 3,
    });

    expect(related.length).toBe(3);
    // Highest should be clinical-data-mapper (22 points)
    expect(related[0].slug).toBe("clinical-data-mapper");
    expect(related[0].type).toBe("case-study");
    expect(related[0].score).toBe(22);
    expect(related[0].matchedTags).toContain("TypeScript");

    // Second should be audit-trail-design (18 points: 10 pillar + 8 tags)
    expect(related[1].slug).toBe("audit-trail-design");
    expect(related[1].type).toBe("dispatch");
    expect(related[1].score).toBe(18);

    // Third should be typescript-compiler-dx (4 points)
    expect(related[2].slug).toBe("typescript-compiler-dx");
    expect(related[2].score).toBe(4);
  });

  it("filters out unpublished case studies", () => {
    const related = calculateRelatedReading(currentPost, {
      posts: [],
      caseStudies: sampleCaseStudies,
    });

    expect(related.some((item) => item.slug === "draft-study")).toBe(false);
  });

  it("filters out items with zero relevance score", () => {
    const related = calculateRelatedReading(currentPost, {
      posts: sampleBlogPosts,
    });

    // lean4-formal-methods has 0 score
    expect(related.some((item) => item.slug === "lean4-formal-methods")).toBe(
      false
    );
  });

  it("respects the limit argument", () => {
    const related = calculateRelatedReading(currentPost, {
      posts: sampleBlogPosts,
      caseStudies: sampleCaseStudies,
      limit: 2,
    });

    expect(related.length).toBe(2);
  });

  it("matches pillar keywords against whole title words only", () => {
    const study = (id: string, title: string): CaseStudyData => ({
      ...sampleCaseStudies[0],
      id,
      slug: id,
      title,
      tags: "",
    });
    const related = calculateRelatedReading(
      { slug: "x", pillar: "formal-verification", tags: [] },
      {
        posts: [],
        caseStudies: [
          study("hono", "Hono-Kiln: A Clean Starting Point"),
          study("lean", "Proofs in Lean"),
        ],
      }
    );

    expect(related.map((item) => item.slug)).toEqual(["lean"]);
  });
});
