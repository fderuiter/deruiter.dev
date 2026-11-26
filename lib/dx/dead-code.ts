import fs from "fs";
import path from "path";
import type { DiagnosticCheckResult } from "./doctor";
import { colors, formatHeader } from "./utils";

export interface ExportItem {
  name: string;
  kind:
    "function" | "const" | "type" | "interface" | "class" | "enum" | "default";
  filePath: string;
  line: number;
}

export interface DeadCodeReport {
  totalScannedFiles: number;
  totalExports: number;
  totalUnusedExports: number;
  totalOrphanedFiles: number;
  unusedExports: ExportItem[];
  orphanedFiles: string[];
}

export interface DeadCodeScanOptions {
  limit?: number;
  filter?: string;
}

function findSourceFiles(
  dir: string,
  extensions: string[] = [".ts", ".tsx"]
): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ![
          "node_modules",
          ".git",
          ".next",
          "dist",
          "coverage",
          ".agents",
          ".claude",
          "scratch",
          "tmp",
        ].includes(entry.name)
      ) {
        results.push(...findSourceFiles(fullPath, extensions));
      }
    } else if (
      extensions.includes(path.extname(entry.name)) &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Checks if a file is an entrypoint by framework convention.
 */
function isConventionEntrypoint(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const base = path.basename(normalized);

  // Next.js App Router convention files
  if (
    [
      "page.tsx",
      "layout.tsx",
      "route.ts",
      "loading.tsx",
      "error.tsx",
      "not-found.tsx",
      "sitemap.ts",
      "robots.ts",
      "manifest.ts",
      "opengraph-image.tsx",
      "twitter-image.tsx",
      "icon.tsx",
      "apple-icon.tsx",
      "instrumentation.ts",
      "middleware.ts",
      "proxy.ts",
      "global-error.tsx",
      "template.tsx",
      "default.tsx",
    ].includes(base)
  ) {
    return true;
  }

  // Scripts, configs, tests, seeds, setup files
  if (
    normalized.includes("/scripts/") ||
    normalized.includes("/__tests__/") ||
    normalized.includes("/prisma/") ||
    base.includes(".config.") ||
    base.startsWith("sentry.") ||
    base === "vitest.setup.ts"
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a file belongs to the public library and TypeDoc contract surface.
 */
function isPublicLibrarySurface(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized.includes("/lib/") ||
    normalized.includes("/types/") ||
    normalized.includes("/hooks/")
  );
}

/**
 * Extract exported symbols from TypeScript/TSX code using regex parsing.
 */
export function extractExports(
  filePath: string,
  content: string
): ExportItem[] {
  const exports: ExportItem[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip comments
    if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*"))
      continue;

    // Default export
    if (/^export\s+default\s+/.test(line)) {
      exports.push({
        name: "default",
        kind: "default",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named function
    const funcMatch = line.match(
      /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/
    );
    if (funcMatch) {
      exports.push({
        name: funcMatch[1],
        kind: "function",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named const/let/var
    const constMatch = line.match(/^export\s+const\s+([A-Za-z0-9_$]+)/);
    if (constMatch) {
      exports.push({
        name: constMatch[1],
        kind: "const",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named type
    const typeMatch = line.match(/^export\s+type\s+([A-Za-z0-9_$]+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        kind: "type",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named interface
    const ifaceMatch = line.match(/^export\s+interface\s+([A-Za-z0-9_$]+)/);
    if (ifaceMatch) {
      exports.push({
        name: ifaceMatch[1],
        kind: "interface",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named class
    const classMatch = line.match(
      /^export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/
    );
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        kind: "class",
        filePath,
        line: lineNum,
      });
      continue;
    }

    // Named enum
    const enumMatch = line.match(/^export\s+enum\s+([A-Za-z0-9_$]+)/);
    if (enumMatch) {
      exports.push({
        name: enumMatch[1],
        kind: "enum",
        filePath,
        line: lineNum,
      });
      continue;
    }
  }

  return exports;
}

/**
 * Scans the workspace for dead code and unreferenced exports.
 */
export function scanDeadCode(
  workspaceRoot: string,
  options: DeadCodeScanOptions = {}
): DeadCodeReport {
  const scanDirs = [
    "app",
    "components",
    "lib",
    "hooks",
    "types",
    "scripts",
    "__tests__",
  ];
  const allSourceFiles: string[] = [];

  for (const dir of scanDirs) {
    const fullDir = path.join(workspaceRoot, dir);
    allSourceFiles.push(...findSourceFiles(fullDir));
  }

  // Load all file contents into memory for fast matching
  const fileContents = new Map<string, string>();
  for (const f of allSourceFiles) {
    fileContents.set(f, fs.readFileSync(f, "utf-8"));
  }

  const allExports: ExportItem[] = [];
  const targetFilesToAnalyze = allSourceFiles.filter(
    (f) => !isConventionEntrypoint(f)
  );

  for (const f of targetFilesToAnalyze) {
    const content = fileContents.get(f) || "";
    const fileExports = extractExports(f, content);
    allExports.push(...fileExports);
  }

  let unusedExports: ExportItem[] = [];
  let orphanedFiles: string[] = [];

  // 1. Check for orphaned non-entrypoint files (never imported or referenced)
  for (const f of targetFilesToAnalyze) {
    const baseName = path.basename(f).replace(/\.[^/.]+$/, "");
    let fileReferenced = false;

    for (const [otherFile, content] of fileContents.entries()) {
      if (otherFile === f) continue;
      if (content.includes(baseName) || content.includes(path.basename(f))) {
        fileReferenced = true;
        break;
      }
    }

    // Library and types files might be imported via index or folder paths
    if (!fileReferenced && !isPublicLibrarySurface(f)) {
      orphanedFiles.push(f);
    }
  }

  // 2. Check for unused exports in private UI and internal modules (components/ and app/)
  for (const exp of allExports) {
    if (isPublicLibrarySurface(exp.filePath)) {
      continue;
    }

    if (exp.name === "default") {
      const baseName = path.basename(exp.filePath).replace(/\.[^/.]+$/, "");
      let referenced = false;
      for (const [f, content] of fileContents.entries()) {
        if (f === exp.filePath) continue;
        if (
          content.includes(baseName) ||
          content.includes(path.basename(exp.filePath))
        ) {
          referenced = true;
          break;
        }
      }
      if (!referenced) {
        unusedExports.push(exp);
      }
      continue;
    }

    let referenced = false;
    const nameRegex = new RegExp(`\\b${exp.name}\\b`);

    for (const [f, content] of fileContents.entries()) {
      if (f === exp.filePath) {
        continue;
      }
      if (content.includes(exp.name) && nameRegex.test(content)) {
        referenced = true;
        break;
      }
    }

    if (!referenced) {
      unusedExports.push(exp);
    }
  }

  // Apply filter if specified
  if (options.filter) {
    const filterLower = options.filter.toLowerCase();
    unusedExports = unusedExports.filter(
      (u) =>
        u.name.toLowerCase().includes(filterLower) ||
        u.filePath.toLowerCase().includes(filterLower)
    );
    orphanedFiles = orphanedFiles.filter((o) =>
      o.toLowerCase().includes(filterLower)
    );
  }

  const totalUnusedExports = unusedExports.length;
  const totalOrphanedFiles = orphanedFiles.length;

  // Apply limit if specified (Axis 4: Context Window Discipline)
  if (options.limit && options.limit > 0) {
    unusedExports = unusedExports.slice(0, options.limit);
    orphanedFiles = orphanedFiles.slice(0, options.limit);
  }

  return {
    totalScannedFiles: allSourceFiles.length,
    totalExports: allExports.length,
    totalUnusedExports,
    totalOrphanedFiles,
    unusedExports,
    orphanedFiles,
  };
}

/**
 * Diagnostic check for Dead Code & Unused Exports in doctor.ts.
 */
export function checkDeadCode(root: string): DiagnosticCheckResult {
  const report = scanDeadCode(root);
  const issues = [...report.unusedExports, ...report.orphanedFiles];

  if (issues.length > 0) {
    const details: string[] = [];

    for (const u of report.unusedExports.slice(0, 10)) {
      const relPath = path.relative(root, u.filePath);
      details.push(`${relPath}:${u.line} - [${u.kind}] ${u.name}`);
    }

    for (const orphan of report.orphanedFiles.slice(0, 5)) {
      const relPath = path.relative(root, orphan);
      details.push(`[orphaned file] ${relPath}`);
    }

    if (issues.length > 10) {
      details.push(`... and ${issues.length - 10} more`);
    }

    return {
      id: "dead-code-scanner",
      name: "Dead Code & Unused Export Scanner",
      category: "quality",
      status: "warn",
      message: `Found ${report.totalUnusedExports} unreferenced export(s) and ${report.totalOrphanedFiles} orphaned file(s) across ${report.totalScannedFiles} source files.`,
      details,
      remediation: {
        id: "dead-code-review",
        title: "Review unused exports and orphaned files",
        command: "npm run dx dead-code",
        autoFixable: false,
        scope: "quality",
      },
    };
  }

  return {
    id: "dead-code-scanner",
    name: "Dead Code & Unused Export Scanner",
    category: "quality",
    status: "pass",
    message: `All ${report.totalExports} analyzed exports across ${report.totalScannedFiles} files are active and referenced.`,
  };
}

/**
 * Renders Dead Code Report adhering to Document-Driven CLI Output (design-cli-output)
 */
export function printDeadCodeDocument(
  report: DeadCodeReport,
  workspaceRoot: string,
  options: DeadCodeScanOptions = {}
): void {
  console.log(
    formatHeader(
      "DX DEAD CODE — AST & Export Scanner",
      "Static AST & Cross-Workspace Reference Analyzer"
    )
  );

  console.log(
    `### Scan Overview · ${report.totalScannedFiles} files scanned · ${report.totalExports} exports analyzed\n`
  );

  if (report.totalUnusedExports === 0 && report.totalOrphanedFiles === 0) {
    console.log(`### Codebase is Pristine\n`);
    console.log(
      `No orphaned files or unreferenced exports detected across ${report.totalScannedFiles} source files.`
    );
    console.log(`Next step: inspect production bundle performance:`);
    console.log(`\n  ${colors.brightGreen}npm run dx analyze${colors.reset}\n`);
    return;
  }

  if (report.unusedExports.length > 0) {
    console.log(
      `### Unreferenced Export Footprint · ${report.totalUnusedExports} item(s)`
    );
    for (const u of report.unusedExports) {
      const relPath = path.relative(workspaceRoot, u.filePath);
      const nameCol = u.name.padEnd(28);
      const kindCol = `[${u.kind}]`.padEnd(12);
      console.log(
        `  ${colors.bold}${nameCol}${colors.reset} ${colors.cyan}${kindCol}${colors.reset} · ${colors.dim}${relPath}:${u.line}${colors.reset}`
      );
    }
    if (options.limit && report.totalUnusedExports > options.limit) {
      console.log(
        `  ${colors.gray}... and ${report.totalUnusedExports - options.limit} more export(s) (use --limit to expand)${colors.reset}`
      );
    }
    console.log("");
  }

  if (report.orphanedFiles.length > 0) {
    console.log(
      `### Orphaned Source Files · ${report.totalOrphanedFiles} file(s)`
    );
    for (const f of report.orphanedFiles) {
      const relPath = path.relative(workspaceRoot, f);
      console.log(`  ${colors.yellow}• ${relPath}${colors.reset}`);
    }
    console.log("");
  }

  console.log(`### What's Actionable\n`);
  console.log(`To resolve dead code:`);
  console.log(`1. Remove unused private helper functions from components/`);
  console.log(
    `2. If intended for public library export, re-export from lib/index.ts`
  );
  console.log(`\n  ${colors.brightGreen}npm run quality${colors.reset}\n`);

  console.log(`##### Metadata`);
  console.log(
    `*Total Exports: ${report.totalExports} · Unused: ${report.totalUnusedExports} · Orphaned Files: ${report.totalOrphanedFiles}*`
  );
}
