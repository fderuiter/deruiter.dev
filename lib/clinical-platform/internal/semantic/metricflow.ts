/**
 * The dbt MetricFlow compiler: semantic models over the gold tables the
 * metrics read, and one MetricFlow metric per governed metric. Expressions
 * are DuckDB SQL, for the dbt-duckdb project built from the same gold layer
 * (ADR 0066). Row predicates become `CASE` expressions inside each measure,
 * so a ratio's numerator and denominator keep their own conditions.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  MetricCompileOptions,
  MetricDefinition,
  MetricFilter,
  MetricMeasure,
} from "../../types";
import {
  resolveDimension,
  warehouseTable,
  type DimensionPath,
} from "./dimensions";
import { ADDITIVE, formulaSources, isIsoDate, usesDataCut } from "./plan";
import { duckdbText, metricFlowDateOfKey, metricFlowRowSql } from "./sql";
import { yaml, type YamlMap } from "../yaml";

/** MetricFlow entity name of each dimension table. */
const ENTITY: Readonly<Record<string, string>> = {
  "gold.dim_study": "study",
  "gold.dim_site": "site",
  "gold.dim_country": "country",
  "gold.dim_vendor": "vendor",
  "gold.dim_milestone": "milestone",
};

const short = (table: string) => table.split(".")[1];

/** Name of a time dimension made from a date key column. */
const timeDimension = (key: string) => key.replace(/_key$/, "");

/** MetricFlow group-by name of a dimension path, seen from a source table. */
function dimensionName(source: string, path: DimensionPath): string {
  if (path.id === "month") return "metric_time__month";
  const owner = path.join === null ? source : path.table;
  return `${ENTITY[owner] ?? short(owner)}__${path.column}`;
}

/** Everything one semantic model needs, collected across the metrics. */
interface ModelDraft {
  readonly table: string;
  readonly measures: YamlMap[];
  readonly timeKeys: Set<string>;
  readonly categorical: Set<string>;
}

class Project {
  readonly models = new Map<string, ModelDraft>();
  readonly metrics: YamlMap[] = [];

  constructor(private readonly dataCut: string | null) {}

  model(table: string): ModelDraft {
    let model = this.models.get(table);
    if (model === undefined) {
      if (warehouseTable(table) === undefined) throw new Error(`no ${table}`);
      model = {
        table,
        measures: [],
        timeKeys: new Set(),
        categorical: new Set(),
      };
      this.models.set(table, model);
    }
    return model;
  }

  /** Registers the dimension tables and columns a metric's dimensions reach. */
  reach(metric: MetricDefinition): void {
    for (const source of formulaSources(metric.formula)) {
      for (const id of metric.allowedDimensions) {
        const path = resolveDimension(source.table, source.timeKey, id);
        if (path === null || id === "month") continue;
        this.model(
          path.join === null ? source.table : path.table
        ).categorical.add(path.column);
      }
    }
  }

  measure(
    metric: MetricDefinition,
    role: string,
    measure: MetricMeasure
  ): string {
    const name = `${metric.id}__${role}`;
    const row = metricFlowRowSql(measure, this.dataCut);
    const value =
      measure.aggregation === "count"
        ? "1"
        : measure.aggregation === "count-distinct"
          ? (row.value ?? "NULL")
          : `CAST(${row.value ?? "NULL"} AS DOUBLE)`;
    const otherwise =
      measure.aggregation === "count" || measure.aggregation === "sum"
        ? " ELSE 0"
        : "";
    const expr =
      row.condition === null
        ? value
        : `CASE WHEN ${row.condition} THEN ${value}${otherwise} END`;
    const agg: Record<MetricMeasure["aggregation"], string> = {
      count: "sum",
      "count-distinct": "count_distinct",
      sum: "sum",
      mean: "average",
      median: "median",
      p90: "percentile",
    };
    return this.push(measure.table, measure.timeKey, {
      name,
      description: `${role === "value" ? "Measure" : `The ${role}`} of ${metric.id}.`,
      agg: agg[measure.aggregation],
      expr,
      agg_params:
        measure.aggregation === "p90"
          ? { percentile: 0.9, use_discrete_percentile: false }
          : undefined,
      agg_time_dimension:
        measure.timeKey === null ? undefined : timeDimension(measure.timeKey),
    });
  }

