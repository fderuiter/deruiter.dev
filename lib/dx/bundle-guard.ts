import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { DiagnosticCheckResult } from "./doctor";
import { colors, formatHeader } from "./utils";

export interface ChunkInfo {
  name: string;
  relativePath: string;
  rawBytes: number;
  gzipBytes: number;
  isInitial: boolean;
}

export interface BundleBudgetReport {
  isBuilt: boolean;
  totalChunks: number;
  totalRawBytes: number;
  totalGzipBytes: number;
  initialSharedGzipBytes: number;
  chunks: ChunkInfo[];
  violations: string[];
}

export interface BundleBudgetOptions {
  limit?: number;
  filter?: string;
  strict?: boolean;
}

export const DEFAULT_BUDGETS = {
  maxInitialSharedGzip: 400 * 1024, // 400 KB
  maxSingleChunkGzip: 350 * 1024, // 350 KB
};

/**
 * Third-party chunks that are only ever loaded on demand and cannot be split
 * further, each with its own ceiling in place of `maxSingleChunkGzip`.
 * A chunk matches when it is not part of the initial bundle and its source
 * contains `marker`. Mermaid 12 lazy-loads the ELK layout engine (about
 * 430 kB gzip) only for `elk` layout diagrams (#1490).
 */
export const LAZY_VENDOR_CHUNK_BUDGETS: ReadonlyArray<{
  name: string;
  marker: string;
  maxGzip: number;
}> = [{ name: "elkjs", marker: "elk.alg.common", maxGzip: 500 * 1024 }];

/**
 * Returns the gzip ceiling that applies to one chunk: a lazy vendor ceiling
 * when a non-initial chunk carries that vendor's marker, otherwise the
 * default single-chunk budget.
 */
export function chunkGzipBudget(source: string, isInitial: boolean): number {
  if (!isInitial) {
    const vendor = LAZY_VENDOR_CHUNK_BUDGETS.find((v) =>
      source.includes(v.marker)
    );
    if (vendor) return vendor.maxGzip;
  }
  return DEFAULT_BUDGETS.maxSingleChunkGzip;
}

/**
 * Inspects .next build output chunks and evaluates gzip sizes and budget limits.
 */
