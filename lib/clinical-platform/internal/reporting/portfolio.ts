/**
 * The /platform/portfolio dashboard (#2632): the eight studies side by
 * side against their plans. The milestone swimlane reads the CTMS
 * milestones straight from `gold.fct_milestone`; the cycle-time benchmarks
 * and the finance reports are governed reports, so every number comes from
 * the metric registry through `buildReport` or `evaluateMetric`.
 */
import type {
  MetricDefinition,
  MilestoneKind,
  PortfolioBenchmark,
  PortfolioDashboard,
  PortfolioFinance,
  PortfolioLane,
  PortfolioMilestone,
  PortfolioMilestoneStatus,
  PortfolioOutlier,
  PortfolioOverrun,
  PortfolioSwimlane,
  ReportData,
  ReportSpec,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { evaluateMetric, percentile } from "../semantic/evaluate";
import { METRIC_REGISTRY } from "../semantic/registry";
import { daysBetween } from "../warehouse/dates";
import { buildReport } from "./build";
import { formatMetricValue } from "./format";
import { studyMilestones } from "./milestones";
import { isEnrolling, portfolioForecast } from "./portfolio-forecast";

const PORTFOLIO_OWNER = "Portfolio Management Lead";
const FINANCE_OWNER = "Clinical Finance Lead";

/**
 * The cycle times compared across studies, in the order a study meets
 * them: start-up, enrollment, close-out.
 */
const BENCHMARKS: readonly {
  readonly id: string;
  readonly metricId: string;
  readonly purpose: string;
}[] = [
  {
    id: "portfolio-start-up-by-study",
    metricId: "protocol_final_to_fpi_days",
    purpose:
      "How long each study took from a final protocol to its first subject, so a slow start-up can be compared with the rest of the portfolio.",
  },
  {
    id: "portfolio-enrollment-period-by-study",
    metricId: "fpi_to_lpi_days",
    purpose:
      "How long each study took to recruit, from its first subject in to its last, for studies that have finished enrolling.",
  },
  {
    id: "portfolio-close-out-by-study",
    metricId: "lplv_to_dbl_days",
    purpose:
      "How long each study took from its last subject's last visit to database lock, for studies that have locked.",
  },
];

/** Budget against forecast at completion, by study and by vendor (#2912). */
const AT_COMPLETION = [
  "budget_at_completion",
  "actual_spend",
  "forecast_at_completion",
];
const VARIANCE = ["variance_at_completion", "forecast_vs_budget_at_completion"];

const FINANCE: readonly Pick<
  ReportSpec,
  "id" | "title" | "purpose" | "metrics" | "dimensions" | "visual"
>[] = [
  {
    id: "portfolio-cost-at-completion-by-study",
    title: "Budget, actual and forecast at completion by study",
    purpose:
      "What each study is budgeted to cost by its final report, what it has spent so far and what it is now forecast to cost, so an overrun shows before it happens.",
    metrics: AT_COMPLETION,
    dimensions: ["study"],
    visual: "bar",
  },
  {
    id: "portfolio-cost-at-completion-by-vendor",
    title: "Budget, actual and forecast at completion by vendor",
    purpose:
      "The same across every study a vendor works on, so a vendor running over budget shows whichever study it is in.",
    metrics: AT_COMPLETION,
    dimensions: ["vendor"],
    visual: "bar",
  },
  {
    id: "portfolio-variance-at-completion-by-study",
    title: "Variance at completion and cost per enrolled subject by study",
    purpose:
      "How far each study's forecast is from its budget, in dollars and as a share, beside what each enrolled subject has cost so far.",
    metrics: [...VARIANCE, "cost_per_enrolled_subject"],
    dimensions: ["study"],
    visual: "table",
  },
  {
    id: "portfolio-variance-at-completion-by-vendor",
    title: "Variance at completion by vendor",
    purpose:
      "How far each vendor's forecast is from its budget across its studies, in dollars and as a share.",
    metrics: VARIANCE,
    dimensions: ["vendor"],
    visual: "table",
  },
];

function rows(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`the registry has no metric ${id}`);
  return found;
}

