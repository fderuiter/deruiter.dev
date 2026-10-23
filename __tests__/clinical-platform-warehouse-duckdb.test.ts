// @vitest-environment node
/**
 * Executes the generated DuckDB DDL in an in-memory DuckDB and loads the
 * seeded warehouse through its CSV export (#2623). `@duckdb/node-api` is a
 * dev dependency used only here; no runtime module imports it.
 *
 * The import is static on purpose: if the native binding cannot load on a
 * platform, this file fails instead of skipping, so CI (ubuntu-latest,
 * linux-x64) can never pass without running it.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DuckDBInstance,
  version as duckdbVersion,
  type DuckDBConnection,
} from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  SCD2_OPEN_END,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  emitDdl,
  exportWarehouse,
  generatePortfolio,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const q = (id: string) => `"${id.replaceAll('"', '""')}"`;
const name = (qualified: string) => qualified.split(".").map(q).join(".");

let instance: DuckDBInstance;
let db: DuckDBConnection;
let dir: string;

async function scalar(sql: string): Promise<number> {
  const reader = await db.runAndReadAll(sql);
  return Number(reader.getRowsJson()[0][0]);
}

async function objects(sql: string) {
  return (await db.runAndReadAll(sql)).getRowObjectsJson();
}

beforeAll(async () => {
  instance = await DuckDBInstance.create(":memory:");
  db = await instance.connect();
  await db.run(emitDdl(WAREHOUSE_SCHEMA, "duckdb"));
  dir = mkdtempSync(path.join(os.tmpdir(), "warehouse-duckdb-"));
  for (const file of exportWarehouse(WAREHOUSE_SCHEMA, warehouse).files) {
    const target = path.join(dir, file.path.replace("/", "-"));
    writeFileSync(target, file.text, "utf8");
    await db.run(
      `COPY ${name(file.table)} FROM '${target.replaceAll("'", "''")}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`
    );
  }
}, 120_000);

afterAll(() => {
  db?.closeSync();
  instance?.closeSync();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("DuckDB: the generated DDL", () => {
  it("runs on the pinned native binding", () => {
    expect(duckdbVersion()).toMatch(/^v1\.5\./);
  });

  it("creates every table with every column and its description", async () => {
    for (const table of WAREHOUSE_SCHEMA.tables) {
      const columns = await objects(
        `SELECT column_name, comment, is_nullable FROM duckdb_columns() WHERE schema_name = '${table.layer}' AND table_name = '${table.name}' ORDER BY column_index`
      );
      expect(columns.map((c) => c.column_name)).toEqual(
        table.columns.map((c) => c.name)
      );
      expect(columns.map((c) => c.comment)).toEqual(
        table.columns.map((c) => c.description)
      );
      expect(columns.map((c) => c.is_nullable)).toEqual(
        table.columns.map((c) => c.nullable)
      );
    }
  });

  it("loads every row of the seeded warehouse, constraints enforced", async () => {
    for (const [table, rows] of Object.entries(warehouse.tables)) {
      expect(await scalar(`SELECT count(*) FROM ${name(table)}`), table).toBe(
        rows.length
      );
    }
    const constraints = await scalar(
      "SELECT count(*) FROM duckdb_constraints() WHERE constraint_type = 'FOREIGN KEY'"
    );
    expect(constraints).toBe(
      WAREHOUSE_SCHEMA.tables
        .flatMap((t) => t.columns)
        .filter((c) => c.references !== null).length
    );
  });

  it("rejects a fact row whose foreign key has no dimension row", async () => {
    await expect(
      db.run(
        `INSERT INTO "gold"."fct_milestone" SELECT 999, milestone_key, milestone_label, planned_date_key, actual_date_key, variance_days, is_reached, is_synthetic FROM "gold"."fct_milestone" LIMIT 1`
      )
    ).rejects.toThrow(/foreign key/i);
  });
});

describe("DuckDB: grain and keys", () => {
  it("is unique at every table's primary key and unique keys", async () => {
    for (const table of WAREHOUSE_SCHEMA.tables) {
      for (const key of [table.primaryKey, ...table.uniqueKeys]) {
        const columns = key.map(q).join(", ");
        const duplicates = await scalar(
          `SELECT count(*) FROM (SELECT ${columns} FROM ${q(table.layer)}.${q(table.name)} GROUP BY ${columns} HAVING count(*) > 1)`
        );
        expect(duplicates, `${table.name} (${key.join(", ")})`).toBe(0);
      }
    }
  });

  it("resolves every foreign key to its dimension", async () => {
    for (const table of WAREHOUSE_SCHEMA.tables) {
      for (const column of table.columns) {
        if (column.references === null) continue;
        const orphans = await scalar(
          `SELECT count(*) FROM ${q(table.layer)}.${q(table.name)} f LEFT JOIN ${name(column.references.table)} d ON f.${q(column.name)} = d.${q(column.references.column)} WHERE f.${q(column.name)} IS NOT NULL AND d.${q(column.references.column)} IS NULL`
        );
        expect(orphans, `${table.name}.${column.name}`).toBe(0);
      }
    }
  });

  it("splits finance quarters into months that add back up", async () => {
    const [spend] = await objects(
      `SELECT sum(budget_usd)::BIGINT AS budget, sum(actual_usd)::BIGINT AS actual FROM "gold"."fct_spend"`
    );
    const [finance] = await objects(
      `SELECT sum(budget_usd)::BIGINT AS budget, sum(actual_usd)::BIGINT AS actual FROM "silver"."finance_line"`
    );
    expect(spend).toEqual(finance);
  });
});

describe("DuckDB: SCD type 2 on dim_site", () => {
  it("keeps one contiguous, non-overlapping history per site", async () => {
    expect(
      await scalar(
        `SELECT count(*) FROM "gold"."dim_site" a JOIN "gold"."dim_site" b ON a.site_id = b.site_id AND a.site_key < b.site_key AND a.valid_from < b.valid_to AND b.valid_from < a.valid_to`
      )
    ).toBe(0);
    expect(
      await scalar(
        `SELECT count(*) FROM (SELECT site_id FROM "gold"."dim_site" GROUP BY site_id HAVING count(*) FILTER (WHERE is_current) <> 1)`
      )
    ).toBe(0);
    expect(
      await scalar(
        `SELECT count(*) FROM "gold"."dim_site" a LEFT JOIN "gold"."dim_site" b ON a.site_id = b.site_id AND b.version_number = a.version_number + 1 WHERE (b.site_key IS NULL AND a.valid_to <> DATE '${SCD2_OPEN_END}') OR (b.site_key IS NOT NULL AND a.valid_to <> b.valid_from)`
      )
    ).toBe(0);
  });

  it("joins every dated fact to the site version in force on its date", async () => {
    const facts: [string, string, string, string][] = [
      [
        "fct_visit",
        "edc_visit",
        "visit_id",
        "coalesce(f.visit_date_key, f.planned_date_key)",
      ],
      ["fct_query", "edc_query", "query_id", "f.opened_date_key"],
      [
        "fct_deviation",
        "ctms_deviation",
        "deviation_id",
        "f.occurred_date_key",
      ],
      [
        "fct_monitoring_visit",
        "ctms_monitoring_visit",
        "monitoring_visit_id",
        "f.visit_date_key",
      ],
      ["fct_enrollment", "edc_subject", "subject_id", "f.event_date_key"],
    ];
    for (const [fact, source, id, dateKey] of facts) {
      const [result] = await objects(
        `SELECT count(*) AS total, count(*) FILTER (WHERE d.site_key = f.site_key) AS matched
         FROM "gold".${q(fact)} f
         JOIN "silver".${q(source)} s ON s.${q(id)} = f.${q(id)}
         JOIN "gold"."dim_date" dd ON dd.date_key = ${dateKey}
         JOIN "gold"."dim_site" d ON d.site_id = s.site_id
           AND dd.calendar_date >= d.valid_from AND dd.calendar_date < d.valid_to`
      );
      expect(result.matched, fact).toBe(result.total);
      expect(Number(result.total), fact).toBe(
        warehouse.tables[`gold.${fact}`].length
      );
    }
  });

  it("gives visits before a principal investigator change the earlier investigator", async () => {
    const changes = await objects(
      `SELECT site_id, valid_from::VARCHAR AS changed_on, principal_investigator_id AS investigator
       FROM "gold"."dim_site" d
       WHERE version_number > 1 AND principal_investigator_id IS DISTINCT FROM (
         SELECT p.principal_investigator_id FROM "gold"."dim_site" p
         WHERE p.site_id = d.site_id AND p.version_number = d.version_number - 1)
       ORDER BY site_id`
    );
    expect(changes.length).toBeGreaterThan(0);
    const [split] = await objects(
      `WITH change AS (
         SELECT site_id, valid_from FROM "gold"."dim_site" d
         WHERE version_number > 1 AND principal_investigator_id IS DISTINCT FROM (
           SELECT p.principal_investigator_id FROM "gold"."dim_site" p
           WHERE p.site_id = d.site_id AND p.version_number = d.version_number - 1))
       SELECT
         count(*) FILTER (WHERE dd.calendar_date < c.valid_from AND ds.principal_investigator_id LIKE '%-1') AS before_ok,
         count(*) FILTER (WHERE dd.calendar_date < c.valid_from) AS before_all,
         count(*) FILTER (WHERE dd.calendar_date >= c.valid_from AND ds.principal_investigator_id LIKE '%-2') AS after_ok,
         count(*) FILTER (WHERE dd.calendar_date >= c.valid_from) AS after_all
       FROM "gold"."fct_visit" f
       JOIN "gold"."dim_site" ds ON ds.site_key = f.site_key
       JOIN change c ON c.site_id = ds.site_id
       JOIN "gold"."dim_date" dd ON dd.date_key = f.visit_date_key`
    );
    expect(Number(split.before_all)).toBeGreaterThan(0);
    expect(Number(split.after_all)).toBeGreaterThan(0);
    expect(split.before_ok).toBe(split.before_all);
    expect(split.after_ok).toBe(split.after_all);
  });
});
