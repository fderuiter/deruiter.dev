/**
 * The in-memory evaluator: computes a governed metric over the gold tables of
 * a built warehouse, for the site's own dashboards. It follows SQL semantics
 * on purpose (inner joins to dimensions, a `null` operand never matching,
 * aggregates skipping `null`), and a DuckDB test checks it against the
 * compiled SQL on the same data.
 */
import type {
  MetricAggregation,
  MetricDefinition,
  MetricExpression,
  MetricPredicate,
  MetricQuery,
  MetricResult,
  MetricResultRow,
  Warehouse,
  WarehouseRow,
  WarehouseValue,
} from "../../types";
import { daysBetween } from "../warehouse/dates";
import type { DimensionPath } from "./dimensions";
import {
  ADDITIVE,
  planMetric,
  type PlannedFilter,
  type SourcePlan,
} from "./plan";

/** One group's dimension values and aggregate. */
interface Group {
  readonly values: readonly (string | null)[];
  readonly value: number | null;
}

type Groups = Map<string, Group>;

/** ISO 8601 date of a `YYYYMMDD` date key. */
function dateOfKey(key: number): string {
  const text = String(key).padStart(8, "0");
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

/** Linear interpolation between closest ranks: R type 7, SQL `percentile_cont`. */
export function percentile(
  values: readonly number[],
  p: number
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function aggregate(
  aggregation: MetricAggregation,
  rowCount: number,
  values: readonly WarehouseValue[]
): number | null {
  const numbers = values.filter((v): v is number => typeof v === "number");
  switch (aggregation) {
    case "count":
      return rowCount;
    case "count-distinct":
      return new Set(values.filter((v) => v !== null)).size;
    case "sum":
      return numbers.reduce((total, v) => total + v, 0);
    case "mean":
      return numbers.length === 0
        ? null
        : numbers.reduce((total, v) => total + v, 0) / numbers.length;
    case "median":
      return percentile(numbers, 0.5);
    case "p90":
      return percentile(numbers, 0.9);
  }
}

/** Evaluates one metric over one warehouse; see `evaluateMetric`. */
class Evaluator {
  private readonly indexes = new Map<
    string,
    Map<WarehouseValue, WarehouseRow>
  >();

  constructor(
    private readonly warehouse: Warehouse,
    private readonly dataCut: string | null
  ) {}

  private rows(table: string): readonly WarehouseRow[] {
    const rows = this.warehouse.tables[table];
    if (rows === undefined) throw new Error(`the warehouse has no ${table}`);
    return rows;
  }

  private index(table: string, column: string) {
    const id = `${table}|${column}`;
    let index = this.indexes.get(id);
    if (index === undefined) {
      index = new Map(this.rows(table).map((row) => [row[column], row]));
      this.indexes.set(id, index);
    }
    return index;
  }

  /** The attribute a path reaches from a row; `undefined` when the join finds no row. */
  private attribute(
    row: WarehouseRow,
    path: DimensionPath
  ): WarehouseValue | undefined {
    if (path.join === null) return row[path.column];
    const target = this.index(path.table, path.join.to).get(
      row[path.join.from]
    );
    return target === undefined ? undefined : target[path.column];
  }

  expression(row: WarehouseRow, expression: MetricExpression): WarehouseValue {
    switch (expression.kind) {
      case "column":
        return row[expression.column] ?? null;
      case "literal":
        return expression.value;
      case "date-of-key": {
        const key = row[expression.column];
        return typeof key === "number" ? dateOfKey(key) : null;
      }
      case "data-cut":
        return this.dataCut;
      case "days-between": {
        const from = this.expression(row, expression.from);
        const to = this.expression(row, expression.to);
        return typeof from === "string" && typeof to === "string"
          ? daysBetween(from, to)
          : null;
      }
    }
  }

  predicate(row: WarehouseRow, predicate: MetricPredicate): boolean {
    switch (predicate.kind) {
      case "null":
        return (row[predicate.column] === null) === predicate.isNull;
      case "in": {
        const value = row[predicate.column];
        return typeof value === "string" && predicate.values.includes(value);
      }
      case "compare": {
        const left = this.expression(row, predicate.left);
        const right = this.expression(row, predicate.right);
        if (left === null || right === null) return false;
        if (predicate.operator === "=") return left === right;
        if (predicate.operator === "<>") return left !== right;
        const order =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : typeof left === "string" && typeof right === "string"
              ? left < right
                ? -1
                : left > right
                  ? 1
                  : 0
              : Number.NaN;
        if (Number.isNaN(order)) return false;
        switch (predicate.operator) {
          case ">":
            return order > 0;
          case ">=":
            return order >= 0;
          case "<":
            return order < 0;
          case "<=":
            return order <= 0;
        }
      }
    }
  }

  /**
   * The dimension values of a row, or `null` when a join finds no dimension
   * row or a filter drops the row.
   */
  located(
    row: WarehouseRow,
    groupBy: readonly DimensionPath[],
    filters: readonly PlannedFilter[]
  ): (string | null)[] | null {
    for (const { filter, path } of filters) {
      const value = this.attribute(row, path);
      if (typeof value !== "string") return null;
      if (filter.values.includes(value) !== (filter.operator === "in")) {
        return null;
      }
    }
    const values: (string | null)[] = [];
    for (const path of groupBy) {
      const value = this.attribute(row, path);
      if (value === undefined) return null;
      values.push(value === null ? null : String(value));
    }
    return values;
  }

  measure(source: SourcePlan): Groups {
    const measure = source.measure;
    if (measure === null) throw new Error("a span has no measure");
    const buckets = new Map<
      string,
      { values: (string | null)[]; rows: number; inputs: WarehouseValue[] }
    >();
    if (source.groupBy.length === 0) {
      buckets.set("[]", { values: [], rows: 0, inputs: [] });
    }
    for (const row of this.rows(source.table)) {
      if (!measure.where.every((p) => this.predicate(row, p))) continue;
      const values = this.located(row, source.groupBy, source.filters);
      if (values === null) continue;
      const key = JSON.stringify(values);
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = { values, rows: 0, inputs: [] };
        buckets.set(key, bucket);
      }
      bucket.rows += 1;
      if (measure.expression !== null) {
        bucket.inputs.push(this.expression(row, measure.expression));
      }
    }
    const groups: Groups = new Map();
    for (const [key, bucket] of buckets) {
      groups.set(key, {
        values: bucket.values,
        value: aggregate(measure.aggregation, bucket.rows, bucket.inputs),
      });
    }
    return groups;
  }

  span(source: SourcePlan, from: string, to: string): Groups {
    const milestones = this.index("gold.dim_milestone", "milestone_key");
    const dates = new Map<WarehouseValue, { from?: string; to?: string }>();
    for (const row of this.rows(source.table)) {
      const key = row.actual_date_key;
      if (typeof key !== "number") continue;
      const kind = milestones.get(row.milestone_key)?.milestone_kind;
      if (kind !== from && kind !== to) continue;
      const day = dateOfKey(key);
      const entry = dates.get(row.study_key) ?? {};
      const side = kind === from ? "from" : "to";
      const known = entry[side];
      if (known === undefined || day > known) entry[side] = day;
      dates.set(row.study_key, entry);
    }
    const groups: Groups = new Map();
    for (const [studyKey, entry] of dates) {
      if (entry.from === undefined || entry.to === undefined) continue;
      const values = this.located(
        { study_key: studyKey },
        source.groupBy,
        source.filters
      );
      if (values === null) continue;
      const key = JSON.stringify(values);
      if (groups.has(key)) {
        throw new Error("a milestone span group holds more than one study");
      }
      groups.set(key, { values, value: daysBetween(entry.from, entry.to) });
    }
    return groups;
  }
}

function compareValues(
  a: readonly (string | null)[],
  b: readonly (string | null)[]
): number {
  for (let i = 0; i < a.length; i += 1) {
    const [x, y] = [a[i] ?? "", b[i] ?? ""];
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Evaluates a governed metric over the gold tables of a warehouse. This is
 * the engine behind the platform's own dashboards; the SQL, MetricFlow and
 * TMDL compilers express the same definition for other consumers.
 *
 * @param warehouse - A warehouse from `buildWarehouse`; its `asOf` is the data cut.
 * @param metric - Metric definition, usually from `METRIC_REGISTRY`.
 * @param query - Dimensions to group by and filters; defaults to one total.
 * @returns One row per group, sorted by dimension values. Additive measures
 * (counts and sums) are 0 over no rows; means, medians, percentiles and
 * ratios with a zero denominator are `null`.
 * @throws Error when the query asks for a dimension or filter the metric
 * does not allow, or a `study` grain metric is not grouped by study.
 */
export function evaluateMetric(
  warehouse: Warehouse,
  metric: MetricDefinition,
  query: MetricQuery = {}
): MetricResult {
  const plan = planMetric(metric, query, warehouse.asOf);
  const evaluator = new Evaluator(warehouse, plan.dataCut);
  const formula = metric.formula;
  let groups: Groups;
  if (formula.kind === "milestone-span") {
    groups = evaluator.span(plan.sources[0], formula.from, formula.to);
  } else if (formula.kind === "simple") {
    groups = evaluator.measure(plan.sources[0]);
  } else {
    const numerator = evaluator.measure(plan.sources[0]);
    const denominator = evaluator.measure(plan.sources[1]);
    const zero = (aggregation: MetricAggregation) =>
      ADDITIVE.has(aggregation) ? 0 : null;
    groups = new Map();
    for (const key of new Set([...numerator.keys(), ...denominator.keys()])) {
      const n = numerator.get(key);
      const d = denominator.get(key);
      const top = n ? n.value : zero(formula.numerator.aggregation);
      const bottom = d ? d.value : zero(formula.denominator.aggregation);
      const values = (n ?? d)?.values ?? [];
      const value =
        top === null || bottom === null || bottom === 0
          ? null
          : formula.scale === 1
            ? top / bottom
            : (formula.scale * top) / bottom;
      groups.set(key, { values, value });
    }
  }
  const rows: MetricResultRow[] = [...groups.values()]
    .sort((a, b) => compareValues(a.values, b.values))
    .map((group) => ({
      dimensions: Object.fromEntries(
        plan.dimensions.map((id, i) => [id, group.values[i] ?? ""])
      ),
      value: group.value,
    }));
  return {
    metricId: metric.id,
    version: metric.version,
    dimensions: plan.dimensions,
    filters: plan.filters,
    dataCut: warehouse.asOf,
    rows,
  };
}
