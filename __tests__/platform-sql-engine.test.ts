// @vitest-environment node
/**
 * Runs the SQL workbench's own engine (#2633), DuckDB compiled to
 * WebAssembly, the way the page does: it loads the gold tables from
 * `workbenchLoad`, runs every saved query and reads each result with the
 * page's `ResultCollector`. The blocking Node build runs the same
 * `duckdb-eh.wasm` binary the browser downloads, so a saved query that
 * fails here fails for a visitor. The native engine, loaded from the same
 * files, is the reference: each query must return its columns and rows.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import {
  ConsoleLogger,
  NODE_RUNTIME,
  VoidLogger,
  createDuckDB,
  type DuckDBBindings,
  type DuckDBConnection,
} from "@duckdb/duckdb-wasm/blocking";
import {
  DuckDBInstance,
  type DuckDBConnection as DuckDBConnection_,
} from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  workbenchLoad,
  workbenchQueries,
  workbenchResultCsv,
} from "@/lib/clinical-platform";
import {
  ResultCollector,
  cellText,
} from "@/components/platform/sql/arrow-result";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const load = workbenchLoad(warehouse);
const queries = workbenchQueries(warehouse.asOf);

let db: DuckDBBindings;
let conn: DuckDBConnection;

/** Reads a query the way the page does, through the collector. */
function collect(sql: string, maxRows = 10_000) {
  const collector = new ResultCollector(maxRows);
  for (const batch of conn.query(sql).batches) collector.add(batch);
  return collector.result(0);
}

beforeAll(async () => {
  const dist = path.dirname(
    createRequire(import.meta.url).resolve("@duckdb/duckdb-wasm/blocking")
  );
  const bundle = (name: string) => ({
    mainModule: path.join(dist, `duckdb-${name}.wasm`),
    mainWorker: "",
  });
  db = await createDuckDB(
    { mvp: bundle("mvp"), eh: bundle("eh") },
    process.env.DEBUG_DUCKDB ? new ConsoleLogger() : new VoidLogger(),
    NODE_RUNTIME
  );
  await db.instantiate(() => {});
  conn = db.connect();
  conn.query(load.ddl);
  for (const file of load.files) {
    db.registerFileText(file.fileName, file.text);
    conn.query(file.copy);
    db.dropFile(file.fileName);
  }
  for (const setting of load.settings) conn.query(setting);
}, 60_000);

afterAll(() => {
  conn?.close();
  db?.reset();
});

describe("the workbench's WebAssembly engine", () => {
  let native: DuckDBInstance;
  let reference: DuckDBConnection_;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "workbench-wasm-"));
    native = await DuckDBInstance.create(":memory:");
    reference = await native.connect();
    await reference.run(load.ddl);
    for (const file of load.files) {
      const at = path.join(dir, file.fileName);
      writeFileSync(at, file.text);
      await reference.run(file.copy.replace(`'${file.fileName}'`, `'${at}'`));
    }
  }, 60_000);

  afterAll(() => {
    reference?.closeSync();
    native?.closeSync();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("loads every gold table with the rows the native engine loads", async () => {
    for (const file of load.files) {
      const [schema, table] = file.table.split(".");
      const sql = `SELECT count(*) AS n FROM "${schema}"."${table}"`;
      const expected = (await reference.runAndReadAll(sql)).getRows()[0][0];
      expect(collect(sql).rows[0][0], file.table).toBe(String(expected));
      expect(Number(expected), file.table).toBeGreaterThan(0);
    }
  });

  it("runs every saved query and returns what the native engine returns", async () => {
    for (const query of queries) {
      const expected = await reference.runAndReadAll(query.sql);
      const result = collect(query.sql);
      expect(
        result.columns.map((c) => c.name),
        query.id
      ).toEqual(expected.columnNames());
      expect(result.rowCount, query.id).toBe(expected.currentRowCount);
      for (const row of result.rows) {
        for (const value of row) {
          // Every value a saved query returns has a readable form.
          expect(value ?? "", query.id).not.toMatch(/cast it to VARCHAR/);
        }
      }
      expect(workbenchResultCsv(result).split("\r\n")[0], query.id).toBe(
        result.columns.map((c) => c.name).join(",")
      );
    }
  }, 60_000);

  it("explains a query in the explain_value column", () => {
    const result = collect(`EXPLAIN ${queries[0].sql}`);
    const at = result.columns.findIndex((c) => c.name === "explain_value");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(result.rows[0][at]).toMatch(/SCAN|PROJECTION|AGGREGATE/);
  });

  it("refuses file access and a change to its settings once locked", () => {
    expect(() =>
      collect("SELECT * FROM read_csv('gold-fact_enrollment.csv')")
    ).toThrow();
    expect(() => conn.query("SET enable_external_access = true")).toThrow();
  });
});

describe("reading results", () => {
  it("writes each type as the text a person reads", () => {
    const result = collect(`SELECT
      1.25::DECIMAL(10, 2) AS dec,
      -0.05::DECIMAL(10, 2) AS neg,
      12345678901234::BIGINT AS big,
      2.5::DOUBLE AS dbl,
      DATE '2026-01-02' AS dt,
      TIMESTAMP '2026-01-02 03:04:05.250' AS ts,
      TIMESTAMPTZ '2026-01-02 03:04:05+00' AS tz,
      true AS yes,
      'a,b'::VARCHAR AS txt,
      'xy'::BLOB AS bin,
      [1, 2] AS list,
      {'a': 1} AS rec,
      NULL::VARCHAR AS nothing,
      INTERVAL 3 DAY AS span`);
    const value = (name: string) =>
      result.rows[0][result.columns.findIndex((c) => c.name === name)];
    expect(value("dec")).toBe("1.25");
    expect(value("neg")).toBe("-0.05");
    expect(value("big")).toBe("12345678901234");
    expect(value("dbl")).toBe("2.5");
    expect(value("dt")).toBe("2026-01-02");
    expect(value("ts")).toBe("2026-01-02 03:04:05.250");
    expect(value("tz")).toBe("2026-01-02 03:04:05Z");
    expect(value("yes")).toBe("true");
    expect(value("txt")).toBe("a,b");
    expect(value("bin")).toBe("\\x7879");
    expect(value("list")).toBe("[1,2]");
    expect(value("rec")).toBe('{"a":1}');
    expect(value("nothing")).toBeNull();
    expect(value("span")).toMatch(/cast it to VARCHAR to read it/);

    const numeric = Object.fromEntries(
      result.columns.map((c) => [c.name, c.numeric])
    );
    expect(numeric).toMatchObject({
      dec: true,
      big: true,
      dbl: true,
      dt: false,
      txt: false,
    });
    expect(result.columns.find((c) => c.name === "dec")?.type).toBe(
      "Decimal(10,2)"
    );
    expect(result.columns.find((c) => c.name === "big")?.type).toBe("Int64");
  });

  it("keeps at most the row limit and counts the rest", () => {
    const result = collect("SELECT * FROM range(25) t(n)", 10);
    expect(result.rows).toHaveLength(10);
    expect(result.rowCount).toBe(25);
    expect(result.truncated).toBe(true);
    expect(result.rows[9]).toEqual(["9"]);
  });

  it("returns no rows for an empty result without failing", () => {
    const result = collect("SELECT * FROM range(3) t(n) WHERE n > 5");
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("treats null and undefined as SQL NULL", () => {
    const [field] = conn.query("SELECT 1 AS one").schema.fields;
    expect(cellText(field.type, null)).toBeNull();
    expect(cellText(field.type, undefined)).toBeNull();
  });
});
