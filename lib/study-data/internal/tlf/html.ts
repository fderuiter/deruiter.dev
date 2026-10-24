/**
 * Accessible HTML for one table: a standalone UTF-8 document with a
 * captioned table, column and row headers with `scope`, the population N in
 * each column header, the synthetic-data notice and the footnotes. Each
 * data cell names the ARS results it shows in `data-ars-results`.
 */
import type { TlfCell, TlfTable } from "../../types";

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML content and double-quoted attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const STYLE = [
  ":root { color-scheme: light dark; }",
  "body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; line-height: 1.4; }",
  "main { max-width: 72rem; margin: 0 auto; }",
  ".notice { font-weight: 600; }",
  ".scroll { overflow-x: auto; }",
  "table { border-collapse: collapse; font-variant-numeric: tabular-nums; }",
  "caption { text-align: left; padding-bottom: 0.5rem; }",
  "caption span { display: block; }",
  "caption .number { font-weight: 700; }",
  "th, td { padding: 0.25rem 0.75rem; vertical-align: top; }",
  "thead th { border-top: 1px solid; border-bottom: 1px solid; text-align: center; }",
  "thead th:first-child { text-align: left; }",
  "tbody th { text-align: left; font-weight: 400; }",
  "tbody th.group { font-weight: 600; padding-top: 0.75rem; }",
  "tbody th.item { padding-left: 1.75rem; }",
  "td { text-align: center; white-space: nowrap; }",
  "td.group { padding-top: 0.75rem; }",
  "table { border-bottom: 1px solid; }",
  ".notes { font-size: 0.875rem; }",
].join("\n");

function cell(value: TlfCell, padTop: boolean): string {
  const attributes = [
    value.resultIds.length > 0
      ? ` data-ars-results="${escapeHtml(value.resultIds.join(" "))}"`
      : "",
    padTop ? ' class="group"' : "",
  ].join("");
  return `<td${attributes}>${escapeHtml(value.text)}</td>`;
}

/**
 * Writes one table as a standalone, accessible HTML document.
 *
 * The output depends only on the table, so the same run always gives the
 * same bytes. Lines end with LF.
 *
 * @param table - A table from `buildTlfOutputs`.
 * @returns The document as text.
 */
export function writeTableHtml(table: TlfTable): string {
  const notesId = `${table.fileBase}-notes`;
  const width = table.columns.length + 1;
  const heading = `Table ${table.number}`;
  const lines: string[] = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(`${heading}: ${table.title} (${table.population})`)}</title>`,
    `<style>\n${STYLE}\n</style>`,
    "</head>",
    "<body>",
    "<main>",
    `<p class="notice" role="note">${escapeHtml(table.notice)}</p>`,
    '<div class="scroll">',
    `<table id="${escapeHtml(table.fileBase)}" aria-describedby="${escapeHtml(notesId)}" data-ars-output="${escapeHtml(table.outputId)}" data-ars-display="${escapeHtml(table.displayId)}">`,
    `<caption><span class="number">${escapeHtml(heading)}</span><span>${escapeHtml(table.title)}</span><span>${escapeHtml(table.population)}</span></caption>`,
    "<thead>",
    "<tr>",
    `<th scope="col">${escapeHtml(table.stubHeader)}</th>`,
    ...table.columns.map(
      (column) =>
        `<th scope="col" data-ars-results="${escapeHtml(column.bigNResultId)}">${escapeHtml(column.label)} <span>(N=${column.bigN})</span></th>`
    ),
    "</tr>",
    "</thead>",
  ];
  for (const section of table.sections) {
    lines.push("<tbody>");
    if (section.cells) {
      const scope = section.rows.length > 0 ? "rowgroup" : "row";
      lines.push(
        `<tr><th scope="${scope}" class="group">${escapeHtml(section.label)}</th>${section.cells
          .map((value) => cell(value, true))
          .join("")}</tr>`
      );
    } else {
      lines.push(
        `<tr><th scope="rowgroup" colspan="${width}" class="group">${escapeHtml(section.label)}</th></tr>`
      );
    }
    for (const row of section.rows) {
      lines.push(
        `<tr><th scope="row" class="item">${escapeHtml(row.label)}</th>${row.cells
          .map((value) => cell(value, false))
          .join("")}</tr>`
      );
    }
    lines.push("</tbody>");
  }
  lines.push(
    "</table>",
    "</div>",
    `<div id="${escapeHtml(notesId)}" class="notes">`,
    ...table.footnotes.map((note) => `<p>${escapeHtml(note)}</p>`),
    `<p>${escapeHtml(table.notice)}</p>`,
    "</div>",
    "</main>",
    "</body>",
    "</html>",
    ""
  );
  return lines.join("\n");
}
