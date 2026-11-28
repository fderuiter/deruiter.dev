// @vitest-environment node
/**
 * Runs the SQL workbench's saved queries (#2633) on the seeded gold tables
 * in DuckDB, checks each worked example against the TypeScript evaluator or
 * the warehouse rows, and checks that the engine settings close every way
 * out of the database. `@duckdb/node-api` is the native build of the engine
 * the workbench runs as WebAssembly; it is a dev dependency used only by
 * tests, imported statically so a binding that cannot load fails the file.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import * as fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  WAREHOUSE_SCHEMA,
  WORKBENCH_ENGINE_SETTINGS,
  buildWarehouse,
  checkWorkbenchSql,
  emitDdl,
  evaluateMetric,
  exportWarehouse,
  generatePortfolio,
  mergeWorkbenchHydratedDatasets,
  parseWorkbenchDataset,
  workbenchDatasetLoad,
  workbenchDatasetTable,
  workbenchHydratedDataset,
  workbenchQueries,
  workbenchResultParquet,
  type MetricDimensionId,
  type WarehouseRow,
  type WorkbenchQuery,
  type WorkbenchResult,
  type WorkbenchUploadedDataset,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const queries = workbenchQueries(warehouse.asOf);
const quote = (id: string) => `"${id.replaceAll('"', '""')}"`;

let instance: DuckDBInstance;
let db: DuckDBConnection;
let dir: string;

type Row = Record<string, unknown>;

async function rows(sql: string): Promise<Row[]> {
  return (await db.runAndReadAll(sql)).getRowObjectsJson() as Row[];
}

function saved(id: string): WorkbenchQuery {
  const found = queries.find((q) => q.id === id);
  if (found === undefined) throw new Error(`no saved query ${id}`);
  return found;
}

function table(name: string): readonly WarehouseRow[] {
  return warehouse.tables[name] ?? [];
}

/** A metric's values by study, from the TypeScript evaluator. */
function byStudy(metricId: string): Map<string, number | null> {
  const metric = METRIC_REGISTRY.find((m) => m.id === metricId);
  if (metric === undefined) throw new Error(`no metric ${metricId}`);
  const dimensions: MetricDimensionId[] = ["study"];
  return new Map(
    evaluateMetric(warehouse, metric, { dimensions }).rows.map((row) => [
      String(row.dimensions.study),
      row.value,
    ])
  );
}

const day = (iso: unknown) => Date.parse(`${String(iso)}T00:00:00Z`) / 864e5;

beforeAll(async () => {
  instance = await DuckDBInstance.create(":memory:");
  db = await instance.connect();
  await db.run(emitDdl(WAREHOUSE_SCHEMA, "duckdb"));
  dir = mkdtempSync(path.join(os.tmpdir(), "workbench-duckdb-"));
  for (const file of exportWarehouse(WAREHOUSE_SCHEMA, warehouse).files) {
    if (!file.table.startsWith("gold.")) continue;
    const target = path.join(dir, file.path.replace("/", "-"));
    writeFileSync(target, file.text, "utf8");
    await db.run(
      `COPY ${file.table.split(".").map(quote).join(".")} FROM '${target.replaceAll("'", "''")}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`
    );
  }
  for (const setting of WORKBENCH_ENGINE_SETTINGS) await db.run(setting);
}, 120_000);

