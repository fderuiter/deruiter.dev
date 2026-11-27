/**
 * Local dataset ingestion for the SQL notebook: validates uploaded CSV, JSON
 * and Apache Parquet files in memory, infers or preserves column types, and
 * emits the statements and virtual file buffer that load each dataset into
 * DuckDB's read-only `uploads` schema before `WORKBENCH_ENGINE_SETTINGS`
 * locks the configuration.
 */
import type {
  ContractColumnType,
  WorkbenchColumn,
  WorkbenchDatasetColumn,
  WorkbenchDatasetColumnType,
  WorkbenchDatasetFormat,
  WorkbenchDatasetLoad,
  WorkbenchDatasetParseResult,
  WorkbenchTable,
  WorkbenchUploadedDataset,
} from "../../types";
import { readParquetDataset } from "./parquet";

/** Hard 50 MB workspace cap for browser IndexedDB and in-memory fallback storage. */
export const MAX_WORKBENCH_STORAGE_BYTES = 50 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const BIGINT_RE = /^-?\d+$/;

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

const INT64_MIN = BigInt("-9223372036854775808");
const INT64_MAX = BigInt("9223372036854775807");

function isValidBigInt(value: string): boolean {
  if (!BIGINT_RE.test(value)) return false;
  if (value.length > 1 && /^-?0\d/.test(value)) return false;
  try {
    const b = BigInt(value);
    return b >= INT64_MIN && b <= INT64_MAX;
  } catch {
    return false;
  }
}

function isValidDouble(value: string): boolean {
  if (value.trim() === "" || value.trim() !== value) return false;
  if (/^0\d/.test(value) || /^-0\d/.test(value)) return false;
  const n = Number(value);
  return Number.isFinite(n);
}

/**
 * Turns a file name or user label into a clean SQL table identifier for the
 * `uploads` schema (`[a-z_][a-z0-9_]*`, at most 63 characters).
 *
 * @param raw - Original file name or table name.
 * @returns Unqualified table name in snake case.
 */
export function sanitizeDatasetTableName(raw: string): string {
  const withoutExt = raw
    .trim()
    .replace(/\.(csv|json|jsonl|ndjson|parquet)$/i, "");
  const normalized = withoutExt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefixed =
    normalized.length === 0
      ? "dataset"
      : /^[0-9]/.test(normalized)
        ? `t_${normalized}`
        : normalized;
  return prefixed.slice(0, 63);
}

function normalizeColumnNames(rawNames: readonly string[]): string[] {
  const used = new Map<string, number>();
  return rawNames.map((raw, index) => {
    const cleaned = raw.replace(/^\uFEFF/, "").trim() || `column_${index + 1}`;
    const seen = used.get(cleaned) ?? 0;
    used.set(cleaned, seen + 1);
    return seen === 0 ? cleaned : `${cleaned}_${seen + 1}`;
  });
}

function inferColumnType(values: readonly (string | null)[]): {
  type: WorkbenchDatasetColumnType;
  nullable: boolean;
} {
  let nullable = false;
  const nonNull: string[] = [];
  for (const v of values) {
    if (v === null) nullable = true;
    else nonNull.push(v);
  }
  if (nonNull.length === 0) {
    return { type: "VARCHAR", nullable: true };
  }
  if (
    nonNull.every((v) => {
      const lower = v.toLowerCase();
      return lower === "true" || lower === "false";
    })
  ) {
    return { type: "BOOLEAN", nullable };
  }
  if (nonNull.every(isValidBigInt)) {
    return { type: "BIGINT", nullable };
  }
  if (nonNull.every(isValidDouble)) {
    return { type: "DOUBLE", nullable };
  }
  if (nonNull.every(isValidIsoDate)) {
    return { type: "DATE", nullable };
  }
  if (
    nonNull.every(
      (v) => ISO_TIMESTAMP_RE.test(v) && Number.isFinite(Date.parse(v))
    )
  ) {
    return { type: "TIMESTAMP", nullable };
  }
  return { type: "VARCHAR", nullable };
}

interface ParsedCell {
  readonly value: string;
  readonly quoted: boolean;
}

