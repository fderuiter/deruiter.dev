/**
 * What the SQL workbench hands on (#2633): a query's rows as CSV, JSON or
 * Apache Parquet.
 */
import type { WorkbenchResult, WorkbenchResultColumn } from "../../types";
import { csvText } from "../csv";
import { writeWorkbenchParquet } from "./parquet";

/**
 * A query's result as CSV: a header of column names, then one line per row
 * the workbench kept. Numeric values are written as the engine returned
 * them, text is quoted where it needs to be and made safe to open in a
 * spreadsheet, and SQL NULL is an empty field. Lines end with CRLF, as
 * RFC 4180 asks.
 *
 * @param result - A result the workbench's engine returned.
 * @returns The CSV text.
 */
export function workbenchResultCsv(result: WorkbenchResult): string {
  const header = result.columns.map((column) => csvText(column.name));
  const rows = result.rows.map((row) =>
    row.map((value, at) => {
      if (value === null) return "";
      return result.columns[at]?.numeric ? value : csvText(value);
    })
  );
  return `${[header, ...rows].map((fields) => fields.join(",")).join("\r\n")}\r\n`;
}

function uniqueKeys(columns: readonly WorkbenchResultColumn[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column, index) => {
    const base = column.name.trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function jsonCellValue(
  column: WorkbenchResultColumn | undefined,
  value: string | null
): string | number | boolean | null {
  if (value === null) return null;
  if (column?.type === "Boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (column?.numeric) {
    if (/^-?\d+$/.test(value)) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) return parsed;
      return value;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed) && !column.type.startsWith("Decimal")) {
      return parsed;
    }
  }
  return value;
}

/**
 * A query's result as formatted JSON: one object per kept row, with SQL NULL
 * written as `null`, booleans as `true` or `false`, safe numbers unquoted, and
 * large integers or fixed-scale decimals kept as strings so no digit is lost.
 *
 * @param result - A result the workbench's engine returned.
 * @returns Pretty-printed JSON text ending with a newline.
 */
export function workbenchResultJson(result: WorkbenchResult): string {
  const keys = uniqueKeys(result.columns);
  const records = result.rows.map((row) => {
    const entry: Record<string, string | number | boolean | null> = {};
    keys.forEach((key, at) => {
      entry[key] = jsonCellValue(result.columns[at], row[at] ?? null);
    });
    return entry;
  });
  return `${JSON.stringify(records, null, 2)}\n`;
}

/**
 * A query's result as an Apache Parquet (`PAR1`) binary buffer, written in
 * pure TypeScript so result tables export without enabling external file
 * writes in DuckDB.
 *
 * @param result - A result the workbench's engine returned.
 * @returns The `.parquet` file bytes.
 */
export function workbenchResultParquet(result: WorkbenchResult): Uint8Array {
  return writeWorkbenchParquet(result);
}
