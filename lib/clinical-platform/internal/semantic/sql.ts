/**
 * The SQL compiler: one governed metric, grouped and filtered, as a single
 * SELECT statement for DuckDB, PostgreSQL or SQL Server T-SQL over the gold
 * tables `emitDdl` creates. Each measure is a common table expression; a
 * ratio joins its numerator and denominator on the grouped dimensions.
 */
import type {
  MetricCompileOptions,
  MetricDefinition,
  MetricDimensionId,
  MetricExpression,
  MetricFilter,
  MetricMeasure,
  MetricPredicate,
  SqlDialect,
} from "../../types";
import type { DimensionPath } from "./dimensions";
import { ADDITIVE, planMetric, type SourcePlan } from "./plan";

interface Dialect {
  readonly label: string;
  quote(identifier: string): string;
  text(value: string): string;
  boolean(value: boolean): string;
  double(sql: string): string;
  dateOfKey(sql: string): string;
  daysBetween(from: string, to: string): string;
  date(iso: string): string;
  /** Whether `PERCENTILE_CONT` is an aggregate; in T-SQL it is a window function only. */
  readonly percentileAggregate: boolean;
}

const doubleQuote = (identifier: string) =>
  `"${identifier.replaceAll('"', '""')}"`;
const singleQuote = (text: string) => `'${text.replaceAll("'", "''")}'`;

const DIALECTS: Readonly<Record<SqlDialect, Dialect>> = {
  duckdb: {
    label: "DuckDB",
    quote: doubleQuote,
    text: singleQuote,
    boolean: (value) => (value ? "TRUE" : "FALSE"),
    double: (sql) => `CAST(${sql} AS DOUBLE)`,
    dateOfKey: (sql) =>
      `CAST(strptime(CAST(${sql} AS VARCHAR), '%Y%m%d') AS DATE)`,
    daysBetween: (from, to) => `date_diff('day', ${from}, ${to})`,
    date: (iso) => `DATE ${singleQuote(iso)}`,
    percentileAggregate: true,
  },
  postgres: {
    label: "PostgreSQL",
    quote: doubleQuote,
    text: singleQuote,
    boolean: (value) => (value ? "TRUE" : "FALSE"),
    double: (sql) => `CAST(${sql} AS DOUBLE PRECISION)`,
    dateOfKey: (sql) => `TO_DATE(CAST(${sql} AS TEXT), 'YYYYMMDD')`,
    daysBetween: (from, to) => `(${to} - ${from})`,
    date: (iso) => `DATE ${singleQuote(iso)}`,
    percentileAggregate: true,
  },
  tsql: {
    label: "SQL Server T-SQL",
    quote: (identifier) => `[${identifier.replaceAll("]", "]]")}]`,
    text: (value) => `N${singleQuote(value)}`,
    boolean: (value) => (value ? "1" : "0"),
    double: (sql) => `CAST(${sql} AS FLOAT)`,
    dateOfKey: (sql) => `CONVERT(DATE, CAST(${sql} AS CHAR(8)), 112)`,
    daysBetween: (from, to) => `DATEDIFF(DAY, ${from}, ${to})`,
    date: (iso) => `CAST(N${singleQuote(iso)} AS DATE)`,
    percentileAggregate: false,
  },
};

const PERCENTILE: Readonly<Record<string, number>> = { median: 0.5, p90: 0.9 };

/** Writes the joins and qualified columns of one row source. */
class Scope {
  private readonly aliases = new Map<string, string>();
  readonly joins: string[] = [];

  /** @param row - Alias of the row source, or `null` for unqualified columns. */
  constructor(
    private readonly d: Dialect,
    private readonly row: string | null
  ) {}

  column(name: string): string {
    const column = this.d.quote(name);
    return this.row === null ? column : `${this.d.quote(this.row)}.${column}`;
  }

  /** A column of a table joined on `table.to = row.from`, joined once per key. */
  joined(table: string, from: string, to: string, column: string): string {
    const q = this.d.quote;
    const id = `${table}|${from}`;
    let alias = this.aliases.get(id);
    if (alias === undefined) {
      const [schema, name] = table.split(".");
      const used = new Set(this.aliases.values());
      alias = name;
      for (let n = 2; used.has(alias); n += 1) alias = `${name}_${n}`;
      this.aliases.set(id, alias);
      this.joins.push(
        `JOIN ${q(schema)}.${q(name)} AS ${q(alias)} ON ${q(alias)}.${q(to)} = ${this.column(from)}`
      );
    }
    return `${q(alias)}.${q(column)}`;
  }

