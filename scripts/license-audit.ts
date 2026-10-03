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

export interface ExpiringException {
  packageName: string;
  expiresAt: string;
  daysLeft: number;
  riskOwner: string;
  ticket: string;
}

export interface LicenseAuditReport {
  timestamp: string;
  durationMs: number;
  totalPackagesScanned: number;
  totalCompliantPackages: number;
  totalViolations: number;
  activeExceptionsCount: number;
  /** Packages that reach visitors (production closure) and dev-only tooling. */
  shippedPackages: number;
  toolingPackages: number;
  /** Exceptions that expire within EXPIRY_WARNING_DAYS; a warning, not a failure. */
  expiringSoon: ExpiringException[];
  /** Shipped name@version entries absent from public/third-party-notices.txt. */
  noticesMissing: string[];
  violations: NonCompliantDependency[];
  invalidExceptions: InvalidExceptionPolicy[];
  passed: boolean;
}

/** Warn this many days before an exception expires. */
export const EXPIRY_WARNING_DAYS = 30;

/** Licenses whose copyleft reaches code shipped to visitors; never waivable. */
const STRONG_COPYLEFT = /^(A?GPL|SSPL|OSL|EUPL|CPAL|RPL)/i;

/** Where the generated third-party notices live (see scripts/oss-credits.ts). */
export const NOTICES_FILE = "public/third-party-notices.txt";

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
  dev?: boolean;
}

/** Exceptions that remain valid for shipped code: no strong-copyleft or wildcard waivers. */
export function shippedCodeExceptions(
  exceptions: LicenseException[]
): LicenseException[] {
  return exceptions.filter(
    (e) => e.license !== "*" && !STRONG_COPYLEFT.test(e.license)
  );
}

export function findExpiringExceptions(
  exceptions: LicenseException[],
  now: Date
): ExpiringException[] {
  const day = 24 * 60 * 60 * 1000;
  return exceptions
    .map((e) => ({
      packageName: e.packageName,
      expiresAt: e.expiresAt,
      daysLeft: Math.ceil(
        (new Date(e.expiresAt).getTime() - now.getTime()) / day
      ),
      riskOwner: e.riskOwner,
      ticket: e.ticket,
    }))
    .filter((e) => e.daysLeft <= EXPIRY_WARNING_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Main lockfile license compliance audit runner.
 */
export function runLicenseAudit(options?: {
  workspaceRoot?: string;
  now?: Date;
  /** Fail when the notices file is absent. Defaults to checking it only if it exists. */
  requireNotices?: boolean;
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
  let shippedPackages = 0;
  const shippedKeys = new Set<string>();
  const shippedExceptions = shippedCodeExceptions(validExceptions);

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

    const shipped = !pkg.dev;
    if (shipped) {
      shippedPackages++;
      shippedKeys.add(`${pkgName}@${version}`);
    }

    const evalResult = evaluateSpdxExpression(
      licenseExpr,
      pkgName,
      allowedLicensesSet,
      validExceptions
    );

    // Shipped code may not lean on an exception for strong copyleft.
    const shippedResult = shipped
      ? evaluateSpdxExpression(
          licenseExpr,
          pkgName,
          allowedLicensesSet,
          shippedExceptions
        )
      : evalResult;
    const copyleftWaived =
      evalResult.compliant &&
      !shippedResult.compliant &&
      tokenizeSpdx(licenseExpr).some((t) => STRONG_COPYLEFT.test(t));

    if (copyleftWaived) {
      violations.push({
        packageName: pkgName,
        packagePath: pkgPath,
        version,
        licenseExpression: licenseExpr,
        unapprovedLicenses: shippedResult.unapprovedTokens,
        reason: `Strong copyleft '${licenseExpr}' ships to visitors and cannot be waived by an exception.`,
      });
    } else if (evalResult.compliant) {
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

  const noticesPath = path.join(root, NOTICES_FILE);
  const noticesExist = fs.existsSync(noticesPath);
  let noticesMissing: string[] = [];
  if (noticesExist) {
    const notices = fs.readFileSync(noticesPath, "utf-8");
    noticesMissing = [...shippedKeys]
      .filter((k) => !notices.includes(k))
      .sort();
  } else if (options?.requireNotices) {
    noticesMissing = [...shippedKeys].sort();
  }

  const durationMs = Date.now() - startTime;
  const passed =
    violations.length === 0 &&
    invalidExceptions.length === 0 &&
    noticesMissing.length === 0;

  return {
    timestamp: now.toISOString(),
    durationMs,
    totalPackagesScanned,
    totalCompliantPackages,
    totalViolations: violations.length,
    activeExceptionsCount: validExceptions.length,
    shippedPackages,
    toolingPackages: totalPackagesScanned - shippedPackages,
    expiringSoon: findExpiringExceptions(validExceptions, now),
    noticesMissing,
    violations,
    invalidExceptions,
    passed,
  };
}

// Standalone CLI execution
if (typeof process.env.VITEST === "undefined" && require.main === module) {
  const isJson = process.argv.includes("--json") || process.argv.includes("-j");
  try {
    const report = runLicenseAudit({ requireNotices: true });

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
      console.log(
        `Shipped to visitors: ${report.shippedPackages}, dev tooling: ${report.toolingPackages}`
      );
      console.log(`Active Policy Exceptions: ${report.activeExceptionsCount}`);
      console.log(`Scan Duration: ${report.durationMs}ms`);

      for (const e of report.expiringSoon) {
        console.warn(
          `⚠️  Exception for ${e.packageName} expires ${e.expiresAt} (${e.daysLeft} days; owner ${e.riskOwner}, ${e.ticket}). Renew or remove it.`
        );
      }

      if (report.noticesMissing.length > 0) {
        console.error(
          `\n❌ ${report.noticesMissing.length} shipped package(s) missing from ${NOTICES_FILE}. Run: npm run oss:credits`
        );
        for (const k of report.noticesMissing.slice(0, 20)) {
          console.error(`  • ${k}`);
        }
      }

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
