#!/usr/bin/env node
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { colors } from "../lib/dx/utils";

export const WARN_THRESHOLD_DAYS = 14;

export interface IgnoreRule {
  advisory?: string;
  advisoryId?: string;
  cve?: string;
  ghsa?: string;
  id?: string;
  package?: string;
  name?: string;
  expiresAt: string;
  createdAt?: string;
  reason: string;
  owner: string;
  followUp: string;
}

export interface ParsedIgnoreRule {
  advisory: string;
  package?: string;
  expiresAt: string;
  createdAt?: string;
  reason: string;
  owner: string;
  followUp: string;
  isValid: boolean;
  isExpired: boolean;
  remainingDays?: number;
  isApproachingExpiration?: boolean;
  validationError?: string;
}

export interface SecurityAuditOptions {
  throwOnError?: boolean;
  now?: Date;
  warnOnApproachingExpiration?: boolean;
  failOnWarning?: boolean;
  warnThresholdDays?: number;
}

// Fail closed by default. Temporary exceptions must live in the reviewed policy
// file with an owner, follow-up ticket, rationale, and maximum 90-day expiry.
export const DEFAULT_IGNORE_LIST: IgnoreRule[] = [];

export interface Advisory {
  source?: number | string;
  name?: string;
  dependency?: string;
  title?: string;
  url?: string;
  severity?: string;
  cwe?: string[];
  cvss?: {
    score: number;
    vectorString: string | null;
  } | null;
  range?: string;
}

export interface VulnerabilityInfo {
  name?: string;
  severity?: string;
  isDirect?: boolean;
  via?: Array<string | Advisory>;
  effects?: string[];
  range?: string;
  nodes?: string[];
  fixAvailable?:
    boolean | { name: string; version?: string; isSemVerMajor?: boolean };
}

export interface AuditReport {
  auditReportVersion?: number;
  vulnerabilities?: Record<string, VulnerabilityInfo>;
}

