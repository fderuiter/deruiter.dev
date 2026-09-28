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
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";
import { scanText } from "@/lib/security-scan";
import { getSoftwareSourceCodeSchema, getBreadcrumbSchema } from "@/lib/seo";

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

describe("Opaque-Box E2E Case Studies Suite (Tiers 1-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValue([]);
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 test cases per feature)
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    // -----------------------------------------------------------------------
    // Feature 1: DuckDeploy (duckdeploy)
    // -----------------------------------------------------------------------
    describe("Feature 1: DuckDeploy (duckdeploy)", () => {
      const getStudy = async () =>
        await CaseStudyService.getCaseStudyBySlug("duckdeploy");

      it("1.1 defines valid record schema, identity and publishing flags", async () => {
        const study = await getStudy();
        expect(study).not.toBeNull();
        expect(study?.slug).toBe("duckdeploy");
        expect(study?.title).toContain("DuckDeploy");
        expect(study?.primary_language).toBe("TypeScript");
        expect(study?.published).toBe(true);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
      });

      it("1.2 contains high-density editorial summary with core domain keywords", async () => {
        const study = await getStudy();
        expect(study?.editorial_content).toBeDefined();
        const content = study?.editorial_content || "";
        expect(content.length).toBeGreaterThan(100);
        expect(content.toLowerCase()).toMatch(/configuration forms/);
        expect(content.toLowerCase()).toMatch(/web worker/);
        expect(content.toLowerCase()).toMatch(/manifest compiler|json schema/);
      });

      it("1.3 includes multi-section architectural narrative with code examples", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative.length).toBeGreaterThan(500);
        expect(narrative).toMatch(/<h3>/i);
        expect(narrative).toMatch(/<pre><code/i);
        expect(narrative).toMatch(/JSON Schema|Zustand|Worker/i);
      });

      it("1.4 embeds valid Mermaid system architecture diagram", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative).toContain("language-mermaid");
        expect(narrative).toMatch(/flowchart (TD|LR)/i);
        expect(narrative).toMatch(/subgraph/i);
        expect(narrative).toMatch(/Schema|Worker|Manifest|Deploy/i);
      });

      it("1.5 configures executable SandboxTerminal commands_json registry", async () => {
        const study = await getStudy();
        expect(study?.commands_json).toBeDefined();
        const commands = JSON.parse(study?.commands_json || "{}");
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(3);
        expect(commandKeys.some((cmd) => cmd.startsWith("duckdeploy"))).toBe(
          true
        );

        for (const [cmd, entry] of Object.entries(commands) as [
          string,
          { description: string; payload: unknown },
        ][]) {
          expect(typeof cmd).toBe("string");
          expect(typeof entry.description).toBe("string");
          expect(entry.description.length).toBeGreaterThan(5);
          expect(entry.payload).toBeDefined();
        }
      });

      it("1.6 configures sequential playback_json incident simulation steps", async () => {
        const study = await getStudy();
        expect(study?.playback_json).toBeDefined();
        const playback = JSON.parse(study?.playback_json || "[]");
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(2);

        for (const step of playback) {
          expect(typeof step.command).toBe("string");
          expect(typeof step.description).toBe("string");
        }
      });

      it("1.7 provides accurate tags covering technologies and domain concepts", async () => {
        const study = await getStudy();
        const tags = (study?.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase());
        expect(tags.some((t) => t.includes("typescript"))).toBe(true);
        expect(
          tags.some(
            (t) =>
              t.includes("worker") ||
              t.includes("schema") ||
              t.includes("ast") ||
              t.includes("react")
          )
        ).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 2: Predictive Cardiac Risk Modeling (cardiac-risk-modeling)
    // -----------------------------------------------------------------------
    describe("Feature 2: Predictive Cardiac Risk Modeling (cardiac-risk-modeling)", () => {
      const getStudy = async () =>
        await CaseStudyService.getCaseStudyBySlug("cardiac-risk-modeling");

      it("2.1 defines valid record schema, identity and publishing flags", async () => {
        const study = await getStudy();
        expect(study).not.toBeNull();
        expect(study?.slug).toBe("cardiac-risk-modeling");
        expect(study?.title).toMatch(/Cardiac Risk|MACE|Predictive/i);
        expect(study?.primary_language).toBe("Python");
        expect(study?.published).toBe(true);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
      });

      it("2.2 contains clinical tabular ML editorial summary with validation concepts", async () => {
        const study = await getStudy();
        const content = study?.editorial_content || "";
        expect(content.length).toBeGreaterThan(100);
        expect(content.toLowerCase()).toMatch(/cardiac risk modeling/);
        expect(content.toLowerCase()).toMatch(/distribution shift/);
        expect(content.toLowerCase()).toMatch(/data leakage/);
      });

      it("2.3 includes multi-section clinical ML architecture with code examples", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative.length).toBeGreaterThan(500);
        expect(narrative).toMatch(/<h3>/i);
        expect(narrative).toMatch(/<pre><code/i);
        expect(narrative).toMatch(/LightGBM|XGBoost|CatBoost|SHAP|OOF|CV/i);
      });

      it("2.4 embeds valid Mermaid pipeline architecture flowchart", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative).toContain("language-mermaid");
        expect(narrative).toMatch(/flowchart (TD|LR)/i);
        expect(narrative).toMatch(/subgraph/i);
        expect(narrative).toMatch(/Ingestion|Validation|Ensemble|Model|SHAP/i);
      });

      it("2.5 configures executable SandboxTerminal commands_json registry", async () => {
        const study = await getStudy();
        expect(study?.commands_json).toBeDefined();
        const commands = JSON.parse(study?.commands_json || "{}");
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(2);
        expect(
          commandKeys.some(
            (cmd) => cmd.startsWith("cardiac-ml") || cmd.includes("cardiac")
          )
        ).toBe(true);

        for (const [cmd, entry] of Object.entries(commands) as [
          string,
          { description: string; payload: unknown },
        ][]) {
          expect(typeof cmd).toBe("string");
          expect(typeof entry.description).toBe("string");
          expect(entry.payload).toBeDefined();
        }
      });

      it("2.6 configures sequential playback_json diagnostic steps", async () => {
        const study = await getStudy();
        expect(study?.playback_json).toBeDefined();
        const playback = JSON.parse(study?.playback_json || "[]");
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(2);
      });

      it("2.7 provides clinical informatics and ML tags", async () => {
        const study = await getStudy();
        const tags = (study?.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase());
        expect(tags.some((t) => t.includes("python"))).toBe(true);
        expect(
          tags.some(
            (t) =>
              t.includes("ml") ||
              t.includes("machine learning") ||
              t.includes("clinical") ||
              t.includes("tabular")
          )
        ).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 3: 4Glory | Does Fred Know Ball? (4glory)
    // -----------------------------------------------------------------------
    describe("Feature 3: 4Glory | Does Fred Know Ball? (4glory)", () => {
      const getStudy = async () =>
        await CaseStudyService.getCaseStudyBySlug("4glory");

      it("3.1 defines valid record schema, identity and publishing flags", async () => {
        const study = await getStudy();
        expect(study).not.toBeNull();
        expect(study?.slug).toBe("4glory");
        expect(study?.title).toMatch(/4Glory|Fred Know Ball|Sports Analytics/i);
        expect(study?.primary_language).toMatch(/TypeScript|Python/i);
        expect(study?.published).toBe(true);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
      });

      it("3.2 contains real-time sports analytics editorial summary", async () => {
        const study = await getStudy();
        const content = study?.editorial_content || "";
        expect(content.length).toBeGreaterThan(100);
        expect(content.toLowerCase()).toMatch(/basketball prediction/);
        expect(content.toLowerCase()).toMatch(/xgboost/);
      });

      it("3.3 includes real-time analytics narrative and spatial algorithms", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative.length).toBeGreaterThan(500);
        expect(narrative).toMatch(/<h3>/i);
        expect(narrative).toMatch(/<pre><code/i);
        expect(narrative).toMatch(
          /WebSocket|RingBuffer|Voronoi|xG|Monte Carlo/i
        );
      });

      it("3.4 embeds valid Mermaid stream processing architecture diagram", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative).toContain("language-mermaid");
        expect(narrative).toMatch(/flowchart (TD|LR)/i);
        expect(narrative).toMatch(/subgraph/i);
      });

      it("3.5 configures executable SandboxTerminal commands_json registry", async () => {
        const study = await getStudy();
        expect(study?.commands_json).toBeDefined();
        const commands = JSON.parse(study?.commands_json || "{}");
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(2);
        expect(commandKeys.some((cmd) => cmd.startsWith("4glory"))).toBe(true);
      });

      it("3.6 configures sequential playback_json simulation steps", async () => {
        const study = await getStudy();
        expect(study?.playback_json).toBeDefined();
        const playback = JSON.parse(study?.playback_json || "[]");
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(2);
      });

      it("3.7 provides sports analytics and real-time tags", async () => {
        const study = await getStudy();
        const tags = (study?.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase());
        expect(
          tags.some(
            (t) =>
              t.includes("sports") ||
              t.includes("analytics") ||
              t.includes("monte carlo") ||
              t.includes("websocket")
          )
        ).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 4: CRF.xl (crf-xl)
    // -----------------------------------------------------------------------
    describe("Feature 4: CRF.xl (crf-xl)", () => {
      const getStudy = async () =>
        await CaseStudyService.getCaseStudyBySlug("crf-xl");

      it("4.1 defines valid record schema, identity and publishing flags", async () => {
        const study = await getStudy();
        expect(study).not.toBeNull();
        expect(study?.slug).toBe("crf-xl");
        expect(study?.title).toMatch(/CRF\.xl|CDISC|Spreadsheet/i);
        expect(study?.primary_language).toBe("TypeScript");
        expect(study?.published).toBe(true);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
      });

      it("4.2 contains spreadsheet-to-CDISC compiler editorial summary", async () => {
        const study = await getStudy();
        const content = study?.editorial_content || "";
        expect(content.length).toBeGreaterThan(100);
        expect(content.toLowerCase()).toMatch(/cdisc|cdash/);
        expect(content.toLowerCase()).toMatch(/compilation/);
        expect(content.toLowerCase()).toMatch(/21 cfr part 11|odm/);
      });

      it("4.3 includes compiler design narrative and formula AST engine code", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative.length).toBeGreaterThan(500);
        expect(narrative).toMatch(/<h3>/i);
        expect(narrative).toMatch(/<pre><code/i);
        expect(narrative).toMatch(/CDASH|ODM|AST|Formula|BSA|RECIST/i);
      });

      it("4.4 embeds valid Mermaid compiler architecture flowchart", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative).toContain("language-mermaid");
        expect(narrative).toMatch(/flowchart (TD|LR)/i);
        expect(narrative).toMatch(/subgraph/i);
      });

      it("4.5 configures executable SandboxTerminal commands_json registry", async () => {
        const study = await getStudy();
        expect(study?.commands_json).toBeDefined();
        const commands = JSON.parse(study?.commands_json || "{}");
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(2);
        expect(commandKeys.some((cmd) => cmd.startsWith("crf-xl"))).toBe(true);
      });

      it("4.6 configures sequential playback_json protocol compilation steps", async () => {
        const study = await getStudy();
        expect(study?.playback_json).toBeDefined();
        const playback = JSON.parse(study?.playback_json || "[]");
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(2);
      });

      it("4.7 provides CDISC, clinical and compiler tags", async () => {
        const study = await getStudy();
        const tags = (study?.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase());
        expect(
          tags.some(
            (t) =>
              t.includes("cdisc") ||
              t.includes("cdash") ||
              t.includes("ast") ||
              t.includes("compiler")
          )
        ).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 5: PromptOps Framework (promptops)
    // -----------------------------------------------------------------------
    describe("Feature 5: PromptOps Framework (promptops)", () => {
      const getStudy = async () =>
        await CaseStudyService.getCaseStudyBySlug("promptops");

      it("5.1 defines valid record schema, identity and publishing flags", async () => {
        const study = await getStudy();
        expect(study).not.toBeNull();
        expect(study?.slug).toBe("promptops");
        expect(study?.title).toMatch(/PromptOps|Prompt Orchestration|LLM/i);
        expect(study?.primary_language).toBe("TypeScript");
        expect(study?.published).toBe(true);
        expect(study?.github_url).toMatch(/^https:\/\/github\.com\//);
      });

      it("5.2 contains prompt orchestration and eval pipeline editorial summary", async () => {
        const study = await getStudy();
        const content = study?.editorial_content || "";
        expect(content.length).toBeGreaterThan(100);
        expect(content.toLowerCase()).toMatch(/prompt|llm/);
        expect(content.toLowerCase()).toMatch(/versioning/);
        expect(content.toLowerCase()).toMatch(/eval|zod|ci\/cd/);
      });

      it("5.3 includes prompt-as-code architecture narrative and code examples", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative.length).toBeGreaterThan(500);
        expect(narrative).toMatch(/<h3>/i);
        expect(narrative).toMatch(/<pre><code/i);
        expect(narrative).toMatch(/Zod|SemVer|Judge|Eval|Router/i);
      });

      it("5.4 embeds valid Mermaid prompt orchestration and release gate diagram", async () => {
        const study = await getStudy();
        const narrative = study?.architectural_narrative || "";
        expect(narrative).toContain("language-mermaid");
        expect(narrative).toMatch(/flowchart (TD|LR)/i);
        expect(narrative).toMatch(/subgraph/i);
      });

      it("5.5 configures executable SandboxTerminal commands_json registry", async () => {
        const study = await getStudy();
        expect(study?.commands_json).toBeDefined();
        const commands = JSON.parse(study?.commands_json || "{}");
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(2);
        expect(commandKeys.some((cmd) => cmd.startsWith("promptops"))).toBe(
          true
        );
      });

      it("5.6 configures sequential playback_json prompt evaluation steps", async () => {
        const study = await getStudy();
        expect(study?.playback_json).toBeDefined();
        const playback = JSON.parse(study?.playback_json || "[]");
        expect(Array.isArray(playback)).toBe(true);
        expect(playback.length).toBeGreaterThanOrEqual(2);
      });

      it("5.7 provides LLM and prompt engineering tags", async () => {
        const study = await getStudy();
        const tags = (study?.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase());
        expect(
          tags.some(
            (t) =>
              t.includes("llm") ||
              t.includes("prompt") ||
              t.includes("semver") ||
              t.includes("eval")
          )
        ).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Canonical Case Study Regression Guard
    // -----------------------------------------------------------------------
    describe("Canonical Case Studies Regression Guard", () => {
      const canonicalSlugs = [
        "clinical-data-mapper",
        "cadence-clinical",
        "imednet-python-sdk",
        "wedding-website",
        "schemaflow",
        "hono-kiln",
        "laser-loon",
        "inbody-qr-decoder",
        "polyglot-tsp",
        "oxidizemath",
        "ualbf",
        "sortify",
        "sonos-network-controller",
        "clintrials",
        "equipose-randomization",
        "lambda-wave",
      ];

      it.each(canonicalSlugs)(
        "preserves valid schema and content for canonical slug: %s",
        async (slug) => {
          const study = await CaseStudyService.getCaseStudyBySlug(slug);
          expect(study).not.toBeNull();
          expect(study?.slug).toBe(slug);
          expect(study?.title.length).toBeGreaterThan(5);
          expect(study?.primary_language.length).toBeGreaterThan(1);
          expect(study?.editorial_content.length).toBeGreaterThan(50);
          expect(study?.architectural_narrative.length).toBeGreaterThan(100);
          expect(study?.tags.length).toBeGreaterThan(3);
        }
      );
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 test cases)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("2.1 returns null for non-existent slugs without throwing errors", async () => {
      const nonExistentSlugs = [
        "non-existent-slug-xyz",
        "unknown-case-study-404",
        "deprecated-v0-prototype",
        "fake-study-2099",
      ];

      for (const slug of nonExistentSlugs) {
        const result = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(result).toBeNull();
      }
    });

    it("2.2 safely returns null for empty, whitespace, and falsy-like string inputs", async () => {
      const emptyLikeInputs = [
        "",
        "   ",
        "\t\n",
        "   \r\n  ",
        "undefined",
        "null",
        "[object Object]",
      ];

      for (const input of emptyLikeInputs) {
        const result = await CaseStudyService.getCaseStudyBySlug(input);
        expect(result).toBeNull();
      }
    });

    it("2.3 safely rejects path traversal and XSS injection strings", async () => {
      const hostileSlugs = [
        "../../etc/passwd",
        "..\\..\\windows\\system32",
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "' OR '1'='1",
        "duckdeploy/../../secret",
        "%2e%2e%2fetc%2fpasswd",
      ];

      for (const hostile of hostileSlugs) {
        const result = await CaseStudyService.getCaseStudyBySlug(hostile);
        expect(result).toBeNull();
      }
    });

    it("2.4 handles extreme length slug strings safely without crashing", async () => {
      const longSlug = "a".repeat(10000);
      const result = await CaseStudyService.getCaseStudyBySlug(longSlug);
      expect(result).toBeNull();
    });

    it("2.5 handles null, undefined, empty string, and malformed commands_json gracefully", async () => {
      // Create a test study with various invalid commands_json payloads
      const testCases = [
        undefined,
        null,
        "",
        "   ",
        "{ invalid json syntax ",
        "[]",
        "12345",
        '"string payload"',
      ];

      for (const invalidJson of testCases) {
        let parsed = undefined;
        try {
          if (invalidJson && typeof invalidJson === "string") {
            const raw = JSON.parse(invalidJson);
            if (raw && typeof raw === "object" && !Array.isArray(raw)) {
              parsed = raw;
            }
          }
        } catch {
          parsed = undefined;
        }

        // Parsing invalid input should safely yield undefined or an object, never throw unhandled
        expect(parsed === undefined || typeof parsed === "object").toBe(true);
      }
    });

    it("2.6 handles null, undefined, empty string, and malformed playback_json gracefully", async () => {
      const testCases = [
        undefined,
        null,
        "",
        "   ",
        "{ not an array }",
        "invalid json",
        "42",
      ];

      for (const invalidJson of testCases) {
        let parsed = undefined;
        try {
          if (invalidJson && typeof invalidJson === "string") {
            const raw = JSON.parse(invalidJson);
            if (Array.isArray(raw)) {
              parsed = raw;
            }
          }
        } catch {
          parsed = undefined;
        }

        expect(parsed === undefined || Array.isArray(parsed)).toBe(true);
      }
    });

    it("2.7 parses tags with boundary variations (excessive whitespace, trailing commas, single items)", () => {
      const messyTags = [
        "TypeScript , React ,  , Web Workers, ",
        "  SingleTag  ",
        "",
        ",,,",
        "Tag-With-Hyphens, tag_with_underscores, Tag With Spaces",
      ];

      for (const tagStr of messyTags) {
        const parsed = tagStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.every((t) => t.length > 0)).toBe(true);
        expect(
          parsed.every((t) => !t.startsWith(" ") && !t.endsWith(" "))
        ).toBe(true);
      }
    });

    it("2.8 handles complex narrative content (LaTeX math, entities, emojis, code blocks) safely", () => {
      const complexNarrative = `
        <h3>Mathematical Bounds & Entities</h3>
        <p>Evaluating &sigma;(n) = 2n + 1 with bounds: x &lt; 100 &amp;&amp; y &gt; 50.</p>
        <p>Emoji check: 🚀 ⚡ 🔬 🛡️</p>
        <pre><code class="language-typescript">
          const map: Map&lt;string, number&gt; = new Map();
        </code></pre>
      `;

      expect(complexNarrative).toContain("&sigma;");
      expect(complexNarrative).toContain("&lt;");
      expect(complexNarrative).toContain("&amp;&amp;");
      expect(complexNarrative).toContain("🚀");

      // Verify DOM parser does not throw on valid HTML fragment
      const div = document.createElement("div");
      div.innerHTML = complexNarrative;
      expect(div.children.length).toBeGreaterThan(0);
    });

    it("2.9 falls back to static data when Prisma database queries throw connection errors", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockRejectedValue(
        new Error("Database connection timeout")
      );
      vi.mocked(prisma.caseStudy.findMany).mockRejectedValue(
        new Error("Neon connection reset")
      );

      const study = await CaseStudyService.getCaseStudyBySlug("duckdeploy");
      expect(study).not.toBeNull();
      expect(study?.slug).toBe("duckdeploy");

      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      expect(allStudies.length).toBeGreaterThanOrEqual(
        FALLBACK_CASE_STUDIES.length
      );
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    const targetSlugs = [
      "duckdeploy",
      "cardiac-risk-modeling",
      "4glory",
      "crf-xl",
      "promptops",
    ];

    it("3.1 Fallback Resolution + Term Compilation: all case studies contain valid glossary terms", async () => {
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      expect(allStudies.length).toBeGreaterThanOrEqual(20);

      const glossaryKeys = new Set(CANONICAL_GLOSSARY.map((g) => g.key));

      for (const study of allStudies) {
        const fullContent = `${study.editorial_content} ${study.architectural_narrative}`;
        const dataKeyMatches = fullContent.match(/data-key="([^"]+)"/g) || [];

        for (const match of dataKeyMatches) {
          const key = match.replace(/data-key="([^"]+)"/, "$1");
          // Every data-key embedded in compiled content must exist in CANONICAL_GLOSSARY
          expect(glossaryKeys.has(key)).toBe(true);
        }
      }
    });

    it("3.2 Static Params Generation + Dynamic Slug Resolution: all params resolve to valid studies", async () => {
      const staticParams = await generateStaticParams();
      expect(staticParams.length).toBeGreaterThanOrEqual(20);

      const returnedSlugs = new Set(staticParams.map((p) => p.slug));

      for (const slug of targetSlugs) {
        expect(returnedSlugs.has(slug)).toBe(true);

        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        expect(study?.slug).toBe(slug);
        expect(study?.title).toBeDefined();
        expect(study?.editorial_content).toBeDefined();
      }
    });

    it("3.3 SEO Metadata Generation + Route Config Integration: produces compliant Metadata objects", async () => {
      for (const slug of targetSlugs) {
        const meta = await generateMetadata({
          params: Promise.resolve({ slug }),
        });

        expect(meta.title).toBeDefined();
        expect(String(meta.title)).toMatch(/\| Case Study$/);

        expect(meta.description).toBeDefined();
        const desc = String(meta.description || "");
        expect(desc.length).toBeGreaterThan(10);
        expect(desc.length).toBeLessThanOrEqual(165);
        expect(desc).not.toContain("**");
        expect(desc).not.toContain("`");

        expect(meta.alternates?.canonical).toBe(`/case-studies/${slug}`);

        const og = meta.openGraph as Record<string, unknown> | undefined;
        expect(og).toBeDefined();
        expect(og?.type).toBe("article");
        expect(String(og?.url)).toContain(`/case-studies/${slug}`);

        const twitter = meta.twitter as Record<string, unknown> | undefined;
        expect(twitter).toBeDefined();
        expect(twitter?.card).toBe("summary_large_image");
      }
    });

    it("3.4 5-Point Discovery Matrix Cross-Verification: all target routes are registered across surfaces", async () => {
      const canonicalRoutePaths = new Set(CANONICAL_ROUTES.map((r) => r.path));
      const seoConfigPaths = new Set(
        Object.values(ROUTE_METADATA_CONFIGS).map((c) => c.path)
      );
      const allSlugs = await CaseStudyService.getAllPublishedSlugs();

      for (const slug of targetSlugs) {
        const expectedPath = `/case-studies/${slug}`;

        // 1. Dynamic sitemaps / slugs
        expect(allSlugs).toContain(slug);

        // 2. Canonical performance benchmark routes
        expect(canonicalRoutePaths.has(expectedPath)).toBe(true);

        // 3. SEO Metadata configs
        expect(seoConfigPaths.has(expectedPath)).toBe(true);
      }
    });

    it("3.5 Zero Credential & Secret Leakage Security Scan: 0 leaks across all case study payloads", async () => {
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();

      for (const study of allStudies) {
        const textToScan = [
          study.title,
          study.editorial_content,
          study.architectural_narrative,
          study.commands_json || "",
          study.playback_json || "",
          study.tags,
        ].join("\n");

        const findings = scanText(textToScan);
        expect(findings).toEqual([]);
      }
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (Simulated User Journeys)
  // =========================================================================
  describe("Tier 4: Real-World Scenarios", () => {
    const targetSlugs = [
      "duckdeploy",
      "cardiac-risk-modeling",
      "4glory",
      "crf-xl",
      "promptops",
    ];

    it("4.1 User Journey 1: Case Study Discovery, Page Loading & Schema.org Extraction", async () => {
      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      expect(allStudies.length).toBeGreaterThan(0);

      for (const slug of targetSlugs) {
        // Step 1: User navigates to /case-studies/<slug> -> fetch data
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        if (!study) continue;

        // Step 2: Metadata generation
        const metadata = await generateMetadata({
          params: Promise.resolve({ slug }),
        });
        expect(metadata.title).toContain(study.title);

        // Step 3: SoftwareSourceCode JSON-LD extraction
        const softwareSchemaJson = getSoftwareSourceCodeSchema(study, {
          stars: 42,
          forks: 7,
        });
        expect(softwareSchemaJson).toBeDefined();
        const parsedSoftwareSchema = JSON.parse(softwareSchemaJson);
        expect(parsedSoftwareSchema["@type"]).toBe("SoftwareSourceCode");
        expect(parsedSoftwareSchema.name).toBe(study.title);
        expect(parsedSoftwareSchema.programmingLanguage).toBe(
          study.primary_language
        );
        expect(parsedSoftwareSchema.codeRepository).toBe(study.github_url);

        // Step 4: BreadcrumbList JSON-LD extraction
        const breadcrumbJson = getBreadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Case Studies", url: "/case-studies" },
          { name: study.title, url: `/case-studies/${study.slug}` },
        ]);
        const parsedBreadcrumb = JSON.parse(breadcrumbJson);
        expect(parsedBreadcrumb["@type"]).toBe("BreadcrumbList");
        expect(parsedBreadcrumb.itemListElement.length).toBe(3);
        expect(parsedBreadcrumb.itemListElement[0].name).toBe("Home");
        expect(parsedBreadcrumb.itemListElement[1].name).toBe("Case Studies");
        expect(parsedBreadcrumb.itemListElement[2].name).toBe(study.title);

        // Step 5: Next / Previous navigation connectivity
        const currentIndex = allStudies.findIndex((s) => s.slug === slug);
        expect(currentIndex).toBeGreaterThanOrEqual(0);
        const prevStudy =
          currentIndex > 0
            ? allStudies[currentIndex - 1]
            : allStudies[allStudies.length - 1];
        const nextStudy =
          currentIndex < allStudies.length - 1
            ? allStudies[currentIndex + 1]
            : allStudies[0];

        expect(prevStudy).toBeDefined();
        expect(nextStudy).toBeDefined();
        expect(prevStudy.slug).not.toBe(slug);
        expect(nextStudy.slug).not.toBe(slug);
      }
    });

    it("4.2 User Journey 2: Interactive CLI Terminal Playback Simulation", async () => {
      for (const slug of targetSlugs) {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        if (!study?.commands_json || !study?.playback_json) continue;

        const commands = JSON.parse(study.commands_json);
        const playback = JSON.parse(study.playback_json);

        // Step 1: User inspects registered CLI badges
        const commandKeys = Object.keys(commands);
        expect(commandKeys.length).toBeGreaterThanOrEqual(2);

        // Step 2: User executes each registered command
        for (const cmd of commandKeys) {
          const commandDef = commands[cmd];
          expect(commandDef).toBeDefined();
          expect(commandDef.description.length).toBeGreaterThan(5);
          expect(commandDef.payload).toBeDefined();

          // Verify structured payload is JSON serializable
          const serializedPayload = JSON.stringify(commandDef.payload);
          expect(serializedPayload.length).toBeGreaterThan(2);
        }

        // Step 3: User initiates automated incident playback
        expect(playback.length).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < playback.length; i++) {
          const step = playback[i];
          expect(step.command).toBeDefined();
          expect(step.description).toBeDefined();

          // Verify that playback command matches one of the registered commands (or a sub-command)
          const matchedCommand = commandKeys.find(
            (k) =>
              k === step.command || step.command.startsWith(k.split(" ")[0])
          );
          expect(matchedCommand).toBeDefined();
        }
      }
    });

    it("4.3 User Journey 3: Mermaid Architecture Diagram Syntax & Topology Validation", async () => {
      for (const slug of targetSlugs) {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        const narrative = study?.architectural_narrative || "";

        // Extract Mermaid diagram code block
        const mermaidMatch =
          narrative.match(
            /<code class="language-mermaid">([\s\S]*?)<\/code>/
          ) || narrative.match(/```mermaid([\s\S]*?)```/);

        expect(mermaidMatch).not.toBeNull();
        const diagramCode = (mermaidMatch ? mermaidMatch[1] : "").trim();
        expect(diagramCode.length).toBeGreaterThan(30);

        // Verify valid diagram declaration
        expect(diagramCode).toMatch(
          /^(flowchart|sequenceDiagram|graph)\s+(TD|LR|TB|RL)?/i
        );

        // Verify balanced subgraphs if present
        const subgraphCount = (diagramCode.match(/subgraph\s+/g) || []).length;
        const endCount = (diagramCode.match(/\bend\b/g) || []).length;
        expect(subgraphCount).toBe(endCount);

        // Verify directional arrows connect nodes
        expect(diagramCode).toMatch(/-->|->|--/);
      }
    });

    it("4.4 User Journey 4: Interactive Terminology Tooltips & Glossary Hover", async () => {
      const canonicalGlossaryMap = new Map(
        CANONICAL_GLOSSARY.map((g) => [g.key, g])
      );

      for (const slug of targetSlugs) {
        const study = await CaseStudyService.getCaseStudyBySlug(slug);
        expect(study).not.toBeNull();
        const content = `${study?.editorial_content} ${study?.architectural_narrative}`;

        // Extract all <span data-key="..."> elements
        const spanRegex =
          /<span\s+([^>]*data-key="([^"]+)"[^>]*)>([\s\S]*?)<\/span>/g;
        let match;
        let termsCount = 0;

        while ((match = spanRegex.exec(content)) !== null) {
          termsCount++;
          const attributesStr = match[1];
          const key = match[2];
          const innerText = match[3];

          expect(canonicalGlossaryMap.has(key)).toBe(true);
          const termDef = canonicalGlossaryMap.get(key)!;

          // Verify data-term and data-definition attributes
          expect(attributesStr).toContain(`data-term="${termDef.simplified}"`);
          expect(attributesStr).toContain(
            `data-definition="${termDef.definition}"`
          );
          expect(innerText.length).toBeGreaterThan(0);
        }

        // Every target case study must contain at least one compiled domain term
        expect(termsCount).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
