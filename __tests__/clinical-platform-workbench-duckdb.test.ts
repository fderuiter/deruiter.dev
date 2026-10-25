// @vitest-environment node
/**
 * Runs the SQL workbench's saved queries (#2633) on the seeded gold tables
 * in DuckDB, checks each worked example against the TypeScript evaluator or
 * the warehouse rows, and checks that the engine settings close every way
 * out of the database. `@duckdb/node-api` is the native build of the engine
 * the workbench runs as WebAssembly; it is a dev dependency used only by
 * tests, imported statically so a binding that cannot load fails the file.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
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
  workbenchQueries,
  type MetricDimensionId,
  type WarehouseRow,
  type WorkbenchQuery,
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

describe("every saved query", () => {
  it.each(queries.map((q) => [q.id, q] as const))(
    "%s passes the statement check, runs and returns rows",
    async (_id, query) => {
      expect(checkWorkbenchSql(query.sql)).toEqual([]);
      const result = await rows(query.sql);
      expect(result.length).toBeGreaterThan(0);
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
