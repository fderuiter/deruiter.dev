/**
 * The Power BI compiler: every governed metric as a DAX measure in one TMDL
 * table, with its description, display folder, format string and registry
 * annotations. Measures iterate the gold fact rows in the current filter
 * context, so slicing works through the model's relationships from each
 * fact's keys to its dimensions; the Power BI project (#2629) owns those
 * relationships.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  MetricCompileOptions,
  MetricDefinition,
  MetricExpression,
  MetricFilter,
  MetricFormat,
  MetricMeasure,
  MetricPredicate,
} from "../../types";
import { resolveDimension, type DimensionPath } from "./dimensions";
import { MILESTONE_TABLE, isIsoDate, usesDataCut } from "./plan";

/** Name of the generated measure table. */
const TABLE_NAME = "Governed Metrics";

const name = (n: string) => `'${n.replaceAll("'", "''")}'`;
const text = (value: string) => `"${value.replaceAll('"', '""')}"`;
const column = (table: string, c: string) =>
  `${name(table.split(".")[1])}[${c.replaceAll("]", "]]")}]`;

function dateOfKey(reference: string): string {
  return `DATE(QUOTIENT(${reference}, 10000), MOD(QUOTIENT(${reference}, 100), 100), MOD(${reference}, 100))`;
}

function literal(value: string | number | boolean): string {
  if (typeof value === "string") return text(value);
  if (typeof value === "boolean") return value ? "TRUE()" : "FALSE()";
  if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
  return String(value);
}

function expression(
  table: string,
  e: MetricExpression,
  dataCut: string | null
): string {
  switch (e.kind) {
    case "column":
      return column(table, e.column);
    case "literal":
      return literal(e.value);
    case "date-of-key":
      return dateOfKey(column(table, e.column));
    case "data-cut": {
      if (dataCut === null) throw new Error("the data cut is not set");
      const [y, m, d] = dataCut.split("-").map(Number);
      return `DATE(${y}, ${m}, ${d})`;
    }
    case "days-between":
      return `DATEDIFF(${expression(table, e.from, dataCut)}, ${expression(table, e.to, dataCut)}, DAY)`;
  }
}

function predicate(
  table: string,
  p: MetricPredicate,
  dataCut: string | null
): string {
  switch (p.kind) {
    case "null":
      return `${p.isNull ? "" : "NOT "}ISBLANK(${column(table, p.column)})`;
    case "in":
      return `${column(table, p.column)} IN {${p.values.map(text).join(", ")}}`;
    case "compare":
      return `${expression(table, p.left, dataCut)} ${p.operator} ${expression(table, p.right, dataCut)}`;
  }
}

/** The attribute a dimension path reaches, in the row context of a fact row. */
function attribute(
  table: string,
  path: DimensionPath,
  timeKey: string | null
): string {
  if (path.id === "month") {
    if (timeKey === null) throw new Error("a month needs a time key");
    return `FORMAT(${dateOfKey(column(table, timeKey))}, "yyyy-MM")`;
  }
  return path.join === null
    ? column(table, path.column)
    : `RELATED(${column(path.table, path.column)})`;
}

function filterCondition(measure: MetricMeasure, filter: MetricFilter): string {
  const path = resolveDimension(
    measure.table,
    measure.timeKey,
    filter.dimension
  );
  if (path === null) {
    throw new Error(`${measure.table} cannot reach ${filter.dimension}`);
  }
  const values = `{${filter.values.map(text).join(", ")}}`;
  const condition = `${attribute(measure.table, path, measure.timeKey)} IN ${values}`;
  return filter.operator === "in" ? condition : `NOT (${condition})`;
}

/** One measure as a DAX expression over its filtered fact rows. */
function measureDax(
  measure: MetricMeasure,
  filters: readonly MetricFilter[],
  dataCut: string | null
): string {
  const t = name(measure.table.split(".")[1]);
  const conditions = [
    ...measure.where.map((p) => predicate(measure.table, p, dataCut)),
    ...filters.map((f) => filterCondition(measure, f)),
  ];
  const rows =
    conditions.length === 0 ? t : `FILTER(${t}, ${conditions.join(" && ")})`;
  const value = () => {
    if (measure.expression === null) {
      throw new Error(`${measure.aggregation} needs an expression`);
    }
    return expression(measure.table, measure.expression, dataCut);
  };
  switch (measure.aggregation) {
    case "count":
      return `COUNTROWS(${rows}) + 0`;
    case "count-distinct":
      return `COUNTROWS(DISTINCT(SELECTCOLUMNS(${rows}, "value", ${value()}))) + 0`;
    case "sum":
      return `SUMX(${rows}, ${value()}) + 0`;
    case "mean":
      return `AVERAGEX(${rows}, ${value()})`;
    case "median":
      return `MEDIANX(${rows}, ${value()})`;
    case "p90":
      return `PERCENTILEX.INC(${rows}, ${value()}, 0.9)`;
  }
}