  attribute(path: DimensionPath): string {
    return path.join === null
      ? this.column(path.column)
      : this.joined(path.table, path.join.from, path.join.to, path.column);
  }
}

function literal(d: Dialect, value: string | number | boolean): string {
  if (typeof value === "string") return d.text(value);
  if (typeof value === "boolean") return d.boolean(value);
  if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
  return String(value);
}

function expression(
  d: Dialect,
  scope: Scope,
  e: MetricExpression,
  dataCut: string | null
): string {
  switch (e.kind) {
    case "column":
      return scope.column(e.column);
    case "literal":
      return literal(d, e.value);
    case "date-of-key":
      return d.dateOfKey(scope.column(e.column));
    case "data-cut":
      if (dataCut === null) throw new Error("the data cut is not set");
      return d.date(dataCut);
    case "days-between":
      return d.daysBetween(
        expression(d, scope, e.from, dataCut),
        expression(d, scope, e.to, dataCut)
      );
  }
}

function predicate(
  d: Dialect,
  scope: Scope,
  p: MetricPredicate,
  dataCut: string | null
): string {
  switch (p.kind) {
    case "null":
      return `${scope.column(p.column)} IS ${p.isNull ? "" : "NOT "}NULL`;
    case "in":
      return `${scope.column(p.column)} IN (${p.values.map(d.text).join(", ")})`;
    case "compare":
      return `${expression(d, scope, p.left, dataCut)} ${p.operator} ${expression(d, scope, p.right, dataCut)}`;
  }
}

/** DuckDB with bare identifiers: the SQL a dbt MetricFlow measure expression holds. */
const METRICFLOW_SQL: Dialect = { ...DIALECTS.duckdb, quote: (id) => id };

/**
 * A measure's value and row condition as DuckDB SQL over its own table's
 * unqualified columns, for dbt MetricFlow measure expressions.
 *
 * @param measure - The measure.
 * @param dataCut - ISO 8601 data cut, for measures that use it.
 * @returns The value expression (`null` for a count) and the AND of the
 * row predicates (`null` when there are none).
 */
export function metricFlowRowSql(
  measure: MetricMeasure,
  dataCut: string | null
): { readonly value: string | null; readonly condition: string | null } {
  const scope = new Scope(METRICFLOW_SQL, null);
  const conditions = measure.where.map((p) =>
    predicate(METRICFLOW_SQL, scope, p, dataCut)
  );
  return {
    value:
      measure.expression === null
        ? null
        : expression(METRICFLOW_SQL, scope, measure.expression, dataCut),
    condition: conditions.length === 0 ? null : conditions.join(" AND "),
  };
}

/** A `YYYYMMDD` date key column as a DuckDB date, for MetricFlow time dimensions. */
export function metricFlowDateOfKey(column: string): string {
  return METRICFLOW_SQL.dateOfKey(column);
}

/** Text as a DuckDB string literal. */
export function duckdbText(value: string): string {
  return singleQuote(value);
}

function filterCondition(
  d: Dialect,
  attribute: string,
  filter: MetricFilter
): string {
  const values = filter.values.map(d.text).join(", ");
  return `${attribute} ${filter.operator === "in" ? "IN" : "NOT IN"} (${values})`;
}

function where(conditions: readonly string[]): string[] {
  return conditions.length === 0
    ? []
    : [
        `  WHERE ${conditions[0]}`,
        ...conditions.slice(1).map((c) => `    AND ${c}`),
      ];
}

