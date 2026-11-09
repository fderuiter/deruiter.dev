/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";
import { settleFooterTicker } from "./footer-ticker";

/**
 * The zero-tolerance axe scan shared by the accessibility specs (AGENTS.md
 * section 10): WCAG 2.1 A and AA plus best practice, failing on any
 * critical, serious or moderate violation. Results are written under
 * playwright-report/accessibility-results for the CI report.
 */

/**
 * Helper to save scan results to JSON files for CI reporting and trend tracking.
 */
export function saveResult(
  projectName: string,
  stateName: string,
  violations: any[],
  checkedUrl: string
) {
  const dir = path.join(
    __dirname,
    "../../../playwright-report/accessibility-results"
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const safeStateName = stateName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${projectName}-${safeStateName}.json`;
  const filePath = path.join(dir, filename);

  const resultData = {
    project: projectName,
    state: stateName,
    url: checkedUrl,
    violationsCount: violations.length,
    violations: violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n: any) => ({
        target: n.target,
        html: n.html,
      })),
    })),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(resultData, null, 2));
}

/**
 * Helper to format failure messages clearly in terminal logs with CSS selectors and HTML snippets.
 */
function formatViolationsForLog(
  projectName: string,
  stateName: string,
  violations: any[]
): string {
  if (violations.length === 0) return "";
  let log = `\n==================================================\n`;
  log += `🚨 ACCESSIBILITY VIOLATIONS DETECTED (${projectName} - ${stateName})\n`;
  log += `Found ${violations.length} critical, serious, or moderate violations.\n`;
  log += `==================================================\n\n`;

  violations.forEach((violation, idx) => {
    log += `Violation #${idx + 1}:\n`;
    log += `  Rule ID:     ${violation.id}\n`;
    log += `  Severity:    ${violation.impact}\n`;
    log += `  Description: ${violation.description}\n`;
    log += `  Help:        ${violation.help}\n`;
    log += `  Help URL:    ${violation.helpUrl}\n`;
    log += `  Affected Elements:\n`;
    violation.nodes.forEach((node: any, nIdx: number) => {
      log += `    Element ${nIdx + 1}:\n`;
      log += `      CSS Selector: ${node.target.join(" > ")}\n`;
      log += `      HTML snippet: ${node.html}\n`;
    });
    log += `--------------------------------------------------\n\n`;
  });
  return log;
}

/**
 * Common helper to execute AxeBuilder audit with strict WCAG 2.1 AA rules and zero tolerance.
 */
export async function auditAndAssert(
  page: Page,
  testInfo: TestInfo,
  stateName: string,
  options: { disableRules?: string[]; exclude?: string[] } = {}
) {
  if (options.disableRules && options.disableRules.length > 0) {
    throw new Error(
      `Prohibited disableRules override detected in test [${stateName}]: ${options.disableRules.join(
        ", "
      )}. Shift-left zero-tolerance policy forbids disabling WCAG rules.`
    );
  }

  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "best-practice",
  ]);

  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  await settleFooterTicker(page);
  const results = await builder.analyze();
  // Filter for critical, serious, and moderate violations (zero tolerance policy)
  const targetViolations = results.violations.filter(
    (v) =>
      v.impact === "critical" ||
      v.impact === "serious" ||
      v.impact === "moderate"
  );

  saveResult(testInfo.project.name, stateName, targetViolations, page.url());

  if (targetViolations.length > 0) {
    const errorLog = formatViolationsForLog(
      testInfo.project.name,
      stateName,
      targetViolations
    );
    console.error(errorLog);
  }

  expect(
    targetViolations.length,
    `Found ${targetViolations.length} critical/serious/moderate accessibility violations in [${stateName}]`
  ).toBe(0);
}