export function inspectBundleChunks(
  workspaceRoot: string,
  options: BundleBudgetOptions = {}
): BundleBudgetReport {
  const nextDir = path.join(workspaceRoot, ".next");
  const buildManifestPath = path.join(nextDir, "build-manifest.json");

  if (!fs.existsSync(nextDir) || !fs.existsSync(buildManifestPath)) {
    return {
      isBuilt: false,
      totalChunks: 0,
      totalRawBytes: 0,
      totalGzipBytes: 0,
      initialSharedGzipBytes: 0,
      chunks: [],
      violations: [],
    };
  }

  let buildManifest: { pages?: Record<string, string[]> } = {};
  try {
    buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf-8"));
  } catch {
    // Malformed manifest
  }

  const chunksDir = path.join(nextDir, "static", "chunks");
  let chunks: ChunkInfo[] = [];
  const violations: string[] = [];

  if (fs.existsSync(chunksDir)) {
    const findChunksRecursively = (dir: string): string[] => {
      const files: string[] = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...findChunksRecursively(full));
        } else if (item.name.endsWith(".js") || item.name.endsWith(".css")) {
          files.push(full);
        }
      }
      return files;
    };

    const chunkFiles = findChunksRecursively(chunksDir);

    // Initial chunks identified from root '/' or app root
    const rootChunks = new Set(buildManifest.pages?.["/"] || []);

    let initialSharedGzip = 0;
    let totalRaw = 0;
    let totalGzip = 0;

    for (const file of chunkFiles) {
      const relative = path.relative(nextDir, file);
      const rawContent = fs.readFileSync(file);
      const rawBytes = rawContent.length;
      const gzipBytes = zlib.gzipSync(rawContent).length;

      const isInitial =
        rootChunks.has(relative) ||
        relative.includes("webpack-") ||
        relative.includes("main-");

      if (isInitial) {
        initialSharedGzip += gzipBytes;
      }

      totalRaw += rawBytes;
      totalGzip += gzipBytes;

      const chunkInfo: ChunkInfo = {
        name: path.basename(file),
        relativePath: relative,
        rawBytes,
        gzipBytes,
        isInitial,
      };

      const budget = chunkGzipBudget(rawContent.toString("utf-8"), isInitial);
      if (gzipBytes > budget) {
        violations.push(
          `Chunk '${path.basename(file)}' (${(gzipBytes / 1024).toFixed(1)} kB gzip) exceeds maximum chunk budget of ${(budget / 1024).toFixed(0)} kB.`
        );
      }

      chunks.push(chunkInfo);
    }

    if (initialSharedGzip > DEFAULT_BUDGETS.maxInitialSharedGzip) {
      violations.push(
        `Initial shared bundle (${(initialSharedGzip / 1024).toFixed(1)} kB gzip) exceeds maximum initial budget of ${(DEFAULT_BUDGETS.maxInitialSharedGzip / 1024).toFixed(0)} kB.`
      );
    }

    // Sort descending by gzip size
    chunks.sort((a, b) => b.gzipBytes - a.gzipBytes);

    if (options.filter) {
      const f = options.filter.toLowerCase();
      chunks = chunks.filter((c) => c.name.toLowerCase().includes(f));
    }

    const totalCount = chunks.length;
    if (options.limit && options.limit > 0) {
      chunks = chunks.slice(0, options.limit);
    }

    return {
      isBuilt: true,
      totalChunks: totalCount,
      totalRawBytes: totalRaw,
      totalGzipBytes: totalGzip,
      initialSharedGzipBytes: initialSharedGzip,
      chunks,
      violations,
    };
  }

  return {
    isBuilt: true,
    totalChunks: 0,
    totalRawBytes: 0,
    totalGzipBytes: 0,
    initialSharedGzipBytes: 0,
    chunks: [],
    violations: [],
  };
}

/**
 * Inspects standalone JavaScript bundle assets in public/ and checks budget limits.
 */
export function inspectStandaloneBundle(workspaceRoot: string): {
  exists: boolean;
  sizeBytes: number;
  violation?: string;
} {
  const targetPath = path.join(workspaceRoot, "public", "garmin-engine.js");
  if (!fs.existsSync(targetPath)) {
    return { exists: false, sizeBytes: 0 };
  }
  const stats = fs.statSync(targetPath);
  const maxBytes = 50 * 1024;
  let violation: string | undefined;
  if (stats.size > maxBytes) {
    violation = `Standalone JavaScript asset 'garmin-engine.js' (${(stats.size / 1024).toFixed(1)} kB) exceeds maximum budget of 50.0 kB.`;
  }
  return { exists: true, sizeBytes: stats.size, violation };
}

/**
 * Diagnostic check for bundle performance budgets in doctor.ts.
 */
export function checkBundleBudgets(root: string): DiagnosticCheckResult {
  const report = inspectBundleChunks(root);
  const standaloneReport = inspectStandaloneBundle(root);

  if (standaloneReport.exists && standaloneReport.violation) {
    report.violations.push(standaloneReport.violation);
  }

  if (!report.isBuilt) {
    if (standaloneReport.violation) {
      return {
        id: "bundle-performance-budgets",
        name: "Production Bundle & Chunk Performance Budgets",
        category: "quality",
        status: "warn",
        message: `Standalone JS artifact exceeded defined 50KB size budget.`,
        details: [standaloneReport.violation],
      };
    }
    return {
      id: "bundle-performance-budgets",
      name: "Production Bundle & Chunk Performance Budgets",
      category: "quality",
      status: "pass",
      message:
        "No production build artifacts found (.next). Budget assertion active upon build.",
    };
  }

  if (report.violations.length > 0) {
    return {
      id: "bundle-performance-budgets",
      name: "Production Bundle & Chunk Performance Budgets",
      category: "quality",
      status: "warn",
      message: `${report.violations.length} bundle chunk(s) exceeded defined performance budgets.`,
      details: report.violations,
      remediation: {
        id: "bundle-optimize",
        title: "Analyze bundle chunks and split heavy modules",
        command: "npm run dx analyze",
        autoFixable: false,
        scope: "performance",
      },
    };
  }

  return {
    id: "bundle-performance-budgets",
    name: "Production Bundle & Chunk Performance Budgets",
    category: "quality",
    status: "pass",
    message: `All ${report.totalChunks} production chunks comply with performance budgets (Total Gzip: ${(report.totalGzipBytes / 1024).toFixed(1)} kB).`,
  };
}