/**
 * The report spec of every governed report on the page: each cycle-time
 * benchmark, one metric by study as a bar chart, then the finance reports
 * (#2912).
 *
 * @returns The specs, benchmarks first, in page order.
 */
export function portfolioReportSpecs(): ReportSpec[] {
  const common = {
    audience: "Portfolio leadership",
    tier: "managed",
    version: "1.0.0",
    filters: [],
    signOff: null,
  } as const;
  return [
    ...BENCHMARKS.map((benchmark): ReportSpec => ({
      ...common,
      id: benchmark.id,
      title: `${metric(benchmark.metricId).name} by study`,
      purpose: benchmark.purpose,
      owner: PORTFOLIO_OWNER,
      metrics: [benchmark.metricId],
      dimensions: ["study"],
      visual: "bar",
      refreshSlaHours: 720,
    })),
    ...FINANCE.map((report): ReportSpec => ({
      ...common,
      ...report,
      owner: FINANCE_OWNER,
      // After each monthly finance close, as gold.fct_spend_forecast.
      refreshSlaHours: 744,
    })),
  ];
}

/** Where a milestone stands at the data cut. */
function statusOf(
  planned: string,
  actual: string | null,
  dataCut: string
): PortfolioMilestoneStatus {
  if (actual !== null) return actual > planned ? "late" : "on-time";
  return planned < dataCut ? "overdue" : "upcoming";
}

function lane(
  warehouse: Warehouse,
  study: WarehouseRow,
  dataCut: string
): PortfolioLane {
  const milestones: PortfolioMilestone[] = studyMilestones(
    warehouse,
    study.study_key
  ).map((m) => {
    const status = statusOf(m.planned, m.actual, dataCut);
    return {
      ...m,
      status,
      overdueDays:
        status === "overdue" ? daysBetween(m.planned, dataCut) : null,
    };
  });
  return {
    studyId: String(study.study_id),
    title: String(study.study_title),
    status: String(study.study_status),
    productType: String(study.product_type),
    operatingModel: String(study.operating_model),
    milestones,
    slipped: milestones.filter(
      (m) => m.status === "late" || m.status === "overdue"
    ).length,
  };
}

