// @vitest-environment node
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

  it("precaches every canonical public route", async () => {
    vi.stubGlobal("self", { __SW_MANIFEST: [] });

    await import("@/app/sw");

    const entries = workerCapture.config?.precacheEntries as
      Array<string | { url: string }> | undefined;
    const precachedPaths = new Set(
      entries?.map((entry) =>
        typeof entry === "string" ? entry : entry.url
      ) ?? []
    );

    for (const route of CANONICAL_ROUTES) {
      expect(precachedPaths, `${route.path} must be precached`).toContain(
        route.path
      );
    }
  });

  it("leaves the SQL engine's binary to the HTTP cache (#2633)", async () => {
    vi.stubGlobal("self", { __SW_MANIFEST: [] });

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
