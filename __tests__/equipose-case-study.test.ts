// @vitest-environment node
import { describe, it, expect } from "vitest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { scanText } from "@/lib/security-scan";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

describe("Equipose Randomization Case Study Integration & Security Invariants", () => {
  it("includes equipose-randomization in static FALLBACK_CASE_STUDIES array", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "equipose-randomization"
    );
    expect(study).toBeDefined();
    expect(study?.title).toContain("Equipose");
    expect(study?.primary_language).toBe("Angular / TypeScript");
    expect(study?.published).toBe(true);
    expect(study?.github_url).toBe(
      "https://github.com/fderuiter/equipose-randomization"
    );
  });

  it("contains complete tags and clinical informatics metadata", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "equipose-randomization"
    );
    expect(study).toBeDefined();
    const tags = study?.tags.split(",").map((t) => t.trim());
    expect(tags).toContain("Angular");
    expect(tags).toContain("TypeScript");
    expect(tags).toContain("Web Workers");
    expect(tags).toContain("Clinical Informatics");
    expect(tags).toContain("Transpiler Design");
    expect(tags).toContain("Deterministic Algorithms");
    expect(tags).toContain("CDISC / ADaM-Lite");
  });

  it("contains essential architectural narratives and code snippets", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "equipose-randomization"
    );
    expect(study).toBeDefined();
    expect(study?.architectural_narrative).toContain("TrialSchemaTranspiler");
    expect(study?.architectural_narrative).toContain("RCodeGeneratorStrategy");
    expect(study?.architectural_narrative).toContain("PocockSimonMinimizer");
    expect(study?.architectural_narrative).toContain("MT19937PRNG");
    expect(study?.architectural_narrative).toContain("WorkerRPCMessage");
    expect(study?.architectural_narrative).toContain("flowchart TD");
  });

  it("passes security and credential regex scanner with zero leak violations", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "equipose-randomization"
    );
    expect(study).toBeDefined();

    const editorialMatches = scanText(study!.editorial_content);
    const narrativeMatches = scanText(study!.architectural_narrative);

    expect(editorialMatches).toEqual([]);
    expect(narrativeMatches).toEqual([]);
  });

  it("registers canonical benchmark route and SEO metadata config", () => {
    const canonicalRoute = CANONICAL_ROUTES.find(
      (r) => r.path === "/case-studies/equipose-randomization"
    );
    expect(canonicalRoute).toBeDefined();
    expect(canonicalRoute?.category).toBe("case-study");

    const seoConfig = ROUTE_METADATA_CONFIGS.equiposeRandomization;
    expect(seoConfig).toBeDefined();
    expect(seoConfig.path).toBe("/case-studies/equipose-randomization");
    expect(seoConfig.title).toContain("Equipose");
    expect(seoConfig.keywords).toContain("Angular");
    expect(seoConfig.keywords).toContain("Web Workers");
  });
});
