// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import CaseStudyPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/desktop/case-studies/[slug]/page";

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.5,
    muted: false,
    profile: "8-bit",
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

vi.mock("@/components/TelemetryTracker", () => ({
  TelemetryTracker: () => <div data-testid="telemetry-tracker" />,
}));

vi.mock("@/components/SandboxTerminal", () => ({
  SandboxTerminal: () => <div data-testid="sandbox-terminal" />,
}));

vi.mock("@/components/SchemaFlowWorkspaceWrapper", () => ({
  default: () => <div data-testid="schemaflow-wrapper" />,
}));

vi.mock("@/components/CaseStudyFeedbackSection", () => ({
  CaseStudyFeedbackSection: () => <div data-testid="feedback-section" />,
}));

describe("Resilient Hybrid Case Study Fallback Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CaseStudyService.getCaseStudyBySlug", () => {
    it("returns database record when slug is found and published in DB", async () => {
      const mockDbRecord = {
        id: "db-study-1",
        slug: "schemaflow",
        title: "SchemaFlow DB Version",
        primary_language: "TypeScript",
        github_url: "https://github.com/fderuiter/SchemaFlow",
        published: true,
        simulated_telemetry: false,
        tags: "TypeScript, Flow",
        editorial_content: "DB Editorial content",
        architectural_narrative: "<p>DB Narrative</p>",
        commands_json: null,
        playback_json: null,
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-02"),
      };

      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(
        mockDbRecord as never
      );

      const result = await CaseStudyService.getCaseStudyBySlug("schemaflow");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("SchemaFlow DB Version");
      expect(result?.id).toBe("db-study-1");
    });

    it("falls back to FALLBACK_CASE_STUDIES when slug is absent from DB (e.g. laser-loon)", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const result = await CaseStudyService.getCaseStudyBySlug("laser-loon");
      expect(result).not.toBeNull();
      expect(result?.slug).toBe("laser-loon");
      expect(result?.title).toContain("Laser Loon");
    });

    it("falls back to FALLBACK_CASE_STUDIES when DB query throws an exception", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockRejectedValueOnce(
        new Error("Neon DB connection timeout")
      );

      const result = await CaseStudyService.getCaseStudyBySlug("laser-loon");
      expect(result).not.toBeNull();
      expect(result?.slug).toBe("laser-loon");
    });

    it("returns null when slug does not exist in DB or static fallbacks", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const result = await CaseStudyService.getCaseStudyBySlug(
        "non-existent-case-study"
      );
      expect(result).toBeNull();
    });
  });

  describe("CaseStudyService.getAllPublishedCaseStudies", () => {
    it("merges DB records with missing fallback studies without duplicates", async () => {
      const mockDbStudies = [
        {
          id: "db-study-1",
          slug: "schemaflow",
          title: "SchemaFlow DB Version",
          primary_language: "TypeScript",
          github_url: "https://github.com/fderuiter/SchemaFlow",
          published: true,
          simulated_telemetry: false,
          tags: "TypeScript",
          editorial_content: "DB Editorial",
          architectural_narrative: "<p>DB</p>",
          commands_json: null,
          playback_json: null,
          created_at: new Date("2026-01-01"),
          updated_at: new Date("2026-01-02"),
        },
      ];

      vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce(
        mockDbStudies as never
      );

      const results = await CaseStudyService.getAllPublishedCaseStudies();
      expect(results.length).toBeGreaterThan(1);

      // SchemaFlow should use DB version
      const schemaFlow = results.find((s) => s.slug === "schemaflow");
      expect(schemaFlow?.title).toBe("SchemaFlow DB Version");

      // laser-loon should be present from fallback
      const laserLoon = results.find((s) => s.slug === "laser-loon");
      expect(laserLoon).toBeDefined();
      expect(laserLoon?.slug).toBe("laser-loon");

      // Verify no duplicate slugs
      const slugs = results.map((s) => s.slug);
      const uniqueSlugs = new Set(slugs);
      expect(slugs.length).toBe(uniqueSlugs.size);
    });

    it("returns all FALLBACK_CASE_STUDIES if DB findMany throws an error", async () => {
      vi.mocked(prisma.caseStudy.findMany).mockRejectedValueOnce(
        new Error("Postgres connection reset")
      );

      const results = await CaseStudyService.getAllPublishedCaseStudies();
      expect(results.length).toBe(FALLBACK_CASE_STUDIES.length);
      expect(results.some((s) => s.slug === "laser-loon")).toBe(true);
    });
  });

  describe("CaseStudyPage & Route Metadata Prerender Invariants", () => {
    it("generateStaticParams returns all published slugs including laser-loon", async () => {
      vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([]);

      const params = await generateStaticParams();
      expect(params.some((p) => p.slug === "laser-loon")).toBe(true);
    });

    it("generateMetadata returns valid metadata for fallback case study", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "laser-loon" }),
      });

      expect(meta.title).toContain("Laser Loon");
      expect((meta.openGraph as { type?: string })?.type).toBe("article");
    });

    it("generateMetadata returns not found metadata when slug is invalid", async () => {
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "invalid-random-slug" }),
      });

      expect(meta.title).toBe("Case Study Not Found");
    });

    it("CaseStudyPage renders successfully without throwing in production when slug is absent from DB", async () => {
      // Simulate DB returning empty list or missing laser-loon
      vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const element = await CaseStudyPage({
        params: Promise.resolve({ slug: "laser-loon" }),
      });

      expect(element).toBeDefined();
    });

    it("points the 'back to case study list' link at the same route as the breadcrumb (no competing destinations)", async () => {
      vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.caseStudy.findUnique).mockResolvedValueOnce(null);

      const element = await CaseStudyPage({
        params: Promise.resolve({ slug: "laser-loon" }),
      });

      // Walk the unrendered React element tree (a plain object graph) to
      // find the Breadcrumbs and NextPrevNav elements' props directly,
      // without needing a full DOM render across client/server boundaries.
      type AnyReactElement = { type: unknown; props?: Record<string, unknown> };
      function findByDisplayName(
        node: unknown,
        name: string
      ): AnyReactElement | null {
        if (!node || typeof node !== "object") return null;
        const el = node as AnyReactElement;
        const type = el.type as
          | (((...args: never[]) => unknown) & { displayName?: string })
          | string
          | undefined;
        if (
          typeof type === "function" &&
          (type.name === name || type.displayName === name)
        ) {
          return el;
        }
        if (Array.isArray(node)) {
          for (const child of node) {
            const found = findByDisplayName(child, name);
            if (found) return found;
          }
          return null;
        }
        const children = el.props?.children;
        if (children !== undefined) {
          return findByDisplayName(children, name);
        }
        return null;
      }

      const breadcrumbs = findByDisplayName(element, "Breadcrumbs");
      const nextPrevNav = findByDisplayName(element, "NextPrevNav");

      expect(breadcrumbs).not.toBeNull();
      expect(nextPrevNav).not.toBeNull();

      const breadcrumbItems = breadcrumbs!.props!.items as Array<{
        label: string;
        href?: string;
      }>;
      const caseStudiesCrumb = breadcrumbItems.find(
        (c) => c.label === "Case Studies"
      );
      const backToHub = nextPrevNav!.props!.backToHub as {
        title: string;
        href: string;
      };

      expect(caseStudiesCrumb?.href).toBe("/case-studies");
      // Regression: backToHub previously pointed at "/#case-studies" (a
      // homepage anchor section), a different destination than the
      // breadcrumb's "/case-studies" (the real, filterable list route) --
      // two competing "back to the list" targets on the same page.
      expect(backToHub.href).toBe("/case-studies");
      expect(backToHub.href).toBe(caseStudiesCrumb?.href);
    });
  });
});
