import {
  createBenchmarkTarget,
  validateBenchmarkEvidence,
  type BenchmarkEvidence,
  type BenchmarkTarget,
} from "./benchmark-evidence";
import type { PageBenchmarkSummary } from "./page-bench";

export interface BenchmarkSourceState {
  revision: string;
  dirty: boolean;
}

export interface ProductionBuildResult {
  buildId: string;
  diagnostics: string;
  completedAt: string;
}

export interface OwnedBenchmarkServer {
  stop: () => Promise<void>;
  diagnostics: () => string;
  isReady: () => boolean;
}

export interface ServerReadiness {
  ready: boolean;
  diagnostics: string;
}

export interface ProductionBenchmarkOptions {
  url: string;
  runs: number;
  routes: string[];
  isMobile?: boolean;
  throttled?: boolean;
}

/** Where `scripts/build.js` records build provenance, relative to the root. */
export const BUILD_PROVENANCE_FILE = ".next/build-provenance.json";

/**
 * Oldest build provenance a production assertion may reuse. A build left over
 * from a previous day is rebuilt rather than trusted.
 */
export const BUILD_PROVENANCE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** The record `scripts/build.js` writes after `next build` succeeds. */
export interface BuildProvenance {
  version: 1;
  command: "npm run build";
  sourceRevision: string | null;
  sourceDirty: boolean | null;
  sourceRevisionAfterBuild: string | null;
  sourceDirtyAfterBuild: boolean | null;
  buildId: string;
  completedAt: string;
}

/** A production build already on disk, as found by the CLI. */
export interface PrebuiltProduction {
  /** Parsed provenance JSON, unvalidated. */
  provenance: unknown;
  /** Contents of `.next/BUILD_ID`, or null when absent. */
  buildId: string | null;
}

export interface BuildProvenanceValidationContext {
  /** Source state immediately before the benchmark would otherwise build. */
  source: BenchmarkSourceState;
  /** BUILD_ID of the build on disk. */
  buildId: string | null;
  now?: Date;
  maxAgeMs?: number;
}

/**
 * Decides whether an earlier `npm run build` can stand in for the build a
 * production assertion would run itself (#1769). It must be a completed
 * `npm run build` of the exact current revision, from a tree that was clean
 * before and after the build, whose BUILD_ID is the one on disk, and recent.
 */
export function validateBuildProvenance(
  provenance: unknown,
  context: BuildProvenanceValidationContext
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof provenance !== "object" || provenance === null) {
    return { valid: false, errors: ["Build provenance is missing."] };
  }
  const record = provenance as Partial<BuildProvenance>;
  if (record.version !== 1) {
    errors.push("Build provenance has an unknown version.");
  }
  if (record.command !== "npm run build") {
    errors.push("Build provenance was not produced by npm run build.");
  }
  if (context.source.dirty) {
    errors.push("The source tree is dirty.");
  }
  if (
    typeof record.sourceRevision !== "string" ||
    record.sourceRevision !== context.source.revision ||
    record.sourceRevisionAfterBuild !== context.source.revision
  ) {
    errors.push("Build provenance does not match the current revision.");
  }
  if (record.sourceDirty !== false || record.sourceDirtyAfterBuild !== false) {
    errors.push("The build ran on, or left behind, a dirty source tree.");
  }
  if (
    typeof record.buildId !== "string" ||
    record.buildId.length === 0 ||
    record.buildId !== context.buildId
  ) {
    errors.push("Build provenance BUILD_ID does not match .next/BUILD_ID.");
  }
  const completedAt =
    typeof record.completedAt === "string"
      ? Date.parse(record.completedAt)
      : Number.NaN;
  const now = (context.now ?? new Date()).getTime();
  const maxAge = context.maxAgeMs ?? BUILD_PROVENANCE_MAX_AGE_MS;
  if (Number.isNaN(completedAt)) {
    errors.push("Build provenance has no valid completion time.");
  } else if (completedAt > now + 5 * 60 * 1000) {
    errors.push("Build provenance completion time is in the future.");
  } else if (now - completedAt > maxAge) {
    errors.push("Build provenance is stale.");
  }
  return { valid: errors.length === 0, errors };
}

