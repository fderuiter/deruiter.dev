/**
 * Local dataset ingestion for the SQL notebook: runs cheap upfront checks on
 * uploaded CSV, JSON and Apache Parquet files (empty file, 50 MB cap, file
 * extension and `PAR1` magic bytes), builds the DuckDB `read_parquet` /
 * `read_csv` / `read_json` statements that hydrate each upload into the
 * read-only `uploads` schema before `WORKBENCH_ENGINE_SETTINGS` locks the
 * configuration, and maps `DESCRIBE` + `SELECT count(*)` metadata into the
 * schema browser.
 */
import type {
  ContractColumnType,
  WorkbenchColumn,
  WorkbenchDatasetColumn,
  WorkbenchDatasetFormat,
  WorkbenchDatasetLoad,
  WorkbenchDatasetParseResult,
  WorkbenchHydratedDataset,
  WorkbenchTable,
  WorkbenchUploadedDataset,
} from "../../types";

/** Hard 50 MB workspace cap for browser IndexedDB and in-memory fallback storage. */
export const MAX_WORKBENCH_STORAGE_BYTES = 50 * 1024 * 1024;

/** Minimum valid Parquet file size: 4-byte header magic + 4-byte footer length + 4-byte trailer magic. */
const MIN_PARQUET_BYTES = 12;

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

function isParquetMagicAt(bytes: Uint8Array, offset: number): boolean {
  return (
    bytes[offset] === 0x50 &&
    bytes[offset + 1] === 0x41 &&
    bytes[offset + 2] === 0x52 &&
    bytes[offset + 3] === 0x31
  );
}

function hasParquetMagicAtBothEnds(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= MIN_PARQUET_BYTES &&
    isParquetMagicAt(bytes, 0) &&
    isParquetMagicAt(bytes, bytes.byteLength - 4)
  );
}

function isBlankTextPayload(bytes: Uint8Array): boolean {
  let start = 0;
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    start = 3;
  }
  for (let i = start; i < bytes.byteLength; i += 1) {
    const b = bytes[i];
    if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      return false;
    }
  }
  return true;
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
  if (hasParquetMagicAtBothEnds(bytes)) return "parquet";
  return null;
}

function virtualExtension(
  fileName: string,
  format: WorkbenchDatasetFormat
): string {
  if (format === "parquet") return ".parquet";
  if (format === "csv") return ".csv";
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".ndjson")) return ".ndjson";
  if (lower.endsWith(".jsonl")) return ".jsonl";
  return ".json";
}

/**
 * Runs cheap upfront validation on an uploaded CSV, JSON or Parquet file:
 * non-empty check, 50 MB size cap, supported file extension and `PAR1` magic
 * bytes at both ends of a Parquet file. Parsing and schema inference are
 * delegated to DuckDB during `hydrateWarehouse`, so any unreadable file fails
 * with DuckDB's own error message.
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
  if (format === "parquet") {
    if (!hasParquetMagicAtBothEnds(input.bytes)) {
      return {
        ok: false,
        error:
          "The Parquet file is missing the PAR1 header or trailer magic bytes.",
      };
    }
  } else if (isBlankTextPayload(input.bytes)) {
    return { ok: false, error: "The uploaded file is empty." };
  }

  const tableName = sanitizeDatasetTableName(input.tableName ?? input.fileName);
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
      rowCount: null,
      byteLength: input.bytes.byteLength,
      uploadedAt,
      columns: [],
      bytes: input.bytes.slice(),
    },
  };
}

/**
 * Builds the virtual file name, original upload buffer and DuckDB statements
 * (`read_parquet`, `read_csv` or `read_json`, plus `DESCRIBE` and
 * `SELECT count(*)`) that hydrate one dataset into `uploads` before
 * `WORKBENCH_ENGINE_SETTINGS` locks the configuration.
 *
 * @param dataset - A dataset from `parseWorkbenchDataset`.
 * @returns Load descriptor for `startSqlEngine` and `reloadDatasets`.
 */
