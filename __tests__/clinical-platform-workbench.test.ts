// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  MAX_WORKBENCH_STORAGE_BYTES,
  METRIC_REGISTRY,
  WAREHOUSE_SCHEMA,
  WORKBENCH_BUNDLE_FORMAT,
  WORKBENCH_BUNDLE_MAX_TABS,
  WORKBENCH_BUNDLE_VERSION,
  WORKBENCH_DIALECTS,
  WORKBENCH_ENGINE_SETTINGS,
  WORKBENCH_HASH_MAX_LENGTH,
  buildWarehouse,
  checkRegulatoryWording,
  checkWorkbenchSql,
  dataContracts,
  dataProducts,
  decodeWorkbenchPermalink,
  encodeWorkbenchPermalink,
  findClinicalClaims,
  generatePortfolio,
  mergeWorkbenchHydratedDatasets,
  parseWorkbenchBundle,
  parseWorkbenchDataset,
  sanitizeDatasetTableName,
  serializeWorkbenchBundle,
  workbenchDatasetLoad,
  workbenchDatasetTable,
  workbenchHydratedDataset,
  workbenchQueries,
  workbenchResultCsv,
  workbenchResultJson,
  workbenchResultParquet,
  workbenchSchema,
  type DataContract,
  type WorkbenchResult,
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

describe("result exports (CSV, JSON, Parquet)", () => {
  const sampleResult: WorkbenchResult = {
    columns: [
      { name: "study_id", type: "Text", numeric: false },
      { name: "subjects", type: "Int32", numeric: true },
      { name: "visit_seq", type: "Int64", numeric: true },
      { name: "rate", type: "Double", numeric: true },
      { name: "amount", type: "Decimal(12,2)", numeric: true },
      { name: "active", type: "Boolean", numeric: false },
      { name: "study_id", type: "Text", numeric: false },
    ],
    rows: [
      [
        "DEMO-301",
        "24",
        "9007199254740993",
        "0.875",
        "1250.50",
        "true",
        "dup-a",
      ],
      ["DEMO-302", null, "12", null, "-0.05", "false", null],
    ],
    rowCount: 2,
    truncated: false,
    elapsedMs: 4.2,
  };

  it("exports CSV, JSON and Parquet from the same result", () => {
    const csv = workbenchResultCsv(sampleResult);
    expect(csv).toContain(
      "study_id,subjects,visit_seq,rate,amount,active,study_id\r\n"
    );

    const json = JSON.parse(workbenchResultJson(sampleResult)) as Record<
      string,
      unknown
    >[];
    expect(json).toEqual([
      {
        study_id: "DEMO-301",
        subjects: 24,
        visit_seq: "9007199254740993",
        rate: 0.875,
        amount: "1250.50",
        active: true,
        study_id_2: "dup-a",
      },
      {
        study_id: "DEMO-302",
        subjects: null,
        visit_seq: 12,
        rate: null,
        amount: "-0.05",
        active: false,
        study_id_2: null,
      },
    ]);

    const parquet = workbenchResultParquet(sampleResult);
    expect(new TextDecoder().decode(parquet.subarray(0, 4))).toBe("PAR1");
    expect(new TextDecoder().decode(parquet.subarray(parquet.length - 4))).toBe(
      "PAR1"
    );

    const parsed = parseWorkbenchDataset({
      fileName: "exported.parquet",
      bytes: parquet,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.dataset.format).toBe("parquet");
    expect(parsed.dataset.rowCount).toBeNull();
    expect(parsed.dataset.columns).toEqual([]);
  });

  it("exports wide and empty Parquet results cleanly", () => {
    const wideColumns = Array.from({ length: 18 }, (_, i) => ({
      name: i === 0 ? "" : `col_${i}`,
      type: i % 2 === 0 ? "Int32" : "Text",
      numeric: i % 2 === 0,
    }));
    const empty: WorkbenchResult = {
      columns: wideColumns,
      rows: [],
      rowCount: 0,
      truncated: false,
      elapsedMs: 1,
    };
    const emptyParquet = workbenchResultParquet(empty);
    const parsedEmpty = parseWorkbenchDataset({
      fileName: "empty.parquet",
      bytes: emptyParquet,
    });
    expect(parsedEmpty.ok).toBe(true);
    if (parsedEmpty.ok) {
      expect(parsedEmpty.dataset.format).toBe("parquet");
      expect(parsedEmpty.dataset.byteLength).toBe(emptyParquet.byteLength);
    }
    expect(JSON.parse(workbenchResultJson(empty))).toEqual([]);
  });

  it("produces valid PAR1 framing for arbitrary result rows", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.option(fc.string({ maxLength: 24 }), { nil: null }),
            fc.option(fc.integer({ min: -100_000, max: 100_000 }), {
              nil: null,
            }),
            fc.option(fc.boolean(), { nil: null })
          ),
          { minLength: 0, maxLength: 25 }
        ),
        (tuples) => {
          const res: WorkbenchResult = {
            columns: [
              { name: "label", type: "Text", numeric: false },
              { name: "n", type: "Int32", numeric: true },
              { name: "flag", type: "Boolean", numeric: false },
            ],
            rows: tuples.map(([s, n, b]) => [
              s,
              n === null ? null : String(n),
              b === null ? null : String(b),
            ]),
            rowCount: tuples.length,
            truncated: false,
            elapsedMs: 1,
          };
          const bytes = workbenchResultParquet(res);
          const back = parseWorkbenchDataset({
            fileName: "prop.parquet",
            bytes,
          });
          return back.ok && back.dataset.format === "parquet";
        }
      ),
      { numRuns: 60, seed: 4242 }
    );
  });
});

