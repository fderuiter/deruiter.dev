/**
 * Column-level lineage of the warehouse, read from the schema description.
 */
import type {
  ColumnRef,
  LineageEdge,
  MedallionLayer,
  WarehouseSchema,
} from "../../types";

const LAYERS: readonly MedallionLayer[] = ["bronze", "silver", "gold"];

/**
 * Parses a lineage reference such as `bronze.edc.subjects.subjectId` or
 * `silver.edc_visit.visit_date` into a column reference. The product is
 * everything between the layer and the column, prefixed with the layer.
 *
 * @throws RangeError when the reference has no known layer, product or column.
 */
export function parseColumnRef(ref: string): ColumnRef {
  const parts = ref.split(".");
  const layer = LAYERS.find((l) => l === parts[0]);
  if (layer === undefined || parts.length < 3) {
    throw new RangeError(`"${ref}" is not layer.product.column`);
  }
  return {
    productId: parts.slice(0, -1).join("."),
    layer,
    column: parts[parts.length - 1],
  };
}

/**
 * Lists the warehouse's column-level lineage edges: one per source column
 * of every silver and gold column, in schema order. Every edge must pass
 * `checkLayerFlow`.
 *
 * @param schema - The schema, normally `WAREHOUSE_SCHEMA`.
 * @returns The edges.
 */
export function warehouseLineage(schema: WarehouseSchema): LineageEdge[] {
  return schema.tables.flatMap((table) =>
    table.columns.flatMap((column) =>
      column.lineage.map((ref) => ({
        from: parseColumnRef(ref),
        to: {
          productId: `${table.layer}.${table.name}`,
          layer: table.layer,
          column: column.name,
        },
        transformation: column.transformation,
      }))
    )
  );
}
