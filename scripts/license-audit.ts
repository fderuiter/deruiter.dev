#!/usr/bin/env tsx
/**
 * Lockfile-Native License Audit Engine
 * Zero-dependency SPDX scanner evaluating package-lock.json metadata against license-policy.json.
 */

import fs from "fs";
import path from "path";

export interface LicenseException {
  packageName: string;
  license: string;
  expiresAt: string;
  riskOwner: string;
  ticket: string;
  rationale: string;
}

export interface LicensePolicy {
  version?: string;
  allowedLicenses: string[];
  exceptions: LicenseException[];
}

export interface NonCompliantDependency {
  packageName: string;
  packagePath: string;
  version: string;
  licenseExpression: string;
  unapprovedLicenses: string[];
  reason: string;
}

export interface InvalidExceptionPolicy {
  packageName: string;
  reason: string;
}

export interface LicenseAuditReport {
  timestamp: string;
  durationMs: number;
  totalPackagesScanned: number;
  totalCompliantPackages: number;
  totalViolations: number;
  activeExceptionsCount: number;
  violations: NonCompliantDependency[];
  invalidExceptions: InvalidExceptionPolicy[];
  passed: boolean;
}

/**
 * Validates exception entries in license-policy.json.
 * Fails closed if mandatory metadata fields are missing, expired, or exceed the 90-day window.
 */
export function validateExceptions(
  exceptions: LicenseException[],
  now: Date = new Date()
): {
  validExceptions: LicenseException[];
  invalidExceptions: InvalidExceptionPolicy[];
} {
  const validExceptions: LicenseException[] = [];
  const invalidExceptions: InvalidExceptionPolicy[] = [];

  const MAX_EXPIRATION_DAYS = 90;
  // Compute upper bound: current time + 90 days + 1 day margin
  const maxAllowedExpiryTime =
    now.getTime() + (MAX_EXPIRATION_DAYS + 1) * 24 * 60 * 60 * 1000;

  for (let i = 0; i < exceptions.length; i++) {
    const e = exceptions[i];
    const name = e?.packageName || `Exception #${i + 1}`;

    // Mandatory metadata fields check
    if (
      !e ||
      typeof e.packageName !== "string" ||
      !e.packageName.trim() ||
      typeof e.license !== "string" ||
      !e.license.trim() ||
      typeof e.expiresAt !== "string" ||
      !e.expiresAt.trim() ||
      typeof e.riskOwner !== "string" ||
      !e.riskOwner.trim() ||
      typeof e.ticket !== "string" ||
      !e.ticket.trim() ||
      typeof e.rationale !== "string" ||
      !e.rationale.trim()
    ) {
      invalidExceptions.push({
        packageName: name,
        reason:
          "Missing mandatory metadata fields (packageName, license, expiresAt, riskOwner, ticket, rationale).",
      });
      continue;
    }

    // Expiration date check
    const expiryDate = new Date(e.expiresAt);
    if (isNaN(expiryDate.getTime())) {
      invalidExceptions.push({
        packageName: name,
        reason: `Invalid ISO date format for expiresAt: '${e.expiresAt}'.`,
      });
      continue;
    }

    // Compare with current date (day-granularity comparison)
    const todayStr = now.toISOString().split("T")[0];
    const expStr = expiryDate.toISOString().split("T")[0];

    if (expStr < todayStr) {
      invalidExceptions.push({
        packageName: name,
        reason: `Exception expired on ${expStr} (current date: ${todayStr}).`,
      });
      continue;
    }

    if (expiryDate.getTime() > maxAllowedExpiryTime) {
      invalidExceptions.push({
        packageName: name,
        reason: `Exception expiration date (${expStr}) exceeds the maximum allowed 90-day window.`,
      });
      continue;
    }

    validExceptions.push(e);
  }

  return { validExceptions, invalidExceptions };
}

/**
 * Tokenizes an SPDX license expression string into tokens (license IDs, operators OR/AND, parens).
 */