  /** Adds a measure to a table's semantic model and returns its name. */
  push(table: string, timeKey: string | null, measure: YamlMap): string {
    const model = this.model(table);
    if (timeKey !== null) model.timeKeys.add(timeKey);
    model.measures.push(measure);
    return String(measure.name);
  }

  filter(
    metric: MetricDefinition,
    filters: readonly MetricFilter[]
  ): string | undefined {
    if (filters.length === 0) return undefined;
    const sources = formulaSources(metric.formula);
    return filters
      .map((filter) => {
        const names = new Set(
          sources.map((source) => {
            const path = resolveDimension(
              source.table,
              source.timeKey,
              filter.dimension
            );
            if (path === null) {
              throw new Error(
                `${metric.id}: ${source.table} cannot reach ${filter.dimension}`
              );
            }
            return dimensionName(source.table, path);
          })
        );
        if (names.size !== 1) {
          throw new Error(
            `${metric.id}: the ${filter.dimension} filter has no single MetricFlow name`
          );
        }
        const values = filter.values.map(duckdbText).join(", ");
        return `{{ Dimension('${[...names][0]}') }} ${filter.operator === "in" ? "IN" : "NOT IN"} (${values})`;
      })
      .join(" AND ");
  }

  helper(
    name: string,
    label: string,
    measure: string,
    additive: boolean,
    filter?: string
  ): string {
    this.metrics.push({
      name,
      label,
      description: `${label}: an input of a governed metric, not reported on its own.`,
      type: "simple",
      type_params: {
        measure: { name: measure, fill_nulls_with: additive ? 0 : undefined },
      },
      filter,
    });
    return name;
  }

  add(metric: MetricDefinition): void {
    this.reach(metric);
    const formula = metric.formula;
    const meta: YamlMap = {
      version: metric.version,
      status: metric.status,
      owner: metric.owner,
      steward: metric.steward,
      grain: metric.grain,
      unit: metric.unit,
      format: `${metric.format.style}, ${metric.format.decimals} decimals`,
      display_folder: metric.displayFolder,
      glossary_term: metric.glossaryTerm ?? undefined,
      allowed_dimensions: [...metric.allowedDimensions],
      required_group_by:
        metric.grain === "study" ? ["study__study_id"] : undefined,
    };
    const base: YamlMap = {
      name: metric.id,
      label: metric.name,
      description: metric.description,
    };
    const filter = this.filter(metric, metric.defaultFilters);
    const config = { meta };
    if (formula.kind === "simple") {
      const measure = this.measure(metric, "value", formula.measure);
      this.metrics.push({
        ...base,
        type: "simple",
        type_params: {
          measure: {
            name: measure,
            fill_nulls_with: ADDITIVE.has(formula.measure.aggregation)
              ? 0
              : undefined,
          },
        },
        filter,
        config,
      });
      return;
    }
    if (formula.kind === "ratio") {
      const numerator = this.helper(
        `${metric.id}__numerator`,
        `${metric.name} (numerator)`,
        this.measure(metric, "numerator", formula.numerator),
        ADDITIVE.has(formula.numerator.aggregation)
      );
      const denominator = this.helper(
        `${metric.id}__denominator`,
        `${metric.name} (denominator)`,
        this.measure(metric, "denominator", formula.denominator),
        ADDITIVE.has(formula.denominator.aggregation)
      );
      this.metrics.push(
        formula.scale === 1
          ? {
              ...base,
              type: "ratio",
              type_params: { numerator, denominator },
              filter,
              config,
            }
          : {
              ...base,
              type: "derived",
              type_params: {
                expr: `${formula.scale} * numerator / NULLIF(denominator, 0)`,
                metrics: [
                  { name: numerator, alias: "numerator" },
                  { name: denominator, alias: "denominator" },
                ],
              },
              filter,
              config,
            }
      );
      return;
    }
    const actual = this.push("gold.fct_milestone", "actual_date_key", {
      name: `${metric.id}__actual_date`,
      description: `Actual milestone date of ${metric.id}.`,
      agg: "max",
      expr: metricFlowDateOfKey("actual_date_key"),
      agg_time_dimension: timeDimension("actual_date_key"),
    });
    this.model("gold.dim_milestone").categorical.add("milestone_kind");
    const kindFilter = (kind: string) =>
      `{{ Dimension('milestone__milestone_kind') }} = ${duckdbText(kind)}`;
    const from = this.helper(
      `${metric.id}__from_date`,
      `${metric.name} (start date)`,
      actual,
      false,
      kindFilter(formula.from)
    );
    const to = this.helper(
      `${metric.id}__to_date`,
      `${metric.name} (end date)`,
      actual,
      false,
      kindFilter(formula.to)
    );
    this.metrics.push({
      ...base,
      type: "derived",
      type_params: {
        expr: "date_diff('day', from_date, to_date)",
        metrics: [
          { name: from, alias: "from_date" },
          { name: to, alias: "to_date" },
        ],
      },
      filter,
      config,
    });
  }

