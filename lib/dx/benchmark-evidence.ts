import fs from "fs";
import path from "path";
import type { PageBenchmarkSummary } from "./page-bench";

/** The current on-disk schema for real-browser benchmark evidence. */
export const BENCHMARK_EVIDENCE_VERSION = 1;

/** Assertion evidence is only useful while it still represents the active checkout. */
export const BENCHMARK_EVIDENCE_MAX_AGE_MS = 15 * 60 * 1000;

/** Ignored directory used by the benchmark command unless callers choose another output path. */
export const DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY = ".benchmark-results";

export interface BenchmarkEvidence {
  version: typeof BENCHMARK_EVIDENCE_VERSION;
  mode: "production" | "exploratory";
  capturedAt: string;
  source: {
    revision: string;
    dirty: boolean;
  };
  build: {
    mode: "production" | "development" | "unknown";
    fresh: boolean;
    sourceRevision: string | null;
    sourceDirty: boolean | null;
    buildId: string | null;
    command: string | null;
    completedAt: string | null;
  };
  target: {
    url: string;
    hostname: string;
    port: number;
    ownership: "benchmark" | "external";
    serverMode: "production" | "development" | "unknown";
    startupDiagnostics: string;
  };
  browser: {
    engine: "chromium";
    headless: boolean;
    viewport: { width: number; height: number };
    isMobile: boolean;
    hasTouch: boolean;
    throttled?: boolean;
  };
  sampling: {
    warmupRuns: number;
    measuredRuns: number;
  };
  assertion: {
    budgetEnabled: boolean;
    expectedRoutes: string[];
  };
  routes: PageBenchmarkSummary[];
}

export interface BenchmarkEvidenceValidationContext {
  revision: string;
  dirty: boolean;
  now?: Date;
  maxAgeMs?: number;
}

export interface BenchmarkEvidenceValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BenchmarkTarget {
  url: string;
  hostname: string;
  port: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key].length > 0;
}

function isMetricSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ["median", "min", "max", "p95"].every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key])
  );
}

function isBenchmarkRoute(value: unknown): value is PageBenchmarkSummary {
  if (!isRecord(value) || !isRecord(value.route) || !isRecord(value.ratings))
    return false;
  return (
    hasString(value.route, "path") &&
    hasString(value.route, "name") &&
    typeof value.route.category === "string" &&
    typeof value.runs === "number" &&
    value.runs > 0 &&
    isMetricSummary(value.ttfb) &&
    isMetricSummary(value.fcp) &&
    isMetricSummary(value.lcp) &&
    isMetricSummary(value.cls) &&
    isMetricSummary(value.domContentLoaded) &&
    isMetricSummary(value.loadDuration) &&
    isMetricSummary(value.transferSizeKb) &&
    typeof value.passedBudget === "boolean"
  );
}

function isBenchmarkEvidence(value: unknown): value is BenchmarkEvidence {
  if (!isRecord(value)) return false;
  if (
    !isRecord(value.source) ||
    !isRecord(value.build) ||
    !isRecord(value.target) ||
    !isRecord(value.browser) ||
    !isRecord(value.sampling) ||
    !isRecord(value.assertion)
  ) {
    return false;
  }
  const { source, build, target, browser, sampling, assertion } = value;
  return (
    value.version === BENCHMARK_EVIDENCE_VERSION &&
    (value.mode === "production" || value.mode === "exploratory") &&
    hasString(value, "capturedAt") &&
    hasString(source, "revision") &&
    typeof source.dirty === "boolean" &&
    typeof build.mode === "string" &&
    typeof build.fresh === "boolean" &&
    typeof target.port === "number" &&
    hasString(target, "url") &&
    hasString(target, "hostname") &&
    typeof target.ownership === "string" &&
    typeof target.serverMode === "string" &&
    typeof target.startupDiagnostics === "string" &&
    browser.engine === "chromium" &&
    typeof browser.headless === "boolean" &&
    isRecord(browser.viewport) &&
    typeof browser.viewport.width === "number" &&
    typeof browser.viewport.height === "number" &&
    typeof browser.isMobile === "boolean" &&
    typeof browser.hasTouch === "boolean" &&
    typeof sampling.warmupRuns === "number" &&
    typeof sampling.measuredRuns === "number" &&
    typeof assertion.budgetEnabled === "boolean" &&
    Array.isArray(assertion.expectedRoutes) &&
    assertion.expectedRoutes.every(
      (route: unknown) => typeof route === "string"
    ) &&
    Array.isArray(value.routes) &&
    value.routes.every(isBenchmarkRoute)
  );
}

/**
 * Parses an assertion target and permits only a local, plaintext endpoint.
 * Assertion runs own their server, so remote or pre-existing targets are not evidence.
 */
export function createBenchmarkTarget(value: string): BenchmarkTarget {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Benchmark target must contain a valid HTTP port.");
  }

  if (url.protocol !== "http:") {
    throw new Error("Production benchmark assertions must use an http target.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("Production benchmark assertions require a local target.");
  }

  const port = Number(url.port || "80");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Benchmark target must contain a valid HTTP port.");
  }

  return { url: url.toString(), hostname: url.hostname, port };
}

