/**
 * Query planning shared by the evaluator and every compiler: which measures
 * a formula reads, how each reaches the grouped and filtered dimensions, and
 * whether the request is allowed at all. Planning decides nothing about how
 * rows are joined, filtered or aggregated; each consumer does that itself.
 */
import type {
  MetricAggregation,
  MetricDefinition,
  MetricDimensionId,
  MetricExpression,
  MetricFilter,
  MetricFormula,
  MetricMeasure,
  MetricPredicate,
  MetricQuery,
} from "../../types";
import { dayNumber, isoDay } from "../warehouse/dates";
import { resolveDimension, type DimensionPath } from "./dimensions";

/** Aggregations whose value over no rows is 0 rather than `null`. */
export const ADDITIVE: ReadonlySet<MetricAggregation> = new Set([
  "count",
  "count-distinct",
  "sum",
]);

/** Table every milestone span reads. */
export const MILESTONE_TABLE = "gold.fct_milestone";

/** Role of one table read in a formula. */
export type SourceRole = "value" | "numerator" | "denominator" | "span";

/** One table a formula reads, with its measure (none for a span). */
export interface FormulaSource {
  readonly role: SourceRole;
  readonly table: string;
  readonly timeKey: string | null;
  readonly measure: MetricMeasure | null;
}

/** A dimension filter located on one source. */
export interface PlannedFilter {
  readonly filter: MetricFilter;
  readonly path: DimensionPath;
}

/** One source of a planned query, with its group-by and filter paths. */
export interface SourcePlan extends FormulaSource {
  /** Paths of the grouped dimensions, in query order. */
  readonly groupBy: readonly DimensionPath[];
  /** Filters in force, each with its path. */
  readonly filters: readonly PlannedFilter[];
}

/** A checked request for one metric. */
export interface MetricPlan {
  readonly metric: MetricDefinition;
  readonly dimensions: readonly MetricDimensionId[];
  readonly filters: readonly MetricFilter[];
  readonly sources: readonly SourcePlan[];
  /** ISO 8601 data cut, or `null` when the metric does not use it. */
  readonly dataCut: string | null;
}

/** The tables a formula reads, in numerator-then-denominator order. */
export function formulaSources(formula: MetricFormula): FormulaSource[] {
  const of = (role: SourceRole, measure: MetricMeasure): FormulaSource => ({
    role,
    table: measure.table,
    timeKey: measure.timeKey,
    measure,
  });
  switch (formula.kind) {
    case "simple":
      return [of("value", formula.measure)];
    case "ratio":
      return [
        of("numerator", formula.numerator),
        of("denominator", formula.denominator),
      ];
    case "milestone-span":
      return [
        { role: "span", table: MILESTONE_TABLE, timeKey: null, measure: null },
      ];
  }
}

function expressionUsesDataCut(expression: MetricExpression | null): boolean {
  if (expression === null) return false;
  if (expression.kind === "data-cut") return true;
  if (expression.kind === "days-between") {
    return (
      expressionUsesDataCut(expression.from) ||
      expressionUsesDataCut(expression.to)
    );
  }
  return false;
}

function predicateUsesDataCut(predicate: MetricPredicate): boolean {
  return (
    predicate.kind === "compare" &&
    (expressionUsesDataCut(predicate.left) ||
      expressionUsesDataCut(predicate.right))
  );
}

/** Whether a metric measures something against the data cut. */
export function usesDataCut(metric: MetricDefinition): boolean {
  return formulaSources(metric.formula).some(
    ({ measure }) =>
      measure !== null &&
      (expressionUsesDataCut(measure.expression) ||
        measure.where.some(predicateUsesDataCut))
  );
}

/** Whether a string is a real ISO 8601 calendar date. */
export function isIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && isoDay(dayNumber(value)) === value
  );
}

/**
 * The filters in force for a query: the query's own, then each default
 * filter on a dimension the query does not filter.
 */
export function effectiveFilters(
  metric: MetricDefinition,
  filters: readonly MetricFilter[]
): MetricFilter[] {
  return [
    ...filters,
    ...metric.defaultFilters.filter(
      (d) => !filters.some((f) => f.dimension === d.dimension)
    ),
  ];
}

/**
 * Checks a query against a metric and locates every grouped and filtered
 * dimension on every table the formula reads.
 *
 * @param metric - Metric definition.
 * @param query - Dimensions and filters requested.
 * @param dataCut - ISO 8601 data cut, needed when the metric uses it.
 * @returns The plan.
 * @throws Error when a dimension or filter is not allowed for the metric, a
 * `study` grain metric is not grouped by study, a filter lists no values, or
 * the data cut is missing or not a date.
 */
export function planMetric(
  metric: MetricDefinition,
  query: MetricQuery,
  dataCut: string | null
): MetricPlan {
  const dimensions = [...(query.dimensions ?? [])];
  const filters = effectiveFilters(metric, query.filters ?? []);
  const allowed = new Set(metric.allowedDimensions);
  if (new Set(dimensions).size !== dimensions.length) {
    throw new Error(`${metric.id}: a dimension is grouped twice`);
  }
  for (const id of dimensions) {
    if (!allowed.has(id)) {
      throw new Error(`${metric.id} cannot be grouped by ${id}`);
    }
  }
  if (metric.grain === "study" && !dimensions.includes("study")) {
    throw new Error(
      `${metric.id} is defined per study; group it by study to query it`
    );
  }
  for (const filter of filters) {
    if (!allowed.has(filter.dimension)) {
      throw new Error(`${metric.id} cannot be filtered by ${filter.dimension}`);
    }
    if (filter.values.length === 0) {
      throw new Error(
        `${metric.id}: the ${filter.dimension} filter lists no values`
      );
    }
  }
  let cut: string | null = null;
  if (usesDataCut(metric)) {
    if (dataCut === null || !isIsoDate(dataCut)) {
      throw new Error(
        `${metric.id} measures age at the data cut; pass the data cut as an ISO 8601 date`
      );
    }
    cut = dataCut;
  }
  const sources = formulaSources(metric.formula).map((source) => {
    const locate = (id: MetricDimensionId): DimensionPath => {
      const path = resolveDimension(source.table, source.timeKey, id);
      if (path === null) {
        throw new Error(`${metric.id}: ${source.table} cannot reach ${id}`);
      }
      return path;
    };
    return {
      ...source,
      groupBy: dimensions.map(locate),
      filters: filters.map((filter) => ({
        filter,
        path: locate(filter.dimension),
      })),
    };
  });
  return { metric, dimensions, filters, sources, dataCut: cut };
}
