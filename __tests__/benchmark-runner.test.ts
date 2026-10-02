// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  BUILD_PROVENANCE_MAX_AGE_MS,
  runProductionBenchmark,
  validateBuildProvenance,
  type BenchmarkExecutionDependencies,
  type BuildProvenance,
} from "../lib/dx/benchmark-runner";
import { validateBenchmarkEvidence } from "../lib/dx/benchmark-evidence";
import type { PageBenchmarkSummary } from "../lib/dx/page-bench";

function passingRoute(): PageBenchmarkSummary {
  return {
    route: { path: "/", name: "Homepage", category: "top-level" },
    runs: 1,
    ttfb: { median: 120, min: 120, max: 120, p95: 120 },
    fcp: { median: 300, min: 300, max: 300, p95: 300 },
    lcp: { median: 650, min: 650, max: 650, p95: 650 },
    cls: { median: 0, min: 0, max: 0, p95: 0 },
    domContentLoaded: { median: 250, min: 250, max: 250, p95: 250 },
    loadDuration: { median: 750, min: 750, max: 750, p95: 750 },
    transferSizeKb: { median: 140, min: 140, max: 140, p95: 140 },
    ratings: { ttfb: "good", fcp: "good", lcp: "good", cls: "good" },
    passedBudget: true,
  };
}

function dependencies(overrides: Partial<BenchmarkExecutionDependencies> = {}) {
  const stop = vi.fn(async () => undefined);
  const source = { revision: "abc123", dirty: false };
  return {
    stop,
    dependencies: {
      inspectSource: vi.fn(() => source),
      buildProduction: vi.fn(async () => ({
        buildId: "build-123",
        diagnostics: "production build complete",
        completedAt: "2026-09-09T12:00:00.000Z",
      })),
      startProductionServer: vi.fn(async () => ({
        stop,
        diagnostics: () => "server started",
        isReady: () => true,
      })),
      waitForServer: vi.fn(async () => ({
        ready: true,
        diagnostics: "ready in 110ms",
      })),
      runPageBenchmarks: vi.fn(async () => [passingRoute()]),
      now: () => new Date("2026-09-09T12:05:00.000Z"),
      ...overrides,
    } satisfies BenchmarkExecutionDependencies,
  };
}

describe("production benchmark runner", () => {
  it("rejects an invalid target before building or starting a server", async () => {
    const setup = dependencies();

    await expect(
      runProductionBenchmark(
        { url: "http://example.com:3000", runs: 1, routes: ["/"] },
        setup.dependencies
      )
    ).rejects.toThrow(/local/i);

    expect(setup.dependencies.buildProduction).not.toHaveBeenCalled();
    expect(setup.dependencies.startProductionServer).not.toHaveBeenCalled();
  });

  it("preserves startup diagnostics and closes an owned server after a failed startup", async () => {
    const setup = dependencies({
      waitForServer: vi.fn(async () => ({
        ready: false,
        diagnostics: "Error: listen EADDRINUSE: address already in use :::4312",
      })),
    });

    await expect(
      runProductionBenchmark(
        { url: "http://localhost:4312", runs: 1, routes: ["/"] },
        setup.dependencies
      )
    ).rejects.toThrow(/EADDRINUSE/);

    expect(setup.stop).toHaveBeenCalledOnce();
    expect(setup.dependencies.runPageBenchmarks).not.toHaveBeenCalled();
  });

  it("rejects a responding target unless the owned production server reports ready", async () => {
    const occupiedStop = vi.fn(async () => undefined);
    const setup = dependencies({
      startProductionServer: vi.fn(async () => ({
        stop: occupiedStop,
        diagnostics: () =>
          "Error: listen EADDRINUSE: address already in use :::4312",
        isReady: () => false,
      })),
      waitForServer: vi.fn(async () => ({
        ready: true,
        diagnostics: "HTTP 200 from existing target",
      })),
    });

    await expect(
      runProductionBenchmark(
        { url: "http://localhost:4312", runs: 1, routes: ["/"] },
        setup.dependencies
      )
    ).rejects.toThrow(/owned production server/i);

    expect(setup.dependencies.runPageBenchmarks).not.toHaveBeenCalled();
    expect(occupiedStop).toHaveBeenCalledOnce();
  });

  it("emits complete evidence and closes its server after a valid production run", async () => {
    const setup = dependencies();

    const evidence = await runProductionBenchmark(
      { url: "http://localhost:4312", runs: 1, routes: ["/"], isMobile: false },
      setup.dependencies
    );

    expect(evidence).toMatchObject({
      mode: "production",
      source: { revision: "abc123", dirty: false },
      build: { mode: "production", fresh: true, buildId: "build-123" },
      target: { port: 4312, ownership: "benchmark", serverMode: "production" },
      assertion: { budgetEnabled: true, expectedRoutes: ["/"] },
    });
    expect(setup.stop).toHaveBeenCalledOnce();
  });

  it("passes throttled mobile option to benchmark dependencies and captures it in evidence", async () => {
    const setup = dependencies();

    const evidence = await runProductionBenchmark(
      {
        url: "http://localhost:4312",
        runs: 1,
        routes: ["/"],
        isMobile: true,
        throttled: true,
      },
      setup.dependencies
    );

    expect(setup.dependencies.runPageBenchmarks).toHaveBeenCalledWith({
      baseUrl: "http://localhost:4312/",
      runs: 1,
      isMobile: true,
      throttled: true,
    });
    expect(evidence.browser.isMobile).toBe(true);
    expect(evidence.browser.throttled).toBe(true);
    expect(setup.stop).toHaveBeenCalledOnce();
  });
});

