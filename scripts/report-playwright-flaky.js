/* eslint-disable */
/**
 * Lists the Playwright tests that passed only on retry (#1770).
 *
 * Reads the JSON report `playwright merge-reports --reporter=json` writes from
 * the chromium shards, prints a `::warning::` annotation per flaky test, and
 * appends a table to the job summary. A flaky test does not fail the gate
 * (retries are part of the suite's contract); this makes the signal visible
 * instead of silent. It fails only when the report is missing or empty,
 * because that means the shards produced nothing to merge.
 *
 * Usage: node scripts/report-playwright-flaky.js <merged-report.json>
 */
const fs = require("fs");

/**
 * Encodes a workflow command message the way `@actions/core` does
 * (`escapeData`), so a line break in a test title cannot end the command
 * and start another one.
 */
function encodeCommandData(value) {
  return String(value)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

/**
 * Encodes a workflow command property (`escapeProperty` in `@actions/core`).
 * A comma or colon in a file path would otherwise start a new property or
 * end the property list.
 */
function encodeCommandProperty(value) {
  return encodeCommandData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Serializes text as one literal Markdown table cell. Line breaks become
 * spaces so a test stays on one row, and every ASCII punctuation character
 * CommonMark lets you escape is backslash-escaped, so the text cannot open
 * a link, emphasis, code span, raw HTML or a new column.
 */
function markdownTableCell(value) {
  return String(value)
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "\\$&");
}

/** Formats one flaky test as a `::warning` annotation line. */
function formatAnnotation(test) {
  return `::warning file=${encodeCommandProperty(test.file)},line=${encodeCommandProperty(test.line)}::${encodeCommandData(`Passed only on retry (${test.attempts} attempts): ${test.title}`)}`;
}

/** Formats one flaky test as a row of the job summary table. */
function formatSummaryRow(test) {
  return `| ${markdownTableCell(test.title)} | ${markdownTableCell(`${test.file}:${test.line}`)} | ${test.attempts} |`;
}

/** Walks nested suites and returns every flaky test with its location. */
function collectFlakyTests(report) {
  const flaky = [];
  const visit = (suite, titles) => {
    const path = suite.title ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (test.status === "flaky") {
          flaky.push({
            title: [...path, spec.title].filter(Boolean).join(" › "),
            file: spec.file || suite.file || "",
            line: spec.line || 0,
            project: test.projectName || "",
            attempts: (test.results || []).length,
          });
        }
      }
    }
    for (const child of suite.suites || []) visit(child, path);
  };
  for (const suite of report.suites || []) visit(suite, []);
  return flaky;
}

function main(argv) {
  const reportPath = argv[0];
  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error(`::error::Merged Playwright report not found: ${reportPath}`);
    return 1;
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const stats = report.stats || {};
  const total =
    (stats.expected || 0) +
    (stats.unexpected || 0) +
    (stats.flaky || 0) +
    (stats.skipped || 0);
  if (total === 0) {
    console.error("::error::Merged Playwright report contains no tests.");
    return 1;
  }

  const flaky = collectFlakyTests(report);
  console.log(
    `Merged report: ${stats.expected || 0} passed, ${stats.unexpected || 0} failed, ${flaky.length} passed only on retry, ${stats.skipped || 0} skipped.`
  );
  for (const test of flaky) {
    console.log(formatAnnotation(test));
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    let markdown = `### Playwright tests that passed only on retry\n\n`;
    if (flaky.length === 0) {
      markdown += `None. Every test passed on its first attempt.\n`;
    } else {
      markdown += `| Test | File | Attempts |\n| --- | --- | --- |\n`;
      for (const test of flaky) {
        markdown += `${formatSummaryRow(test)}\n`;
      }
    }
    fs.appendFileSync(summaryPath, `${markdown}\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  collectFlakyTests,
  encodeCommandData,
  encodeCommandProperty,
  formatAnnotation,
  formatSummaryRow,
  main,
  markdownTableCell,
};
