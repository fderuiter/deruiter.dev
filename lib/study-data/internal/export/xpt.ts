/**
 * SAS XPORT v5 (XPT) writer, following the record layout SAS publishes in
 * technical note TS-140: 80-byte records, a library header, one member with
 * its descriptor, 140-byte namestr records, then the observations.
 *
 * Limits of the format and what the writer does at each:
 *
 * - Dataset and variable names longer than 8 characters, or not SAS names,
 *   are rejected with a RangeError. Truncating names could make two
 *   variables collide, which would corrupt the file.
 * - Labels are cut to 40 bytes and character values to 200 bytes, at a
 *   UTF-8 character boundary, each with a recorded finding. The
 *   Dataset-JSON and CSV files in the same package keep the full text.
 * - Text is written as UTF-8. Non-ASCII text is kept and recorded as a
 *   notice, because many XPT consumers expect ASCII.
 * - Missing numbers are the SAS missing value `.`; missing text is blanks.
 * - v5 stores no row count, so a reader cannot tell a final row that is
 *   all blanks (every variable character and missing) from the padding of
 *   the last record. Pipeline datasets always carry `STUDYID`, so they never
 *   end with such a row.
 *
 * The dataset label carries the synthetic-data notice as a `Synthetic: `
 * prefix, the only free-text field a v5 member has.
 */
import type { Dataset, Finding } from "../../types";
import {
  exportColumns,
  toSasNumber,
  truncateUtf8,
  utf8,
  type ExportColumn,
} from "./columns";
import { encodeIbmFloat } from "./ibm-float";

/** Bytes per XPT record. */
export const XPT_RECORD_LENGTH = 80;
/** Longest character value an XPT v5 variable can hold, in bytes. */
export const XPT_MAX_TEXT_BYTES = 200;
/** Longest dataset or variable label, in bytes. */
export const XPT_MAX_LABEL_BYTES = 40;
/** Longest dataset or variable name. */
export const XPT_MAX_NAME_LENGTH = 8;
/** Prefix that marks every XPT dataset label as synthetic. */
export const XPT_LABEL_PREFIX = "Synthetic: ";

/**
 * Created and modified timestamp written into every header, in the
 * `ddMMMyy:hh:mm:ss` form XPORT uses. It is fixed so the bytes depend only
 * on the data.
 */
const XPT_FIXED_TIMESTAMP = "01JAN80:00:00:00";
const SAS_VERSION = "9.4";
const OS_NAME = "JS";
const NAMESTR_LENGTH = 140;
const SAS_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NON_ASCII = /[^\x00-\x7f]/;
const CITATION = "SAS TS-140, record layout of a SAS XPORT v5 transport file";

const FORMATS = {
  "sas-date": { name: "DATE", width: 9 },
  "sas-datetime": { name: "DATETIME", width: 20 },
  "sas-time": { name: "TIME", width: 8 },
} as const;

const HEADER = "HEADER RECORD*******";

/** The result of writing one dataset. */
export interface XptResult {
  /** The transport file. */
  readonly bytes: Uint8Array;
  /** Truncations and non-ASCII text, one finding each. */
  readonly findings: readonly Finding[];
}

/** Accumulates bytes in 80-byte records. */
class RecordWriter {
  private readonly chunks: Uint8Array[] = [];
  private length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  /** Pads with blanks to the next record boundary. */
  padRecord(): void {
    const rest = this.length % XPT_RECORD_LENGTH;
    if (rest !== 0) this.push(blanks(XPT_RECORD_LENGTH - rest));
  }

