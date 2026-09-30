#!/usr/bin/env node
import { spawnSync } from "child_process";
import {
  loadIgnoreList,
  getAdvisoryIdentifiers,
  collectAdvisoriesForVulnerability,
  matchAdvisoryRule,
  isPretextRelated,
} from "./security-audit";
import type { AuditReport, VulnerabilityInfo } from "./security-audit";

export interface SecurityTriageItem {
  type: "unhandled" | "expired_rule" | "invalid_rule";
  advisoryId: string;
  pkgName?: string;
  severity: "critical" | "high";
  title?: string;
  url?: string;
  range?: string;
  reason?: string;
  validationError?: string;
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
      });
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

  if (auditJson && auditJson.vulnerabilities) {
    for (const [pkgName, info] of Object.entries(auditJson.vulnerabilities)) {
      const vuln = info as VulnerabilityInfo;
      const rawSeverity = (vuln.severity || "").toLowerCase();

      if (rawSeverity === "high" || rawSeverity === "critical") {
        if (!isPretextRelated(pkgName, vuln)) {
          const advisories = collectAdvisoriesForVulnerability(
            pkgName,
            auditJson.vulnerabilities
          );

          for (const adv of advisories) {
            const matchingRule = ignoreRules.find((r) =>
              matchAdvisoryRule(r, adv, pkgName)
            );

            if (!matchingRule) {
              const advId =
                getAdvisoryIdentifiers(adv)[0] || adv.title || "Unknown";
              const severity: "critical" | "high" =
                rawSeverity === "critical" ? "critical" : "high";

              items.push({
                type: "unhandled",
                advisoryId: advId,
                pkgName,
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
  }

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

export interface ExistingGitHubIssue {
  number: number;
  title: string;
  state: string;
  body: string;
}

export async function triageSecurityIssues(options?: {
  token?: string;
  repo?: string;
  now?: Date;
}): Promise<{ created: number; updated: number }> {
  const token =
    options?.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo =
    options?.repo || process.env.GITHUB_REPOSITORY || "fderuiter/portfolio";

  if (!token) {
    console.warn("GH_TOKEN not set, skipping GitHub issue triage creation.");
    return { created: 0, updated: 0 };
  }

  const items = collectTriageItems(options?.now);
  if (items.length === 0) {
    console.log("No security triage items detected.");
    return { created: 0, updated: 0 };
  }

  let existingIssues: ExistingGitHubIssue[] = [];
  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${repo}/issues?labels=security-triage&state=all&per_page=100`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "security-triage-bot",
        },
      }
    );

    if (listRes.ok) {
      existingIssues = (await listRes.json()) as ExistingGitHubIssue[];
    } else {
      console.warn(
        `Failed to list existing triage issues: ${listRes.status} ${listRes.statusText}`
      );
    }
  } catch (err) {
    console.warn("Error fetching existing triage issues:", err);
  }

  let created = 0;
  let updated = 0;

  for (const item of items) {
    const openIssue = existingIssues.find(
      (issue) =>
        issue.state === "open" &&
        (issue.title.toLowerCase().includes(item.advisoryId.toLowerCase()) ||
          issue.body.toLowerCase().includes(item.advisoryId.toLowerCase()))
    );

    if (openIssue) {
      // Update existing open issue by adding a comment
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
              body: `⚠️ **Scheduled Security Audit Alert:** Vulnerability or override issue \`${item.advisoryId}\` (${item.pkgName || "N/A"}) remains active as of ${new Date().toISOString()}.`,
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
    } else {
      // Create new issue with security-triage label
      const title = `[Security Triage] ${item.severity.toUpperCase()} Advisory: ${item.advisoryId}${item.pkgName ? ` (${item.pkgName})` : ""}`;
      const bodyLines = [
        `# 🛡️ Security Vulnerability Triage Ticket`,
        "",
        `- **Advisory Identifier:** \`${item.advisoryId}\``,
        `- **Package Name:** \`${item.pkgName || "N/A"}\``,
        `- **Severity:** **${item.severity.toUpperCase()}**`,
        `- **Scan Time:** ${new Date().toISOString()}`,
        `- **Type:** \`${item.type}\``,
        "",
      ];

      if (item.type === "unhandled") {
        bodyLines.push("### Unhandled Advisory Details");
        bodyLines.push(`- **Title:** ${item.title || "N/A"}`);
        bodyLines.push(`- **Vulnerable Range:** \`${item.range || "N/A"}\``);
        if (item.url) {
          bodyLines.push(`- **Reference:** [${item.url}](${item.url})`);
        }
      } else if (item.type === "expired_rule") {
        bodyLines.push("### Expired Override Rule Details");
        bodyLines.push(`- **Previous Reason:** ${item.reason || "N/A"}`);
        bodyLines.push(
          "The temporary override rule for this advisory has expired and must be remediated or re-approved."
        );
      } else if (item.type === "invalid_rule") {
        bodyLines.push("### Invalid Override Rule Details");
        bodyLines.push(
          `- **Validation Error:** ${item.validationError || "N/A"}`
        );
      }

      bodyLines.push("");
      bodyLines.push("### 📋 Remediation Instructions");
      bodyLines.push(
        "1. Review the advisory details and assess production impact."
      );
      bodyLines.push(
        "2. Update the affected dependency to a patched version if available."
      );
      bodyLines.push(
        "3. If an upstream patch is unavailable, create a valid entry in `security-audit-ignore.json` with justification, owner, follow-up ticket, explicit `severity`, and an expiration date within the policy cap (14 days for Critical, 30 days for High)."
      );

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
              body: bodyLines.join("\n"),
              labels: ["security-triage"],
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

  return { created, updated };
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
