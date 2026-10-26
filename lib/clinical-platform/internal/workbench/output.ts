/**
 * What the SQL workbench hands on (#2633): a query's rows as CSV.
 */
import type { WorkbenchResult } from "../../types";
import { csvText } from "../csv";

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
