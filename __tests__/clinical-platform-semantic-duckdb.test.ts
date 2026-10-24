// @vitest-environment node
/**
 * Runs every governed metric's generated DuckDB SQL against the seeded gold
 * tables and compares the result with the TypeScript evaluator on the same
 * warehouse (#2624). The two are independent implementations of each
 * definition (joins, filters, null handling and aggregation are written
 * twice), so agreement on every metric, dimension and filter is evidence
 * that both compute what the registry defines.
 *
 * `@duckdb/node-api` is a dev dependency used only by tests. The import is
 * static on purpose: if the native binding cannot load, this file fails
 * instead of skipping.
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
  buildWarehouse,
  emitDdl,
  evaluateMetric,
  exportWarehouse,
  generatePortfolio,
  toSql,
  type MetricDefinition,
  type MetricDimensionId,
  type MetricFilter,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dataCut = warehouse.asOf;
const quote = (id: string) => `"${id.replaceAll('"', '""')}"`;

let instance: DuckDBInstance;
let db: DuckDBConnection;
let dir: string;

beforeAll(async () => {
  instance = await DuckDBInstance.create(":memory:");
  db = await instance.connect();
  await db.run(emitDdl(WAREHOUSE_SCHEMA, "duckdb"));
  dir = mkdtempSync(path.join(os.tmpdir(), "semantic-duckdb-"));
  for (const file of exportWarehouse(WAREHOUSE_SCHEMA, warehouse).files) {
    if (!file.table.startsWith("gold.")) continue;
    const target = path.join(dir, file.path.replace("/", "-"));
    writeFileSync(target, file.text, "utf8");
    await db.run(
      `COPY ${file.table.split(".").map(quote).join(".")} FROM '${target.replaceAll("'", "''")}' (FORMAT csv, HEADER true, ALLOW_QUOTED_NULLS false)`
    );
  }
}, 120_000);

afterAll(() => {
  db?.closeSync();
  instance?.closeSync();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Result rows keyed by their dimension values, from either engine. */
type Keyed = Map<string, number | null>;

async function viaDuckDb(
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[]
): Promise<Keyed> {
  const sql = toSql(metric, dimensions, filters, "duckdb", { dataCut });
  const rows = (await db.runAndReadAll(sql)).getRowObjectsJson();
  return new Map(
    rows.map((row) => [
      JSON.stringify(dimensions.map((d) => String(row[d]))),
      row.value === null ? null : Number(row.value),
    ])
  );
}

function viaTypeScript(
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[]
): Keyed {
  const result = evaluateMetric(warehouse, metric, { dimensions, filters });
  return new Map(
    result.rows.map((row) => [
      JSON.stringify(dimensions.map((d) => row.dimensions[d])),
      row.value,
    ])
  );
}

async function expectAgreement(
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[] = []
): Promise<number> {
  const label = `${metric.id} by [${dimensions.join(", ")}]${filters.length ? ` filtered by ${filters.map((f) => f.dimension).join(", ")}` : ""}`;
  const duck = await viaDuckDb(metric, dimensions, filters);
  const ts = viaTypeScript(metric, dimensions, filters);
  expect([...duck.keys()].sort(), label).toEqual([...ts.keys()].sort());
  for (const [key, value] of ts) {
    const other = duck.get(key) ?? null;
    if (value === null || other === null) {
      expect(other, `${label} ${key}`).toBe(value);
    } else {
      expect(
        Math.abs(other - value),
        `${label} ${key}: ${other} vs ${value}`
      ).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(value)));
    }
  }
  return ts.size;
}

/** The minimal grouping a metric allows: none, or study for a study grain metric. */
const base = (metric: MetricDefinition): MetricDimensionId[] =>
  metric.grain === "study" ? ["study"] : [];

describe("DuckDB SQL agrees with the TypeScript evaluator", () => {
  it.each(METRIC_REGISTRY.map((m) => [m.id, m] as const))(
    "%s at its minimal grouping and by every allowed dimension",
    async (_id, metric) => {
      expect(await expectAgreement(metric, base(metric))).toBeGreaterThan(0);
      for (const dimension of metric.allowedDimensions) {
        const dims = [...new Set([...base(metric), dimension])];
        expect(await expectAgreement(metric, dims)).toBeGreaterThan(0);
      }
    },
    60_000
  );

  it.each(METRIC_REGISTRY.map((m) => [m.id, m] as const))(
    "%s grouped by two dimensions and filtered",
    async (_id, metric) => {
      const [first, second] = metric.allowedDimensions.filter(
        (d) => d !== "study"
      );
      const dims: MetricDimensionId[] = ["study", ...(second ? [second] : [])];
      await expectAgreement(metric, dims);
      const filterOn = first ?? "study";
      const values = evaluateMetric(warehouse, metric, {
        dimensions: [
          ...new Set<MetricDimensionId>([...base(metric), filterOn]),
        ],
      }).rows.map((r) => String(r.dimensions[filterOn]));
      const kept = values.filter((_, i) => i % 2 === 0);
      for (const operator of ["in", "not-in"] as const) {
        await expectAgreement(metric, dims, [
          { dimension: filterOn, operator, values: kept },
        ]);
      }
    },
    60_000
  );

  it("agrees on the default filter and on a query that replaces it", async () => {
    const metric = METRIC_REGISTRY.find((m) => m.id === "open_query_count");
    if (metric === undefined) throw new Error("open_query_count is missing");
    expect(metric.defaultFilters).not.toHaveLength(0);
    await expectAgreement(metric, ["study_status"]);
    await expectAgreement(
      metric,
      ["study_status"],
      [
        {
          dimension: "study_status",
          operator: "in",
          values: ["closed", "enrolling", "follow-up"],
        },
      ]
    );
  });
});