afterAll(() => {
  db?.closeSync();
  instance?.closeSync();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/**
 * Saved queries with nothing to return on the default seed: no unresolved
 * query is older than 30 days at the data cut, so the two oldest age bands
 * (#2759) count nothing. They must still pass the check and run.
 */
const EMPTY_ON_SEED = new Set([
  "metric-open-queries-aged-31-60-days",
  "metric-open-queries-aged-over-60-days",
]);

describe("every saved query", () => {
  it.each(queries.map((q) => [q.id, q] as const))(
    "%s passes the statement check, runs and returns rows",
    async (_id, query) => {
      expect(checkWorkbenchSql(query.sql)).toEqual([]);
      const result = await rows(query.sql);
      if (EMPTY_ON_SEED.has(query.id)) expect(result).toEqual([]);
      else expect(result.length).toBeGreaterThan(0);
    }
  );

  it.each(
    queries.filter((q) => q.kind === "example").map((q) => [q.id, q] as const)
  )("%s has a plan EXPLAIN can show", async (_id, query) => {
    const explain = `EXPLAIN ${query.sql}`;
    expect(checkWorkbenchSql(explain)).toEqual([]);
    const plan = await rows(explain);
    expect(plan.length).toBeGreaterThan(0);
    expect(JSON.stringify(plan)).toMatch(/SCAN/);
  });
});

describe("worked examples agree with the governed metrics and the rows", () => {
  it("open query aging counts and ages what the certified metrics count", async () => {
    const result = await rows(saved("open-query-aging").sql);
    const open = byStudy("open_query_count");
    const aging = byStudy("query_aging_mean");
    const studies = new Map<string, number[]>();
    for (const row of result) {
      const study = String(row.study_id);
      studies.set(study, [...(studies.get(study) ?? []), Number(row.age_days)]);
      expect(Number(row.open_in_study)).toBe(open.get(study));
    }
    expect([...studies.keys()].sort()).toEqual(
      [...open].filter(([, v]) => (v ?? 0) > 0).map(([k]) => k)
    );
    for (const [study, ages] of studies) {
      expect(ages.length, study).toBe(open.get(study));
      const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
      expect(mean, study).toBeCloseTo(aging.get(study) ?? Number.NaN, 9);
      // Ranked oldest first, so the first row of a study is its oldest.
      expect(ages[0]).toBe(Math.max(...ages));
    }
  });

  it("enrollment against plan matches the certified ratio for every study", async () => {
    const result = await rows(saved("enrollment-against-plan").sql);
    const ratio = byStudy("enrollment_vs_plan");
    expect(result.map((r) => r.study_id)).toEqual(
      table("gold.dim_study")
        .map((s) => s.study_id)
        .sort()
    );
    for (const row of result) {
      const study = String(row.study_id);
      const value = Number(row.enrolled) / Number(row.planned);
      expect(value, study).toBeCloseTo(ratio.get(study) ?? 0, 12);
      expect(Number(row.percent_of_plan)).toBeCloseTo(
        Math.round(1000 * value) / 10,
        9
      );
    }
  });

  it("the recursive lifecycle walks every milestone of every study, in order", async () => {
    const result = await rows(saved("milestone-lifecycle").sql);
    const milestones = table("gold.fct_milestone");
    expect(result).toHaveLength(milestones.length);
    const studies = new Map(
      table("gold.dim_study").map((s) => [s.study_key, String(s.study_id)])
    );
    const dates = new Map(
      table("gold.dim_date").map((d) => [d.date_key, d.calendar_date])
    );
    const sequence = new Map(
      table("gold.dim_milestone").map((m) => [
        m.milestone_key,
        Number(m.milestone_sequence),
      ])
    );
    for (const study of new Set(result.map((r) => String(r.study_id)))) {
      const walked = result.filter((r) => r.study_id === study);
      const expected = milestones
        .filter((m) => studies.get(m.study_key) === study)
        .map((m) => ({
          sequence: sequence.get(m.milestone_key) ?? 0,
          date: dates.get(m.actual_date_key ?? m.planned_date_key),
        }))
        .sort((a, b) => a.sequence - b.sequence);
      expect(walked.map((r) => Number(r.milestone_sequence))).toEqual(
        expected.map((m) => m.sequence)
      );
      for (const [i, row] of walked.entries()) {
        expect(String(row.milestone_date)).toBe(String(expected[i].date));
        expect(Number(row.days_since_first)).toBe(
          day(expected[i].date) - day(expected[0].date)
        );
      }
    }
  });

  it("each deviation meets exactly the site version in force that day", async () => {
    const result = await rows(saved("deviation-site-as-of").sql);
    const deviations = table("gold.fct_deviation");
    expect(result).toHaveLength(deviations.length);
    expect(new Set(result.map((r) => r.deviation_id)).size).toBe(
      deviations.length
    );
    const sites = table("gold.dim_site");
    const keyed = new Map(sites.map((s) => [s.site_key, s]));
    const dates = new Map(
      table("gold.dim_date").map((d) => [d.date_key, String(d.calendar_date)])
    );
    const byId = new Map(result.map((r) => [r.deviation_id, r]));
    for (const deviation of deviations) {
      const on = dates.get(deviation.occurred_date_key) ?? "";
      const siteId = keyed.get(deviation.site_key)?.site_id;
      const versions = sites.filter((s) => s.site_id === siteId);
      const then = versions.filter(
        (s) => String(s.valid_from) <= on && on < String(s.valid_to)
      );
      expect(then, String(deviation.deviation_id)).toHaveLength(1);
      const row = byId.get(deviation.deviation_id);
      expect(Number(row?.version_then)).toBe(then[0].version_number);
      expect(row?.status_then).toBe(then[0].site_status);
      expect(Number(row?.version_now)).toBe(
        versions.find((s) => s.is_current)?.version_number
      );
    }
  });
});

describe("metric queries", () => {
  it("give the values the TypeScript evaluator gives, for every metric", async () => {
    for (const query of queries.filter((q) => q.kind === "metric")) {
      const metric = METRIC_REGISTRY.find((m) => m.id === query.metricId);
      if (metric === undefined) throw new Error(`no metric ${query.metricId}`);
      const key = (values: readonly unknown[]) => JSON.stringify(values);
      const expected = new Map(
        evaluateMetric(warehouse, metric, {
          dimensions: query.dimensions,
        }).rows.map((row) => [
          key(query.dimensions.map((d) => row.dimensions[d])),
          row.value,
        ])
      );
      const result = await rows(query.sql);
      expect(result, query.id).toHaveLength(expected.size);
      for (const row of result) {
        const want = expected.get(
          key(query.dimensions.map((d) => String(row[d])))
        );
        const value = row.value === null ? null : Number(row.value);
        if (want === null || want === undefined) {
          expect(value, query.id).toBeNull();
        } else {
          expect(value, query.id).toBeCloseTo(want, 9);
        }
      }
    }
  });
});

describe("engine settings", () => {
  const file = () => {
    const target = path.join(dir, "outside.csv");
    writeFileSync(target, "a\n1\n", "utf8");
    return target.replaceAll("'", "''");
  };

  it.each([
    ["a file read", () => `SELECT * FROM read_csv('${file()}')`],
    ["a file read by name", () => `SELECT * FROM '${file()}'`],
    ["a file write", () => `COPY (SELECT 1) TO '${path.join(dir, "out.csv")}'`],
    ["re-enabling access", () => "SET enable_external_access = true"],
    ["loading an extension", () => "LOAD httpfs"],
    ["attaching a database", () => `ATTACH '${path.join(dir, "x.db")}'`],
  ])("refuse %s, which the statement check also refuses", async (_l, sql) => {
    const text = sql();
    expect(checkWorkbenchSql(text)).not.toEqual([]);
    await expect(db.run(text)).rejects.toThrow();
  });
});

describe("Parquet export writer and locked engine COPY check", () => {
  it("blocks COPY (...) TO under locked WORKBENCH_ENGINE_SETTINGS and round-trips workbenchResultParquet through DuckDB read_parquet", async () => {
    const blockedOut = path.join(dir, "locked-export.parquet");
    await expect(
      db.run(
        `COPY (SELECT 1 AS a) TO '${blockedOut.replaceAll("'", "''")}' (FORMAT parquet)`
      )
    ).rejects.toThrow(/disabled by configuration/i);

    const scratch = await DuckDBInstance.create(":memory:");
    const conn = await scratch.connect();
    try {
      const exported: WorkbenchResult = {
        columns: [
          { name: "study_id", type: "Text", numeric: false },
          { name: "enrolled", type: "Int32", numeric: true },
          { name: "total_visits", type: "Int64", numeric: true },
          { name: "completion_rate", type: "Double", numeric: true },
          { name: "is_active", type: "Boolean", numeric: false },
          { name: "study_id", type: "Text", numeric: false },
        ],
        rows: [
          ["DEMO-301", "24", "180", "0.875", "true", "dup-a"],
          ["DEMO-302", null, "45", null, "false", null],
        ],
        rowCount: 2,
        truncated: false,
        elapsedMs: 3.1,
      };
      const outPath = path.join(dir, "workbench-export.parquet");
      writeFileSync(outPath, workbenchResultParquet(exported));
      const readBack = (
        await conn.runAndReadAll(
          `SELECT study_id, enrolled, total_visits, completion_rate, is_active, study_id_2 FROM read_parquet('${outPath.replaceAll("'", "''")}') ORDER BY study_id`
        )
      ).getRowObjectsJson();
      expect(readBack).toEqual([
        {
          study_id: "DEMO-301",
          enrolled: 24,
          total_visits: "180",
          completion_rate: 0.875,
          is_active: true,
          study_id_2: "dup-a",
        },
        {
          study_id: "DEMO-302",
          enrolled: null,
          total_visits: "45",
          completion_rate: null,
          is_active: false,
          study_id_2: null,
        },
      ]);

      // Empty wide result also round-trips cleanly through DuckDB read_parquet.
      const emptyWide: WorkbenchResult = {
        columns: Array.from({ length: 18 }, (_, i) => ({
          name: i === 0 ? "" : `col_${i}`,
          type: i % 2 === 0 ? "Int32" : "Text",
          numeric: i % 2 === 0,
        })),
        rows: [],
        rowCount: 0,
        truncated: false,
        elapsedMs: 1,
      };
      const emptyPath = path.join(dir, "workbench-empty.parquet");
      writeFileSync(emptyPath, workbenchResultParquet(emptyWide));
      const emptyDescribe = (
        await conn.runAndReadAll(
          `DESCRIBE SELECT * FROM read_parquet('${emptyPath.replaceAll("'", "''")}')`
        )
      ).getRowObjectsJson();
      expect(emptyDescribe).toHaveLength(18);
      expect(emptyDescribe[0].column_name).toBe("column_1");

      // Property-based round-trip of arbitrary rows through DuckDB read_parquet.
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.option(fc.string({ maxLength: 24 }), { nil: null }),
              fc.option(fc.integer({ min: -100_000, max: 100_000 }), {
                nil: null,
              }),
              fc.option(fc.boolean(), { nil: null })
            ),
            { minLength: 0, maxLength: 20 }
          ),
          async (tuples) => {
            const propRes: WorkbenchResult = {
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
            const propPath = path.join(dir, "workbench-prop.parquet");
            writeFileSync(propPath, workbenchResultParquet(propRes));
            const actual = (
              await conn.runAndReadAll(
                `SELECT label, n, flag FROM read_parquet('${propPath.replaceAll("'", "''")}')`
              )
            ).getRowObjectsJson();
            expect(actual).toEqual(
              tuples.map(([s, n, b]) => ({ label: s, n, flag: b }))
            );
          }
        ),
        { numRuns: 25, seed: 4242 }
      );
    } finally {
      conn.closeSync();
      scratch.closeSync();
    }
  });
});

