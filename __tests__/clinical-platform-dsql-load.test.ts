// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  fingerprintDsqlRows,
  generatePortfolio,
  planDsqlLoad,
  type WarehouseColumn,
  type WarehouseSchema,
  type WarehouseTable,
  type WarehouseValue,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const gold: WarehouseSchema = {
  ...WAREHOUSE_SCHEMA,
  tables: WAREHOUSE_SCHEMA.tables.filter((table) => table.layer === "gold"),
};
const plan = planDsqlLoad(gold, warehouse);
const qualified = (table: WarehouseTable) => `${table.layer}.${table.name}`;

/** What PostgreSQL's text output gives for a stored value, as the read-back query asks. */
function asPostgresText(
  column: WarehouseColumn,
  value: WarehouseValue
): string | null {
  if (value === null) return null;
  switch (column.type) {
    case "decimal":
      return (value as number).toFixed(column.scale ?? 0);
    case "boolean":
      return value ? "true" : "false";
    default:
      return String(value);
  }
}

const readBack = (table: WarehouseTable) =>
  (warehouse.tables[qualified(table)] ?? []).map((row) =>
    Object.fromEntries(
      table.columns.map((c) => [c.name, asPostgresText(c, row[c.name] ?? null)])
    )
  );

describe("planDsqlLoad", () => {
  it("drops dependants first and creates referenced tables first", () => {
    const names = gold.tables.map((t) => `"${t.layer}"."${t.name}"`);
    expect(plan.drop).toEqual(
      [...names].reverse().map((n) => `DROP TABLE IF EXISTS ${n}`)
    );
    expect(plan.create[0]).toBe('CREATE SCHEMA IF NOT EXISTS "gold";');
    expect(plan.create).toHaveLength(gold.tables.length + 1);
    plan.create.slice(1).forEach((statement, index) => {
      expect(statement.startsWith(`CREATE TABLE ${names[index]} (`)).toBe(true);
    });
  });

  it("writes one statement per element and no descriptions", () => {
    for (const statement of [...plan.drop, ...plan.create]) {
      expect(statement).not.toMatch(/COMMENT ON/);
      expect(statement.trim().replace(/;$/, "")).not.toContain(";");
    }
  });

  it("references only tables created earlier in the plan", () => {
    const created = new Set<string>();
    for (const statement of plan.create.slice(1)) {
      for (const [, target] of statement.matchAll(
        /REFERENCES ("[^"]+"\."[^"]+")/g
      )) {
        expect(created.has(target)).toBe(true);
      }
      created.add(statement.match(/^CREATE TABLE ("[^"]+"\."[^"]+")/)![1]);
    }
  });

  it("inserts every row once, in batches under DSQL's 3,000-row limit", () => {
    for (const table of gold.tables) {
      const batches = plan.inserts.filter((b) => b.table === qualified(table));
      const rows = warehouse.tables[qualified(table)] ?? [];
      expect(batches.reduce((sum, b) => sum + b.rowCount, 0)).toBe(rows.length);
      for (const batch of batches) {
        expect(batch.rowCount).toBeLessThanOrEqual(1_000);
        expect(batch.values).toHaveLength(
          batch.rowCount * table.columns.length
        );
        expect(batch.text).toContain(`$${batch.values.length})`);
        expect(batch.text).not.toContain(`$${batch.values.length + 1}`);
      }
    }
    const order = [...new Set(plan.inserts.map((b) => b.table))];
    const schemaOrder = gold.tables.map(qualified);
    expect(order).toEqual(schemaOrder.filter((t) => order.includes(t)));
  });

  it("sends decimals as text at their scale and keeps nulls", () => {
    const table = gold.tables.find((t) =>
      t.columns.some((c) => c.type === "decimal")
    )!;
    const index = table.columns.findIndex((c) => c.type === "decimal");
    const column = table.columns[index];
    const batch = plan.inserts.find((b) => b.table === qualified(table))!;
    const first = batch.values[index];
    if (first !== null) {
      expect(typeof first).toBe("string");
      expect(String(first)).toMatch(
        new RegExp(`^-?\\d+${column.scale ? `\\.\\d{${column.scale}}` : ""}$`)
      );
    }
  });

  it("respects a smaller batch size and rejects one past DSQL's limit", () => {
    const small = planDsqlLoad(gold, warehouse, { maxRowsPerInsert: 50 });
    expect(
      Math.max(...small.inserts.map((b) => b.rowCount))
    ).toBeLessThanOrEqual(50);
    expect(() =>
      planDsqlLoad(gold, warehouse, { maxRowsPerInsert: 3_001 })
    ).toThrow(RangeError);
    expect(() =>
      planDsqlLoad(gold, warehouse, { maxRowsPerInsert: 0 })
    ).toThrow(RangeError);
  });

  it("stores timestamps at whole seconds in UTC, as the read-back format assumes", () => {
    for (const table of gold.tables) {
      for (const column of table.columns.filter(
        (c) => c.type === "timestamp"
      )) {
        for (const row of warehouse.tables[qualified(table)] ?? []) {
          const value = row[column.name];
          if (value !== null && value !== undefined) {
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
          }
        }
      }
    }
  });

  it("fits well inside DSQL's 1 GB free storage", () => {
    expect(plan.csvBytes).toBeGreaterThan(0);
    expect(plan.csvBytes).toBeLessThan(100 * 1024 * 1024);
  });
});

