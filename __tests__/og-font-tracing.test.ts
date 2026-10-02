// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = process.cwd();

/** Minimal route-glob matcher: "**" spans segments, everything else is literal. */
function globMatcher(glob: string): (route: string) => boolean {
  const pattern = glob
    .split("**")
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const re = new RegExp(`^${pattern}$`);
  return (route) => re.test(route);
}

function metadataImageRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/^(opengraph|twitter)-image\.tsx?$/.test(entry.name)) {
        const rel = path.relative(path.join(root, "app"), dir);
        routes.push(
          "/" +
            [
              ...rel.split(path.sep).filter(Boolean),
              entry.name.split(".")[0],
            ].join("/")
        );
      }
    }
  };
  walk(path.join(root, "app"));
  return routes;
}

describe("OG asset file tracing (#1674)", () => {
  const source = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  const globs = [...source.matchAll(/^\s+"(\/[^"]*image)",$/gm)].map(
    (m) => m[1]
  );

  it("declares outputFileTracingIncludes for the og-fonts assets", () => {
    expect(source).toContain("outputFileTracingIncludes");
    expect(source).toContain("./assets/og-fonts/**/*");
    expect(source).toContain("./public/og/**/*");
  });

  it("covers every opengraph-image and twitter-image route", () => {
    const routes = metadataImageRoutes();
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain("/case-studies/[slug]/opengraph-image");
    const matchers = globs.map((g) => globMatcher(g));
    for (const route of routes) {
      expect(
        matchers.some((m) => m(route)),
        route
      ).toBe(true);
    }
  });
});

describe("OG font failure fallback (#1674)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("node:fs");
  });

  async function loadWithBrokenFs() {
    vi.resetModules();
    vi.doMock("node:fs", async (orig) => {
      const actual = await orig<typeof import("node:fs")>();
      const readFileSync = () => {
        throw new Error("ENOENT: no such file");
      };
      return { ...actual, default: { ...actual, readFileSync }, readFileSync };
    });
    const logger = (await import("@/lib/logger")).logger;
    const errorSpy = vi.spyOn(logger, "error").mockReturnValue({} as never);
    const og = await import("@/lib/og-image");
    return { og, errorSpy };
  }

  it("redirects to a static PNG instead of throwing, logging once", async () => {
    const { og, errorSpy } = await loadWithBrokenFs();
    const first = og.createSocialImageResponse({ title: "Hi" });
    const second = og.createSocialImageResponse({ title: "Hi" });
    for (const res of [first, second]) {
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(og.OG_FALLBACK_IMAGE_PATH);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(
      fs.existsSync(path.join(root, "public", og.OG_FALLBACK_IMAGE_PATH))
    ).toBe(true);
  });

  it("keeps returning an image response when fonts load", async () => {
    vi.resetModules();
    const og = await import("@/lib/og-image");
    const res = og.createSocialImageResponse({ title: "Hi" });
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
