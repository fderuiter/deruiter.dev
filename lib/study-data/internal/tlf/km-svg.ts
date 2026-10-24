/**
 * The Kaplan-Meier figure as SVG and as an accessible HTML document.
 *
 * The SVG is an image with a text alternative: `role="img"`, a `<title>`
 * and a `<desc>` holding the figure's summary. Treatment groups are told
 * apart by line pattern as well as colour, and a legend names each one.
 * Colours are the first slots of a categorical palette checked for colour
 * vision deficiency separation, stepped separately for light and dark
 * surfaces. The HTML document adds the data-table fallback: every plotted
 * value, the number at risk and the log-rank test, each cell naming the ARS
 * results it shows.
 */
import type { TlfKmCurve, TlfKmFigure } from "../../types";
import { escapeHtml } from "./html";

/** Line colours, light then dark surface, in fixed slot order. */
const SERIES = [
  ["#2a78d6", "#3987e5"],
  ["#eb6834", "#d95926"],
  ["#1baf7a", "#199e70"],
  ["#eda100", "#c98500"],
  ["#e87ba4", "#d55181"],
  ["#008300", "#008300"],
  ["#6250d6", "#9085e9"],
  ["#e34948", "#e66767"],
] as const;

/** Line patterns, so a group is never told apart by colour alone. */
const DASHES = ["", "8 4", "2 4", "12 4 2 4", "4 4", "16 6", "2 2 8 2", "10 2"];

const WIDTH = 760;
const PLOT_LEFT = 150;
const PLOT_RIGHT = WIDTH - 32;
const PLOT_HEIGHT = 300;
const LINE = 20;