describe("local dataset ingestion (uploads.*)", () => {
  const utf8 = (text: string) => new TextEncoder().encode(text);

  it("sanitizes arbitrary file names into clean uploads identifiers", () => {
    expect(sanitizeDatasetTableName("Site Audit 2026.CSV")).toBe(
      "site_audit_2026"
    );
    expect(sanitizeDatasetTableName("301-monitoring.parquet")).toBe(
      "t_301_monitoring"
    );
    expect(sanitizeDatasetTableName("   .json")).toBe("dataset");
  });

  it("registers original buffers under their real extension and maps DESCRIBE + count(*) into the schema browser", () => {
    const csvBytes = utf8(
      'site_id,active,enrolled\r\n"SITE-01",true,14\r\n"SITE-02",false,\r\n'
    );
    const csv = parseWorkbenchDataset({
      fileName: "Site Roster.csv",
      bytes: csvBytes,
    });
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(csv.dataset.qualifiedName).toBe("uploads.site_roster");
    expect(csv.dataset.rowCount).toBeNull();
    expect(csv.dataset.columns).toEqual([]);

    const csvLoad = workbenchDatasetLoad(csv.dataset);
    expect(csvLoad.fileName).toBe("uploads-site_roster.csv");
    expect(csvLoad.buffer).toEqual(csv.dataset.bytes);
    expect(csvLoad.buffer.buffer).not.toBe(csv.dataset.bytes.buffer);
    expect(csvLoad.create).toContain('CREATE SCHEMA IF NOT EXISTS "uploads"');
    expect(csvLoad.create).toContain(
      `CREATE TABLE "uploads"."site_roster" AS SELECT * FROM read_csv('uploads-site_roster.csv', header = true, delim = ',', quote = '"', escape = '"', allow_quoted_nulls = false, strict_mode = true)`
    );
    expect(csvLoad.describe).toBe('DESCRIBE "uploads"."site_roster"');
    expect(csvLoad.count).toBe(
      'SELECT count(*) AS n FROM "uploads"."site_roster"'
    );

    const ndjson = parseWorkbenchDataset({
      fileName: "events.ndjson",
      bytes: utf8('{"k":"a","n":1}\n{"k":"b","n":2}\n'),
    });
    expect(ndjson.ok).toBe(true);
    if (ndjson.ok) {
      const ndjsonLoad = workbenchDatasetLoad(ndjson.dataset);
      expect(ndjsonLoad.fileName).toBe("uploads-events.ndjson");
      expect(ndjsonLoad.create).toContain(
        `read_json('uploads-events.ndjson', format = 'auto', records = 'auto')`
      );
    }

    const parquetMagicOnly = parseWorkbenchDataset({
      fileName: "unnamed_upload",
      bytes: utf8("PAR1____PAR1"),
    });
    expect(parquetMagicOnly.ok).toBe(true);
    if (parquetMagicOnly.ok) {
      expect(parquetMagicOnly.dataset.format).toBe("parquet");
      const pqLoad = workbenchDatasetLoad(parquetMagicOnly.dataset);
      expect(pqLoad.fileName).toBe("uploads-unnamed_upload.parquet");
      expect(pqLoad.create).toContain(
        `read_parquet('uploads-unnamed_upload.parquet')`
      );
    }

    // Hydrate DESCRIBE + count(*) metadata onto the dataset and build its schema table.
    const hydrated = workbenchHydratedDataset(
      "uploads.site_roster",
      [
        ["site_id", "VARCHAR", "NO"],
        ["active", "BOOLEAN", "YES"],
        ["enrolled", "INTEGER", "YES"],
        ["rate", "DECIMAL(10,2)", "YES"],
        ["opened_on", "DATE", "NO"],
        ["logged_at", "TIMESTAMP WITH TIME ZONE", "YES"],
        ["cutoff_time", "TIME", "YES"],
        ["meta", "STRUCT(lead VARCHAR, tier INTEGER)", "YES"],
      ],
      2
    );
    const [merged] = mergeWorkbenchHydratedDatasets([csv.dataset], [hydrated]);
    expect(merged.rowCount).toBe(2);
    expect(merged.columns).toHaveLength(8);

    const schemaEntry = workbenchDatasetTable(merged);
    expect(schemaEntry.name).toBe("uploads.site_roster");
    expect(schemaEntry.owner).toBe("Local browser session");
    expect(schemaEntry.rowCount).toBe(2);
    expect(
      schemaEntry.columns.map((c) => [c.name, c.type, c.nullable])
    ).toEqual([
      ["site_id", "string", false],
      ["active", "boolean", true],
      ["enrolled", "integer", true],
      ["rate", "decimal", true],
      ["opened_on", "date", false],
      ["logged_at", "timestamp", true],
      ["cutoff_time", "time", true],
      ["meta", "string", true],
    ]);
  });

  it("keeps cheap checks in parseWorkbenchDataset: empty file, >50 MB cap, extension and PAR1 magic at both ends", () => {
    expect(
      parseWorkbenchDataset({ fileName: "empty.csv", bytes: new Uint8Array(0) })
    ).toEqual({ ok: false, error: "The uploaded file is empty." });

    expect(
      parseWorkbenchDataset({
        fileName: "blank.json",
        bytes: utf8("\uFEFF   \r\n\t "),
      })
    ).toEqual({ ok: false, error: "The uploaded file is empty." });

    expect(
      parseWorkbenchDataset({
        fileName: "notes.txt",
        bytes: utf8("hello"),
      }).ok
    ).toBe(false);

    // Missing PAR1 trailer or header fails the cheap magic check.
    expect(
      parseWorkbenchDataset({
        fileName: "broken.parquet",
        bytes: utf8("NOT_A_PARQUET_FILE"),
      }).ok
    ).toBe(false);

    expect(
      parseWorkbenchDataset({
        fileName: "truncated.parquet",
        bytes: utf8("PAR1____NOPE"),
      }).ok
    ).toBe(false);

    expect(
      parseWorkbenchDataset({
        fileName: "tiny.parquet",
        bytes: utf8("PAR1PAR1"),
      }).ok
    ).toBe(false);

    const fakeOversize = fromPartial<Uint8Array>({
      byteLength: MAX_WORKBENCH_STORAGE_BYTES + 1,
    });
    const over = parseWorkbenchDataset({
      fileName: "huge.csv",
      bytes: fakeOversize,
    });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error).toMatch(/50 MB/);
    }
  });
});

