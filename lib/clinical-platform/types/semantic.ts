/**
 * Clinical Data Platform: metric registry and compiler types.
 */
import type {
  MetricDimensionId,
  MetricFilter,
  MetricFormula,
  MetricGrain,
  MetricStatus,
} from "./platform";

/** One dimension of the semantic layer: an attribute of a gold dimension table. */
export interface MetricDimension {
  /** Stable dimension id. */
  readonly id: MetricDimensionId;
  /** Display label. */
  readonly label: string;
  /** What the dimension's values are, in one sentence. */
  readonly description: string;
  /** Qualified gold table that holds the attribute, for example `gold.dim_study`. */
  readonly table: string;
  /** Attribute column in that table. */
  readonly column: string;
}

/** A request for a metric's value, grouped and filtered. */
export interface MetricQuery {
  /** Dimensions to group by, in output order; empty or absent for one total. */
  readonly dimensions?: readonly MetricDimensionId[];
  /** Filters; each replaces the metric's default filter on the same dimension. */
  readonly filters?: readonly MetricFilter[];
}

/** One row of a metric result. */
export interface MetricResultRow {
  /** Value of each grouped dimension, keyed by dimension id. */
  readonly dimensions: Readonly<Partial<Record<MetricDimensionId, string>>>;
  /** Metric value, or `null` when it is undefined (for example a zero denominator). */
  readonly value: number | null;
}

/** A metric evaluated over one warehouse. */
export interface MetricResult {
  /** Metric id. */
  readonly metricId: string;
  /** Metric version. */
  readonly version: string;
  /** Grouped dimensions, in output order. */
  readonly dimensions: readonly MetricDimensionId[];
  /** Filters in force: the query's, then the defaults it did not replace. */
  readonly filters: readonly MetricFilter[];
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** One row per group, sorted by dimension values. */
  readonly rows: readonly MetricResultRow[];
}

/** Options for the metric compilers. */
export interface MetricCompileOptions {
  /**
   * ISO 8601 data cut, written into metrics that measure age at the cut,
   * such as query aging. Required when a compiled metric uses it.
   */
  readonly dataCut?: string;
}

/**
 * The part of a metric definition that decides its values. Two releases of a
 * certified metric with different contracts need different major versions.
 */
export interface MetricContract {
  /** Formula. */
  readonly formula: MetricFormula;
  /** Grain. */
  readonly grain: MetricGrain;
  /** Unit. */
  readonly unit: string;
  /** Default filters. */
  readonly defaultFilters: readonly MetricFilter[];
  /** Allowed dimensions. Adding one is a minor change; removing one is breaking. */
  readonly allowedDimensions: readonly MetricDimensionId[];
}

/** One released version of a metric, as recorded in the registry lock file. */
export interface MetricRelease {
  /** Metric id. */
  readonly id: string;
  /** Semantic version. */
  readonly version: string;
  /** Status at release. */
  readonly status: MetricStatus;
  /** Contract at release. */
  readonly contract: MetricContract;
}

/** A report's use of governed metrics, as checked by `checkReportMetrics`. */
export interface MetricReport {
  /** Report id. */
  readonly id: string;
  /** Report title. */
  readonly title: string;
  /** Whether the report is certified. A certified report may only use certified metrics. */
  readonly certified: boolean;
  /** Ids of the metrics the report shows. */
  readonly metricIds: readonly string[];
}

/** A broken metric governance rule. */
export interface MetricFinding {
  /** Rule family: the definition itself, its versioning, or a report's use of it. */
  readonly rule: "definition" | "version" | "report";
  /** Metric the finding is about, or `null` for a registry-wide finding. */
  readonly metricId: string | null;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/**
 * A metric a clinical operations or portfolio lead would expect that the gold
 * model cannot compute yet, and what it lacks. Listed rather than faked.
 */
export interface MetricGap {
  /** Metric name. */
  readonly name: string;
  /** Why the registry leaves it out. */
  readonly reason: string;
  /** Gold data that would make it computable. */
  readonly missing: string;
  /** Registry metric that covers part of the need, or `null`. */
  readonly nearestMetricId: string | null;
}