/** The first day of the month an ISO 8601 date falls in. */
function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The first day of the month after the one an ISO 8601 date falls in. */
function nextMonthStart(iso: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function swimlane(warehouse: Warehouse): PortfolioSwimlane {
  const dataCut = warehouse.asOf;
  const lanes = rows(warehouse, "gold.dim_study")
    .slice()
    .sort((a, b) =>
      String(a.study_id) < String(b.study_id)
        ? -1
        : String(a.study_id) > String(b.study_id)
          ? 1
          : 0
    )
    .map((study) => lane(warehouse, study, dataCut));
  const dates = [
    dataCut,
    ...lanes.flatMap((l) =>
      l.milestones.flatMap((m) =>
        m.actual === null ? [m.planned] : [m.planned, m.actual]
      )
    ),
  ].sort();
  const from = monthStart(dates[0]);
  const to = nextMonthStart(dates[dates.length - 1]);
  const years: string[] = [];
  for (
    let year = Number(from.slice(0, 4)) + (from.endsWith("-01-01") ? 0 : 1);
    `${year}-01-01` <= to;
    year += 1
  ) {
    years.push(`${year}-01-01`);
  }
  const kinds = rows(warehouse, "gold.dim_milestone")
    .slice()
    .sort((a, b) => Number(a.milestone_sequence) - Number(b.milestone_sequence))
    .map((m) => ({
      kind: String(m.milestone_kind) as MilestoneKind,
      name: String(m.milestone_name),
    }));
  return { from, to, years, kinds, lanes };
}

function benchmark(warehouse: Warehouse, spec: ReportSpec): PortfolioBenchmark {
  const report = buildReport(warehouse, spec);
  const definition = metric(spec.metrics[0]);
  // A median or quartile of whole days can fall between two of them.
  const summary = { format: { ...definition.format, decimals: 1 } };
  const values = report.rows.flatMap((row) =>
    row.cells[0].value === null
      ? []
      : [{ studyId: row.labels[0], value: row.cells[0].value }]
  );
  const numbers = values.map((v) => v.value);
  const median = percentile(numbers, 0.5);
  const lowerQuartile = percentile(numbers, 0.25);
  const upperQuartile = percentile(numbers, 0.75);
  let outlier: PortfolioOutlier | null = null;
  let beyondFences: string[] = [];
  if (
    median !== null &&
    lowerQuartile !== null &&
    upperQuartile !== null &&
    values.length >= 3
  ) {
    // The furthest from the median; on a tie, the slower, then the first by id.
    const furthest = values.reduce((best, candidate) => {
      const gap = Math.abs(candidate.value - median);
      const bestGap = Math.abs(best.value - median);
      return gap > bestGap || (gap === bestGap && candidate.value > best.value)
        ? candidate
        : best;
    });
    // Tukey's fences, 1.5 interquartile ranges past the quartiles.
    const fence = 1.5 * (upperQuartile - lowerQuartile);
    const beyond = (value: number) =>
      value > upperQuartile + fence || value < lowerQuartile - fence;
    beyondFences = values.filter((v) => beyond(v.value)).map((v) => v.studyId);
    outlier = {
      studyId: furthest.studyId,
      value: furthest.value,
      text: formatMetricValue(definition, furthest.value),
      fromMedian: furthest.value - median,
      fromMedianText: formatMetricValue(
        summary,
        Math.abs(furthest.value - median)
      ),
      beyondFence: beyond(furthest.value),
    };
  }
  return {
    report,
    studies: values.length,
    median,
    lowerQuartile,
    upperQuartile,
    medianText: formatMetricValue(summary, median),
    lowerQuartileText: formatMetricValue(summary, lowerQuartile),
    upperQuartileText: formatMetricValue(summary, upperQuartile),
    outlier,
    beyondFences,
  };
}

/** The value of one metric over the whole portfolio. */
function total(warehouse: Warehouse, id: string): number | null {
  return evaluateMetric(warehouse, metric(id)).rows[0]?.value ?? null;
}

/**
 * The studies or vendors of a variance report forecast to overrun, largest
 * overrun first, then by name.
 */
function overruns(report: ReportData): PortfolioOverrun[] {
  return report.rows
    .flatMap((row) => {
      const [variance, share] = row.cells;
      return variance.value !== null && variance.value > 0
        ? [
            {
              name: row.labels[0],
              variance: variance.value,
              varianceText: variance.text,
              shareText: share.text,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.variance - a.variance ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    );
}

function finance(
  warehouse: Warehouse,
  specs: readonly ReportSpec[]
): PortfolioFinance {
  const reports = specs.map((spec) => buildReport(warehouse, spec));
  const text = (id: string) =>
    formatMetricValue(metric(id), total(warehouse, id));
  const variance = total(warehouse, "variance_at_completion");
  return {
    budgetAtCompletionText: text("budget_at_completion"),
    actualSpendText: text("actual_spend"),
    forecastAtCompletionText: text("forecast_at_completion"),
    varianceAtCompletion: variance,
    varianceAtCompletionText: formatMetricValue(
      metric("variance_at_completion"),
      variance
    ),
    shareText: text("forecast_vs_budget_at_completion"),
    studyOverruns: overruns(reports[2]),
    vendorOverruns: overruns(reports[3]),
    reports,
  };
}

/**
 * The portfolio dashboard over one warehouse.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @returns The milestone swimlane, the cycle-time benchmarks, the
 * budget against forecast at completion and the baseline enrollment
 * forecast of each study still enrolling.
 */
export function portfolioDashboard(warehouse: Warehouse): PortfolioDashboard {
  const specs = portfolioReportSpecs();
  const lanes = swimlane(warehouse);
  return {
    dataCut: warehouse.asOf,
    swimlane: lanes,
    benchmarks: specs
      .slice(0, BENCHMARKS.length)
      .map((spec) => benchmark(warehouse, spec)),
    finance: finance(warehouse, specs.slice(BENCHMARKS.length)),
    forecasts: lanes.lanes
      .filter(isEnrolling)
      .map((lane) => portfolioForecast(warehouse, lane.studyId)),
  };
}
