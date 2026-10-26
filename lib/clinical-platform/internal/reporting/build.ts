/**
 * Builds a report spec into the numbers its renderer draws (#2625). Every
 * value comes from `evaluateMetric`, so a report shows exactly what the
 * metric registry computes and never a number of its own.
 */
import type {
  MetricDefinition,
  ReportCalculation,
  ReportData,
  ReportRow,
  ReportScale,
  ReportSpec,
  Warehouse,
} from "../../types";
import { describeMetricFormula } from "../semantic/describe";
import { METRIC_DIMENSIONS } from "../semantic/dimensions";
import { evaluateMetric } from "../semantic/evaluate";
import { METRIC_REGISTRY } from "../semantic/registry";
import { toSql } from "../semantic/sql";
import { checkReportSpec } from "./check";
import { NO_METRIC_ROWS, formatMetricValue } from "./format";

function compareLabels(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function calculation(
  spec: ReportSpec,
  metric: MetricDefinition,
  dataCut: string
): ReportCalculation {
  return {
    metricId: metric.id,
    name: metric.name,
    version: metric.version,
    status: metric.status,
    description: metric.description,
    formula: describeMetricFormula(metric),
    sql: toSql(metric, spec.dimensions, spec.filters, "duckdb", { dataCut }),
  };
}

/** The nearest of 1, 2, 2.5 and 5 times a power of ten at or above a step. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const multiple = [1, 2, 2.5, 5, 10].find((m) => m * power >= rough)!;
  return multiple * power;
}

const compact = new Map<string, Intl.NumberFormat>();

/**
 * A gridline's label. Past 10,000 a number or dollar amount is written
 * compactly, as $10M or 25K, so five labels fit a phone-width axis; the
 * data table under every chart keeps the full values.
 */
function tickText(
  metric: MetricDefinition,
  value: number,
  high: number
): string {
  const { style } = metric.format;
  if (style === "percent" || high < 10_000) {
    return formatMetricValue(metric, value);
  }
  let found = compact.get(style);
  if (!found) {
    found = new Intl.NumberFormat("en-US", {
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      ...(style === "currency" ? { style: "currency", currency: "USD" } : {}),
    });
    compact.set(style, found);
  }
  return found.format(value);
}

/**
 * About four evenly spaced gridlines that cover every value and 0, at
 * round steps.
 */
function scaleFor(
  metric: MetricDefinition,
  values: readonly number[]
): ReportScale {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  if (high === low) {
    return {
      min: 0,
      max: 0,
      ticks: [{ value: 0, text: formatMetricValue(metric, 0) }],
    };
  }
  const step = niceStep((high - low) / 4);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const count = Math.round((max - min) / step);
  const ticks = Array.from({ length: count + 1 }, (_, index) => {
    // Rounded to the step's precision so 0.1 + 0.2 never labels as 0.30000000000000004.
    const value = Number((min + index * step).toPrecision(12));
    return {
      value,
      text: tickText(metric, value, Math.max(Math.abs(min), Math.abs(max))),
    };
  });
  return { min, max, ticks };
}

/**
 * Evaluates every metric of a report over one warehouse and joins the
 * results into rows: one per group any metric has a row for, with a cell
 * per metric. A metric with no row for a group gets a `null` cell that
 * reads `NO_METRIC_ROWS`, which is not the same as a zero: the group may be
 * outside the metric's filters.
 *
 * @param warehouse - The warehouse to report on.
 * @param spec - The report spec.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The report's columns, rows and calculations.
 * @throws Error when the spec breaks a reporting rule (see
 *   `checkReportSpec`), naming every finding.
 */
export function buildReport(
  warehouse: Warehouse,
  spec: ReportSpec,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ReportData {
  const findings = checkReportSpec(spec, metrics);
  if (findings.length > 0) {
    throw new Error(
      `report ${spec.id} cannot be built: ${findings
        .map((finding) => finding.message)
        .join("; ")}`
    );
  }
  const shown = spec.metrics.map((id) =>
    metrics.find((metric) => metric.id === id)!
  );
  const rows = new Map<
    string,
    { labels: string[]; values: (number | null | undefined)[] }
  >();
  shown.forEach((metric, column) => {
    const result = evaluateMetric(warehouse, metric, {
      dimensions: spec.dimensions,
      filters: spec.filters,
    });
    for (const row of result.rows) {
      const labels = spec.dimensions.map((id) => row.dimensions[id] ?? "");
      const key = labels.join("\u001f");
      let entry = rows.get(key);
      if (!entry) {
        entry = { labels, values: shown.map(() => undefined) };
        rows.set(key, entry);
      }
      entry.values[column] = row.value;
    }
  });
  const built: ReportRow[] = [...rows.entries()]
    .sort(([, a], [, b]) => compareLabels(a.labels, b.labels))
    .map(([key, entry]) => ({
      key,
      labels: entry.labels,
      cells: entry.values.map((value, column) =>
        value === undefined
          ? { value: null, text: NO_METRIC_ROWS }
          : { value, text: formatMetricValue(shown[column], value) }
      ),
    }));
  return {
    spec,
    dataCut: warehouse.asOf,
    dimensionLabels: spec.dimensions.map(
      (id) => METRIC_DIMENSIONS.find((dimension) => dimension.id === id)!.label
    ),
    columns: shown.map((metric) => ({
      metricId: metric.id,
      name: metric.name,
      unit: metric.unit,
      version: metric.version,
      status: metric.status,
    })),
    rows: built,
    calculations: shown.map((metric) =>
      calculation(spec, metric, warehouse.asOf)
    ),
    scale:
      spec.visual === "bar" || spec.visual === "line"
        ? scaleFor(
            shown[0],
            built.flatMap((row) =>
              row.cells.flatMap((cell) =>
                cell.value === null ? [] : [cell.value]
              )
            )
          )
        : null,
  };
}