function coordinate(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function style(prefix: string, count: number): string {
  const series = (mode: 0 | 1) =>
    Array.from(
      { length: count },
      (_, index) => `--km-series-${index + 1}: ${SERIES[index][mode]};`
    ).join(" ");
  return [
    `svg.${prefix} { --km-surface: #fcfcfb; --km-text: #1f1f1d; --km-muted: #55554f; --km-grid: #e4e3dd; --km-axis: #8a8980; ${series(0)} }`,
    `@media (prefers-color-scheme: dark) { svg.${prefix} { --km-surface: #1a1a19; --km-text: #f0efec; --km-muted: #c3c2b7; --km-grid: #33332f; --km-axis: #6b6a63; ${series(1)} } }`,
    `svg.${prefix} text { font-family: system-ui, sans-serif; font-size: 12px; fill: var(--km-text); }`,
    `svg.${prefix} .muted { fill: var(--km-muted); }`,
    `svg.${prefix} .heading { font-weight: 700; font-size: 14px; }`,
    `svg.${prefix} .num { font-variant-numeric: tabular-nums; }`,
  ].join("\n");
}

interface Layout {
  readonly legendTop: number;
  readonly legendRows: readonly (readonly {
    readonly curve: TlfKmCurve;
    readonly index: number;
    readonly x: number;
  }[])[];
  readonly plotTop: number;
  readonly plotBottom: number;
  readonly xMax: number;
  readonly height: number;
}

function legendText(curve: TlfKmCurve): string {
  return `${curve.label} (N=${curve.bigN})`;
}

/**
 * Positions of the parts of the figure. A standalone SVG carries its own
 * titles, notice and test line; inside the HTML document the figure
 * caption and the paragraphs around it say those once.
 */
function layout(figure: TlfKmFigure, standalone: boolean): Layout {
  const rows: { curve: TlfKmCurve; index: number; x: number }[][] = [[]];
  let x = 16;
  figure.curves.forEach((curve, index) => {
    const width = 40 + legendText(curve).length * 7 + 24;
    if (x + width > WIDTH - 16 && rows[rows.length - 1].length > 0) {
      rows.push([]);
      x = 16;
    }
    rows[rows.length - 1].push({ curve, index, x });
    x += width;
  });
  const legendTop = standalone ? 112 : 24;
  const plotTop = legendTop + rows.length * LINE + 28;
  const plotBottom = plotTop + PLOT_HEIGHT;
  const lastTime = Math.max(
    0,
    ...figure.curves.flatMap((curve) =>
      curve.points.map((point) => point.time)
    ),
    ...figure.atRiskTimes.map((day) => day.time)
  );
  const xMax = Math.max(7, Math.ceil(lastTime / 7) * 7);
  const tableTop = plotBottom + 72;
  const height =
    tableTop + figure.curves.length * LINE + (standalone ? 3 : 1) * LINE;
  return { legendTop, legendRows: rows, plotTop, plotBottom, xMax, height };
}

function curvePath(
  curve: TlfKmCurve,
  x: (time: number) => number,
  y: (survival: number) => number
): string {
  const parts = [`M${coordinate(x(0))} ${coordinate(y(1))}`];
  for (const point of curve.points) {
    if (point.time === 0 || point.events === 0) continue;
    parts.push(
      `H${coordinate(x(point.time))}`,
      `V${coordinate(y(point.survival))}`
    );
  }
  const last = curve.points[curve.points.length - 1];
  parts.push(`H${coordinate(x(last.time))}`);
  return parts.join(" ");
}

function bandPath(
  curve: TlfKmCurve,
  x: (time: number) => number,
  y: (survival: number) => number
): string {
  const parts: string[] = [];
  curve.points.forEach((point, index) => {
    const next = curve.points[index + 1];
    if (point.lower === null || point.upper === null || !next) return;
    parts.push(
      `M${coordinate(x(point.time))} ${coordinate(y(point.upper))} H${coordinate(x(next.time))} V${coordinate(y(point.lower))} H${coordinate(x(point.time))} Z`
    );
  });
  return parts.join(" ");
}

function censorPath(
  curve: TlfKmCurve,
  x: (time: number) => number,
  y: (survival: number) => number
): string {
  return curve.points
    .filter((point) => point.censored > 0)
    .map((point) => {
      const cx = x(point.time);
      const cy = y(point.survival);
      return `M${coordinate(cx - 4)} ${coordinate(cy)} H${coordinate(cx + 4)} M${coordinate(cx)} ${coordinate(cy - 4)} V${coordinate(cy + 4)}`;
    })
    .join(" ");
}

function svgMarkup(figure: TlfKmFigure, standalone: boolean): string {
  if (figure.curves.length > SERIES.length) {
    throw new RangeError(
      `A figure distinguishes at most ${SERIES.length} groups, got ${figure.curves.length}.`
    );
  }
  const prefix = "km-figure";
  const titleId = `${figure.fileBase}-svg-title`;
  const descId = `${figure.fileBase}-svg-desc`;
  const { legendTop, legendRows, plotTop, plotBottom, xMax, height } = layout(
    figure,
    standalone
  );
  const x = (time: number) =>
    PLOT_LEFT + (time / xMax) * (PLOT_RIGHT - PLOT_LEFT);
  const y = (survival: number) => plotBottom - survival * PLOT_HEIGHT;
  const stroke = (index: number) =>
    `stroke="var(--km-series-${index + 1})"${DASHES[index] ? ` stroke-dasharray="${DASHES[index]}"` : ""}`;
  const lines: string[] = [
    `<svg${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ""} class="${prefix}" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" data-ars-output="${escapeHtml(figure.outputId)}" data-ars-display="${escapeHtml(figure.displayId)}">`,
    `<title id="${titleId}">${escapeHtml(`Figure ${figure.number}: ${figure.title} (${figure.population})`)}</title>`,
    `<desc id="${descId}">${escapeHtml(`${figure.summary} ${figure.notice}`)}</desc>`,
    `<style>\n${style(prefix, figure.curves.length)}\n</style>`,
    `<rect width="${WIDTH}" height="${height}" fill="var(--km-surface)"/>`,
    ...(standalone
      ? [
          `<text x="16" y="28" class="heading">${escapeHtml(`Figure ${figure.number}`)}</text>`,
          `<text x="16" y="48">${escapeHtml(figure.title)}</text>`,
          `<text x="16" y="66">${escapeHtml(figure.population)}</text>`,
          `<text x="16" y="86" class="muted">${escapeHtml(figure.notice)}</text>`,
        ]
      : []),
  ];
  legendRows.forEach((row, rowIndex) => {
    const rowY = legendTop + rowIndex * LINE;
    for (const item of row) {
      lines.push(
        `<path d="M${item.x} ${rowY - 4} h28" fill="none" stroke-width="2" ${stroke(item.index)}/>`,
        `<text x="${item.x + 36}" y="${rowY}">${escapeHtml(legendText(item.curve))}</text>`
      );
    }
  });
  lines.push(
    `<text x="${PLOT_LEFT}" y="${plotTop - 12}" class="muted">${escapeHtml(figure.yLabel)}</text>`
  );
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = tick / 5;
    const tickY = coordinate(y(value));
    lines.push(
      `<path d="M${PLOT_LEFT} ${tickY} H${PLOT_RIGHT}" stroke="var(--km-grid)" stroke-width="1"/>`,
      `<text x="${PLOT_LEFT - 8}" y="${coordinate(y(value) + 4)}" text-anchor="end" class="muted num">${value.toFixed(1)}</text>`
    );
  }
  lines.push(
    `<path d="M${PLOT_LEFT} ${plotTop} V${plotBottom} H${PLOT_RIGHT}" fill="none" stroke="var(--km-axis)" stroke-width="1"/>`
  );
  for (const day of figure.atRiskTimes) {
    const tickX = coordinate(x(day.time));
    lines.push(
      `<path d="M${tickX} ${plotBottom} v6" stroke="var(--km-axis)" stroke-width="1"/>`,
      `<text x="${tickX}" y="${plotBottom + 20}" text-anchor="middle" class="muted num">${day.time}</text>`
    );
  }
  lines.push(
    `<text x="${coordinate((PLOT_LEFT + PLOT_RIGHT) / 2)}" y="${plotBottom + 42}" text-anchor="middle" class="muted">${escapeHtml(figure.xLabel)}</text>`
  );
  figure.curves.forEach((curve, index) => {
    if (curve.points.length === 0) return;
    const band = bandPath(curve, x, y);
    const censored = censorPath(curve, x, y);
    lines.push(
      `<g data-curve="${escapeHtml(curve.id)}">`,
      ...(band
        ? [
            `<path d="${band}" fill="var(--km-series-${index + 1})" fill-opacity="0.1" stroke="none"/>`,
          ]
        : []),
      `<path d="${curvePath(curve, x, y)}" fill="none" stroke-width="2" stroke-linejoin="round" ${stroke(index)}/>`,
      ...(censored
        ? [
            `<path d="${censored}" fill="none" stroke-width="1.5" stroke="var(--km-series-${index + 1})"/>`,
          ]
        : []),
      "</g>"
    );
  });
  const tableTop = plotBottom + 72;
  lines.push(
    `<text x="16" y="${tableTop}" class="heading">Number at risk</text>`
  );
  figure.atRisk.forEach((row, rowIndex) => {
    const rowY = tableTop + (rowIndex + 1) * LINE;
    lines.push(`<text x="16" y="${rowY}">${escapeHtml(row.label)}</text>`);
    row.cells.forEach((cell, cellIndex) => {
      lines.push(
        `<text x="${coordinate(x(figure.atRiskTimes[cellIndex].time))}" y="${rowY}" text-anchor="middle" class="num">${escapeHtml(cell.text)}</text>`
      );
    });
  });
  if (standalone) {
    lines.push(
      `<text x="16" y="${tableTop + (figure.atRisk.length + 2) * LINE}" class="muted">${escapeHtml(figure.test.text)}</text>`
    );
  }
  lines.push("</svg>");
  return lines.join("\n");
}

