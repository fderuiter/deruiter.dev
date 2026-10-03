// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { scanText } from "@/lib/security-scan";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { PUBLIC_ROUTE_PATHS } from "@/lib/public-routes";
import { compileTerms } from "@/lib/term-compiler";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { prisma } from "@/lib/db";
import { loadSeedPayloads } from "./helpers/seed-payloads";

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const SLUG = "equipose-randomization";
const PATH = `/case-studies/${SLUG}`;
const REPO = "https://github.com/fderuiter/equipose-randomization";
const LIVE_SITE = "https://equipose.org";

function getStudy() {
  const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === SLUG);
  if (!study) throw new Error(`${SLUG} is missing from FALLBACK_CASE_STUDIES`);
  return study;
}

function getSeedPayload() {
  const payload = loadSeedPayloads().find((p) => p.slug === SLUG);
  if (!payload) throw new Error(`${SLUG} is missing from SEED_PAYLOADS`);
  return payload;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Pairs each TypeScript excerpt in the narrative with the repository path named
 * in the h4 heading above it.
 */
function extractSnippets(
  narrative: string
): Array<{ path: string; code: string }> {
  const snippets: Array<{ path: string; code: string }> = [];
  const pattern =
    /<h4>[^\n]*?\(<code>([^<]+)<\/code>\)<\/h4>|<pre><code class="language-typescript">\n([\s\S]*?)<\/code><\/pre>/g;
  let currentPath: string | null = null;
  for (const match of narrative.matchAll(pattern)) {
    if (match[1]) {
      currentPath = match[1];
      continue;
    }
    if (!currentPath) throw new Error("excerpt without a source path heading");
    snippets.push({ path: currentPath, code: decodeEntities(match[2]) });
  }
  return snippets;
}

describe("Equipose case study: record and metadata", () => {
  it("is published under the canonical slug with the correct repository and live site", () => {
    const study = getStudy();
    expect(study.title).toContain("Equipose");
    expect(study.primary_language).toBe("Angular / TypeScript");
    expect(study.published).toBe(true);
    expect(study.github_url).toBe(REPO);
    expect(study.external_platform_url).toBe(LIVE_SITE);
  });

  it("tags only what the source supports", () => {
    const tags = getStudy()
      .tags.split(",")
      .map((t) => t.trim());
    expect(tags).toEqual(
      expect.arrayContaining([
        "Angular",
        "TypeScript",
        "NgRx SignalStore",
        "Web Workers",
        "Code Generation",
        "Deterministic Algorithms",
      ])
    );
    // ADaM-lite is the project's own dataset shape, not CDISC ADaM.
    expect(tags.some((t) => /CDISC/i.test(t))).toBe(false);
  });

  it("passes the credential scanner", () => {
    const study = getStudy();
    expect(scanText(study.editorial_content)).toEqual([]);
    expect(scanText(study.architectural_narrative)).toEqual([]);
  });
});

describe("Equipose case study: evidence-backed narrative", () => {
  it("follows the ADR 0016 section structure", () => {
    const narrative = getStudy().architectural_narrative;
    const headings = [...narrative.matchAll(/<h3>([^<]+)<\/h3>/g)].map(
      (m) => m[1]
    );
    expect(headings).toEqual([
      "The problem",
      "How it works",
      "How the pieces connect",
      "Implementation notes",
      "Tradeoffs and lessons",
      "Sources",
    ]);
    expect(narrative).toContain('<code class="language-mermaid">');
    expect(narrative).toContain("flowchart TD");
  });

  it("names real symbols from the Equipose source", () => {
    const narrative = getStudy().architectural_narrative;
    for (const symbol of [
      "generateRandomizationSchema",
      "MT19937Internal",
      "get31BitSeed",
      "selectWeightedArm",
      "runMonteCarlo",
      "RandomizationEngineFacade",
      "CodeGeneratorService",
      "LogicIR",
    ]) {
      expect(narrative).toContain(symbol);
    }
  });

  it("drops identifiers that do not exist in the Equipose source", () => {
    const narrative = getStudy().architectural_narrative;
    for (const invented of [
      "TrialSchemaTranspiler",
      "RCodeGeneratorStrategy",
      "PocockSimonMinimizer",
      "MT19937PRNG",
      "WorkerRPCMessage",
      "Math.random()",
    ]) {
      expect(narrative).not.toContain(invented);
    }
  });

  it("makes no benchmark, compliance or validation claims the source does not support", () => {
    const study = getStudy();
    const text = `${study.editorial_content}\n${study.architectural_narrative}`;
    for (const claim of [
      /sub-10\s?ms/i,
      /21 CFR/i,
      /HIPAA/i,
      /GxP/i,
      /\bcompliant\b/i,
      /\bcompliance\b/i,
      /source of truth/i,
      /zero PHI/i,
      /bitwise audit parity verified/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
    // The parity claim is kept only as project-reported, with its limit.
    expect(study.architectural_narrative).toContain("project-reported");
    expect(study.architectural_narrative).toContain(
      "do not guarantee sequence parity"
    );
  });

  it("links every source to the Equipose repository main branch or the live site", () => {
    const narrative = getStudy().architectural_narrative;
    const hrefs = [...narrative.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const ok =
        href === LIVE_SITE ||
        href === REPO ||
        href.startsWith(`${REPO}/blob/main/`);
      expect(ok, href).toBe(true);
    }
  });

  it("labels every excerpt with a repository path", () => {
    const snippets = extractSnippets(getStudy().architectural_narrative);
    expect(snippets.length).toBeGreaterThanOrEqual(3);
    for (const { path } of snippets) {
      expect(path).toMatch(/^src\/app\/domain\/.+\.ts$/);
    }
  });

  // The Equipose repository is not a dependency of this one, so the verbatim
  // check runs only when a checkout is supplied:
  //   EQUIPOSE_REPO_DIR=../equipose-randomization npx vitest run __tests__/equipose-case-study.test.ts
  const equiposeRepo = process.env.EQUIPOSE_REPO_DIR;
  it.skipIf(!equiposeRepo || !existsSync(equiposeRepo))(
    "quotes every excerpt verbatim from the Equipose checkout",
    () => {
      for (const { path, code } of extractSnippets(
        getStudy().architectural_narrative
      )) {
        const source = readFileSync(join(equiposeRepo!, path), "utf-8");
        expect(source.includes(code), path).toBe(true);
      }
    }
  );
});

/**
 * What `prisma/seed.ts` writes for a payload: it runs the two prose fields
 * through compileTerms, exactly as FALLBACK_CASE_STUDIES does.
 */
function seededRow(payload: Record<string, string>) {
  return {
    ...payload,
    editorial_content: compileTerms(payload.editorial_content),
    architectural_narrative: compileTerms(payload.architectural_narrative),
  };
}

describe("Equipose case study: database seed matches the fallback", () => {
  // CaseStudyService serves a database row ahead of the fallback, so the seed
  // must publish exactly what the fallback publishes.
  it("seeds the same title, metadata, and narrative as the fallback", () => {
    const study = getStudy();
    const row = seededRow(getSeedPayload());
    for (const field of [
      "title",
      "primary_language",
      "github_url",
      "tags",
      "editorial_content",
      "architectural_narrative",
      "published",
      "simulated_telemetry",
    ] as const) {
      expect(row[field as keyof typeof row], field).toBe(study[field]);
    }
  });
});

describe("Equipose case study: slug resolves consistently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValue([]);
  });

  it("is registered under the same path in every discovery surface", () => {
    expect(CANONICAL_ROUTES.find((r) => r.path === PATH)?.category).toBe(
      "case-study"
    );
    expect(PUBLIC_ROUTE_PATHS).toContain(PATH);

    const seo = ROUTE_METADATA_CONFIGS.equiposeRandomization;
    expect(seo.path).toBe(PATH);
    expect(seo.title).toContain("Equipose");

    const palette = readFileSync(
      join(process.cwd(), "components/CommandPalette.tsx"),
      "utf-8"
    );
    expect(palette).toContain(`url: "${PATH}"`);
  });

  it("serves the fallback record when the database has no row", async () => {
    const study = await CaseStudyService.getCaseStudyBySlug(SLUG);
    expect(study?.slug).toBe(SLUG);
    expect(study?.architectural_narrative).toBe(
      getStudy().architectural_narrative
    );
  });

  it("serves the same content and live-site link when the seeded row answers", async () => {
    vi.mocked(prisma.caseStudy.findUnique).mockResolvedValue({
      ...seededRow(getSeedPayload()),
      id: "db-equipose",
      commands_json: null,
      playback_json: null,
      hero_image_url: null,
      created_at: new Date("2026-03-09T00:00:00Z"),
      updated_at: new Date("2026-10-02T00:00:00Z"),
    } as never);

    const study = await CaseStudyService.getCaseStudyBySlug(SLUG);
    expect(study?.slug).toBe(SLUG);
    expect(study?.title).toBe(getStudy().title);
    expect(study?.github_url).toBe(REPO);
    expect(study?.external_platform_url).toBe(LIVE_SITE);
    expect(study?.architectural_narrative).toBe(
      getStudy().architectural_narrative
    );
  });

  it("is included in the published list the sitemap reads", async () => {
    const studies = await CaseStudyService.getAllPublishedCaseStudies();
    expect(studies.map((s) => s.slug)).toContain(SLUG);
  });
});