describe("fingerprintDsqlRows", () => {
  it("matches the plan for every table read back as PostgreSQL text", () => {
    for (const table of gold.tables) {
      const parity = plan.parity.find((p) => p.table === qualified(table))!;
      const rows = readBack(table);
      expect(parity.rowCount).toBe(rows.length);
      expect(fingerprintDsqlRows(table, rows)).toBe(parity.fingerprint);
      expect(fingerprintDsqlRows(table, [...rows].reverse())).toBe(
        parity.fingerprint
      );
    }
  });

  it("changes when one value, one null or one row changes", () => {
    const table = gold.tables.find(
      (t) => (warehouse.tables[qualified(t)] ?? []).length > 2
    )!;
    const rows = readBack(table);
    const { fingerprint } = plan.parity.find(
      (p) => p.table === qualified(table)
    )!;
    const column = table.columns.find((c) => c.type === "string")!;
    const edited = rows.map((r, i) =>
      i === 0 ? { ...r, [column.name]: `${r[column.name] ?? ""}x` } : r
    );
    expect(fingerprintDsqlRows(table, edited)).not.toBe(fingerprint);
    expect(fingerprintDsqlRows(table, rows.slice(1))).not.toBe(fingerprint);
  });

  it("tells an empty string from a null and quotes text the way the CSV export does", () => {
    const table: WarehouseTable = {
      ...gold.tables[0],
      columns: [
        {
          ...gold.tables[0].columns[0],
          name: "label",
          type: "string",
          nullable: true,
        },
      ],
    };
    const empty = fingerprintDsqlRows(table, [{ label: "" }]);
    const missing = fingerprintDsqlRows(table, [{ label: null }]);
    expect(empty).not.toBe(missing);
    expect(fingerprintDsqlRows(table, [{ label: 'a, "b"' }])).not.toBe(
      fingerprintDsqlRows(table, [{ label: "a" }, { label: ' "b"' }])
    );
  });

  it("reads every column back as text the fingerprint can compare", () => {
    for (const parity of plan.parity) {
      expect(parity.readback).toMatch(/^SELECT .+ FROM "gold"\."[a-z_]+"$/);
    }
    const anyBoolean = plan.parity.some((p) =>
      p.readback.includes("CASE WHEN")
    );
    const anyDate = plan.parity.some((p) =>
      p.readback.includes("'YYYY-MM-DD')")
    );
    expect(anyBoolean || anyDate).toBe(true);
  });
});
