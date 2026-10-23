/**
 * The gold star schema as a Mermaid entity relationship diagram, and the
 * reference page that carries it, both rendered from the schema.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  WarehouseColumn,
  WarehouseSchema,
  WarehouseTable,
} from "../../types";
import { qualifiedName } from "./schema";

const MERMAID_TYPE: Readonly<Record<WarehouseColumn["type"], string>> = {
  string: "varchar",
  integer: "int",
  decimal: "decimal",
  boolean: "boolean",
  date: "date",
  timestamp: "timestamptz",
};

function keyMarks(table: WarehouseTable, column: WarehouseColumn): string {
  const marks: string[] = [];
  if (table.primaryKey.includes(column.name)) marks.push("PK");
  if (column.references !== null) marks.push("FK");
  if (
    marks.length === 0 &&
    table.uniqueKeys.some((u) => u.includes(column.name))
  ) {
    marks.push("UK");
  }
  return marks.length === 0 ? "" : ` ${marks.join(", ")}`;
}

/**
 * Renders the gold layer as a Mermaid `erDiagram`: every dimension and fact
 * with its columns and keys, and one relationship per foreign key. A
 * nullable foreign key is drawn as zero-or-one on the dimension side.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @returns Mermaid source, without a code fence.
 */
export function renderWarehouseErd(schema: WarehouseSchema): string {
  const gold = schema.tables.filter((t) => t.layer === "gold");
  const lines = ["erDiagram"];
  for (const table of gold) {
    lines.push(`  ${table.name} {`);
    for (const column of table.columns) {
      lines.push(
        `    ${MERMAID_TYPE[column.type]} ${column.name}${keyMarks(table, column)}`
      );
    }
    lines.push("  }");
  }
  for (const table of gold) {
    for (const column of table.columns) {
      const ref = column.references;
      if (ref === null) continue;
      const target = ref.table.split(".")[1];
      const left = column.nullable ? "|o" : "||";
      lines.push(`  ${target} ${left}--o{ ${table.name} : "${column.name}"`);
    }
  }
  return lines.join("\n");
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

function code(names: readonly string[]): string {
  return names.map((n) => `\`${n}\``).join(", ");
}

/**
 * Renders the warehouse reference page: the ERD, every fact's grain and
 * keys, every dimension's keys and history, the silver tables, and the
 * columns of each gold table.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @returns Markdown, ending in a newline.
 */
export function renderWarehouseReference(schema: WarehouseSchema): string {
  const gold = schema.tables.filter((t) => t.layer === "gold");
  const facts = gold.filter((t) => t.kind === "fact");
  const dims = gold.filter((t) => t.kind === "dimension");
  const silver = schema.tables.filter((t) => t.layer === "silver");
  const out: string[] = [
    "# Clinical Data Platform star schema",
    "",
    "<!-- Generated from WAREHOUSE_SCHEMA by scripts/generate-warehouse-artifacts.ts. Do not edit by hand. -->",
    "",
    `Schema version ${schema.version}. ${SYNTHETIC_DATA_NOTICE}`,
    "",
    "The silver and gold layers of the Clinical Data Platform",
    "([ADR 0066](../../adr/0066-clinical-data-platform-architecture.md)),",
    "described once in `WAREHOUSE_SCHEMA` (`lib/clinical-platform`). The DDL for",
    "DuckDB, PostgreSQL and SQL Server, the CSV manifest, this page and its",
    "diagram are all generated from that description. Regenerate this page and",
    "the golden DDL with `npx tsx scripts/generate-warehouse-artifacts.ts`; a",
    "unit test fails when they drift.",
    "",
    "## Entity relationship diagram",
    "",
    "```mermaid",
    renderWarehouseErd(schema),
    "```",
    "",
    "## Facts",
    "",
    "| Fact | Grain | Primary key | Dimensions |",
    "| --- | --- | --- | --- |",
    ...facts.map((t) => {
      const refs = [
        ...new Set(
          t.columns
            .filter((c) => c.references !== null)
            .map((c) => c.references?.table.split(".")[1] ?? "")
        ),
      ];
      return `| \`${t.name}\` | ${cell(t.grain)} | ${code(t.primaryKey)} | ${code(refs)} |`;
    }),
    "",
    "## Dimensions",
    "",
    "| Dimension | Grain | Surrogate key | Natural key | History |",
    "| --- | --- | --- | --- | --- |",
    ...dims.map((t) => {
      const history =
        t.scd2 === null
          ? "Type 1"
          : `Type 2 on ${code(t.scd2.trackedColumns)}, valid from ${code([t.scd2.validFrom])} to ${code([t.scd2.validTo])}`;
      return `| \`${t.name}\` | ${cell(t.grain)} | ${code(t.primaryKey)} | ${code(t.scd2 === null ? (t.uniqueKeys[0] ?? []) : [t.scd2.naturalKey])} | ${history} |`;
    }),
    "",
    "A `dim_site` version is in force from `valid_from` up to, not including,",
    "`valid_to`; the current version ends on 9999-12-31. A fact joins the version",
    "in force on its own date, so a visit before a principal investigator change",
    "keeps the earlier investigator.",
    "",
    "## Silver tables",
    "",
    "| Table | Grain | Primary key | Source |",
    "| --- | --- | --- | --- |",
    ...silver.map((t) => {
      const sources = [
        ...new Set(
          t.columns.flatMap((c) =>
            c.lineage.map((ref) => ref.split(".").slice(0, -1).join("."))
          )
        ),
      ];
      return `| \`${t.name}\` | ${cell(t.grain)} | ${code(t.primaryKey)} | ${code(sources)} |`;
    }),
  ];
  for (const table of gold) {
    out.push(
      "",
      `## \`${qualifiedName(table)}\``,
      "",
      cell(table.description),
      "",
      "| Column | Type | Null | Key | Classification | Description |",
      "| --- | --- | --- | --- | --- | --- |",
      ...table.columns.map((c) => {
        const key = keyMarks(table, c).trim();
        const fk = c.references === null ? "" : ` to \`${c.references.table}\``;
        return `| \`${c.name}\` | ${c.type} | ${c.nullable ? "yes" : "no"} | ${key}${fk} | ${c.classification} | ${cell(c.description)} |`;
      })
    );
  }
  return `${out.join("\n")}\n`;
}
