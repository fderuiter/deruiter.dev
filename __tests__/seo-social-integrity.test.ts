import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINEERING_BRIDGES } from "@/lib/engineering-bridges";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { OG_IMAGE_MAX_BYTES, OG_IMAGE_SIZE } from "@/lib/og-image";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

/**
 * Regression guard for SEO and social preview integrity (ADR 0053, #1256).
 * Each check is cheap and static; card rendering is measured in
 * `og-image.test.ts` and length copy in `seo-metadata.test.ts`.
 */
const root = process.cwd();
const configs = Object.entries(ROUTE_METADATA_CONFIGS);
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

describe("route metadata bounds (#1256)", () => {
  it.each(configs)("%s renders a 50 to 60 character title", (_key, config) => {
    const title = String(buildRouteMetadata(config).openGraph?.title);
    expect(title.length, title).toBeGreaterThanOrEqual(50);
    expect(title.length, title).toBeLessThanOrEqual(60);
  });

  it.each(configs)(
    "%s has a 140 to 160 character description",
    (_key, config) => {
      expect(
        config.description.length,
        config.description
      ).toBeGreaterThanOrEqual(140);
      expect(config.description.length, config.description).toBeLessThanOrEqual(
        160
      );
    }
  );

  it.each(configs)("%s is branded at most once", (_key, config) => {
    const title = String(buildRouteMetadata(config).openGraph?.title);
    const brands = title.match(/(?:Fred|Frederick) de Ruiter/gi) ?? [];
    expect(brands.length, title).toBeLessThanOrEqual(1);
    expect(config.title).not.toMatch(/(?:Fred|Frederick) de Ruiter/i);
  });
});

describe("root layout and social card contract (#1256)", () => {
  it("declares the brand theme color", () => {
    // Read as source: importing app/layout pulls in next/font loaders.
    const layout = read("app/layout.tsx");
    const block = layout.slice(layout.indexOf("export const viewport"));
    expect(block).toMatch(/themeColor:\s*"#090D16"/);
  });

  it("declares 1200x630 PNG cards under a 250 KB budget", () => {
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_IMAGE_MAX_BYTES).toBe(250 * 1024);
    expect(
      fs.statSync(path.join(root, "public/og/laser-loon-preview.png")).size
    ).toBeLessThan(OG_IMAGE_MAX_BYTES);
  });

  it.each(configs)("%s advertises the 1200x630 card", (_key, config) => {
    const image = (
      buildRouteMetadata(config).openGraph?.images as Array<{
        width?: number;
        height?: number;
      }>
    )[0];
    expect(image?.width).toBe(1200);
    expect(image?.height).toBe(630);
  });
});

describe("llms manifests list the canonical routes (#1256)", () => {
  const llms = read("public/llms.txt");
  const full = read("public/llms-full.txt");

  it.each(configs)("%s is linked from both manifests", (_key, config) => {
    expect(llms).toContain(`(https://deruiter.dev${config.path})`);
    expect(full).toContain(`(https://deruiter.dev${config.path})`);
  });

  it("links only to the canonical origin", () => {
    for (const manifest of [llms, full]) {
      const origins = manifest.match(/https?:\/\/[a-z0-9.-]*[a-z0-9]/gi) ?? [];
      const foreign = origins.filter(
        (origin) =>
          origin !== "https://deruiter.dev" &&
          !origin.startsWith("https://github.com")
      );
      expect(foreign).toEqual([]);
    }
  });
});

describe("engineering bridge links resolve (#1256)", () => {
  const registered = new Set(configs.map(([, config]) => config.path));

  it.each(
    Object.values(ENGINEERING_BRIDGES).map(
      (entry) => [entry.route, entry] as const
    )
  )(
    "%s links to a registered route, case studies and ADRs on disk",
    (_route, entry) => {
      expect(registered.has(entry.route)).toBe(true);
      for (const study of entry.caseStudies) {
        expect(
          FALLBACK_CASE_STUDIES.some(
            (candidate) => candidate.slug === study.slug
          ),
          study.slug
        ).toBe(true);
      }
      for (const adr of entry.adrs) {
        expect(fs.existsSync(path.join(root, "adr", adr.file)), adr.file).toBe(
          true
        );
      }
    }
  );
});