export function tokenizeSpdx(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }
    if (expr[i] === "(" || expr[i] === ")") {
      tokens.push(expr[i]);
      i++;
      continue;
    }
    const start = i;
    while (i < expr.length && expr[i] !== "(" && expr[i] !== ")") {
      const rest = expr.slice(i);
      if (/^\s+(OR|AND|or|and)\s+/i.test(rest)) {
        break;
      }
      i++;
    }
    const chunk = expr.slice(start, i).trim();
    if (chunk) {
      if (/^(OR|or)$/i.test(chunk)) tokens.push("OR");
      else if (/^(AND|and)$/i.test(chunk)) tokens.push("AND");
      else tokens.push(chunk);
    }
    if (i < expr.length && /^\s*(OR|AND|or|and)\s+/i.test(expr.slice(i))) {
      const match = expr.slice(i).match(/^\s*(OR|AND|or|and)\s+/i);
      if (match) {
        tokens.push(match[1].toUpperCase());
        i += match[0].length;
      }
    }
  }
  return tokens;
}

/**
 * Evaluates an SPDX license expression for a given package against allowed licenses and valid exceptions.
 * Dual-licensed OR expressions evaluate to valid if AT LEAST ONE option satisfies policy.
 * Compound AND expressions require ALL options to satisfy policy.
 */
export function evaluateSpdxExpression(
  licenseExpr: string,
  pkgName: string,
  allowedLicenses: Set<string>,
  validExceptions: LicenseException[]
): {
  compliant: boolean;
  unapprovedTokens: string[];
} {
  if (!licenseExpr || licenseExpr === "UNKNOWN") {
    const isExempt = validExceptions.some(
      (e) =>
        e.packageName === pkgName &&
        (e.license === "UNKNOWN" || e.license === "*")
    );
    if (isExempt) {
      return { compliant: true, unapprovedTokens: [] };
    }
    return { compliant: false, unapprovedTokens: ["UNKNOWN"] };
  }

  const tokens = tokenizeSpdx(licenseExpr);
  const unapprovedTokens: string[] = [];

  function isTokenApproved(token: string): boolean {
    if (allowedLicenses.has(token)) return true;

    // Check matching active exceptions
    const isExempt = validExceptions.some(
      (e) =>
        e.packageName === pkgName &&
        (e.license === token || e.license === "*" || e.license === licenseExpr)
    );
    if (isExempt) return true;

    if (!unapprovedTokens.includes(token)) {
      unapprovedTokens.push(token);
    }
    return false;
  }

  let pos = 0;

  function parsePrimary(): boolean {
    if (pos >= tokens.length) return false;
    const token = tokens[pos];
    if (token === "(") {
      pos++;
      const res = parseOr();
      if (tokens[pos] === ")") pos++;
      return res;
    }
    pos++;
    return isTokenApproved(token);
  }

  function parseAnd(): boolean {
    let left = parsePrimary();
    while (pos < tokens.length && tokens[pos] === "AND") {
      pos++;
      const right = parsePrimary();
      left = left && right;
    }
    return left;
  }

  function parseOr(): boolean {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos] === "OR") {
      pos++;
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }

  const compliant = parseOr();
  return { compliant, unapprovedTokens };
}

interface PackageLockEntry {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  link?: boolean;
}

/**
 * Main lockfile license compliance audit runner.
 */
