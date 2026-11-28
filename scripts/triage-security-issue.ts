#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  loadIgnoreList,
  getAdvisoryIdentifiers,
  collectAdvisoriesForVulnerability,
  matchAdvisoryRule,
  isPretextRelated,
  readNpmAuditReport,
  extractGhsaId,
  filterWithdrawnAdvisories,
} from "./security-audit";
import {
  findExpiringExceptions,
  validateExceptions,
  type LicenseException,
} from "./license-audit";

export interface SecurityTriageItem {
  type: "unhandled" | "expired_rule" | "invalid_rule" | "expiring_rule";
  advisoryId: string;
  pkgName?: string;
  affectedPackages?: string[];
  severity: "critical" | "high" | "moderate";
  title?: string;
  url?: string;
  range?: string;
  reason?: string;
  validationError?: string;
  remainingDays?: number;
  expiresAt?: string;
  followUp?: string;
}

/**
 * Approved governance labels for automated security triage issues
 * (docs/how-to/issue-governance.md & SECURITY.md). Priority stays a human call.
 */
export const TRIAGE_GOVERNANCE_LABELS = Object.freeze([
  "type:chore",
  "needs-triage",
  "area:security",
  "security-triage",
]);

const PRETEXT_HALT_MESSAGE =
  "Halting automated public security triage: @chenglou/pretext alert detected. Per SECURITY.md, do not open public issues or disclose details publicly; coordinate privately via GitHub Security Advisories.";

function severityRank(severity: "critical" | "high" | "moderate"): number {
  switch (severity) {
    case "critical":
      return 1;
    case "high":
      return 2;
    case "moderate":
      return 3;
    default:
      return 2;
  }
}