/**
 * #1769: CI builds once and bench:pages --assert measures that build. The
 * reuse path must still prove a clean, fresh `npm run build` of the exact
 * revision; anything less falls back to building, as before.
 */
describe("build provenance reuse (#1769)", () => {
  const now = new Date("2026-09-09T12:05:00.000Z");

  function provenance(
    overrides: Partial<BuildProvenance> = {}
  ): BuildProvenance {
    return {
      version: 1,
      command: "npm run build",
      sourceRevision: "abc123",
      sourceDirty: false,
      sourceRevisionAfterBuild: "abc123",
      sourceDirtyAfterBuild: false,
      buildId: "ci-build-7",
      completedAt: "2026-09-09T11:55:00.000Z",
      ...overrides,
    };
  }

  const context = {
    source: { revision: "abc123", dirty: false },
    buildId: "ci-build-7",
    now,
  };

  it("accepts a clean, recent npm run build of the current revision", () => {
    expect(validateBuildProvenance(provenance(), context)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([
    ["a missing record", null],
    ["a different revision", provenance({ sourceRevision: "def456" })],
    [
      "a revision that changed during the build",
      provenance({ sourceRevisionAfterBuild: "def456" }),
    ],
    ["a dirty tree before the build", provenance({ sourceDirty: true })],
    [
      "a tree the build left dirty",
      provenance({ sourceDirtyAfterBuild: true }),
    ],
    ["an unknown source state", provenance({ sourceDirty: null })],
    ["no git revision", provenance({ sourceRevision: null })],
    ["a BUILD_ID that is not on disk", provenance({ buildId: "other" })],
    ["an empty BUILD_ID", provenance({ buildId: "" })],
    [
      "another command",
      fromAny<BuildProvenance, unknown>({
        ...provenance(),
        command: "next build",
      }),
    ],
    [
      "an unknown version",
      fromAny<BuildProvenance, unknown>({ ...provenance(), version: 2 }),
    ],
    [
      "a stale build",
      provenance({
        completedAt: new Date(
          now.getTime() - BUILD_PROVENANCE_MAX_AGE_MS - 1
        ).toISOString(),
      }),
    ],
    ["a future build", provenance({ completedAt: "2026-09-10T12:00:00.000Z" })],
    ["no completion time", provenance({ completedAt: "not a date" })],
  ])("rejects %s", (_label, record) => {
    expect(validateBuildProvenance(record, context).valid).toBe(false);
  });

  it("rejects any provenance while the current tree is dirty", () => {
    expect(
      validateBuildProvenance(provenance(), {
        ...context,
        source: { revision: "abc123", dirty: true },
      }).valid
    ).toBe(false);
  });

  it("measures the prebuilt build without rebuilding, and the evidence still validates", async () => {
    const report = vi.fn();
    const setup = dependencies({
      loadPrebuiltProduction: vi.fn(() => ({
        provenance: provenance(),
        buildId: "ci-build-7",
      })),
      report,
    });

    const evidence = await runProductionBenchmark(
      { url: "http://localhost:4312", runs: 1, routes: ["/"] },
      setup.dependencies
    );

    expect(setup.dependencies.buildProduction).not.toHaveBeenCalled();
    expect(evidence.build).toMatchObject({
      mode: "production",
      fresh: true,
      sourceRevision: "abc123",
      sourceDirty: false,
      buildId: "ci-build-7",
      command: "npm run build",
      completedAt: "2026-09-09T11:55:00.000Z",
    });
    expect(evidence.target.startupDiagnostics).toContain(
      "Reused production build ci-build-7"
    );
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining("Reused production build")
    );
    expect(
      validateBenchmarkEvidence(evidence, {
        revision: "abc123",
        dirty: false,
        now,
      }).valid
    ).toBe(true);
  });

  it("builds afresh, and says why, when the provenance does not match", async () => {
    const report = vi.fn();
    const setup = dependencies({
      loadPrebuiltProduction: vi.fn(() => ({
        provenance: provenance({ sourceRevision: "older" }),
        buildId: "ci-build-7",
      })),
      report,
    });

    const evidence = await runProductionBenchmark(
      { url: "http://localhost:4312", runs: 1, routes: ["/"] },
      setup.dependencies
    );

    expect(setup.dependencies.buildProduction).toHaveBeenCalledOnce();
    expect(evidence.build.buildId).toBe("build-123");
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining("does not match the current revision")
    );
  });

  it("builds afresh when no prebuilt build exists", async () => {
    const setup = dependencies({ loadPrebuiltProduction: vi.fn(() => null) });

    await runProductionBenchmark(
      { url: "http://localhost:4312", runs: 1, routes: ["/"] },
      setup.dependencies
    );

    expect(setup.dependencies.buildProduction).toHaveBeenCalledOnce();
  });

  it("never reuses a build when the tree is dirty; it refuses before building", async () => {
    const setup = dependencies({
      inspectSource: vi.fn(() => ({ revision: "abc123", dirty: true })),
      loadPrebuiltProduction: vi.fn(() => ({
        provenance: provenance(),
        buildId: "ci-build-7",
      })),
    });

    await expect(
      runProductionBenchmark(
        { url: "http://localhost:4312", runs: 1, routes: ["/"] },
        setup.dependencies
      )
    ).rejects.toThrow(/clean source tree/);
    expect(setup.dependencies.buildProduction).not.toHaveBeenCalled();
    expect(setup.dependencies.startProductionServer).not.toHaveBeenCalled();
  });
});
