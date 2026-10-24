/**
 * RFC 4180 CSV writer: one header row of variable names, CRLF line endings,
 * fields quoted only when they hold a comma, a double quote, CR or LF.
 *
 * RFC 4180 has no comment syntax, so a leading notice line would be read as
 * a data row by every conforming parser. The synthetic-data notice for CSV
 * files is therefore carried by the package's `README.txt` and
 * `MANIFEST.json`, not inside the file.
 */
import type { CellValue, Dataset } from "../../types";
import { exportColumns } from "./columns";

const NEEDS_QUOTES = /[",\r\n]/;

/** One RFC 4180 field. `null` is an empty field. */
function field(value: CellValue): string {
  if (value === null) return "";
  const text = typeof value === "number" ? String(value) : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Serialises one dataset as RFC 4180 CSV.
 *
 * Numbers use ECMAScript's shortest round-trip form (no locale, no
 * thousands separators); dates stay ISO 8601 text; missing values are empty
 * fields. A dataset with no rows is its header row alone.
 *
 * @throws TypeError or RangeError when a value does not match its column.
 */
export function writeCsv(dataset: Dataset): string {
  const columns = exportColumns(dataset);
  const lines = [
    columns.map((column) => field(column.variable.name)).join(","),
  ];
  for (let row = 0; row < dataset.rowCount; row += 1) {
    lines.push(columns.map((column) => field(column.values[row])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
