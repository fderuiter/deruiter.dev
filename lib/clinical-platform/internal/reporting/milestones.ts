/**
 * A study's CTMS milestones, planned against actual, as the operations and
 * portfolio dashboards show them (#2630, #2911). They come straight from
 * `gold.fct_milestone`, outside the metric registry: a milestone is a
 * dated fact, not an aggregate.
 */
import type {
  MilestoneKind,
  OperationsMilestone,
  Warehouse,
  WarehouseRow,
} from "../../types";

/** Tables a milestone list reads. */
export const MILESTONE_TABLES = ["gold.dim_milestone", "gold.fct_milestone"];

function rows(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

/** `20240603` as `2024-06-03`. */
function isoDate(key: number): string {
  const digits = String(key);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * The milestones of one study, in milestone order.
 *
 * @param warehouse - The warehouse.
 * @param studyKey - The study's `study_key` in `gold.dim_study`.
 * @returns Each milestone with its kind, the study's own label, and its planned and actual dates.
 */
export function studyMilestones(
  warehouse: Warehouse,
  studyKey: unknown
): (OperationsMilestone & { readonly kind: MilestoneKind })[] {
  const kinds = new Map(
    rows(warehouse, "gold.dim_milestone").map((m) => [m.milestone_key, m])
  );
  return rows(warehouse, "gold.fct_milestone")
    .filter((m) => m.study_key === studyKey)
    .slice()
    .sort(
      (a, b) =>
        Number(kinds.get(a.milestone_key)?.milestone_sequence) -
        Number(kinds.get(b.milestone_key)?.milestone_sequence)
    )
    .map((m) => ({
      kind: String(
        kinds.get(m.milestone_key)?.milestone_kind ?? ""
      ) as MilestoneKind,
      label: String(m.milestone_label ?? ""),
      planned: isoDate(Number(m.planned_date_key)),
      actual:
        typeof m.actual_date_key === "number"
          ? isoDate(m.actual_date_key)
          : null,
      varianceDays:
        typeof m.variance_days === "number" ? m.variance_days : null,
    }));
}