/** Strict RFC 4180 CSV parser supporting quoted newlines and escaped quotes. */
function parseCsvRecords(text: string): ParsedCell[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows: ParsedCell[][] = [];
  let row: ParsedCell[] = [];
  let i = 0;

  while (i < cleaned.length) {
    const c = cleaned[i];
    if (c === '"') {
      let val = "";
      i += 1;
      let closed = false;
      while (i < cleaned.length) {
        if (cleaned[i] === '"') {
          if (cleaned[i + 1] === '"') {
            val += '"';
            i += 2;
          } else {
            closed = true;
            i += 1;
            break;
          }
        } else {
          val += cleaned[i];
          i += 1;
        }
      }
      if (!closed) {
        throw new Error(
          "The CSV file has an unclosed quoted field. Close the quote and upload again."
        );
      }
      while (
        i < cleaned.length &&
        (cleaned[i] === " " || cleaned[i] === "\t")
      ) {
        i += 1;
      }
      if (
        i < cleaned.length &&
        cleaned[i] !== "," &&
        cleaned[i] !== "\n" &&
        cleaned[i] !== "\r"
      ) {
        throw new Error(
          "The CSV file has unexpected characters after a quoted field."
        );
      }
      row.push({ value: val, quoted: true });
      if (cleaned[i] === ",") {
        i += 1;
        if (i === cleaned.length) row.push({ value: "", quoted: false });
      } else if (cleaned[i] === "\r") {
        i += cleaned[i + 1] === "\n" ? 2 : 1;
        rows.push(row);
        row = [];
      } else if (cleaned[i] === "\n") {
        i += 1;
        rows.push(row);
        row = [];
      }
    } else {
      let val = "";
      while (
        i < cleaned.length &&
        cleaned[i] !== "," &&
        cleaned[i] !== "\r" &&
        cleaned[i] !== "\n"
      ) {
        val += cleaned[i];
        i += 1;
      }
      row.push({ value: val, quoted: false });
      if (cleaned[i] === ",") {
        i += 1;
        if (i === cleaned.length) row.push({ value: "", quoted: false });
      } else if (cleaned[i] === "\r") {
        i += cleaned[i + 1] === "\n" ? 2 : 1;
        rows.push(row);
        row = [];
      } else if (cleaned[i] === "\n") {
        i += 1;
        rows.push(row);
        row = [];
      }
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function parseCsvDataset(bytes: Uint8Array): {
  columns: WorkbenchDatasetColumn[];
  rows: (string | null)[][];
} {
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new Error("The CSV file is not valid UTF-8 text.");
  }
  if (text.trim() === "") {
    throw new Error("The CSV file is empty.");
  }
  const parsed = parseCsvRecords(text);
  if (parsed.length === 0 || parsed[0].every((c) => c.value.trim() === "")) {
    throw new Error(
      "The CSV file must start with a header row of column names."
    );
  }
  const headers = normalizeColumnNames(parsed[0].map((c) => c.value));
  const rawRows = parsed
    .slice(1)
    .filter(
      (r) =>
        !(
          r.length === 1 &&
          !r[0].quoted &&
          r[0].value === "" &&
          headers.length > 1
        )
    );
  for (let idx = 0; idx < rawRows.length; idx += 1) {
    if (rawRows[idx].length > headers.length) {
      throw new Error(
        `CSV row ${idx + 2} has ${rawRows[idx].length} fields, more than the ${headers.length} header columns.`
      );
    }
  }

  const rows: (string | null)[][] = rawRows.map((r) =>
    headers.map((_, at) => {
      const cell = r[at];
      if (!cell) return null;
      if (!cell.quoted && (cell.value === "" || cell.value === "NULL")) {
        return null;
      }
      return cell.value;
    })
  );

  const columns: WorkbenchDatasetColumn[] = headers.map((name, at) => {
    const inferred = inferColumnType(rows.map((r) => r[at]));
    return { name, type: inferred.type, nullable: inferred.nullable };
  });

  const normalizedRows = rows.map((r) =>
    r.map((val, at) => {
      if (val === null) return null;
      if (columns[at].type === "BOOLEAN") return val.toLowerCase();
      return val;
    })
  );

  return { columns, rows: normalizedRows };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyJsonCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function extractJsonObjects(text: string): Record<string, unknown>[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed === "") {
    throw new Error("The JSON file is empty.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Support newline-delimited JSON (NDJSON / JSONL)
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) throw new Error("The JSON file is empty.");
    return lines.map((line, index) => {
      let item: unknown;
      try {
        item = JSON.parse(line);
      } catch {
        throw new Error(
          `The JSON file could not be parsed (invalid JSON at line ${index + 1}).`
        );
      }
      if (!isPlainObject(item)) {
        throw new Error(
          `JSON line ${index + 1} must be an object of column keys and values.`
        );
      }
      return item;
    });
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error(
        "The JSON array is empty, so column names cannot be read."
      );
    }
    return parsed.map((item, index) => {
      if (!isPlainObject(item)) {
        throw new Error(
          `JSON element ${index} must be a row object, not ${Array.isArray(item) ? "an array" : typeof item}.`
        );
      }
      return item;
    });
  }

  if (isPlainObject(parsed)) {
    if (Array.isArray(parsed.rows) && parsed.rows.every(isPlainObject)) {
      if (parsed.rows.length === 0) {
        throw new Error("The JSON `rows` array is empty.");
      }
      return parsed.rows;
    }
    const entries = Object.entries(parsed);
    if (entries.length > 0 && entries.every(([, val]) => Array.isArray(val))) {
      const length = (entries[0][1] as unknown[]).length;
      if (
        entries.every(([, val]) => (val as unknown[]).length === length) &&
        length > 0
      ) {
        return Array.from({ length }, (_, rowIdx) => {
          const obj: Record<string, unknown> = {};
          for (const [k, arr] of entries) {
            obj[k] = (arr as unknown[])[rowIdx];
          }
          return obj;
        });
      }
    }
    return [parsed];
  }

  throw new Error(
    "The JSON file must hold an array of row objects or newline-delimited JSON objects."
  );
}

function parseJsonDataset(bytes: Uint8Array): {
  columns: WorkbenchDatasetColumn[];
  rows: (string | null)[][];
} {
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new Error("The JSON file is not valid UTF-8 text.");
  }
  const objects = extractJsonObjects(text);
  const rawKeys: string[] = [];
  const keySet = new Set<string>();
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      if (!keySet.has(key)) {
        keySet.add(key);
        rawKeys.push(key);
      }
    }
  }
  if (rawKeys.length === 0) {
    throw new Error("The JSON objects have no fields to turn into columns.");
  }

  const normalizedNames = normalizeColumnNames(rawKeys);
  const rows: (string | null)[][] = objects.map((obj) =>
    rawKeys.map((key) => stringifyJsonCell(obj[key]))
  );

  const columns: WorkbenchDatasetColumn[] = normalizedNames.map((name, at) => {
    // Prefer strict JSON primitive hints when every non-null value shares one JSON type
    const nonNullRaw = objects
      .map((o) => o[rawKeys[at]])
      .filter((v) => v !== null && v !== undefined);
    if (
      nonNullRaw.length > 0 &&
      nonNullRaw.every((v) => typeof v === "boolean")
    ) {
      return { name, type: "BOOLEAN", nullable: true };
    }
    if (
      nonNullRaw.length > 0 &&
      nonNullRaw.every((v) => typeof v === "number")
    ) {
      const allInts = nonNullRaw.every(
        (v) => typeof v === "number" && Number.isSafeInteger(v)
      );
      return { name, type: allInts ? "BIGINT" : "DOUBLE", nullable: true };
    }
    if (
      nonNullRaw.length > 0 &&
      nonNullRaw.every((v) => typeof v === "string")
    ) {
      const strs = nonNullRaw as string[];
      if (strs.length > 0 && strs.every(isValidIsoDate)) {
        return { name, type: "DATE", nullable: true };
      }
      if (
        strs.length > 0 &&
        strs.every(
          (s) => ISO_TIMESTAMP_RE.test(s) && Number.isFinite(Date.parse(s))
        )
      ) {
        return { name, type: "TIMESTAMP", nullable: true };
      }
      return { name, type: "VARCHAR", nullable: true };
    }
    const inferred = inferColumnType(rows.map((r) => r[at]));
    return { name, type: inferred.type, nullable: true };
  });

  return { columns, rows };
}

