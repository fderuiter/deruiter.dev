// @vitest-environment node
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  WAREHOUSE_SCHEMA,
  WORKBENCH_DIALECTS,
  WORKBENCH_ENGINE_SETTINGS,
  buildWarehouse,
  checkRegulatoryWording,
  checkWorkbenchSql,
  dataContracts,
  dataProducts,
  findClinicalClaims,
  generatePortfolio,
  workbenchQueries,
  workbenchSchema,
  type DataContract,
  type WorkbenchSqlFinding,
} from "@/lib/clinical-platform";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const run = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 24 });
const products = dataProducts(run);
const contracts = dataContracts(run);
const schema = workbenchSchema(products, contracts, warehouse);
const queries = workbenchQueries(warehouse.asOf);
const gold = WAREHOUSE_SCHEMA.tables.filter((t) => t.layer === "gold");

const rules = (sql: string) =>
  checkWorkbenchSql(sql).map((f: WorkbenchSqlFinding) => f.rule);

describe("workbench schema", () => {
  it("loads every gold table, in schema order, and nothing else", () => {
    expect(schema.map((t) => t.name)).toEqual(
      gold.map((t) => `${t.layer}.${t.name}`)
    );
  });

  it("describes each table and column from its data contract", () => {
    for (const table of schema) {
      const contract = contracts.find((c) => c.productId === table.name);
      const product = products.find((p) => p.id === table.name);
      const [object] = contract?.objects ?? [];
      expect(table.columns).toEqual(
        object.columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          description: c.description,
          classification: c.classification,
        }))
      );
      expect(table).toMatchObject({
        description: object.description,
        grain: object.grain,
        primaryKey: object.primaryKey,
        owner: product?.owner,
        steward: product?.steward,
        classification: product?.classification,
        personalHealthData: product?.personalHealthData,
        contractVersion: contract?.version,
      });
      expect(table.rowCount).toBe(warehouse.tables[table.name].length);
      expect(table.rowCount, table.name).toBeGreaterThan(0);
    }
  });

  it("shows the governance a reviewer checks: owners and classifications", () => {
    const enrollment = schema.find((t) => t.name === "gold.fct_enrollment");
    expect(enrollment).toMatchObject({
      kind: "fact",
      owner: "Clinical Operations Lead",
      classification: "confidential",
      personalHealthData: true,
    });
    expect(
      enrollment?.columns.find((c) => c.name === "subject_id")?.classification
    ).toBe("confidential");
    expect(
      schema.flatMap((t) => t.columns).map((c) => c.classification)
    ).not.toContain("restricted");
  });

  it("refuses a restricted column rather than show it to every visitor", () => {
    const restricted: DataContract[] = contracts.map((c) =>
      c.productId === "gold.fct_spend"
        ? {
            ...c,
            objects: c.objects.map((o) => ({
              ...o,
              columns: o.columns.map((col) =>
                col.name === "budget_usd"
                  ? { ...col, classification: "restricted" as const }
                  : col
              ),
            })),
          }
        : c
    );
    expect(() => workbenchSchema(products, restricted, warehouse)).toThrow(
      "gold.fct_spend.budget_usd is restricted, and the workbench shows every column to every visitor"
    );
  });

  it("refuses a gold table with no contract", () => {
    const missing = contracts.filter((c) => c.productId !== "gold.dim_date");
    expect(() => workbenchSchema(products, missing, warehouse)).toThrow(
      "gold.dim_date has no data product or contract"
    );
  });
});

