/**
 * The semantic layer's dimensions, and how each one is reached from the
 * table a measure reads. Paths are derived from the foreign keys and natural
 * keys `WAREHOUSE_SCHEMA` declares, so they cannot disagree with the star
 * schema.
 */
import type {
  MetricDimension,
  MetricDimensionId,
  WarehouseTable,
} from "../../types";
import { WAREHOUSE_SCHEMA, qualifiedName } from "../warehouse/schema";

/** The dimensions a metric may be grouped or filtered by. */
export const METRIC_DIMENSIONS: readonly MetricDimension[] = Object.freeze([
  {
    id: "study",
    label: "Study",
    description: "Protocol id, for example DEMO-301.",
    table: "gold.dim_study",
    column: "study_id",
  },
  {
    id: "study_status",
    label: "Study status",
    description: "Lifecycle status of the study at the data cut.",
    table: "gold.dim_study",
    column: "study_status",
  },
  {
    id: "therapeutic_area",
    label: "Therapeutic area",
    description: "Therapeutic area of the study.",
    table: "gold.dim_study",
    column: "therapeutic_area",
  },
  {
    id: "phase",
    label: "Phase",
    description: "Development phase or device study stage.",
    table: "gold.dim_study",
    column: "phase",
  },
  {
    id: "product_type",
    label: "Product type",
    description: "Investigational product type: drug, biologic or device.",
    table: "gold.dim_study",
    column: "product_type",
  },
  {
    id: "operating_model",
    label: "Operating model",
    description: "Who runs the study: the sponsor or a CRO.",
    table: "gold.dim_study",
    column: "operating_model",
  },
  {
    id: "site",
    label: "Site",
    description: "Site id; every version of a site rolls up to it.",
    table: "gold.dim_site",
    column: "site_id",
  },
  {
    id: "country",
    label: "Country",
    description: "ISO 3166-1 alpha-2 country code of the site.",
    table: "gold.dim_country",
    column: "country_code",
  },
  {
    id: "region",
    label: "Region",
    description: "Operational region of the site's country.",
    table: "gold.dim_country",
    column: "region",
  },
  {
    id: "month",
    label: "Month",
    description:
      "Calendar month, as YYYY-MM, of the date each measure is dated by.",
    table: "gold.dim_date",
    column: "year_month",
  },
  {
    id: "vendor",
    label: "Vendor",
    description: "Fictional vendor name; investigator grants have none.",
    table: "gold.dim_vendor",
    column: "vendor_name",
  },
  {
    id: "deviation_category",
    label: "Deviation category",
    description:
      "What a protocol deviation concerns, for example Informed consent process.",
    table: "gold.fct_deviation",
    column: "deviation_category",
  },
  {
    id: "deviation_importance",
    label: "Deviation importance",
    description:
      "Whether a protocol deviation is important (after ICH E3) or not.",
    table: "gold.fct_deviation",
    column: "importance",
  },
  {
    id: "queried_form",
    label: "Queried form",
    description:
      "CRF form of the queried field, named by its CDASH domain, for example VS.",
    table: "gold.fct_query",
    column: "queried_form",
  },
  {
    id: "screen_failure_reason",
    label: "Screen failure reason",
    description:
      "Why screening failed, for example Inclusion criterion not met; empty for any subject who did not fail screening.",
    table: "gold.fct_enrollment",
    column: "screen_failure_reason",
  },
] as const satisfies readonly MetricDimension[]);

const BY_ID = new Map(METRIC_DIMENSIONS.map((d) => [d.id, d]));

const TABLES = new Map(
  WAREHOUSE_SCHEMA.tables.map((t) => [qualifiedName(t), t])
);

/** The dimension with an id. */
export function dimension(id: MetricDimensionId): MetricDimension {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`unknown dimension ${String(id)}`);
  return found;
}

/** The warehouse table with a qualified name, or `undefined`. */
export function warehouseTable(name: string): WarehouseTable | undefined {
  return TABLES.get(name);
}

/**
 * How a measure's row reaches a dimension attribute: a column of the row
 * itself, or a column of a dimension table joined on `join.from = join.to`.
 */
export interface DimensionPath {
  /** Dimension id. */
  readonly id: MetricDimensionId;
  /** Qualified table holding the attribute. */
  readonly table: string;
  /** Attribute column. */
  readonly column: string;
  /** Join from the measure's table, or `null` when the attribute is on it. */
  readonly join: { readonly from: string; readonly to: string } | null;
}

/**
 * Resolves a dimension for a measure's table. A dimension is reachable when
 * the table is the dimension's own table, when it has a foreign key to that
 * table, or when it carries the dimension table's single-column natural key
 * (as `dim_site` carries `study_id`). `month` is reached through the
 * measure's time key only.
 *
 * @param table - Qualified table the measure reads.
 * @param timeKey - The measure's date key column, or `null`.
 * @param id - Dimension to reach.
 * @returns The path, or `null` when the table cannot reach the dimension.
 */
export function resolveDimension(
  table: string,
  timeKey: string | null,
  id: MetricDimensionId
): DimensionPath | null {
  const target = dimension(id);
  if (id === "month") {
    return timeKey === null
      ? null
      : {
          id,
          table: target.table,
          column: target.column,
          join: { from: timeKey, to: "date_key" },
        };
  }
  const source = TABLES.get(table);
  const home = TABLES.get(target.table);
  if (source === undefined || home === undefined) return null;
  if (table === target.table) {
    return { id, table, column: target.column, join: null };
  }
  const foreignKey = source.columns.find(
    (c) => c.references?.table === target.table
  );
  if (foreignKey?.references) {
    return {
      id,
      table: target.table,
      column: target.column,
      join: { from: foreignKey.name, to: foreignKey.references.column },
    };
  }
  const naturalKey = home.uniqueKeys.some(
    (key) => key.length === 1 && key[0] === target.column
  );
  if (naturalKey && source.columns.some((c) => c.name === target.column)) {
    return { id, table, column: target.column, join: null };
  }
  return null;
}
