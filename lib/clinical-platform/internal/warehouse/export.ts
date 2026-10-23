/**
 * CSV export with a column and type manifest that a Parquet writer can
 * follow, so the files load into DuckDB, PostgreSQL, SQL Server or a
 * Parquet pipeline without guessing types.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ParquetColumnType,
  Warehouse,
  WarehouseColumn,
  WarehouseCsvFile,
  WarehouseExport,
  WarehouseSchema,
  WarehouseValue,
} from "../../types";
import { qualifiedName } from "./schema";

/** One CSV field. `null` is empty and unquoted; an empty string is `""`. */
function field(column: WarehouseColumn, value: WarehouseValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return column.type === "decimal"
      ? value.toFixed(column.scale ?? 0)
      : String(value);
  }
  return value === "" || /[",\r\n]/.test(value) || value.trim() !== value
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

/** Parquet type for a column: physical type, logical annotation and repetition. */
export function parquetType(column: WarehouseColumn): ParquetColumnType {
  const repetition = column.nullable ? "OPTIONAL" : "REQUIRED";
  switch (column.type) {
    case "string":
      return { physicalType: "BYTE_ARRAY", logicalType: "STRING", repetition };
    case "integer":
      return {
        physicalType: "INT32",
        logicalType: "INT(32, true)",
        repetition,
      };
    case "decimal":
      return {
        physicalType: "INT64",
        logicalType: `DECIMAL(${column.precision}, ${column.scale})`,
        repetition,
      };
    case "boolean":
      return { physicalType: "BOOLEAN", logicalType: null, repetition };
    case "date":
      return { physicalType: "INT32", logicalType: "DATE", repetition };
    case "timestamp":
      return {
        physicalType: "INT64",
        logicalType: "TIMESTAMP(isAdjustedToUTC=true, unit=MILLIS)",
        repetition,
      };
  }
}

/**
 * Exports every warehouse table as CSV with a header row and RFC 4180 quoting (fields
 * separated by commas, lines by LF), plus a manifest of each file's columns
 * with their logical, nullability, classification and Parquet types.
 * Dates are ISO 8601 and timestamps UTC with a `Z`; decimals carry their
 * declared scale. No Parquet library is needed: the manifest says how to
 * write each column.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @param warehouse - Rows from `buildWarehouse`.
 * @returns The files in schema order and their manifest.
 */
export function exportWarehouse(
  schema: WarehouseSchema,
  warehouse: Warehouse
): WarehouseExport {
  const files: WarehouseCsvFile[] = schema.tables.map((table) => {
    const rows = warehouse.tables[qualifiedName(table)] ?? [];
    const lines = [
      table.columns.map((c) => c.name).join(","),
      ...rows.map((row) =>
        table.columns.map((c) => field(c, row[c.name] ?? null)).join(",")
      ),
    ];
    return {
      path: `${table.layer}/${table.name}.csv`,
      table: qualifiedName(table),
      rowCount: rows.length,
      text: `${lines.join("\n")}\n`,
    };
  });
  return {
    files,
    manifest: {
      notice: SYNTHETIC_DATA_NOTICE,
      schemaVersion: schema.version,
      portfolioId: warehouse.portfolioId,
      asOf: warehouse.asOf,
      tables: schema.tables.map((table, index) => ({
        table: qualifiedName(table),
        path: files[index].path,
        rowCount: files[index].rowCount,
        primaryKey: table.primaryKey,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          classification: column.classification,
          parquet: parquetType(column),
        })),
      })),
    },
  };
}
