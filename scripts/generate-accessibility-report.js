/* eslint-disable */
/**
 * Turns the Playwright-axe result files into the accessibility job summary
 * (Markdown) and a one-line pass/fail status file.
 *
 * Axe evidence (HTML snippets, selectors, rule text) and the audited state
 * names are data, not Markdown. Every value goes through a serializer for the
 * context it lands in, so a backtick, pipe, bracket or line break in a
 * snippet cannot end a code span, add a table row or open a link
 * (CodeQL alert 11).
 *
 * Usage: node scripts/generate-accessibility-report.js
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_RESULTS_DIR = path.join(__dirname, '../playwright-report/accessibility-results');
const DEFAULT_SUMMARY_PATH = path.join(__dirname, '../playwright-report/accessibility-summary.md');
const DEFAULT_STATUS_PATH = path.join(__dirname, '../playwright-report/accessibility-status.txt');

/** Collapses every line break to one space so a value stays on its line. */
function oneLine(value) {
  return String(value ?? '').replace(/\r\n|\r|\n/g, ' ');
}

/**
 * Serializes text as literal inline Markdown: line breaks become spaces and
 * every ASCII punctuation mark CommonMark can escape is backslash-escaped.
 * Also safe inside a table cell, because pipes are escaped too.
 */
function markdownText(value) {
  return oneLine(value).replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');
}

/**
 * Serializes text as one CommonMark code span. Backslashes do not escape
 * anything inside a code span, so the delimiter is a backtick run longer
 * than the longest run in the text, padded with a space when the text
 * starts or ends with a backtick or a space.
 */
function markdownCodeSpan(value) {
  const text = oneLine(value);
  const longestRun = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  const pad = /^[` ]|[` ]$/.test(text) ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Returns a Markdown link to an http(s) rule reference, or the plain label
 * when the URL is missing or uses another scheme. The destination is the
 * URL parser's own serialization inside angle brackets, so parentheses and
 * spaces cannot end it early.
 */
function markdownLink(label, url) {
  let href;
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return markdownText(label);
    href = parsed.href;
  } catch {
    return markdownText(label);
  }
  if (/[<>\s]/.test(href)) return markdownText(label);
  return `[${markdownText(label)}](<${href}>)`;
}

/** Reads every result file in `resultsDir` into rows and violations. */
function collectResults(resultsDir) {
  let files = [];
  try {
    if (fs.existsSync(resultsDir)) {
      files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort();
    }
  } catch (e) {
    console.error('Error reading accessibility results:', e);
  }

  let totalChecked = 0;
  let totalViolations = 0;
  const results = [];
  const violations = [];

  files.forEach((file) => {
    try {
      const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
      const data = JSON.parse(content);
      totalChecked++;
      const vCount = data.violationsCount || 0;
      totalViolations += vCount;

      results.push({
        project: data.project,
        state: data.state,
        url: data.url,
        violationsCount: vCount,
        status: vCount === 0 ? '✅ Pass' : '❌ Fail',
      });

      if (vCount > 0) {
        (data.violations || []).forEach((v) => {
          violations.push({ project: data.project, state: data.state, ...v });
        });
      }
    } catch (e) {
      console.error(`Error processing result file ${file}:`, e);
    }
  });

  return { totalChecked, totalViolations, results, violations };
}

/** Builds the summary Markdown from collected results. */
function buildReport({ totalChecked, totalViolations, results, violations }) {
  let markdown = `### ♿ Automated Accessibility Scan Report (Playwright-Axe)\n\n`;

  if (totalChecked === 0) {
    markdown += `⚠️ **No accessibility results found.** Please ensure the accessibility test suite was executed.\n`;
    return markdown;
  }

  markdown += `**Summary**: Scanned **${totalChecked}** interactive UI states/scenarios across configured browsers.\n\n`;
  markdown += `| Project / Browser | Audited State | Status | Violations (Critical/Serious) |\n`;
  markdown += `| --- | --- | --- | --- |\n`;
  results.forEach((r) => {
    markdown += `| **${markdownText(r.project)}** | ${markdownText(r.state)} | ${r.status} | ${Number(r.violationsCount) || 0} |\n`;
  });
  markdown += `\n`;

  if (totalViolations === 0) {
    markdown += `🎉 **Zero critical or serious WCAG accessibility violations detected!**\n`;
    return markdown;
  }

  markdown += `### 🚨 Detected Violations Details\n\n`;
  violations.forEach((v, idx) => {
    const impact = String(v.impact || 'unknown').toUpperCase();
    markdown += `#### ${idx + 1}\\. \\[${markdownText(impact)}\\] ${markdownText(v.id)} (${markdownText(v.project)} - ${markdownText(v.state)})\n`;
    markdown += `- **Description**: ${markdownText(v.description)}\n`;
    markdown += `- **Help**: ${markdownText(v.help)} (${markdownLink('Rule Reference', v.helpUrl)})\n`;
    markdown += `- **Affected Elements**:\n`;
    (v.nodes || []).forEach((node, nIdx) => {
      const target = Array.isArray(node.target) ? node.target.join(' > ') : String(node.target ?? '');
      const html = node.html ? String(node.html).trim() : '';
      markdown += `  - **Element ${nIdx + 1}**:\n`;
      markdown += `    - CSS Selector: ${markdownCodeSpan(target)}\n`;
      markdown += `    - HTML Snippet: ${markdownCodeSpan(html)}\n`;
    });
    markdown += `\n---\n\n`;
  });
  return markdown;
}

/** Writes the summary and status files; returns the overall status. */
function main({
  resultsDir = DEFAULT_RESULTS_DIR,
  summaryPath = DEFAULT_SUMMARY_PATH,
  statusPath = DEFAULT_STATUS_PATH,
} = {}) {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  const collected = collectResults(resultsDir);
  const overallStatus =
    collected.totalChecked > 0 && collected.totalViolations === 0 ? '✅ Pass' : '❌ Fail';
  fs.writeFileSync(statusPath, overallStatus);
  fs.writeFileSync(summaryPath, buildReport(collected));
  console.log(`Successfully generated accessibility summary report at ${summaryPath}`);
  console.log(`Accessibility status: ${overallStatus}`);
  return overallStatus;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
  collectResults,
  main,
  markdownCodeSpan,
  markdownLink,
  markdownText,
};
