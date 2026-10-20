// @vitest-environment node
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BENCHMARK_EVIDENCE_VERSION,
  createBenchmarkTarget,
  readBenchmarkEvidence,
  validateBenchmarkEvidence,
  writeBenchmarkEvidence,
  type BenchmarkEvidence,
} from "../lib/dx/benchmark-evidence";
import type { PageBenchmarkSummary } from "../lib/dx/page-bench";

const temporaryDirectories: string[] = [];

function passingRoute(pathname = "/"): PageBenchmarkSummary {
  return {
    route: { path: pathname, name: "Homepage", category: "top-level" },
    runs: 3,
    ttfb: { median: 120, min: 100, max: 130, p95: 130 },
    fcp: { median: 300, min: 280, max: 320, p95: 320 },
    lcp: { median: 650, min: 600, max: 700, p95: 700 },
    cls: { median: 0.01, min: 0, max: 0.02, p95: 0.02 },
    domContentLoaded: { median: 250, min: 230, max: 260, p95: 260 },
    loadDuration: { median: 750, min: 720, max: 780, p95: 780 },
    transferSizeKb: { median: 140, min: 130, max: 145, p95: 145 },
    ratings: { ttfb: "good", fcp: "good", lcp: "good", cls: "good" },
    passedBudget: true,
  };
}

function productionEvidence(
  overrides: Partial<BenchmarkEvidence> = {}
): BenchmarkEvidence {
  return {
    version: BENCHMARK_EVIDENCE_VERSION,
    mode: "production",
    capturedAt: "2026-09-09T12:00:00.000Z",
    source: { revision: "abc123", dirty: false },
    build: {
      mode: "production",
      fresh: true,
      sourceRevision: "abc123",
      sourceDirty: false,
      buildId: "next-build-id",
      command: "npm run build",
      completedAt: "2026-09-09T11:59:00.000Z",
    },
    target: {
      url: "http://127.0.0.1:3210",
      hostname: "127.0.0.1",
      port: 3210,
      ownership: "benchmark",
      serverMode: "production",
      startupDiagnostics: "ready",
    },
    browser: {
      engine: "chromium",
      headless: true,
      viewport: { width: 1280, height: 800 },
      isMobile: false,
      hasTouch: false,
    },
    sampling: { warmupRuns: 1, measuredRuns: 3 },
    assertion: { budgetEnabled: true, expectedRoutes: ["/"] },
    routes: [passingRoute()],
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("benchmark evidence contract", () => {
  it("accepts a complete, current production report with every expected route", () => {
    const result = validateBenchmarkEvidence(productionEvidence(), {
      revision: "abc123",
      dirty: false,
      now: new Date("2026-09-09T12:05:00.000Z"),
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [
      "development build",
      { build: { ...productionEvidence().build, mode: "development" } },
    ],
    [
      "external server",
      { target: { ...productionEvidence().target, ownership: "external" } },
    ],
    [
      "missing budget flag",
      { assertion: { budgetEnabled: false, expectedRoutes: ["/"] } },
    ],
    ["stale revision", { source: { revision: "old-revision", dirty: false } }],
    ["dirty source", { source: { revision: "abc123", dirty: true } }],
    ["empty results", { routes: [] }],
    [
      "remote target hidden in otherwise complete evidence",
      {
        target: {
          ...productionEvidence().target,
          url: "http://example.com:3210",
          hostname: "example.com",
        },
      },
    ],
    ["zero sampling", { sampling: { warmupRuns: 0, measuredRuns: 0 } }],
    [
      "invalid viewport",
      {
        browser: {
          ...productionEvidence().browser,
          viewport: { width: 0, height: -1 },
        },
      },
    ],
  ])("rejects %s", (_label, overrides) => {
    const result = validateBenchmarkEvidence(
      productionEvidence(overrides as Partial<BenchmarkEvidence>),
      {
        revision: "abc123",
        dirty: false,
        now: new Date("2026-09-09T12:05:00.000Z"),
      }
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects reports that are older than the assertion freshness window", () => {
    const result = validateBenchmarkEvidence(productionEvidence(), {
      revision: "abc123",
      dirty: false,
      now: new Date("2026-09-09T12:31:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Evidence is older than 15 minutes.");
  });

  it("atomically writes and reads the versioned evidence artifact", () => {
    const outputDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "benchmark-evidence-")
    );
    temporaryDirectories.push(outputDirectory);

    const evidencePath = writeBenchmarkEvidence(
      productionEvidence(),
      outputDirectory
    );

    expect(path.basename(evidencePath)).toBe("benchmark-results.v1.json");
    expect(readBenchmarkEvidence(evidencePath)).toEqual(productionEvidence());
    expect(fs.readdirSync(outputDirectory)).toEqual([
      "benchmark-results.v1.json",
    ]);
  });

  it("rejects remote, encrypted, and invalid benchmark targets for assertions", () => {
    expect(() => createBenchmarkTarget("https://www.deruiter.dev")).toThrow(
      /http/i
    );
    expect(() => createBenchmarkTarget("http://example.com:3000")).toThrow(
      /local/i
    );
    expect(() => createBenchmarkTarget("http://127.0.0.1:70000")).toThrow(
      /port/i
    );
  });

  it("derives the owned production server port from the configured target", () => {
    expect(createBenchmarkTarget("http://localhost:4312")).toEqual({
      url: "http://localhost:4312/",
      hostname: "localhost",
      port: 4312,
    });
  });
});
