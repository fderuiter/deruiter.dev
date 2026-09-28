// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import {
  generateMetadata,
  generateStaticParams,
} from "@/app/desktop/case-studies/[slug]/page";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { scanText } from "@/lib/security-scan";

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
  },
}));

const NEW_CASE_STUDY_SLUGS = [
  "duckdeploy",
  "cardiac-risk-modeling",
  "4glory",
  "crf-xl",
  "promptops",
] as const;

describe("New Production Engineering Case Studies Unit Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValue([]);
  });

  describe("1. CaseStudyService Fallback Data Resolution", () => {
    it.each(NEW_CASE_STUDY_SLUGS)(
      "resolves '%s' from fallback data when database is unavailable",
      async (slug) => {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        expect(study?.slug).toBe(slug);
        expect(study?.published).toBe(true);
        expect(study?.title.length).toBeGreaterThan(5);
        expect(study?.primary_language.length).toBeGreaterThan(1);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
        expect(study?.editorial_content.length).toBeGreaterThan(50);
        expect(study?.architectural_narrative.length).toBeGreaterThan(200);
      }
    );

    it("includes all 5 new case studies in getAllPublishedCaseStudies()", async () => {
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      const slugs = allStudies.map((s) => s.slug);

      for (const expectedSlug of NEW_CASE_STUDY_SLUGS) {
        expect(slugs).toContain(expectedSlug);
      }
    });

    it("includes all 5 new case studies in getAllPublishedSlugs()", async () => {
      const slugs = await CaseStudyService.getAllPublishedSlugs();

      for (const expectedSlug of NEW_CASE_STUDY_SLUGS) {
        expect(slugs).toContain(expectedSlug);
      }
    });
  });

  describe("2. Tags Schema & Content Quality Validation", () => {
    it.each(NEW_CASE_STUDY_SLUGS)(
      "validates tag format and domain taxonomy for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const tagList = study!.tags.split(",").map((t) => t.trim());
        expect(tagList.length).toBeGreaterThanOrEqual(4);

        for (const tag of tagList) {
          expect(tag.length).toBeGreaterThan(1);
          expect(tag).not.toContain("undefined");
          expect(tag).not.toContain("null");
        }
      }
    );

    it("asserts domain-specific tag signatures for each new study", () => {
      const duckDeploy = FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === "duckdeploy"
      );
      expect(duckDeploy?.tags).toContain("TypeScript");
      expect(duckDeploy?.tags).toContain("JSON Schema");
      expect(duckDeploy?.tags).toContain("Web Workers");

      const cardiac = FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === "cardiac-risk-modeling"
      );
      expect(cardiac?.tags).toContain("Python");
      expect(cardiac?.tags).toContain("LightGBM");
      expect(cardiac?.tags).toContain("Adversarial Validation");

      const fourGlory = FALLBACK_CASE_STUDIES.find((s) => s.slug === "4glory");
      expect(fourGlory?.tags).toContain("TypeScript");
      expect(fourGlory?.tags).toContain("Sports Analytics");
      expect(fourGlory?.tags).toContain("Monte Carlo");

      const crfXl = FALLBACK_CASE_STUDIES.find((s) => s.slug === "crf-xl");
      expect(crfXl?.tags).toContain("TypeScript");
      expect(crfXl?.tags).toContain("CDISC");
      expect(crfXl?.tags).toContain("ODM-XML");

      const promptOps = FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === "promptops"
      );
      expect(promptOps?.tags).toContain("TypeScript");
      expect(promptOps?.tags).toContain("LLM");
      expect(promptOps?.tags).toContain("Semantic Versioning");
    });
  });

  describe("3. Interactive CLI Sandbox JSON Schema & Commands", () => {
    it.each(NEW_CASE_STUDY_SLUGS)(
      "validates commands_json and playback_json schemas for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();
        expect(study?.commands_json).toBeDefined();
        expect(study?.playback_json).toBeDefined();

        // 1. Verify commands_json
        const commands = JSON.parse(study!.commands_json!);
        expect(typeof commands).toBe("object");
        const commandEntries = Object.entries(commands);
        expect(commandEntries.length).toBeGreaterThanOrEqual(3);

        for (const [cmdKey, cmdData] of commandEntries) {
          expect(typeof cmdKey).toBe("string");
          expect(cmdKey.length).toBeGreaterThan(3);
          const entry = cmdData as { description: string; payload: unknown };
          expect(typeof entry.description).toBe("string");
          expect(entry.description.length).toBeGreaterThan(5);
          expect(entry.payload).toBeDefined();
        }

        // 2. Verify playback_json
        const playback = JSON.parse(study!.playback_json!);
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(3);

        for (const step of playback) {
          expect(typeof step.command).toBe("string");
          expect(typeof step.description).toBe("string");
          expect(step.command.length).toBeGreaterThan(3);
          expect(step.description.length).toBeGreaterThan(5);
        }
      }
    );
  });

  describe("4. Dynamic Route Metadata Generation", () => {
    it.each(NEW_CASE_STUDY_SLUGS)(
      "generates valid Next.js metadata and OpenGraph payloads for '%s'",
      async (slug) => {
        const meta = await generateMetadata({
          params: Promise.resolve({ slug }),
        });

        expect(meta.title).toBeDefined();
        expect(typeof meta.title).toBe("string");
        expect((meta.title as string).length).toBeGreaterThan(5);
        expect(meta.description).toBeDefined();
        expect(typeof meta.description).toBe("string");

        // Verify OpenGraph configuration
        expect((meta.openGraph as { type?: string })?.type).toBe("article");
        expect(meta.alternates?.canonical).toBe(`/case-studies/${slug}`);

        // Verify markdown delimiters were stripped from description
        expect(meta.description).not.toContain("**");
        expect(meta.description).not.toContain("`");
      }
    );
  });

  describe("5. Static Generation & Discovery Matrix Synchronization", () => {
    it("generateStaticParams returns all 5 new case study slugs", async () => {
      const params = await generateStaticParams();
      const slugs = params.map((p) => p.slug);

      for (const expectedSlug of NEW_CASE_STUDY_SLUGS) {
        expect(slugs).toContain(expectedSlug);
      }
    });

    it("registers all 5 new case studies in CANONICAL_ROUTES for page benchmarks", () => {
      for (const slug of NEW_CASE_STUDY_SLUGS) {
        const route = CANONICAL_ROUTES.find(
          (r) => r.path === `/case-studies/${slug}`
        );
        expect(route).toBeDefined();
        expect(route?.category).toBe("case-study");
      }
    });

    it("registers SEO metadata configurations in ROUTE_METADATA_CONFIGS", () => {
      const configKeys = [
        "duckDeploy",
        "cardiacRiskModeling",
        "fourGlory",
        "crfXl",
        "promptOps",
      ] as const;
      for (const key of configKeys) {
        const config = ROUTE_METADATA_CONFIGS[key];
        expect(config).toBeDefined();
        expect(config.path).toMatch(/^\/case-studies\//);
        expect(config.title.length).toBeGreaterThan(10);
        expect(config.description.length).toBeGreaterThan(20);
        expect(config.ogType).toBe("article");
        expect(config.keywords?.length).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe("6. Security & Credential Leak Scanning", () => {
    it.each(NEW_CASE_STUDY_SLUGS)(
      "passes security validation scanner with zero violations for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const editorialLeaks = scanText(study!.editorial_content);
        const narrativeLeaks = scanText(study!.architectural_narrative);

        expect(editorialLeaks).toEqual([]);
        expect(narrativeLeaks).toEqual([]);
      }
    );
  });
});
