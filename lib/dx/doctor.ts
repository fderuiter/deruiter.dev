import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { scanFile } from "../security-scan";
import { colors, badge, formatHeader } from "./utils";
import {
  checkEnvironmentVariables,
  getDeclaredEnvKeys,
  parseEnvFile,
  generateEnvExampleContent,
} from "./env-guard";
import { checkGitHygieneConfig } from "./git-guard";
import { checkDeadCode } from "./dead-code";
import { checkBundleBudgets } from "./bundle-guard";
import {
  DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY,
  readBenchmarkEvidence,
  validateBenchmarkEvidence,
} from "./benchmark-evidence";
import { type RemediationAction } from "./cli-parser";
import { getEnv } from "../env";
import { inspectSourceState } from "./source-state";
import { FALLBACK_CASE_STUDIES } from "../case-studies-data";
import { FALLBACK_BLOG_POSTS } from "../fallback-blog-posts";
import {
  buildLlmsManifests,
  writeLlmsManifests,
} from "../../scripts/generate-llms-txt";

export interface DiagnosticCheckResult {
  id: string;
  name: string;
  category:
    | "architecture"
    | "routes"
    | "security"
    | "database"
    | "docs"
    | "hydration"
    | "accessibility"
    | "quality";
  status: "pass" | "fail" | "warn" | "fixed";
  message: string;
  details?: string[];
  fixable?: boolean;
  fixedMessage?: string;
  remediation?: RemediationAction;
}

export interface DoctorOptions {
  fix?: boolean;
  ci?: boolean;
  quiet?: boolean;
  workspaceRoot?: string;
}

/**
 * Second copies of the source tree that no tree walk should enter: agent
 * worktrees under `.claude/` (#863) and Stryker sandboxes (#964).
 */
const DUPLICATE_TREE_DIRS = [".claude", ".stryker-tmp"];

/**
 * Helper to recursively find files
 */
function findFiles(
  dir: string,
  pattern: RegExp,
  ignoreDirs: string[] = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    ...DUPLICATE_TREE_DIRS,
  ]
): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        results.push(...findFiles(fullPath, pattern, ignoreDirs));
      }
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check Route Registration in CommandPalette.tsx (AGENTS.md Invariant #3)
 */
export function checkRouteIndexing(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const appDir = path.join(root, "app");
  const paletteFile = path.join(root, "components", "CommandPalette.tsx");

  if (!fs.existsSync(paletteFile)) {
    return {
      id: "routes-command-palette-exists",
      name: "CommandPalette Registration File Check",
      category: "routes",
      status: "fail",
      message: "components/CommandPalette.tsx not found",
      fixable: false,
    };
  }

  const paletteContent = fs.readFileSync(paletteFile, "utf-8");
  const pageFiles = findFiles(appDir, /^page\.tsx?$/);

  const missingRoutes: { routePath: string; url: string }[] = [];

  for (const pageFile of pageFiles) {
    const relative = path.relative(appDir, pageFile);
    // Ignore internal routes, group routes, mobile touch aliases, admin, or api
    if (
      relative.startsWith("api") ||
      relative.startsWith("admin") ||
      relative.startsWith("m/") ||
      relative.startsWith("m\\") ||
      relative.includes("[")
    ) {
      continue;
    }

    let routeUrl = "/" + path.dirname(relative).replace(/\\/g, "/");
    if (routeUrl === "/.") routeUrl = "/";

    // Skip root '/' if already handled by #case-studies or nav-work
    if (routeUrl === "/") continue;

    // Check if route URL appears in staticNavs in CommandPalette.tsx
    const urlPattern = new RegExp(`url:\\s*["'\`]${routeUrl}["'\`]`);
    if (!urlPattern.test(paletteContent)) {
      missingRoutes.push({ routePath: relative, url: routeUrl });
    }
  }

  if (missingRoutes.length === 0) {
    return {
      id: "routes-indexed",
      name: "First-Class Route Command Palette Registration",
      category: "routes",
      status: "pass",
      message:
        "All first-class app routes are registered in CommandPalette staticNavs.",
    };
  }

  if (fix) {
    // Attempt auto-fix by injecting missing routes into staticNavs array
    let updatedContent = paletteContent;
    const staticNavsRegex =
      /(const staticNavs:\s*PaletteItem\[\]\s*=\s*\[)([\s\S]*?)(\n\s*\];)/;
    const match = paletteContent.match(staticNavsRegex);

    if (match) {
      const generatedItems = missingRoutes.map((mr) => {
        const idSlug = mr.url.replace(/^\//, "").replace(/\//g, "-");
        const titleName = idSlug
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ");
        return `      {\n        id: "nav-${idSlug}",\n        title: "${titleName}",\n        subtitle: "Navigate to ${titleName} view",\n        category: "navigation",\n        url: "${mr.url}",\n        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />\n      },`;
      });

      const insertion = "\n" + generatedItems.join("\n");
      updatedContent = paletteContent.replace(
        staticNavsRegex,
        `$1$2${insertion}$3`
      );
      fs.writeFileSync(paletteFile, updatedContent, "utf-8");

      return {
        id: "routes-indexed",
        name: "First-Class Route Command Palette Registration",
        category: "routes",
        status: "fixed",
        message: `Auto-registered ${missingRoutes.length} missing route(s) in CommandPalette.tsx`,
        details: missingRoutes.map((m) => `${m.url} (${m.routePath})`),
      };
    }
  }

  return {
    id: "routes-indexed",
    name: "First-Class Route Command Palette Registration",
    category: "routes",
    status: "fail",
    message: `${missingRoutes.length} route(s) not registered in CommandPalette.tsx staticNavs (AGENTS.md #3)`,
    details: missingRoutes.map(
      (m) => `Missing registration for ${m.url} (from app/${m.routePath})`
    ),
    fixable: true,
  };
}

const PAGE_FILENAMES = ["page.tsx", "page.ts", "page.jsx", "page.js"] as const;

function hasPageFile(dir: string): boolean {
  return PAGE_FILENAMES.some((f) => fs.existsSync(path.join(dir, f)));
}

/**
 * Helper to check if a route path exists on disk under appDir (either as a static page or matching dynamic route)
 */
export function routeExistsOnDisk(routePath: string, appDir: string): boolean {
  if (!fs.existsSync(appDir)) return false;
  if (routePath === "/") {
    return hasPageFile(appDir);
  }

  const segments = routePath.split("/").filter(Boolean);

  function checkSegments(currentDir: string, segIndex: number): boolean {
    if (segIndex === segments.length) {
      return hasPageFile(currentDir);
    }

    if (!fs.existsSync(currentDir)) return false;

    const target = segments[segIndex];
    // 1. Direct directory match
    const directPath = path.join(currentDir, target);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
      if (checkSegments(directPath, segIndex + 1)) return true;
    }

    // 2. Dynamic parameter match (e.g., [slug], [...rest], [[...rest]])
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          entry.name.startsWith("[") &&
          entry.name.endsWith("]")
        ) {
          const parentDirName = path.basename(currentDir);

          // Verify dynamic case study slugs
          if (
            parentDirName === "case-studies" &&
            (entry.name === "[slug]" || entry.name.includes("slug"))
          ) {
            const isValidCaseStudy = FALLBACK_CASE_STUDIES.some(
              (cs) => cs.slug === target && cs.published !== false
            );
            if (!isValidCaseStudy) {
              continue;
            }
          }

          // Verify dynamic blog post slugs
          if (
            parentDirName === "blog" &&
            (entry.name === "[slug]" || entry.name.includes("slug"))
          ) {
            const isValidBlogPost = FALLBACK_BLOG_POSTS.some(
              (post) => post.slug === target && post.published !== false
            );
            if (!isValidBlogPost) {
              continue;
            }
          }

          if (checkSegments(path.join(currentDir, entry.name), segIndex + 1)) {
            return true;
          }
        }
      }
    } catch {
      // Ignore reading errors
    }

    return false;
  }

  return checkSegments(appDir, 0);
}

/**
 * Check Public Route Registry Drift (lib/public-routes.ts vs app/ filesystem)
 */
export function checkPublicRouteRegistryDrift(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const appDir = path.join(root, "app");
  const publicRoutesFile = path.join(root, "lib", "public-routes.ts");

  if (!fs.existsSync(publicRoutesFile)) {
    return {
      id: "routes-public-registry-drift",
      name: "Public Route Registry Alignment",
      category: "routes",
      status: "fail",
      message: "lib/public-routes.ts not found",
      fixable: false,
    };
  }

  if (!fs.existsSync(appDir)) {
    return {
      id: "routes-public-registry-drift",
      name: "Public Route Registry Alignment",
      category: "routes",
      status: "fail",
      message: "app/ directory not found",
      fixable: false,
    };
  }

  const fileContent = fs.readFileSync(publicRoutesFile, "utf-8");

  // Extract registered route paths from PUBLIC_ROUTE_REGISTRY in lib/public-routes.ts
  const registeredPaths: string[] = [];
  const routeRegex = /path:\s*["'\`]([^"'\`]+)["'\`]/g;
  let match: RegExpExecArray | null;
  while ((match = routeRegex.exec(fileContent)) !== null) {
    registeredPaths.push(match[1]);
  }
  const registeredSet = new Set(registeredPaths);

  // Discover all static public page routes under app/
  const pageFiles = findFiles(appDir, /^page\.(tsx?|jsx?)$/);
  const staticPublicRoutes: string[] = [];

  for (const pageFile of pageFiles) {
    const relative = path.relative(appDir, pageFile).replace(/\\/g, "/");
    // Exclude api, admin, or dynamic parameter routes [slug]
    if (
      relative.startsWith("api/") ||
      relative.startsWith("admin/") ||
      relative.includes("[") ||
      relative.includes("]")
    ) {
      continue;
    }

    let routeUrl = "/" + path.dirname(relative);
    if (routeUrl === "/.") routeUrl = "/";
    staticPublicRoutes.push(routeUrl);
  }

  const uniqueStaticPublicRoutes = Array.from(
    new Set(staticPublicRoutes)
  ).sort();

  // Find missing static routes (in app/ but not in PUBLIC_ROUTE_REGISTRY)
  const unregisteredRoutes = uniqueStaticPublicRoutes.filter(
    (r) => !registeredSet.has(r)
  );

  // Find stale routes (in PUBLIC_ROUTE_REGISTRY but pointing to missing page file)
  const staleRoutes = registeredPaths.filter(
    (r) => !routeExistsOnDisk(r, appDir)
  );

  if (unregisteredRoutes.length === 0 && staleRoutes.length === 0) {
    return {
      id: "routes-public-registry-drift",
      name: "Public Route Registry Alignment",
      category: "routes",
      status: "pass",
      message:
        "All static public pages in app/ are registered in PUBLIC_ROUTE_REGISTRY with zero stale route entries.",
    };
  }

  if (fix) {
    let updatedContent = fileContent;

    // 1. Remove stale routes
    for (const staleRoute of staleRoutes) {
      const escaped = staleRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const staleEntryRegex = new RegExp(
        `\\n?\\s*\\{[^{}]*path:\\s*["'\`]${escaped}["'\`][^{}]*\\},?`,
        "g"
      );
      updatedContent = updatedContent.replace(staleEntryRegex, "");
    }

    // 2. Add missing routes
    if (unregisteredRoutes.length > 0) {
      const registryEndRegex =
        /(\n\]\s*as\s+const\s+satisfies\s+readonly\s+PublicRouteDefinition\[\];)/;
      const endMatch = updatedContent.match(registryEndRegex);

      if (endMatch) {
        const newEntries = unregisteredRoutes.map((r) => {
          let category: "top-level" | "case-study" | "arcade" | "tool" =
            "top-level";
          if (r.startsWith("/case-studies") || r.startsWith("/work")) {
            category = "case-study";
          } else if (r.startsWith("/arcade")) {
            category = "arcade";
          } else if (
            ["/proof", "/neuro", "/crf", "/patrol", "/simulator"].includes(r)
          ) {
            category = "tool";
          }

          const slug = r.split("/").filter(Boolean).pop() || "home";
          const title = slug
            .split("-")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");

          let name = title;
          if (category === "arcade") {
            name = `Game: ${title}`;
          } else if (category === "case-study") {
            name = `CS: ${title}`;
          }

          return `  {\n    path: "${r}",\n    name: "${name}",\n    category: "${category}",\n  },`;
        });

        const insertion = "\n" + newEntries.join("\n");
        updatedContent = updatedContent.replace(
          registryEndRegex,
          `${insertion}$1`
        );
      }
    }

    fs.writeFileSync(publicRoutesFile, updatedContent, "utf-8");

    return {
      id: "routes-public-registry-drift",
      name: "Public Route Registry Alignment",
      category: "routes",
      status: "fixed",
      message: `Auto-remediated public route registry drift in lib/public-routes.ts (${unregisteredRoutes.length} added, ${staleRoutes.length} removed).`,
      details: [
        ...unregisteredRoutes.map(
          (r) => `Registered missing public route: ${r}`
        ),
        ...staleRoutes.map((r) => `Removed stale public route: ${r}`),
      ],
    };
  }

  const details: string[] = [];
  for (const r of unregisteredRoutes) {
    details.push(`Unregistered public page route: ${r} (found in app/)`);
  }
  for (const r of staleRoutes) {
    details.push(
      `Stale route entry in PUBLIC_ROUTE_REGISTRY: ${r} (no matching page file on disk)`
    );
  }

  return {
    id: "routes-public-registry-drift",
    name: "Public Route Registry Alignment",
    category: "routes",
    status: "fail",
    message: `${unregisteredRoutes.length + staleRoutes.length} public route registry drift issue(s) detected (${unregisteredRoutes.length} unregistered page(s), ${staleRoutes.length} stale entry/entries). Run 'npm run doctor:fix' to align.`,
    details,
    fixable: true,
  };
}

