// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  planDsqlLoad,
  type WarehouseValue,
} from "@/lib/clinical-platform";
import {
  MANIFEST_DDL,
  MANIFEST_TABLE,
  goldSchema,
  runDsqlLoad,
  summaryMarkdown,
  type SqlClient,
} from "../scripts/dsql-load";

const schema = goldSchema();
const plan = planDsqlLoad(
  schema,
  buildWarehouse(generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED }))
);
const clock = () => new Date("2026-10-26T19:00:00Z");
const totalRows = plan.parity.reduce((sum, t) => sum + t.rowCount, 0);

/** PostgreSQL's text output for a value the load sent. */
const asText = (value: WarehouseValue): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

/**
 * Stands in for DSQL: keeps inserted rows per table and answers each
 * table's read-back query with them, as text.
 */
class FakeDsql implements SqlClient {
  readonly statements: string[] = [];
  readonly tables = new Map<string, Record<string, string | null>[]>();
  readonly manifestValues: WarehouseValue[][] = [];

  async query(text: string, values: readonly WarehouseValue[] = []) {
    this.statements.push(text);
    const insert = text.match(/^INSERT INTO ("[^"]+"\."[^"]+") \(([^)]+)\)/);
    if (insert && insert[1] === MANIFEST_TABLE) {
      this.manifestValues.push([...values]);
    } else if (insert) {
      const columns = insert[2].split(", ").map((c) => c.slice(1, -1));
      const rows = this.tables.get(insert[1]) ?? [];
      for (let i = 0; i < values.length; i += columns.length) {
        rows.push(
          Object.fromEntries(
            columns.map((c, j) => [c, asText(values[i + j] ?? null)])
          )
        );
      }
      this.tables.set(insert[1], rows);
    }
    const drop = text.match(/^DROP TABLE IF EXISTS (.+)$/);
    if (drop) this.tables.delete(drop[1]);
    const select = text.match(/^SELECT .+ FROM ("[^"]+"\."[^"]+")$/);
    return { rows: select ? (this.tables.get(select[1]) ?? []) : [] };
  }
}

describe("runDsqlLoad", () => {
  it("empties the manifest, then drops, creates and inserts, one statement per call", async () => {
    const fake = new FakeDsql();
    await runDsqlLoad(fake, schema, plan, "abc123", clock);
    const s = fake.statements;
    expect(s.slice(0, MANIFEST_DDL.length)).toEqual(MANIFEST_DDL);
    const emptied = s.indexOf(`DELETE FROM ${MANIFEST_TABLE}`);
    const firstDrop = s.findIndex((q) => q.startsWith("DROP TABLE"));
    const firstCreate = s.findIndex((q) => q.startsWith('CREATE TABLE "gold"'));
    const firstInsert = s.findIndex((q) => q.startsWith('INSERT INTO "gold"'));
    expect(emptied).toBeGreaterThan(0);
    expect(emptied).toBeLessThan(firstDrop);
    expect(firstDrop).toBeLessThan(firstCreate);
    expect(firstCreate).toBeLessThan(firstInsert);
    for (const statement of s) {
      expect(statement.trim().replace(/;$/, "")).not.toContain(";");
    }
    expect(s.at(-1)).toMatch(/^INSERT INTO "platform_meta"\."load_manifest"/);
  });

  it("passes parity and writes one manifest row per table", async () => {
    const fake = new FakeDsql();
    const result = await runDsqlLoad(fake, schema, plan, "abc123", clock);
    expect(result.ok).toBe(true);
    expect(result.tables).toHaveLength(schema.tables.length);
    expect(result.rows).toBe(totalRows);
    expect(totalRows).toBeGreaterThan(0);
    const [values] = fake.manifestValues;
    expect(values[0]).toBe("2026-10-26T19:00:00.000Z");
    expect(values).toHaveLength(1 + 5 * schema.tables.length);
    const first = plan.parity[0];
    expect(values.slice(1, 6)).toEqual([
      first.table,
      plan.schemaVersion,
      first.rowCount,
      first.fingerprint,
      "abc123",
    ]);
  });

  it("fails and leaves the manifest empty when a table reads back different", async () => {
    const fake = new FakeDsql();
    const corrupt = fake.query.bind(fake);
    fake.query = async (text, values) => {
      const answer = await corrupt(text, values);
      if (text.startsWith("SELECT") && answer.rows.length > 0) {
        const [row, ...rest] = answer.rows;
        const key = Object.keys(row)[0];
        return { rows: [{ ...row, [key]: `${row[key] ?? ""}x` }, ...rest] };
      }
      return answer;
    };
    const result = await runDsqlLoad(fake, schema, plan, "abc123", clock);
    expect(result.ok).toBe(false);
    expect(result.tables.filter((t) => !t.ok).length).toBeGreaterThan(0);
    expect(fake.manifestValues).toHaveLength(0);
    expect(summaryMarkdown(result)).toContain("FAILED");
  });

  it("summarises the load for the job page", async () => {
    const result = await runDsqlLoad(
      new FakeDsql(),
      schema,
      plan,
      "abc123",
      clock
    );
    const markdown = summaryMarkdown(result);
    expect(markdown).toContain("Aurora DSQL load passed");
    expect(markdown).toContain(`${totalRows.toLocaleString("en-US")} rows`);
    expect(
      markdown.split("\n").filter((l) => l.endsWith("| match |"))
    ).toHaveLength(schema.tables.length);
  });
});