function detectFormat(
  fileName: string,
  bytes: Uint8Array
): WorkbenchDatasetFormat | null {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".parquet")) return "parquet";
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".jsonl") ||
    lower.endsWith(".ndjson")
  ) {
    return "json";
  }
  if (lower.endsWith(".csv")) return "csv";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x41 &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x31
  ) {
    return "parquet";
  }
  return null;
}

function readDatasetRows(
  format: WorkbenchDatasetFormat,
  bytes: Uint8Array
): { columns: WorkbenchDatasetColumn[]; rows: (string | null)[][] } {
  switch (format) {
    case "csv":
      return parseCsvDataset(bytes);
    case "json":
      return parseJsonDataset(bytes);
    case "parquet":
      return readParquetDataset(bytes);
  }
}

/**
 * Validates an uploaded CSV, JSON or Parquet file and extracts its schema and
 * row count for the dataset manager.
 *
 * @param input - File name, raw bytes and optional identity metadata.
 * @returns The validated dataset descriptor or a visitor-facing error message.
 */
export function parseWorkbenchDataset(input: {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly id?: string;
  readonly tableName?: string;
  readonly uploadedAt?: string;
}): WorkbenchDatasetParseResult {
  if (input.bytes.byteLength === 0) {
    return { ok: false, error: "The uploaded file is empty." };
  }
  if (input.bytes.byteLength > MAX_WORKBENCH_STORAGE_BYTES) {
    return {
      ok: false,
      error: `The file is ${(input.bytes.byteLength / (1024 * 1024)).toFixed(1)} MB, which exceeds the 50 MB local workspace limit.`,
    };
  }
  const format = detectFormat(input.fileName, input.bytes);
  if (format === null) {
    return {
      ok: false,
      error:
        "Unsupported dataset file type. Upload a .csv, .json or .parquet file.",
    };
  }
  try {
    const { columns, rows } = readDatasetRows(format, input.bytes);
    if (columns.length === 0) {
      return { ok: false, error: "The dataset contains no columns." };
    }
    const tableName = sanitizeDatasetTableName(
      input.tableName ?? input.fileName
    );
    const id = input.id ?? `ds-${tableName}`;
    const uploadedAt = input.uploadedAt ?? new Date().toISOString();
    return {
      ok: true,
      dataset: {
        id,
        tableName,
        qualifiedName: `uploads.${tableName}`,
        fileName: input.fileName,
        format,
        rowCount: rows.length,
        byteLength: input.bytes.byteLength,
        uploadedAt,
        columns,
        bytes: input.bytes.slice(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The dataset could not be read.",
    };
  }
}

/** Formats one cell for DuckDB `COPY ... (FORMAT csv, ALLOW_QUOTED_NULLS false)`. */
function copyCsvField(value: string | null): string {
  if (value === null) return "";
  if (value === "" || /[",\r\n]/.test(value) || value.trim() !== value) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Builds the DDL, canonical UTF-8 CSV buffer and `COPY` statement that hydrate
 * one validated dataset into DuckDB's `uploads` schema before settings lock.
 *
 * @param dataset - A validated dataset from `parseWorkbenchDataset`.
 * @returns Load descriptor for `startSqlEngine` and `reloadDatasets`.
 */
export function workbenchDatasetLoad(
  dataset: WorkbenchUploadedDataset
): WorkbenchDatasetLoad {
  const { columns, rows } = readDatasetRows(dataset.format, dataset.bytes);
  const tableName = sanitizeDatasetTableName(dataset.tableName);
  const qualified = `${quote("uploads")}.${quote(tableName)}`;
  const virtualFile = `uploads-${tableName}.csv`;

  const colDefs = columns
    .map(
      (col) =>
        `${quote(col.name)} ${col.type}${col.nullable ? "" : " NOT NULL"}`
    )
    .join(", ");
  const ddl = `CREATE SCHEMA IF NOT EXISTS "uploads"; DROP TABLE IF EXISTS ${qualified}; CREATE TABLE ${qualified} (${colDefs});`;

  const lines = [
    columns.map((c) => copyCsvField(c.name)).join(","),
    ...rows.map((row) =>
      columns.map((_, at) => copyCsvField(row[at] ?? null)).join(",")
    ),
  ];
  const buffer = encoder.encode(`${lines.join("\n")}\n`);
  const copy = `COPY ${qualified} FROM '${virtualFile}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`;

  return {
    table: `uploads.${tableName}`,
    fileName: virtualFile,
    ddl,
    buffer,
    copy,
  };
}

function contractType(type: WorkbenchDatasetColumnType): ContractColumnType {
  switch (type) {
    case "BIGINT":
      return "integer";
    case "DOUBLE":
      return "decimal";
    case "BOOLEAN":
      return "boolean";
    case "DATE":
      return "date";
    case "TIMESTAMP":
      return "timestamp";
    case "VARCHAR":
      return "string";
  }
}

/**
 * Adapts an uploaded dataset into a `WorkbenchTable` entry so the schema
 * browser lists `uploads.*` tables alongside `gold.*` tables.
 *
 * @param dataset - A validated uploaded dataset.
 * @returns Schema browser table entry.
 */
export function workbenchDatasetTable(
  dataset: WorkbenchUploadedDataset
): WorkbenchTable {
  const columns: WorkbenchColumn[] = dataset.columns.map((col) => ({
    name: col.name,
    type: contractType(col.type),
    nullable: col.nullable,
    description: `Uploaded from ${dataset.fileName} (${dataset.format.toUpperCase()}).`,
    classification: "internal",
  }));
  return {
    name: dataset.qualifiedName,
    kind: "dimension",
    description: `Local ${dataset.format.toUpperCase()} dataset uploaded in this browser (${dataset.fileName}). Stored in IndexedDB and loaded read-only into ${dataset.qualifiedName}.`,
    grain: `One record from ${dataset.fileName}`,
    primaryKey: [],
    owner: "Local browser session",
    steward: "Local dataset manager",
    classification: "internal",
    personalHealthData: false,
    contractVersion: "1.0.0",
    rowCount: dataset.rowCount,
    columns,
  };
}