/** One measure as the body of a common table expression. */
function measureQuery(
  d: Dialect,
  source: SourcePlan,
  dimensions: readonly MetricDimensionId[],
  dataCut: string | null
): string[] {
  const measure = source.measure;
  if (measure === null) throw new Error("a span has no measure");
  const scope = new Scope(d, "f");
  const groupBy = source.groupBy.map((path) => scope.attribute(path));
  const selects = groupBy.map(
    (attr, i) => `${attr} AS ${d.quote(dimensions[i])}`
  );
  const conditions = [
    ...measure.where.map((p) => predicate(d, scope, p, dataCut)),
    ...source.filters.map(({ filter, path }) =>
      filterCondition(d, scope.attribute(path), filter)
    ),
  ];
  const input = () => {
    if (measure.expression === null) {
      throw new Error(`${measure.aggregation} needs an expression`);
    }
    return expression(d, scope, measure.expression, dataCut);
  };
  const p = PERCENTILE[measure.aggregation];
  const windowed = p !== undefined && !d.percentileAggregate;
  let aggregate: string;
  switch (measure.aggregation) {
    case "count":
      aggregate = "COUNT(*)";
      break;
    case "count-distinct":
      aggregate = `COUNT(DISTINCT ${input()})`;
      break;
    case "sum":
      aggregate = `SUM(${d.double(input())})`;
      break;
    case "mean":
      aggregate = `AVG(${d.double(input())})`;
      break;
    case "median":
    case "p90": {
      const ordered = `PERCENTILE_CONT(${p}) WITHIN GROUP (ORDER BY ${d.double(input())})`;
      aggregate = windowed
        ? `${ordered} OVER (${groupBy.length === 0 ? "" : `PARTITION BY ${groupBy.join(", ")}`})`
        : ordered;
      break;
    }
  }
  const [schema, table] = source.table.split(".");
  return [
    `  SELECT${windowed ? " DISTINCT" : ""}`,
    ...[...selects, `${aggregate} AS ${d.quote("value")}`].map(
      (s, i, all) => `    ${s}${i < all.length - 1 ? "," : ""}`
    ),
    `  FROM ${d.quote(schema)}.${d.quote(table)} AS ${d.quote("f")}`,
    ...scope.joins.map((j) => `  ${j}`),
    ...where(conditions),
    ...(groupBy.length > 0 && !windowed
      ? [`  GROUP BY ${groupBy.join(", ")}`]
      : []),
  ];
}

function cte(d: Dialect, name: string, body: readonly string[]): string[] {
  return [`${d.quote(name)} AS (`, ...body, ")"];
}

function withClause(ctes: readonly string[][]): string[] {
  return ctes.flatMap((lines, i) => [
    ...(i === 0 ? [`WITH ${lines[0]}`] : [lines[0]]),
    ...lines.slice(1, -1),
    `${lines[lines.length - 1]}${i < ctes.length - 1 ? "," : ""}`,
  ]);
}

function orderBy(count: number): string[] {
  return count === 0
    ? []
    : [`ORDER BY ${Array.from({ length: count }, (_, i) => i + 1).join(", ")}`];
}

function selectList(items: readonly string[]): string[] {
  return items.map((s, i) => `  ${s}${i < items.length - 1 ? "," : ""}`);
}

function header(
  d: Dialect,
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[],
  dataCut: string | null
): string[] {
  const filterText =
    filters.length === 0
      ? "none"
      : filters
          .map(
            (f) =>
              `${f.dimension} ${f.operator === "in" ? "in" : "not in"} (${f.values.join(", ")})`
          )
          .join("; ");
  return [
    `-- ${metric.name}: ${metric.id} ${metric.version} (${metric.status}), ${d.label}.`,
    `-- Grouped by: ${dimensions.length === 0 ? "none" : dimensions.join(", ")}. Filters: ${filterText}.${dataCut === null ? "" : ` Data cut: ${dataCut}.`}`,
  ];
}

/**
 * Compiles a governed metric to one SQL SELECT statement over the gold
 * tables. The statement returns one column per grouped dimension, in query
 * order, then `value` as a double; with no dimensions it returns exactly one
 * row. Counts and sums are 0 over no rows, and a ratio with a zero
 * denominator is `NULL`, as in `evaluateMetric`.
 *
 * @param metric - Metric definition.
 * @param dimensions - Dimensions to group by, in output order.
 * @param filters - Filters; each replaces the metric's default filter on the same dimension.
 * @param dialect - `duckdb`, `postgres` or `tsql`.
 * @param options - The data cut, for metrics that measure age at the cut.
 * @returns The statement, with a two-line comment header and a final semicolon.
 * @throws Error when the dimensions or filters are not allowed for the
 * metric, or the metric needs a data cut and none is given.
 */