  semanticModel(draft: ModelDraft): YamlMap {
    const table = warehouseTable(draft.table);
    if (table === undefined) throw new Error(`no ${draft.table}`);
    const entityName = ENTITY[draft.table];
    const key = table.primaryKey;
    const primary: YamlMap = {
      name: entityName ?? short(draft.table),
      type: "primary",
      expr:
        key.length === 1
          ? key[0]
          : key.map((c) => `CAST(${c} AS VARCHAR)`).join(" || '|' || "),
    };
    const foreign = table.columns
      .filter((c) => c.references !== null && ENTITY[c.references.table])
      .map((c) => ({
        name: ENTITY[c.references?.table ?? ""],
        type: "foreign",
        expr: c.name,
      }));
    const times = [...draft.timeKeys].map((k) => ({
      name: timeDimension(k),
      type: "time",
      expr: metricFlowDateOfKey(k),
      type_params: { time_granularity: "day" },
    }));
    if (times.length === 0 && draft.measures.length > 0) {
      const fallback = table.columns.find(
        (c) => c.type === "date" && !c.nullable
      );
      if (fallback === undefined)
        throw new Error(`${table.name} has no date to aggregate by`);
      times.push({
        name: fallback.name,
        type: "time",
        expr: fallback.name,
        type_params: { time_granularity: "day" },
      });
    }
    const categorical = table.columns
      .filter((c) => draft.categorical.has(c.name))
      .map((c) => ({
        name: c.name,
        type: "categorical",
        description: c.description,
      }));
    const measures = draft.measures.map((m) => ({
      ...m,
      agg_time_dimension: m.agg_time_dimension ?? times[0]?.name,
    }));
    return {
      name: table.name,
      description: `${table.description} Grain: ${table.grain}`,
      model: `ref('${table.name}')`,
      defaults:
        times.length > 0 ? { agg_time_dimension: times[0].name } : undefined,
      entities: [primary, ...foreign],
      dimensions: [...categorical, ...times],
      measures: measures.length > 0 ? measures : undefined,
    };
  }
}

/**
 * Compiles governed metrics to one dbt MetricFlow YAML file: a semantic model
 * per gold table they read or group by, and a MetricFlow metric per governed
 * metric. Ratio numerators and denominators, and the two dates of a milestone
 * span, become helper metrics named after the metric. A metric's version,
 * status, owner, steward, unit and allowed dimensions go in its `meta`.
 *
 * @param metrics - Metrics to compile, usually `METRIC_REGISTRY`.
 * @param options - The data cut, for metrics that measure age at the cut.
 * @returns The YAML text, with a comment header.
 * @throws Error when a metric needs a data cut and none is given.
 */
export function toMetricFlowYaml(
  metrics: readonly MetricDefinition[],
  options: MetricCompileOptions = {}
): string {
  const dataCut = options.dataCut ?? null;
  if (metrics.some(usesDataCut) && (dataCut === null || !isIsoDate(dataCut))) {
    throw new Error(
      "a metric measures age at the data cut; pass it as an ISO 8601 date"
    );
  }
  const project = new Project(dataCut);
  for (const metric of metrics) project.add(metric);
  const order = [...project.models.keys()].sort((a, b) => {
    const rank = (t: string) => (ENTITY[t] ? 0 : 1);
    return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
  });
  const document: YamlMap = {
    semantic_models: order.map((t) =>
      project.semanticModel(project.models.get(t) as ModelDraft)
    ),
    metrics: project.metrics,
  };
  return [
    "# Clinical Data Platform governed metrics as dbt MetricFlow semantic models and metrics.",
    "# Generated from METRIC_REGISTRY in lib/clinical-platform; do not edit by hand.",
    `# ${SYNTHETIC_DATA_NOTICE}`,
    `# Expressions are DuckDB SQL.${dataCut === null ? "" : ` Data cut: ${dataCut}.`}`,
    ...yaml(document),
    "",
  ].join("\n");
}
