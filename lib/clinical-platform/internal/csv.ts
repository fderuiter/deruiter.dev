/**
 * CSV fields for the files the platform hands a visitor (an exploration's
 * result, a workbench query's rows), written to open safely in a
 * spreadsheet.
 */

/**
 * One CSV text field, quoted when it holds a comma, quote or line break.
 * Text a spreadsheet would read as a formula (starting with `=`, `+`, `-`,
 * `@`, a tab or a carriage return) is prefixed with an apostrophe, so
 * opening the file never runs anything.
 *
 * @param value - The text.
 * @returns The field as written.
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