export function runLicenseAudit(options?: {
  workspaceRoot?: string;
  now?: Date;
}): LicenseAuditReport {
  const startTime = Date.now();
  const root = options?.workspaceRoot || path.resolve(__dirname, "..");
  const now = options?.now || new Date();

  const lockfilePath = path.join(root, "package-lock.json");
  const policyPath = path.join(root, "license-policy.json");

  if (!fs.existsSync(lockfilePath)) {
    throw new Error(`package-lock.json not found at ${lockfilePath}`);
  }
  if (!fs.existsSync(policyPath)) {
    throw new Error(`license-policy.json not found at ${policyPath}`);
  }

  const lockRaw = fs.readFileSync(lockfilePath, "utf-8");
  const policyRaw = fs.readFileSync(policyPath, "utf-8");

  const lockJson = JSON.parse(lockRaw);
  const policyJson: LicensePolicy = JSON.parse(policyRaw);

  const allowedLicensesSet = new Set(policyJson.allowedLicenses || []);
  const { validExceptions, invalidExceptions } = validateExceptions(
    policyJson.exceptions || [],
    now
  );

  const violations: NonCompliantDependency[] = [];
  let totalPackagesScanned = 0;
  let totalCompliantPackages = 0;

  const packages: Record<string, PackageLockEntry> = lockJson.packages || {};

  for (const [pkgPath, pkg] of Object.entries(packages)) {
    if (pkgPath === "") continue; // Skip root workspace package
    if (pkg.link) continue; // Skip workspace links

    totalPackagesScanned++;
    const pkgName = pkg.name || pkgPath.replace(/^.*node_modules\//, "");
    const version = pkg.version || "0.0.0";
    const rawLicense = pkg.license;

    let licenseExpr = "UNKNOWN";
    if (typeof rawLicense === "string") {
      licenseExpr = rawLicense;
    } else if (rawLicense && typeof rawLicense === "object") {
      licenseExpr = rawLicense.type || JSON.stringify(rawLicense);
    }

    const evalResult = evaluateSpdxExpression(
      licenseExpr,
      pkgName,
      allowedLicensesSet,
      validExceptions
    );

    if (evalResult.compliant) {
      totalCompliantPackages++;
    } else {
      violations.push({
        packageName: pkgName,
        packagePath: pkgPath,
        version,
        licenseExpression: licenseExpr,
        unapprovedLicenses: evalResult.unapprovedTokens,
        reason: `License '${licenseExpr}' is unapproved by license-policy.json and has no active valid exception.`,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const passed = violations.length === 0 && invalidExceptions.length === 0;

  return {
    timestamp: now.toISOString(),
    durationMs,
    totalPackagesScanned,
    totalCompliantPackages,
    totalViolations: violations.length,
    activeExceptionsCount: validExceptions.length,
    violations,
    invalidExceptions,
    passed,
  };
}

// Standalone CLI execution
if (typeof process.env.VITEST === "undefined" && require.main === module) {
  const isJson = process.argv.includes("--json") || process.argv.includes("-j");
  try {
    const report = runLicenseAudit();

    if (isJson) {
      const envelope = {
        success: report.passed,
        command: "audit:licenses",
        timestamp: report.timestamp,
        durationMs: report.durationMs,
        data: report,
        remediations: report.passed
          ? []
          : [
              {
                id: "license-audit-fix",
                title:
                  "Review unapproved dependency licenses and update license-policy.json exceptions",
                command: "npm run audit:licenses",
                autoFixable: false,
                scope: "security",
              },
            ],
      };
      process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
    } else {
      console.log(`\n--- Lockfile License Compliance Audit ---`);
      console.log(`Packages Scanned: ${report.totalPackagesScanned}`);
      console.log(`Compliant Packages: ${report.totalCompliantPackages}`);
      console.log(`Active Policy Exceptions: ${report.activeExceptionsCount}`);
      console.log(`Scan Duration: ${report.durationMs}ms`);

      if (report.invalidExceptions.length > 0) {
        console.error(
          `\n❌ Invalid or Expired Exception Policies (${report.invalidExceptions.length}):`
        );
        for (const ie of report.invalidExceptions) {
          console.error(`  • ${ie.packageName}: ${ie.reason}`);
        }
      }

      if (report.violations.length > 0) {
        console.error(
          `\n❌ License Policy Violations (${report.violations.length}):`
        );
        for (const v of report.violations) {
          console.error(`  • ${v.packageName}@${v.version} (${v.packagePath})`);
          console.error(`    License: ${v.licenseExpression}`);
          console.error(`    Unapproved: ${v.unapprovedLicenses.join(", ")}`);
        }
      }

      if (report.passed) {
        console.log(
          `\n✅ All lockfile dependency licenses comply with license-policy.json.\n`
        );
      } else {
        console.error(
          `\n❌ License audit failed. Resolve unapproved licenses or update license-policy.json.\n`
        );
      }
    }

    if (!report.passed) {
      process.exit(1);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ License audit error: ${msg}\n`);
    process.exit(1);
  }
}