describe("notebook bundles (.sql.json) and #sql=... permalinks", () => {
  it("serializes and parses a multi-tab .sql.json bundle with named queries", () => {
    const serialized = serializeWorkbenchBundle({
      activeTabId: "tab-2",
      exportedAt: "2026-10-01T12:00:00.000Z",
      tabs: [
        {
          id: "tab-1",
          title: "Studies",
          sql: "SELECT study_id FROM gold.dim_study",
          selectedQueryId: "",
          updatedAt: "2026-10-01T11:55:00.000Z",
        },
        {
          id: "tab-2",
          title: "Open queries",
          sql: queries[0].sql,
          selectedQueryId: queries[0].id,
          updatedAt: "2026-10-01T11:58:00.000Z",
        },
      ],
      namedQueries: [
        {
          id: "named-1",
          title: "Site count",
          sql: "SELECT count(*) AS sites FROM gold.dim_site",
          savedAt: "2026-10-01T11:59:00.000Z",
        },
      ],
    });
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(serialized.bundle.format).toBe(WORKBENCH_BUNDLE_FORMAT);
    expect(serialized.bundle.version).toBe(WORKBENCH_BUNDLE_VERSION);

    const parsed = parseWorkbenchBundle(serialized.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle).toEqual(serialized.bundle);
  });

  it("refuses malformed bundles and any tab or saved query with forbidden SQL", () => {
    expect(parseWorkbenchBundle("{bad json").ok).toBe(false);
    expect(parseWorkbenchBundle("[]").ok).toBe(false);
    expect(
      parseWorkbenchBundle(
        JSON.stringify({ format: "other", version: 1, tabs: [] })
      ).ok
    ).toBe(false);
    expect(
      parseWorkbenchBundle(
        JSON.stringify({
          format: WORKBENCH_BUNDLE_FORMAT,
          version: 99,
          exportedAt: "2026-10-01T00:00:00Z",
          activeTabId: "t1",
          tabs: [{ id: "t1", title: "T", sql: "SELECT 1" }],
        })
      ).ok
    ).toBe(false);

    const withDrop = JSON.stringify({
      format: WORKBENCH_BUNDLE_FORMAT,
      version: WORKBENCH_BUNDLE_VERSION,
      exportedAt: "2026-10-01T00:00:00Z",
      activeTabId: "t1",
      tabs: [
        { id: "t1", title: "Malicious", sql: "DROP TABLE gold.dim_study" },
      ],
    });
    const refusedTab = parseWorkbenchBundle(withDrop);
    expect(refusedTab.ok).toBe(false);
    if (!refusedTab.ok) {
      expect(refusedTab.error).toMatch(/DROP changes data/);
    }

    const withExternalNamed = JSON.stringify({
      format: WORKBENCH_BUNDLE_FORMAT,
      version: WORKBENCH_BUNDLE_VERSION,
      exportedAt: "2026-10-01T00:00:00Z",
      activeTabId: "t1",
      tabs: [{ id: "t1", title: "Clean", sql: "SELECT 1" }],
      namedQueries: [
        {
          id: "n1",
          title: "Exfil",
          sql: "SELECT * FROM read_parquet('https://evil.example/x.parquet')",
        },
      ],
    });
    const refusedNamed = parseWorkbenchBundle(withExternalNamed);
    expect(refusedNamed.ok).toBe(false);
    if (!refusedNamed.ok) {
      expect(refusedNamed.error).toMatch(/reads files, URLs/);
    }

    const tooManyTabs = Array.from(
      { length: WORKBENCH_BUNDLE_MAX_TABS + 1 },
      (_, i) => ({
        id: `t-${i}`,
        title: `Tab ${i}`,
        sql: "SELECT 1",
        selectedQueryId: "",
        updatedAt: "2026-10-01T00:00:00Z",
      })
    );
    expect(
      serializeWorkbenchBundle({ activeTabId: "t-0", tabs: tooManyTabs }).ok
    ).toBe(false);
  });

  it("encodes and decodes #sql=... permalinks and refuses unsafe or oversize hashes", () => {
    const encoded = encodeWorkbenchPermalink({
      sql: "SELECT study_id, count(*) AS n FROM gold.dim_study GROUP BY 1",
      title: "Studies summary",
    });
    expect(encoded.startsWith("sql=")).toBe(true);

    const decoded = decodeWorkbenchPermalink(`#${encoded}`);
    expect(decoded).toEqual({
      ok: true,
      permalink: {
        sql: "SELECT study_id, count(*) AS n FROM gold.dim_study GROUP BY 1",
        title: "Studies summary",
      },
    });

    expect(() =>
      encodeWorkbenchPermalink({
        sql: "DELETE FROM gold.dim_study",
        title: "Bad",
      })
    ).toThrow(/DELETE changes data/);

    const unknownParam = decodeWorkbenchPermalink("#foo=bar");
    expect(unknownParam).toEqual({
      ok: false,
      error: "The #sql link has an unknown parameter: foo.",
    });

    const missingSql = decodeWorkbenchPermalink("#title=OnlyTitle");
    expect(missingSql.ok).toBe(false);

    const maliciousDecoded = decodeWorkbenchPermalink(
      "#sql=DROP+TABLE+gold.dim_study"
    );
    expect(maliciousDecoded.ok).toBe(false);
    if (!maliciousDecoded.ok) {
      expect(maliciousDecoded.error).toMatch(/The #sql link was refused/);
    }

    const oversize = `#sql=${"a".repeat(WORKBENCH_HASH_MAX_LENGTH + 10)}`;
    const oversizeDecoded = decodeWorkbenchPermalink(oversize);
    expect(oversizeDecoded).toEqual({
      ok: false,
      error: `The #sql link is longer than ${WORKBENCH_HASH_MAX_LENGTH} characters, so the workbench did not read it.`,
    });
  });
});
