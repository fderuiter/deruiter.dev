import fs from "fs";
import path from "path";
import defaultManifest from "@/lib/security-manifest.json";

export interface SecurityManifestRule {
  advisory: string;
  package?: string;
  expiresAt: string;
  reason: string;
  owner: string;
  followUp: string;
  createdAt?: string;
}

export interface SecurityManifest {
  generatedAt: string;
  activeRules: SecurityManifestRule[];
}

export interface CircuitBreakerEvaluation {
  tripped: boolean;
  trippedPackage?: string;
  rule?: SecurityManifestRule;
}

let cachedManifest: SecurityManifest | null = null;
let cachedMtime = 0;

/**
 * Reads the runtime security manifest with sub-millisecond in-memory caching.
 * Evaluates filesystem updates when on disk, or falls back to static manifest.
 */
export function getRuntimeSecurityManifest(): SecurityManifest {
  try {
    const candidatePaths = [
      path.join(process.cwd(), "lib", "security-manifest.json"),
      path.join(process.cwd(), "security-manifest.json"),
      path.resolve(__dirname, "security-manifest.json"),
      path.resolve(__dirname, "../lib/security-manifest.json"),
    ];

    for (const manifestPath of candidatePaths) {
      if (
        typeof fs !== "undefined" &&
        typeof fs.existsSync === "function" &&
        fs.existsSync(manifestPath)
      ) {
        const stat = fs.statSync(manifestPath);
        if (cachedManifest && cachedMtime === stat.mtimeMs) {
          return cachedManifest;
        }
        const content = fs.readFileSync(manifestPath, "utf8");
        const parsed = JSON.parse(content) as SecurityManifest;
        if (parsed && Array.isArray(parsed.activeRules)) {
          cachedManifest = parsed;
          cachedMtime = stat.mtimeMs;
          return parsed;
        }
      }
    }
  } catch (_e) {
    // Fall back to default static import if filesystem read fails
  }

  return (cachedManifest || defaultManifest) as SecurityManifest;
}

/**
 * Resets the in-memory manifest cache (used in unit testing).
 */
export function resetManifestCache(): void {
  cachedManifest = null;
  cachedMtime = 0;
}

/**
 * Evaluates whether the active security circuit breaker trips for a list of declared package dependencies.
 */
export function evaluateCircuitBreaker(
  declaredPackages?: string[],
  now: Date = new Date()
): CircuitBreakerEvaluation {
  if (!declaredPackages || declaredPackages.length === 0) {
    return { tripped: false };
  }

  const manifest = getRuntimeSecurityManifest();
  if (
    !manifest ||
    !Array.isArray(manifest.activeRules) ||
    manifest.activeRules.length === 0
  ) {
    return { tripped: false };
  }

  const currentTime = now.getTime();

  for (const pkg of declaredPackages) {
    const normalizedPkg = pkg.trim().toLowerCase();
    for (const rule of manifest.activeRules) {
      if (!rule || !rule.expiresAt) continue;

      const expTime = new Date(rule.expiresAt).getTime();
      if (isNaN(expTime) || expTime <= currentTime) {
        // Expired rule is not active
        continue;
      }

      const rulePkg = (rule.package || "").trim().toLowerCase();
      const matchesPackage =
        !rulePkg ||
        rulePkg === "*" ||
        rulePkg === "all" ||
        rulePkg === normalizedPkg;

      if (matchesPackage) {
        return {
          tripped: true,
          trippedPackage: pkg,
          rule,
        };
      }
    }
  }

  return { tripped: false };
}
