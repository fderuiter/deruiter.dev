#!/usr/bin/env node
import {
  loadIgnoreList,
  getAdvisoryIdentifiers,
  collectAdvisoriesForVulnerability,
  matchAdvisoryRule,
  isPretextRelated,
  readNpmAuditReport,
} from "./security-audit";

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

export function extractIssueNumber(followUp?: string): number | null {
  if (!followUp) return null;
  const match = followUp.match(/(?:issues\/|#)(\d+)/);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(followUp.trim(), 10);
  return isNaN(num) ? null : num;
}

export function getPriorityForSeverity(
  severity: "critical" | "high" | "moderate"
): string {
  switch (severity) {
    case "critical":
      return "p1-critical";
    case "high":
      return "p2-high";
    case "moderate":
      return "p3-medium";
    default:
      return "p2-high";
  }
}

export function collectTriageItems(
  now: Date = new Date()
): SecurityTriageItem[] {
  const ignoreRules = loadIgnoreList(now);
  const items: SecurityTriageItem[] = [];

  for (const rule of ignoreRules) {
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
    const rawSeverity = (vuln.severity || "").toLowerCase();

    if (
      rawSeverity === "critical" ||
      rawSeverity === "high" ||
      rawSeverity === "moderate"
    ) {
      if (!isPretextRelated(pkgName, vuln)) {
        const advisories = collectAdvisoriesForVulnerability(
          pkgName,
          vulnerabilities
        );

        for (const adv of advisories) {
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
              if (
                getPriorityForSeverity(severity) <
                getPriorityForSeverity(previous.severity)
              ) {
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
  }

  items.push(...unhandled.values());

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

export async function triageSecurityIssues(options?: {
  token?: string;
  repo?: string;
  now?: Date;
}): Promise<{ created: number; updated: number; closed: number }> {
  const token =
    options?.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo =
    options?.repo || process.env.GITHUB_REPOSITORY || "fderuiter/deruiter.dev";

  if (!token) {
    console.warn("GH_TOKEN not set, skipping GitHub issue triage creation.");
    return { created: 0, updated: 0, closed: 0 };
  }

  const items = collectTriageItems(options?.now);

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
  let closed = 0;

  if (items.length === 0) {
    console.log(
      "No security triage items detected (clean scan). Checking for open tracking issues to resolve..."
    );
    for (const issue of existingIssues) {
      const isTrackingIssue =
        issue.state === "open" &&
        (issue.title.includes("scheduled-vulnerability-alert") ||
          issue.body.includes("scheduled-vulnerability-alert") ||
          issue.title.toLowerCase().includes("[security triage]") ||
          (Array.isArray(issue.labels) &&
            issue.labels.some((l) => {
              const name = typeof l === "string" ? l : l.name;
              return name === "automated-alert" || name === "security-triage";
            })));

      if (isTrackingIssue) {
        try {
          const commentRes = await fetch(
            `https://api.github.com/repos/${repo}/issues/${issue.number}/comments`,
            {
              method: "POST",
              headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "security-triage-bot",
              },
              body: JSON.stringify({
                body: `✅ **Scheduled Security Audit Cleared:** [scheduled-vulnerability-alert] The latest scheduled security audit passed cleanly with zero vulnerability findings. Automatically resolving and closing this tracking issue.`,
              }),
            }
          );

          if (commentRes.status === 403 || commentRes.status === 429) {
            console.warn(
              `Rate limit encountered posting comment on issue #${issue.number}.`
            );
          }

          const closeRes = await fetch(
            `https://api.github.com/repos/${repo}/issues/${issue.number}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "security-triage-bot",
              },
              body: JSON.stringify({
                state: "closed",
                state_reason: "completed",
              }),
            }
          );

          if (closeRes.ok) {
            console.log(
              `Resolved and closed security triage issue #${issue.number}`
            );
            closed++;
          } else {
            console.warn(
              `Failed to close issue #${issue.number}: ${closeRes.status}`
            );
          }
        } catch (err) {
          console.warn(`Error resolving issue #${issue.number}:`, err);
        }
      }
    }
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

  for (const item of items) {
    const openIssue = existingIssues.find(
      (issue) =>
        issue.state === "open" &&
        (issue.title.toLowerCase().includes(item.advisoryId.toLowerCase()) ||
          issue.body.toLowerCase().includes(item.advisoryId.toLowerCase()) ||
          (item.followUp && extractIssueNumber(item.followUp) === issue.number))
    );

    if (openIssue) {
      if (item.type === "expiring_rule") {
        let alreadyWarned =
          openIssue.body.includes(
            "### Approaching Override Expiration Details"
          ) || openIssue.body.includes("<!-- marker: expiring-rule-warning");

        if (!alreadyWarned) {
          const comments = await fetchIssueComments(openIssue.number);
          alreadyWarned = comments.some(
            (c) =>
              c.body &&
              (c.body.includes("<!-- marker: expiring-rule-warning") ||
                (c.body.includes("[scheduled-vulnerability-alert]") &&
                  c.body.toLowerCase().includes("warning window")))
          );
        }

        if (alreadyWarned) {
          console.log(
            `Issue #${openIssue.number} already notified of approaching expiration for ${item.advisoryId}. Skipping daily comment.`
          );
          continue;
        }

        const commentText = sanitizeLogDetails(
          `⚠️ **Scheduled Security Audit Alert:** [scheduled-vulnerability-alert] Temporary override rule for \`${item.advisoryId}\` (${item.pkgName || "N/A"}) has entered its pre-expiration warning window (${item.remainingDays !== undefined ? `${item.remainingDays} days remaining` : "approaching expiration"}, expires \`${item.expiresAt || "N/A"}\`). Please remediate or renew before expiration.\n\n<!-- marker: expiring-rule-warning:${item.advisoryId}:${item.expiresAt || ""} -->\n<!-- marker: expiring-rule-warning -->`
        );

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
              `Notified issue #${openIssue.number} of approaching expiration for ${item.advisoryId}`
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
        const commentText = sanitizeLogDetails(
          `⚠️ **Scheduled Security Audit Alert:** [scheduled-vulnerability-alert] Vulnerability or override issue \`${item.advisoryId}\` (${item.pkgName || "N/A"}) remains active as of ${new Date().toISOString()}.`
        );
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
              `Updated issue #${openIssue.number} for advisory ${item.advisoryId}`
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
      }
    } else {
      const title = `[scheduled-vulnerability-alert] [Security Triage] ${item.severity.toUpperCase()} Advisory: ${item.advisoryId}${item.pkgName ? ` (${item.pkgName})` : ""}`;
      const rawBodyLines = [
        `# 🛡️ Scheduled Vulnerability Alert Ticket`,
        `<!-- tag: scheduled-vulnerability-alert -->`,
        "",
        `- **Advisory Identifier:** \`${item.advisoryId}\``,
        `- **Package Name:** \`${item.pkgName || "N/A"}\``,
        `- **Severity:** **${item.severity.toUpperCase()}**`,
        `- **Scan Time:** ${new Date().toISOString()}`,
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
        "- [ ] `npm run audit:security -- --fail-on-warning --severity=moderate` passes cleanly or with an approved, active ignore rule."
      );

      rawBodyLines.push("");
      rawBodyLines.push("### 📋 Remediation Instructions");
      rawBodyLines.push(
        "1. Review the advisory details and assess production impact."
      );
      rawBodyLines.push(
        "2. Update the affected dependency to a patched version if available."
      );
      rawBodyLines.push(
        "3. If an upstream patch is unavailable, create a valid entry in `config/security-audit-ignore.json` with justification, owner, follow-up ticket, explicit `severity`, and an expiration date within policy limit."
      );

      const body = sanitizeLogDetails(rawBodyLines.join("\n"));
      const priorityLabel = getPriorityForSeverity(item.severity);
      const labels = [
        "type:security",
        priorityLabel,
        "area:security",
        "automated-alert",
      ];

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
