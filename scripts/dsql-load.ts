/* eslint-disable no-console */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PORTFOLIO_SEED,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  fingerprintDsqlRows,
  generatePortfolio,
  planDsqlLoad,
  type DsqlLoadPlan,
  type WarehouseSchema,
  type WarehouseValue,
} from "../lib/clinical-platform";

/**
 * Loads the clinical platform's gold layer into Aurora DSQL, the warehouse
 * of record (ADR 0070, #3007).
 *
 * Run by `.github/workflows/dsql-load.yml` on `main` with a short-lived
 * admin token. Every statement goes in its own transaction, as DSQL
 * requires of DDL and as keeps each insert under its 3,000-row limit. Each
 * table is then read back and fingerprinted; only when every table matches
 * the plan does `platform_meta.load_manifest` get one row per table, which
 * is what production builds read. The manifest is emptied before the first
 * drop, so a load that stops halfway leaves no manifest rather than a stale
 * one.
 */

/** The part of a `pg` client the load uses, so tests can pass a fake. */
export interface SqlClient {
  query(
    text: string,
    values?: readonly WarehouseValue[]
  ): Promise<{ rows: Record<string, string | null>[] }>;
}

/** One table's parity result. */
export interface TableParityResult {
  readonly table: string;
  readonly expectedRows: number;
  readonly actualRows: number;
  readonly expected: string;
  readonly actual: string;
  readonly ok: boolean;
}

/** What a load did, for the job summary and the JSON report. */
export interface DsqlLoadResult {
  readonly commit: string;
  readonly schemaVersion: string;
  readonly ddlStatements: number;
  readonly insertStatements: number;
  readonly rows: number;
  readonly csvBytes: number;
  readonly tables: readonly TableParityResult[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly ok: boolean;
}

export const MANIFEST_TABLE = '"platform_meta"."load_manifest"';

/** Statements that make sure the manifest table exists, one per transaction. */
export const MANIFEST_DDL = [
  'CREATE SCHEMA IF NOT EXISTS "platform_meta"',
  `CREATE TABLE IF NOT EXISTS ${MANIFEST_TABLE} (` +
    "table_name VARCHAR(128) PRIMARY KEY, " +
    "schema_version VARCHAR(32) NOT NULL, " +
    "row_count INTEGER NOT NULL, " +
    "fingerprint VARCHAR(64) NOT NULL, " +
    "commit_sha VARCHAR(40) NOT NULL, " +
    "loaded_at TIMESTAMPTZ NOT NULL)",
];

/** The gold layer of the default portfolio: what DSQL holds. */
export function goldSchema(): WarehouseSchema {
  return {
    ...WAREHOUSE_SCHEMA,
    tables: WAREHOUSE_SCHEMA.tables.filter((table) => table.layer === "gold"),
  };
}

/**
 * Runs a load plan against DSQL, checks parity and writes the manifest.
 *
 * @param client - A connected client, as the admin role.
 * @param schema - The tables the plan loads.
 * @param plan - From `planDsqlLoad`.
 * @param commit - The commit being loaded.
 * @param now - Clock, for tests.
 * @returns What the load did; `ok` is false when any table differs.
 */
export async function runDsqlLoad(
  client: SqlClient,
  schema: WarehouseSchema,
  plan: DsqlLoadPlan,
  commit: string,
  now: () => Date = () => new Date()
): Promise<DsqlLoadResult> {
  const startedAt = now().toISOString();
  for (const statement of MANIFEST_DDL) await client.query(statement);
  await client.query(`DELETE FROM ${MANIFEST_TABLE}`);
  for (const statement of [...plan.drop, ...plan.create]) {
    await client.query(statement);
  }
  for (const batch of plan.inserts) {
    await client.query(batch.text, batch.values);
  }

  const tables: TableParityResult[] = [];
  for (const expected of plan.parity) {
    const table = schema.tables.find(
      (t) => `${t.layer}.${t.name}` === expected.table
    );
    if (!table) throw new Error(`No schema entry for ${expected.table}.`);
    const { rows } = await client.query(expected.readback);
    const actual = fingerprintDsqlRows(table, rows);
    tables.push({
      table: expected.table,
      expectedRows: expected.rowCount,
      actualRows: rows.length,
      expected: expected.fingerprint,
      actual,
      ok: actual === expected.fingerprint,
    });
  }

  const ok = tables.every((t) => t.ok);
  const finishedAt = now().toISOString();
  if (ok) {
    // $1 is the load time, shared by every row; each row adds five more.
    const values: WarehouseValue[] = [finishedAt];
    const tuples = tables.map((t) => {
      values.push(t.table, plan.schemaVersion, t.actualRows, t.actual, commit);
      const n = values.length;
      return `($${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n}, $1)`;
    });
    await client.query(
      `INSERT INTO ${MANIFEST_TABLE} ` +
        "(table_name, schema_version, row_count, fingerprint, commit_sha, loaded_at) " +
        `VALUES ${tuples.join(", ")}`,
      values
    );
  }

  return {
    commit,
    schemaVersion: plan.schemaVersion,
    ddlStatements: MANIFEST_DDL.length + plan.drop.length + plan.create.length,
    insertStatements: plan.inserts.length,
    rows: plan.parity.reduce((sum, t) => sum + t.rowCount, 0),
    csvBytes: plan.csvBytes,
    tables,
    startedAt,
    finishedAt,
    ok,
  };
}

/** The job summary, in Markdown. */
export function summaryMarkdown(result: DsqlLoadResult): string {
  const mb = (result.csvBytes / (1024 * 1024)).toFixed(2);
  return [
    `## Aurora DSQL load ${result.ok ? "passed" : "FAILED"}`,
    "",
    `Commit \`${result.commit}\`, warehouse schema ${result.schemaVersion}, ` +
      `${result.rows.toLocaleString("en-US")} rows (${mb} MB as CSV) in ` +
      `${result.insertStatements} inserts and ${result.ddlStatements} DDL statements, ` +
      `${result.startedAt} to ${result.finishedAt}.`,
    "",
    "| Table | Rows | Fingerprint | Parity |",
    "| --- | ---: | --- | --- |",
    ...result.tables.map(
      (t) =>
        `| ${t.table} | ${t.actualRows} | \`${t.actual}\` | ${
          t.ok ? "match" : `expected \`${t.expected}\``
        } |`
    ),
    "",
  ].join("\n");
}

async function main(args: string[]): Promise<number> {
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const host = process.env.DSQL_ENDPOINT;
  const token = process.env.PGPASSWORD;
  const commit = process.env.GITHUB_SHA ?? "local";
  if (!host || !token) {
    console.error(
      "DSQL_ENDPOINT and PGPASSWORD (an admin auth token) are required."
    );
    return 2;
  }
  const schema = goldSchema();
  const plan = planDsqlLoad(
    schema,
    buildWarehouse(generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED }))
  );
  const { Client } = await import("pg");
  const client = new Client({
    host,
    port: 5432,
    user: "admin",
    password: token,
    database: "postgres",
    ssl: { rejectUnauthorized: true },
  });
  await client.connect();
  try {
    const result = await runDsqlLoad(
      client as unknown as SqlClient,
      schema,
      plan,
      commit
    );
    const markdown = summaryMarkdown(result);
    console.log(markdown);
    const summary = option("--summary");
    if (summary) fs.appendFileSync(summary, markdown);
    const out = option("--out");
    if (out) fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