export function extractIssueNumber(followUp?: string): number | null {
  if (!followUp) return null;
  const match = followUp.match(/(?:issues\/|#)(\d+)/);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(followUp.trim(), 10);
  return isNaN(num) ? null : num;
}

export function buildTriageMarker(item: SecurityTriageItem): string {
  const scope =
    item.type === "expiring_rule" ? item.expiresAt || "" : item.pkgName || "";
  return `<!-- security-triage:${item.type}:${item.advisoryId}:${scope} -->`;
}

function collectLicensePolicyTriageItems(
  now: Date,
  workspaceRoot: string
): SecurityTriageItem[] {
  const policyPath = path.join(workspaceRoot, "config", "license-policy.json");
  if (!fs.existsSync(policyPath)) return [];

  try {
    const raw = fs.readFileSync(policyPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as { exceptions?: unknown }).exceptions)
    ) {
      return [];
    }

    const exceptions = (parsed as { exceptions: LicenseException[] })
      .exceptions;
    const { validExceptions, invalidExceptions } = validateExceptions(
      exceptions,
      now
    );
    const items: SecurityTriageItem[] = [];

    for (const invalid of invalidExceptions) {
      const isExpired = invalid.reason.includes("expired on ");
      items.push({
        type: isExpired ? "expired_rule" : "invalid_rule",
        advisoryId: `license-exception:${invalid.packageName}`,
        pkgName: invalid.packageName,
        severity: "high",
        reason: isExpired ? invalid.reason : undefined,
        validationError: isExpired ? undefined : invalid.reason,
      });
    }

    for (const expiring of findExpiringExceptions(validExceptions, now)) {
      items.push({
        type: "expiring_rule",
        advisoryId: `license-exception:${expiring.packageName}`,
        pkgName: expiring.packageName,
        severity: "moderate",
        reason: `License exception (${expiring.riskOwner}) approaching expiration`,
        remainingDays: expiring.daysLeft,
        expiresAt: expiring.expiresAt,
        followUp: expiring.ticket,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export function collectTriageItems(
  now: Date = new Date(),
  workspaceRoot: string = path.resolve(__dirname, "..")
): SecurityTriageItem[] {
  const ignoreRules = loadIgnoreList(now);
  const items: SecurityTriageItem[] = [];

  for (const rule of ignoreRules) {
    if (
      isPretextRelated(rule.package || "", {
        name: rule.package,
        via: [rule.advisory || "", rule.reason || ""],
      })
    ) {
      throw new Error(PRETEXT_HALT_MESSAGE);
    }

    if (!rule.isValid) {
      items.push({
        type: "invalid_rule",
        advisoryId: rule.advisory || rule.package || "Unknown",
        pkgName: rule.package,
        severity: rule.severity || "critical",
        validationError: rule.validationError,
      });
    } else if (rule.isExpired) {
      items.push({
        type: "expired_rule",
        advisoryId: rule.advisory,
        pkgName: rule.package,
        severity: rule.severity || "critical",
        reason: rule.reason,
        followUp: rule.followUp,
      });
    } else if (rule.isApproachingExpiration) {
      items.push({
        type: "expiring_rule",
        advisoryId: rule.advisory,
        pkgName: rule.package,
        severity: rule.severity || "critical",
        reason: rule.reason,
        remainingDays: rule.remainingDays,
        expiresAt: rule.expiresAt,
        followUp: rule.followUp,
      });
    }
  }

  const vulnerabilities = readNpmAuditReport();
  if (!vulnerabilities) {
    throw new Error(
      "npm audit failed or returned an invalid report. GitHub issues were left untouched."
    );
  }

  const unhandled = new Map<
    string,
    SecurityTriageItem & { affectedPackages: string[] }
  >();
  for (const [pkgName, info] of Object.entries(vulnerabilities)) {
    const vuln = info;
    if (isPretextRelated(pkgName, vuln)) {
      throw new Error(PRETEXT_HALT_MESSAGE);
    }

    const rawSeverity = (vuln.severity || "").toLowerCase();

    if (
      rawSeverity === "critical" ||
      rawSeverity === "high" ||
      rawSeverity === "moderate"
    ) {
      const advisories = collectAdvisoriesForVulnerability(
        pkgName,
        vulnerabilities
      );

      for (const adv of advisories) {
        if (
          isPretextRelated(adv.dependency || adv.name || pkgName, {
            name: adv.dependency || adv.name || pkgName,
            via: [adv],
          })
        ) {
          throw new Error(PRETEXT_HALT_MESSAGE);
        }

        const matchingRule = ignoreRules.find((r) =>
          matchAdvisoryRule(r, adv, pkgName)
        );

        if (!matchingRule) {
          const advId =
            getAdvisoryIdentifiers(adv)[0] || adv.title || "Unknown";
          const severity: "critical" | "high" | "moderate" =
            rawSeverity === "critical"
              ? "critical"
              : rawSeverity === "high"
                ? "high"
                : "moderate";

          const advisoryPackage = adv.dependency || adv.name || pkgName;
          const key = JSON.stringify([advId, advisoryPackage]);
          const previous = unhandled.get(key);
          if (previous) {
            if (!previous.affectedPackages.includes(pkgName)) {
              previous.affectedPackages.push(pkgName);
            }
            if (severityRank(severity) < severityRank(previous.severity)) {
              previous.severity = severity;
            }
            continue;
          }
          unhandled.set(key, {
            type: "unhandled",
            advisoryId: advId,
            pkgName: advisoryPackage,
            affectedPackages: [pkgName],
            severity,
            title: adv.title,
            url: adv.url,
            range: adv.range || vuln.range,
          });
        }
      }
    }
  }

  items.push(...unhandled.values());
  items.push(...collectLicensePolicyTriageItems(now, workspaceRoot));

  // Deduplicate items by advisoryId and type
  const seen = new Set<string>();
  const uniqueItems: SecurityTriageItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.advisoryId}:${item.pkgName || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

export function sanitizeLogDetails(input?: string): string {
  if (!input) return "";
  return input
    .replace(/\/home\/[a-zA-Z0-9_-]+\/work\/[^\s/]+\/[^\s/]+/g, "<workspace>")
    .replace(/\/home\/runner\/work\/[^\s/]+\/[^\s/]+/g, "<workspace>")
    .replace(/\/app\/[a-zA-Z0-9_.-]+/g, "<workspace>")
    .replace(/C:\\[^\s/]+/g, "<workspace>")
    .replace(/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g, "[REDACTED_TOKEN]")
    .replace(/github_pat_[A-Za-z0-9_]{22,}/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/https?:\/\/[a-zA-Z0-9.-]+:[0-9]+/g, "http://<redacted_host>");
}

export interface ExistingGitHubIssue {
  number: number;
  title: string;
  state: string;
  body: string;
  labels?: Array<{ name: string } | string>;
}

function appendStepSummary(lines: string[]): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
  } catch {
    // Best-effort summary output
  }
}

export async function triageSecurityIssues(options?: {
  token?: string;
  repo?: string;
  now?: Date;
  checkWithdrawnAdvisories?: boolean;
  fetchImpl?: typeof fetch;
  /** Report-first default: only mutates GitHub issues when true or SECURITY_TRIAGE_APPLY=true. */
  apply?: boolean;
  workspaceRoot?: string;
}): Promise<{ created: number; updated: number; closed: number }> {
  const token =
    options?.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo =
    options?.repo || process.env.GITHUB_REPOSITORY || "fderuiter/deruiter.dev";
  const apply = options?.apply ?? process.env.SECURITY_TRIAGE_APPLY === "true";

  if (!token) {
    console.warn("GH_TOKEN not set, skipping GitHub issue triage creation.");
    return { created: 0, updated: 0, closed: 0 };
  }

  let items = collectTriageItems(options?.now, options?.workspaceRoot);
  const shouldCheckWithdrawn =
    options?.checkWithdrawnAdvisories ??
    (Boolean(options?.fetchImpl) || typeof process.env.VITEST === "undefined");
  if (shouldCheckWithdrawn && items.some((item) => item.type === "unhandled")) {
    const unhandledItems = items.filter((item) => item.type === "unhandled");
    const nonUnhandledItems = items.filter((item) => item.type !== "unhandled");
    const { active, withdrawn } = await filterWithdrawnAdvisories(
      unhandledItems,
      (item) =>
        extractGhsaId({ url: item.url, title: item.title }, item.advisoryId),
      {
        githubToken: token,
        fetchImpl: options?.fetchImpl,
      }
    );
    for (const entry of withdrawn) {
      console.log(
        `Skipping triage for withdrawn advisory ${entry.ghsaId} (withdrawn at ${entry.withdrawnAt}).`
      );
    }
    items = [...nonUnhandledItems, ...active];
  }

  const fetchIssuesByLabel = async (
    label: string
  ): Promise<ExistingGitHubIssue[]> => {
    try {
      const listRes = await fetch(
        `https://api.github.com/repos/${repo}/issues?labels=${encodeURIComponent(
          label
        )}&state=open&per_page=100`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "security-triage-bot",
          },
        }
      );

      if (listRes.status === 403 || listRes.status === 429) {
        console.warn(
          `GitHub API rate limit hit (${listRes.status}). Skipping issue search.`
        );
        return [];
      }

      if (listRes.ok) {
        return (await listRes.json()) as ExistingGitHubIssue[];
      } else {
        console.warn(
          `Failed to list existing issues for label ${label}: ${listRes.status} ${listRes.statusText}`
        );
      }
    } catch (err) {
      console.warn(`Error fetching issues for label ${label}:`, err);
    }
    return [];
  };

  const SEARCH_LABELS = [
    "security",
    "automated-alert",
    "security-triage",
    "area:security",
  ];

  const issueMap = new Map<number, ExistingGitHubIssue>();
  for (const label of SEARCH_LABELS) {
    const issues = await fetchIssuesByLabel(label);
    for (const issue of issues) {
      issueMap.set(issue.number, issue);
    }
  }
  const existingIssues = Array.from(issueMap.values());

  let created = 0;
  let updated = 0;
  const closed = 0;

  if (items.length === 0) {
    console.log(
      "No security triage items detected (clean scan). Leaving open tracking issues untouched for human closure."
    );
    return { created, updated, closed };
  }

  const commentsCache = new Map<number, Array<{ body?: string }>>();
  const fetchIssueComments = async (
    issueNumber: number
  ): Promise<Array<{ body?: string }>> => {
    if (commentsCache.has(issueNumber)) {
      return commentsCache.get(issueNumber)!;
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "security-triage-bot",
          },
        }
      );
      if (res.ok) {
        const comments = (await res.json()) as Array<{ body?: string }>;
        commentsCache.set(issueNumber, comments);
        return comments;
      }
    } catch (_err) {
      // Ignore
    }
    return [];
  };

  const hasMarkerInBodyOrComments = async (
    issue: ExistingGitHubIssue,
    markers: string[]
  ): Promise<boolean> => {
    if (markers.some((m) => issue.body.includes(m))) {
      return true;
    }
    const comments = await fetchIssueComments(issue.number);
    return comments.some(
      (c) => Boolean(c.body) && markers.some((m) => c.body!.includes(m))
    );
  };

  const dryRunActions: string[] = [];

  for (const item of items) {
    const marker = buildTriageMarker(item);
    const openIssue = existingIssues.find(
      (issue) =>
        issue.state === "open" &&
        (issue.title.toLowerCase().includes(item.advisoryId.toLowerCase()) ||
          issue.body.toLowerCase().includes(item.advisoryId.toLowerCase()) ||
          (item.followUp && extractIssueNumber(item.followUp) === issue.number))
    );

    if (openIssue) {
      const checkMarkers =
        item.type === "expiring_rule"
          ? [
              marker,
              "<!-- marker: expiring-rule-warning",
              "### Approaching Override Expiration Details",
            ]
          : [marker];

      const alreadyNotified = await hasMarkerInBodyOrComments(
        openIssue,
        checkMarkers
      );
      if (alreadyNotified) {
        console.log(
          `Issue #${openIssue.number} already carries triage marker for ${item.advisoryId}. Skipping duplicate comment.`
        );
        continue;
      }

      const commentText =
        item.type === "expiring_rule"
          ? sanitizeLogDetails(
              `⚠️ **Scheduled Security Audit Alert:** [scheduled-vulnerability-alert] Temporary exception rule for \`${item.advisoryId}\` (${item.pkgName || "N/A"}) has entered its pre-expiration warning window (${item.remainingDays !== undefined ? `${item.remainingDays} days remaining` : "approaching expiration"}, expires \`${item.expiresAt || "N/A"}\`). Please remediate or renew before expiration.\n\n${marker}\n<!-- marker: expiring-rule-warning -->`
            )
          : sanitizeLogDetails(
              `⚠️ **Scheduled Security Audit Alert:** [scheduled-vulnerability-alert] Vulnerability or policy exception \`${item.advisoryId}\` (${item.pkgName || "N/A"}) remains active.\n\n${marker}`
            );

      if (!apply) {
        const msg = `Dry run: would post deduplicated triage comment on #${openIssue.number} for ${item.advisoryId}. Set SECURITY_TRIAGE_APPLY=true to apply.`;
        console.log(msg);
        dryRunActions.push(`- ${msg}`);
        continue;
      }

      try {
        const commentRes = await fetch(
          `https://api.github.com/repos/${repo}/issues/${openIssue.number}/comments`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
              "User-Agent": "security-triage-bot",
            },
            body: JSON.stringify({
              body: commentText,
            }),
          }
        );
        if (commentRes.ok) {
          console.log(
            `Updated issue #${openIssue.number} for ${item.advisoryId}`
          );
          updated++;
        } else {
          console.warn(
            `Failed to update issue #${openIssue.number}: ${commentRes.status}`
          );
        }
      } catch (err) {
        console.warn(`Error updating issue #${openIssue.number}:`, err);
      }
    } else {
      const title = `[scheduled-vulnerability-alert] [Security Triage] ${item.severity.toUpperCase()} Advisory: ${item.advisoryId}${item.pkgName ? ` (${item.pkgName})` : ""}`;
      const rawBodyLines = [
        `# 🛡️ Scheduled Vulnerability Alert Ticket`,
        `<!-- tag: scheduled-vulnerability-alert -->`,
        marker,
        "",
        `- **Advisory Identifier:** \`${item.advisoryId}\``,
        `- **Package Name:** \`${item.pkgName || "N/A"}\``,
        `- **Severity:** **${item.severity.toUpperCase()}**`,
        `- **Scan Time:** ${(options?.now ?? new Date()).toISOString()}`,
        `- **Type:** \`${item.type}\``,
        "",
      ];

      if (item.type === "unhandled") {
        rawBodyLines.push("### Unhandled Advisory Details");
        rawBodyLines.push(`- **Title:** ${item.title || "N/A"}`);
        rawBodyLines.push(`- **Vulnerable Range:** \`${item.range || "N/A"}\``);
        if (item.affectedPackages && item.affectedPackages.length > 1) {
          const packages = [...item.affectedPackages].sort().join(", ");
          rawBodyLines.push(`- **Affected audit entries:** ${packages}`);
        }
        if (item.url) {
          rawBodyLines.push(`- **Reference:** [${item.url}](${item.url})`);
        }
      } else if (item.type === "expired_rule") {
        rawBodyLines.push("### Expired Override Rule Details");
        rawBodyLines.push(`- **Previous Reason:** ${item.reason || "N/A"}`);
        rawBodyLines.push(
          "The temporary override rule for this advisory has expired and must be remediated or re-approved."
        );
      } else if (item.type === "expiring_rule") {
        rawBodyLines.push("### Approaching Override Expiration Details");
        rawBodyLines.push(`- **Active Reason:** ${item.reason || "N/A"}`);
        if (item.remainingDays !== undefined) {
          rawBodyLines.push(`- **Remaining Days:** ${item.remainingDays}`);
        }
        if (item.expiresAt) {
          rawBodyLines.push(`- **Expiration Date:** \`${item.expiresAt}\``);
        }
        rawBodyLines.push(
          "The temporary override rule for this advisory is within its pre-expiration warning window and must be remediated or renewed before expiration."
        );
        rawBodyLines.push("");
        rawBodyLines.push(
          `<!-- marker: expiring-rule-warning:${item.advisoryId}:${item.expiresAt || ""} -->`
        );
        rawBodyLines.push(`<!-- marker: expiring-rule-warning -->`);
      } else if (item.type === "invalid_rule") {
        rawBodyLines.push("### Invalid Override Rule Details");
        rawBodyLines.push(
          `- **Validation Error:** ${item.validationError || "N/A"}`
        );
      }

      rawBodyLines.push("");
      rawBodyLines.push("### Acceptance");
      rawBodyLines.push(
        "- [ ] `npm run audit:security -- --fail-on-warning --severity=moderate` and `npm run audit:licenses` pass cleanly or with an approved, active exception."
      );

      rawBodyLines.push("");
      rawBodyLines.push("### 📋 Remediation Instructions");
      rawBodyLines.push(
        "1. Review the advisory or exception details and assess production impact."
      );
      rawBodyLines.push(
        "2. Update the affected dependency to a patched/compliant version if available."
      );
      rawBodyLines.push(
        "3. Assign human priority (`p0`–`p4`) during triage; if an upstream fix is unavailable, record a time-bounded exception in `config/security-audit-ignore.json` or `config/license-policy.json`."
      );

      const body = sanitizeLogDetails(rawBodyLines.join("\n"));
      const labels = [...TRIAGE_GOVERNANCE_LABELS];

      if (!apply) {
        const msg = `Dry run: would create issue "${title}" with labels [${labels.join(", ")}]. Set SECURITY_TRIAGE_APPLY=true to apply.`;
        console.log(msg);
        dryRunActions.push(`- ${msg}`);
        continue;
      }

      try {
        const createRes = await fetch(
          `https://api.github.com/repos/${repo}/issues`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
              "User-Agent": "security-triage-bot",
            },
            body: JSON.stringify({
              title,
              body,
              labels,
            }),
          }
        );

        if (createRes.ok) {
          const createdIssue = (await createRes.json()) as ExistingGitHubIssue;
          console.log(
            `Created new security-triage issue #${createdIssue.number} for ${item.advisoryId}`
          );
          created++;
        } else {
          console.warn(
            `Failed to create issue for ${item.advisoryId}: ${createRes.status}`
          );
        }
      } catch (err) {
        console.warn(`Error creating issue for ${item.advisoryId}:`, err);
      }
    }
  }

  if (!apply && dryRunActions.length > 0) {
    appendStepSummary([
      "### Security Triage Dry Run (`SECURITY_TRIAGE_APPLY != true`)",
      "",
      ...dryRunActions,
    ]);
  }

  return { created, updated, closed };
}

if (
  typeof process.env.VITEST === "undefined" &&
  (require.main === module ||
    (process.argv[1] && process.argv[1].includes("triage-security-issue")))
) {
  triageSecurityIssues().catch((err) => {
    console.error("Failed to run security triage escalation:", err);
    process.exit(1);
  });
}