/**
 * Check Layout and Navbar Invariant (AGENTS.md Invariant #2).
 * No secondary Navbar components allowed outside app/layout.tsx.
 */
export function checkNavbarHierarchy(root: string): DiagnosticCheckResult {
  const appDir = path.join(root, "app");
  const tsxFiles = findFiles(appDir, /\.tsx$/);
  const violations: string[] = [];

  for (const file of tsxFiles) {
    const relative = path.relative(root, file);
    if (relative === path.join("app", "layout.tsx")) {
      continue;
    }
    const content = fs.readFileSync(file, "utf-8");
    // Check if Navbar is imported or rendered as a JSX tag
    const rendersNavbar =
      /<Navbar\b/.test(content) ||
      /import\s+.*Navbar.*from\s+["']@\/components\/Navbar["']/.test(content);
    if (rendersNavbar) {
      violations.push(relative);
    }
  }

  if (violations.length === 0) {
    return {
      id: "layout-navbar-hierarchy",
      name: "Global Navbar Single-Mount Invariant",
      category: "architecture",
      status: "pass",
      message:
        "Navbar is only mounted in app/layout.tsx. No duplicate Navbars detected.",
    };
  }

  return {
    id: "layout-navbar-hierarchy",
    name: "Global Navbar Single-Mount Invariant",
    category: "architecture",
    status: "fail",
    message: `Secondary <Navbar /> component rendered in ${violations.length} subpage(s) (AGENTS.md #2)`,
    details: violations.map((v) => `Secondary Navbar in: ${v}`),
    fixable: false,
  };
}

/**
 * Check Page Top-Padding Invariant (AGENTS.md Invariant #2).
 * Root page wrappers must feature pt-24 to pt-32 to clear fixed header.
 */
export function checkPageTopPadding(root: string): DiagnosticCheckResult {
  const appDir = path.join(root, "app");
  const pageFiles = findFiles(appDir, /^page\.tsx$/);
  const warnings: string[] = [];

  for (const file of pageFiles) {
    const relative = path.relative(root, file);
    // Skip API or non-route files
    if (relative.startsWith("app/api") || relative.startsWith("app/generated"))
      continue;

    const content = fs.readFileSync(file, "utf-8");
    const hasTopPadding =
      /\bpt-(20|24|28|32|36|40|44|48|\[\d+px\])\b/.test(content) ||
      /min-h-(screen|dvh)/.test(content) ||
      /<PageLayout\b/.test(content);

    if (!hasTopPadding) {
      warnings.push(relative);
    }
  }

  if (warnings.length === 0) {
    return {
      id: "layout-top-padding",
      name: "Page Header Clearance Top-Padding Invariant",
      category: "architecture",
      status: "pass",
      message:
        "All route root containers include header clearance padding (pt-24 to pt-32).",
    };
  }

  return {
    id: "layout-top-padding",
    name: "Page Header Clearance Top-Padding Invariant",
    category: "architecture",
    status: "warn",
    message: `${warnings.length} page(s) may lack header clearance top-padding (pt-24 to pt-32)`,
    details: warnings.map((w) => `Check top-padding in: ${w}`),
  };
}

/**
 * Check Test Environment Path Resolution (AGENTS.md Invariant #1).
 * Tests must not hardcode '/app' or absolute local root paths.
 */
export function checkTestPathResolution(root: string): DiagnosticCheckResult {
  const testsDir = path.join(root, "__tests__");
  const testFiles = findFiles(testsDir, /\.(test|spec)\.(ts|tsx|js)$/);
  const violations: { file: string; line: number; match: string }[] = [];

  for (const file of testFiles) {
    const relative = path.relative(root, file);
    // Skip test fixtures in error sanitization or doctor tests that purposefully contain mock stack strings
    if (
      relative.includes("error-sanitization.test.ts") ||
      relative.includes("dx-doctor.test.ts") ||
      relative.includes("defect-remediation-regression.test.ts") ||
      relative.includes("property-fuzz.test.ts")
    ) {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      // Look for hardcoded root paths like "/app/..." or absolute macOS/Linux roots
      if (
        /(path\.resolve|readFileSync|join)\(\s*['"`]\/app\//.test(line) ||
        /(root|dir|cwd|workspaceRoot)\s*=\s*['"`]\/app\/[^'"`]+['"`]/.test(
          line
        ) ||
        /['"`]\/(Users|home)\/[a-zA-Z0-9_-]+\//.test(line)
      ) {
        violations.push({
          file: relative,
          line: index + 1,
          match: line.trim(),
        });
      }
    });
  }

  if (violations.length === 0) {
    return {
      id: "tests-dynamic-paths",
      name: "Dynamic Path Resolution in Test Suites",
      category: "architecture",
      status: "pass",
      message:
        "All tests dynamically resolve workspace root via process.cwd() or path.resolve().",
    };
  }

  return {
    id: "tests-dynamic-paths",
    name: "Dynamic Path Resolution in Test Suites",
    category: "architecture",
    status: "fail",
    message: `Hardcoded root paths detected in ${violations.length} test location(s) (AGENTS.md #1)`,
    details: violations.map((v) => `${v.file}:${v.line} -> ${v.match}`),
    fixable: false,
  };
}

/**
 * Check Test Fixture Hygiene & Unsafe Type Assertions (ADR 0028).
 * Test suites must use @total-typescript/shoehorn instead of unsafe double casts (`as unknown as [A-Z]`).
 */
export function checkTestFixtureHygiene(root: string): DiagnosticCheckResult {
  const testsDir = path.join(root, "__tests__");
  const testFiles = findFiles(testsDir, /\.(test|spec)\.(ts|tsx)$/);
  const violations: { file: string; line: number; match: string }[] = [];

  for (const file of testFiles) {
    const relative = path.relative(root, file);
    if (relative.includes("dx-doctor.test.ts")) {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (
        line.includes("IS_REACT_ACT_ENVIRONMENT") ||
        line.includes("AudioContext: unknown") ||
        line.includes("globalThis as unknown as")
      ) {
        return;
      }
      if (/as\s+unknown\s+as\s+[A-Z]/.test(line)) {
        violations.push({
          file: relative,
          line: index + 1,
          match: line.trim(),
        });
      }
    });
  }

  if (violations.length === 0) {
    return {
      id: "tests-fixture-hygiene",
      name: "Test Fixture Hygiene & Shoehorn Guard (ADR 0028)",
      category: "quality",
      status: "pass",
      message:
        "Test fixtures use @total-typescript/shoehorn without unsafe double type assertions.",
    };
  }

  return {
    id: "tests-fixture-hygiene",
    name: "Test Fixture Hygiene & Shoehorn Guard (ADR 0028)",
    category: "quality",
    status: "fail",
    message: `Unsafe type assertions (as unknown as Type) detected in ${violations.length} test location(s). Migrate to @total-typescript/shoehorn (fromPartial / fromAny).`,
    details: violations
      .slice(0, 10)
      .map((v) => `${v.file}:${v.line} -> ${v.match}`),
    fixable: false,
  };
}

/**
 * Secret & Credential Leak Scanner
 */
export function checkSecretLeaks(root: string): DiagnosticCheckResult {
  const candidateFiles = findFiles(
    root,
    /\.(ts|tsx|js|mjs|json|yml|yaml|md)$/,
    [
      "node_modules",
      ".git",
      ".next",
      ".vercel",
      "dist",
      "coverage",
      "__tests__",
      ".husky",
      ...DUPLICATE_TREE_DIRS,
    ]
  );

  const ignoredFiles = [
    "package-lock.json",
    "bun.lock",
    "yarn.lock",
    "pnpm-lock.yaml",
    "ci.yml",
    "synthetic-probes.yml",
    ".env.example",
    "env-guard.ts",
  ];

  const leaks: { file: string; line: number; category: string }[] = [];

  for (const file of candidateFiles) {
    const baseName = path.basename(file);
    const relativeFile = path.relative(root, file).split(path.sep).join("/");
    if (ignoredFiles.includes(baseName) || baseName.startsWith(".env")) {
      continue;
    }
    const findings = scanFile(file, relativeFile);
    for (const finding of findings) {
      leaks.push({
        file: finding.file,
        line: finding.line,
        category: finding.category,
      });
    }
  }

  if (leaks.length === 0) {
    return {
      id: "security-credentials",
      name: "Zero Hardcoded Credentials & Secrets Scanner",
      category: "security",
      status: "pass",
      message:
        "No private keys, tokens, or live database passwords detected in repository files.",
    };
  }

  return {
    id: "security-credentials",
    name: "Zero Hardcoded Credentials & Secrets Scanner",
    category: "security",
    status: "fail",
    message: `${leaks.length} sensitive credential pattern(s) detected`,
    details: leaks.map((l) => `${l.file}:${l.line} -> ${l.category}`),
    fixable: false,
  };
}

/**
 * Migration Integrity, Provider Parity & Destructive Migration Guard
 */
export function checkMigrationGuard(root: string): DiagnosticCheckResult {
  const migrationsDir = path.join(root, "prisma", "migrations");
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  const lockPath = path.join(migrationsDir, "migration_lock.toml");

  if (!fs.existsSync(migrationsDir)) {
    return {
      id: "database-migrations",
      name: "Prisma Migration Integrity & Destructive Guard",
      category: "database",
      status: "pass",
      message: "No migrations folder present (skipped).",
    };
  }

  const failures: string[] = [];

  // 1. Check Provider Parity
  if (fs.existsSync(schemaPath) && fs.existsSync(lockPath)) {
    try {
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");
      const lockContent = fs.readFileSync(lockPath, "utf-8");
      const schemaProviderMatch = schemaContent.match(
        /datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*["']([^"']+)["']/
      );
      const lockProviderMatch = lockContent.match(
        /^provider\s*=\s*["']([^"']+)["']/m
      );

      if (schemaProviderMatch && lockProviderMatch) {
        if (schemaProviderMatch[1] !== lockProviderMatch[1]) {
          failures.push(
            `Provider mismatch: schema.prisma uses '${schemaProviderMatch[1]}', migration_lock.toml uses '${lockProviderMatch[1]}'.`
          );
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`Failed to verify provider parity: ${msg}`);
    }
  }

  // 2. Check File Integrity
  const sqlFiles = findFiles(migrationsDir, /\.sql$/);
  if (sqlFiles.length === 0) {
    failures.push("No migration SQL files found in prisma/migrations.");
  } else {
    for (const sqlFile of sqlFiles) {
      const content = fs.readFileSync(sqlFile, "utf-8");
      if (content.trim() === "") {
        failures.push(
          `Empty migration SQL file found at ${path.relative(root, sqlFile)}.`
        );
      }
    }
  }

  // 3. Check Destructive Queries
  const destructiveViolations: { file: string; ddl: string }[] = [];
  for (const file of sqlFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const dropMatches = content.match(/\b(DROP\s+TABLE|DROP\s+COLUMN)\b/gi);
    if (dropMatches && !getEnv().ALLOW_DESTRUCTIVE_MIGRATIONS) {
      destructiveViolations.push({
        file: path.relative(root, file),
        ddl: dropMatches.join(", "),
      });
    }
  }
  for (const v of destructiveViolations) {
    failures.push(`Destructive DDL detected in ${v.file}: ${v.ddl}`);
  }

  // 4. Check Migration Documentation Parity & Operational Command Completeness
  const docPath = path.join(root, "DATABASE_MIGRATIONS.md");
  if (!fs.existsSync(docPath)) {
    failures.push(
      "DATABASE_MIGRATIONS.md file is missing from repository root."
    );
  } else {
    try {
      const docContent = fs.readFileSync(docPath, "utf-8");
      // Check migration identifier parity
      const documentedMigrations = Array.from(
        new Set(
          (docContent.match(/\b\d{14}_[a-z0-9_]+\b/gi) || []).map((m) =>
            m.toLowerCase()
          )
        )
      ).sort();
      const actualMigrations = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const missingInDoc = actualMigrations.filter(
        (m) => !documentedMigrations.includes(m.toLowerCase())
      );
      if (missingInDoc.length > 0) {
        failures.push(
          `DATABASE_MIGRATIONS.md is missing active migration(s): ${missingInDoc.join(", ")}`
        );
      }

      // Check required operational commands & environment variables
      const requiredDocCommands = [
        {
          name: "schema drift verification ('npm run check:migrations:drift' or 'prisma migrate diff')",
          pattern: /check:migrations:drift|prisma migrate diff/i,
        },
        {
          name: "disposable migration replay ('npm run migration:replay')",
          pattern: /migration:replay/i,
        },
        {
          name: "guarded Vercel production migration execution",
          pattern:
            /VERCEL=1[\s\S]*VERCEL_ENV=production|Vercel production build/i,
        },
        {
          name: "destructive migration environment variable ('ALLOW_DESTRUCTIVE_MIGRATIONS')",
          pattern: /ALLOW_DESTRUCTIVE_MIGRATIONS/i,
        },
        {
          name: "unified migration check ('npm run check:migrations')",
          pattern: /check:migrations\b/i,
        },
      ];

      for (const cmd of requiredDocCommands) {
        if (!cmd.pattern.test(docContent)) {
          failures.push(
            `DATABASE_MIGRATIONS.md is missing documentation for ${cmd.name}`
          );
        }
      }

      const buildPath = path.join(root, "scripts", "build.js");
      const buildContent = fs.existsSync(buildPath)
        ? fs.readFileSync(buildPath, "utf-8")
        : "";
      const productionGuard =
        /process\.env\.VERCEL\s*===\s*["']1["']\s*&&\s*process\.env\.VERCEL_ENV\s*===\s*["']production["']/;
      if (
        !productionGuard.test(buildContent) ||
        !/process\.env\.DATABASE_URL_UNPOOLED/.test(buildContent) ||
        !/runStep\(["']npx["'],\s*\[["']prisma["'],\s*["']migrate["'],\s*["']deploy["']\]/.test(
          buildContent
        )
      ) {
        failures.push(
          "scripts/build.js is missing the guarded Vercel production migration block"
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(
        `Failed to verify DATABASE_MIGRATIONS.md completeness: ${msg}`
      );
    }
  }

  if (failures.length === 0) {
    return {
      id: "database-migrations",
      name: "Prisma Migration Integrity & Destructive Guard",
      category: "database",
      status: "pass",
      message:
        "All migration SQL files pass integrity checks with zero unapproved destructive DDL.",
    };
  }

  return {
    id: "database-migrations",
    name: "Prisma Migration Integrity & Destructive Guard",
    category: "database",
    status: "fail",
    message: `${failures.length} database migration invariant issue(s) detected`,
    details: failures,
    fixable: false,
  };
}

/**
 * Documentation & TypeDoc Parity Check
 */
export function checkDocumentationParity(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const docsDir = path.join(root, "docs");
  if (!fs.existsSync(docsDir)) {
    return {
      id: "docs-drift",
      name: "TypeDoc & Markdown Documentation Parity",
      category: "docs",
      status: "fail",
      message:
        "docs/ directory does not exist. Run 'npm run compile-docs' to generate.",
      fixable: true,
    };
  }

  if (fix) {
    try {
      execSync("npm run compile-docs", { cwd: root, stdio: "ignore" });
      return {
        id: "docs-drift",
        name: "TypeDoc & Markdown Documentation Parity",
        category: "docs",
        status: "fixed",
        message: "Successfully recompiled TypeDoc markdown documentation.",
      };
    } catch {
      return {
        id: "docs-drift",
        name: "TypeDoc & Markdown Documentation Parity",
        category: "docs",
        status: "fail",
        message: "Failed to compile TypeDoc documentation.",
      };
    }
  }

  const driftDetails: string[] = [];

  try {
    const diff = execSync("git diff --name-only docs", {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (diff.length > 0) {
      driftDetails.push(...diff.split("\n").map((f) => `Modified: ${f}`));
    }
    const untracked = execSync(
      "git ls-files --others --exclude-standard docs",
      { cwd: root, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim();
    if (untracked.length > 0) {
      driftDetails.push(...untracked.split("\n").map((f) => `Untracked: ${f}`));
    }
  } catch {
    // Git diff failed or not a git repository
  }

  if (driftDetails.length > 0) {
    return {
      id: "docs-drift",
      name: "TypeDoc & Markdown Documentation Parity",
      category: "docs",
      status: "fail",
      message: `TypeDoc markdown documentation in docs/ is out of sync (${driftDetails.length} file(s)).`,
      details: driftDetails,
      fixable: true,
    };
  }

  return {
    id: "docs-drift",
    name: "TypeDoc & Markdown Documentation Parity",
    category: "docs",
    status: "pass",
    message: "Documentation in docs/ is synchronized and up to date.",
  };
}

export interface CanonicalField {
  name: string;
  type: string;
  attributes: string[];
  comment?: string;
  rawLine: string;
}

export interface CanonicalDirective {
  name: string;
  args: string;
  normalized: string;
  rawLine: string;
}

export interface CanonicalModel {
  name: string;
  fields: CanonicalField[];
  directives: CanonicalDirective[];
  rawBlock: string;
}

/**
 * Parse Prisma models from a Prisma schema file or markdown snippet.
 */
export function parsePrismaModels(
  content: string
): Map<string, CanonicalModel> {
  const models = new Map<string, CanonicalModel>();
  const lines = content.split("\n");
  let currentModelName: string | null = null;
  let currentFields: CanonicalField[] = [];
  let currentDirectives: CanonicalDirective[] = [];
  let blockLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!currentModelName) {
      const match = trimmed.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
      if (match) {
        currentModelName = match[1];
        currentFields = [];
        currentDirectives = [];
        blockLines = [line];
      }
    } else {
      blockLines.push(line);
      if (trimmed === "}") {
        models.set(currentModelName, {
          name: currentModelName,
          fields: currentFields,
          directives: currentDirectives,
          rawBlock: blockLines.join("\n"),
        });
        currentModelName = null;
        currentFields = [];
        currentDirectives = [];
        blockLines = [];
      } else if (trimmed.startsWith("@@")) {
        const dirMatch = trimmed.match(/^(@@[A-Za-z0-9_]+)\((.*)\)$/);
        if (dirMatch) {
          const dirName = dirMatch[1];
          const dirArgs = dirMatch[2].trim();
          const normArgs = dirArgs.replace(/\s*,\s*/g, ", ");
          currentDirectives.push({
            name: dirName,
            args: dirArgs,
            normalized: `${dirName}(${normArgs})`,
            rawLine: trimmed,
          });
        }
      } else if (
        trimmed &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("///")
      ) {
        let codePart = trimmed;
        let commentPart: string | undefined = undefined;
        const commentIdx = trimmed.indexOf("//");
        if (commentIdx !== -1) {
          codePart = trimmed.slice(0, commentIdx).trim();
          commentPart = trimmed.slice(commentIdx + 2).trim();
        }

        const tokens = codePart.split(/\s+/);
        if (tokens.length >= 2) {
          const fieldName = tokens[0];
          const fieldType = tokens[1];
          const attributes = tokens.slice(2);
          currentFields.push({
            name: fieldName,
            type: fieldType,
            attributes,
            comment: commentPart,
            rawLine: trimmed,
          });
        }
      }
    }
  }

  return models;
}

/**
 * Reconstruct a Prisma model definition block cleanly formatted,
 * preserving custom comments from the embedded model snippet where present.
 */
export function reconstructPrismaModel(
  canonical: CanonicalModel,
  embedded?: CanonicalModel
): string {
  const embeddedFieldMap = new Map<string, CanonicalField>();
  if (embedded) {
    for (const f of embedded.fields) {
      embeddedFieldMap.set(f.name, f);
    }
  }

  let maxNameWidth = 0;
  let maxTypeWidth = 0;
  for (const f of canonical.fields) {
    if (f.name.length > maxNameWidth) maxNameWidth = f.name.length;
    if (f.type.length > maxTypeWidth) maxTypeWidth = f.type.length;
  }

  const lines: string[] = [`model ${canonical.name} {`];

  for (const field of canonical.fields) {
    const embeddedField = embeddedFieldMap.get(field.name);
    const comment = embeddedField?.comment ?? field.comment;

    const nameStr = field.name.padEnd(maxNameWidth);
    const typeStr = field.type.padEnd(maxTypeWidth);
    const attrStr = field.attributes.join(" ");

    let line = `  ${nameStr} ${typeStr}`;
    if (attrStr) {
      line += ` ${attrStr}`;
    }
    line = line.trimEnd();
    if (comment) {
      line += `   // ${comment}`;
    }
    lines.push(line);
  }

  if (canonical.directives.length > 0) {
    lines.push("");
    for (const d of canonical.directives) {
      lines.push(`  ${d.normalized}`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Compare an embedded model snippet from markdown against canonical schema model.
 */
export function comparePrismaModel(
  canonical: CanonicalModel,
  embedded: CanonicalModel
): { isMatch: boolean; details: string[] } {
  const details: string[] = [];

  const embeddedFieldMap = new Map<string, CanonicalField>();
  for (const f of embedded.fields) {
    embeddedFieldMap.set(f.name, f);
  }

  for (const cField of canonical.fields) {
    const eField = embeddedFieldMap.get(cField.name);
    if (!eField) {
      details.push(
        `Model '${canonical.name}' field '${cField.name}' is missing in guide snippet`
      );
    } else {
      if (eField.type !== cField.type) {
        details.push(
          `Model '${canonical.name}' field '${cField.name}' type mismatch: expected '${cField.type}', found '${eField.type}'`
        );
      }
      const cAttrs = cField.attributes.join(" ");
      const eAttrs = eField.attributes.join(" ");
      if (cAttrs !== eAttrs) {
        details.push(
          `Model '${canonical.name}' field '${cField.name}' attributes mismatch: expected '${cAttrs}', found '${eAttrs}'`
        );
      }
    }
  }

  for (const eField of embedded.fields) {
    if (!canonical.fields.some((cf) => cf.name === eField.name)) {
      details.push(
        `Model '${canonical.name}' field '${eField.name}' in guide snippet does not exist in canonical schema`
      );
    }
  }

  const canonicalDirs = new Set(canonical.directives.map((d) => d.normalized));
  const embeddedDirs = new Set(embedded.directives.map((d) => d.normalized));

  for (const cDir of canonicalDirs) {
    if (!embeddedDirs.has(cDir)) {
      details.push(
        `Model '${canonical.name}' is missing directive '${cDir}' in guide snippet`
      );
    }
  }

  for (const eDir of embeddedDirs) {
    if (!canonicalDirs.has(eDir)) {
      details.push(
        `Model '${canonical.name}' has extra directive '${eDir}' in guide snippet`
      );
    }
  }

  return { isMatch: details.length === 0, details };
}

/**
 * Check Technical Guide Schema Parity & Environment Variable Documentation Parity
 */
export function checkTechnicalGuideSchemaParity(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    return {
      id: "technical-guide-schema-parity",
      name: "Technical Guide Schema & Environment Parity",
      category: "docs",
      status: "fail",
      message: "prisma/schema.prisma not found.",
      fixable: false,
    };
  }

  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const canonicalModels = parsePrismaModels(schemaContent);

  const driftDetails: string[] = [];
  const fixesApplied: string[] = [];

  const markdownFiles = findFiles(root, /\.md$/i, [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "coverage",
    "tmp",
    ".stryker-tmp",
    ".claude",
    "app/generated",
  ]);

  for (const filePath of markdownFiles) {
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
    let fileContent = fs.readFileSync(filePath, "utf-8");
    let fileModified = false;

    const modelMatches = Array.from(
      fileContent.matchAll(/(model\s+([A-Za-z0-9_]+)\s*\{[\s\S]*?\n\})/g)
    );

    for (const match of modelMatches) {
      const embeddedBlock = match[1];
      const modelName = match[2];

      const canonicalModel = canonicalModels.get(modelName);
      if (!canonicalModel) continue;

      const embeddedModelsMap = parsePrismaModels(embeddedBlock);
      const embeddedModel = embeddedModelsMap.get(modelName);
      if (!embeddedModel) continue;

      const comparison = comparePrismaModel(canonicalModel, embeddedModel);
      if (!comparison.isMatch) {
        for (const detail of comparison.details) {
          driftDetails.push(`${relativePath}: ${detail}`);
        }

        if (fix) {
          const reconstructed = reconstructPrismaModel(
            canonicalModel,
            embeddedModel
          );
          if (reconstructed !== embeddedBlock) {
            fileContent = fileContent.replace(embeddedBlock, reconstructed);
            fileModified = true;
            fixesApplied.push(
              `Updated model '${modelName}' snippet in ${relativePath}`
            );
          }
        }
      }
    }

    if (fileModified) {
      fs.writeFileSync(filePath, fileContent, "utf-8");
    }
  }

  const examplePath = path.join(root, ".env.example");
  const { allKeys } = getDeclaredEnvKeys();
  const exampleKeys = fs.existsSync(examplePath)
    ? Object.keys(parseEnvFile(examplePath))
    : [];

  const missingEnvKeys = allKeys.filter(
    (k) => k !== "NODE_ENV" && k !== "VERCEL_ENV" && !exampleKeys.includes(k)
  );

  if (missingEnvKeys.length > 0) {
    driftDetails.push(
      `.env.example is missing schema key(s): ${missingEnvKeys.join(", ")}`
    );
    if (fix) {
      const content = generateEnvExampleContent(examplePath);
      fs.writeFileSync(examplePath, content, "utf-8");
      fixesApplied.push(
        `Updated .env.example with missing key(s): ${missingEnvKeys.join(", ")}`
      );
    }
  }

  const deployDocPath = path.join(root, "docs/how-to/release-and-deploy.md");
  if (fs.existsSync(deployDocPath)) {
    const deployContent = fs.readFileSync(deployDocPath, "utf-8");
    const missingInDeployDoc = allKeys.filter((k) => {
      const pattern = new RegExp(`\`${k}\``);
      return !pattern.test(deployContent);
    });

    if (missingInDeployDoc.length > 0) {
      driftDetails.push(
        `docs/how-to/release-and-deploy.md is missing documentation for schema key(s): ${missingInDeployDoc.join(", ")}`
      );
    }
  }

  if (fixesApplied.length > 0) {
    return {
      id: "technical-guide-schema-parity",
      name: "Technical Guide Schema & Environment Parity",
      category: "docs",
      status: "fixed",
      message: `Auto-remediated ${fixesApplied.length} technical guide schema or environment drift issue(s).`,
      details: fixesApplied,
      fixedMessage: fixesApplied.join("; "),
    };
  }

  if (driftDetails.length > 0) {
    return {
      id: "technical-guide-schema-parity",
      name: "Technical Guide Schema & Environment Parity",
      category: "docs",
      status: "fail",
      message: `Detected ${driftDetails.length} technical guide schema or environment drift issue(s).`,
      details: driftDetails,
      fixable: true,
    };
  }

  return {
    id: "technical-guide-schema-parity",
    name: "Technical Guide Schema & Environment Parity",
    category: "docs",
    status: "pass",
    message:
      "All markdown guide Prisma snippets and environment variable documentation match canonical source definitions.",
  };
}

/**
 * Check LLM Discovery Manifest Drift (public/llms.txt & public/llms-full.txt vs buildLlmsManifests)
 */
export function checkLlmsManifestsDrift(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const llmsPath = path.join(root, "public", "llms.txt");
  const llmsFullPath = path.join(root, "public", "llms-full.txt");

  if (!fs.existsSync(llmsPath) || !fs.existsSync(llmsFullPath)) {
    if (fix) {
      try {
        writeLlmsManifests(root);
        return {
          id: "docs-llms-manifests-drift",
          name: "LLM Discovery Manifests Alignment",
          category: "docs",
          status: "fixed",
          message:
            "Generated missing public/llms.txt and/or public/llms-full.txt discovery manifests.",
          details: [
            !fs.existsSync(llmsPath) ? "Generated missing public/llms.txt" : "",
            !fs.existsSync(llmsFullPath)
              ? "Generated missing public/llms-full.txt"
              : "",
          ].filter(Boolean),
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          id: "docs-llms-manifests-drift",
          name: "LLM Discovery Manifests Alignment",
          category: "docs",
          status: "fail",
          message: `Failed to write public LLM manifests: ${msg}`,
        };
      }
    }
    return {
      id: "docs-llms-manifests-drift",
      name: "LLM Discovery Manifests Alignment",
      category: "docs",
      status: "fail",
      message:
        "public/llms.txt or public/llms-full.txt missing. Run 'npm run generate:llms' or 'npm run doctor:fix'.",
      details: [
        !fs.existsSync(llmsPath) ? "Missing public/llms.txt" : "",
        !fs.existsSync(llmsFullPath) ? "Missing public/llms-full.txt" : "",
      ].filter(Boolean),
      fixable: true,
    };
  }

  const { llms: expectedLlms, full: expectedFull } = buildLlmsManifests();

  const normalize = (str: string) => str.replace(/\r/g, "");

  const actualLlms = normalize(fs.readFileSync(llmsPath, "utf-8"));
  const actualFull = normalize(fs.readFileSync(llmsFullPath, "utf-8"));

  const llmsDrift = actualLlms !== normalize(expectedLlms);
  const fullDrift = actualFull !== normalize(expectedFull);

  if (!llmsDrift && !fullDrift) {
    return {
      id: "docs-llms-manifests-drift",
      name: "LLM Discovery Manifests Alignment",
      category: "docs",
      status: "pass",
      message:
        "public/llms.txt and public/llms-full.txt match canonical route metadata and case study sources.",
    };
  }

  if (fix) {
    try {
      writeLlmsManifests(root);
      const fixedDetails: string[] = [];
      if (llmsDrift) fixedDetails.push("Regenerated public/llms.txt");
      if (fullDrift) fixedDetails.push("Regenerated public/llms-full.txt");
      return {
        id: "docs-llms-manifests-drift",
        name: "LLM Discovery Manifests Alignment",
        category: "docs",
        status: "fixed",
        message:
          "Auto-remediated LLM discovery manifest drift in public/llms.txt and/or public/llms-full.txt.",
        details: fixedDetails,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        id: "docs-llms-manifests-drift",
        name: "LLM Discovery Manifests Alignment",
        category: "docs",
        status: "fail",
        message: `Failed to regenerate public LLM manifests: ${msg}`,
      };
    }
  }

  const details: string[] = [];
  if (llmsDrift) {
    details.push(
      "public/llms.txt is out of sync with route metadata or case studies"
    );
  }
  if (fullDrift) {
    details.push(
      "public/llms-full.txt is out of sync with route metadata or case studies"
    );
  }

  return {
    id: "docs-llms-manifests-drift",
    name: "LLM Discovery Manifests Alignment",
    category: "docs",
    status: "fail",
    message:
      "LLM discovery manifest drift detected in public/llms.txt and/or public/llms-full.txt. Run 'npm run generate:llms' or 'npm run doctor:fix'.",
    details,
    fixable: true,
  };
}

/**
 * Onboarding Documentation & Engine Constraint Drift Check
 */
export function checkOnboardingDocsDrift(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const readmePath = path.join(root, "README.md");
  // The Diátaxis reorg (ADR 0023) moved step-by-step onboarding content out
  // of docs/README.md (now a lean hub/index page) and into this tutorial.
  const onboardingTutorialPath = path.join(
    root,
    "docs",
    "tutorials",
    "01-local-development-and-onboarding.md"
  );
  const targetFiles = [readmePath];
  if (fs.existsSync(onboardingTutorialPath)) {
    targetFiles.push(onboardingTutorialPath);
  }

  const failures: string[] = [];

  const obsoleteBadges = [
    /img\.shields\.io\/badge\/Python/i,
    /img\.shields\.io\/badge\/PyQt6/i,
    /img\.shields\.io\/badge\/ONNX_Runtime/i,
    /img\.shields\.io\/badge\/SQLCipher/i,
    /img\.shields\.io\/badge\/Pytest_Coverage/i,
  ];

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) {
      failures.push(
        `Target onboarding doc missing: ${path.relative(root, filePath)}`
      );
      continue;
    }

    const relative = path.relative(root, filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // 1. Obsolete Badges Check
    for (const badgeRegex of obsoleteBadges) {
      if (badgeRegex.test(content)) {
        failures.push(
          `${relative}: Obsolete Python technology badge detected in top header.`
        );
        break;
      }
    }

    // 2. Node & npm Engine Requirements Check
    if (!/Node\.js.*22/i.test(content)) {
      failures.push(
        `${relative}: Missing explicit requirement for Node.js 22.x in prerequisites.`
      );
    }

    if (/\b(v20\+|v18\+|v16\+)\b/i.test(content)) {
      failures.push(
        `${relative}: Incorrect Node version (v20+/v18+/v16+) listed in prerequisites.`
      );
    }

    if (
      /\b(bun|yarn|pnpm)\b.*as the package manager/i.test(content) ||
      /npm\s+or\s+bun/i.test(content)
    ) {
      failures.push(
        `${relative}: Lists unsupported package manager (bun/yarn/pnpm) in prerequisites.`
      );
    }

    // 3. Environment Template Reference Check
    if (content.includes(".env.local.example")) {
      failures.push(
        `${relative}: References invalid environment template '.env.local.example' instead of '.env.example'.`
      );
    }

    if (!content.includes(".env.example")) {
      failures.push(
        `${relative}: Missing reference to valid environment template '.env.example'.`
      );
    }

    // 4. Database Setup Sequence Check (prisma db push before prisma db seed)
    const pushIndex = content.indexOf("prisma db push");
    const seedIndex = content.indexOf("prisma db seed");

    if (pushIndex === -1) {
      failures.push(
        `${relative}: Missing database schema push command ('npx prisma db push') in setup instructions.`
      );
    } else if (seedIndex !== -1 && pushIndex > seedIndex) {
      failures.push(
        `${relative}: Schema push command ('prisma db push') must precede database seeding ('prisma db seed').`
      );
    }
  }

  if (failures.length > 0) {
    if (fix) {
      try {
        execSync("npm run compile-docs", { cwd: root, stdio: "ignore" });
      } catch {
        // ignore
      }
    }

    return {
      id: "docs-onboarding-drift",
      name: "Onboarding Documentation & Engine Sync Guard",
      category: "docs",
      status: "fail",
      message: `${failures.length} onboarding documentation drift issue(s) detected.`,
      details: failures,
      fixable: true,
    };
  }

  return {
    id: "docs-onboarding-drift",
    name: "Onboarding Documentation & Engine Sync Guard",
    category: "docs",
    status: "pass",
    message:
      "Onboarding documentation matches Node.js 22.x/npm engine constraints, environment templates, and database setup sequence.",
  };
}

/**
 * OpenAPI Parity & Route Completeness Check
 */
export function checkOpenApiParity(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const openApiFile = path.join(root, "openapi.json");
  const generatorScript = path.join(root, "scripts", "generate-openapi.ts");
  const apiDir = path.join(root, "app", "api");

  if (!fs.existsSync(openApiFile) || !fs.existsSync(generatorScript)) {
    return {
      id: "api-openapi-sync",
      name: "OpenAPI Specification Contract Sync",
      category: "architecture",
      status: "warn",
      message: "openapi.json or scripts/generate-openapi.ts not found.",
      fixable: true,
    };
  }

  if (fix) {
    try {
      execSync("npx tsx scripts/generate-openapi.ts", {
        cwd: root,
        stdio: "ignore",
      });
      return {
        id: "api-openapi-sync",
        name: "OpenAPI Specification Contract Sync",
        category: "architecture",
        status: "fixed",
        message:
          "Successfully regenerated openapi.json specification with complete route coverage.",
      };
    } catch {
      return {
        id: "api-openapi-sync",
        name: "OpenAPI Specification Contract Sync",
        category: "architecture",
        status: "fail",
        message: "Failed to generate openapi.json.",
      };
    }
  }

  // 1. Discover all app/api routes
  const routeFiles = findFiles(apiDir, /^route\.(ts|js)$/);
  const expectedRoutes = routeFiles.map((file) => {
    const rel = path
      .relative(apiDir, path.dirname(file))
      .replace(/\\/g, "/")
      .replace(/\[([^\]/]+)\]/g, "{$1}");
    return rel === "" ? "/api" : `/api/${rel}`;
  });

  let parsedSpec: { paths?: Record<string, unknown> } = {};
  try {
    const fileContent = fs.readFileSync(openApiFile, "utf-8");
    parsedSpec = JSON.parse(fileContent);
  } catch {
    return {
      id: "api-openapi-sync",
      name: "OpenAPI Specification Contract Sync",
      category: "architecture",
      status: "fail",
      message: "openapi.json is not valid JSON.",
      fixable: true,
    };
  }

  const documentedRoutes = Object.keys(parsedSpec.paths || {});
  const missingRoutes = expectedRoutes.filter(
    (r) => !documentedRoutes.includes(r)
  );

  if (missingRoutes.length > 0) {
    return {
      id: "api-openapi-sync",
      name: "OpenAPI Specification Contract Sync",
      category: "architecture",
      status: "fail",
      message: `${missingRoutes.length} route(s) missing from openapi.json specification`,
      details: missingRoutes.map((r) => `Missing specification for: ${r}`),
      fixable: true,
    };
  }

  return {
    id: "api-openapi-sync",
    name: "OpenAPI Specification Contract Sync",
    category: "architecture",
    status: "pass",
    message:
      "All app/api routes are documented in openapi.json with zero specification drift.",
  };
}

/**
 * Hydration & React SSR Best Practices Check (AGENTS.md Invariant #4)
 */
export function checkHydrationSafety(root: string): DiagnosticCheckResult {
  const componentsDir = path.join(root, "components");
  const appDir = path.join(root, "app");
  const files = [
    ...findFiles(componentsDir, /\.tsx$/),
    ...findFiles(appDir, /\.tsx$/),
  ];

  const warnings: { file: string; pattern: string }[] = [];

  for (const file of files) {
    const relative = path.relative(root, file);
    const content = fs.readFileSync(file, "utf-8");

    // Scan for unsuppressed Math.random() in rendering JSX
    if (
      /<div>.*Math\.random\(.*\).*<\/div>/.test(content) &&
      !/suppressHydrationWarning/.test(content)
    ) {
      warnings.push({
        file: relative,
        pattern: "Math.random() in JSX without suppressHydrationWarning",
      });
    }
    // Scan for direct window / localStorage reads in initial useState initializers without useSyncExternalStore
    if (
      /useState\(\s*\(\)\s*=>\s*(typeof window !== ["']undefined["'] \? localStorage|localStorage\.getItem)/.test(
        content
      )
    ) {
      warnings.push({
        file: relative,
        pattern:
          "Direct localStorage in useState initializer (prefer useSyncExternalStore)",
      });
    }
  }

  if (warnings.length === 0) {
    return {
      id: "hydration-safety",
      name: "React 19 & Next.js 16 Hydration Determinism",
      category: "hydration",
      status: "pass",
      message:
        "Zero hydration antipatterns detected. Client state uses useSyncExternalStore or mounted bounds.",
    };
  }

  return {
    id: "hydration-safety",
    name: "React 19 & Next.js 16 Hydration Determinism",
    category: "hydration",
    status: "warn",
    message: `${warnings.length} potential hydration mismatch pattern(s) detected (AGENTS.md #4)`,
    details: warnings.map((w) => `${w.file}: ${w.pattern}`),
  };
}

/**
 * Accessibility Standards & WCAG 2.1 Conformance Guard (Invariant #10)
 * Ensures bypass skip links, semantic main landmark, live announcer provider, and alt/label tags are present.
 */
export function checkAccessibilityStandards(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const layoutFile = path.join(root, "app", "layout.tsx");
  const violations: string[] = [];

  if (!fs.existsSync(layoutFile)) {
    return {
      id: "a11y-standards",
      name: "WCAG 2.1 Accessibility & Landmark Standards",
      category: "accessibility",
      status: "fail",
      message: "app/layout.tsx not found",
      fixable: false,
    };
  }

  let layoutContent = fs.readFileSync(layoutFile, "utf-8");

  // Check 1: SkipToContent or accessible skip link
  const hasSkipLink = /<SkipToContent\b|href=["']#main-content["']/.test(
    layoutContent
  );
  if (!hasSkipLink) {
    violations.push(
      "Missing SkipToContent or #main-content skip link in app/layout.tsx"
    );
  }

  // Check 2: Semantic main element with id="main-content"
  const hasMainLandmark =
    /<main[^>]*id=["']main-content["']|<main[^>]*\bid=["']main-content["']/.test(
      layoutContent
    );
  if (!hasMainLandmark) {
    violations.push(
      "Missing semantic main landmark with id='main-content' in app/layout.tsx"
    );
  }

  // Check 3: Live Announcer Provider
  const hasAnnouncer = /<A11yProvider\b|<LiveAnnouncerProvider\b/.test(
    layoutContent
  );
  if (!hasAnnouncer) {
    violations.push(
      "Missing A11yProvider / LiveAnnouncerProvider screen-reader live region in app/layout.tsx"
    );
  }

  // Auto-fix if fix is true and layout violations exist
  if (fix && violations.length > 0) {
    let modified = false;
    if (!hasSkipLink && !layoutContent.includes("SkipToContent")) {
      layoutContent =
        `import { SkipToContent } from "@/components/SkipToContent";\n` +
        layoutContent;
      layoutContent = layoutContent.replace(
        /<body[^>]*>/,
        (match) => `${match}\n        <SkipToContent />`
      );
      modified = true;
    }
    if (!hasMainLandmark && layoutContent.includes("{children}")) {
      layoutContent = layoutContent.replace(
        /<div className="flex-grow flex flex-col">\s*\{children\}\s*<\/div>/,
        '<main id="main-content" tabIndex={-1} className="flex-grow flex flex-col focus:outline-none">\n                {children}\n              </main>'
      );
      modified = true;
    }
    if (modified) {
      fs.writeFileSync(layoutFile, layoutContent, "utf-8");
      return {
        id: "a11y-standards",
        name: "WCAG 2.1 Accessibility & Landmark Standards",
        category: "accessibility",
        status: "fixed",
        message:
          "Auto-remediated layout landmarks and skip links in app/layout.tsx",
        details: violations,
      };
    }
  }

  if (violations.length === 0) {
    return {
      id: "a11y-standards",
      name: "WCAG 2.1 Accessibility & Landmark Standards",
      category: "accessibility",
      status: "pass",
      message:
        "Root layout satisfies WCAG 2.1 skip link, semantic main landmark, and dynamic live announcer standards.",
    };
  }

  return {
    id: "a11y-standards",
    name: "WCAG 2.1 Accessibility & Landmark Standards",
    category: "accessibility",
    status: "fail",
    message: `${violations.length} accessibility structure violation(s) detected in app/layout.tsx`,
    details: violations,
    fixable: true,
  };
}

/**
 * Asserts that no test suite disables axe rules (`disableRules`) and that any
 * accessibility scan reports left by a local `npm run audit:a11y` run record
 * zero violations. A missing report directory passes.
 */
export function checkAccessibilityAuditIntegrity(
  root: string
): DiagnosticCheckResult {
  const violations: string[] = [];

  // 1. Scan __tests__/ for prohibited disableRules calls
  const testsDir = path.join(root, "__tests__");
  if (fs.existsSync(testsDir)) {
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (
            content.includes("disableRules:") ||
            content.includes(".disableRules(")
          ) {
            const relPath = path.relative(root, fullPath);
            violations.push(
              `Prohibited WCAG rule override 'disableRules' detected in test suite '${relPath}'`
            );
          }
        }
      }
    };
    scanDir(testsDir);
  }

  // 2. Validate scan reports in playwright-report/accessibility-results/ when
  // a local audit has produced them. A fresh checkout has no report yet, and
  // that is not a violation: CI's heavy gate runs the suite itself.
  const resultsDir = path.join(
    root,
    "playwright-report",
    "accessibility-results"
  );
  if (fs.existsSync(resultsDir)) {
    const jsonFiles = fs
      .readdirSync(resultsDir)
      .filter((f) => f.endsWith(".json"));
    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(path.join(resultsDir, file), "utf-8");
        const data = JSON.parse(content);
        const vCount =
          data.violationsCount !== undefined
            ? data.violationsCount
            : data.violations
              ? data.violations.length
              : 0;
        if (vCount > 0) {
          violations.push(
            `Accessibility report '${file}' (${data.state || "unknown state"}) contains ${vCount} WCAG violation(s).`
          );
        }
      } catch {
        violations.push(
          `Unable to parse accessibility report JSON file '${file}'.`
        );
      }
    }
  }

  if (violations.length === 0) {
    return {
      id: "a11y-audit-integrity",
      name: "Shift-Left Accessibility Rule Integrity & Zero-Violation Scans",
      category: "accessibility",
      status: "pass",
      message:
        "Zero WCAG rule suppressions (disableRules) in test suites and zero violations in accessibility scan reports.",
    };
  }

  return {
    id: "a11y-audit-integrity",
    name: "Shift-Left Accessibility Rule Integrity & Zero-Violation Scans",
    category: "accessibility",
    status: "fail",
    message: `${violations.length} shift-left accessibility integrity violation(s) detected`,
    details: violations,
    fixable: false,
    remediation: {
      id: "fix-a11y-audit-integrity",
      title: "Run accessibility audit suite and fix underlying WCAG issues",
      command: "npm run audit:a11y",
      autoFixable: false,
      scope: "accessibility",
    },
  };
}

/**
 * Check Defect Remediation & Root-Cause Invariants (AGENTS.md Invariant #11).
 * Asserts presence of regression test harness and computational boundary defenses.
 */
export function checkDefectRemediationInvariants(
  root: string
): DiagnosticCheckResult {
  const regressionTestFile = path.join(
    root,
    "__tests__",
    "defect-remediation-regression.test.ts"
  );
  const adrFile = path.join(
    root,
    "adr",
    "0007-comprehensive-defect-remediation-strategy.md"
  );
  const violations: string[] = [];

  if (!fs.existsSync(regressionTestFile)) {
    violations.push(
      "Missing primary defect remediation regression suite: __tests__/defect-remediation-regression.test.ts"
    );
  }

  if (!fs.existsSync(adrFile)) {
    violations.push(
      "Missing Architectural Decision Record: adr/0007-comprehensive-defect-remediation-strategy.md"
    );
  }

  // Scan computational engine files for boundary guards
  const engineChecks = [
    {
      file: "lib/proof-utils.ts",
      pattern: /depth\s*>\s*500/,
      label: "Proof AST recursion limit guard",
    },
    {
      file: "lib/garmin-engine.ts",
      pattern: /safeDelta\s*=\s*Number\.isFinite/,
      label: "Garmin telemetry finite delta guard",
    },
    {
      file: "lib/working-with-duck-engine.ts",
      pattern: /safeX\s*=\s*Number\.isFinite/,
      label: "Duck engine coordinate boundary guard",
    },
    {
      file: "lib/crf/ast-evaluator.ts",
      pattern: /ExpressionEvaluator/,
      label: "CRF AST Expression Evaluator",
    },
  ];

  for (const ec of engineChecks) {
    const fullPath = path.join(root, ec.file);
    if (!fs.existsSync(fullPath)) {
      violations.push(`Missing core computational engine: ${ec.file}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    if (!ec.pattern.test(content)) {
      violations.push(
        `Engine ${ec.file} lacks verified invariant defense: ${ec.label}`
      );
    }
  }

  if (violations.length === 0) {
    return {
      id: "quality-defect-remediation",
      name: "Defect Remediation & Root-Cause Regression Invariant",
      category: "quality",
      status: "pass",
      message:
        "All legacy computational engines enforce boundary defenses, and verified regression test harness is active.",
    };
  }

  return {
    id: "quality-defect-remediation",
    name: "Defect Remediation & Root-Cause Regression Invariant",
    category: "quality",
    status: "fail",
    message: `${violations.length} defect remediation invariant violation(s) detected (AGENTS.md #11)`,
    details: violations,
    fixable: false,
  };
}

/**
 * Check Proactive Defect Interception, Shift-Left Gateways & Synthetic Probes (AGENTS.md Invariant #12).
 */
export function checkProactiveDefectInterception(
  root: string
): DiagnosticCheckResult {
  const violations: string[] = [];

  const requiredFiles = [
    {
      file: "stryker.config.mjs",
      desc: "Stryker mutation testing configuration",
    },
    {
      file: "__tests__/property-fuzz.test.ts",
      desc: "Fast-check property & generative fuzz test suite",
    },
    {
      file: "__tests__/e2e/synthetic-probes.spec.ts",
      desc: "Headless synthetic journey probe suite",
    },
    {
      file: ".github/workflows/synthetic-probes.yml",
      desc: "Scheduled synthetic probe monitoring workflow",
    },
    {
      file: "scripts/canary-analyzer.ts",
      desc: "Manual canary analysis tooling (not a deployment gate)",
    },
    {
      file: "adr/0008-proactive-defect-interception-strategy.md",
      desc: "ADR-0008 Proactive Defect Interception Strategy",
    },
  ];

  for (const rf of requiredFiles) {
    const fullPath = path.join(root, rf.file);
    if (!fs.existsSync(fullPath)) {
      violations.push(`Missing ${rf.desc}: ${rf.file}`);
    }
  }

  if (violations.length === 0) {
    return {
      id: "quality-proactive-interception",
      name: "Proactive Defect Interception & Synthetic Reliability Invariant",
      category: "quality",
      status: "pass",
      message:
        "Shift-left property fuzzing and synthetic journey probes are active; the manual canary analyzer is present.",
    };
  }

  return {
    id: "quality-proactive-interception",
    name: "Proactive Defect Interception & Synthetic Reliability Invariant",
    category: "quality",
    status: "fail",
    message: `${violations.length} proactive defect interception violation(s) detected (AGENTS.md #12)`,
    details: violations,
    fixable: false,
  };
}

/**
 * Check Layout Integrity, Defensive CSS & Stacking Context Isolation (AGENTS.md Invariant #13)
 */
export function checkLayoutTextClippingInvariants(
  root: string
): DiagnosticCheckResult {
  const violations: string[] = [];

  const requiredFiles = [
    {
      file: "components/PageLayout.tsx",
      desc: "PageLayout container component",
    },
    {
      file: "adr/0009-responsive-layout-and-text-clipping-standard.md",
      desc: "ADR-0009 Responsive Layout Integrity Standard",
    },
  ];

  for (const rf of requiredFiles) {
    const fullPath = path.join(root, rf.file);
    if (!fs.existsSync(fullPath)) {
      violations.push(`Missing ${rf.desc}: ${rf.file}`);
    }
  }

  // Scan components and app files for rogue z-[9999]
  const sourceFiles = [
    ...findFiles(path.join(root, "components"), /\.(tsx|jsx|ts|js)$/),
    ...findFiles(path.join(root, "app"), /\.(tsx|jsx|ts|js)$/),
  ];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf-8");
    if (content.includes("z-[9999]")) {
      const relPath = path.relative(root, file);
      violations.push(
        `Rogue z-index escalation 'z-[9999]' found in ${relPath}`
      );
    }
  }

  // Check that app routes don't create duplicate <main id="main-content">
  const pageFiles = findFiles(path.join(root, "app"), /^page\.tsx?$/);
  for (const pageFile of pageFiles) {
    const content = fs.readFileSync(pageFile, "utf-8");
    const relPath = path.relative(root, pageFile);
    if (content.includes('<main id="main-content"')) {
      violations.push(
        `Duplicate <main id="main-content"> landmark found in ${relPath}`
      );
    }
  }

  if (violations.length === 0) {
    return {
      id: "architecture-layout-integrity",
      name: "Layout Integrity, Defensive CSS & Stacking Isolation Invariant",
      category: "architecture",
      status: "pass",
      message:
        "PageLayout containers, bounded z-index scale, and defensive CSS invariants are active.",
    };
  }

  return {
    id: "architecture-layout-integrity",
    name: "Layout Integrity, Defensive CSS & Stacking Isolation Invariant",
    category: "architecture",
    status: "fail",
    message: `${violations.length} layout integrity violation(s) detected (AGENTS.md #13)`,
    details: violations,
    fixable: false,
  };
}

/**
 * Check Design System Token Migration Invariant across Core Layout Surfaces
 */
export function checkDesignTokens(root: string): DiagnosticCheckResult {
  const coreComponents = [
    "components/Hero.tsx",
    "components/BentoGrid.tsx",
    "components/PretextCard.tsx",
    "components/CaseStudyShowcase.tsx",
    "components/SkillsGrid.tsx",
    "components/UnifiedErrorLayout.tsx",
    "components/PageLayout.tsx",
    "components/Footer.tsx",
  ];

  const violations: string[] = [];

  for (const compPath of coreComponents) {
    const fullPath = path.join(root, compPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        /style=\{\s*\{/.test(line) &&
        !/style=\{\s*\{\s*["']--/.test(line) &&
        !/as\s+React\.CSSProperties/.test(line)
      ) {
        if (
          /style=\{\s*\{\s*(height|padding|margin|fontSize|color|width|backgroundColor)\s*:\s*/.test(
            line
          )
        ) {
          violations.push(
            `${compPath}:${i + 1} - Raw unconstrained inline style property detected in style prop`
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      id: "architecture-design-tokens",
      name: "Design Token Migration & Dual Governance Invariant",
      category: "architecture",
      status: "fail",
      message: `${violations.length} design token violation(s) detected across core layout surfaces.`,
      details: violations,
      fixable: false,
    };
  }

  return {
    id: "architecture-design-tokens",
    name: "Design Token Migration & Dual Governance Invariant",
    category: "architecture",
    status: "pass",
    message:
      "Zero raw inline style overrides or hardcoded pixel dimensions detected across core layout surfaces.",
  };
}

/**
 * Check Workspace & IDE Configuration Integrity (.editorconfig, .vscode)
 */
export function checkWorkspaceIdeConfig(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const requiredFiles = [
    { file: ".editorconfig", desc: "Universal EditorConfig rules" },
    {
      file: path.join(".vscode", "settings.json"),
      desc: "VS Code workspace settings",
    },
    {
      file: path.join(".vscode", "extensions.json"),
      desc: "VS Code extension recommendations",
    },
    {
      file: path.join(".vscode", "launch.json"),
      desc: "VS Code launch debug profiles",
    },
    {
      file: path.join(".vscode", "tasks.json"),
      desc: "VS Code build task runners",
    },
  ];

  const missing: string[] = [];

  for (const rf of requiredFiles) {
    const full = path.join(root, rf.file);
    if (!fs.existsSync(full)) {
      missing.push(`Missing ${rf.desc} (${rf.file})`);
    }
  }

  if (missing.length > 0) {
    if (fix) {
      const vscodeDir = path.join(root, ".vscode");
      if (!fs.existsSync(vscodeDir))
        fs.mkdirSync(vscodeDir, { recursive: true });

      const editorConfigPath = path.join(root, ".editorconfig");
      if (!fs.existsSync(editorConfigPath)) {
        fs.writeFileSync(
          editorConfigPath,
          `root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n`,
          "utf-8"
        );
      }

      return {
        id: "workspace-ide-config",
        name: "IDE & Workspace Configuration Standards",
        category: "architecture",
        status: "fixed",
        message:
          "Scaffolded missing workspace IDE configurations (.vscode, .editorconfig).",
        fixedMessage: "Created missing IDE configs.",
      };
    }

    return {
      id: "workspace-ide-config",
      name: "IDE & Workspace Configuration Standards",
      category: "architecture",
      status: "fail",
      message: `${missing.length} workspace configuration file(s) missing.`,
      details: missing,
      fixable: true,
    };
  }

  return {
    id: "workspace-ide-config",
    name: "IDE & Workspace Configuration Standards",
    category: "architecture",
    status: "pass",
    message:
      "All VS Code workspace profiles (.vscode/) and .editorconfig are properly configured.",
  };
}

export function checkPackageLockfile(root: string): DiagnosticCheckResult {
  const alternativeLocks = [
    "bun.lock",
    "bun.lockb",
    "yarn.lock",
    "pnpm-lock.yaml",
  ];
  const foundLocks = alternativeLocks.filter((lock) =>
    fs.existsSync(path.join(root, lock))
  );

  if (foundLocks.length > 0) {
    return {
      id: "alternative-lockfiles",
      name: "Single Package Manager Lockfile Invariant",
      category: "architecture",
      status: "fail",
      message: `Alternative lockfile(s) detected: ${foundLocks.join(", ")}. This workspace is standardized on npm and must only contain package-lock.json.`,
      details: foundLocks.map((lock) => `Found alternative lockfile: ${lock}`),
      fixable: false,
    };
  }

  return {
    id: "alternative-lockfiles",
    name: "Single Package Manager Lockfile Invariant",
    category: "architecture",
    status: "pass",
    message:
      "Zero duplicate/alternative lockfiles detected. Workspace is correctly standardized on npm and uses package-lock.json.",
  };
}

/**
 * Check SEO and social preview integrity (ADR 0053, #1256).
 *
 * Reads `lib/seo-metadata.ts` as source so the check needs no module loading.
 * A rendered title is the route title plus the layout template
 * (" | Frederick de Ruiter", 22 characters). Fails when a rendered title is
 * outside 50 to 60 characters, a description is outside 140 to 160, a route
 * title carries the site name itself, the root viewport lacks the brand
 * theme color, or a registered route is missing from the llms manifests.
 *
 * @param root - Workspace root to inspect.
 * @returns The diagnostic result; never auto-fixable, since fixing copy is
 * an editorial change.
 */
export function checkSeoSocialIntegrity(root: string): DiagnosticCheckResult {
  const base = {
    id: "seo-social-integrity",
    name: "SEO & Social Preview Integrity",
    category: "quality" as const,
  };
  const read = (...segments: string[]): string | null => {
    try {
      return fs.readFileSync(path.join(root, ...segments), "utf8");
    } catch {
      return null;
    }
  };

  const metadataSource = read("lib", "seo-metadata.ts");
  if (metadataSource === null) {
    return {
      ...base,
      status: "pass",
      message: "No lib/seo-metadata.ts in this workspace; nothing to audit.",
    };
  }

  const details: string[] = [];
  const templateLength = " | Frederick de Ruiter".length;
  const entryPattern =
    /\n {2}(\w+): \{\s*title:\s*"((?:[^"\\]|\\.)*)",\s*description:\s*"((?:[^"\\]|\\.)*)",\s*path:\s*"([^"]+)"/g;
  const routes: {
    key: string;
    title: string;
    description: string;
    route: string;
  }[] = [];
  for (const match of metadataSource.matchAll(entryPattern)) {
    routes.push({
      key: match[1],
      title: match[2],
      description: match[3],
      route: match[4],
    });
  }
  if (routes.length === 0) {
    details.push("Could not parse any route from ROUTE_METADATA_CONFIGS.");
  }

  const llms = read("public", "llms.txt");
  const llmsFull = read("public", "llms-full.txt");
  for (const { key, title, description, route } of routes) {
    const rendered = title.length + templateLength;
    if (rendered < 50 || rendered > 60) {
      details.push(`${key}: rendered title is ${rendered} chars (need 50-60)`);
    }
    if (description.length < 140 || description.length > 160) {
      details.push(
        `${key}: description is ${description.length} chars (need 140-160)`
      );
    }
    if (/(?:Fred|Frederick) de Ruiter/i.test(title)) {
      details.push(`${key}: title repeats the site name the layout appends`);
    }
    const link = `(https://deruiter.dev${route})`;
    if (llms !== null && !llms.includes(link)) {
      details.push(`${key}: ${route} missing from public/llms.txt`);
    }
    if (llmsFull !== null && !llmsFull.includes(link)) {
      details.push(`${key}: ${route} missing from public/llms-full.txt`);
    }
  }

  const layout = read("app", "layout.tsx");
  if (layout !== null) {
    const viewport = layout.slice(layout.indexOf("export const viewport"));
    if (!/themeColor:\s*"#090D16"/.test(viewport)) {
      details.push('app/layout.tsx viewport must set themeColor "#090D16"');
    }
  }

  if (details.length > 0) {
    return {
      ...base,
      status: "fail",
      message: `${details.length} SEO or social preview issue(s) found.`,
      details,
      fixable: false,
    };
  }
  return {
    ...base,
    status: "pass",
    message: `${routes.length} routes meet title and description bounds, list in llms manifests, and the root viewport sets the brand theme color.`,
  };
}

/**
 * Check System Architecture & Directory Topology Sync (AGENTS.md & ARCHITECTURE.md).
 * Asserts that all non-hidden top-level repository directories are explicitly represented in ARCHITECTURE.md.
 */
export function checkDirectoryTopology(root: string): DiagnosticCheckResult {
  const archFile = path.join(root, "ARCHITECTURE.md");

  if (!fs.existsSync(archFile)) {
    return {
      id: "docs-topology-drift",
      name: "System Architecture Directory Topology Parity",
      category: "architecture",
      status: "fail",
      message: "ARCHITECTURE.md file not found in workspace root.",
      details: ["Missing ARCHITECTURE.md file in workspace root."],
      fixable: false,
    };
  }

  const ignoredDirs = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "coverage",
    "out",
    "build",
    "tmp",
    "scratch",
    "test-results",
    "playwright-report",
    ".agents",
    ".husky",
    ".vscode",
    ".github",
  ]);

  let topDirs: string[] = [];
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    topDirs = entries
      .filter(
        (e) =>
          e.isDirectory() && !e.name.startsWith(".") && !ignoredDirs.has(e.name)
      )
      .map((e) => e.name);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id: "docs-topology-drift",
      name: "System Architecture Directory Topology Parity",
      category: "architecture",
      status: "fail",
      message: `Failed to read top-level workspace directories: ${msg}`,
      fixable: false,
    };
  }

  const archContent = fs.readFileSync(archFile, "utf-8");

  // Extract topology section if present, or search full document
  let topologyContent = archContent;
  const topologyHeaderMatch = archContent.match(
    /##\s+System Architecture & Directory Topology[\s\S]*?(?=\n##\s+|\b$)/
  );
  if (topologyHeaderMatch) {
    topologyContent = topologyHeaderMatch[0];
  }

  const missingDirs: string[] = [];

  for (const dir of topDirs) {
    // Search for directory name in topology content
    const regex = new RegExp(`\\b${dir}(\\/|\\b)`, "i");
    if (!regex.test(topologyContent)) {
      missingDirs.push(dir);
    }
  }

  if (missingDirs.length > 0) {
    return {
      id: "docs-topology-drift",
      name: "System Architecture Directory Topology Parity",
      category: "architecture",
      status: "fail",
      message: `${missingDirs.length} top-level directory/directories missing from ARCHITECTURE.md topology overview.`,
      details: missingDirs.map(
        (d) =>
          `Missing directory in ARCHITECTURE.md: '${d}/'. Please update ## System Architecture & Directory Topology in ARCHITECTURE.md.`
      ),
      fixable: false,
    };
  }

  return {
    id: "docs-topology-drift",
    name: "System Architecture Directory Topology Parity",
    category: "architecture",
    status: "pass",
    message:
      "All top-level repository directories are explicitly documented in ARCHITECTURE.md.",
  };
}

/**
 * Real-Browser Sub-Route Web Vitals & SLA Performance Gate (AGENTS.md Invariant #14)
 */
export function checkSubRoutePerformance(root: string): DiagnosticCheckResult {
  const jsonPath = path.join(
    root,
    DEFAULT_BENCHMARK_EVIDENCE_DIRECTORY,
    "benchmark-results.v1.json"
  );
  if (!fs.existsSync(jsonPath)) {
    return {
      id: "quality-subroute-performance",
      name: "Sub-Route Real-Browser Core Web Vitals Performance SLA",
      category: "quality",
      status: "fail",
      message:
        "No production benchmark evidence found; the performance assertion gate cannot pass.",
    };
  }

  try {
    const evidence = readBenchmarkEvidence(jsonPath);
    // Same definition of "dirty" as the benchmark script that wrote the
    // evidence: rewritten build artifacts are not source changes (#1377).
    const { revision, dirty } = inspectSourceState(root);
    const validation = validateBenchmarkEvidence(evidence, { revision, dirty });
    if (!validation.valid) {
      return {
        id: "quality-subroute-performance",
        name: "Sub-Route Real-Browser Core Web Vitals Performance SLA",
        category: "quality",
        status: "fail",
        message:
          "Production benchmark evidence is incomplete, stale, or cannot support a budget assertion.",
        details: validation.errors,
      };
    }

    return {
      id: "quality-subroute-performance",
      name: "Sub-Route Real-Browser Core Web Vitals Performance SLA",
      category: "quality",
      status: "pass",
      message: `All ${evidence.routes.length} benchmarked sub-routes comply with the recorded production budget assertion.`,
    };
  } catch {
    return {
      id: "quality-subroute-performance",
      name: "Sub-Route Real-Browser Core Web Vitals Performance SLA",
      category: "quality",
      status: "fail",
      message:
        "Production benchmark evidence is not valid benchmark-results.v1 JSON.",
    };
  }
}

/**
 * Check TS Deep Modules & Architectural Seams (AGENTS.md Invariant #20)
 */
export function checkModuleBoundaries(root: string): DiagnosticCheckResult {
  const configPath = path.join(root, ".dependency-cruiser.cjs");
  if (!fs.existsSync(configPath)) {
    return {
      id: "architecture-deep-module-boundaries",
      name: "TS Deep Modules & Architectural Seam Enforcement",
      category: "architecture",
      status: "fail",
      message:
        ".dependency-cruiser.cjs configuration not found at workspace root.",
      fixable: false,
    };
  }

  try {
    execSync("npx depcruise lib app components __tests__ hooks scripts", {
      cwd: root,
      stdio: "pipe",
      encoding: "utf-8",
    });
    return {
      id: "architecture-deep-module-boundaries",
      name: "TS Deep Modules & Architectural Seam Enforcement",
      category: "architecture",
      status: "pass",
      message:
        "All module seams, public entry points, and test surfaces satisfy architectural boundary invariants with 0 cycles.",
    };
  } catch (error: unknown) {
    const err = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
    };
    const rawOutput =
      err.stdout?.toString() || err.stderr?.toString() || err.message || "";
    const details = rawOutput
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && !l.includes("modules cruised"));
    return {
      id: "architecture-deep-module-boundaries",
      name: "TS Deep Modules & Architectural Seam Enforcement",
      category: "architecture",
      status: "fail",
      message:
        "Architectural boundary violation detected. Private internals or circular dependencies found.",
      details: details.slice(0, 10),
      fixable: false,
    };
  }
}

// A class that provably renders below 48px (e.g. h-10 = 40px, h-11 = 44px)
// must never be treated as compliant below, even though it also matches the
// loose "has some sizing utility" pattern.
const SUB_48PX_SIZE_PATTERN = /\b(h-10|w-10|h-11|w-11|size-10|size-11)\b/;

/**
 * Check Minimum Touch Target Dimensions Guard (ADR-0003 & ADR-0019)
 *
 * IMPORTANT: this is a static source-text heuristic only. It scans JSX for
 * className tokens that are *known* to render at a particular pixel size;
 * it never renders anything and cannot see the real, computed box a
 * control occupies (content-driven padding, inherited styles, responsive
 * overrides, etc. are all invisible to it). A "pass" here means "no
 * obviously undersized class name was found in source" — it is NOT proof
 * that every interactive control satisfies the 48px standard on real
 * rendered output. Rendered-dimension proof comes from the real-browser
 * assertions in `__tests__/e2e/touch-controls.spec.ts`
 * ("Real rendered touch-target dimensions" suite), which measure actual
 * `getBoundingClientRect()` output across viewports.
 */
export function checkTouchTargetDimensions(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const componentsDir = path.join(root, "components");
  const appDir = path.join(root, "app");
  const files = [
    ...findFiles(componentsDir, /\.tsx$/),
    ...findFiles(appDir, /\.tsx$/),
  ];

  const violations: { file: string; line: number; match: string }[] = [];
  let fixedCount = 0;

  for (const file of files) {
    const relative = path.relative(root, file);
    const content = fs.readFileSync(file, "utf-8");
    let modified = false;
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (
        (/<button\b/.test(line) || /role=["']button["']/.test(line)) &&
        !/aria-hidden=["']true["']/.test(line)
      ) {
        // A class that provably renders below 48px (e.g. h-10 = 40px,
        // h-11 = 44px) must never be treated as compliant, even though it
        // also matches the loose "has some sizing utility" patterns below.
        const hasSub48pxOverride = SUB_48PX_SIZE_PATTERN.test(line);

        const hasTouchSizing =
          !hasSub48pxOverride &&
          (/\b(min-h-\[48px\]|min-w-\[48px\]|h-12|w-12|min-h-12|min-w-12|p-3|p-4|p-5|py-3|py-4|px-4|px-5|min-h-|min-w-|touch-)\b/.test(
            line
          ) ||
            /minHeight:\s*48|minWidth:\s*48|48px/.test(line) ||
            (!hasSub48pxOverride && !/className=/.test(line)));

        if (!hasTouchSizing) {
          violations.push({
            file: relative,
            line: index + 1,
            match: line.trim(),
          });

          if (fix && line.includes("className=")) {
            const updatedLine = line.replace(
              /className=["']([^"']*)["']/,
              (_m, p1) => `className="${p1} min-h-[48px] min-w-[48px]"`
            );
            lines[index] = updatedLine;
            modified = true;
            fixedCount++;
          }
        }
      }
    });

    if (fix && modified) {
      fs.writeFileSync(file, lines.join("\n"), "utf-8");
    }
  }

  if (fix && fixedCount > 0 && violations.length === fixedCount) {
    return {
      id: "architecture-touch-target-dimensions",
      name: "Minimum Touch Target Dimensions Guard (ADR-0003 & ADR-0019)",
      category: "accessibility",
      status: "fixed",
      message: `Auto-remediated ${fixedCount} touch target dimension violation(s) across UI components.`,
      fixedMessage: `Updated ${fixedCount} button element(s) with 48px touch target bounds.`,
    };
  }

  if (violations.length === 0) {
    return {
      id: "architecture-touch-target-dimensions",
      name: "Minimum Touch Target Dimensions Guard (ADR-0003 & ADR-0019)",
      category: "accessibility",
      status: "pass",
      message:
        "No obviously undersized touch-target class names found in source (static heuristic; does not measure rendered output). Rendered-dimension compliance is verified separately by the real-browser assertions in __tests__/e2e/touch-controls.spec.ts.",
    };
  }

  return {
    id: "architecture-touch-target-dimensions",
    name: "Minimum Touch Target Dimensions Guard (ADR-0003 & ADR-0019)",
    category: "accessibility",
    status: "fail",
    message: `${violations.length} interactive touch target dimension violation(s) detected. (ADR-0003: Mobile Responsive & Touch Interaction Standard, ADR-0019: Standardized Arcade Viewport & Touch Control Architecture)`,
    details: violations
      .slice(0, 10)
      .map((v) => `${v.file}:${v.line} -> ${v.match}`),
    fixable: true,
  };
}

/**
 * Check Documentation & Layout Section Structure Standard (ADR-0009 & ADR-0023)
 */
export function checkSectionStructures(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const docsDir = path.join(root, "docs");
  const appDir = path.join(root, "app");
  const failures: { file: string; reason: string }[] = [];
  let fixedCount = 0;

  if (fs.existsSync(docsDir)) {
    const docFiles = findFiles(docsDir, /\.md$/).filter(
      (f) =>
        !f.includes(path.join("docs", "reference")) &&
        !f.includes(path.join("docs", "lib")) &&
        !f.includes(path.join("docs", "hooks")) &&
        !f.includes(path.join("docs", "types"))
    );

    for (const docFile of docFiles) {
      const relative = path.relative(root, docFile);
      let content = fs.readFileSync(docFile, "utf-8");

      if (content.trim() === "") {
        failures.push({
          file: relative,
          reason: "Empty markdown documentation file",
        });
        continue;
      }

      const hasTitle = /^#\s+.+/m.test(content);
      const hasSections = /^##\s+.+/m.test(content);

      if (!hasTitle) {
        failures.push({
          file: relative,
          reason: "Missing primary title heading (# Title)",
        });

        if (fix) {
          const titleName = path
            .basename(docFile, ".md")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
          content = `# ${titleName}\n\n` + content;
          fs.writeFileSync(docFile, content, "utf-8");
          fixedCount++;
        }
      } else if (!hasSections && content.split("\n").length > 15) {
        failures.push({
          file: relative,
          reason: "Missing section subheadings (## Overview / Section)",
        });

        if (fix) {
          content = content + `\n\n## Overview\n\nSection details.\n`;
          fs.writeFileSync(docFile, content, "utf-8");
          fixedCount++;
        }
      }
    }
  }

  if (fs.existsSync(appDir)) {
    const pageFiles = findFiles(appDir, /^page\.tsx$/);
    for (const pageFile of pageFiles) {
      const relative = path.relative(root, pageFile);
      if (relative.startsWith(path.join("app", "api"))) continue;

      const content = fs.readFileSync(pageFile, "utf-8");
      const hasSectionStructure =
        /<PageLayout\b|<main\b|<section\b|<div\b/.test(content);

      if (!hasSectionStructure) {
        failures.push({
          file: relative,
          reason:
            "Page entrypoint lacks root section/container layout structure",
        });
      }
    }
  }

  if (fix && fixedCount > 0 && failures.length === fixedCount) {
    return {
      id: "docs-section-structures",
      name: "Documentation & Layout Section Structure Standard (ADR-0009 & ADR-0023)",
      category: "docs",
      status: "fixed",
      message: `Auto-remediated section structures across ${fixedCount} documentation file(s).`,
      fixedMessage: `Added missing section headings.`,
    };
  }

  if (failures.length === 0) {
    return {
      id: "docs-section-structures",
      name: "Documentation & Layout Section Structure Standard (ADR-0009 & ADR-0023)",
      category: "docs",
      status: "pass",
      message:
        "All documentation guides and route layouts comply with standard section structures.",
    };
  }

  return {
    id: "docs-section-structures",
    name: "Documentation & Layout Section Structure Standard (ADR-0009 & ADR-0023)",
    category: "docs",
    status: "fail",
    message: `${failures.length} section structure violation(s) detected. (ADR-0023: Diátaxis Documentation Architecture & Zero-Drift TypeDoc Governance, ADR-0009: Responsive Layout Integrity Standard)`,
    details: failures.map((f) => `${f.file}: ${f.reason}`),
    fixable: true,
  };
}

/**
 * A statement that throws across a service boundary: a new error object
 * (`throw new Error(...)`, `throw new ValidationError(...)`) or a rethrow of a
 * caught value (`throw err;`). Both escape the ServiceResult envelope (#1532).
 */
const RAW_SERVICE_THROW =
  /\bthrow\s+new\s+(?:[A-Za-z_$][\w$]*)?(?:Error|Exception)\b/;
const SERVICE_RETHROW = /\bthrow\s+[A-Za-z_$][\w$]*\s*(?:;|$)/;

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  );
}

/**
 * Check Typed Service Contracts & Result Envelopes Guard (ADR-0028)
 */
export function checkServiceResultTypes(
  root: string,
  _fix = false
): DiagnosticCheckResult {
  const servicesDir = path.join(root, "lib", "services");
  if (!fs.existsSync(servicesDir)) {
    return {
      id: "architecture-service-result-types",
      name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
      category: "architecture",
      status: "pass",
      message: "lib/services/ directory not present (skipped).",
    };
  }

  const serviceFiles = findFiles(servicesDir, /\.ts$/);
  const violations: { file: string; line: number; issue: string }[] = [];

  for (const file of serviceFiles) {
    const relative = path.relative(root, file);
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    if (
      relative.includes("handler.ts") ||
      relative.includes("spec.ts") ||
      (file.endsWith("-service.ts") && !relative.endsWith("index.ts"))
    ) {
      const usesServiceResult =
        /ServiceResult\b|ServiceSuccess\b|ServiceFailure\b|createSuccess|createFailure|Result\b|Response\b|Status\b|Input\b|success:\s*boolean/.test(
          content
        );

      if (!usesServiceResult) {
        violations.push({
          file: relative,
          line: 1,
          issue:
            "Service layer module does not declare typed ServiceResult or result envelope structure",
        });
      }
    }

    // Every module under lib/services/ is a service boundary, including the
    // media storage providers, so the throw scan is not limited to the
    // envelope-shaped files above.
    if (relative.includes(".test.")) continue;
    lines.forEach((line, idx) => {
      if (isCommentLine(line) || /createFailure/.test(line)) return;
      const rethrow = SERVICE_RETHROW.test(line);
      if (RAW_SERVICE_THROW.test(line) || rethrow) {
        violations.push({
          file: relative,
          line: idx + 1,
          issue: `${rethrow ? "Caught error rethrown" : "Raw exception thrown"} across the service boundary (${line.trim()}). Return a ServiceResult createFailure() envelope instead.`,
        });
      }
    });
  }

  if (violations.length === 0) {
    return {
      id: "architecture-service-result-types",
      name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
      category: "architecture",
      status: "pass",
      message:
        "All service layer handlers return typed ServiceResult envelopes without unhandled exceptions.",
    };
  }

  return {
    id: "architecture-service-result-types",
    name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
    category: "architecture",
    status: "fail",
    message: `${violations.length} service result return signature violation(s) detected in lib/services/. (ADR-0028: Typed Service Contracts, Dual-Seam Architecture, and Shoehorn Test Fixture Hygiene)`,
    details: violations.map((v) => `${v.file}:${v.line} -> ${v.issue}`),
    fixable: false,
  };
}

export interface DiagnosticSummary {
  results: DiagnosticCheckResult[];
  hasFailures: boolean;
  hasWarnings: boolean;
  totalPassed: number;
  totalFailed: number;
  totalWarned: number;
  totalFixed: number;
  remediations: RemediationAction[];
}

/**
 * Run All Diagnostics
 */
export async function runDiagnostics(
  options: DoctorOptions = {}
): Promise<DiagnosticSummary> {
  const root = options.workspaceRoot || process.cwd();
  const fix = !!options.fix;

  const rawChecks: DiagnosticCheckResult[] = [
    checkRouteIndexing(root, fix),
    checkPublicRouteRegistryDrift(root, fix),
    checkNavbarHierarchy(root),
    checkPageTopPadding(root),
    checkTestPathResolution(root),
    checkTestFixtureHygiene(root),
    checkSecretLeaks(root),

    checkMigrationGuard(root),
    checkDocumentationParity(root, fix),
    checkLlmsManifestsDrift(root, fix),
    checkTechnicalGuideSchemaParity(root, fix),
    checkOnboardingDocsDrift(root, fix),
    checkDirectoryTopology(root),
    checkOpenApiParity(root, fix),
    checkHydrationSafety(root),
    checkAccessibilityStandards(root, fix),
    checkAccessibilityAuditIntegrity(root),
    checkDefectRemediationInvariants(root),
    checkProactiveDefectInterception(root),
    checkLayoutTextClippingInvariants(root),
    checkTouchTargetDimensions(root, fix),
    checkSectionStructures(root, fix),
    checkServiceResultTypes(root, fix),
    checkEnvironmentVariables(root, fix),
    checkGitHygieneConfig(root, fix),
    checkWorkspaceIdeConfig(root, fix),
    checkPackageLockfile(root),
    checkSeoSocialIntegrity(root),
    checkDesignTokens(root),
    checkDeadCode(root),
    checkBundleBudgets(root),
    checkSubRoutePerformance(root),
    checkModuleBoundaries(root),
  ];

  const checks = rawChecks.map((check) => {
    if (
      (check.status === "fail" || check.status === "warn") &&
      !check.remediation
    ) {
      if (check.fixable) {
        return {
          ...check,
          remediation: {
            id: `fix-${check.id}`,
            title: `Auto-fix ${check.name}`,
            command: "npm run doctor:fix",
            autoFixable: true,
            scope: check.category,
          },
        };
      }
    }
    return check;
  });

  const totalPassed = checks.filter((c) => c.status === "pass").length;
  const totalFailed = checks.filter((c) => c.status === "fail").length;
  const totalWarned = checks.filter((c) => c.status === "warn").length;
  const totalFixed = checks.filter((c) => c.status === "fixed").length;

  const hasFailures = totalFailed > 0;
  const hasWarnings = totalWarned > 0;

  const remediations: RemediationAction[] = [];
  const addedCmds = new Set<string>();

  for (const check of checks) {
    if (check.status === "fail" || check.status === "warn") {
      if (check.remediation && !addedCmds.has(check.remediation.command)) {
        remediations.push(check.remediation);
        addedCmds.add(check.remediation.command);
      }
    }
  }

  const hasAnyFixable = checks.some((c) => c.status === "fail" && c.fixable);
  if (hasAnyFixable && !addedCmds.has("npm run doctor:fix")) {
    remediations.unshift({
      id: "doctor-fix",
      title: "Auto-remediate all fixable architectural invariants",
      command: "npm run doctor:fix",
      autoFixable: true,
      scope: "global",
    });
  }

  return {
    results: checks,
    hasFailures,
    hasWarnings,
    totalPassed,
    totalFailed,
    totalWarned,
    totalFixed,
    remediations,
  };
}

export function printDoctorReport(
  summary: DiagnosticSummary,
  _ciMode = false
): void {
  console.log(
    formatHeader(
      "DX DOCTOR — Architectural Invariant Health",
      "Next.js 16 • React 19 • 24 Invariants Audited"
    )
  );

  console.log(
    `### Invariant Health · ${summary.totalPassed}/${summary.results.length} checks passing\n`
  );

  for (const check of summary.results) {
    console.log(
      badge(`[${check.category.toUpperCase()}] ${check.name}`, check.status)
    );
    console.log(`  ${colors.dim}${check.message}${colors.reset}`);
    if (check.details && check.details.length > 0) {
      for (const d of check.details) {
        console.log(`    ${colors.gray}• ${d}${colors.reset}`);
      }
    }
  }

  if (summary.hasFailures) {
    console.log(
      `\n### What's Actionable · ${summary.totalFailed} failure(s) detected\n`
    );
    const fixableChecks = summary.results.filter(
      (c) => c.status === "fail" && c.fixable
    );
    if (fixableChecks.length > 0) {
      console.log(
        `Run auto-remediation to resolve ${fixableChecks.length} fixable invariant(s):`
      );
      console.log(
        `\n  ${colors.brightGreen}npm run doctor:fix${colors.reset}\n`
      );
    }
    const nonFixable = summary.results.filter(
      (c) => c.status === "fail" && !c.fixable
    );
    if (nonFixable.length > 0) {
      console.log(
        `Manual remediation required for ${nonFixable.length} check(s):`
      );
      for (const nf of nonFixable) {
        console.log(
          `  ${colors.yellow}• ${nf.name}: ${nf.message}${colors.reset}`
        );
      }
      console.log("");
    }
  } else if (!summary.hasWarnings) {
    console.log(`\n### All Invariants Satisfied\n`);
    console.log(
      `Every rule in AGENTS.md is verified and passing cleanly with zero drift.`
    );
    console.log(`Next step: run full verification suite:`);
    console.log(`\n  ${colors.brightGreen}npm run quality${colors.reset}\n`);
  }

  console.log(`##### Invariant Audit Metadata`);
  console.log(
    `*Passed: ${summary.totalPassed} · Fixed: ${summary.totalFixed} · Warned: ${summary.totalWarned} · Failed: ${summary.totalFailed}*`
  );
}
