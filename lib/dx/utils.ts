/**
 * Terminal UI & Formatting Utilities for DX Tooling
 * Zero-dependency ANSI formatting and table rendering
 */

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright Foreground
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

export function badge(
  text: string,
  type: "pass" | "fail" | "warn" | "info" | "fixed"
): string {
  switch (type) {
    case "pass":
      return `${colors.brightGreen}${colors.bold}✔ PASS${colors.reset} ${colors.green}${text}${colors.reset}`;
    case "fail":
      return `${colors.brightRed}${colors.bold}✖ FAIL${colors.reset} ${colors.red}${text}${colors.reset}`;
    case "warn":
      return `${colors.brightYellow}${colors.bold}▲ WARN${colors.reset} ${colors.yellow}${text}${colors.reset}`;
    case "info":
      return `${colors.brightCyan}${colors.bold}ℹ INFO${colors.reset} ${colors.cyan}${text}${colors.reset}`;
    case "fixed":
      return `${colors.brightMagenta}${colors.bold}★ AUTO-FIXED${colors.reset} ${colors.magenta}${text}${colors.reset}`;
  }
}

export function formatHeader(title: string, subtitle?: string): string {
  const line = "═".repeat(Math.max(60, title.length + 8));
  let out = `\n${colors.cyan}${line}${colors.reset}\n`;
  out += `  ${colors.bold}${colors.brightCyan}${title}${colors.reset}\n`;
  if (subtitle) {
    out += `  ${colors.gray}${subtitle}${colors.reset}\n`;
  }
  out += `${colors.cyan}${line}${colors.reset}\n`;
  return out;
}

export function formatSection(name: string): string {
  return `\n${colors.bold}${colors.brightWhite}▶ ${name}${colors.reset}\n`;
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right";
}

export function renderTable(
  columns: TableColumn[],
  rows: Record<string, string | number>[]
): string {
  // Determine column widths
  const widths = columns.map((col) => {
    const headerLen = col.header.length;
    const maxContentLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return Math.max(col.width || 0, headerLen, maxContentLen) + 2;
  });

  let out = "";

  // Header row
  const headerRow = columns
    .map((col, idx) => {
      const text = col.header;
      return col.align === "right"
        ? text.padStart(widths[idx])
        : text.padEnd(widths[idx]);
    })
    .join(`${colors.gray}│${colors.reset}`);

  out += `${colors.bold}${colors.cyan}${headerRow}${colors.reset}\n`;

  // Separator
  const sep = widths.map((w) => "─".repeat(w)).join("┼");
  out += `${colors.gray}${sep}${colors.reset}\n`;

  // Rows
  for (const row of rows) {
    const rowStr = columns
      .map((col, idx) => {
        const val = String(row[col.key] ?? "");
        return col.align === "right"
          ? val.padStart(widths[idx])
          : val.padEnd(widths[idx]);
      })
      .join(`${colors.gray}│${colors.reset}`);
    out += `${rowStr}\n`;
  }

  return out;
}