/** Injectable side effects keep production lifecycle behavior testable. */
export interface BenchmarkExecutionDependencies {
  inspectSource: () => BenchmarkSourceState;
  /**
   * Returns the production build already on disk, if any. When its provenance
   * validates, the benchmark measures it instead of building again.
   */
  loadPrebuiltProduction?: () => PrebuiltProduction | null;
  /** Receives progress notes, such as why a prebuilt build was not reused. */
  report?: (message: string) => void;
  buildProduction: (
    source: BenchmarkSourceState
  ) => Promise<ProductionBuildResult>;
  startProductionServer: (
    target: BenchmarkTarget
  ) => Promise<OwnedBenchmarkServer>;
  waitForServer: (target: BenchmarkTarget) => Promise<ServerReadiness>;
  runPageBenchmarks: (input: {
    baseUrl: string;
    runs: number;
    isMobile: boolean;
    throttled?: boolean;
  }) => Promise<PageBenchmarkSummary[]>;
  now?: () => Date;
}

function browserSettings(isMobile: boolean, throttled = false) {
  return isMobile
    ? {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        throttled,
      }
    : {
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        throttled,
      };
}

/**
 * Reuses a validated earlier build of this exact revision, or builds afresh.
 */
async function resolveProductionBuild(
  source: BenchmarkSourceState,
  dependencies: BenchmarkExecutionDependencies
): Promise<ProductionBuildResult> {
  const prebuilt = dependencies.loadPrebuiltProduction?.() ?? null;
  if (prebuilt) {
    const validation = validateBuildProvenance(prebuilt.provenance, {
      source,
      buildId: prebuilt.buildId,
      now: dependencies.now?.(),
    });
    if (validation.valid) {
      const record = prebuilt.provenance as BuildProvenance;
      const note = `Reused production build ${record.buildId} from ${BUILD_PROVENANCE_FILE}: npm run build of ${record.sourceRevision}, clean before and after, completed ${record.completedAt}.`;
      dependencies.report?.(note);
      return {
        buildId: record.buildId,
        completedAt: record.completedAt,
        diagnostics: note,
      };
    }
    dependencies.report?.(
      `Not reusing the existing production build: ${validation.errors.join(" ")} Building afresh.`
    );
  }
  return dependencies.buildProduction(source);
}

/**
 * Builds, owns, measures, validates, and always cleans up a production server.
 * It intentionally has no path for reusing an arbitrary responding server; the
 * only thing it may reuse is a build whose provenance validates.
 */
export async function runProductionBenchmark(
  options: ProductionBenchmarkOptions,
  dependencies: BenchmarkExecutionDependencies
): Promise<BenchmarkEvidence> {
  const target = createBenchmarkTarget(options.url);
  const sourceBeforeBuild = dependencies.inspectSource();
  if (sourceBeforeBuild.dirty) {
    throw new Error(
      "Production benchmark assertions require a clean source tree."
    );
  }

  const build = await resolveProductionBuild(sourceBeforeBuild, dependencies);
  let server: OwnedBenchmarkServer | null = null;

  try {
    server = await dependencies.startProductionServer(target);
    const readiness = await dependencies.waitForServer(target);
    if (!server.isReady()) {
      throw new Error(
        `Owned production server did not report ready: ${server.diagnostics()}`
      );
    }
    if (!readiness.ready) {
      throw new Error(
        `Production server failed to become ready: ${readiness.diagnostics}`
      );
    }

    const summaries = await dependencies.runPageBenchmarks({
      baseUrl: target.url,
      runs: options.runs,
      isMobile: options.isMobile ?? false,
      throttled: options.throttled ?? false,
    });
    const sourceAfterMeasurement = dependencies.inspectSource();
    const capturedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const viewport = browserSettings(
      options.isMobile ?? false,
      options.throttled ?? false
    );
    const evidence: BenchmarkEvidence = {
      version: 1,
      mode: "production",
      capturedAt,
      source: sourceAfterMeasurement,
      build: {
        mode: "production",
        fresh: true,
        sourceRevision: sourceBeforeBuild.revision,
        sourceDirty: sourceBeforeBuild.dirty,
        buildId: build.buildId,
        command: "npm run build",
        completedAt: build.completedAt,
      },
      target: {
        ...target,
        ownership: "benchmark",
        serverMode: "production",
        startupDiagnostics: `${build.diagnostics}\n${server.diagnostics()}\n${readiness.diagnostics}`,
      },
      browser: { engine: "chromium", headless: true, ...viewport },
      sampling: { warmupRuns: 1, measuredRuns: options.runs },
      assertion: { budgetEnabled: true, expectedRoutes: options.routes },
      routes: summaries,
    };
    const validation = validateBenchmarkEvidence(evidence, {
      revision: sourceAfterMeasurement.revision,
      dirty: sourceAfterMeasurement.dirty,
      now: dependencies.now?.(),
    });
    if (!validation.valid) {
      throw new Error(
        `Production benchmark evidence rejected: ${validation.errors.join(" ")}`
      );
    }
    return evidence;
  } finally {
    if (server) {
      await server.stop();
    }
  }
}