describe("end-to-end DuckDB dataset hydration (ZSTD/GZIP Parquet, NDJSON, quoted-newline CSV)", () => {
  async function hydrateDatasetIntoEngine(
    conn: DuckDBConnection,
    scratchDir: string,
    dataset: WorkbenchUploadedDataset
  ) {
    const dsLoad = workbenchDatasetLoad(dataset);
    const stagedPath = path.join(scratchDir, dsLoad.fileName);
    writeFileSync(stagedPath, dsLoad.buffer);
    const createSql = dsLoad.create.replace(
      `'${dsLoad.fileName.replaceAll("'", "''")}'`,
      `'${stagedPath.replaceAll("'", "''")}'`
    );
    await conn.run(createSql);
    const describeRows = (await conn.runAndReadAll(dsLoad.describe))
      .getRows()
      .map((r) => r.map((cell) => (cell === null ? null : String(cell))));
    const countVal = Number(
      (await conn.runAndReadAll(dsLoad.count)).getRows()[0]?.[0] ?? 0
    );
    return workbenchHydratedDataset(dsLoad.table, describeRows, countVal);
  }

  it("loads ZSTD and GZIP Parquet (with nested types), NDJSON and CSV with quoted newlines via DuckDB's readers before settings lock", async () => {
    const firstStudyId = String(table("gold.dim_study")[0].study_id);
    const secondStudyId = String(
      table("gold.dim_study")[1]?.study_id ?? firstStudyId
    );

    // 1. Build ZSTD-compressed and GZIP-compressed Parquet fixtures in DuckDB.
    const builder = await DuckDBInstance.create(":memory:");
    const builderConn = await builder.connect();
    const zstdFixturePath = path.join(dir, "fixture-zstd.parquet");
    const gzipFixturePath = path.join(dir, "fixture-gzip.parquet");
    try {
      await builderConn.run(`
        COPY (
          SELECT
            '${firstStudyId.replaceAll("'", "''")}' AS study_id,
            14::INTEGER AS audit_findings,
            19.75::DECIMAL(10, 2) AS review_hours,
            DATE '2026-03-15' AS audited_on,
            true AS passed,
            ['oncology', 'priority'] AS tags,
            {'lead': 'Dr. Lin', 'tier': 1} AS reviewer_meta
          UNION ALL
          SELECT
            '${secondStudyId.replaceAll("'", "''")}',
            NULL,
            6.50,
            DATE '2026-04-02',
            false,
            ['follow-up'],
            {'lead': 'Dr. Patel', 'tier': 2}
        ) TO '${zstdFixturePath.replaceAll("'", "''")}' (FORMAT parquet, COMPRESSION zstd)
      `);
      await builderConn.run(`
        COPY (
          SELECT
            '${firstStudyId.replaceAll("'", "''")}' AS study_id,
            i::BIGINT AS batch_seq
          FROM range(12) t(i)
        ) TO '${gzipFixturePath.replaceAll("'", "''")}' (FORMAT parquet, COMPRESSION gzip)
      `);
    } finally {
      builderConn.closeSync();
      builder.closeSync();
    }

    const zstdParsed = parseWorkbenchDataset({
      fileName: "zstd_audit.parquet",
      bytes: new Uint8Array(readFileSync(zstdFixturePath)),
    });
    const gzipParsed = parseWorkbenchDataset({
      fileName: "gzip_batches.parquet",
      bytes: new Uint8Array(readFileSync(gzipFixturePath)),
    });
    const ndjsonParsed = parseWorkbenchDataset({
      fileName: "site_signals.ndjson",
      bytes: new TextEncoder().encode(
        [
          JSON.stringify({
            study_id: firstStudyId,
            signal_code: "KR-01",
            weight: 1.5,
            channels: ["edc", "irt"],
          }),
          JSON.stringify({
            study_id: secondStudyId,
            signal_code: "KR-02",
            weight: null,
            channels: ["ctms"],
          }),
        ].join("\n") + "\n"
      ),
    });
    const csvQuotedNewlinesParsed = parseWorkbenchDataset({
      fileName: "monitor_notes.csv",
      bytes: new TextEncoder().encode(
        [
          "study_id,comment,open_items",
          `"${firstStudyId}","First line of monitor summary\nSecond line, with ""quoted"" detail",3`,
          `"${secondStudyId}",,0`,
        ].join("\r\n") + "\r\n"
      ),
    });

    expect(
      zstdParsed.ok &&
        gzipParsed.ok &&
        ndjsonParsed.ok &&
        csvQuotedNewlinesParsed.ok
    ).toBe(true);
    if (
      !zstdParsed.ok ||
      !gzipParsed.ok ||
      !ndjsonParsed.ok ||
      !csvQuotedNewlinesParsed.ok
    ) {
      return;
    }

    // Before hydration, parseWorkbenchDataset keeps only cheap checks (no JS row parsing).
    expect(zstdParsed.dataset.rowCount).toBeNull();
    expect(zstdParsed.dataset.columns).toEqual([]);

    // 2. Hydrate gold.* + all four uploads into a fresh DuckDB engine, then lock settings.
    const engineInst = await DuckDBInstance.create(":memory:");
    const engineConn = await engineInst.connect();
    try {
      await engineConn.run(emitDdl(WAREHOUSE_SCHEMA, "duckdb"));
      for (const file of exportWarehouse(WAREHOUSE_SCHEMA, warehouse).files) {
        if (!file.table.startsWith("gold.")) continue;
        const target = path.join(dir, `e2e-${file.path.replace("/", "-")}`);
        writeFileSync(target, file.text, "utf8");
        await engineConn.run(
          `COPY ${file.table.split(".").map(quote).join(".")} FROM '${target.replaceAll("'", "''")}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`
        );
      }

      const rawDatasets = [
        zstdParsed.dataset,
        gzipParsed.dataset,
        ndjsonParsed.dataset,
        csvQuotedNewlinesParsed.dataset,
      ];
      const hydratedMeta = [];
      for (const ds of rawDatasets) {
        hydratedMeta.push(await hydrateDatasetIntoEngine(engineConn, dir, ds));
      }
      for (const setting of WORKBENCH_ENGINE_SETTINGS) {
        await engineConn.run(setting);
      }

      // 3. Verify DESCRIBE and SELECT count(*) populated schema browser metadata.
      const merged = mergeWorkbenchHydratedDatasets(rawDatasets, hydratedMeta);
      const [zstdDs, gzipDs, ndjsonDs, csvDs] = merged;

      expect(zstdDs.rowCount).toBe(2);
      expect(zstdDs.columns.map((c) => [c.name, c.type])).toEqual([
        ["study_id", "VARCHAR"],
        ["audit_findings", "INTEGER"],
        ["review_hours", "DECIMAL(10,2)"],
        ["audited_on", "DATE"],
        ["passed", "BOOLEAN"],
        ["tags", "VARCHAR[]"],
        ["reviewer_meta", "STRUCT(lead VARCHAR, tier INTEGER)"],
      ]);
      const zstdSchemaTable = workbenchDatasetTable(zstdDs);
      expect(zstdSchemaTable.rowCount).toBe(2);
      expect(zstdSchemaTable.columns.map((c) => [c.name, c.type])).toEqual([
        ["study_id", "string"],
        ["audit_findings", "integer"],
        ["review_hours", "decimal"],
        ["audited_on", "date"],
        ["passed", "boolean"],
        ["tags", "string"],
        ["reviewer_meta", "string"],
      ]);

      expect(gzipDs.rowCount).toBe(12);
      expect(ndjsonDs.rowCount).toBe(2);
      expect(ndjsonDs.columns.map((c) => c.name)).toEqual([
        "study_id",
        "signal_code",
        "weight",
        "channels",
      ]);

      expect(csvDs.rowCount).toBe(2);
      expect(csvDs.columns.map((c) => [c.name, c.type])).toEqual([
        ["study_id", "VARCHAR"],
        ["comment", "VARCHAR"],
        ["open_items", "BIGINT"],
      ]);

      // 4. Query across gold.* and all four uploaded datasets under locked settings.
      const joined = (
        await engineConn.runAndReadAll(`
          SELECT
            s.study_id,
            z.audit_findings,
            z.reviewer_meta.lead AS lead_reviewer,
            list_extract(z.tags, 1) AS first_tag,
            n.signal_code,
            m.comment,
            m.open_items,
            (SELECT count(*) FROM uploads.gzip_batches g WHERE g.study_id = s.study_id)::INTEGER AS batch_count
          FROM gold.dim_study s
          JOIN uploads.zstd_audit z USING (study_id)
          JOIN uploads.site_signals n USING (study_id)
          JOIN uploads.monitor_notes m USING (study_id)
          ORDER BY s.study_id
        `)
      ).getRowObjectsJson();

      const firstRow = joined.find((r) => r.study_id === firstStudyId);
      expect(firstRow).toEqual({
        study_id: firstStudyId,
        audit_findings: 14,
        lead_reviewer: "Dr. Lin",
        first_tag: "oncology",
        signal_code: "KR-01",
        comment:
          'First line of monitor summary\nSecond line, with "quoted" detail',
        open_items: "3",
        batch_count: 12,
      });

      const secondRow = joined.find((r) => r.study_id === secondStudyId);
      expect(secondRow?.comment).toBeNull();
    } finally {
      engineConn.closeSync();
      engineInst.closeSync();
    }
  });

  it("surfaces DuckDB's own error message when a file passes cheap checks but cannot be read", async () => {
    const scratch = await DuckDBInstance.create(":memory:");
    const conn = await scratch.connect();
    try {
      const corruptParquet = parseWorkbenchDataset({
        fileName: "corrupt.parquet",
        bytes: new TextEncoder().encode("PAR1not-valid-thrift-metadataPAR1"),
      });
      expect(corruptParquet.ok).toBe(true);
      if (corruptParquet.ok) {
        await expect(
          hydrateDatasetIntoEngine(conn, dir, corruptParquet.dataset)
        ).rejects.toThrow(/Error/i);
      }

      const malformedJson = parseWorkbenchDataset({
        fileName: "broken.ndjson",
        bytes: new TextEncoder().encode('{"ok":1}\n{bad-json\n'),
      });
      expect(malformedJson.ok).toBe(true);
      if (malformedJson.ok) {
        await expect(
          hydrateDatasetIntoEngine(conn, dir, malformedJson.dataset)
        ).rejects.toThrow(/Malformed JSON/i);
      }

      const malformedCsv = parseWorkbenchDataset({
        fileName: "broken.csv",
        bytes: new TextEncoder().encode('a,b\n"unterminated,1\n'),
      });
      expect(malformedCsv.ok).toBe(true);
      if (malformedCsv.ok) {
        await expect(
          hydrateDatasetIntoEngine(conn, dir, malformedCsv.dataset)
        ).rejects.toThrow(/Error/i);
      }
    } finally {
      conn.closeSync();
      scratch.closeSync();
    }
  });
});
