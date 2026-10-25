import { describe, expect, it } from "vitest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { findClinicalClaims } from "@/lib/clinical-platform";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

const PATH = "/case-studies/study-data-pipeline";
const study = FALLBACK_CASE_STUDIES.find(
  (item) => item.slug === "study-data-pipeline"
);

describe("Study Data Pipeline case study (#2595)", () => {
  it("is published and opens the running page", () => {
    expect(study?.published).toBe(true);
    expect(study?.title).toBe(
      "Study Data Pipeline: USDM to SDTM, ADaM and TLFs"
    );
    expect(study?.interactive_url).toBe("/study-data");
    expect(study?.architectural_narrative).toContain('href="/study-data"');
  });

  it("says the data are synthetic and claims no validated workflow", () => {
    const text = `${study?.editorial_content} ${study?.architectural_narrative}`;
    expect(text).toMatch(/synthetic/i);
    expect(text).toContain("not a production submission workflow");
    expect(text).toContain("not a validator of record");
    expect(findClinicalClaims(text)).toEqual([]);
    expect(text).not.toMatch(/\bvalidated\b|\bcompliant\b|\bPart\s*11\b/i);
  });

  it("is registered for discovery", () => {
    expect(PUBLIC_ROUTE_REGISTRY.some((route) => route.path === PATH)).toBe(
      true
    );
    expect(
      Object.values(ROUTE_METADATA_CONFIGS).some(
        (config) => config.path === PATH
      )
    ).toBe(true);
  });
});
