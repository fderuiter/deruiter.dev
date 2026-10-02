// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";

/**
 * Page titles carried the site name twice.
 *
 * `app/layout.tsx` declares `title.template = "%s | Frederick de Ruiter"`, so a
 * route config whose title already ends with the site name renders it twice --
 * "Under the Hood | Frederick de Ruiter | Frederick de Ruiter". Ten routes
 * shipped that way, visible in the browser tab and in search results, and it
 * wastes characters against the ~60 that search engines display.
 *
 * The OpenGraph and Twitter titles are *not* templated, so `buildRouteMetadata`
 * brands those itself. Its guard originally tested only for the long form
 * "Frederick de Ruiter", while most configs were written "... | Fred de
 * Ruiter", so those were double-branded in social cards as well.
 */
const SITE_NAME_SUFFIX = /\|\s*(?:Fred|Frederick) de Ruiter\s*$/;

describe("route titles are branded exactly once", () => {
  it("declares no route config title ending with the site name", () => {
    const offenders = Object.entries(ROUTE_METADATA_CONFIGS)
      .filter(([, config]) => SITE_NAME_SUFFIX.test(config.title))
      .map(([key, config]) => `${key}: "${config.title}"`);

    expect(
      offenders,
      "app/layout.tsx templates the site name onto every title, so a config carrying it renders the name twice"
    ).toEqual([]);
  });

  it("leaves the page title unbranded so the layout template can brand it", () => {
    const metadata = buildRouteMetadata({
      title: "Example Studio",
      description: "d",
      path: "/example",
      keywords: [],
    } as Parameters<typeof buildRouteMetadata>[0]);

    expect(metadata.title).toBe("Example Studio");
  });

  it("brands the untemplated OpenGraph and Twitter titles", () => {
    const metadata = buildRouteMetadata({
      title: "Example Studio",
      description: "d",
      path: "/example",
      keywords: [],
    } as Parameters<typeof buildRouteMetadata>[0]);

    expect(metadata.openGraph?.title).toBe(
      "Example Studio | Frederick de Ruiter"
    );
    expect(metadata.twitter?.title).toBe(
      "Example Studio | Frederick de Ruiter"
    );
  });

  it("does not double-brand a social title that already uses the short form", () => {
    // The original guard matched only "Frederick de Ruiter", so this case
    // produced "... | Fred de Ruiter | Frederick de Ruiter".
    const metadata = buildRouteMetadata({
      title: "Example Studio | Fred de Ruiter",
      description: "d",
      path: "/example",
      keywords: [],
    } as Parameters<typeof buildRouteMetadata>[0]);

    expect(metadata.openGraph?.title).toBe("Example Studio | Fred de Ruiter");
  });

  it("keeps the layout template that makes all of this work", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf-8");
    expect(
      layout,
      "without the template, stripping the site name from configs would leave titles unbranded"
    ).toMatch(/template:\s*["'`]%s \| Frederick de Ruiter["'`]/);
  });
});

/**
 * `/work/laser-loon` declares its metadata inline rather than through
 * `ROUTE_METADATA_CONFIGS`, so the config-driven bounds never reached it. It
 * rendered at 91 characters, the longest title on the site.
 */
describe("routes with inline metadata observe the same SERP bound", () => {
  const TEMPLATE_COST = " | Frederick de Ruiter".length;

  const inlineRoutes = [
    { path: "app/work/laser-loon/page.tsx", label: "/work/laser-loon" },
  ];

  inlineRoutes.forEach(({ path: relativePath, label }) => {
    it(`keeps ${label} within the 60-character SERP limit`, () => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      const titles = [...source.matchAll(/title:\s*"([^"]+)"/gu)].map(
        (match) => match[1]
      );

      expect(titles.length).toBeGreaterThan(0);

      for (const title of titles) {
        const rendered = title.length + TEMPLATE_COST;
        expect(
          rendered,
          `${label} renders ${rendered} chars: "${title}"`
        ).toBeLessThanOrEqual(60);
      }
    });
  });

  it("brands inline titles exactly once, like the templated routes", () => {
    const source = readFileSync(
      join(process.cwd(), "app/work/laser-loon/page.tsx"),
      "utf8"
    );
    const titles = [...source.matchAll(/title:\s*"([^"]+)"/gu)].map(
      (match) => match[1]
    );

    for (const title of titles) {
      expect(SITE_NAME_SUFFIX.test(title), `"${title}"`).toBe(false);
    }
  });
});
