/**
 * The self-service explorer's model (#2634). A visitor picks one governed
 * metric, groups it by up to two dimensions, filters it and picks a visual.
 * The explorer offers only what the semantic layer allows: the metric's
 * allowed dimensions, the grouping its grain requires, and the visuals
 * `checkReportSpec` accepts for the grouping. That is how a semantic layer
 * keeps self-service from joining the wrong tables.
 *
 * An exploration becomes an exploratory report spec, so it is built by the
 * same `buildReport` as every other report and shows the same definitions,
 * versions and SQL.
 */
import type {
  Exploration,
  ExplorationChoices,
  ExplorationFinding,
  ExplorationResult,
  MetricDefinition,
  MetricDimensionId,
  MetricFilter,
  ReportSpec,
  ReportVisual,
  Warehouse,
} from "../../types";
import { buildReport } from "../reporting/build";
import { visualFitsGrouping } from "../reporting/check";
import { METRIC_DIMENSIONS } from "../semantic/dimensions";
import { planMetric } from "../semantic/plan";
import { METRIC_REGISTRY } from "../semantic/registry";

/** The visuals the explorer offers, in the order it lists them. */
export const EXPLORER_VISUALS: readonly ReportVisual[] = [
  "stat",
  "bar",
  "line",
  "table",
];

/** Most dimensions an exploration groups by: the most a table report draws. */
export const EXPLORER_MAX_DIMENSIONS = 2;

/**
 * Most bars the explorer suggests a bar chart for; it suggests a longer
 * list as a table.
 */
export const EXPLORER_MAX_BARS = 12;

/**
 * A planning data cut. Whether a grouping or filter is allowed does not
 * depend on the date, only on a cut being present for metrics that need one.
 */
const PLANNING_DATA_CUT = "2000-01-01";

const DIMENSION_ORDER = new Map(METRIC_DIMENSIONS.map((d, i) => [d.id, i]));

const byDimensionOrder = (a: MetricDimensionId, b: MetricDimensionId) =>
  (DIMENSION_ORDER.get(a) ?? 0) - (DIMENSION_ORDER.get(b) ?? 0);

/**
 * The metrics the explorer offers: every registry metric that is not
 * deprecated, in registry order.
 *
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The metrics.
 */
export function explorerMetrics(
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): MetricDefinition[] {
  return metrics.filter((metric) => metric.status !== "deprecated");
}

function metricOf(
  metricId: string,
  metrics: readonly MetricDefinition[]
): MetricDefinition | undefined {
  return explorerMetrics(metrics).find((metric) => metric.id === metricId);
}

/** Whether the semantic layer can group and filter a metric this way. */
function plans(
  metric: MetricDefinition,
  dimensions: readonly MetricDimensionId[],
  filters: readonly MetricFilter[]
): boolean {
  try {
    planMetric(metric, { dimensions, filters }, PLANNING_DATA_CUT);
    return true;
  } catch {
    return false;
  }
}

/**
 * The exploration a metric starts from: one total, or, for a metric defined
 * per study, grouped by study.
 *
 * @param metricId - Registry metric id.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The exploration.
 * @throws Error when the explorer does not offer the metric.
 */
export function startExploration(
  metricId: string,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): Exploration {
  const metric = metricOf(metricId, metrics);
  if (metric === undefined) {
    throw new Error(`the explorer does not offer metric ${metricId}`);
  }
  return {
    metricId,
    dimensions: metric.grain === "study" ? ["study"] : [],
    filters: [],
    visual: null,
  };
}

/**
 * The exploration in its one written form: filters in dimension order, each
 * with its values sorted and listed once. Two explorations that mean the
 * same thing normalize to the same value, and so to the same URL.
 *
 * @param exploration - The exploration.
 * @returns The normalized exploration.
 */
export function normalizeExploration(exploration: Exploration): Exploration {
  return {
    metricId: exploration.metricId,
    dimensions: [...exploration.dimensions],
    filters: [...exploration.filters]
      .sort((a, b) => byDimensionOrder(a.dimension, b.dimension))
      .map((filter) => ({
        dimension: filter.dimension,
        operator: filter.operator,
        values: [...new Set(filter.values)].sort(),
      })),
    visual: exploration.visual,
  };
}

/**
 * What can change in an exploration next without breaking it: each
 * dimension that can be added or removed, each dimension the metric may be
 * filtered by, and each visual that fits the grouping.
 *
 * @param exploration - The exploration.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The choices; all empty when the explorer does not offer the metric.
 */
