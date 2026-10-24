/**
 * Formulas in words, for catalog pages and dashboard tooltips that say how
 * a number is computed.
 */
import type {
  MetricDefinition,
  MetricExpression,
  MetricMeasure,
  MetricPredicate,
} from "../../types";

function value(e: MetricExpression): string {
  switch (e.kind) {
    case "column":
      return e.column;
    case "literal":
      return typeof e.value === "string" ? `'${e.value}'` : String(e.value);
    case "date-of-key":
      return `date(${e.column})`;
    case "data-cut":
      return "the data cut";
    case "days-between":
      return `days from ${value(e.from)} to ${value(e.to)}`;
  }
}

function condition(p: MetricPredicate): string {
  switch (p.kind) {
    case "null":
      return `${p.column} is ${p.isNull ? "" : "not "}null`;
    case "in":
      return `${p.column} in (${p.values.map((v) => `'${v}'`).join(", ")})`;
    case "compare":
      return `${value(p.left)} ${p.operator} ${value(p.right)}`;
  }
}

const AGGREGATE = {
  "count-distinct": "distinct count",
  sum: "sum",
  mean: "mean",
  median: "median",
  p90: "90th percentile",
} as const;

function measure(m: MetricMeasure): string {
  const where =
    m.where.length === 0
      ? ""
      : ` where ${m.where.map(condition).join(" and ")}`;
  if (m.aggregation === "count" || m.expression === null) {
    return `count of ${m.table} rows${where}`;
  }
  return `${AGGREGATE[m.aggregation]} of ${value(m.expression)} over ${m.table} rows${where}`;
}

/**
 * Describes how a metric is computed from the gold tables, in one line, for
 * example `(count of gold.fct_query rows) / (count of gold.fct_visit rows
 * where visit_date_key is not null), times 100`.
 *
 * @param metric - Metric definition.
 * @returns The formula in words.
 */
export function describeMetricFormula(metric: MetricDefinition): string {
  const formula = metric.formula;
  switch (formula.kind) {
    case "simple":
      return measure(formula.measure);
    case "ratio":
      return `(${measure(formula.numerator)}) / (${measure(formula.denominator)})${formula.scale === 1 ? "" : `, times ${formula.scale}`}`;
    case "milestone-span":
      return `days from the actual ${formula.from} date to the actual ${formula.to} date in gold.fct_milestone, per study`;
  }
}
