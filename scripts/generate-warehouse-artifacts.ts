/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WAREHOUSE_SCHEMA,
  emitDdl,
  renderWarehouseReference,
  type SqlDialect,
} from "../lib/clinical-platform";

/**
 * Writes the files generated from the Clinical Data Platform's warehouse
 * schema (#2623): the golden DDL per SQL dialect and the star schema
 * reference page with its ERD. `__tests__/clinical-platform-warehouse.test.ts`
 * regenerates each one and fails when the checked-in copy differs, so run
 * this after changing `WAREHOUSE_SCHEMA` and commit the result.
 */

/** DDL golden files, relative to the workspace root. */
export const WAREHOUSE_DDL_GOLDENS: Readonly<Record<SqlDialect, string>> = {
  duckdb: "__tests__/fixtures/clinical-platform/warehouse.duckdb.sql",
  postgres: "__tests__/fixtures/clinical-platform/warehouse.postgres.sql",
  tsql: "__tests__/fixtures/clinical-platform/warehouse.tsql.sql",
};

/** Star schema reference page, relative to the workspace root. */
export const WAREHOUSE_REFERENCE_PAGE =
  "docs/reference/clinical-platform-star-schema.md";

/** Every generated file and its expected contents, by relative path. */
export function warehouseArtifacts(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [dialect, file] of Object.entries(WAREHOUSE_DDL_GOLDENS)) {
    files[file] = emitDdl(WAREHOUSE_SCHEMA, dialect as SqlDialect);
  }
  files[WAREHOUSE_REFERENCE_PAGE] = renderWarehouseReference(WAREHOUSE_SCHEMA);
  return files;
}

/** Writes every generated file under the workspace root. */
export function writeWarehouseArtifacts(workspaceRoot: string): string[] {
  return Object.entries(warehouseArtifacts()).map(([relative, contents]) => {
    const file = path.join(workspaceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
    return relative;
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  for (const file of writeWarehouseArtifacts(process.cwd())) {
    console.log(`Generated ${file}`);
  }
}
