/**
 * Warehouse integrity checks in plain TypeScript: the same invariants the
 * DuckDB test asserts in SQL, so they hold without a database.
 */
import { SCD2_OPEN_END } from "../../presets";
import type {
  Warehouse,
  WarehouseColumn,
  WarehouseFinding,
  WarehouseSchema,
  WarehouseTable,
  WarehouseValue,
} from "../../types";
import { qualifiedName } from "./schema";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * Whether text is a calendar date written `YYYY-MM-DD`.
 *
 * @param value - Text to test.
 * @returns `true` for a real date, such as `2026-02-28` but not `2026-02-30`.
 */
export function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(value);
}

/** Whether a non-null value fits a column's logical type. */
function fitsType(column: WarehouseColumn, value: WarehouseValue): boolean {
  switch (column.type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        Math.abs(value) <= 2_147_483_647
      );
    case "decimal": {
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      const scale = column.scale ?? 0;
      const digits = (column.precision ?? 18) - scale;
      return (
        Math.abs(value) < 10 ** digits &&
        Math.abs(Math.round(value * 10 ** scale) - value * 10 ** scale) < 1e-6
      );
    }
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && validDate(value);
    case "timestamp":
      return (
        typeof value === "string" &&
        TIMESTAMP.test(value) &&
        validDate(value.slice(0, 10))
      );
  }
}

function keyOf(
  row: Readonly<Record<string, WarehouseValue>>,
  columns: readonly string[]
): string {
  return JSON.stringify(columns.map((name) => row[name]));
}

function checkRows(
  table: WarehouseTable,
  rows: readonly Readonly<Record<string, WarehouseValue>>[],
  findings: WarehouseFinding[]
): void {
  const name = qualifiedName(table);
  const known = new Set(table.columns.map((c) => c.name));
  rows.forEach((row, index) => {
    for (const column of Object.keys(row)) {
      if (!known.has(column)) {
        findings.push({
          rule: "column",
          table: name,
          message: `row ${index} has unknown column ${column}.`,
        });
      }
    }
    for (const column of table.columns) {
      const value = row[column.name];
      if (value === undefined) {
        findings.push({
          rule: "column",
          table: name,
          message: `row ${index} lacks ${column.name}.`,
        });
      } else if (value === null) {
        if (!column.nullable) {
          findings.push({
            rule: "nullability",
            table: name,
            message: `row ${index} has null in ${column.name}.`,
          });
        }
      } else if (!fitsType(column, value)) {
        findings.push({
          rule: "type",
          table: name,
          message: `row ${index} has ${JSON.stringify(value)} in ${column.type} column ${column.name}.`,
        });
      } else if (
        column.length !== null &&
        typeof value === "string" &&
        value.length > column.length
      ) {
        findings.push({
          rule: "length",
          table: name,
          message: `row ${index} exceeds ${column.length} characters in ${column.name}.`,
        });
      }
    }
  });
}

function checkUnique(
  table: WarehouseTable,
  rows: readonly Readonly<Record<string, WarehouseValue>>[],
  columns: readonly string[],
  rule: "grain" | "unique",
  findings: WarehouseFinding[]
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = keyOf(row, columns);
    if (seen.has(key)) {
      findings.push({
        rule,
        table: qualifiedName(table),
        message: `(${columns.join(", ")}) = ${key} appears more than once.`,
      });
    }
    seen.add(key);
  }
}

