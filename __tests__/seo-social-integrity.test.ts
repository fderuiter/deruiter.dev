// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ENGINEERING_BRIDGES } from "@/lib/engineering-bridges";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { resolveBaseUrl } from "@/lib/domain";
import { OG_IMAGE_MAX_BYTES, OG_IMAGE_SIZE } from "@/lib/og-image";
import { SITE_BASE_URL } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

/**
 * Resolves the canonical production base URL via `resolveBaseUrl()` without
 * mutating `process.env` outside this helper.
 */
function resolveCanonicalManifestBaseUrl(): string {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  try {
    return resolveBaseUrl();
  } finally {
    vi.unstubAllEnvs();
  }
}

/**
 * Extracts complete URL tokens from a markdown/text manifest, stripping only
 * trailing sentence punctuation so userinfo, ports, paths, and query strings
 * remain attached to a single token.
 */
function extractManifestUrls(manifest: string): string[] {
  const matches = manifest.match(/https?:\/\/[^\s)>]+/gi) ?? [];
  return matches.map((token) => token.replace(/[.,;]+$/, ""));
}

/**
 * Enforces HTTPS, empty userinfo, empty port, and an exact origin/hostname
 * match against the canonical base URL or GitHub (`https://github.com`).
 */
function isAllowedManifestUrl(
  rawUrl: string,
  canonicalBaseUrl: string = resolveCanonicalManifestBaseUrl()
): boolean {
  try {
    const parsed = new URL(rawUrl);
    const canonical = new URL(canonicalBaseUrl);

    if (parsed.protocol !== "https:") return false;
    if (parsed.username !== "" || parsed.password !== "") return false;
    if (parsed.port !== "") return false;

    const isCanonicalOrigin =
      canonical.protocol === "https:" &&
      parsed.hostname === canonical.hostname &&
      parsed.origin === canonical.origin;
    const isGitHubOrigin =
      parsed.hostname === "github.com" &&
      parsed.origin === "https://github.com";

    return isCanonicalOrigin || isGitHubOrigin;
  } catch {
    return false;
  }
}

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

  it("points every URL in both manifests at the canonical domain or GitHub", () => {
    expect(SITE_BASE_URL).toBe(resolveBaseUrl());
    const canonicalBaseUrl = resolveCanonicalManifestBaseUrl();
    expect(canonicalBaseUrl).toBe("https://deruiter.dev");

    for (const manifest of [llms, full]) {
      const urls = extractManifestUrls(manifest);
      expect(urls.length).toBeGreaterThan(0);
      const foreign = urls.filter(
        (url) => !isAllowedManifestUrl(url, canonicalBaseUrl)
      );
      expect(foreign).toEqual([]);
    }
  });

  it("extractManifestUrls preserves full URL tokens and strips trailing sentence punctuation", () => {
    const sample = [
      "Canonical origin: https://deruiter.dev.",
      "Index: [llms](https://deruiter.dev/llms.txt).",
      "Nested query: https://evil.invalid/?ref=https://deruiter.dev,",
      "Nested path: <https://evil.invalid/https://github.com/fderuiter>;",
      "Userinfo: https://github.com@evil.invalid/ and port https://deruiter.dev:8443/path.",
    ].join(" ");

    const extracted = extractManifestUrls(sample);
    expect(extracted).toEqual([
      "https://deruiter.dev",
      "https://deruiter.dev/llms.txt",
      "https://evil.invalid/?ref=https://deruiter.dev",
      "https://evil.invalid/https://github.com/fderuiter",
      "https://github.com@evil.invalid/",
      "https://deruiter.dev:8443/path",
    ]);

    const rejected = extracted.filter((url) => !isAllowedManifestUrl(url));
    expect(rejected).toEqual([
      "https://evil.invalid/?ref=https://deruiter.dev",
      "https://evil.invalid/https://github.com/fderuiter",
      "https://github.com@evil.invalid/",
      "https://deruiter.dev:8443/path",
    ]);
  });

  it.each([
    "https://deruiter.dev",
    "https://deruiter.dev/clinical",
    "https://github.com/fderuiter/deruiter.dev",
    "HTTPS://DERUITER.DEV/proof",
    "https://GitHub.com/fderuiter/deruiter.dev",
  ])("isAllowedManifestUrl accepts %s", (candidate) => {
    expect(isAllowedManifestUrl(candidate)).toBe(true);
  });

  it.each([
    // Suffix lookalikes
    "https://github.com.evil.invalid/repo",
    "https://deruiter.dev.evil.invalid/clinical",
    // Subdomain and prefix lookalikes
    "https://www.deruiter.dev/",
    "https://sub.github.com/",
    "https://evil-github.com/",
    // Userinfo / embedded credentials
    "https://github.com@evil.invalid/",
    "https://user:pass@deruiter.dev/",
    "https://user@github.com/",
    // Query and path mentions of trusted origins
    "https://evil.invalid/?ref=https://deruiter.dev",
    "https://evil.invalid/https://github.com/fderuiter",
    // Unintended ports
    "https://deruiter.dev:8443/",
    "https://github.com:8080/",
    // Protocol variants
    "http://deruiter.dev/",
    "http://github.com/fderuiter",
    "javascript:alert(1)",
    "ftp://deruiter.dev/",
    // Malformed and relative inputs
    "https://",
    "not-a-url",
    "/clinical",
    "//github.com/fderuiter",
  ])("isAllowedManifestUrl rejects %s", (candidate) => {
    expect(isAllowedManifestUrl(candidate)).toBe(false);
  });

  it("isAllowedManifestUrl rejects non-https canonical bases", () => {
    expect(
      isAllowedManifestUrl("http://localhost:3000/clinical", "http://localhost:3000")
    ).toBe(false);
    expect(
      isAllowedManifestUrl("https://localhost/clinical", "http://localhost:3000")
    ).toBe(false);
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