/**
 * Renders Bundle Budget Report adhering to Document-Driven CLI Output (design-cli-output)
 */
export function printBundleReport(
  report: BundleBudgetReport,
  options: BundleBudgetOptions = {}
): void {
  console.log(
    formatHeader(
      "DX BUNDLE ANALYZER — Production Chunk Guard",
      ".next/static/chunks • Gzip Performance Budgets"
    )
  );

  if (!report.isBuilt) {
    console.log(`### No Production Build Artifacts Found\n`);
    console.log(
      `To generate production chunks and evaluate performance budgets, run a production build:`
    );
    console.log(`\n  ${colors.brightGreen}npm run build${colors.reset}\n`);
    return;
  }

  console.log(
    `### Production Chunk Inventory · ${report.totalChunks} chunks · ${(report.totalGzipBytes / 1024).toFixed(1)} kB total gzip\n`
  );

  for (const chunk of report.chunks) {
    const nameCol =
      chunk.name.length > 40 ? chunk.name.slice(0, 37) + "..." : chunk.name;
    const rawKb = `${(chunk.rawBytes / 1024).toFixed(1)} kB raw`.padStart(13);
    const gzipKb = `${(chunk.gzipBytes / 1024).toFixed(1)} kB gzip`.padStart(
      15
    );
    const initBadge = chunk.isInitial
      ? `${colors.magenta}initial${colors.reset}`
      : `${colors.gray}async${colors.reset}`;

    console.log(
      `  ${colors.bold}${nameCol.padEnd(42)}${colors.reset} ${colors.cyan}${rawKb}${colors.reset} · ${colors.green}${gzipKb}${colors.reset} · ${initBadge}`
    );
  }

  if (options.limit && report.totalChunks > options.limit) {
    console.log(
      `  ${colors.gray}... and ${report.totalChunks - options.limit} more chunks (use --limit to expand)${colors.reset}`
    );
  }
  console.log("");

  if (report.violations.length > 0) {
    console.log(`### What's Actionable · Performance Budget Violations\n`);
    for (const v of report.violations) {
      console.log(`  ${colors.brightRed}✖ ${v}${colors.reset}`);
    }
    console.log(`\nTo remediate chunk budget violations:`);
    console.log(
      `1. Move heavy third-party libraries (e.g. three.js, jspdf) to dynamic imports (\`next/dynamic\`).`
    );
    console.log(`2. Audit shared component dependencies in package.json.`);
    console.log(`\n  ${colors.brightGreen}npm run quality${colors.reset}\n`);
  } else {
    console.log(`### All Performance Budgets Satisfied\n`);
    console.log(
      `Initial shared bundle (${(report.initialSharedGzipBytes / 1024).toFixed(1)} kB) is within ${(DEFAULT_BUDGETS.maxInitialSharedGzip / 1024).toFixed(0)} kB budget.`
    );
    console.log(`All individual chunk sizes comply with production SLAs.\n`);
  }

  console.log(`##### Metadata`);
  console.log(
    `*Initial Shared Gzip: ${(report.initialSharedGzipBytes / 1024).toFixed(1)} kB · Max Chunk Budget: ${(DEFAULT_BUDGETS.maxSingleChunkGzip / 1024).toFixed(0)} kB*`
  );
}
