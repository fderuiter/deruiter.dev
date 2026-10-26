/**
 * The Aurora DSQL load plan (ADR 0070): the statements a runner sends to
 * make DSQL the warehouse of record for a set of tables, inside DSQL's
 * limits, and the fingerprints that show DSQL holds the same rows as the
 * in-browser DuckDB copy. Pure: no connection, no AWS SDK.
 */
import { fnv1a } from "@/lib/utils/prng";
import type {
  DsqlInsertBatch,
  DsqlLoadOptions,
  DsqlLoadPlan,
  DsqlTableParity,
  Warehouse,
  WarehouseColumn,
  WarehouseSchema,
  WarehouseTable,
  WarehouseValue,
} from "../../types";
import { postgresStatements } from "./ddl";
import { csvField } from "./export";
import { qualifiedName } from "./schema";

/** DSQL modifies at most 3,000 rows in one transaction. */
const DSQL_ROW_LIMIT = 3_000;
const DEFAULT_ROWS_PER_INSERT = 1_000;
/** PostgreSQL's wire protocol numbers parameters with 16 bits. */
const MAX_PARAMETERS = 65_535;

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const tableRef = (table: WarehouseTable) =>
  `${quote(table.layer)}.${quote(table.name)}`;

/** The column as the text `csvField` writes for it, computed by PostgreSQL. */
function canonicalText(column: WarehouseColumn): string {
  const c = quote(column.name);
  switch (column.type) {
    case "string":
      return c;
    case "integer":
    case "decimal":
      return `${c}::text`;
    case "boolean":
      return `CASE WHEN ${c} THEN 'true' WHEN NOT ${c} THEN 'false' END`;
    case "date":
      return `to_char(${c}, 'YYYY-MM-DD')`;
    case "timestamp":
      return `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
  }
}

/** A parameter value; decimals go as text so no binary float reaches NUMERIC. */
function parameter(column: WarehouseColumn, value: WarehouseValue) {
  if (value === null || value === undefined) return null;
  return column.type === "decimal" && typeof value === "number"
    ? value.toFixed(column.scale ?? 0)
    : value;
}

/** Order-independent fingerprint of a table's CSV lines. */
function fingerprintLines(lines: string[]): string {
  const text = [...lines].sort().join("\n");
  const hash = fnv1a(text).toString(16).padStart(8, "0");
  return `${lines.length}:${text.length}:${hash}`;
}

/**
 * Fingerprints rows read back from DSQL with a table's `readback` query,
 * the same way `planDsqlLoad` fingerprints the rows it loads, so equal
 * fingerprints mean equal contents whatever order the rows come back in.
 * The fingerprint is a change detector, not a cryptographic hash.
 *
 * @param table - The table the rows came from.
 * @param rows - Read-back rows, each column as text or `null`.
 * @returns The fingerprint: row count, text length and an FNV-1a hash.
 */
export function fingerprintDsqlRows(
  table: WarehouseTable,
  rows: readonly Readonly<Record<string, string | null>>[]
): string {
  return fingerprintLines(
    rows.map((row) =>
      table.columns
        .map((column) => {
          const text = row[column.name] ?? null;
          if (text === null) return "";
          return column.type === "string" ? csvField(column, text) : text;
        })
        .join(",")
    )
  );
}

/**
 * Plans loading warehouse tables into Aurora DSQL: drop the tables
 * (dependants first), create the schemas and tables in PostgreSQL syntax
 * with every key and check but without descriptions, then insert the rows
 * in table order with parameterised statements of at most
 * `maxRowsPerInsert` rows. Each statement is meant to run in its own
 * transaction, which is what DSQL requires of DDL and what keeps each
 * insert under its 3,000-row limit.
 *
 * @param schema - The tables to load, in schema order, such as the gold layer.
 * @param warehouse - Rows from `buildWarehouse`.
 * @param options - Batch size.
 * @returns The plan, with each table's expected row count, fingerprint and read-back query.
 */
export function planDsqlLoad(
  schema: WarehouseSchema,
  warehouse: Warehouse,
  options: DsqlLoadOptions = {}
): DsqlLoadPlan {
  const maxRows = options.maxRowsPerInsert ?? DEFAULT_ROWS_PER_INSERT;
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > DSQL_ROW_LIMIT) {
    throw new RangeError(
      `maxRowsPerInsert must be an integer from 1 to ${DSQL_ROW_LIMIT}, not ${maxRows}.`
    );
  }
  const inserts: DsqlInsertBatch[] = [];
  const parity: DsqlTableParity[] = [];
  let csvBytes = 0;
  for (const table of schema.tables) {
    const name = qualifiedName(table);
    const rows = warehouse.tables[name] ?? [];
    const { columns } = table;
    const parameterRows = Math.floor(MAX_PARAMETERS / columns.length);
    const perInsert = parameterRows < maxRows ? parameterRows : maxRows;
    const columnList = columns.map((c) => quote(c.name)).join(", ");
    for (let start = 0; start < rows.length; start += perInsert) {
      const batch = rows.slice(start, start + perInsert);
      const values: WarehouseValue[] = [];
      const tuples = batch.map((row) => {
        const placeholders = columns.map((column) => {
          values.push(parameter(column, row[column.name] ?? null));
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      inserts.push({
        table: name,
        text: `INSERT INTO ${tableRef(table)} (${columnList}) VALUES ${tuples.join(", ")}`,
        values,
        rowCount: batch.length,
      });
    }
    const lines = rows.map((row) =>
      columns.map((c) => csvField(c, row[c.name] ?? null)).join(",")
    );
    csvBytes += lines.reduce((sum, line) => sum + line.length + 1, 0);
    parity.push({
      table: name,
      rowCount: rows.length,
      fingerprint: fingerprintLines(lines),
      readback: `SELECT ${columns
        .map((c) => `${canonicalText(c)} AS ${quote(c.name)}`)
        .join(", ")} FROM ${tableRef(table)}`,
    });
  }
  return {
    schemaVersion: schema.version,
    drop: [...schema.tables]
      .reverse()
      .map((table) => `DROP TABLE IF EXISTS ${tableRef(table)}`),
    create: postgresStatements(schema),
    inserts,
    parity,
    csvBytes,
  };
}