describe("saved query library", () => {
  it("holds the four worked examples, then one query per governed metric", () => {
    expect(
      queries.filter((q) => q.kind === "example").map((q) => q.id)
    ).toEqual([
      "open-query-aging",
      "enrollment-against-plan",
      "milestone-lifecycle",
      "deviation-site-as-of",
    ]);
    expect(
      queries.filter((q) => q.kind === "metric").map((q) => q.metricId)
    ).toEqual(METRIC_REGISTRY.map((m) => m.id));
    expect(new Set(queries.map((q) => q.id)).size).toBe(queries.length);
    for (const q of queries) expect(q.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("shows each technique the issue asks for", () => {
    const techniques = new Set(queries.flatMap((q) => q.techniques));
    for (const technique of [
      "window functions",
      "common table expressions",
      "recursive common table expressions",
      "slowly changing dimension type 2",
    ]) {
      expect(techniques).toContain(technique);
    }
    expect(queries.find((q) => q.id === "milestone-lifecycle")?.sql).toMatch(
      /WITH RECURSIVE/
    );
    expect(queries.find((q) => q.id === "open-query-aging")?.sql).toMatch(
      /OVER \(PARTITION BY/
    );
  });

  it("names only gold tables that exist, and every table a query reads", () => {
    const names = new Set(gold.map((t) => `${t.layer}.${t.name}`));
    for (const q of queries) {
      expect(q.tables.length, q.id).toBeGreaterThan(0);
      for (const t of q.tables)
        expect(names.has(t), `${q.id}: ${t}`).toBe(true);
      const read = new Set(
        [...q.sql.matchAll(/"?gold"?\."?(\w+)"?/g)].map((m) => `gold.${m[1]}`)
      );
      expect([...read].sort(), q.id).toEqual([...q.tables].sort());
    }
  });

  it("gives every metric query its SQL in all three dialects, grouped by study", () => {
    expect(WORKBENCH_DIALECTS).toEqual(["duckdb", "postgres", "tsql"]);
    for (const q of queries.filter((q) => q.kind === "metric")) {
      expect(Object.keys(q.dialects ?? {}), q.id).toEqual([
        "duckdb",
        "postgres",
        "tsql",
      ]);
      expect(q.sql).toBe(q.dialects?.duckdb);
      expect(q.dialects?.postgres).toMatch(/^-- .*PostgreSQL\./);
      expect(q.dialects?.tsql).toMatch(/^-- .*T-SQL\./);
      expect(q.dimensions).toEqual(["study"]);
      expect(q.sql).toMatch(/Grouped by: study\./);
    }
    for (const q of queries.filter((q) => q.kind === "example")) {
      expect(q.dialects).toBeNull();
      expect(q.metricId).toBeNull();
      expect(q.dimensions).toEqual([]);
    }
  });

  it("writes the data cut into the queries that measure age at the cut", () => {
    const aging = (cut: string) =>
      workbenchQueries(cut).find((q) => q.id === "open-query-aging")?.sql;
    expect(aging("2026-09-30")).toContain("DATE '2026-09-30'");
    expect(aging("2026-06-30")).toContain("DATE '2026-06-30'");
    expect(
      workbenchQueries("2026-06-30").find(
        (q) => q.metricId === "query_aging_mean"
      )?.sql
    ).toContain("DATE '2026-06-30'");
  });

  it("rejects a data cut that is not a date", () => {
    for (const bad of ["", "2026-9-30", "2026-02-30", "30/09/2026"]) {
      expect(() => workbenchQueries(bad)).toThrow(RangeError);
    }
  });

  it("makes no compliance or validation claim in its copy", () => {
    for (const q of queries) {
      const copy = `${q.title} ${q.description} ${q.techniques.join(" ")}`;
      expect(checkRegulatoryWording(copy), q.id).toEqual([]);
      expect(findClinicalClaims(copy), q.id).toEqual([]);
    }
  });
});

describe("statement check", () => {
  it.each([
    "SELECT 1",
    "select * from gold.dim_study;",
    "  WITH x AS (SELECT 1) SELECT * FROM x  ;  ",
    "FROM gold.dim_study",
    "EXPLAIN SELECT * FROM gold.fct_query",
    "DESCRIBE gold.fct_visit",
    "SUMMARIZE gold.fct_visit",
    "SHOW TABLES",
    "VALUES (1), (2)",
    "(SELECT 1) UNION ALL (SELECT 2)",
    "-- a comment\nSELECT 1 -- trailing",
    "/* block\ncomment */ SELECT 1",
    "SELECT 'DROP TABLE x; DELETE FROM y' AS text",
    'SELECT 1 AS "update", 2 AS "read_csv"',
    "SELECT $$ COPY x TO 'y' $$",
    "SELECT * FROM gold.fct_query WHERE queried_field = 'DM.BRTHDTC'",
  ])("accepts %j", (sql) => {
    expect(checkWorkbenchSql(sql)).toEqual([]);
  });

  it.each([
    ["", ["empty"]],
    [" ;; -- nothing\n", ["empty"]],
    ["SELECT 'open", ["unterminated"]],
    ['SELECT "open', ["unterminated"]],
    ["SELECT 1 /* open", ["unterminated"]],
    ["SELECT $$ open", ["unterminated"]],
    ["SELECT 1; SELECT 2", ["multiple-statements"]],
    ["DROP TABLE gold.dim_study", ["not-a-query", "forbidden-keyword"]],
    ["delete from gold.fct_query", ["not-a-query", "forbidden-keyword"]],
    [
      "WITH x AS (SELECT 1) INSERT INTO gold.dim_date SELECT * FROM x",
      ["forbidden-keyword"],
    ],
    [
      "SELECT 1; DROP TABLE gold.dim_study",
      ["multiple-statements", "forbidden-keyword"],
    ],
    ["SET enable_external_access = true", ["not-a-query", "forbidden-keyword"]],
    ["SELECT * FROM read_csv('x.csv')", ["external-read"]],
    ["SELECT * FROM READ_PARQUET ('s3://bucket/x')", ["external-read"]],
    ["SELECT * FROM 'https://example.com/x.csv'", ["external-read"]],
    [
      "SELECT * FROM gold.dim_study JOIN 'x.parquet' USING (study_id)",
      ["external-read"],
    ],
    ["SELECT * FROM glob('*')", ["external-read"]],
    ["SELECT * FROM query('SELECT 1')", ["external-read"]],
    ["COPY (SELECT 1) TO 'out.csv'", ["not-a-query", "forbidden-keyword"]],
    ["1 + 1", ["not-a-query"]],
  ] as const)("refuses %j", (sql, expected) => {
    expect(rules(sql)).toEqual(expected);
  });

  it("reports each forbidden word once, with a message a visitor can act on", () => {
    const findings = checkWorkbenchSql(
      "UPDATE a SET b = 1 WHERE c IN (UPDATE d SET e = 2)"
    );
    expect(findings).toEqual([
      {
        rule: "not-a-query",
        message:
          "The workbench runs queries only: start with SELECT, WITH, FROM, VALUES, EXPLAIN, DESCRIBE, SUMMARIZE or SHOW.",
      },
      {
        rule: "forbidden-keyword",
        message:
          "UPDATE changes data, the schema or the engine. The warehouse is read-only.",
      },
      {
        rule: "forbidden-keyword",
        message:
          "SET changes data, the schema or the engine. The warehouse is read-only.",
      },
    ]);
  });

  it("never mistakes text inside a string or quoted name for SQL", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const literal = `'${text.replaceAll("'", "''")}'`;
        const name = `"${text.replaceAll('"', '""')}"`;
        return (
          checkWorkbenchSql(`SELECT ${literal}`).length === 0 &&
          checkWorkbenchSql(`SELECT 1 AS ${name}`).length === 0
        );
      }),
      { numRuns: 300, seed: 2633 }
    );
  });

  it("locks the engine configuration after closing external access", () => {
    expect(WORKBENCH_ENGINE_SETTINGS[0]).toBe(
      "SET enable_external_access = false"
    );
    expect(WORKBENCH_ENGINE_SETTINGS.at(-1)).toBe(
      "SET lock_configuration = true"
    );
  });
});
