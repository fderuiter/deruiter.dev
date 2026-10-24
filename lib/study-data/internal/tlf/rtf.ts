/**
 * A simple RTF 1.x rendering of one table: landscape US Letter, Courier New,
 * titles, a table whose first row repeats on every page, and footnotes.
 *
 * The document's creation time in the info group is fixed at
 * 1980-01-01 00:00, the timestamp the export package writes wherever a
 * format asks for one, so the bytes depend only on the table.
 */
import type { TlfCell, TlfTable } from "../../types";

/** Page width minus margins, in twips: 11 in less two 0.75 in margins. */
const TEXT_WIDTH = 13_680;
const STUB_WIDTH = 5_040;
const MARGIN = 1_080;
const RULE = "\\brdrs\\brdrw10";

/**
 * Escapes text for an RTF 1.x body: backslash and braces are escaped,
 * characters outside printable ASCII become `\uN?` with N as a signed
 * 16-bit value, and characters beyond the Basic Multilingual Plane become a
 * surrogate pair.
 */
export function escapeRtf(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const code = value.charCodeAt(index);
    if (char === "\\" || char === "{" || char === "}") out += `\\${char}`;
    else if (char === "\n") out += "\\line ";
    else if (char === "\t") out += "\\tab ";
    else if (code >= 0x20 && code < 0x7f) out += char;
    else out += `\\u${code > 0x7fff ? code - 0x10000 : code}?`;
  }
  return out;
}

function row(
  cells: readonly string[],
  options: {
    readonly header?: boolean;
    readonly bold?: boolean;
    readonly indent?: boolean;
    readonly ruleBelow?: boolean;
  }
): string {
  const armWidth = Math.floor((TEXT_WIDTH - STUB_WIDTH) / (cells.length - 1));
  const borders = [
    options.header ? `\\clbrdrt${RULE}` : "",
    options.header || options.ruleBelow ? `\\clbrdrb${RULE}` : "",
  ].join("");
  const definition = cells
    .map(
      (_, position) => `${borders}\\cellx${STUB_WIDTH + armWidth * position}`
    )
    .join("");
  const body = cells
    .map((content, position) => {
      const align = position === 0 ? "\\ql" : "\\qc";
      const indent = position === 0 && options.indent ? "\\li360" : "";
      const text = options.bold ? `\\b ${content}\\b0` : content;
      return `\\pard\\intbl${align}${indent} ${text}\\cell`;
    })
    .join("");
  return `\\trowd\\trgaph72\\trleft0${options.header ? "\\trhdr" : ""}${definition}${body}\\row`;
}

function texts(cells: readonly TlfCell[]): string[] {
  return cells.map((value) => escapeRtf(value.text));
}

/**
 * Writes one table as RTF 1.x.
 *
 * The output depends only on the table, so the same run always gives the
 * same bytes. Lines end with LF, which RTF readers ignore.
 *
 * @param table - A table from `buildTlfOutputs`.
 * @returns The document as text, plain ASCII.
 */
export function writeTableRtf(table: TlfTable): string {
  const heading = `Table ${table.number}`;
  const lines: string[] = [
    "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1",
    "{\\fonttbl{\\f0\\fmodern\\fcharset0 Courier New;}}",
    `{\\info{\\title ${escapeRtf(`${heading}: ${table.title}`)}}{\\creatim\\yr1980\\mo1\\dy1\\hr0\\min0}}`,
    `\\paperw15840\\paperh12240\\landscape\\margl${MARGIN}\\margr${MARGIN}\\margt${MARGIN}\\margb${MARGIN}`,
    "\\f0\\fs18",
    `\\pard\\qc\\b ${escapeRtf(heading)}\\b0\\par`,
    `\\pard\\qc ${escapeRtf(table.title)}\\par`,
    `\\pard\\qc ${escapeRtf(table.population)}\\par`,
    `\\pard\\qc ${escapeRtf(table.notice)}\\par`,
    "\\pard\\par",
    row(
      [
        escapeRtf(table.stubHeader),
        ...table.columns.map((column) =>
          escapeRtf(`${column.label} (N=${column.bigN})`)
        ),
      ],
      { header: true, bold: true }
    ),
  ];
  const blank = table.columns.map(() => "");
  table.sections.forEach((section, sectionIndex) => {
    const lastSection = sectionIndex === table.sections.length - 1;
    lines.push(
      row(
        [
          escapeRtf(section.label),
          ...(section.cells ? texts(section.cells) : blank),
        ],
        { ruleBelow: lastSection && section.rows.length === 0 }
      )
    );
    section.rows.forEach((item, rowIndex) => {
      lines.push(
        row([escapeRtf(item.label), ...texts(item.cells)], {
          indent: true,
          ruleBelow: lastSection && rowIndex === section.rows.length - 1,
        })
      );
    });
  });
  lines.push(
    "\\pard\\par",
    ...table.footnotes.map((note) => `\\pard\\ql ${escapeRtf(note)}\\par`),
    `\\pard\\ql ${escapeRtf(table.notice)}\\par`,
    "}",
    ""
  );
  return lines.join("\n");
}
