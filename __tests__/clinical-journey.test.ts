// @vitest-environment node
/**
 * The clinical data journey map (#2689). Every step must open a page that
 * exists today, related case studies must be published, and planned work
 * must stay an issue rather than a route.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_JOURNEY,
  PLANNED_JOURNEY_ITEMS,
  RELATED_CASE_STUDIES,
  journeyIssueUrl,
  journeyPlacement,
} from "@/lib/clinical-journey";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

function published(slug: string): boolean {
  return FALLBACK_CASE_STUDIES.some(
    (study) => study.slug === slug && study.published
  );
}

/** Whether a site path is served by a route or a published case study. */
function exists(path: string): boolean {
  const caseStudy = /^\/case-studies\/([^/]+)$/.exec(path);
  if (caseStudy) return published(caseStudy[1]!);
  return existsSync(resolve(process.cwd(), "app", `.${path}`, "page.tsx"));
}

describe("clinical data journey map", () => {
  it("runs collection, consequences, tabulation, governance, then lessons", () => {
    expect(CLINICAL_JOURNEY.map((step) => step.id)).toEqual([
      "collect",
      "consequences",
      "tabulate",
      "govern",
      "lessons",
    ]);
    expect(new Set(CLINICAL_JOURNEY.map((step) => step.href)).size).toBe(
      CLINICAL_JOURNEY.length
    );
  });

  it.each(CLINICAL_JOURNEY.map((step) => [step.href, step] as const))(
    "%s is live, with a purpose and its evidence",
    (href, step) => {
      expect(exists(href), href).toBe(true);
      expect(step.purpose.length).toBeGreaterThan(20);
      expect(step.evidence.length).toBeGreaterThan(0);
    }
  );

  it("names the synthetic and fictional sources where they apply", () => {
    for (const step of CLINICAL_JOURNEY)
      expect(step.evidence, step.id).toContain("synthetic");
    const govern = CLINICAL_JOURNEY.find((step) => step.id === "govern")!;
    expect(govern.evidence).toContain("fictional-vendors");
    expect(govern.purpose).toMatch(/DEMO-301/);
    expect(govern.purpose).toMatch(/eight fictional studies/);
  });

  it("links related case studies only when they are published", () => {
    for (const study of RELATED_CASE_STUDIES) {
      expect(published(study.slug), study.slug).toBe(true);
      expect(CLINICAL_JOURNEY.some((step) => step.id === study.step)).toBe(
        true
      );
    }
  });

  it("keeps planned work as issues, never as routes", () => {
    const hrefs = new Set(CLINICAL_JOURNEY.map((step) => step.href));
    for (const item of PLANNED_JOURNEY_ITEMS) {
      expect(journeyIssueUrl(item.issue)).toBe(
        `https://github.com/fderuiter/deruiter.dev/issues/${item.issue}`
      );
      expect([...hrefs].some((href) => href.includes(String(item.issue)))).toBe(
        false
      );
    }
    const modernization = PLANNED_JOURNEY_ITEMS.find(
      (item) => item.issue === 2647
    )!;
    expect(modernization.evidence).toEqual(["verified-experience"]);
  });

  it("places pages on the journey, and leaves other pages off it", () => {
    expect(journeyPlacement("/study-data")).toEqual({
      step: CLINICAL_JOURNEY[2],
      isStep: true,
    });
    expect(journeyPlacement("/case-studies/crf-xl")).toEqual({
      step: CLINICAL_JOURNEY[0],
      isStep: false,
    });
    expect(journeyPlacement("/neuro")).toBeNull();
    expect(journeyPlacement("/case-studies/laser-loon")).toBeNull();
  });
});
