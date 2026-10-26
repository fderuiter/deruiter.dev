/**
 * A small builder for the warehouse schema description, so each column is
 * one line: name, type, description and only what differs from the table's
 * defaults.
 */
import type {
  DataClassification,
  Scd2Definition,
  WarehouseColumn,
  WarehouseColumnType,
  WarehouseLayer,
  WarehouseTable,
  WarehouseTableKind,
} from "../../types";

/** Optional settings of one column. */
export interface ColumnOptions {
  /** May hold `null`. Default `false`. */
  readonly nullable?: boolean;
  /** Maximum string length. Default 64 for strings. */
  readonly length?: number;
  /** Decimal precision and scale. Default 12 and 4 for decimals. */
  readonly precision?: number;
  readonly scale?: number;
  /** Classification, when it differs from the table's. */
  readonly classification?: DataClassification;
  /** Foreign key target as `layer.table.column`. */
  readonly ref?: string;
  /**
   * Source columns. A name without a dot is a column of the table's
   * `source`. Default: the column of the same name in `source` (for silver,
   * the bronze field in camel case); `[]` marks a generated column.
   */
  readonly from?: readonly string[];
  /** Transformation. Default `identity`, or `generated` without sources. */
  readonly how?: string;
}

/** One column as written in the schema: name, type, description, options. */
export type ColumnDraft = readonly [
  name: string,
  type: WarehouseColumnType,
  description: string,
  options?: ColumnOptions,
];

/** One table as written in the schema. */
export interface TableDraft {
  readonly layer: WarehouseLayer;
  readonly name: string;
  readonly kind: WarehouseTableKind;
  readonly description: string;
  readonly grain: string;
  readonly primaryKey: readonly string[];
  readonly uniqueKeys?: readonly (readonly string[])[];
  readonly scd2?: Scd2Definition;
  /** Date or date-key columns reached in order. Default none. */
  readonly sequences?: readonly (readonly string[])[];
  /** Default classification of the table's columns. */
  readonly classification: DataClassification;
  /** Default lineage source, as `layer.product`, or `null` for generated tables. */
  readonly source: string | null;
  /** Whether rows describe synthetic records and carry `is_synthetic`. */
  readonly synthetic: boolean;
  readonly columns: readonly ColumnDraft[];
}

function camelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function resolveSources(
  draft: TableDraft,
  name: string,
  from: readonly string[] | undefined
): string[] {
  const source = draft.source;
  if (from === undefined) {
    if (source === null) return [];
    const field = draft.layer === "silver" ? camelCase(name) : name;
    return [`${source}.${field}`];
  }
  return from.map((ref) => {
    if (ref.includes(".")) return ref;
    if (source === null) {
      throw new Error(`${draft.name}.${name}: "${ref}" needs a source table`);
    }
    return `${source}.${ref}`;
  });
}

function toColumn(draft: TableDraft, spec: ColumnDraft): WarehouseColumn {
  const [name, type, description, options = {}] = spec;
  const lineage = resolveSources(draft, name, options.from);
  let references: WarehouseColumn["references"] = null;
  if (options.ref !== undefined) {
    const parts = options.ref.split(".");
    references = {
      table: `${parts[0]}.${parts[1]}`,
      column: parts[2],
    };
  }
  return {
    name,
    type,
    nullable: options.nullable ?? false,
    description,
    classification: options.classification ?? draft.classification,
    length: type === "string" ? (options.length ?? 64) : null,
    precision: type === "decimal" ? (options.precision ?? 12) : null,
    scale: type === "decimal" ? (options.scale ?? 4) : null,
    references,
    lineage,
    transformation:
      options.how ?? (lineage.length === 0 ? "generated" : "identity"),
  };
}

/**
 * Builds one table description from its draft, adding `is_synthetic` to
 * tables whose rows describe synthetic records.
 */
export function defineTable(draft: TableDraft): WarehouseTable {
  const columns = draft.columns.map((spec) => toColumn(draft, spec));
  if (draft.synthetic) {
    columns.push(
      toColumn(draft, [
        "is_synthetic",
        "boolean",
        "Always true: the row describes synthetic data, nothing real.",
        {
          classification: "public",
          from:
            draft.source === null
              ? []
              : [draft.layer === "silver" ? "synthetic" : "is_synthetic"],
          how: draft.source === null ? "constant" : "identity",
        },
      ])
    );
  }
  return {
    layer: draft.layer,
    name: draft.name,
    kind: draft.kind,
    description: draft.description,
    grain: draft.grain,
    primaryKey: draft.primaryKey,
    uniqueKeys: draft.uniqueKeys ?? [],
    scd2: draft.scd2 ?? null,
    sequences: draft.sequences ?? [],
    columns,
  };
}
