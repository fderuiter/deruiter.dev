#!/usr/bin/env node
/**
 * Zero-Dependency Lockfile Deprecation Auditor
 * Reads package-lock.json and asserts zero deprecated or discontinued packages exist.
 */

import fs from "fs";
import path from "path";

export interface DeprecatedPackageInfo {
  name: string;
  version: string;
  reason: string;
  location: string;
}

export interface DeprecationReport {
  success: boolean;
  totalPackages: number;
  deprecatedCount: number;
  deprecatedPackages: DeprecatedPackageInfo[];
  lockfilePath: string;
}

/**
 * Scans workspace package-lock.json for explicit 'deprecated' flags.
 */
export function checkDeprecations(workspaceRoot?: string): DeprecationReport {
  const root = workspaceRoot || process.cwd();
  const lockfilePath = path.join(root, "package-lock.json");

  if (!fs.existsSync(lockfilePath)) {
    throw new Error(`package-lock.json not found at ${lockfilePath}`);
  }

  const rawContent = fs.readFileSync(lockfilePath, "utf-8");
  const lockfile = JSON.parse(rawContent);

  const deprecatedPackages: DeprecatedPackageInfo[] = [];
  const seenLocations = new Set<string>();
  let totalPackages = 0;

  // npm v2/v3 lockfile format with 'packages'
  if (lockfile.packages && typeof lockfile.packages === "object") {
    const pkgKeys = Object.keys(lockfile.packages);
    totalPackages = pkgKeys.filter((k) => k !== "").length;

    for (const pkgPath of pkgKeys) {
      if (pkgPath === "") continue;
      const pkg = lockfile.packages[pkgPath];
      if (pkg && pkg.deprecated) {
        seenLocations.add(pkgPath);
        const derivedName =
          pkg.name || pkgPath.replace(/^(?:.*[/\\])?node_modules[/\\]/, "");
        deprecatedPackages.push({
          name: derivedName,
          version: pkg.version || "unknown",
          reason: String(pkg.deprecated),
          location: pkgPath,
        });
      }
    }
  }

  // Fallback or v1 lockfile format with 'dependencies'
  if (lockfile.dependencies && typeof lockfile.dependencies === "object") {
    function scanDeps(
      depsMap: Record<string, unknown>,
      currentPath: string
    ): void {
      for (const [depName, depObj] of Object.entries(depsMap)) {
        if (!depObj || typeof depObj !== "object") continue;
        const item = depObj as Record<string, unknown>;
        const loc = `${currentPath}/node_modules/${depName}`;

        if (!seenLocations.has(loc)) {
          if (lockfile.packages ? false : true) {
            totalPackages++;
          }
          if (item.deprecated) {
            seenLocations.add(loc);
            deprecatedPackages.push({
              name: depName,
              version: String(item.version || "unknown"),
              reason: String(item.deprecated),
              location: loc,
            });
          }
        }

        if (item.dependencies && typeof item.dependencies === "object") {
          scanDeps(item.dependencies as Record<string, unknown>, loc);
        }
      }
    }

    scanDeps(lockfile.dependencies as Record<string, unknown>, ".");
  }

  return {
    success: deprecatedPackages.length === 0,
    totalPackages,
    deprecatedCount: deprecatedPackages.length,
    deprecatedPackages,
    lockfilePath,
  };
}

/**
 * CLI execution entrypoint
 */
export function main(): void {
  const startTime = Date.now();
  try {
    const report = checkDeprecations();
    const durationMs = Date.now() - startTime;

    if (report.success) {
      console.log(
        `\n[DEPRECATIONS] Pass: Audited ${report.totalPackages} packages in package-lock.json (${durationMs}ms).`
      );
      console.log(`✔ Zero deprecated or discontinued packages found.\n`);
      process.exit(0);
    } else {
      console.error(
        `\n[DEPRECATIONS] Fail: Found ${report.deprecatedCount} deprecated package(s) in package-lock.json (${durationMs}ms):`
      );
      for (const pkg of report.deprecatedPackages) {
        console.error(`  • ${pkg.name}@${pkg.version} (${pkg.location})`);
        console.error(`    Reason: ${pkg.reason}`);
      }
      console.error(
        `\nRemediation: Update or remove deprecated dependencies from package.json and run 'npm install'.\n`
      );
      process.exit(1);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[DEPRECATIONS] Error auditing lockfile: ${msg}\n`);
    process.exit(1);
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith("check-deprecations.ts"))
) {
  main();
}
