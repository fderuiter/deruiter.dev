/**
 * A SAS XPORT v5 reader for tests only. It reads the files `writeXpt` from
 * `@/lib/study-data` produces, independently of the writer, so a round trip
 * proves every value reads back. It handles one member per file.
 */

/** Decodes one 8-byte big-endian IBM double. Missing values decode to null. */
export function decodeIbmFloat(bytes: Uint8Array): number | null {
  if (bytes.length !== 8) throw new RangeError("An IBM double is 8 bytes.");
  const rest = bytes.subarray(1);
  const isMissingCode =
    bytes[0] === 0x2e ||
    bytes[0] === 0x5f ||
    (bytes[0] >= 0x41 && bytes[0] <= 0x5a);
  if (isMissingCode && rest.every((byte) => byte === 0)) return null;
  let fraction = 0;
  for (const byte of rest) fraction = fraction * 256 + byte;
  if (fraction === 0) return 0;
  const exponent = (bytes[0] & 0x7f) - 64;
  const magnitude = fraction * 2 ** (exponent * 4 - 56);
  return bytes[0] & 0x80 ? -magnitude : magnitude;
}

/** One variable as its namestr record declares it. */
export interface XptVariable {
  readonly name: string;
  readonly label: string;
  readonly type: "numeric" | "character";
  readonly length: number;
  readonly varnum: number;
  readonly format: string;
  readonly formatWidth: number;
  readonly position: number;
}

/** One member read back from a transport file. */
export interface XptMember {
  readonly name: string;
  readonly label: string;
  readonly created: string;
  readonly variables: readonly XptVariable[];
  /** Rows of values: numbers (or null) and trimmed UTF-8 text (or null). */
  readonly rows: readonly (readonly (string | number | null)[])[];
}

const RECORD = 80;
const decoder = new TextDecoder("utf-8", { fatal: true });

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function text(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x20 || bytes[end - 1] === 0)) end -= 1;
  return decoder.decode(bytes.subarray(0, end));
}

function expectHeader(bytes: Uint8Array, offset: number, kind: string): void {
  const record = ascii(bytes.subarray(offset, offset + RECORD));
  const prefix = `HEADER RECORD*******${kind} HEADER RECORD!!!!!!!`;
  if (!record.startsWith(prefix)) {
    throw new Error(`Expected ${kind} header at ${offset}, got "${record}".`);
  }
}

/** Reads a single-member SAS XPORT v5 file. */
export function readXpt(bytes: Uint8Array): XptMember {
  if (bytes.length % RECORD !== 0) {
    throw new Error("An XPT file is a whole number of 80-byte records.");
  }
  expectHeader(bytes, 0, "LIBRARY");
  if (!ascii(bytes.subarray(80, 104)).startsWith("SAS     SAS     SASLIB")) {
    throw new Error("Missing the SAS library header.");
  }
  expectHeader(bytes, 240, "MEMBER ");
  const namestrLength = Number(ascii(bytes.subarray(240 + 74, 240 + 78)));
  if (namestrLength !== 140) throw new Error("Expected 140-byte namestrs.");
  expectHeader(bytes, 320, "DSCRPTR");
  const member = bytes.subarray(400, 480);
  const name = text(member.subarray(8, 16));
  const created = ascii(member.subarray(64, 80));
  const label = text(bytes.subarray(480 + 32, 480 + 72));
  expectHeader(bytes, 560, "NAMESTR");
  const count = Number(ascii(bytes.subarray(560 + 54, 560 + 58)));
  const variables: XptVariable[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < count; index += 1) {
    const at = 640 + index * 140;
    variables.push({
      type: view.getInt16(at) === 1 ? "numeric" : "character",
      length: view.getInt16(at + 4),
      varnum: view.getInt16(at + 6),
      name: text(bytes.subarray(at + 8, at + 16)),
      label: text(bytes.subarray(at + 16, at + 56)),
      format: text(bytes.subarray(at + 56, at + 64)),
      formatWidth: view.getInt16(at + 64),
      position: view.getInt32(at + 84),
    });
  }
  const obsHeader = 640 + Math.ceil((count * 140) / RECORD) * RECORD;
  expectHeader(bytes, obsHeader, "OBS    ");
  const start = obsHeader + RECORD;
  const rowLength = variables.reduce(
    (sum, variable) => sum + variable.length,
    0
  );
  const available = bytes.length - start;
  let rowCount = Math.floor(available / rowLength);
  // The last record is padded with blanks. Rows made only of blanks that sit
  // inside that padding are padding, not data.
  while (rowCount > 0 && available - (rowCount - 1) * rowLength < RECORD) {
    const row = bytes.subarray(
      start + (rowCount - 1) * rowLength,
      start + rowCount * rowLength
    );
    if (!row.every((byte) => byte === 0x20)) break;
    rowCount -= 1;
  }
  const rows = Array.from({ length: rowCount }, (_, row) =>
    variables.map((variable) => {
      const at = start + row * rowLength + variable.position;
      const cell = bytes.subarray(at, at + variable.length);
      if (variable.type === "numeric") return decodeIbmFloat(cell);
      const value = text(cell);
      return value === "" ? null : value;
    })
  );
  return { name, label, created, variables, rows };
}

/** ISO 8601 date of a SAS date (days since 1960-01-01). */
export function sasDateToIso(days: number): string {
  return new Date(Date.UTC(1960, 0, 1) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
