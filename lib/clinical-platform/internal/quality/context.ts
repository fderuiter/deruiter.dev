/**
 * What a data quality rule reads, and the edits a fault makes (#2636).
 * Rules read a warehouse through a context that indexes rows once; faults
 * return a copy of the warehouse with one table changed, so a rule can be
 * broken without touching anything else.
 */
import type { Warehouse, WarehouseRow, WarehouseValue } from "../../types";

/** Rows a rule checked and the keys of those that failed. */
export interface DqCheck {
  readonly checked: number;
  readonly failing: readonly string[];
}

/** A warehouse as rules read it. */
export interface DqContext {
  readonly asOf: string;
  rows(table: string): readonly WarehouseRow[];
  /** Rows of a table by the value of one column; the last row wins on a tie. */
  index(
    table: string,
    column: string
  ): ReadonlyMap<WarehouseValue, WarehouseRow>;
  /** Rows of a table grouped by the value of one column. */
  groups(
    table: string,
    column: string
  ): ReadonlyMap<WarehouseValue, readonly WarehouseRow[]>;
}

function tableOf(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

/** A context that indexes each table and column at most once. */
export function dqContext(warehouse: Warehouse): DqContext {
  const indexes = new Map<string, Map<WarehouseValue, WarehouseRow>>();
  const grouped = new Map<string, Map<WarehouseValue, WarehouseRow[]>>();
  return {
    asOf: warehouse.asOf,
    rows: (table) => tableOf(warehouse, table),
    index(table, column) {
      const key = `${table}#${column}`;
      let found = indexes.get(key);
      if (found === undefined) {
        found = new Map(tableOf(warehouse, table).map((r) => [r[column], r]));
        indexes.set(key, found);
      }
      return found;
    },
    groups(table, column) {
      const key = `${table}#${column}`;
      let found = grouped.get(key);
      if (found === undefined) {
        found = new Map();
        for (const row of tableOf(warehouse, table)) {
          const list = found.get(row[column]);
          if (list === undefined) found.set(row[column], [row]);
          else list.push(row);
        }
        grouped.set(key, found);
      }
      return found;
    },
  };
}

function withTable(
  warehouse: Warehouse,
  table: string,
  rows: readonly WarehouseRow[]
): Warehouse {
  return { ...warehouse, tables: { ...warehouse.tables, [table]: rows } };
}

/**
 * A copy of the warehouse with the first row of a table that matches
 * changed.
 *
 * @throws Error when no row matches, so a fault never silently does nothing.
 */
export function editRow(
  warehouse: Warehouse,
  table: string,
  match: (row: WarehouseRow) => boolean,
  change: (row: WarehouseRow) => Record<string, WarehouseValue>
): Warehouse {
  const rows = tableOf(warehouse, table);
  const at = rows.findIndex(match);
  if (at < 0) throw new Error(`no row of ${table} matches the fault`);
  const next = rows.slice();
  next[at] = { ...rows[at], ...change(rows[at]) };
  return withTable(warehouse, table, next);
}

/** A copy of the warehouse without the first row of a table that matches. */
export function dropRow(
  warehouse: Warehouse,
  table: string,
  match: (row: WarehouseRow) => boolean
): Warehouse {
  const rows = tableOf(warehouse, table);
  const at = rows.findIndex(match);
  if (at < 0) throw new Error(`no row of ${table} matches the fault`);
  return withTable(warehouse, table, [
    ...rows.slice(0, at),
    ...rows.slice(at + 1),
  ]);
}

/**
 * A copy of the warehouse with a copy of the first matching row added,
 * changed, at the end of its table.
 */
export function addRow(
  warehouse: Warehouse,
  table: string,
  match: (row: WarehouseRow) => boolean,
  change: (row: WarehouseRow) => Record<string, WarehouseValue>
): Warehouse {
  const rows = tableOf(warehouse, table);
  const source = rows.find(match);
  if (source === undefined)
    throw new Error(`no row of ${table} matches the fault`);
  return withTable(warehouse, table, [
    ...rows,
    { ...source, ...change(source) },
  ]);
}

/** The date part of an ISO 8601 date or timestamp. */
export function day(value: WarehouseValue): string | null {
  return typeof value === "string" ? value.slice(0, 10) : null;
}