function checkScd2(
  table: WarehouseTable,
  rows: readonly Readonly<Record<string, WarehouseValue>>[],
  findings: WarehouseFinding[]
): void {
  const scd = table.scd2;
  if (scd === null) return;
  const members = new Map<
    WarehouseValue,
    Readonly<Record<string, WarehouseValue>>[]
  >();
  for (const row of rows) {
    const member = row[scd.naturalKey];
    members.set(member, [...(members.get(member) ?? []), row]);
  }
  for (const [member, versions] of members) {
    const ordered = [...versions].sort((a, b) =>
      String(a[scd.validFrom]) < String(b[scd.validFrom]) ? -1 : 1
    );
    const fail = (message: string) =>
      findings.push({
        rule: "scd2",
        table: qualifiedName(table),
        message: `${String(member)}: ${message}`,
      });
    ordered.forEach((row, index) => {
      const isLast = index === ordered.length - 1;
      if (row[scd.version] !== index + 1)
        fail(`version ${String(row[scd.version])} is out of sequence.`);
      if (String(row[scd.validFrom]) >= String(row[scd.validTo]))
        fail(`version ${index + 1} has an empty range.`);
      if (row[scd.isCurrent] !== isLast)
        fail(`version ${index + 1} has the wrong current flag.`);
      if (isLast) {
        if (row[scd.validTo] !== SCD2_OPEN_END)
          fail(`the latest version does not end at ${SCD2_OPEN_END}.`);
      } else {
        const next = ordered[index + 1];
        if (row[scd.validTo] !== next[scd.validFrom])
          fail(
            `version ${index + 1} does not end where version ${index + 2} starts.`
          );
        if (scd.trackedColumns.every((c) => row[c] === next[c]))
          fail(`version ${index + 2} changes no tracked column.`);
      }
    });
  }
}

/**
 * Checks that each row reaches its table's date sequences in order: a
 * column holds a date only when the column before it does, on or before it.
 */
function checkSequences(
  table: WarehouseTable,
  rows: readonly Readonly<Record<string, WarehouseValue>>[],
  findings: WarehouseFinding[]
): void {
  const name = qualifiedName(table);
  for (const sequence of table.sequences) {
    for (const row of rows) {
      for (let i = 1; i < sequence.length; i += 1) {
        const [before, after] = [row[sequence[i - 1]], row[sequence[i]]];
        if (after === null || after === undefined) continue;
        if (before === null || before === undefined || before > after) {
          findings.push({
            rule: "sequence",
            table: name,
            message: `${sequence[i]} = ${JSON.stringify(after)} without ${sequence[i - 1]} on or before it (${JSON.stringify(before ?? null)}).`,
          });
        }
      }
    }
  }
}

/**
 * Checks a warehouse against its schema: every table and column present,
 * every value of its column's type, nullability and length, one row per
 * declared grain, unique natural keys, every foreign key resolving to its
 * dimension, SCD type 2 versions that are numbered, contiguous and
 * non-overlapping with one current version per member, and date sequences
 * reached in order.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @param warehouse - Rows from `buildWarehouse`.
 * @returns Findings; empty when every invariant holds.
 */
export function checkWarehouse(
  schema: WarehouseSchema,
  warehouse: Warehouse
): WarehouseFinding[] {
  const findings: WarehouseFinding[] = [];
  const declared = new Set(schema.tables.map(qualifiedName));
  for (const name of Object.keys(warehouse.tables)) {
    if (!declared.has(name)) {
      findings.push({
        rule: "table",
        table: name,
        message: "table is not in the schema.",
      });
    }
  }
  for (const table of schema.tables) {
    const name = qualifiedName(table);
    const rows = warehouse.tables[name];
    if (rows === undefined) {
      findings.push({
        rule: "table",
        table: name,
        message: "table has no rows entry.",
      });
      continue;
    }
    checkRows(table, rows, findings);
    checkUnique(table, rows, table.primaryKey, "grain", findings);
    for (const unique of table.uniqueKeys) {
      checkUnique(table, rows, unique, "unique", findings);
    }
    checkScd2(table, rows, findings);
    checkSequences(table, rows, findings);
    for (const column of table.columns) {
      const ref = column.references;
      if (ref === null) continue;
      const target = new Set(
        (warehouse.tables[ref.table] ?? []).map((r) => r[ref.column])
      );
      for (const row of rows) {
        const value = row[column.name];
        if (value !== null && value !== undefined && !target.has(value)) {
          findings.push({
            rule: "foreign-key",
            table: name,
            message: `${column.name} = ${JSON.stringify(value)} has no row in ${ref.table}.`,
          });
        }
      }
    }
  }
  return findings;
}