/** Validates that evidence can support a production budget assertion. */
export function validateBenchmarkEvidence(
  evidence: unknown,
  context: BenchmarkEvidenceValidationContext
): BenchmarkEvidenceValidationResult {
  const errors: string[] = [];
  if (!isBenchmarkEvidence(evidence)) {
    return {
      valid: false,
      errors: ["Evidence does not match benchmark-results.v1 schema."],
    };
  }

  if (evidence.mode !== "production") {
    errors.push("Evidence is exploratory, not a production assertion.");
  }
  if (evidence.source.dirty || context.dirty) {
    errors.push("Production assertion evidence requires a clean source tree.");
  }
  if (evidence.source.revision !== context.revision) {
    errors.push(
      "Evidence revision does not match the current source revision."
    );
  }
  if (
    evidence.build.mode !== "production" ||
    !evidence.build.fresh ||
    evidence.build.sourceRevision !== evidence.source.revision ||
    evidence.build.sourceDirty !== false ||
    !evidence.build.buildId ||
    evidence.build.command !== "npm run build" ||
    !evidence.build.completedAt
  ) {
    errors.push("Evidence lacks fresh production build provenance.");
  }
  if (
    evidence.target.ownership !== "benchmark" ||
    evidence.target.serverMode !== "production" ||
    !evidence.target.startupDiagnostics
  ) {
    errors.push(
      "Evidence was not measured against an owned production server."
    );
  }
  try {
    const target = createBenchmarkTarget(evidence.target.url);
    if (
      target.hostname !== evidence.target.hostname ||
      target.port !== evidence.target.port
    ) {
      errors.push("Evidence target URL, hostname, and port are inconsistent.");
    }
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `Evidence target is invalid: ${error.message}`
        : "Evidence target is invalid."
    );
  }
  if (
    !Number.isInteger(evidence.browser.viewport.width) ||
    !Number.isInteger(evidence.browser.viewport.height) ||
    evidence.browser.viewport.width < 1 ||
    evidence.browser.viewport.height < 1
  ) {
    errors.push("Evidence viewport dimensions must be positive integers.");
  }
  if (
    !Number.isInteger(evidence.sampling.warmupRuns) ||
    !Number.isInteger(evidence.sampling.measuredRuns) ||
    evidence.sampling.warmupRuns < 1 ||
    evidence.sampling.measuredRuns < 1
  ) {
    errors.push("Evidence sampling counts must be positive integers.");
  }
  if (!evidence.assertion.budgetEnabled) {
    errors.push("Evidence does not record an enabled budget assertion.");
  }
  if (evidence.assertion.expectedRoutes.length === 0) {
    errors.push("Evidence does not declare expected routes.");
  }
  if (evidence.routes.length === 0) {
    errors.push("Evidence contains no measured routes.");
  }

  const measuredPaths = new Set(
    evidence.routes.map((route) => route.route.path)
  );
  const missingRoutes = evidence.assertion.expectedRoutes.filter(
    (route) => !measuredPaths.has(route)
  );
  if (missingRoutes.length > 0) {
    errors.push(
      `Evidence is missing expected routes: ${missingRoutes.join(", ")}.`
    );
  }
  const overBudget = evidence.routes.filter((route) => !route.passedBudget);
  if (overBudget.length > 0) {
    const detail = overBudget
      .map(
        ({ route, ttfb, fcp, lcp, cls }) =>
          `${route.path} (median TTFB ${Math.round(ttfb.median)}ms, FCP ${Math.round(fcp.median)}ms, LCP ${Math.round(lcp.median)}ms, CLS ${cls.median.toFixed(3)})`
      )
      .join("; ");
    errors.push(
      `Evidence contains route results that failed the performance budget: ${detail}.`
    );
  }

  const capturedAt = Date.parse(evidence.capturedAt);
  const now = context.now?.getTime() ?? Date.now();
  const maxAgeMs = context.maxAgeMs ?? BENCHMARK_EVIDENCE_MAX_AGE_MS;
  if (!Number.isFinite(capturedAt)) {
    errors.push("Evidence timestamp is invalid.");
  } else if (now - capturedAt > maxAgeMs) {
    errors.push("Evidence is older than 15 minutes.");
  } else if (capturedAt > now + 60_000) {
    errors.push("Evidence timestamp is in the future.");
  }

  return { valid: errors.length === 0, errors };
}

/** Reads and type-checks a versioned benchmark evidence artifact. */
export function readBenchmarkEvidence(evidencePath: string): BenchmarkEvidence {
  const parsed: unknown = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));
  if (!isBenchmarkEvidence(parsed)) {
    throw new Error("Evidence does not match benchmark-results.v1 schema.");
  }
  return parsed;
}

/** Writes the result contract atomically so interrupted runs cannot leave partial evidence. */
export function writeBenchmarkEvidence(
  evidence: BenchmarkEvidence,
  outputDirectory = DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY
): string {
  return writeBenchmarkArtifact(
    outputDirectory,
    "benchmark-results.v1.json",
    `${JSON.stringify(evidence, null, 2)}\n`
  );
}

/** Writes the human-readable companion report with the same atomic guarantee. */
export function writeBenchmarkMarkdown(
  markdown: string,
  outputDirectory = DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY
): string {
  return writeBenchmarkArtifact(
    outputDirectory,
    "benchmark-results.v1.md",
    markdown
  );
}

function writeBenchmarkArtifact(
  outputDirectory: string,
  filename: string,
  contents: string
): string {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const artifactPath = path.join(outputDirectory, filename);
  const temporaryPath = path.join(
    outputDirectory,
    `.${filename}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(temporaryPath, contents, "utf-8");
  fs.renameSync(temporaryPath, artifactPath);
  return artifactPath;
}
