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
    const { readdirSync, readFileSync } = await import("fs");
    const { join } = await import("path");

    function collectTsFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectTsFiles(full));
        else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
      }
      return out;
    }

    // Resolved from the workspace root rather than a hardcoded absolute path.
    const root = process.cwd();
    const serviceDomains = ["lib/services/blog", "lib/services/case-study"];

    for (const domain of serviceDomains) {
      const files = collectTsFiles(join(root, domain));
      let totalGuards = 0;
      let totalGated = 0;
      for (const file of files) {
        const source = readFileSync(file, "utf-8");
        const guards = source.match(/env\.VERCEL_ENV === "production"/g) ?? [];
        const gated =
          source.match(
            /env\.VERCEL_ENV === "production" && !isBuildPhase\(\)/g
          ) ?? [];
        expect(gated.length).toBe(guards.length);
        totalGuards += guards.length;
        totalGated += gated.length;
      }
      expect(totalGuards).toBeGreaterThan(0);
      expect(totalGated).toBe(totalGuards);
    }
  });
});