  record(text: string): void {
    if (text.length !== XPT_RECORD_LENGTH || NON_ASCII.test(text)) {
      throw new Error(`Malformed XPT header record: "${text}".`);
    }
    this.push(utf8(text));
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

function blanks(length: number): Uint8Array {
  return new Uint8Array(length).fill(0x20);
}

/** ASCII text padded with blanks, or cut, to exactly `width` characters. */
function pad(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

/** Text in a fixed-width byte field, blank-padded. */
function field(bytes: Uint8Array, width: number): Uint8Array {
  const out = blanks(width);
  out.set(bytes.subarray(0, width));
  return out;
}

function assertSasName(kind: string, name: string): void {
  if (!SAS_NAME.test(name) || name.length > XPT_MAX_NAME_LENGTH) {
    throw new RangeError(
      `${kind} name "${name}" must be a SAS name of at most ${XPT_MAX_NAME_LENGTH} characters for XPT v5.`
    );
  }
}

function lengthOf(column: ExportColumn): number {
  return column.storage === "text"
    ? Math.min(column.textLength ?? 1, XPT_MAX_TEXT_BYTES)
    : 8;
}

/**
 * Writes one dataset as a SAS XPORT v5 transport file.
 *
 * @param dataset - An SDTM or ADaM dataset.
 * @returns The file bytes and any findings the format's limits raised.
 * @throws RangeError when a dataset or variable name is not a SAS name of
 *   at most 8 characters, the dataset has no variables or more than 9999,
 *   or a number is outside the IBM double range.
 * @throws TypeError when a value does not match its column.
 */
export function writeXpt(dataset: Dataset): XptResult {
  assertSasName("Dataset", dataset.name);
  if (dataset.variables.length === 0 || dataset.variables.length > 9999) {
    throw new RangeError(
      `${dataset.name} must have from 1 to 9999 variables for XPT v5.`
    );
  }
  for (const variable of dataset.variables) {
    assertSasName("Variable", variable.name);
  }
  const columns = exportColumns(dataset);
  const findings: Finding[] = [];
  const note = (
    ruleId: string,
    severity: Finding["severity"],
    message: string,
    variable?: string,
    row?: number
  ) =>
    findings.push({
      ruleId,
      severity,
      layer: dataset.layer,
      dataset: dataset.name,
      ...(variable === undefined ? {} : { variable }),
      ...(row === undefined ? {} : { row }),
      message,
      citation: CITATION,
    });
  const label = (text: string, variable?: string): Uint8Array => {
    if (NON_ASCII.test(text)) {
      note(
        "XPT-NON-ASCII",
        "notice",
        "Label has non-ASCII characters, written as UTF-8.",
        variable
      );
    }
    const cut = truncateUtf8(utf8(text), XPT_MAX_LABEL_BYTES);
    if (cut.truncated) {
      note(
        "XPT-LABEL-TRUNCATED",
        "notice",
        `Label "${text}" cut to ${XPT_MAX_LABEL_BYTES} bytes for XPT v5; the Dataset-JSON file keeps the full label.`,
        variable
      );
    }
    return field(cut.bytes, XPT_MAX_LABEL_BYTES);
  };

  const out = new RecordWriter();
  const created = pad(XPT_FIXED_TIMESTAMP, 16);
  const libraryHeader = `${HEADER}LIBRARY HEADER RECORD!!!!!!!${"0".repeat(30)}  `;
  out.record(libraryHeader);
  out.record(
    `SAS     SAS     SASLIB  ${pad(SAS_VERSION, 8)}${pad(OS_NAME, 8)}${" ".repeat(24)}${created}`
  );
  out.record(pad(created, XPT_RECORD_LENGTH));
  out.record(
    `${HEADER}MEMBER  HEADER RECORD!!!!!!!000000000000000001600000000${NAMESTR_LENGTH}  `
  );
  out.record(`${HEADER}DSCRPTR HEADER RECORD!!!!!!!${"0".repeat(30)}  `);
  out.record(
    `SAS     ${pad(dataset.name, 8)}SASDATA ${pad(SAS_VERSION, 8)}${pad(OS_NAME, 8)}${" ".repeat(24)}${created}`
  );
  out.push(utf8(`${created}${" ".repeat(16)}`));
  out.push(label(`${XPT_LABEL_PREFIX}${dataset.label}`));
  out.push(blanks(8));
  out.record(
    `${HEADER}NAMESTR HEADER RECORD!!!!!!!000000${String(columns.length).padStart(4, "0")}${"0".repeat(20)}  `
  );

  let position = 0;
  columns.forEach((column, index) => {
    const namestr = new Uint8Array(NAMESTR_LENGTH);
    const view = new DataView(namestr.buffer);
    const length = lengthOf(column);
    view.setInt16(0, column.storage === "text" ? 2 : 1);
    view.setInt16(2, 0);
    view.setInt16(4, length);
    view.setInt16(6, index + 1);
    namestr.set(field(utf8(column.variable.name), 8), 8);
    namestr.set(label(column.variable.label, column.variable.name), 16);
    const format =
      column.storage === "text" || column.storage === "number"
        ? undefined
        : FORMATS[column.storage];
    namestr.set(field(utf8(format?.name ?? ""), 8), 56);
    view.setInt16(64, format?.width ?? 0);
    view.setInt16(66, 0);
    view.setInt16(68, 0);
    namestr.set(field(new Uint8Array(0), 8), 72);
    view.setInt16(80, 0);
    view.setInt16(82, 0);
    view.setInt32(84, position);
    position += length;
    out.push(namestr);
  });
  out.padRecord();
  out.record(`${HEADER}OBS     HEADER RECORD!!!!!!!${"0".repeat(30)}  `);

  const lengths = columns.map(lengthOf);
  const rowLength = position;
  const observationBytes = rowLength * dataset.rowCount;
  const observations = blanks(
    Math.ceil(observationBytes / XPT_RECORD_LENGTH) * XPT_RECORD_LENGTH
  );
  const nonAscii = new Set<string>();
  let offset = 0;
  for (let row = 0; row < dataset.rowCount; row += 1) {
    columns.forEach((column, index) => {
      const value = column.values[row];
      if (column.storage === "number") {
        observations.set(
          encodeIbmFloat(typeof value === "number" ? value : null),
          offset
        );
      } else if (column.storage !== "text") {
        observations.set(
          encodeIbmFloat(
            typeof value === "string"
              ? toSasNumber(column.storage, value)
              : null
          ),
          offset
        );
      } else if (typeof value === "string") {
        if (NON_ASCII.test(value)) nonAscii.add(column.variable.name);
        const bytes = utf8(value);
        const cut = truncateUtf8(bytes, XPT_MAX_TEXT_BYTES);
        if (cut.truncated) {
          note(
            "XPT-VALUE-TRUNCATED",
            "warning",
            `Value cut from ${bytes.length} to ${cut.bytes.length} bytes, the XPT v5 limit of ${XPT_MAX_TEXT_BYTES}; the Dataset-JSON and CSV files keep the full text.`,
            column.variable.name,
            row
          );
        }
        observations.set(cut.bytes, offset);
      }
      offset += lengths[index];
    });
  }
  out.push(observations);
  for (const variable of [...nonAscii]) {
    note(
      "XPT-NON-ASCII",
      "notice",
      "Values have non-ASCII characters, written as UTF-8.",
      variable
    );
  }
  return { bytes: out.bytes(), findings };
}