export function toSql(
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[],
  dialect: SqlDialect,
  options: MetricCompileOptions = {}
): string {
  const d = DIALECTS[dialect];
  if (d === undefined)
    throw new Error(`unknown SQL dialect ${String(dialect)}`);
  const plan = planMetric(
    metric,
    { dimensions, filters },
    options.dataCut ?? null
  );
  const q = d.quote;
  const dims = plan.dimensions;
  const formula = metric.formula;
  let body: string[];
  if (formula.kind === "milestone-span") {
    body = spanQuery(d, plan.sources[0], formula.from, formula.to, dims);
  } else if (formula.kind === "simple") {
    const value = q("value");
    body = [
      ...withClause([
        cte(d, "measure", measureQuery(d, plan.sources[0], dims, plan.dataCut)),
      ]),
      ...(dims.length === 0
        ? [
            `SELECT ${d.double(`(SELECT ${value} FROM ${q("measure")})`)} AS ${value}`,
          ]
        : [
            "SELECT",
            ...selectList([
              ...dims.map((id) => q(id)),
              `${d.double(value)} AS ${value}`,
            ]),
            `FROM ${q("measure")}`,
            ...orderBy(dims.length),
          ]),
    ];
  } else {
    const [numerator, denominator] = plan.sources;
    const side = (alias: string, name: string, additive: boolean) => {
      const raw =
        dims.length === 0
          ? `(SELECT ${q("value")} FROM ${q(name)})`
          : `${q(alias)}.${q("value")}`;
      return d.double(additive ? `COALESCE(${raw}, 0)` : raw);
    };
    const top = side(
      "n",
      "numerator",
      ADDITIVE.has(formula.numerator.aggregation)
    );
    const bottom = side(
      "d",
      "denominator",
      ADDITIVE.has(formula.denominator.aggregation)
    );
    const ratio = `${formula.scale === 1 ? "" : `${formula.scale} * `}${top} / NULLIF(${bottom}, 0)`;
    body = [
      ...withClause([
        cte(d, "numerator", measureQuery(d, numerator, dims, plan.dataCut)),
        cte(d, "denominator", measureQuery(d, denominator, dims, plan.dataCut)),
      ]),
      ...(dims.length === 0
        ? [`SELECT ${ratio} AS ${q("value")}`]
        : [
            "SELECT",
            ...selectList([
              ...dims.map(
                (id) =>
                  `COALESCE(${q("n")}.${q(id)}, ${q("d")}.${q(id)}) AS ${q(id)}`
              ),
              `${ratio} AS ${q("value")}`,
            ]),
            `FROM ${q("numerator")} AS ${q("n")}`,
            `FULL OUTER JOIN ${q("denominator")} AS ${q("d")}`,
            `  ON ${dims.map((id) => `${q("d")}.${q(id)} = ${q("n")}.${q(id)}`).join(" AND ")}`,
            ...orderBy(dims.length),
          ]),
    ];
  }
  return [
    ...header(d, metric, dims, plan.filters, plan.dataCut),
    ...body.slice(0, -1),
    `${body[body.length - 1]};`,
  ].join("\n");
}

/** A milestone span: per study, the actual dates of two milestones, then the days between. */
function spanQuery(
  d: Dialect,
  source: SourcePlan,
  from: string,
  to: string,
  dimensions: readonly MetricDimensionId[]
): string[] {
  const q = d.quote;
  const f = new Scope(d, "f");
  const milestone = f.joined(
    "gold.dim_milestone",
    "milestone_key",
    "milestone_key",
    "milestone_kind"
  );
  const actual = d.dateOfKey(f.column("actual_date_key"));
  const dateOf = (kind: string) =>
    `MAX(CASE WHEN ${milestone} = ${d.text(kind)} THEN ${actual} END)`;
  const [schema, table] = source.table.split(".");
  const s = new Scope(d, "s");
  for (const path of [
    ...source.groupBy,
    ...source.filters.map((x) => x.path),
  ]) {
    if (path.join?.from !== "study_key") {
      throw new Error(`a milestone span cannot reach ${path.id}`);
    }
  }
  const groupBy = source.groupBy.map((path) => s.attribute(path));
  const conditions = [
    `${s.column("from_date")} IS NOT NULL`,
    `${s.column("to_date")} IS NOT NULL`,
    ...source.filters.map(({ filter, path }) =>
      filterCondition(d, s.attribute(path), filter)
    ),
  ];
  return [
    ...withClause([
      cte(d, "span", [
        "  SELECT",
        ...[
          f.column("study_key"),
          `${dateOf(from)} AS ${q("from_date")}`,
          `${dateOf(to)} AS ${q("to_date")}`,
        ].map((x, i, all) => `    ${x}${i < all.length - 1 ? "," : ""}`),
        `  FROM ${q(schema)}.${q(table)} AS ${q("f")}`,
        ...f.joins.map((j) => `  ${j}`),
        `  WHERE ${f.column("actual_date_key")} IS NOT NULL`,
        `  GROUP BY ${f.column("study_key")}`,
      ]),
    ]),
    "SELECT",
    ...selectList([
      ...groupBy.map((attr, i) => `${attr} AS ${q(dimensions[i])}`),
      `${d.double(d.daysBetween(s.column("from_date"), s.column("to_date")))} AS ${q("value")}`,
    ]),
    `FROM ${q("span")} AS ${q("s")}`,
    ...s.joins,
    ...where(conditions).map((line) => line.slice(2)),
    ...orderBy(dimensions.length),
  ];
}