export function parseIgnoreRules(
  data: unknown,
  now: Date = new Date(),
  warnThresholdDays: number = WARN_THRESHOLD_DAYS
): ParsedIgnoreRule[] {
  const rules: ParsedIgnoreRule[] = [];
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const validateAndAdd = (
    advisoryRaw: string,
    pkgRaw: string,
    expiresAtRaw: string,
    reasonRaw: string,
    ownerRaw: string,
    followUpRaw: string,
    createdAtRaw?: string
  ) => {
    const advisory = advisoryRaw.trim();
    const pkg = pkgRaw.trim();
    const expiresAt = expiresAtRaw.trim();
    const reason = reasonRaw.trim();
    const owner = ownerRaw.trim();
    const followUp = followUpRaw.trim();
    const createdAt = createdAtRaw ? createdAtRaw.trim() : undefined;

    if (!advisory) {
      rules.push({
        advisory: "",
        package: pkg || undefined,
        expiresAt,
        createdAt,
        reason,
        owner,
        followUp,
        isValid: false,
        isExpired: false,
        isApproachingExpiration: false,
        validationError: `Override entry ${pkg ? `for package "${pkg}" ` : ""}is missing a valid advisory ID ("advisory" or "cve").`,
      });
      return;
    }

    if (!expiresAt || !reason || !owner || !followUp) {
      const missingParts: string[] = [];
      if (!expiresAt) missingParts.push("expiration date ('expiresAt')");
      if (!reason) missingParts.push("business justification ('reason')");
      if (!owner) missingParts.push("risk owner ('owner')");
      if (!followUp) missingParts.push("follow-up ticket ('followUp')");
      rules.push({
        advisory,
        package: pkg || undefined,
        expiresAt,
        createdAt,
        reason,
        owner,
        followUp,
        isValid: false,
        isExpired: false,
        isApproachingExpiration: false,
        validationError: `Exception for advisory "${advisory}" is missing ${missingParts.join(" and ")}.`,
      });
      return;
    }

    const expDate = new Date(expiresAt);
    if (isNaN(expDate.getTime())) {
      rules.push({
        advisory,
        package: pkg || undefined,
        expiresAt,
        createdAt,
        reason,
        owner,
        followUp,
        isValid: false,
        isExpired: false,
        isApproachingExpiration: false,
        validationError: `Exception for advisory "${advisory}" has an invalid expiration date format ("${expiresAt}").`,
      });
      return;
    }

    let createdDate: Date | undefined;
    if (createdAt) {
      createdDate = new Date(createdAt);
      if (isNaN(createdDate.getTime())) {
        rules.push({
          advisory,
          package: pkg || undefined,
          expiresAt,
          createdAt,
          reason,
          owner,
          followUp,
          isValid: false,
          isExpired: false,
          isApproachingExpiration: false,
          validationError: `Exception for advisory "${advisory}" has an invalid creation date format ("${createdAt}").`,
        });
        return;
      }
    }

    if (expDate.getTime() > now.getTime() + ninetyDaysMs) {
      rules.push({
        advisory,
        package: pkg || undefined,
        expiresAt,
        createdAt,
        reason,
        owner,
        followUp,
        isValid: false,
        isExpired: false,
        isApproachingExpiration: false,
        validationError: `Expiration date for advisory "${advisory}" exceeds the maximum 90-day lifespan (${expiresAt}).`,
      });
      return;
    }

    if (
      createdDate &&
      expDate.getTime() > createdDate.getTime() + ninetyDaysMs
    ) {
      rules.push({
        advisory,
        package: pkg || undefined,
        expiresAt,
        createdAt,
        reason,
        owner,
        followUp,
        isValid: false,
        isExpired: false,
        isApproachingExpiration: false,
        validationError: `Expiration date for advisory "${advisory}" exceeds 90 days from creation date (${expiresAt}).`,
      });
      return;
    }

    const isExpired = expDate.getTime() <= now.getTime();
    const remainingDays = isExpired
      ? 0
      : Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const isApproachingExpiration =
      !isExpired && remainingDays <= warnThresholdDays;

    rules.push({
      advisory,
      package: pkg || undefined,
      expiresAt,
      createdAt,
      reason,
      owner,
      followUp,
      isValid: true,
      isExpired,
      remainingDays,
      isApproachingExpiration,
    });
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string") {
        validateAndAdd("", item, "", "", "", "");
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const advisory = String(
          obj.advisory || obj.advisoryId || obj.cve || obj.ghsa || obj.id || ""
        );
        const pkg = String(obj.package || obj.name || "");
        const expiresAt = String(obj.expiresAt || obj.expires || "");
        const reason = String(obj.reason || obj.justification || "");
        const owner = String(obj.owner || "");
        const followUp = String(obj.followUp || obj.followup || "");
        const createdAt =
          obj.createdAt || obj.created
            ? String(obj.createdAt || obj.created)
            : undefined;
        validateAndAdd(
          advisory,
          pkg,
          expiresAt,
          reason,
          owner,
          followUp,
          createdAt
        );
      }
    }
  } else if (data && typeof data === "object") {
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const advisory = String(
          obj.advisory || obj.advisoryId || obj.cve || obj.ghsa || obj.id || key
        );
        const pkg = String(obj.package || obj.name || "");
        const expiresAt = String(obj.expiresAt || obj.expires || "");
        const reason = String(obj.reason || obj.justification || "");
        const owner = String(obj.owner || "");
        const followUp = String(obj.followUp || obj.followup || "");
        const createdAt =
          obj.createdAt || obj.created
            ? String(obj.createdAt || obj.created)
            : undefined;
        validateAndAdd(
          advisory,
          pkg,
          expiresAt,
          reason,
          owner,
          followUp,
          createdAt
        );
      }
    }
  }

  return rules;
}

export function loadRawIgnoreList(): unknown {
  const rootIgnorePath = path.join(process.cwd(), "security-audit-ignore.json");
  const scriptsIgnorePath = path.join(
    process.cwd(),
    "scripts",
    "security-audit-ignore.json"
  );

  if (fs.existsSync(rootIgnorePath)) {
    try {
      return JSON.parse(fs.readFileSync(rootIgnorePath, "utf8"));
    } catch (_e) {
      console.warn(
        "Failed to parse root security-audit-ignore.json, falling back to default."
      );
    }
  }

  if (fs.existsSync(scriptsIgnorePath)) {
    try {
      return JSON.parse(fs.readFileSync(scriptsIgnorePath, "utf8"));
    } catch (_e) {
      console.warn(
        "Failed to parse scripts/security-audit-ignore.json, falling back to default."
      );
    }
  }

  return DEFAULT_IGNORE_LIST;
}

