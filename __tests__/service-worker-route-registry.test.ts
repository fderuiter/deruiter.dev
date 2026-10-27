// @vitest-environment node
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

const workerCapture = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
}));

class StrategyStub {
  constructor(_options?: unknown) {}
}

vi.mock("@serwist/next/worker", () => ({ defaultCache: [] }));
vi.mock("serwist", () => ({
  CacheFirst: StrategyStub,
  ExpirationPlugin: StrategyStub,
  NetworkOnly: StrategyStub,
  Serwist: class SerwistStub {
    constructor(config: Record<string, unknown>) {
      workerCapture.config = config;
    }

    addEventListeners() {}
  },
}));

describe("service worker route registry", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    workerCapture.config = undefined;
  });

  const precachedUrls = () =>
    new Set(
      (
        workerCapture.config?.precacheEntries as
          Array<string | { url: string }> | undefined
      )?.map((entry) => (typeof entry === "string" ? entry : entry.url)) ?? []
    );

  it("precaches only the offline shell, not every public route (#3064)", async () => {
    vi.stubGlobal("self", {
      addEventListener: vi.fn(),
      __SW_MANIFEST: [
        { url: "/_next/static/chunks/abc123.js", revision: null },
        { url: "/_next/static/css/2b798d7c13c02046.css", revision: null },
        { url: "/_next/static/media/013b72fa676f92e0-s.woff2", revision: "a" },
        { url: "/files/laser-loon-assets.zip", revision: "b" },
        { url: "/models/brain-surface.glb", revision: "c" },
        { url: "/images/wedding/07-rings.jpg", revision: "d" },
      ],
    });

    await import("@/app/sw");

    const precached = precachedUrls();
    expect(precached).toContain("/_next/static/css/2b798d7c13c02046.css");
    expect(precached).toContain("/_next/static/media/013b72fa676f92e0-s.woff2");
    expect(precached).not.toContain("/_next/static/chunks/abc123.js");
    expect(precached).not.toContain("/files/laser-loon-assets.zip");
    expect(precached).not.toContain("/models/brain-surface.glb");
    expect(precached).not.toContain("/images/wedding/07-rings.jpg");
    expect(precached).not.toContain("/case-studies");
    expect(precached.size).toBeLessThanOrEqual(10);
  });

  it("precaches every page the offline fallback offers", async () => {
    vi.stubGlobal("self", { addEventListener: vi.fn(), __SW_MANIFEST: [] });

    await import("@/app/sw");

    const offlinePage = fs.readFileSync(
      path.resolve(process.cwd(), "app/offline/page.tsx"),
      "utf-8"
    );
    const offered = [...offlinePage.matchAll(/path: "([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(offered.length).toBeGreaterThan(0);
    const precached = precachedUrls();
    // The fallback page is served from the precache, so it must be in it.
    expect(precached).toContain("/offline");
    for (const route of offered) {
      expect(precached, `${route} must be precached`).toContain(route);
    }
  });

  it("saves the offline page's scripts at install and serves them only offline", async () => {
    const addEventListener = vi.fn();
    vi.stubGlobal("self", { addEventListener, __SW_MANIFEST: [] });
    vi.stubGlobal("navigator", { onLine: false });

    await import("@/app/sw");

    expect(addEventListener).toHaveBeenCalledWith(
      "install",
      expect.any(Function)
    );
    const rules = workerCapture.config?.runtimeCaching as Array<{
      matcher: (args: { url: URL }) => boolean;
    }>;
    const matches = (pathname: string) =>
      rules.some((rule) =>
        rule.matcher({ url: new URL(pathname, "https://deruiter.dev") })
      );
    expect(matches("/_next/static/chunks/0bg0id7uv1dqc.js")).toBe(true);

    vi.stubGlobal("navigator", { onLine: true });
    expect(matches("/_next/static/chunks/0bg0id7uv1dqc.js")).toBe(false);
  });

  it("leaves the SQL engine's binary to the HTTP cache (#2633)", async () => {
    vi.stubGlobal("self", { addEventListener: vi.fn(), __SW_MANIFEST: [] });

    await import("@/app/sw");

    const rules = workerCapture.config?.runtimeCaching as Array<{
      matcher: (args: { url: URL }) => boolean;
    }>;
    const matching = (path: string) =>
      rules.filter((rule) =>
        rule.matcher({ url: new URL(path, "https://deruiter.dev") })
      ).length;

    expect(matching("/_next/static/media/duckdb-eh.562c00b2.wasm")).toBe(1);
    expect(
      matching("/_next/static/media/duckdb-browser-eh.worker.1a2b3c4d.js")
    ).toBe(0);
    expect(matching("/_next/static/media/other.wasm")).toBe(0);
  });

  it("keeps benchmark and metadata routes inside the shared public catalog", () => {
    const registeredPaths = new Set(
      PUBLIC_ROUTE_REGISTRY.map(({ path }) => path)
    );

    expect(CANONICAL_ROUTES.map(({ path }) => path)).toEqual(
      PUBLIC_ROUTE_REGISTRY.map(({ path }) => path)
    );
    for (const config of Object.values(ROUTE_METADATA_CONFIGS)) {
      expect(registeredPaths, `${config.path} must be registered`).toContain(
        config.path
      );
    }
  });
});