export function explorationChoices(
  exploration: Exploration,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ExplorationChoices {
  const metric = metricOf(exploration.metricId, metrics);
  if (metric === undefined) {
    return {
      addDimensions: [],
      removeDimensions: [],
      filterDimensions: [],
      visuals: [],
    };
  }
  const { dimensions, filters } = exploration;
  const allowed = [...metric.allowedDimensions].sort(byDimensionOrder);
  return {
    addDimensions:
      dimensions.length >= EXPLORER_MAX_DIMENSIONS
        ? []
        : allowed.filter(
            (id) =>
              !dimensions.includes(id) &&
              plans(metric, [...dimensions, id], filters)
          ),
    removeDimensions: dimensions.filter((id) =>
      plans(
        metric,
        dimensions.filter((other) => other !== id),
        filters
      )
    ),
    filterDimensions: allowed,
    visuals: EXPLORER_VISUALS.filter((visual) =>
      visualFitsGrouping(visual, dimensions)
    ),
  };
}

/**
 * The visual that suits the shape of a result: one number for no grouping,
 * a line over months, bars for a short list, and a table for a long list
 * or two dimensions.
 *
 * @param dimensions - The dimensions grouped by.
 * @param rowCount - How many rows the result has.
 * @returns The visual.
 */
export function suggestVisual(
  dimensions: readonly MetricDimensionId[],
  rowCount: number
): ReportVisual {
  if (dimensions.length === 0) return "stat";
  if (dimensions.length > 1) return "table";
  if (dimensions[0] === "month" && rowCount > 1) return "line";
  return rowCount <= EXPLORER_MAX_BARS ? "bar" : "table";
}

/**
 * The exploratory report spec an exploration builds. Nobody owns or has
 * reviewed it, and the spec says so; `promotionSteps` lists what a person
 * has to do before it can become a managed or certified report.
 *
 * @param exploration - The exploration.
 * @param visual - The visual to draw it with.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The spec.
 * @throws Error when the explorer does not offer the metric.
 */
export function explorationSpec(
  exploration: Exploration,
  visual: ReportVisual,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ReportSpec {
  const metric = metricOf(exploration.metricId, metrics);
  if (metric === undefined) {
    throw new Error(
      `the explorer does not offer metric ${exploration.metricId}`
    );
  }
  const labels = exploration.dimensions.map(
    (id) =>
      METRIC_DIMENSIONS.find((d) => d.id === id)?.label.toLowerCase() ?? id
  );
  return {
    id: `exploration-${metric.id.replaceAll("_", "-")}`,
    title:
      labels.length === 0
        ? metric.name
        : `${metric.name} by ${labels.join(" and ")}`,
    audience: EXPLORATION_AUDIENCE,
    purpose: EXPLORATION_PURPOSE,
    tier: "exploratory",
    owner: EXPLORATION_OWNER,
    version: EXPLORATION_VERSION,
    metrics: [metric.id],
    dimensions: [...exploration.dimensions],
    filters: [...exploration.filters],
    visual,
    refreshSlaHours: EXPLORATION_REFRESH_SLA_HOURS,
    signOff: null,
  };
}

/** Audience of every exploration: whoever opened it. */
export const EXPLORATION_AUDIENCE = "Self-service explorer";

/** Purpose of every exploration, which says it has not been reviewed. */
export const EXPLORATION_PURPOSE =
  "Built in the self-service explorer. Nobody has reviewed it, so read it as a question to ask, not an answer to act on.";

/** Owner of every exploration until a team takes it on. */
export const EXPLORATION_OWNER = "Unassigned";

/** Version of every exploration: below 1.0.0, so not yet released. */
export const EXPLORATION_VERSION = "0.1.0";

/** Refresh SLA of every exploration: the portfolio's daily load. */
export const EXPLORATION_REFRESH_SLA_HOURS = 24;

/**
 * Checks an exploration: the metric is offered, the grouping and filters
 * are ones the semantic layer allows, and the chosen visual fits the
 * grouping.
 *
 * @param exploration - The exploration.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns One finding per problem; empty when the exploration can run.
 */
export function checkExploration(
  exploration: Exploration,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ExplorationFinding[] {
  const metric = metricOf(exploration.metricId, metrics);
  if (metric === undefined) {
    return [
      {
        field: "metric",
        message: `The explorer does not offer a metric called ${exploration.metricId}.`,
      },
    ];
  }
  const findings: ExplorationFinding[] = [];
  const { dimensions, filters } = exploration;
  const allowed = new Set(metric.allowedDimensions);
  const label = (id: MetricDimensionId) =>
    METRIC_DIMENSIONS.find((d) => d.id === id)?.label.toLowerCase() ??
    String(id);
  if (dimensions.length > EXPLORER_MAX_DIMENSIONS) {
    findings.push({
      field: "dimensions",
      message: `Group by at most ${EXPLORER_MAX_DIMENSIONS} dimensions; this groups by ${dimensions.length}.`,
    });
  }
  if (new Set(dimensions).size !== dimensions.length) {
    findings.push({
      field: "dimensions",
      message: "Group by each dimension once.",
    });
  }
  for (const id of dimensions.filter((id) => !allowed.has(id))) {
    findings.push({
      field: "dimensions",
      message: `${metric.name} cannot be grouped by ${label(id)}.`,
    });
  }
  if (metric.grain === "study" && !dimensions.includes("study")) {
    findings.push({
      field: "dimensions",
      message: `${metric.name} is defined per study, so group it by study.`,
    });
  }
  const filtered = filters.map((filter) => filter.dimension);
  if (new Set(filtered).size !== filtered.length) {
    findings.push({ field: "filters", message: "Filter each dimension once." });
  }
  for (const filter of filters) {
    if (!allowed.has(filter.dimension)) {
      findings.push({
        field: "filters",
        message: `${metric.name} cannot be filtered by ${label(filter.dimension)}.`,
      });
    } else if (filter.values.length === 0) {
      findings.push({
        field: "filters",
        message: `The ${label(filter.dimension)} filter lists no values.`,
      });
    }
  }
  if (findings.length === 0) {
    // Anything the rules above miss, the semantic layer's own planner names.
    try {
      planMetric(metric, { dimensions, filters }, PLANNING_DATA_CUT);
    } catch (error) {
      findings.push({ field: "dimensions", message: (error as Error).message });
    }
  }
  if (
    exploration.visual !== null &&
    !visualFitsGrouping(exploration.visual, dimensions)
  ) {
    findings.push({
      field: "visual",
      message: `A ${exploration.visual} cannot draw this grouping. Choose one of: ${explorationChoices(
        exploration,
        metrics
      ).visuals.join(", ")}.`,
    });
  }
  return findings;
}

/** Sorted distinct values of each dimension a metric may be filtered by. */
function filterValues(
  warehouse: Warehouse,
  metric: MetricDefinition
): ExplorationResult["filterValues"] {
  return Object.fromEntries(
    [...metric.allowedDimensions].sort(byDimensionOrder).map((id) => {
      const d = METRIC_DIMENSIONS.find((candidate) => candidate.id === id)!;
      const values = new Set<string>();
      for (const row of warehouse.tables[d.table] ?? []) {
        const value = row[d.column];
        if (value !== null && value !== undefined) values.add(String(value));
      }
      return [id, [...values].sort()];
    })
  );
}

/**
 * Runs an exploration over one warehouse: builds its exploratory report
 * spec, suggests a visual from the result's shape, and draws it with the
 * chosen visual or else the suggested one.
 *
 * @param warehouse - The warehouse to explore.
 * @param exploration - The exploration.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The result.
 * @throws Error when `checkExploration` finds a problem, naming each one.
 */
export function runExploration(
  warehouse: Warehouse,
  exploration: Exploration,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ExplorationResult {
  const findings = checkExploration(exploration, metrics);
  if (findings.length > 0) {
    throw new Error(findings.map((finding) => finding.message).join(" "));
  }
  const normalized = normalizeExploration(exploration);
  const metric = metricOf(normalized.metricId, metrics)!;
  // The table draws any grouping, so it measures the result's shape first.
  const shape = buildReport(
    warehouse,
    explorationSpec(normalized, "table", metrics),
    metrics
  );
  const suggestedVisual = suggestVisual(
    normalized.dimensions,
    shape.rows.length
  );
  const visual = normalized.visual ?? suggestedVisual;
  const spec = explorationSpec(normalized, visual, metrics);
  // `buildReport` checks the spec too; this keeps the two rule sets honest.
  const report =
    visual === "table" ? shape : buildReport(warehouse, spec, metrics);
  const filtered = new Set(normalized.filters.map((f) => f.dimension));
  return {
    exploration: normalized,
    spec: report.spec,
    suggestedVisual,
    report,
    choices: explorationChoices(normalized, metrics),
    defaultFilters: metric.defaultFilters.filter(
      (f) => !filtered.has(f.dimension)
    ),
    replacedDefaults: metric.defaultFilters.filter((f) =>
      filtered.has(f.dimension)
    ),
    filterValues: filterValues(warehouse, metric),
  };
}
