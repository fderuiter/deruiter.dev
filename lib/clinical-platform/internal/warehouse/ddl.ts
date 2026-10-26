/**
 * DDL emitters: one schema description, written as DuckDB, PostgreSQL and
 * SQL Server T-SQL. Each dialect gets its own identifier quoting, types,
 * constraint syntax and comment mechanism.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  SqlDialect,
  WarehouseColumn,
  WarehouseSchema,
  WarehouseTable,
} from "../../types";

interface Dialect {
  readonly label: string;
  quote(identifier: string): string;
  type(column: WarehouseColumn): string;
  createSchema(name: string): string;
  /** Statements that attach descriptions to a table and its columns. */
  comments(table: WarehouseTable): string[];
  /** Separator written after each table's statements. */
  readonly batchEnd: string;
}

function doubleQuote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function singleQuote(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

function standardComments(
  table: WarehouseTable,
  quote: (identifier: string) => string
): string[] {
  const name = `${quote(table.layer)}.${quote(table.name)}`;
  return [
    `COMMENT ON TABLE ${name} IS ${singleQuote(`${table.description} Grain: ${table.grain}`)};`,
    ...table.columns.map(
      (column) =>
        `COMMENT ON COLUMN ${name}.${quote(column.name)} IS ${singleQuote(column.description)};`
    ),
  ];
}

const DIALECTS: Readonly<Record<SqlDialect, Dialect>> = {
  duckdb: {
    label: "DuckDB",
    quote: doubleQuote,
    type(column) {
      switch (column.type) {
        case "string":
          return "VARCHAR";
        case "integer":
          return "INTEGER";
        case "decimal":
          return `DECIMAL(${column.precision}, ${column.scale})`;
        case "boolean":
          return "BOOLEAN";
        case "date":
          return "DATE";
        case "timestamp":
          return "TIMESTAMPTZ";
      }
    },
    createSchema: (name) => `CREATE SCHEMA IF NOT EXISTS ${doubleQuote(name)};`,
    comments: (table) => standardComments(table, doubleQuote),
    batchEnd: "",
  },
  postgres: {
    label: "PostgreSQL",
    quote: doubleQuote,
    type(column) {
      switch (column.type) {
        case "string":
          return `VARCHAR(${column.length})`;
        case "integer":
          return "INTEGER";
        case "decimal":
          return `NUMERIC(${column.precision}, ${column.scale})`;
        case "boolean":
          return "BOOLEAN";
        case "date":
          return "DATE";
        case "timestamp":
          return "TIMESTAMPTZ";
      }
    },
    createSchema: (name) => `CREATE SCHEMA IF NOT EXISTS ${doubleQuote(name)};`,
    comments: (table) => standardComments(table, doubleQuote),
    batchEnd: "",
  },
  tsql: {
    label: "SQL Server T-SQL",
    quote: (identifier) => `[${identifier.replaceAll("]", "]]")}]`,
    type(column) {
      switch (column.type) {
        case "string":
          return `NVARCHAR(${column.length})`;
        case "integer":
          return "INT";
        case "decimal":
          return `DECIMAL(${column.precision}, ${column.scale})`;
        case "boolean":
          return "BIT";
        case "date":
          return "DATE";
        case "timestamp":
          return "DATETIMEOFFSET(0)";
      }
    },
    createSchema: (name) =>
      `IF SCHEMA_ID(N${singleQuote(name)}) IS NULL EXEC(N${singleQuote(`CREATE SCHEMA [${name}]`)});`,
    comments(table) {
      const property = (value: string, column?: string) =>
        [
          "EXEC sys.sp_addextendedproperty",
          `@name = N'MS_Description', @value = N${singleQuote(value)},`,
          `@level0type = N'SCHEMA', @level0name = N${singleQuote(table.layer)},`,
          `@level1type = N'TABLE', @level1name = N${singleQuote(table.name)}` +
            (column === undefined
              ? ";"
              : `,\n  @level2type = N'COLUMN', @level2name = N${singleQuote(column)};`),
        ].join("\n  ");
      return [
        property(`${table.description} Grain: ${table.grain}`),
        ...table.columns.map((column) =>
          property(column.description, column.name)
        ),
      ];
    },
    batchEnd: "GO",
  },
};

/** Name of a constraint, unique across the warehouse and at most 63 characters. */
export function constraintName(
  kind: "pk" | "uq" | "fk" | "ck",
  table: WarehouseTable,
  suffix = ""
): string {
  const name = `${kind}_${table.name}${suffix ? `_${suffix}` : ""}`;
  return name.length <= 63 ? name : name.slice(0, 63);
}

function createTable(table: WarehouseTable, dialect: Dialect): string {
  const q = dialect.quote;
  const width = Math.max(...table.columns.map((c) => q(c.name).length));
  const lines = table.columns.map(
    (column) =>
      `  ${q(column.name).padEnd(width)} ${dialect.type(column)}${column.nullable ? "" : " NOT NULL"}`
  );
  const list = (columns: readonly string[]) => columns.map(q).join(", ");
  lines.push(
    `  CONSTRAINT ${q(constraintName("pk", table))} PRIMARY KEY (${list(table.primaryKey)})`
  );
  table.uniqueKeys.forEach((columns, index) => {
    lines.push(
      `  CONSTRAINT ${q(constraintName("uq", table, String(index + 1)))} UNIQUE (${list(columns)})`
    );
  });
  for (const column of table.columns) {
    const ref = column.references;
    if (ref === null) continue;
    const [layer, name] = ref.table.split(".");
    lines.push(
      `  CONSTRAINT ${q(constraintName("fk", table, column.name))} FOREIGN KEY (${q(column.name)}) REFERENCES ${q(layer)}.${q(name)} (${q(ref.column)})`
    );
  }
  for (const sequence of table.sequences) {
    for (let i = 1; i < sequence.length; i += 1) {
      const [before, after] = [q(sequence[i - 1]), q(sequence[i])];
      lines.push(
        `  CONSTRAINT ${q(constraintName("ck", table, sequence[i]))} CHECK (${after} IS NULL OR (${before} IS NOT NULL AND ${before} <= ${after}))`
      );
    }
  }
  return `CREATE TABLE ${q(table.layer)}.${q(table.name)} (\n${lines.join(",\n")}\n);`;
}

/**
 * `CREATE SCHEMA` for each layer, then `CREATE TABLE` for each table, as
 * separate statements without descriptions: Aurora DSQL runs one DDL
 * statement per transaction (ADR 0070).
 *
 * @param schema - The schema or a subset of it, in schema order.
 * @returns One PostgreSQL statement per element.
 */
export function postgresStatements(schema: WarehouseSchema): string[] {
  const d = DIALECTS.postgres;
  const layers = [...new Set(schema.tables.map((t) => t.layer))];
  return [
    ...layers.map((layer) => d.createSchema(layer)),
    ...schema.tables.map((table) => createTable(table, d)),
  ];
}

/**
 * Writes the warehouse DDL for one SQL dialect: schemas, then every table
 * with its columns, primary key, unique keys, foreign keys and the checks
 * that keep its date sequences in order, then its
 * table and column descriptions (`COMMENT ON` in DuckDB and PostgreSQL,
 * `MS_Description` extended properties in T-SQL). Tables come in schema
 * order, so every foreign key's target exists before it is referenced.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @param dialect - `duckdb`, `postgres` or `tsql`.
 * @returns The DDL script, ending in a newline.
 */
export function emitDdl(schema: WarehouseSchema, dialect: SqlDialect): string {
  const d = DIALECTS[dialect];
  const layers = [...new Set(schema.tables.map((t) => t.layer))];
  const blocks: string[] = [
    [
      `-- Clinical Data Platform warehouse, schema ${schema.version}, ${d.label} dialect.`,
      `-- Generated from WAREHOUSE_SCHEMA in lib/clinical-platform; do not edit by hand.`,
      `-- ${SYNTHETIC_DATA_NOTICE}`,
    ].join("\n"),
    layers.map((layer) => d.createSchema(layer)).join("\n"),
  ];
  if (d.batchEnd) blocks[1] += `\n${d.batchEnd}`;
  for (const table of schema.tables) {
    const statements = [createTable(table, d), ...d.comments(table)];
    if (d.batchEnd) statements.push(d.batchEnd);
    blocks.push(statements.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}
