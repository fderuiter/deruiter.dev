/**
 * The platform's column-level lineage as one graph (#2637): the Study Data
 * Pipeline's collected, SDTM and ADaM variables, the bronze feeds the
 * collected values are read into, the silver and gold columns built from
 * them, and the metrics, Power BI measures and reports that read those.
 * Every edge is generated from a definition the code runs on: the
 * pipeline's variable metadata, the bronze reader's mapping, the warehouse
 * schema, the metric formulas and the report specs. Nothing is drawn by hand.
 */
import type { PipelineRun } from "@/lib/study-data";
import { STUDY_DATA_PRODUCT_ID } from "../../presets";
import type {
  LineageGraphEdge,
  LineageNode,
  LineageStage,
  MetricDefinition,
  MetricExpression,
  MetricFilter,
  MetricMeasure,
  PlatformLineage,
  ReportSpec,
} from "../../types";
import { PRODUCT_REGISTRATIONS } from "../governance/contracts/registry";
import { PIPELINE_BRONZE_LINEAGE } from "../portfolio/pipeline";
import { METRIC_REGISTRY } from "../semantic/registry";
import { dimension } from "../semantic/dimensions";
import { MILESTONE_TABLE } from "../semantic/plan";
import { warehouseLineage } from "../warehouse/lineage";
import { WAREHOUSE_SCHEMA } from "../warehouse/schema";

/** Stages in the order data flows through them. */
export const LINEAGE_STAGES: readonly LineageStage[] = [
  "collected",
  "sdtm",
  "adam",
  "bronze",
  "silver",
  "gold",
  "metric",
  "measure",
  "report",
];

/**
 * Layers a study variable's declared source is looked up in, nearest
 * first: an SDTM variable is collected; an ADaM variable comes from SDTM or
 * from another ADaM dataset such as ADSL.
 */
const SOURCE_LAYERS: Readonly<Record<string, readonly string[]>> = {
  collected: [],
  sdtm: ["collected"],
  adam: ["sdtm", "adam"],
};

/** Dataset of the metric nodes. */
export const METRICS_DATASET = "semantic.metrics";
/** Dataset of the Power BI measure nodes, one per metric. */
export const MEASURES_DATASET = "powerbi.governed_metrics";
/** Dataset of the report nodes. */
export const REPORTS_DATASET = "reporting.reports";

/** Columns a metric expression reads. */
function expressionColumns(expression: MetricExpression | null): string[] {
  if (expression === null) return [];
  switch (expression.kind) {
    case "column":
    case "date-of-key":
      return [expression.column];
    case "days-between":
      return [
        ...expressionColumns(expression.from),
        ...expressionColumns(expression.to),
      ];
    case "literal":
    case "data-cut":
      return [];
  }
}

/** Columns a measure reads, with how it reads each. */
function measureReads(
  measure: MetricMeasure
): { column: string; transformation: string }[] {
  const at = (column: string, transformation: string) => ({
    column: `${measure.table}.${column}`,
    transformation,
  });
  return [
    ...expressionColumns(measure.expression).map((c) => at(c, "measure")),
    ...measure.where.flatMap((predicate) =>
      predicate.kind === "compare"
        ? [
            ...expressionColumns(predicate.left),
            ...expressionColumns(predicate.right),
          ].map((c) => at(c, "filter"))
        : [at(predicate.column, "filter")]
    ),
    ...(measure.timeKey === null ? [] : [at(measure.timeKey, "time-key")]),
  ];
}

/** The home column of each dimension a filter names. */
function filterReads(
  filters: readonly MetricFilter[]
): { column: string; transformation: string }[] {
  return filters.map((f) => {
    const d = dimension(f.dimension);
    return { column: `${d.table}.${d.column}`, transformation: "filter" };
  });
}

/** Every column a metric reads. */
function metricReads(
  metric: MetricDefinition
): { column: string; transformation: string }[] {
  const formula = metric.formula;
  const reads =
    formula.kind === "simple"
      ? measureReads(formula.measure)
      : formula.kind === "ratio"
        ? [
            ...measureReads(formula.numerator),
            ...measureReads(formula.denominator),
          ]
        : [
            {
              column: `${MILESTONE_TABLE}.actual_date_key`,
              transformation: "measure",
            },
            {
              column: `${MILESTONE_TABLE}.milestone_key`,
              transformation: "filter",
            },
            {
              column: "gold.dim_milestone.milestone_kind",
              transformation: "filter",
            },
            {
              column: `${MILESTONE_TABLE}.study_key`,
              transformation: "group-by",
            },
          ];
  return [...reads, ...filterReads(metric.defaultFilters)];
}

function owners(productId: string): string[] {
  const registration = PRODUCT_REGISTRATIONS[productId];
  return registration === undefined
    ? []
    : [...new Set([registration.owner, registration.steward])];
}