describe("Equipose case study: legacy /case-studies/equipose page is retired (#1781)", () => {
  const LEGACY_SLUG = "equipose";

  it("keeps the recovered seed row but unpublishes it", () => {
    const legacy = loadSeedPayloads().find((p) => p.slug === LEGACY_SLUG);
    expect(legacy, "the recovered row must stay in the seed").toBeDefined();
    expect((legacy as Record<string, unknown>).published).toBe(false);
  });

  it("permanently redirects the legacy path to the verified case study", async () => {
    const { default: nextConfig } = await import("@/next.config");
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual(
      expect.objectContaining({
        source: `/case-studies/${LEGACY_SLUG}`,
        destination: PATH,
        permanent: true,
      })
    );
  });

  it("is not listed among published case studies when the seeded rows answer", async () => {
    vi.mocked(prisma.caseStudy.findMany).mockImplementation((async (args?: {
      where?: { published?: boolean };
    }) =>
      loadSeedPayloads()
        .filter(
          (p) =>
            args?.where?.published === undefined ||
            (p as Record<string, unknown>).published === args.where.published
        )
        .map((p) => ({ ...p, id: `db-${p.slug}` }))) as never);

    const studies = await CaseStudyService.getAllPublishedCaseStudies();
    expect(studies.map((s) => s.slug)).not.toContain(LEGACY_SLUG);
  });
});