/**
 * Writes the figure as a standalone SVG image with its text alternative.
 * The output depends only on the figure, so the same run always gives the
 * same bytes. Lines end with LF.
 *
 * @throws RangeError when the figure has more groups than line colours.
 */
export function writeKmFigureSvg(figure: TlfKmFigure): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svgMarkup(figure, true)}\n`;
}

const STYLE = [
  ":root { color-scheme: light dark; }",
  "body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; line-height: 1.4; }",
  "main { max-width: 72rem; margin: 0 auto; }",
  ".notice { font-weight: 600; }",
  ".scroll { overflow-x: auto; }",
  "figure { margin: 0; }",
  "figcaption { padding-bottom: 0.5rem; }",
  "figcaption span, caption span { display: block; }",
  "figcaption .number, caption .number { font-weight: 700; }",
  "svg { max-width: 100%; height: auto; }",
  "table { border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 1rem; border-bottom: 1px solid; }",
  "caption { text-align: left; padding-bottom: 0.5rem; }",
  "th, td { padding: 0.25rem 0.75rem; vertical-align: top; }",
  "thead th { border-top: 1px solid; border-bottom: 1px solid; text-align: center; }",
  "thead th:first-child { text-align: left; }",
  "tbody th { text-align: left; font-weight: 400; }",
  "tbody th.group { font-weight: 600; padding-top: 0.75rem; }",
  "td { text-align: center; white-space: nowrap; }",
  ".notes { font-size: 0.875rem; }",
].join("\n");

function td(text: string, resultIds: readonly string[]): string {
  return `<td data-ars-results="${escapeHtml(resultIds.join(" "))}">${escapeHtml(text)}</td>`;
}

/**
 * Writes the figure as a standalone, accessible HTML document: the SVG
 * inside a captioned `<figure>`, then the data-table fallback (every
 * plotted value by treatment group, and the number at risk), the log-rank
 * test, the footnotes and the synthetic-data notice.
 *
 * The output depends only on the figure, so the same run always gives the
 * same bytes. Lines end with LF.
 *
 * @throws RangeError when the figure has more groups than line colours.
 */
export function writeKmFigureHtml(figure: TlfKmFigure): string {
  const notesId = `${figure.fileBase}-notes`;
  const heading = `Figure ${figure.number}`;
  const lines: string[] = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(`${heading}: ${figure.title} (${figure.population})`)}</title>`,
    `<style>\n${STYLE}\n</style>`,
    "</head>",
    "<body>",
    "<main>",
    `<p class="notice" role="note">${escapeHtml(figure.notice)}</p>`,
    `<figure id="${escapeHtml(figure.fileBase)}" aria-describedby="${escapeHtml(notesId)}">`,
    `<figcaption><span class="number">${escapeHtml(heading)}</span><span>${escapeHtml(figure.title)}</span><span>${escapeHtml(figure.population)}</span></figcaption>`,
    '<div class="scroll">',
    svgMarkup(figure, false),
    "</div>",
    "</figure>",
    `<p data-ars-results="${escapeHtml(figure.test.resultIds.join(" "))}">${escapeHtml(figure.test.text)}</p>`,
    '<div class="scroll">',
    `<table id="${escapeHtml(figure.fileBase)}-estimates">`,
    `<caption><span class="number">${escapeHtml(`${heading}, data`)}</span><span>Kaplan-Meier estimates at every plotted time</span></caption>`,
    "<thead>",
    "<tr>",
    ...[
      "Treatment group and day",
      "At risk",
      "Events",
      "Censored",
      "Survival",
      "SE",
      "95% CI (log-log)",
    ].map((label) => `<th scope="col">${escapeHtml(label)}</th>`),
    "</tr>",
    "</thead>",
  ];
  for (const curve of figure.curves) {
    lines.push(
      "<tbody>",
      `<tr><th scope="rowgroup" colspan="7" class="group" data-ars-results="${escapeHtml(curve.bigNResultId)}">${escapeHtml(`${curve.label} (N=${curve.bigN})`)}</th></tr>`
    );
    if (curve.points.length === 0) {
      lines.push(
        '<tr><th scope="row">No subjects</th><td colspan="6">-</td></tr>'
      );
    }
    for (const point of curve.points) {
      const [risk, events, censored, survival, se, lower, upper] =
        point.resultIds;
      lines.push(
        `<tr><th scope="row">Day ${point.time}</th>${[
          td(String(point.atRisk), [risk]),
          td(String(point.events), [events]),
          td(String(point.censored), [censored]),
          td(point.survivalText, [survival]),
          td(point.standardErrorText, [se]),
          td(point.limitsText, [lower, upper]),
        ].join("")}</tr>`
      );
    }
    lines.push("</tbody>");
  }
  lines.push(
    "</table>",
    "</div>",
    '<div class="scroll">',
    `<table id="${escapeHtml(figure.fileBase)}-at-risk">`,
    `<caption><span class="number">${escapeHtml(`${heading}, number at risk`)}</span><span>Subjects at risk on each scheduled day</span></caption>`,
    "<thead>",
    "<tr>",
    '<th scope="col">Treatment group</th>',
    ...figure.atRiskTimes.map(
      (day) => `<th scope="col">${escapeHtml(day.label)}</th>`
    ),
    "</tr>",
    "</thead>",
    "<tbody>",
    ...figure.atRisk.map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.label)}</th>${row.cells
          .map((cell) => td(cell.text, cell.resultIds))
          .join("")}</tr>`
    ),
    "</tbody>",
    "</table>",
    "</div>",
    `<div id="${escapeHtml(notesId)}" class="notes">`,
    ...figure.footnotes.map((note) => `<p>${escapeHtml(note)}</p>`),
    `<p>${escapeHtml(figure.notice)}</p>`,
    "</div>",
    "</main>",
    "</body>",
    "</html>",
    ""
  );
  return lines.join("\n");
}
