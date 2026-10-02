// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  return import("@/lib/build-integrity");
}

describe("failBuildOnDataSourceError", () => {
  it("aborts a production build when a data source is unreachable", async () => {
    // Reproduction of the 2026-09-18 case: the database was four migrations
    // behind, so every CaseStudy query failed on a missing hero_image_url
    // column. The build substituted fallbacks and exited 0, which would have
    // published a deployment whose case studies did not reflect the database.
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { failBuildOnDataSourceError, DataSourceUnavailableError } =
      await load();

    expect(() =>
      failBuildOnDataSourceError(
        "CaseStudyService.getAllPublishedCaseStudies",
        new Error("column CaseStudy.hero_image_url does not exist")
      )
    ).toThrow(DataSourceUnavailableError);
  });

  it("names the failing source and the underlying cause", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { failBuildOnDataSourceError } = await load();

    try {
      failBuildOnDataSourceError(
        "BlogPostService.getAllPublishedBlogPosts",
        new Error('relation "BlogPost" does not exist')
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain("BlogPostService.getAllPublishedBlogPosts");
      expect(err.message).toContain('relation "BlogPost" does not exist');
    }
  });

  it("does not affect a running production server", async () => {
    // A suspended Neon compute must still serve fallback content rather than
    // erroring, per AGENTS.md section 22.
    vi.stubEnv("VERCEL_ENV", "production");
    const { failBuildOnDataSourceError } = await load();

    expect(() =>
      failBuildOnDataSourceError("AnyService.read", new Error("timeout"))
    ).not.toThrow();
  });

  it("does not affect non-production builds", async () => {
    // Local builds and CI runs without a database are expected to fall back.
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("VERCEL_ENV", "preview");
    const { failBuildOnDataSourceError } = await load();

    expect(() =>
      failBuildOnDataSourceError("AnyService.read", new Error("offline"))
    ).not.toThrow();
  });

  it("does not affect the end-to-end harness", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST", "true");
    const { failBuildOnDataSourceError } = await load();

    expect(() =>
      failBuildOnDataSourceError("AnyService.read", new Error("offline"))
    ).not.toThrow();
  });
});

describe("emergency override", () => {
  it("continues the build when ALLOW_FALLBACK_PRODUCTION_BUILD=1, and says so loudly", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("ALLOW_FALLBACK_PRODUCTION_BUILD", "1");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { failBuildOnDataSourceError } = await load();

    expect(() =>
      failBuildOnDataSourceError("AnyService.read", new Error("offline"))
    ).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("will not reflect the database");
    spy.mockRestore();
  });

  it('ignores any value other than exactly "1"', async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("ALLOW_FALLBACK_PRODUCTION_BUILD", "true");
    const { failBuildOnDataSourceError } = await load();

    expect(() =>
      failBuildOnDataSourceError("AnyService.read", new Error("offline"))
    ).toThrow();
  });
});

describe("guard coverage", () => {
  it("guards every database fallback in the content services", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const root = process.cwd();

    for (const service of [
      "lib/services/blog-service.ts",
      "lib/services/case-study-service.ts",
    ]) {
      const source = readFileSync(join(root, service), "utf-8");
      const dbFallbacks =
        source.match(/(Database query failed|DB query failed)/g) ?? [];
      const guards = source.match(/failBuildOnDataSourceError\(/g) ?? [];

      expect(dbFallbacks.length).toBeGreaterThan(0);
      expect(guards.length).toBeGreaterThanOrEqual(dbFallbacks.length);
    }
  });

  it("leaves cache-read fallbacks unguarded, since a cache miss is not a data-source failure", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "lib/services/case-study-service.ts"),
      "utf-8"
    );
    const cacheFallbacks = source.match(/cache read failed/g) ?? [];
    expect(cacheFallbacks.length).toBeGreaterThan(0);

    for (const m of source.matchAll(/cache read failed[\s\S]{0,400}?\n/g)) {
      expect(m[0]).not.toContain("failBuildOnDataSourceError");
    }
  });
});