/** Splits `dataset.field` where the field is the last part. */
function node(
  id: string,
  stage: LineageStage,
  rest: Omit<LineageNode, "id" | "stage" | "dataset" | "field">
): LineageNode {
  const at = id.lastIndexOf(".");
  return {
    id,
    stage,
    dataset: id.slice(0, at),
    field: id.slice(at + 1),
    ...rest,
  };
}

/**
 * Builds the platform lineage graph.
 *
 * @param run - A Study Data Pipeline run, which supplies the variable
 *   metadata; the metadata does not depend on the seed or subject count.
 * @param reports - Report specs to include, for example `REPORT_PACK`
 *   and the operations dashboard's specs.
 * @param metrics - Metrics to include, usually `METRIC_REGISTRY`.
 * @returns Nodes in stage order then by id, and edges by target then source.
 * @throws Error when a pipeline variable names a source that does not exist.
 */
export function platformLineage(
  run: PipelineRun,
  reports: readonly ReportSpec[],
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): PlatformLineage {
  const nodes = new Map<string, LineageNode>();
  const edges = new Map<string, LineageGraphEdge>();
  const add = (n: LineageNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
  };
  const link = (from: string, to: string, transformation: string) => {
    edges.set(`${to}|${from}|${transformation}`, { from, to, transformation });
  };

  // Study Data Pipeline variables, with the sources its metadata declares.
  const study = owners(STUDY_DATA_PRODUCT_ID);
  for (const dataset of run.datasets) {
    for (const variable of dataset.variables) {
      const id = `${dataset.layer}.${dataset.name}.${variable.name}`;
      add(
        node(id, dataset.layer, {
          label: variable.label,
          type: variable.type,
          method: variable.method ?? null,
          owners: study,
        })
      );
    }
  }
  for (const dataset of run.datasets) {
    const layers = SOURCE_LAYERS[dataset.layer];
    for (const variable of dataset.variables) {
      if (variable.source === undefined) continue;
      const to = `${dataset.layer}.${dataset.name}.${variable.name}`;
      // A source is `DATASET.VARIABLE`, or several joined by " or ".
      for (const source of variable.source.split(" or ")) {
        const from = layers
          .map((layer) => `${layer}.${source}`)
          .find((id) => nodes.has(id));
        if (from === undefined) {
          throw new Error(
            `${to} names a source ${source} the run does not have`
          );
        }
        link(from, to, "identity");
      }
    }
  }

  // The warehouse: bronze references, then silver and gold columns.
  for (const table of WAREHOUSE_SCHEMA.tables) {
    const productId = `${table.layer}.${table.name}`;
    for (const column of table.columns) {
      add(
        node(`${productId}.${column.name}`, table.layer, {
          label: column.name,
          type: column.type,
          method: null,
          owners: owners(productId),
        })
      );
    }
  }
  const bronze = (id: string) =>
    add(
      node(id, "bronze", {
        label: id.slice(id.lastIndexOf(".") + 1),
        type: null,
        method: null,
        owners: [],
      })
    );
  for (const edge of warehouseLineage(WAREHOUSE_SCHEMA)) {
    const from = `${edge.from.productId}.${edge.from.column}`;
    if (edge.from.layer === "bronze") bronze(from);
    link(from, `${edge.to.productId}.${edge.to.column}`, edge.transformation);
  }
  for (const edge of PIPELINE_BRONZE_LINEAGE) {
    bronze(edge.to);
    link(edge.from, edge.to, edge.transformation);
  }

  // Metrics and their Power BI measures.
  for (const metric of metrics) {
    const id = `${METRICS_DATASET}.${metric.id}`;
    const accountable = [...new Set([metric.owner, metric.steward])];
    add(
      node(id, "metric", {
        label: metric.name,
        type: null,
        method: null,
        owners: accountable,
      })
    );
    for (const read of metricReads(metric))
      link(read.column, id, read.transformation);
    const measure = `${MEASURES_DATASET}.${metric.id}`;
    add(
      node(measure, "measure", {
        label: metric.name,
        type: null,
        method: null,
        owners: accountable,
      })
    );
    link(id, measure, "dax");
  }

  // Reports: the metrics they show and the dimensions they group and filter by.
  for (const report of reports) {
    const id = `${REPORTS_DATASET}.${report.id}`;
    add(
      node(id, "report", {
        label: report.title,
        type: null,
        method: null,
        owners: [report.owner],
      })
    );
    for (const metricId of report.metrics)
      link(`${METRICS_DATASET}.${metricId}`, id, "display");
    for (const d of report.dimensions) {
      const home = dimension(d);
      link(`${home.table}.${home.column}`, id, "group-by");
    }
    for (const read of filterReads(report.filters))
      link(read.column, id, read.transformation);
  }

  const order = new Map(LINEAGE_STAGES.map((stage, i) => [stage, i]));
  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    nodes: [...nodes.values()].sort(
      (a, b) =>
        (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0) ||
        byText(a.id, b.id)
    ),
    edges: [...edges.values()].sort(
      (a, b) =>
        byText(a.to, b.to) ||
        byText(a.from, b.from) ||
        byText(a.transformation, b.transformation)
    ),
  };
}
