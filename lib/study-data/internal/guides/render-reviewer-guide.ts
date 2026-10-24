/**
 * Reviewer guides as HTML: one `article` of plain, semantic HTML for a page
 * to style, and a standalone document for the package, which wraps the same
 * article.
 */
import type { ReviewerGuide } from "./reviewer-guides";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function table(
  caption: string,
  headings: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const head = headings
    .map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`)
    .join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("\n");
  return `<table>\n<caption>${escapeHtml(caption)}</caption>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/**
 * Renders a reviewer guide as one HTML `article` element.
 *
 * @param guide - A guide from `buildReviewerGuides`.
 * @returns The article as a string, with a trailing newline.
 */
export function renderReviewerGuideHtml(guide: ReviewerGuide): string {
  const id = (section: string) => `${guide.kind}-${section}`;
  const { conformance } = guide;
  const expected = conformance.issues.filter((issue) => issue.expected);
  const parts: string[] = [
    `<article aria-labelledby="${id("title")}">`,
    `<h2 id="${id("title")}">${escapeHtml(guide.title)}</h2>`,
    `<p><strong>${escapeHtml(guide.notice)}</strong></p>`,
    `<p>Study ${escapeHtml(guide.studyId)}, seed ${guide.seed}, ${guide.nSubjects} subjects screened.</p>`,
    `<section aria-labelledby="${id("intro")}">`,
    `<h3 id="${id("intro")}">1. Introduction</h3>`,
    `<p>${escapeHtml(guide.scope)}</p>`,
    "</section>",
    `<section aria-labelledby="${id("standards")}">`,
    `<h3 id="${id("standards")}">2. Standards and versions</h3>`,
    table(
      "Standards applied",
      ["Standard", "Version"],
      guide.standards.map(({ standard, version }) => [standard, version])
    ),
    "</section>",
    `<section aria-labelledby="${id("flow")}">`,
    `<h3 id="${id("flow")}">3. Data flow</h3>`,
    `<p>${escapeHtml(guide.dataFlow.map((step) => step.label).join(" → "))}</p>`,
    "<ol>",
    ...guide.dataFlow.map(
      (step) =>
        `<li><strong>${escapeHtml(step.label)}.</strong> ${escapeHtml(step.summary)}</li>`
    ),
    "</ol>",
    "</section>",
    `<section aria-labelledby="${id("datasets")}">`,
    `<h3 id="${id("datasets")}">4. Datasets</h3>`,
    table(
      "Datasets in this folder",
      ["Dataset", "Label", "Class", "Structure", "Keys", "Records", "File"],
      guide.datasets.map((dataset) => [
        dataset.name,
        dataset.label,
        dataset.class,
        dataset.structure,
        dataset.keys.join(", "),
        String(dataset.records),
        dataset.file,
      ])
    ),
    "</section>",
    `<section aria-labelledby="${id("conformance")}">`,
    `<h3 id="${id("conformance")}">5. Conformance</h3>`,
    `<p>Gate status ${escapeHtml(conformance.status)}. ${conformance.rulesChecked} rule checks on these datasets (rule set ${escapeHtml(conformance.rulesVersion)}, controlled terminology ${escapeHtml(conformance.terminologyVersion)}). ${escapeHtml(conformance.scopeNotice)} <a href="${escapeHtml(conformance.coreUrl)}">CDISC CORE</a>.</p>`,
    conformance.issues.length === 0
      ? "<p>No rule raised a finding on these datasets.</p>"
      : `<p>${conformance.issues.length} rule ${conformance.issues.length === 1 ? "check raised" : "checks raised"} findings; ${expected.length} of them ${expected.length === 1 ? "is" : "are"} expected from the synthetic generator.</p>`,
    ...(conformance.issues.length === 0
      ? []
      : [
          "<dl>",
          ...conformance.issues.flatMap((issue) => [
            `<dt>${escapeHtml(issue.ruleId)} on ${escapeHtml(issue.dataset)}: ${issue.count} ${escapeHtml(issue.severity)}${issue.count === 1 ? "" : "s"}${issue.expected ? " (expected)" : " (not expected)"}</dt>`,
            `<dd><p>${escapeHtml(issue.message)}</p><p>${escapeHtml(issue.explanation)}</p><p>Rule source: ${escapeHtml(issue.citation)}</p></dd>`,
          ]),
          "</dl>",
        ]),
    "</section>",
    `<section aria-labelledby="${id("derivations")}">`,
    `<h3 id="${id("derivations")}">6. Derivations</h3>`,
    table(
      "Derivation methods",
      ["Method", "Derivation", "Variables"],
      guide.derivations.map((derivation) => [
        derivation.id,
        derivation.text,
        derivation.variables.join(", "),
      ])
    ),
    "</section>",
  ];
  if (guide.outputs) {
    parts.push(
      `<section aria-labelledby="${id("outputs")}">`,
      `<h3 id="${id("outputs")}">7. Analysis outputs</h3>`,
      "<p>Every table and figure, with the ARS analyses it displays.</p>",
      table(
        "ARS output index",
        [
          "Output",
          "Title",
          "Analysis",
          "Dataset",
          "Variable",
          "Population",
          "Method",
        ],
        guide.outputs.flatMap((output) =>
          output.analyses.length === 0
            ? [[output.name, output.title, "", "", "", "", ""]]
            : output.analyses.map((analysis) => [
                output.name,
                output.title,
                analysis.name,
                analysis.dataset,
                analysis.variable,
                analysis.population,
                analysis.method,
              ])
        )
      ),
      "</section>"
    );
  }
  parts.push("</article>");
  return `${parts.join("\n")}\n`;
}

/**
 * Writes a reviewer guide as a standalone HTML document, as the package
 * ships it.
 *
 * @param guide - A guide from `buildReviewerGuides`.
 * @returns The document, with a trailing newline.
 */
export function writeReviewerGuideDocument(guide: ReviewerGuide): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(guide.title)}</title>`,
    "</head>",
    "<body>",
    renderReviewerGuideHtml(guide).trimEnd(),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