/** The DAX of one metric, as lines without indentation. */
function metricDax(metric: MetricDefinition, dataCut: string | null): string[] {
  const formula = metric.formula;
  const filters = metric.defaultFilters;
  if (formula.kind === "simple") {
    return [measureDax(formula.measure, filters, dataCut)];
  }
  if (formula.kind === "ratio") {
    const top =
      formula.scale === 1 ? "Numerator" : `${formula.scale} * Numerator`;
    return [
      `VAR Numerator = ${measureDax(formula.numerator, filters, dataCut)}`,
      `VAR Denominator = ${measureDax(formula.denominator, filters, dataCut)}`,
      `RETURN DIVIDE(${top}, Denominator)`,
    ];
  }
  const t = name(MILESTONE_TABLE.split(".")[1]);
  const actual = column(MILESTONE_TABLE, "actual_date_key");
  const dateOf = (kind: string) =>
    `CALCULATE(MAXX(FILTER(${t}, NOT ISBLANK(${actual})), ${dateOfKey(actual)}), ${column("gold.dim_milestone", "milestone_kind")} = ${text(kind)})`;
  return [
    `IF(`,
    `\tHASONEVALUE(${column("gold.dim_study", "study_id")}),`,
    `\tVAR FromDate = ${dateOf(formula.from)}`,
    `\tVAR ToDate = ${dateOf(formula.to)}`,
    `\tRETURN IF(NOT ISBLANK(FromDate) && NOT ISBLANK(ToDate), DATEDIFF(FromDate, ToDate, DAY))`,
    `)`,
  ];
}

function formatString(format: MetricFormat): string {
  const decimals = format.decimals > 0 ? `.${"0".repeat(format.decimals)}` : "";
  switch (format.style) {
    case "percent":
      return `0${decimals}%`;
    case "currency":
      return `\\$#,0${decimals}`;
    case "number":
      return `#,0${decimals}`;
  }
}

/** The description written above a measure: definition, then registry facts. */
function tmdlDescription(metric: MetricDefinition): string {
  const grain =
    metric.grain === "study" ? " Defined per study: slice by one study." : "";
  return `${metric.description}${grain} Version ${metric.version}, ${metric.status}. Owner: ${metric.owner}. Steward: ${metric.steward}. Unit: ${metric.unit}.`;
}

/**
 * Compiles governed metrics to a Power BI TMDL table of DAX measures. Each
 * measure carries the metric's business definition, version, status, owner
 * and steward as its description, the metric's display folder and format
 * string, and annotations with the metric id, version and status. A `study`
 * grain metric is blank unless exactly one study is in context.
 *
 * @param metrics - Metrics to compile, usually `METRIC_REGISTRY`.
 * @param options - The data cut, for metrics that measure age at the cut.
 * @returns The TMDL text of one table, `Governed Metrics`, indented with tabs.
 * @throws Error when a metric needs a data cut and none is given.
 */
export function toTmdl(
  metrics: readonly MetricDefinition[],
  options: MetricCompileOptions = {}
): string {
  const dataCut = options.dataCut ?? null;
  if (metrics.some(usesDataCut) && (dataCut === null || !isIsoDate(dataCut))) {
    throw new Error(
      "a metric measures age at the data cut; pass it as an ISO 8601 date"
    );
  }
  const lines = [
    "/// Governed metrics of the Clinical Data Platform, generated from METRIC_REGISTRY in lib/clinical-platform. Do not edit by hand.",
    `/// ${SYNTHETIC_DATA_NOTICE}${dataCut === null ? "" : ` Data cut: ${dataCut}.`}`,
    `table ${name(TABLE_NAME)}`,
  ];
  for (const metric of metrics) {
    const dax = metricDax(metric, dataCut);
    lines.push(
      "",
      `\t/// ${tmdlDescription(metric)}`,
      `\tmeasure ${name(metric.name)} =`,
      ...dax.map((line) => `\t\t\t${line}`),
      `\t\tformatString: ${formatString(metric.format)}`,
      `\t\tdisplayFolder: ${metric.displayFolder}`,
      "",
      `\t\tannotation MetricId = ${metric.id}`,
      "",
      `\t\tannotation MetricVersion = ${metric.version}`,
      "",
      `\t\tannotation MetricStatus = ${metric.status}`
    );
  }
  return `${lines.join("\n")}\n`;
}
