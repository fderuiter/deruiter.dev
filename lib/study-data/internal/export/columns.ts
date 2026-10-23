/**
 * One view of a dataset's columns that every serialiser reads: how each
 * variable is stored, its values checked against its declared type, and the
 * byte length of text columns. Dataset-JSON, CSV and XPT therefore agree on
 * types, lengths and missing values by construction.
 */
import type { CellValue, Dataset, VariableMeta } from "../../types";

/**
 * How a column's values are physically stored.
 *
 * - `text`: character data. SDTM `--DTC` dates stay ISO 8601 text.
 * - `number`: an IEEE double, `integer` and `float` variables.
 * - `sas-date`, `sas-datetime`, `sas-time`: ADaM timing variables, ISO 8601
 *   text in the pipeline, written to XPT as SAS numeric dates (days since
 *   1960-01-01), datetimes (seconds since 1960-01-01T00:00:00) or times
 *   (seconds since midnight), as ADaM analysis timing variables are.
 */
export type StorageKind =
  "text" | "number" | "sas-date" | "sas-datetime" | "sas-time";

/** One checked column of a dataset. */
export interface ExportColumn {
  readonly variable: VariableMeta;
  readonly storage: StorageKind;
  readonly values: readonly CellValue[];
  /** Longest UTF-8 byte length of the values, at least 1. Text storage only. */
  readonly textLength?: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const ISO_TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const SECONDS_PER_DAY = 86400;

let encoder: TextEncoder | undefined;

/** UTF-8 bytes of a string. */
export function utf8(text: string): Uint8Array {
  encoder ??= new TextEncoder();
  return encoder.encode(text);
}

/** UTF-8 byte length of a string, without encoding it. */
export function utf8Length(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        length += 4;
        i += 1;
      } else length += 3;
    } else length += 3;
  }
  return length;
}

/**
 * Cuts UTF-8 bytes to at most `maxBytes` without splitting a character.
 *
 * @returns The kept bytes and whether anything was cut.
 */
export function truncateUtf8(
  bytes: Uint8Array,
  maxBytes: number
): { readonly bytes: Uint8Array; readonly truncated: boolean } {
  if (bytes.length <= maxBytes) return { bytes, truncated: false };
  let end = maxBytes;
  // A UTF-8 continuation byte is 0b10xxxxxx; never cut in front of one.
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return { bytes: bytes.subarray(0, end), truncated: true };
}

/** Days from 1970-01-01 to a proleptic Gregorian date (Hinnant's algorithm). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Days from 1970-01-01 to the SAS epoch, 1960-01-01. */
const SAS_EPOCH_DAYS = daysFromCivil(1960, 1, 1);

function daysInMonth(year: number, month: number): number {
  return (
    daysFromCivil(month === 12 ? year + 1 : year, (month % 12) + 1, 1) -
    daysFromCivil(year, month, 1)
  );
}

function sasDays(
  year: string,
  month: string,
  day: string,
  raw: string
): number {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new RangeError(`"${raw}" is not a calendar date.`);
  }
  return daysFromCivil(y, m, d) - SAS_EPOCH_DAYS;
}

function sasSeconds(
  hour: string,
  minute: string,
  second: string | undefined,
  raw: string
): number {
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second ?? "0");
  if (h > 23 || mi > 59 || s > 59) {
    throw new RangeError(`"${raw}" is not a clock time.`);
  }
  return h * 3600 + mi * 60 + s;
}

/**
 * Converts a complete ISO 8601 value to its SAS numeric form.
 *
 * @throws RangeError when the value is partial or not a real date or time.
 */
export function toSasNumber(
  storage: "sas-date" | "sas-datetime" | "sas-time",
  value: string
): number {
  if (storage === "sas-date") {
    const match = ISO_DATE.exec(value);
    if (match) return sasDays(match[1], match[2], match[3], value);
  } else if (storage === "sas-datetime") {
    const match = ISO_DATETIME.exec(value);
    if (match) {
      return (
        sasDays(match[1], match[2], match[3], value) * SECONDS_PER_DAY +
        sasSeconds(match[4], match[5], match[6], value)
      );
    }
  } else {
    const match = ISO_TIME.exec(value);
    if (match) return sasSeconds(match[1], match[2], match[3], value);
  }
  throw new RangeError(
    `"${value}" is not a complete ISO 8601 value for a ${storage} column.`
  );
}

function storageOf(dataset: Dataset, variable: VariableMeta): StorageKind {
  switch (variable.type) {
    case "text":
      return "text";
    case "integer":
    case "float":
      return "number";
    default:
      if (dataset.layer !== "adam") return "text";
      return variable.type === "date"
        ? "sas-date"
        : variable.type === "datetime"
          ? "sas-datetime"
          : "sas-time";
  }
}

function checkValue(
  dataset: Dataset,
  variable: VariableMeta,
  storage: StorageKind,
  value: CellValue,
  row: number
): void {
  if (value === null) return;
  const where = `${dataset.name}.${variable.name} row ${row}`;
  if (storage === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`${where} must be a finite number or null.`);
    }
    if (variable.type === "integer" && !Number.isInteger(value)) {
      throw new TypeError(`${where} must be an integer, got ${value}.`);
    }
    return;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${where} must be text or null.`);
  }
  if (storage !== "text") toSasNumber(storage, value);
}

/**
 * Reads a dataset's columns in variable order, checking every value against
 * the variable's type.
 *
 * @throws TypeError when a value does not match its column's type, or a
 *   column is missing or the wrong length.
 * @throws RangeError when an ADaM timing value is not a complete ISO 8601
 *   value.
 */
export function exportColumns(dataset: Dataset): readonly ExportColumn[] {
  const seen = new Set<string>();
  return dataset.variables.map((variable) => {
    if (seen.has(variable.name)) {
      throw new TypeError(
        `${dataset.name} declares ${variable.name} more than once.`
      );
    }
    seen.add(variable.name);
    const values = dataset.columns[variable.name];
    if (!Array.isArray(values) || values.length !== dataset.rowCount) {
      throw new TypeError(
        `${dataset.name}.${variable.name} must hold ${dataset.rowCount} values.`
      );
    }
    const storage = storageOf(dataset, variable);
    values.forEach((value, row) =>
      checkValue(dataset, variable, storage, value, row)
    );
    if (storage !== "text") return { variable, storage, values };
    let textLength = 1;
    for (const value of values) {
      if (typeof value === "string") {
        textLength = Math.max(textLength, utf8Length(value));
      }
    }
    return { variable, storage, values, textLength };
  });
}