export function workbenchDatasetLoad(
  dataset: WorkbenchUploadedDataset
): WorkbenchDatasetLoad {
  const tableName = sanitizeDatasetTableName(dataset.tableName);
  const qualified = `${quote("uploads")}.${quote(tableName)}`;
  const ext = virtualExtension(dataset.fileName, dataset.format);
  const virtualFile = `uploads-${tableName}${ext}`;
  const escapedFile = virtualFile.replaceAll("'", "''");

  let readerExpr: string;
  switch (dataset.format) {
    case "parquet":
      readerExpr = `read_parquet('${escapedFile}')`;
      break;
    case "csv":
      readerExpr = `read_csv('${escapedFile}', header = true, delim = ',', quote = '"', escape = '"', allow_quoted_nulls = false, strict_mode = true)`;
      break;
    case "json":
      readerExpr = `read_json('${escapedFile}', format = 'auto', records = 'auto')`;
      break;
  }

  const create = `CREATE SCHEMA IF NOT EXISTS "uploads"; DROP TABLE IF EXISTS ${qualified}; CREATE TABLE ${qualified} AS SELECT * FROM ${readerExpr};`;
  const describe = `DESCRIBE ${qualified}`;
  const count = `SELECT count(*) AS n FROM ${qualified}`;

  return {
    table: `uploads.${tableName}`,
    format: dataset.format,
    fileName: virtualFile,
    buffer: dataset.bytes.slice(),
    create,
    describe,
    count,
  };
}

/**
 * Builds a `WorkbenchHydratedDataset` from the rows returned by DuckDB's
 * `DESCRIBE` and `SELECT count(*)` queries on an `uploads.*` table.
 *
 * @param table - Qualified table name (`uploads.<name>`).
 * @param describeRows - Rows of `[column_name, column_type, null, ...]`.
 * @param rowCount - Row count returned by `SELECT count(*)`.
 * @returns Hydrated schema and row count for the dataset.
 */
export function workbenchHydratedDataset(
  table: string,
  describeRows: readonly (readonly (string | null)[])[],
  rowCount: number
): WorkbenchHydratedDataset {
  const columns: WorkbenchDatasetColumn[] = describeRows.map((row, index) => ({
    name: row[0] ?? `column_${index + 1}`,
    type: row[1] ?? "VARCHAR",
    nullable: (row[2] ?? "YES").toUpperCase() !== "NO",
  }));
  return {
    table,
    rowCount: Math.max(0, Math.trunc(rowCount)),
    columns,
  };
}

/**
 * Merges `DESCRIBE` columns and `SELECT count(*)` row counts from DuckDB back
 * onto the corresponding `WorkbenchUploadedDataset` entries.
 *
 * @param datasets - Uploaded datasets in workspace order.
 * @param hydrated - Hydrated table metadata returned by the SQL engine.
 * @returns Updated dataset descriptors carrying DuckDB's columns and row counts.
 */
export function mergeWorkbenchHydratedDatasets(
  datasets: readonly WorkbenchUploadedDataset[],
  hydrated: readonly WorkbenchHydratedDataset[]
): WorkbenchUploadedDataset[] {
  const byTable = new Map(hydrated.map((entry) => [entry.table, entry]));
  return datasets.map((dataset) => {
    const match = byTable.get(dataset.qualifiedName);
    if (!match) return dataset;
    return {
      ...dataset,
      rowCount: match.rowCount,
      columns: match.columns.map((col) => ({ ...col })),
    };
  });
}

function contractType(duckType: string): ContractColumnType {
  const normalized = duckType.trim().toUpperCase();
  if (
    /^(?:U?(?:TINY|SMALL|BIG|HUGE)|MEDIUM)?INT(?:EGER|8|16|32|64|128)?$/.test(
      normalized
    )
  ) {
    return "integer";
  }
  if (/^(?:DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL)\b/.test(normalized)) {
    return "decimal";
  }
  if (/^BOOL/.test(normalized)) {
    return "boolean";
  }
  if (normalized === "DATE") {
    return "date";
  }
  if (/^TIMESTAMP/.test(normalized)) {
    return "timestamp";
  }
  if (/^TIME\b/.test(normalized)) {
    return "time";
  }
  return "string";
}

/**
 * Adapts a hydrated uploaded dataset into a `WorkbenchTable` entry so the
 * schema browser lists `uploads.*` tables alongside `gold.*` tables using the
 * columns and row count from DuckDB's `DESCRIBE` and `SELECT count(*)`.
 *
 * @param dataset - An uploaded dataset.
 * @returns Schema browser table entry.
 */
export function workbenchDatasetTable(
  dataset: WorkbenchUploadedDataset
): WorkbenchTable {
  const columns: WorkbenchColumn[] = dataset.columns.map((col) => ({
    name: col.name,
    type: contractType(col.type),
    nullable: col.nullable,
    description: `${col.type} column from ${dataset.fileName} (${dataset.format.toUpperCase()}).`,
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
    rowCount: dataset.rowCount ?? 0,
    columns,
  };
}
