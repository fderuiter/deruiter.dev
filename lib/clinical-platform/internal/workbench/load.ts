/**
 * How the SQL workbench's engine becomes the warehouse (#2633): the gold
 * tables' DDL, each table's rows as a CSV file and the statement that
 * copies it in, then the settings that close the database. Bronze and
 * silver are left out, as the schema browser leaves them out, so every
 * table a visitor can list holds rows.
 */
import type { Warehouse, WorkbenchLoad, WorkbenchLoadFile } from "../../types";
import { emitDdl } from "../warehouse/ddl";
import { exportWarehouse } from "../warehouse/export";
import { WAREHOUSE_SCHEMA } from "../warehouse/schema";
import { WORKBENCH_ENGINE_SETTINGS } from "./guard";

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

/**
 * The statements and files that load the gold layer into DuckDB, in order:
 * run `ddl`, register each file's text under its `fileName` and run its
 * `copy`, then run each of `settings`. Running the settings last means no
 * later statement can reopen file, network or extension access.
 *
 * @param warehouse - Rows from `buildWarehouse`.
 * @returns The load, in schema order.
 */
export function workbenchLoad(warehouse: Warehouse): WorkbenchLoad {
  const gold = {
    ...WAREHOUSE_SCHEMA,
    tables: WAREHOUSE_SCHEMA.tables.filter((table) => table.layer === "gold"),
  };
  const files = exportWarehouse(gold, warehouse).files.map(
    (file): WorkbenchLoadFile => {
      const fileName = `${file.table.replace(".", "-")}.csv`;
      return {
        table: file.table,
        fileName,
        text: file.text,
        copy: `COPY ${file.table.split(".").map(quote).join(".")} FROM '${fileName}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`,
      };
    }
  );
  return {
    ddl: emitDdl(gold, "duckdb"),
    files,
    settings: WORKBENCH_ENGINE_SETTINGS,
  };
}