export function loadIgnoreList(
  now: Date = new Date(),
  warnThresholdDays: number = WARN_THRESHOLD_DAYS
): ParsedIgnoreRule[] {
  const rawData = loadRawIgnoreList();
  return parseIgnoreRules(rawData, now, warnThresholdDays);
}

export function isPretextRelated(
  pkgName: string,
  vuln: VulnerabilityInfo
): boolean {
  if (
    pkgName.toLowerCase().includes("pretext") ||
    pkgName.toLowerCase().includes("@chenglou/pretext")
  ) {
    return true;
  }
  if (vuln && Array.isArray(vuln.via)) {
    for (const item of vuln.via) {
      if (typeof item === "string") {
        if (
          item.toLowerCase().includes("pretext") ||
          item.toLowerCase().includes("@chenglou/pretext")
        ) {
          return true;
        }
      } else if (item && typeof item === "object") {
        if (
          (item.name && item.name.toLowerCase().includes("pretext")) ||
          (item.dependency &&
            item.dependency.toLowerCase().includes("pretext")) ||
          (item.title && item.title.toLowerCase().includes("pretext"))
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function getAdvisoryIdentifiers(adv: Advisory): string[] {
  const ids = new Set<string>();

  if (adv.source !== undefined && adv.source !== null) {
    ids.add(String(adv.source).trim().toLowerCase());
  }

  const anyAdv = adv as Record<string, unknown>;
  const rawId =
    anyAdv.id ||
    anyAdv.advisoryId ||
    anyAdv.advisory ||
    anyAdv.ghsa ||
    anyAdv.ghsaId ||
    anyAdv.cve;
  if (rawId) {
    if (Array.isArray(rawId)) {
      rawId.forEach((i) => ids.add(String(i).trim().toLowerCase()));
    } else {
      ids.add(String(rawId).trim().toLowerCase());
    }
  }

  if (adv.url) {
    const urlStr = adv.url.toLowerCase();
    ids.add(urlStr);
    const ghsaMatches = urlStr.match(/ghsa-[a-z0-9-]+/g);
    if (ghsaMatches) ghsaMatches.forEach((m) => ids.add(m));
    const cveMatches = urlStr.match(/cve-\d{4}-\d+/g);
    if (cveMatches) cveMatches.forEach((m) => ids.add(m));
    const advNumMatches = urlStr.match(/advisories\/(\d+)/g);
    if (advNumMatches)
      advNumMatches.forEach((m) => ids.add(m.replace("advisories/", "")));
  }

  if (adv.title) {
    const titleStr = adv.title.toLowerCase();
    const ghsaMatches = titleStr.match(/ghsa-[a-z0-9-]+/g);
    if (ghsaMatches) ghsaMatches.forEach((m) => ids.add(m));
    const cveMatches = titleStr.match(/cve-\d{4}-\d+/g);
    if (cveMatches) cveMatches.forEach((m) => ids.add(m));
  }

  return Array.from(ids);
}

export function collectAdvisoriesForVulnerability(
  pkgName: string,
  vulnerabilities: Record<string, VulnerabilityInfo>,
  visited = new Set<string>()
): Advisory[] {
  if (visited.has(pkgName)) return [];
  visited.add(pkgName);

  const vuln = vulnerabilities[pkgName];
  if (!vuln) return [];

  const advisories: Advisory[] = [];

  if (Array.isArray(vuln.via)) {
    for (const item of vuln.via) {
      if (typeof item === "object" && item !== null) {
        advisories.push(item as Advisory);
      } else if (typeof item === "string") {
        const nested = collectAdvisoriesForVulnerability(
          item,
          vulnerabilities,
          visited
        );
        advisories.push(...nested);
      }
    }
  }

  if (advisories.length === 0) {
    advisories.push({
      name: vuln.name || pkgName,
      range: vuln.range,
      severity: vuln.severity,
    });
  }

  return advisories;
}

export function matchAdvisoryRule(
  rule: ParsedIgnoreRule,
  adv: Advisory,
  pkgName: string
): boolean {
  if (!rule.isValid || rule.isExpired) return false;

  if (rule.package) {
    const rulePkg = rule.package.trim().toLowerCase();
    const matchesPkg =
      pkgName.toLowerCase() === rulePkg ||
      (adv.name && adv.name.toLowerCase() === rulePkg) ||
      (adv.dependency && adv.dependency.toLowerCase() === rulePkg);
    if (!matchesPkg) return false;
  }

  const ruleAdv = rule.advisory.trim().toLowerCase();
  const ids = getAdvisoryIdentifiers(adv);

  if (ids.includes(ruleAdv)) return true;
  if (adv.url && adv.url.toLowerCase().includes(ruleAdv)) return true;
  if (adv.title && adv.title.toLowerCase().includes(ruleAdv)) return true;
  if (adv.source && String(adv.source).toLowerCase().includes(ruleAdv))
    return true;

  return false;
}

export function runSecurityAudit(options: SecurityAuditOptions = {}): boolean {
  console.log(
    `${colors.bold}${colors.cyan}🛡️  Parallelized Security Workflow Gate${colors.reset}`
  );
  console.log(
    `${colors.gray}Executing lockfile vulnerability scans...${colors.reset}\n`
  );

  const cliArgs =
    typeof process !== "undefined" && Array.isArray(process.argv)
      ? process.argv.slice(2)
      : [];
  const cliFailOnWarning = cliArgs.some((arg) =>
    [
      "--fail-on-warning",
      "--failOnWarning",
      "--warn-on-approaching-expiration",
      "--warnOnApproachingExpiration",
    ].includes(arg)
  );
  const failOnWarning =
    options.failOnWarning ??
    options.warnOnApproachingExpiration ??
    cliFailOnWarning;
  const warnThresholdDays = options.warnThresholdDays ?? WARN_THRESHOLD_DAYS;

  const now = options.now || new Date();
  const ignoreRules = loadIgnoreList(now, warnThresholdDays);
  let hasInvalidRules = false;
  let hasExpiredRules = false;

  for (const rule of ignoreRules) {
    if (!rule.isValid) {
      console.error(
        `${colors.brightRed}❌ Invalid vulnerability override definition for advisory "${
          rule.advisory || rule.package || "unknown"
        }": ${rule.validationError}${colors.reset}`
      );
      hasInvalidRules = true;
    } else if (rule.isExpired) {
      console.error(
        `${colors.brightRed}❌ Vulnerability override for advisory "${rule.advisory}" expired on ${rule.expiresAt}. Override rejected.${colors.reset}`
      );
      hasExpiredRules = true;
    } else if (rule.isApproachingExpiration) {
      console.warn(
        `${colors.brightYellow}⚠️ WARNING: Vulnerability override for advisory "${rule.advisory}" expires in ${rule.remainingDays} days (Package: ${
          rule.package || "all"
        }, Owner: ${rule.owner}, Follow-up: ${rule.followUp}, Reason: ${rule.reason})${colors.reset}`
      );
    } else {
      console.log(
        `${colors.gray}ℹ️ Active override rule: Advisory ${rule.advisory} (${rule.remainingDays} days remaining, Package: ${
          rule.package || "all"
        }, Owner: ${rule.owner}, Follow-up: ${rule.followUp}, Reason: ${rule.reason})${colors.reset}`
      );
    }
  }

  const auditResult = spawnSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: true,
  });

  let auditJson: AuditReport | null = null;
  const rawOutput = (auditResult.stdout || "").trim();
  const rawStderr = (auditResult.stderr || "").trim();

  if (rawOutput) {
    try {
      const firstBrace = rawOutput.indexOf("{");
      const lastBrace = rawOutput.lastIndexOf("}");
      const jsonStr =
        firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
          ? rawOutput.slice(firstBrace, lastBrace + 1)
          : rawOutput;
      auditJson = JSON.parse(jsonStr) as AuditReport;
    } catch (_e) {
      // Failed to parse stdout as JSON
    }
  }

  if (!auditJson && rawStderr && rawStderr.includes("{")) {
    try {
      const firstBrace = rawStderr.indexOf("{");
      const lastBrace = rawStderr.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        auditJson = JSON.parse(
          rawStderr.slice(firstBrace, lastBrace + 1)
        ) as AuditReport;
      }
    } catch (_e) {
      // Failed to parse stderr as JSON
    }
  }

  if (
    auditResult.error ||
    !auditJson ||
    typeof auditJson !== "object" ||
    Array.isArray(auditJson) ||
    !auditJson.vulnerabilities ||
    typeof auditJson.vulnerabilities !== "object" ||
    Array.isArray(auditJson.vulnerabilities) ||
    "error" in auditJson ||
    auditResult.signal ||
    (auditResult.status != null &&
      auditResult.status !== 0 &&
      (auditResult.status !== 1 ||
        Object.keys(auditJson.vulnerabilities).length === 0))
  ) {
    console.error(
      `${colors.brightRed}❌ npm audit execution failed or returned an invalid audit report.${colors.reset}`
    );
    writeAuditFailureStepSummary(
      "npm audit execution failed or returned invalid JSON."
    );
    // Raw process output can contain credentials; report only the failure category.
    if (options.throwOnError) {
      throw new Error("npm audit execution failed or returned invalid JSON.");
    }
    process.exit(1);
  }

  const vulnerabilities = auditJson.vulnerabilities || {};
  const unhandledVulnerabilities: Array<{
    pkgName: string;
    info: VulnerabilityInfo;
    advisory: Advisory;
  }> = [];
  let pretextVulnerabilitiesFound = false;

  for (const [pkgName, info] of Object.entries(vulnerabilities)) {
    const vuln = info as VulnerabilityInfo;
    const severity = (vuln.severity || "").toLowerCase();

    if (severity === "high" || severity === "critical") {
      if (isPretextRelated(pkgName, vuln)) {
        pretextVulnerabilitiesFound = true;
      } else {
        const advisories = collectAdvisoriesForVulnerability(
          pkgName,
          vulnerabilities
        );

        for (const adv of advisories) {
          const matchingRule = ignoreRules.find((r) =>
            matchAdvisoryRule(r, adv, pkgName)
          );

          if (matchingRule) {
            if (matchingRule.isApproachingExpiration) {
              console.warn(
                `${colors.brightYellow}⚠️ WARNING: Vulnerability override for advisory "${matchingRule.advisory}" (${pkgName}) expires in ${matchingRule.remainingDays} days (Expires: ${matchingRule.expiresAt}, Owner: ${matchingRule.owner}, Follow-up: ${matchingRule.followUp}, Reason: ${matchingRule.reason})${colors.reset}`
              );
            } else {
              console.log(
                `${colors.gray}ℹ️ Overriding vulnerability for ${pkgName} / Advisory ${matchingRule.advisory} (Expires: ${matchingRule.expiresAt}, Remaining: ${matchingRule.remainingDays} days, Owner: ${matchingRule.owner}, Follow-up: ${matchingRule.followUp}, Reason: ${matchingRule.reason})${colors.reset}`
              );
            }
          } else {
            unhandledVulnerabilities.push({
              pkgName,
              info: vuln,
              advisory: adv,
            });
          }
        }
      }
    }
  }

  const approachingRules = ignoreRules.filter(
    (r) => r.isValid && !r.isExpired && r.isApproachingExpiration
  );

  if (approachingRules.length > 0) {
    console.warn(
      `\n${colors.brightYellow}${colors.bold}⚠️ PRE-EXPIRATION WARNING: ${approachingRules.length} vulnerability override(s) expiring within ${warnThresholdDays} days:${colors.reset}`
    );
    for (const rule of approachingRules) {
      console.warn(
        `  ${colors.brightYellow}• Advisory:${colors.reset} ${colors.bold}${rule.advisory}${colors.reset} (Package: ${rule.package || "all"})`
      );
      console.warn(
        `    ${colors.bold}Days Remaining:${colors.reset} ${rule.remainingDays} (Expires: ${rule.expiresAt})`
      );
      console.warn(
        `    ${colors.bold}Risk Owner:${colors.reset} ${rule.owner}`
      );
      console.warn(
        `    ${colors.bold}Follow-up Ticket:${colors.reset} ${rule.followUp}`
      );
      console.warn(`    ${colors.bold}Reason:${colors.reset} ${rule.reason}`);
    }
    console.warn("");
  }

  let failed = hasInvalidRules || hasExpiredRules;

  if (failOnWarning && approachingRules.length > 0) {
    console.error(
      `${colors.brightRed}❌ Security check failed due to strict pre-expiration warning policy (--fail-on-warning / failOnWarning).${colors.reset}`
    );
    failed = true;
  }

  if (pretextVulnerabilitiesFound) {
    console.error(
      `${colors.brightRed}${colors.bold}❌ SECURITY ALERT:${colors.reset}`
    );
    console.error(
      `${colors.red}A dependency vulnerability affecting a core layout component has been detected. Please refer to SECURITY.md for the private disclosure policy and report privately.${colors.reset}\n`
    );
    failed = true;
  }

  const seenUnhandled = new Set<string>();
  const uniqueUnhandled = unhandledVulnerabilities.filter((item) => {
    const advId = item.advisory
      ? getAdvisoryIdentifiers(item.advisory)[0] || item.advisory.title || "N/A"
      : "N/A";
    const key = `${item.pkgName}:${advId}`;
    if (seenUnhandled.has(key)) return false;
    seenUnhandled.add(key);
    return true;
  });

  if (uniqueUnhandled.length > 0) {
    console.error(
      `${colors.brightRed}${colors.bold}❌ Blocked high/critical severity dependency vulnerabilities:${colors.reset}\n`
    );

    for (const { pkgName, info, advisory } of uniqueUnhandled) {
      console.error(
        `${colors.bold}${colors.brightYellow}• Package:${colors.reset} ${colors.bold}${pkgName}${colors.reset}`
      );
      console.error(
        `  ${colors.bold}Severity:${colors.reset} ${(info.severity || "").toUpperCase()}`
      );
      if (advisory) {
        const advId =
          getAdvisoryIdentifiers(advisory)[0] || advisory.title || "N/A";
        console.error(`  ${colors.bold}Advisory ID:${colors.reset} ${advId}`);
        console.error(
          `  ${colors.bold}Advisory Title:${colors.reset} ${advisory.title || "N/A"}`
        );
        console.error(
          `  ${colors.bold}Advisory URL:${colors.reset} ${advisory.url || "N/A"}`
        );
        console.error(
          `  ${colors.bold}Vulnerable Range:${colors.reset} ${advisory.range || "N/A"}`
        );
      }
      console.error("");
    }
    failed = true;
  }

  writeStepSummary(
    failed,
    uniqueUnhandled,
    ignoreRules,
    pretextVulnerabilitiesFound
  );

  if (failed) {
    console.error(
      `${colors.brightRed}${colors.bold}✖ Security status check failed.${colors.reset}`
    );
    console.error(
      `${colors.gray}Vulnerable third-party packages must be fixed or approved (added to ignore list with explicit advisory ID, expiration date <= 90 days, and justification) to pass this gate.${colors.reset}`
    );
    if (options.throwOnError) {
      throw new Error(
        "Security audit failed due to unhandled vulnerabilities or invalid overrides."
      );
    }
    process.exit(1);
  } else {
    console.log(
      `${colors.brightGreen}${colors.bold}✔ Security check passed successfully.${colors.reset}`
    );
    console.log(
      `${colors.gray}No unignored high or critical vulnerabilities found in third-party packages.${colors.reset}`
    );
    if (options.throwOnError) {
      return true;
    }
    process.exit(0);
  }
}

export function writeAuditFailureStepSummary(message: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    "# 🛡️ Security Vulnerability Audit Report",
    "",
    `- **Scan Time:** ${new Date().toISOString()}`,
    "- **Status:** ❌ Failed",
    "",
    "### ❌ Security Execution Error",
    "",
    `\`\`\`\n${message}\n\`\`\``,
    "",
  ];

  try {
    fs.appendFileSync(summaryFile, lines.join("\n") + "\n", "utf8");
  } catch (e) {
    console.warn("Failed to write GitHub step summary:", e);
  }
}

export function writeStepSummary(
  failed: boolean,
  uniqueUnhandled: Array<{
    pkgName: string;
    info: VulnerabilityInfo;
    advisory: Advisory;
  }>,
  ignoreRules: ParsedIgnoreRule[],
  pretextVulnerabilitiesFound: boolean
): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines: string[] = [];
  lines.push("# 🛡️ Security Vulnerability Audit Report");
  lines.push("");
  lines.push(`- **Scan Time:** ${new Date().toISOString()}`);
  lines.push(`- **Status:** ${failed ? "❌ Failed" : "✅ Passed"}`);
  lines.push("");

  if (failed) {
    lines.push("### ❌ Security Scan Summary");
    lines.push("");
    if (pretextVulnerabilitiesFound) {
      lines.push(
        "> ⚠️ **SECURITY ALERT:** A dependency vulnerability affecting a core layout component was detected. Please refer to `SECURITY.md` for disclosure instructions."
      );
      lines.push("");
    }

    const invalidRules = ignoreRules.filter((r) => !r.isValid);
    if (invalidRules.length > 0) {
      lines.push("#### Invalid Override Rules");
      lines.push("");
      for (const rule of invalidRules) {
        lines.push(
          `- **${rule.advisory || rule.package || "Unknown"}**: ${rule.validationError}`
        );
      }
      lines.push("");
    }

    const expiredRules = ignoreRules.filter((r) => r.isValid && r.isExpired);
    if (expiredRules.length > 0) {
      lines.push("#### Expired Override Rules");
      lines.push("");
      for (const rule of expiredRules) {
        lines.push(
          `- **Advisory ${rule.advisory}** (Package: \`${rule.package || "all"}\`) expired on ${rule.expiresAt}`
        );
      }
      lines.push("");
    }

    if (uniqueUnhandled.length > 0) {
      lines.push("#### Unhandled High/Critical Vulnerabilities");
      lines.push("");
      lines.push(
        "| Package | Severity | Advisory ID | Advisory Title | Vulnerable Range | Link |"
      );
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const { pkgName, info, advisory } of uniqueUnhandled) {
        const advId = advisory
          ? getAdvisoryIdentifiers(advisory)[0] || "N/A"
          : "N/A";
        const title = advisory?.title || "N/A";
        const severity = (info.severity || "").toUpperCase();
        const range = advisory?.range || info.range || "N/A";
        const url = advisory?.url ? `[Advisory](${advisory.url})` : "N/A";
        lines.push(
          `| \`${pkgName}\` | ${severity} | \`${advId}\` | ${title} | \`${range}\` | ${url} |`
        );
      }
      lines.push("");
    }
  } else {
    lines.push("### ✅ Security Scan Passed");
    lines.push("");
    lines.push(
      "No unhandled high or critical vulnerabilities found in third-party dependencies."
    );
    lines.push("");
  }

  const activeRules = ignoreRules.filter((r) => r.isValid && !r.isExpired);
  if (activeRules.length > 0) {
    lines.push("### ℹ️ Active Vulnerability Overrides");
    lines.push("");
    lines.push(
      "| Advisory | Package | Remaining Days | Owner | Follow-up | Reason |"
    );
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const rule of activeRules) {
      lines.push(
        `| \`${rule.advisory}\` | \`${rule.package || "all"}\` | ${rule.remainingDays}d | ${rule.owner} | ${rule.followUp} | ${rule.reason} |`
      );
    }
    lines.push("");
  }

  try {
    fs.appendFileSync(summaryFile, lines.join("\n") + "\n", "utf8");
  } catch (e) {
    console.warn("Failed to write GitHub step summary:", e);
  }
}

if (
  typeof process.env.VITEST === "undefined" &&
  (require.main === module ||
    (process.argv[1] && process.argv[1].includes("security-audit")))
) {
  runSecurityAudit();
}
