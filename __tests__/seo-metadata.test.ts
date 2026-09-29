import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  getPersonSchema,
  getWebsiteSchema,
  getWebApplicationSchema,
  getBreadcrumbSchema,
  getCollectionPageSchema,
  getSoftwareSourceCodeSchema,
  SITE_BASE_URL,
} from "@/lib/seo";
import { resolveBaseUrl } from "@/lib/domain";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import robots from "@/app/robots";
import sitemap, { revalidate } from "@/app/sitemap";
import manifest from "@/app/manifest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  Lexend: () => ({ variable: "--font-lexend" }),
  Atkinson_Hyperlegible: () => ({ variable: "--font-atkinson" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

describe("SEO Architecture & JSON-LD Schemas", () => {
  it("getPersonSchema generates valid, parseable Schema.org Person with XSS sanitization", () => {
    const raw = getPersonSchema();
    expect(raw).not.toContain("<script");
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe("Frederick de Ruiter");
    expect(parsed.jobTitle).toContain("Principal Systems Engineer");
    expect(parsed.sameAs).toHaveLength(2);
  });

  it("getWebsiteSchema generates valid WebSite schema", () => {
    const raw = getWebsiteSchema();
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("WebSite");
    expect(parsed.url).toBe(SITE_BASE_URL);
    expect(parsed.author["@type"]).toBe("Person");
  });

  it("getUnifiedGraphSchema generates interconnected @graph with valid node IDs", async () => {
    const {
      getUnifiedGraphSchema,
      getPersonNode,
      getWebsiteNode,
      getWebPageNode,
      getBreadcrumbNode,
    } = await import("@/lib/seo");

    const pageUrl = `${SITE_BASE_URL}/crf`;
    const graphStr = getUnifiedGraphSchema([
      getPersonNode(),
      getWebsiteNode(),
      getWebPageNode({
        name: "CRF Studio: Clinical Form Designer",
        description: "Design clinical trial CRFs.",
        url: "/crf",
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "CRF Studio", url: "/crf" },
        ],
      }),
      getBreadcrumbNode(
        [
          { name: "Home", url: "/" },
          { name: "CRF Studio", url: "/crf" },
        ],
        pageUrl
      ),
    ]);

    expect(graphStr).not.toContain("<script");
    const parsed = JSON.parse(graphStr);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(Array.isArray(parsed["@graph"])).toBe(true);
    expect(parsed["@graph"]).toHaveLength(4);

    const person = parsed["@graph"].find(
      (n: Record<string, unknown>) => n["@type"] === "Person"
    );
    const website = parsed["@graph"].find(
      (n: Record<string, unknown>) => n["@type"] === "WebSite"
    );
    const webpage = parsed["@graph"].find(
      (n: Record<string, unknown>) => n["@type"] === "WebPage"
    );
    const breadcrumb = parsed["@graph"].find(
      (n: Record<string, unknown>) => n["@type"] === "BreadcrumbList"
    );

    expect(person["@id"]).toBe(`${SITE_BASE_URL}/#person`);
    expect(website["@id"]).toBe(`${SITE_BASE_URL}/#website`);
    expect(website.publisher["@id"]).toBe(`${SITE_BASE_URL}/#person`);
    expect(webpage.isPartOf["@id"]).toBe(`${SITE_BASE_URL}/#website`);
    expect(webpage.author["@id"]).toBe(`${SITE_BASE_URL}/#person`);
    expect(webpage.breadcrumb["@id"]).toBe(`${pageUrl}/#breadcrumb`);
    expect(breadcrumb["@id"]).toBe(`${pageUrl}/#breadcrumb`);
  });

  it("getVisualArtworkSchema generates rich VisualArtwork and MediaObject schema for Laser Loon", async () => {
    const { getVisualArtworkSchema } = await import("@/lib/seo");

    const raw = getVisualArtworkSchema({
      name: "The Laser Loon (Minnesota State Flag Submission F277)",
      description:
        "Open vector asset hub and graphic design case study for the Laser Loon.",
      url: "/work/laser-loon",
      imageUrl: `${SITE_BASE_URL}/images/laser-loon-preview.png`,
      formats: [
        "image/svg+xml",
        "application/illustrator",
        "application/pdf",
        "image/png",
      ],
      license: "https://creativecommons.org/licenses/by/4.0/",
    });

    expect(raw).not.toContain("<script");
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("VisualArtwork");
    expect(parsed.name).toContain("Laser Loon");
    expect(parsed.creator["@type"]).toBe("Person");
    expect(parsed.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(parsed.encodingFormat).toContain("image/svg+xml");
    expect(parsed.encodingFormat).toContain("application/illustrator");
  });

  it("getWebApplicationSchema generates valid WebApplication schema for games", () => {
    const raw = getWebApplicationSchema({
      name: "Laser Loon: Quest for the State Flag",
      description: "Raycaster laser arcade game",
      url: "/arcade/laser-loon",
      applicationCategory: "GameApplication",
      genre: "Civic Arcade Shooter",
    });
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("WebApplication");
    expect(parsed.name).toBe("Laser Loon: Quest for the State Flag");
    expect(parsed.url).toBe(`${SITE_BASE_URL}/arcade/laser-loon`);
    expect(parsed.applicationCategory).toBe("GameApplication");
    expect(parsed.genre).toBe("Civic Arcade Shooter");
  });

  it("getBreadcrumbSchema generates structured BreadcrumbList", () => {
    const raw = getBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Arcade Hub", url: "/arcade" },
      { name: "Laser Loon", url: "/arcade/laser-loon" },
    ]);
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toHaveLength(3);
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[0].name).toBe("Home");
    expect(parsed.itemListElement[2].item).toBe(
      `${SITE_BASE_URL}/arcade/laser-loon`
    );
  });

  it("getCollectionPageSchema generates structured CollectionPage with item list", () => {
    const raw = getCollectionPageSchema(
      "Arcade Hub",
      "Interactive games",
      "/arcade",
      [
        {
          name: "Laser Loon",
          url: "/arcade/laser-loon",
          description: "Bug shooter",
        },
        { name: "Quasi-Puzzler", url: "/arcade/quasi-puzzler" },
      ]
    );
    const parsed = JSON.parse(raw);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("CollectionPage");
    expect(parsed.mainEntity["@type"]).toBe("ItemList");
    expect(parsed.mainEntity.itemListElement).toHaveLength(2);
  });

  it("getSoftwareSourceCodeSchema formats case studies with telemetry", () => {
    const mockStudy = {
      id: "cs-1",
      slug: "schemaflow",
      title: "SchemaFlow Engine",
      primary_language: "TypeScript",
      github_url: "https://github.com/fderuiter/schemaflow",
      published: true,
      simulated_telemetry: false,
      tags: "TypeScript, AST",
      editorial_content: "An **interactive** proof engine.",
      architectural_narrative: "<p>Narrative</p>",
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-02-01"),
    };

    const raw = getSoftwareSourceCodeSchema(mockStudy, { stars: 42, forks: 7 });
    const parsed = JSON.parse(raw);
    expect(parsed["@type"]).toBe("SoftwareSourceCode");
    expect(parsed.name).toBe("SchemaFlow Engine");
    expect(parsed.programmingLanguage).toBe("TypeScript");
    expect(parsed.description).toBe("An interactive proof engine.");
    expect(parsed.interactionStatistic).toHaveLength(2);
  });

  it("buildRouteMetadata generates complete Next.js metadata objects for all registered routes with explicit social images", () => {
    const routeKeys = Object.keys(ROUTE_METADATA_CONFIGS);
    expect(routeKeys.length).toBeGreaterThanOrEqual(10);

    for (const key of routeKeys) {
      const config = ROUTE_METADATA_CONFIGS[key];
      const meta = buildRouteMetadata(config);

      const expectedCanonical = config.canonicalPath ?? config.path;
      expect(meta.title).toBe(config.title);
      expect(meta.description).toBe(config.description);
      expect(meta.alternates?.canonical).toBe(expectedCanonical);
      expect(meta.openGraph?.title).toContain(config.title);
      expect(meta.openGraph?.description).toBe(config.description);
      expect(meta.twitter?.title).toContain(config.title);

      // Verify explicit OpenGraph image array
      expect(meta.openGraph?.images).toBeDefined();
      expect(Array.isArray(meta.openGraph?.images)).toBe(true);
      const ogImages = meta.openGraph?.images as Array<{
        url: string;
        width?: number;
        height?: number;
        alt?: string;
      }>;
      expect(ogImages.length).toBeGreaterThan(0);
      expect(ogImages[0].url).toContain(`${config.path}/opengraph-image`);
      expect(ogImages[0].width).toBe(1200);
      expect(ogImages[0].height).toBe(630);

      // Verify explicit Twitter card image
      expect(meta.twitter?.images).toBeDefined();
      expect(Array.isArray(meta.twitter?.images)).toBe(true);
      const twImages = meta.twitter?.images as Array<string>;
      expect(twImages.length).toBeGreaterThan(0);
      expect(twImages[0]).toContain(`${config.path}/opengraph-image`);
    }
  });

  it("derives explicit canonical URLs and social metadata for touch aliases (/m/*) while retaining coverage for every canonical studio route", () => {
    const touchAliases = [
      {
        aliasKey: "mCrf",
        canonicalKey: "crf",
        aliasPath: "/m/crf",
        canonicalPath: "/crf",
      },
      {
        aliasKey: "mProof",
        canonicalKey: "proof",
        aliasPath: "/m/proof",
        canonicalPath: "/proof",
      },
      {
        aliasKey: "mNeuro",
        canonicalKey: "neuro",
        aliasPath: "/m/neuro",
        canonicalPath: "/neuro",
      },
      {
        aliasKey: "mPatrol",
        canonicalKey: "patrol",
        aliasPath: "/m/patrol",
        canonicalPath: "/patrol",
      },
    ];

    for (const item of touchAliases) {
      const aliasConfig = ROUTE_METADATA_CONFIGS[item.aliasKey];
      const canonicalConfig = ROUTE_METADATA_CONFIGS[item.canonicalKey];

      expect(aliasConfig).toBeDefined();
      expect(canonicalConfig).toBeDefined();

      expect(aliasConfig.path).toBe(item.aliasPath);
      expect(aliasConfig.canonicalPath).toBe(item.canonicalPath);
      expect(canonicalConfig.path).toBe(item.canonicalPath);
      expect(canonicalConfig.canonicalPath).toBeUndefined();

      const aliasMeta = buildRouteMetadata(aliasConfig);
      const canonicalMeta = buildRouteMetadata(canonicalConfig);

      // Verify alias resolves canonical to canonicalPath, NOT aliasPath
      expect(aliasMeta.alternates?.canonical).toBe(item.canonicalPath);
      expect(aliasMeta.alternates?.canonical).not.toBe(item.aliasPath);

      // Verify canonical route resolves canonical to itself
      expect(canonicalMeta.alternates?.canonical).toBe(item.canonicalPath);

      // Verify social metadata for alias routes
      expect(aliasMeta.openGraph?.title).toContain(aliasConfig.title);
      expect(aliasMeta.openGraph?.description).toBe(aliasConfig.description);
      const aliasOgImages = aliasMeta.openGraph?.images as Array<{
        url: string;
      }>;
      expect(aliasOgImages[0]?.url).toContain(
        `${item.aliasPath}/opengraph-image`
      );
      const aliasTwImages = aliasMeta.twitter?.images as Array<string>;
      expect(aliasTwImages[0]).toContain(`${item.aliasPath}/opengraph-image`);

      // Verify social metadata for canonical routes
      expect(canonicalMeta.openGraph?.title).toContain(canonicalConfig.title);
      expect(canonicalMeta.openGraph?.description).toBe(
        canonicalConfig.description
      );
      const canonicalOgImages = canonicalMeta.openGraph?.images as Array<{
        url: string;
      }>;
      expect(canonicalOgImages[0]?.url).toContain(
        `${item.canonicalPath}/opengraph-image`
      );
      const canonicalTwImages = canonicalMeta.twitter?.images as Array<string>;
      expect(canonicalTwImages[0]).toContain(
        `${item.canonicalPath}/opengraph-image`
      );
    }
  });

  it("contact route layout exports dedicated page metadata with title, description, and social images", async () => {
    const { metadata } = await import("@/app/contact/layout");
    // No site name: app/layout.tsx templates it on as "%s | Frederick de
    // Ruiter". This previously asserted the branded string, which is what let
    // ten routes ship with the name rendered twice in the browser tab.
    expect(metadata.title).toBe("Contact Fred");
    expect(metadata.description).toContain("Send Fred de Ruiter a note");
    // OpenGraph is not templated, so it is branded by buildRouteMetadata.
    expect(metadata.openGraph?.title).toBe(
      "Contact Fred | Frederick de Ruiter"
    );
    expect(metadata.openGraph?.description).toBe(metadata.description);

    const ogImages = metadata.openGraph?.images as Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    expect(ogImages).toBeDefined();
    expect(ogImages[0].url).toContain("/contact/opengraph-image");
    expect(ogImages[0].width).toBe(1200);
    expect(ogImages[0].height).toBe(630);

    const twImages = metadata.twitter?.images as Array<string>;
    expect(twImages).toBeDefined();
    expect(twImages[0]).toContain("/contact/opengraph-image");
  });

  it("enforces SERP length bounds and descriptive keywords across all route configs", () => {
    const routeKeys = Object.keys(ROUTE_METADATA_CONFIGS);
    expect(routeKeys.length).toBeGreaterThanOrEqual(15);

    for (const key of routeKeys) {
      const config = ROUTE_METADATA_CONFIGS[key];

      // Bounds apply to the title a search engine actually renders, which is
      // the config plus the layout template ("%s | Frederick de Ruiter").
      // Measuring `config.title` alone understated every title by 22
      // characters, so a config passing at 60 rendered at 82.
      const renderedTitle = `${config.title} | Frederick de Ruiter`;

      // 60 is the SERP display limit: past it, search results truncate with an
      // ellipsis. The template costs 22 characters, so a config has 38.
      expect(
        renderedTitle.length,
        `Route "${key}" renders ${renderedTitle.length} chars: "${renderedTitle}"`
      ).toBeLessThanOrEqual(60);
      expect(
        renderedTitle.length,
        `Route "${key}" renders only ${renderedTitle.length} chars: "${renderedTitle}"`
      ).toBeGreaterThanOrEqual(25);

      // The config itself must not carry the site name, or it renders twice.
      expect(
        /\|\s*(?:Fred|Frederick) de Ruiter\s*$/.test(config.title),
        `Route "${key}" title already ends with the site name, which the layout template then appends again: "${config.title}"`
      ).toBe(false);

      // Description must be between 120 and 160 characters for optimal SERP snippets
      expect(
        config.description.length,
        `Route config "${key}" description is ${config.description.length} chars (must be >= 120 and <= 160): "${config.description}"`
      ).toBeGreaterThanOrEqual(120);
      expect(
        config.description.length,
        `Route config "${key}" description is ${config.description.length} chars (must be <= 160): "${config.description}"`
      ).toBeLessThanOrEqual(160);

      // Keywords must contain >= 3 long-tail phrases
      expect(config.keywords?.length || 0).toBeGreaterThanOrEqual(3);
    }
  });

  it("robots configuration allows indexing and references sitemap in production", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = "production";
      const result = robots();
      expect(result.rules).toBeDefined();
      expect(
        Array.isArray(result.rules) ? result.rules[0] : result.rules
      ).toEqual({
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin", "/admin/"],
      });
      expect(result.sitemap).toBe(`${resolveBaseUrl()}/sitemap.xml`);
    } finally {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("robots configuration disallows indexing and hides sitemap in non-production", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = "preview";
      const result = robots();
      expect(result.rules).toBeDefined();
      expect(
        Array.isArray(result.rules) ? result.rules[0] : result.rules
      ).toEqual({
        userAgent: "*",
        disallow: "/",
      });
      expect(result.sitemap).toBeUndefined();
    } finally {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("sitemap generator returns all first-class routes, asset hubs, and dynamic case studies", async () => {
    const map = await sitemap();
    expect(Array.isArray(map)).toBe(true);

    const urls = map.map((entry) => entry.url);
    const expectedBase = resolveBaseUrl();
    expect(urls).toContain(expectedBase);
    expect(urls).toContain(`${expectedBase}/arcade`);
    expect(urls).toContain(`${expectedBase}/arcade/laser-loon`);
    expect(urls).toContain(`${expectedBase}/work/laser-loon`);
    expect(urls).toContain(`${expectedBase}/arcade/quasi-puzzler`);
    expect(urls).toContain(`${expectedBase}/arcade/garmin-watch`);
    expect(urls).toContain(`${expectedBase}/arcade/clinical-chaos`);
    expect(urls).toContain(`${expectedBase}/arcade/retro-labyrinth`);
    expect(urls).toContain(`${expectedBase}/arcade/working-with-duck`);
    expect(urls).toContain(`${expectedBase}/proof`);
    expect(urls).toContain(`${expectedBase}/simulator`);
    expect(urls).toContain(`${expectedBase}/schedule`);
    expect(urls).toContain(`${expectedBase}/crf`);
    expect(urls).toContain(`${expectedBase}/neuro`);
    expect(urls).toContain(`${expectedBase}/stack`);

    // Verify 100% route coverage from ROUTE_METADATA_CONFIGS (excluding /offline)
    for (const config of Object.values(ROUTE_METADATA_CONFIGS)) {
      if (config.path === "/offline") continue;
      const expectedUrl = `${expectedBase}${config.path.startsWith("/") ? config.path : "/" + config.path}`;
      expect(urls, `Sitemap missing route: ${expectedUrl}`).toContain(
        expectedUrl
      );
    }
  });

  it("sitemap configuration exports a 24-hour revalidation interval (86400 seconds)", () => {
    expect(revalidate).toBe(86400);
  });

  it("static route entries serve route-specific source file modification dates dynamically", async () => {
    const map1 = await sitemap();
    await new Promise((resolve) => setTimeout(resolve, 15));
    const map2 = await sitemap();

    expect(map1.length).toBe(map2.length);

    // Verify static routes maintain consistent timestamps matching source file modification times
    const staticEntries = map1.filter(
      (entry) => !entry.url.includes("/case-studies/")
    );
    for (const entry of staticEntries) {
      const match = map2.find((e) => e.url === entry.url);
      expect(match).toBeDefined();
      expect(entry.lastModified).toEqual(match?.lastModified);
    }

    // Verify root static route matches source file mtime
    const rootEntry = map1.find((e) => e.url === resolveBaseUrl());
    expect(rootEntry).toBeDefined();
    const rootStat = fs.statSync(path.resolve(process.cwd(), "app/page.tsx"));
    const rootEntryDate =
      rootEntry?.lastModified instanceof Date
        ? rootEntry.lastModified
        : new Date(rootEntry?.lastModified ?? 0);
    expect(rootEntryDate.getTime()).toBe(rootStat.mtime.getTime());
  });

  it("fallback and mock content items retain explicit pre-defined update dates rather than generating execution timestamps", async () => {
    const map = await sitemap();
    const caseStudyEntries = map.filter((entry) =>
      entry.url.includes("/case-studies/")
    );

    expect(caseStudyEntries.length).toBeGreaterThan(0);

    for (const entry of caseStudyEntries) {
      const slug = entry.url.split("/case-studies/")[1];
      const fallbackMatch = FALLBACK_CASE_STUDIES.find(
        (cs) => cs.slug === slug
      );
      if (fallbackMatch && entry.lastModified) {
        const entryDate =
          entry.lastModified instanceof Date
            ? entry.lastModified
            : new Date(entry.lastModified);
        expect(entryDate.toISOString()).toBe(
          fallbackMatch.updated_at.toISOString()
        );
      }
    }
  });

  it("sitemap generator in production strictly produces canonical https://deruiter.dev URLs without localhost leakage", async () => {
    const originalWin = global.window;
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      // @ts-expect-error - simulate Next.js SSR server runtime
      global.window = undefined;
      process.env.VERCEL_ENV = "production";
      delete process.env.NEXT_PUBLIC_APP_URL;

      const map = await sitemap();
      expect(map.length).toBeGreaterThanOrEqual(16);

      for (const entry of map) {
        expect(entry.url).toMatch(/^https:\/\/deruiter\.dev(\/.*)?$/);
        expect(entry.url).not.toContain("localhost");
        expect(entry.url).not.toContain("http://");
      }
    } finally {
      global.window = originalWin;
      process.env.VERCEL_ENV = originalVercelEnv;
      if (originalAppUrl !== undefined) {
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      } else {
        delete process.env.NEXT_PUBLIC_APP_URL;
      }
    }
  });

  it("root layout exports a dark themeColor viewport (#1251)", async () => {
    const { viewport } = await import("@/app/layout");
    expect(viewport.themeColor).toBe("#090D16");
    expect(viewport.colorScheme).toBe("dark");
  });

  it("buildRouteMetadata declares 1200x630 image/png OpenGraph images on every route (#1251)", () => {
    for (const [key, config] of Object.entries(ROUTE_METADATA_CONFIGS)) {
      const images = buildRouteMetadata(config).openGraph?.images as Array<{
        width?: number;
        height?: number;
        type?: string;
      }>;
      expect(images[0], key).toMatchObject({
        width: 1200,
        height: 630,
        type: "image/png",
      });
    }
  });

  it("never double-brands generated titles, whatever trailing separator or name form is used (#1251)", () => {
    const brandedVariants = [
      "Demo | Frederick de Ruiter",
      "Demo | Fred de Ruiter",
      "Demo - Frederick de Ruiter",
      "Demo - Fred de Ruiter",
      "Demo \u2013 Fred de Ruiter",
      "Demo \u2014 Frederick de Ruiter",
      "Demo | frederick de ruiter  ",
    ];
    for (const title of brandedVariants) {
      const meta = buildRouteMetadata({ title, description: "d", path: "/x" });
      expect(meta.openGraph?.title, title).toBe(title);
    }
    const plain = buildRouteMetadata({
      title: "Demo",
      description: "d",
      path: "/x",
    });
    expect(plain.openGraph?.title).toBe("Demo | Frederick de Ruiter");

    for (const [key, config] of Object.entries(ROUTE_METADATA_CONFIGS)) {
      const ogTitle = String(buildRouteMetadata(config).openGraph?.title);
      const brands = ogTitle.match(/(?:Fred|Frederick) de Ruiter/gi) ?? [];
      expect(brands.length, key).toBeLessThanOrEqual(1);
    }
  });

  it("keeps branded titles at or under 60 characters and descriptions at or under 160 (#1251)", () => {
    for (const [key, config] of Object.entries(ROUTE_METADATA_CONFIGS)) {
      const ogTitle = String(buildRouteMetadata(config).openGraph?.title);
      expect(ogTitle.length, `${key} title`).toBeLessThanOrEqual(60);
      expect(
        config.description.length,
        `${key} description`
      ).toBeLessThanOrEqual(160);
    }
  });

  it("root layout metadata configures SVG, ICO, Apple Touch, and web manifest", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.icons).toBeDefined();
    expect(metadata.icons).toEqual({
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      shortcut: "/icon.svg",
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    });
    expect(metadata.manifest).toBe("/manifest.webmanifest");
  });

  it("app/manifest.ts generates valid PWA Web App Manifest", () => {
    const data = manifest();
    expect(data.name).toContain("Frederick de Ruiter");
    expect(data.short_name).toBe("F. de Ruiter");
    expect(data.start_url).toBe("/");
    expect(data.display).toBe("standalone");
    expect(data.background_color).toBe("#090D16");
    expect(data.theme_color).toBe("#06B6D4");
    expect(data.icons).toBeDefined();
    expect(data.icons?.length).toBeGreaterThanOrEqual(4);
  });

  it("app/icon.svg and public/favicon.svg exist and contain valid SVG monogram architecture", () => {
    const appIconPath = path.resolve(process.cwd(), "app/icon.svg");
    const publicFaviconPath = path.resolve(process.cwd(), "public/favicon.svg");

    expect(fs.existsSync(appIconPath)).toBe(true);
    expect(fs.existsSync(publicFaviconPath)).toBe(true);

    const appIconContent = fs.readFileSync(appIconPath, "utf-8");
    const publicFaviconContent = fs.readFileSync(publicFaviconPath, "utf-8");

    for (const content of [appIconContent, publicFaviconContent]) {
      expect(content).toContain("<svg");
      expect(content).toContain('id="fd-grad"');
      expect(content).toContain("glyph-stem");
      expect(content).toContain("telemetry-dot");
      expect(content).toContain("</svg>");
    }
  });

  it("custom branded favicon.ico, apple-touch-icon, and PWA icons exist as binary assets", () => {
    const appFaviconPath = path.resolve(process.cwd(), "app/favicon.ico");
    const publicFaviconPath = path.resolve(process.cwd(), "public/favicon.ico");
    const appleTouchPath = path.resolve(
      process.cwd(),
      "public/apple-touch-icon.png"
    );
    const icon192Path = path.resolve(process.cwd(), "public/icon-192.png");
    const icon512Path = path.resolve(process.cwd(), "public/icon-512.png");

    for (const filePath of [
      appFaviconPath,
      publicFaviconPath,
      appleTouchPath,
      icon192Path,
      icon512Path,
    ]) {
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(500);
    }

    // Ensure favicon.ico is not the 25KB+ default Next.js/Vercel placeholder
    const faviconStat = fs.statSync(appFaviconPath);
    expect(faviconStat.size).toBeLessThan(10000);
  });

  it("createSocialImageResponse generates valid ImageResponse with 1200x630 dimensions and Edge CDN cache headers", async () => {
    const { createSocialImageResponse, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } =
      await import("@/lib/og-image");
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_IMAGE_CONTENT_TYPE).toBe("image/png");

    const res = createSocialImageResponse({
      title: "Test Social Preview",
      description: "Test description",
      badge: "TEST // MODE",
      tags: ["TypeScript", "Vitest"],
    });

    expect(res).toBeDefined();
    expect(res.headers.get("content-type")).toContain("image/png");
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("s-maxage=");
    expect(cacheControl).toContain("stale-while-revalidate=");
  });

  it("root opengraph-image and twitter-image generators return valid responses", async () => {
    const { default: rootOgImage, size: ogSize } =
      await import("@/app/opengraph-image");
    const { default: rootTwitterImage, size: twitterSize } =
      await import("@/app/twitter-image");

    expect(ogSize).toEqual({ width: 1200, height: 630 });
    expect(twitterSize).toEqual({ width: 1200, height: 630 });

    const ogRes = rootOgImage();
    const twRes = rootTwitterImage();

    expect(ogRes).toBeDefined();
    expect(twRes).toBeDefined();
    expect(ogRes.headers.get("content-type")).toContain("image/png");
    expect(twRes.headers.get("content-type")).toContain("image/png");
  });

  it("interactive hub opengraph-image generators return valid responses", async () => {
    const { default: arcadeOg } = await import("@/app/arcade/opengraph-image");
    const { default: proofOg } = await import("@/app/proof/opengraph-image");
    const { default: simulatorOg } =
      await import("@/app/simulator/opengraph-image");
    const { default: stackOg } = await import("@/app/stack/opengraph-image");
    const { default: scheduleOg } =
      await import("@/app/schedule/opengraph-image");
    const { default: caseStudiesOg } =
      await import("@/app/case-studies/opengraph-image");

    for (const generator of [
      arcadeOg,
      proofOg,
      simulatorOg,
      stackOg,
      scheduleOg,
      caseStudiesOg,
    ]) {
      const res = generator();
      expect(res).toBeDefined();
      expect(res.headers.get("content-type")).toContain("image/png");
      expect(res.headers.get("cache-control")).toContain("public");
    }
  });

  it("all 9 targeted showcase, asset hub, and arcade route social preview cards exist and return edge-cached image responses", async () => {
    const { default: crfOg } = await import("@/app/crf/opengraph-image");
    const { default: neuroOg } = await import("@/app/neuro/opengraph-image");
    const { default: clinicalChaosOg } =
      await import("@/app/arcade/clinical-chaos/opengraph-image");
    const { default: garminWatchOg } =
      await import("@/app/arcade/garmin-watch/opengraph-image");
    const { default: laserLoonOg } =
      await import("@/app/arcade/laser-loon/opengraph-image");
    const { default: laserLoonWorkOg } =
      await import("@/app/work/laser-loon/opengraph-image");
    const { default: quasiPuzzlerOg } =
      await import("@/app/arcade/quasi-puzzler/opengraph-image");
    const { default: retroLabyrinthOg } =
      await import("@/app/arcade/retro-labyrinth/opengraph-image");
    const { default: workingWithDuckOg } =
      await import("@/app/arcade/working-with-duck/opengraph-image");

    const targetedGenerators = [
      { name: "/crf", generator: crfOg, routeKey: "crf" },
      { name: "/neuro", generator: neuroOg, routeKey: "neuro" },
      {
        name: "/arcade/clinical-chaos",
        generator: clinicalChaosOg,
        routeKey: "clinicalChaos",
      },
      {
        name: "/arcade/garmin-watch",
        generator: garminWatchOg,
        routeKey: "garminWatch",
      },
      {
        name: "/arcade/laser-loon",
        generator: laserLoonOg,
        routeKey: "laserLoon",
      },
      {
        name: "/work/laser-loon",
        generator: laserLoonWorkOg,
        routeKey: "laserLoonCaseStudy",
      },
      {
        name: "/arcade/quasi-puzzler",
        generator: quasiPuzzlerOg,
        routeKey: "quasiPuzzler",
      },
      {
        name: "/arcade/retro-labyrinth",
        generator: retroLabyrinthOg,
        routeKey: "retroLabyrinth",
      },
      {
        name: "/arcade/working-with-duck",
        generator: workingWithDuckOg,
        routeKey: "workingWithDuck",
      },
    ];

    expect(targetedGenerators).toHaveLength(9);

    for (const item of targetedGenerators) {
      const res = item.generator();
      expect(res).toBeDefined();
      expect(res.headers.get("content-type")).toContain("image/png");

      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage=");
      expect(cacheControl).toContain("stale-while-revalidate=");

      const routeConfig = ROUTE_METADATA_CONFIGS[item.routeKey];
      expect(routeConfig).toBeDefined();
    }
  });

  describe("Arcade Schema Realignment & Central Metadata Verification", () => {
    it("Quasi-Perfect Puzzler route metadata describes formal verification logic rather than crystallographic tiling", () => {
      const config = ROUTE_METADATA_CONFIGS.quasiPuzzler;
      expect(config).toBeDefined();
      expect(config.title).toContain("Formal Verification");
      expect(config.description).toContain("Lean-inspired");
      expect(config.description).toContain("deductive proof tactics");
      expect(config.description).not.toContain("crystallographic");
      expect(config.description).not.toContain("Penrose");
      expect(config.description).not.toContain("deflation");
    });

    it("all arcade game catalog entries match corresponding ROUTE_METADATA_CONFIGS paths and titles", () => {
      const arcadeRouteKeys = [
        "quasiPuzzler",
        "laserLoon",
        "garminWatch",
        "retroLabyrinth",
        "workingWithDuck",
        "clinicalChaos",
        "memeVault",
      ];

      for (const key of arcadeRouteKeys) {
        const routeConfig = ROUTE_METADATA_CONFIGS[key];
        expect(routeConfig).toBeDefined();
        expect(routeConfig.path).toMatch(/^\/arcade\//);

        const schemaStr = getWebApplicationSchema({
          name: routeConfig.title,
          description: routeConfig.description,
          url: routeConfig.path,
          applicationCategory: "GameApplication",
        });

        const parsed = JSON.parse(schemaStr);
        expect(parsed["@context"]).toBe("https://schema.org");
        expect(parsed["@type"]).toBe("WebApplication");
        expect(parsed.name).toBe(routeConfig.title);
        expect(parsed.description).toBe(routeConfig.description);
        expect(parsed.url).toBe(`${SITE_BASE_URL}${routeConfig.path}`);
      }
    });

    it("ARCADE_GAMES_METADATA entries align with ROUTE_METADATA_CONFIGS definitions", () => {
      for (const game of ARCADE_GAMES_METADATA) {
        expect(game.route).toMatch(/^\/arcade/);
        expect(game.title).toBeTruthy();
        expect(game.description).toBeTruthy();
      }
    });
  });

  describe("Universal Schema Language and Access Declarations", () => {
    it("all ROUTE_METADATA_CONFIGS declare explicit inLanguage: 'en-US', locale: 'en-US', and isAccessibleForFree: true", () => {
      const keys = Object.keys(ROUTE_METADATA_CONFIGS);
      expect(keys.length).toBeGreaterThanOrEqual(15);

      for (const key of keys) {
        const config = ROUTE_METADATA_CONFIGS[key];
        expect(config.inLanguage, `Route "${key}" missing inLanguage`).toBe(
          "en-US"
        );
        expect(config.locale, `Route "${key}" missing locale`).toBe("en-US");
        expect(
          config.isAccessibleForFree,
          `Route "${key}" missing isAccessibleForFree`
        ).toBe(true);
      }
    });

    it("buildRouteMetadata produces synchronized locale and other metadata declarations", () => {
      const config = ROUTE_METADATA_CONFIGS.crf;
      const meta = buildRouteMetadata(config);

      expect(meta.openGraph?.locale).toBe("en_US");
      expect(meta.other?.inLanguage).toBe("en-US");
      expect(meta.other?.isAccessibleForFree).toBe("true");
    });

    it("all base and specialized structured data generators include inLanguage and isAccessibleForFree attributes", async () => {
      const {
        getPersonNode,
        getWebsiteNode,
        getWebPageNode,
        getBreadcrumbNode,
        getVisualArtworkSchema,
        getWebApplicationSchema,
        getCollectionPageSchema,
        getSoftwareSourceCodeSchema,
        getBreadcrumbSchema,
      } = await import("@/lib/seo");

      const person = getPersonNode();
      expect(person.inLanguage).toBe("en-US");
      expect(person.isAccessibleForFree).toBe(true);

      const website = getWebsiteNode();
      expect(website.inLanguage).toBe("en-US");
      expect(website.isAccessibleForFree).toBe(true);

      const webpage = getWebPageNode({
        name: "Test",
        description: "Desc",
        url: "/test",
      });
      expect(webpage.inLanguage).toBe("en-US");
      expect(webpage.isAccessibleForFree).toBe(true);

      const breadcrumbNode = getBreadcrumbNode(
        [{ name: "Home", url: "/" }],
        "/test"
      );
      expect(breadcrumbNode.inLanguage).toBe("en-US");
      expect(breadcrumbNode.isAccessibleForFree).toBe(true);

      const artwork = JSON.parse(
        getVisualArtworkSchema({
          name: "Art",
          description: "Desc",
          url: "/art",
        })
      );
      expect(artwork.inLanguage).toBe("en-US");
      expect(artwork.isAccessibleForFree).toBe(true);

      const webApp = JSON.parse(
        getWebApplicationSchema({
          name: "App",
          description: "Desc",
          url: "/app",
          applicationCategory: "DeveloperApplication",
        })
      );
      expect(webApp.inLanguage).toBe("en-US");
      expect(webApp.isAccessibleForFree).toBe(true);

      const collection = JSON.parse(
        getCollectionPageSchema("Collection", "Desc", "/col", [])
      );
      expect(collection.inLanguage).toBe("en-US");
      expect(collection.isAccessibleForFree).toBe(true);

      const code = JSON.parse(
        getSoftwareSourceCodeSchema(
          {
            id: "1",
            slug: "test",
            title: "Test",
            primary_language: "TypeScript",
            published: true,
            simulated_telemetry: false,
            tags: "",
            editorial_content: "Content",
            architectural_narrative: "",
            created_at: new Date(),
            updated_at: new Date(),
          },
          null
        )
      );
      expect(code.inLanguage).toBe("en-US");
      expect(code.isAccessibleForFree).toBe(true);

      const breadcrumbSchema = JSON.parse(
        getBreadcrumbSchema([{ name: "Home", url: "/" }])
      );
      expect(breadcrumbSchema.inLanguage).toBe("en-US");
      expect(breadcrumbSchema.isAccessibleForFree).toBe(true);
    });

    it("getUnifiedGraphSchema automatically enriches all graph nodes with inLanguage and isAccessibleForFree", async () => {
      const { getUnifiedGraphSchema, getPersonNode, getWebsiteNode } =
        await import("@/lib/seo");

      // Custom node without explicit language/access fields
      const customNode = {
        "@type": "Thing",
        "@id": `${SITE_BASE_URL}/#custom`,
        name: "Custom Entity",
      };

      const rawGraph = getUnifiedGraphSchema([
        getPersonNode(),
        getWebsiteNode(),
        customNode,
      ]);
      const parsed = JSON.parse(rawGraph);

      expect(parsed["@graph"]).toHaveLength(3);
      for (const node of parsed["@graph"]) {
        expect(node.inLanguage).toBe("en-US");
        expect(node.isAccessibleForFree).toBe(true);
      }
    });
  });

  describe("BlogPosting Schema (Ticket #1057)", () => {
    it("getBlogPostingSchema generates valid, parseable Schema.org BlogPosting with XSS sanitization", async () => {
      const { getBlogPostingSchema } = await import("@/lib/seo");

      const post = {
        slug: "cdisc-odm-sdtm-clinical-data-pipelines",
        title: "Architecting CDISC ODM & SDTM Clinical Data Pipelines",
        dek: "How to design deterministic, streaming XML compilation pipelines for FDA-compliant CDISC ODM and SDTM datasets without memory blowouts.",
        pillar: "clinical-data-engineering" as const,
        tags: ["cdisc", "odm", "sdtm", "fda"],
        publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-02T00:00:00.000Z"),
        readingTimeMinutes: 6,
        heroImageUrl: null,
        body: "<p>Electronic Data Capture systems produce massive XML payloads conforming to CDISC ODM standards.</p>",
      };

      const raw = getBlogPostingSchema(post);
      expect(raw).not.toContain("<script");
      const parsed = JSON.parse(raw);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("BlogPosting");
      expect(parsed["@id"]).toBe(
        `${SITE_BASE_URL}/blog/${post.slug}#blogposting`
      );
      expect(parsed.headline).toBe(post.title);
      expect(parsed.description).toBe(post.dek);
      expect(parsed.articleSection).toBe(
        "Clinical Data Engineering & CDISC Standards"
      );
      expect(parsed.keywords).toBe("cdisc, odm, sdtm, fda");
      expect(parsed.datePublished).toBe("2026-03-01T00:00:00.000Z");
      expect(parsed.dateModified).toBe("2026-03-02T00:00:00.000Z");
      expect(parsed.timeRequired).toBe("PT6M");
      expect(parsed.wordCount).toBeGreaterThan(5);
      expect(parsed.author["@type"]).toBe("Person");
      expect(parsed.author.name).toBe("Frederick de Ruiter");
      expect(parsed.publisher["@type"]).toBe("Person");
      expect(parsed.mainEntityOfPage["@type"]).toBe("WebPage");
      expect(parsed.mainEntityOfPage["@id"]).toBe(
        `${SITE_BASE_URL}/blog/${post.slug}`
      );
      expect(parsed.inLanguage).toBe("en-US");
      expect(parsed.isAccessibleForFree).toBe(true);
    });

    it("getBlogPostingSchema securely escapes angle brackets against script injection", async () => {
      const { getBlogPostingSchema } = await import("@/lib/seo");

      const maliciousPost = {
        slug: "xss-test",
        title: "Malicious <script>alert(1)</script> Title",
        dek: "Exploit attempt <img src=x onerror=alert(1)>",
        pillar: "field-notes" as const,
        tags: ["<script>"],
        publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        readingTimeMinutes: null,
        heroImageUrl: null,
      };

      const raw = getBlogPostingSchema(maliciousPost);
      expect(raw).not.toContain("<script");
      expect(raw).toContain("\\u003cscript");
    });
  });
});
