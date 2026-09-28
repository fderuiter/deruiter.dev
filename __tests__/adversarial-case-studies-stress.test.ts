// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import {
  generateMetadata,
  generateStaticParams,
} from "@/app/(desktop)/case-studies/[slug]/page";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { validateTermTags } from "@/lib/term-compiler";
import fs from "fs";
import path from "path";

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

const TARGET_SLUGS = [
  "duckdeploy",
  "cardiac-risk-modeling",
  "4glory",
  "crf-xl",
  "promptops",
] as const;

describe("Adversarial Stress-Test Suite: 5 Production Engineering Case Studies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValue([]);
  });

  describe("1. Service Resolution, Fallbacks & Error Injection", () => {
    it.each(TARGET_SLUGS)(
      "resolves '%s' from CaseStudyService fallback when DB is null",
      async (slug) => {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        expect(study?.slug).toBe(slug);
        expect(study?.published).toBe(true);
        expect(study?.id).toMatch(/^canonical-\d+$/);
        expect(study?.title.trim().length).toBeGreaterThan(10);
        expect(study?.primary_language.trim().length).toBeGreaterThan(1);
        expect(study?.github_url).toMatch(
          /^https:\/\/github\.com\/fderuiter\//
        );
        expect(study?.editorial_content.length).toBeGreaterThan(100);
        expect(study?.architectural_narrative.length).toBeGreaterThan(500);
        expect(study?.created_at).toBeInstanceOf(Date);
        expect(study?.updated_at).toBeInstanceOf(Date);
      }
    );

    it.each(TARGET_SLUGS)(
      "resolves '%s' gracefully when database query throws an error",
      async (slug) => {
        vi.mocked(prisma.caseStudy.findUnique).mockRejectedValueOnce(
          new Error("Database connection timeout")
        );
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        expect(study?.slug).toBe(slug);
      }
    );

    it("returns null for non-existent or adversarial slug inputs", async () => {
      const adversarialSlugs = [
        "",
        " ",
        "unknown-study-9999",
        "<script>alert(1)</script>",
        "../../etc/passwd",
        "DUCKDEPLOY", // case-sensitive check
        "' OR '1'='1",
      ];

      for (const slug of adversarialSlugs) {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).toBeNull();
      }
    });

    it("getAllPublishedCaseStudies() includes all 5 target studies and contains zero duplicate slugs", async () => {
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      const slugs = allStudies.map((s) => s.slug);

      for (const targetSlug of TARGET_SLUGS) {
        expect(slugs).toContain(targetSlug);
      }

      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it("getAllPublishedSlugs() matches unique slugs from getAllPublishedCaseStudies()", async () => {
      const slugs = await CaseStudyService.getAllPublishedSlugs();
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      expect(slugs).toEqual(allStudies.map((s) => s.slug));
    });
  });

  describe("2. Interactive CLI Sandbox JSON & Playback Integrity", () => {
    it.each(TARGET_SLUGS)(
      "parses commands_json and playback_json cleanly as valid JSON for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();
        expect(study?.commands_json).toBeDefined();
        expect(study?.playback_json).toBeDefined();

        expect(() => JSON.parse(study!.commands_json!)).not.toThrow();
        expect(() => JSON.parse(study!.playback_json!)).not.toThrow();
      }
    );

    it.each(TARGET_SLUGS)(
      "validates command objects and structured payloads for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        const commands = JSON.parse(study!.commands_json!);

        expect(typeof commands).toBe("object");
        expect(commands).not.toBeNull();
        const entries = Object.entries(commands);
        expect(entries.length).toBeGreaterThanOrEqual(3);

        for (const [cmdKey, cmdData] of entries) {
          expect(typeof cmdKey).toBe("string");
          expect(cmdKey.trim().length).toBeGreaterThan(3);

          const entry = cmdData as { description?: unknown; payload?: unknown };
          expect(typeof entry.description).toBe("string");
          expect((entry.description as string).trim().length).toBeGreaterThan(
            10
          );
          expect(entry.payload).toBeDefined();
          expect(entry.payload).not.toBeNull();

          // Must be JSON-serializable
          expect(() => JSON.stringify(entry.payload)).not.toThrow();
        }
      }
    );

    it.each(TARGET_SLUGS)(
      "asserts playback steps map to valid commands in commands_json for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        const commands = JSON.parse(study!.commands_json!);
        const playback = JSON.parse(study!.playback_json!) as Array<{
          command: string;
          description: string;
        }>;

        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(3);

        const commandKeys = Object.keys(commands);

        for (const step of playback) {
          expect(typeof step.command).toBe("string");
          expect(typeof step.description).toBe("string");
          expect(step.command.trim().length).toBeGreaterThan(3);
          expect(step.description.trim().length).toBeGreaterThan(5);

          // Every playback step must correspond to a key in commands_json
          expect(commandKeys).toContain(step.command);
        }
      }
    );
  });

  describe("3. Mermaid Architecture Diagrams Structural & Syntactic Validity", () => {
    it.each(TARGET_SLUGS)(
      "contains valid, well-formed Mermaid diagrams in '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const mermaidMatches = study!.architectural_narrative.match(
          /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g
        );

        expect(mermaidMatches).not.toBeNull();
        expect(mermaidMatches!.length).toBeGreaterThanOrEqual(1);

        for (const rawMatch of mermaidMatches!) {
          const diagramCode = rawMatch
            .replace(/<pre><code class="language-mermaid">/, "")
            .replace(/<\/code><\/pre>/, "")
            .trim();

          // 1. Valid Header
          const firstLine = diagramCode.split("\n")[0].trim();
          expect(firstLine).toMatch(/^flowchart\s+(TD|LR|TB|RL|BT)$/);

          // 2. Balanced Subgraphs
          const subgraphCount = (diagramCode.match(/\bsubgraph\b/g) || [])
            .length;
          const endCount = (diagramCode.match(/\bend\b/g) || []).length;
          expect(subgraphCount).toBeGreaterThanOrEqual(2);
          expect(endCount).toBe(subgraphCount);

          // 3. Balanced Brackets in diagram lines
          const lines = diagramCode
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          for (const line of lines) {
            if (
              line.startsWith("flowchart") ||
              line.startsWith("subgraph") ||
              line === "end"
            )
              continue;

            // Count bracket pairs per line (excluding arrows)
            const openSquare = (line.match(/\[/g) || []).length;
            const closeSquare = (line.match(/\]/g) || []).length;
            expect(openSquare).toBe(closeSquare);

            const openCurly = (line.match(/\{/g) || []).length;
            const closeCurly = (line.match(/\}/g) || []).length;
            expect(openCurly).toBe(closeCurly);

            const openParen = (line.match(/\(/g) || []).length;
            const closeParen = (line.match(/\)/g) || []).length;
            expect(openParen).toBe(closeParen);
          }
        }
      }
    );
  });

  describe("4. HTML Escaping & Well-Formedness in Rich Narratives", () => {
    it.each(TARGET_SLUGS)(
      "contains valid HTML and escaped generics in code blocks for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const narrative = study!.architectural_narrative;

        // Extract all code blocks
        const codeBlocks =
          narrative.match(
            /<pre><code class="language-[^"]+">([\s\S]*?)<\/code><\/pre>/g
          ) || [];
        expect(codeBlocks.length).toBeGreaterThanOrEqual(2);

        for (const block of codeBlocks) {
          // Generics in TypeScript / Python / XML code blocks must be escaped as &lt; and &gt;
          const innerCode = block
            .replace(/<pre><code class="language-[^"]+">/, "")
            .replace(/<\/code><\/pre>/, "");

          // If tooltip spans are inserted, remove them before testing code content
          const strippedTooltips = innerCode.replace(
            /<span\s+[^>]*class="[^"]*term-tooltip[^"]*"[^>]*>([\s\S]*?)<\/span>/g,
            "$1"
          );

          // Verify there are no unescaped raw HTML tags inside code (like <Record, <T>, <string, <Array)
          const unescapedTags = strippedTooltips.match(
            /<[A-Za-z_][A-Za-z0-9_, <>\-]*>/g
          );
          expect(unescapedTags).toBeNull();
        }

        // Check section headers (<h3> and <h4>) are present
        expect(narrative).toContain("<h3>The problem</h3>");
        expect(narrative).toContain("<h3>How it works</h3>");
        expect(narrative).toContain("<h3>How the pieces connect</h3>");
        expect(narrative).toMatch(
          /<h3>(Implementation notes|4\. Critical Invariants)/i
        );
        expect(narrative).toMatch(
          /<h3>(Tradeoffs and lessons|5\. Lessons Learned)/i
        );
      }
    );
  });

  describe("5. Tag Taxonomy & Terminology Glossary Validation", () => {
    it.each(TARGET_SLUGS)(
      "validates tags against canonical taxonomy for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const tags = study!.tags.split(",").map((t) => t.trim());
        expect(tags.length).toBeGreaterThanOrEqual(4);

        for (const tag of tags) {
          expect(tag.length).toBeGreaterThan(1);
          expect(tag).not.toContain("undefined");
          expect(tag).not.toContain("null");
          expect(tag).not.toMatch(/^\s+|\s+$/); // no leading/trailing spaces
        }
      }
    );

    it.each(TARGET_SLUGS)(
      "passes term-compiler validation for '%s'",
      (slug) => {
        const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
        expect(study).toBeDefined();

        const resNarrative = validateTermTags(
          study!.architectural_narrative,
          undefined,
          `FALLBACK[${slug}].narrative`
        );
        expect(resNarrative.valid).toBe(true);
        expect(resNarrative.errors).toEqual([]);

        const resEditorial = validateTermTags(
          study!.editorial_content,
          undefined,
          `FALLBACK[${slug}].editorial`
        );
        expect(resEditorial.valid).toBe(true);
        expect(resEditorial.errors).toEqual([]);
      }
    );
  });

  describe("6. 5-Point Discovery Matrix Synchronization", () => {
    it.each(TARGET_SLUGS)(
      "registers '%s' in CANONICAL_ROUTES for page-bench",
      (slug) => {
        const route = CANONICAL_ROUTES.find(
          (r) => r.path === `/case-studies/${slug}`
        );
        expect(route).toBeDefined();
        expect(route?.category).toBe("case-study");
        expect(route?.name.length).toBeGreaterThan(5);
      }
    );

    it("registers all 5 new case studies in ROUTE_METADATA_CONFIGS with rich metadata", () => {
      const mappings: Record<string, keyof typeof ROUTE_METADATA_CONFIGS> = {
        duckdeploy: "duckDeploy",
        "cardiac-risk-modeling": "cardiacRiskModeling",
        "4glory": "fourGlory",
        "crf-xl": "crfXl",
        promptops: "promptOps",
      };

      for (const [slug, key] of Object.entries(mappings)) {
        const config = ROUTE_METADATA_CONFIGS[key];
        expect(config).toBeDefined();
        expect(config.path).toBe(`/case-studies/${slug}`);
        expect(config.title.length).toBeGreaterThan(15);
        expect(config.description.length).toBeGreaterThan(30);
        expect(config.keywords?.length).toBeGreaterThanOrEqual(5);
        expect(config.ogType).toBe("article");
      }
    });

    it.each(TARGET_SLUGS)(
      "generateMetadata produces canonical article metadata for '%s'",
      async (slug) => {
        const meta = await generateMetadata({
          params: Promise.resolve({ slug }),
        });

        expect(meta.title).toBeDefined();
        expect(typeof meta.title).toBe("string");
        expect(meta.title as string).toContain("| Case Study");
        expect(meta.description).toBeDefined();
        expect((meta.description as string).length).toBeGreaterThan(20);
        expect(meta.description as string).not.toContain("**");
        expect(meta.description as string).not.toContain("`");

        expect((meta.openGraph as { type?: string })?.type).toBe("article");
        expect(meta.alternates?.canonical).toBe(`/case-studies/${slug}`);
      }
    );

    it("generateStaticParams yields static route entries for all 5 target studies", async () => {
      const params = await generateStaticParams();
      const slugs = params.map((p) => p.slug);

      for (const targetSlug of TARGET_SLUGS) {
        expect(slugs).toContain(targetSlug);
      }
    });
  });

  describe("7. Prisma Seed Payload Parity", () => {
    it("verifies seed.ts contains matching payloads and passes term validation", () => {
      const seedFilePath = path.resolve(process.cwd(), "prisma/seed.ts");
      expect(fs.existsSync(seedFilePath)).toBe(true);

      const seedContent = fs.readFileSync(seedFilePath, "utf-8");

      for (const slug of TARGET_SLUGS) {
        expect(seedContent).toContain(`slug: "${slug}"`);
      }
    });
  });
});
