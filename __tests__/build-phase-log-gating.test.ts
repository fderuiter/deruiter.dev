// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isBuildPhase", () => {
  async function load() {
    const mod = await import("@/lib/env");
    return mod.isBuildPhase;
  }

  it("reports a build during Next production prerendering", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect((await load())()).toBe(true);
  });

  it("reports a build under the end-to-end harness", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST", "true");
    expect((await load())()).toBe(true);
  });

  it("does not report a build for a running production server", async () => {
    // Regression guard: a production build also sets VERCEL_ENV=production, so
    // a production check alone cannot distinguish generating pages from serving
    // them. Without the phase check, one build emitted a fallback warning per
    // page per worker -- several hundred stack traces for a handful of causes.
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect((await load())()).toBe(false);
  });

  it("does not report a build for ordinary local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await load())()).toBe(false);
  });
});

describe("service fallback logging is gated on runtime, not merely production", () => {
  it("every production log guard in the content services also excludes the build phase", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");

    // Resolved from the workspace root rather than a hardcoded absolute path.
    const root = process.cwd();
    const services = [
      "lib/services/blog-service.ts",
      "lib/services/case-study-service.ts",
    ];

    for (const service of services) {
      const source = readFileSync(join(root, service), "utf-8");
      const guards = source.match(/env\.VERCEL_ENV === "production"/g) ?? [];
      const gated =
        source.match(
          /env\.VERCEL_ENV === "production" && !isBuildPhase\(\)/g
        ) ?? [];

      expect(guards.length).toBeGreaterThan(0);
      expect(gated.length).toBe(guards.length);
    }
  });
});
