/**
 * The governed metric registry: every metric a clinical operations and
 * portfolio lead reads, defined once over the gold star schema (#2623) and
 * compiled from here to every consumer. Only metrics the gold model can
 * compute are defined; the ones it cannot are listed in `METRIC_GAPS` with
 * what they lack.
 */
import type {
  MetricAggregation,
  MetricComparison,
  MetricDefinition,
  MetricDimensionId,
  MetricExpression,
  MetricFilter,
  MetricFormat,
  MetricGap,
  MetricMeasure,
  MetricPredicate,
} from "../../types";

const ENROLLMENT = "gold.fct_enrollment";
const VISIT = "gold.fct_visit";
const QUERY = "gold.fct_query";
const DEVIATION = "gold.fct_deviation";
const MONITORING = "gold.fct_monitoring_visit";
const PLANNED_MONITORING = "gold.fct_planned_monitoring_visit";
const SPEND = "gold.fct_spend";
const SITE = "gold.dim_site";

const col = (column: string): MetricExpression => ({ kind: "column", column });
const lit = (value: string | number | boolean): MetricExpression => ({
  kind: "literal",
  value,
});
const keyDate = (column: string): MetricExpression => ({
  kind: "date-of-key",
  column,
});
const DATA_CUT: MetricExpression = { kind: "data-cut" };
const daysBetween = (
  from: MetricExpression,
  to: MetricExpression
): MetricExpression => ({ kind: "days-between", from, to });

const compare = (
  left: MetricExpression,
  operator: MetricComparison,
  right: MetricExpression
): MetricPredicate => ({ kind: "compare", left, operator, right });
const is = (column: string, value: string | number | boolean) =>
  compare(col(column), "=", lit(value));
const isNot = (column: string, value: string | number | boolean) =>
  compare(col(column), "<>", lit(value));
const oneOf = (column: string, values: readonly string[]): MetricPredicate => ({
  kind: "in",
  column,
  values,
});
const present = (column: string): MetricPredicate => ({
  kind: "null",
  column,
  isNull: false,
});
const absent = (column: string): MetricPredicate => ({
  kind: "null",
  column,
  isNull: true,
});

function measure(
  table: string,
  aggregation: MetricAggregation,
  expression: MetricExpression | null,
  timeKey: string | null,
  ...where: MetricPredicate[]
): MetricMeasure {
  return { table, aggregation, expression, where, timeKey };
}

const count = (
  table: string,
  timeKey: string | null,
  ...where: MetricPredicate[]
) => measure(table, "count", null, timeKey, ...where);

const STUDY_DIMENSIONS: readonly MetricDimensionId[] = [
  "study",
  "study_status",
  "therapeutic_area",
  "phase",
  "product_type",
  "operating_model",
];
const FACT_DIMENSIONS: readonly MetricDimensionId[] = [
  ...STUDY_DIMENSIONS,
  "site",
  "country",
  "region",
];
const MONTHLY_DIMENSIONS: readonly MetricDimensionId[] = [
  ...FACT_DIMENSIONS,
  "month",
];
const QUERY_DIMENSIONS: readonly MetricDimensionId[] = [
  ...MONTHLY_DIMENSIONS,
  "queried_form",
];
const DEVIATION_DIMENSIONS: readonly MetricDimensionId[] = [
  ...MONTHLY_DIMENSIONS,
  "deviation_category",
  "deviation_importance",
];
const SCREEN_FAILURE_DIMENSIONS: readonly MetricDimensionId[] = [
  ...MONTHLY_DIMENSIONS,
  "screen_failure_reason",
];
const SITE_TARGET_DIMENSIONS: readonly MetricDimensionId[] = [
  "study",
  "site",
  "country",
];

const PERCENT: MetricFormat = { style: "percent", decimals: 1 };
const WHOLE: MetricFormat = { style: "number", decimals: 0 };
const ONE_DECIMAL: MetricFormat = { style: "number", decimals: 1 };

const OPS_OWNER = "Clinical Operations Lead";
const OPS_STEWARD = "Clinical Operations Data Steward";
const DM_OWNER = "Clinical Data Management Lead";
const DM_STEWARD = "Clinical Data Steward";

/** Backlog metrics leave closed studies out unless a query says otherwise. */
const ONGOING_STUDIES: readonly MetricFilter[] = [
  { dimension: "study_status", operator: "not-in", values: ["closed"] },
];

const REGISTERED_ON = "2026-10-24";

type Draft = Omit<
  MetricDefinition,
  "version" | "status" | "changeLog" | "defaultFilters" | "grain"
> &
  Partial<Pick<MetricDefinition, "status" | "defaultFilters" | "grain">>;

/**
 * A metric's first version. `issue` is the one that added it to the
 * registry: #2624 for the metrics the registry started with.
 */
function define(draft: Draft, issue = 2624): MetricDefinition {
  return {
    grain: "portfolio",
    defaultFilters: [],
    status: "certified",
    ...draft,
    version: "1.0.0",
    changeLog: [
      {
        version: "1.0.0",
        date: REGISTERED_ON,
        summary: `First definition in the governed metric registry (#${issue}).`,
      },
    ],
  };
}

/**
 * A later version of a metric: the version and a change log entry on top of
 * its first definition. A formula change is a major version (#2735).
 */
function revise(
  metric: MetricDefinition,
  version: string,
  date: string,
  summary: string
): MetricDefinition {
  return {
    ...metric,
    version,
    changeLog: [...metric.changeLog, { version, date, summary }],
  };
}

const enrolled = count(
  ENROLLMENT,
  "event_date_key",
  is("event_type", "enrolled")
);
const performedVisits = count(
  VISIT,
  "visit_date_key",
  present("visit_date_key")
);
const enteredLag = (aggregation: MetricAggregation) =>
  measure(
    VISIT,
    aggregation,
    col("entry_lag_days"),
    "visit_date_key",
    present("entry_lag_days"),
    present("visit_date_key")
  );
const unresolvedQuery = oneOf("query_status", ["open", "answered"]);
const queryAge = daysBetween(keyDate("opened_date_key"), DATA_CUT);
/** Revisions that let a query metric be grouped by the queried form. */
const BY_FORM: readonly [string, string, string] = [
  "1.1.0",
  "2026-10-25",
  "Allows the queried_form dimension, the CRF form of the queried field (#2759).",
];

/**
 * Queries not closed at the data cut whose age at the cut falls in a band
 * of whole days, from `from` to `to` inclusive (`to` null for no upper end).
 */
function agedQueries(
  id: string,
  name: string,
  from: number,
  to: number | null
): MetricDefinition {
  const band = to === null ? `more than ${from - 1}` : `${from} to ${to}`;
  return define(
    {
      id,
      name,
      description: `Queries not closed at the data cut that opened ${band} days before it, counted between UTC dates. With the other age bands it splits the open queries, so the four add up to them. Closed studies are left out by default, because their backlog is history.`,
      formula: {
        kind: "simple",
        measure: count(
          QUERY,
          "opened_date_key",
          unresolvedQuery,
          compare(queryAge, ">=", lit(from)),
          ...(to === null ? [] : [compare(queryAge, "<=", lit(to))])
        ),
      },
      allowedDimensions: QUERY_DIMENSIONS,
      defaultFilters: ONGOING_STUDIES,
      unit: "queries",
      format: WHOLE,
      owner: DM_OWNER,
      steward: DM_STEWARD,
      glossaryTerm: "data-query-term",
      displayFolder: "Queries",
    },
    2759
  );
}
const actualSpend = measure(SPEND, "sum", col("actual_usd"), "month_date_key");

/**
 * The governed metrics, grouped by display folder. Every one is computable
 * from the gold star schema; `METRIC_GAPS` lists the ones that are not.
 */
export const METRIC_REGISTRY: readonly MetricDefinition[] = Object.freeze([
  define({
    id: "subjects_screened",
    name: "Subjects screened",
    description:
      "Subjects who entered screening, counted on their screening date. Each counts once, whatever the screening outcome.",
    formula: {
      kind: "simple",
      measure: count(
        ENROLLMENT,
        "event_date_key",
        is("event_type", "screened")
      ),
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "subjects",
    format: WHOLE,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "screening-term",
    displayFolder: "Enrollment",
  }),
  define({
    id: "subjects_enrolled",
    name: "Subjects enrolled",
    description:
      "Subjects enrolled into a study, counted on their enrollment date. Subjects who later completed or discontinued still count.",
    formula: { kind: "simple", measure: enrolled },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "subjects",
    format: WHOLE,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "enrollment-term",
    displayFolder: "Enrollment",
  }),
  define({
    id: "enrollment_vs_plan",
    name: "Enrollment vs plan",
    description:
      "Enrolled subjects as a share of the planned enrollment, the sum of the current site targets. The plan is the whole-study target, not a time-phased curve, so an enrolling study is expected to sit below 100%.",
    formula: {
      kind: "ratio",
      numerator: enrolled,
      denominator: measure(
        SITE,
        "sum",
        col("planned_enrollment"),
        null,
        is("is_current", true)
      ),
      scale: 1,
    },
    allowedDimensions: SITE_TARGET_DIMENSIONS,
    unit: "share of target",
    format: PERCENT,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "enrollment-term",
    displayFolder: "Enrollment",
  }),
  define({
    id: "screen_failure_rate",
    name: "Screen failure rate",
    description:
      "Share of screened subjects whose screening ended in a screen failure, by screening date. Subjects still in screening at the data cut have no outcome yet and are left out of both counts.",
    formula: {
      kind: "ratio",
      numerator: count(
        ENROLLMENT,
        "event_date_key",
        is("event_type", "screened"),
        is("subject_status", "screen-failed")
      ),
      denominator: count(
        ENROLLMENT,
        "event_date_key",
        is("event_type", "screened"),
        isNot("subject_status", "screening")
      ),
      scale: 1,
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "share of screened subjects",
    format: PERCENT,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "screen-failure-term",
    displayFolder: "Enrollment",
  }),
  define(
    {
      id: "screen_failures",
      name: "Screen failures",
      description:
        "Subjects whose screening ended in a screen failure, by screening date. It can be broken down by the reason screening failed; the screen failure rate cannot, because its denominator holds the subjects who passed, and they have no reason.",
      formula: {
        kind: "simple",
        measure: count(
          ENROLLMENT,
          "event_date_key",
          is("event_type", "screened"),
          is("subject_status", "screen-failed")
        ),
      },
      allowedDimensions: SCREEN_FAILURE_DIMENSIONS,
      unit: "subjects",
      format: WHOLE,
      owner: OPS_OWNER,
      steward: OPS_STEWARD,
      glossaryTerm: "screen-failure-term",
      displayFolder: "Enrollment",
    },
    2879
  ),
  define({
    id: "early_termination_rate",
    name: "Early termination rate",
    description:
      "Subjects who discontinued before completing the study, as a share of subjects enrolled.",
    formula: {
      kind: "ratio",
      numerator: count(
        ENROLLMENT,
        "event_date_key",
        is("event_type", "discontinued")
      ),
      denominator: enrolled,
      scale: 1,
    },
    allowedDimensions: FACT_DIMENSIONS,
    unit: "share of enrolled subjects",
    format: PERCENT,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "early-termination-term",
    displayFolder: "Enrollment",
  }),
  define({
    id: "site_activation_cycle_time",
    name: "Site activation cycle time",
    description:
      "Median days from the study's protocol finalisation to a site's activation, over activated sites. Protocol finalisation is gold.dim_study.start_on; the metric reads it as the first day of the site's first gold.dim_site version, which the gold build opens on that date.",
    formula: {
      kind: "simple",
      measure: measure(
        SITE,
        "median",
        daysBetween(col("valid_from"), col("activated_on")),
        null,
        is("version_number", 1),
        present("activated_on")
      ),
    },
    allowedDimensions: SITE_TARGET_DIMENSIONS,
    unit: "days",
    format: ONE_DECIMAL,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "site-activation-term",
    displayFolder: "Site start-up",
  }),
  define({
    id: "data_entry_lag_median",
    name: "Data entry lag (median)",
    description:
      "Median days from a visit to the entry of its data in the EDC, over visits with data entered.",
    formula: { kind: "simple", measure: enteredLag("median") },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "days",
    format: ONE_DECIMAL,
    owner: DM_OWNER,
    steward: DM_STEWARD,
    glossaryTerm: "edc-term",
    displayFolder: "Visits and data entry",
  }),
  define({
    id: "data_entry_lag_p90",
    name: "Data entry lag (90th percentile)",
    description:
      "90th percentile of days from a visit to the entry of its data in the EDC, interpolated linearly between ranked values. It shows the slow tail the median hides.",
    formula: { kind: "simple", measure: enteredLag("p90") },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "days",
    format: ONE_DECIMAL,
    owner: DM_OWNER,
    steward: DM_STEWARD,
    glossaryTerm: "edc-term",
    displayFolder: "Visits and data entry",
  }),
  define({
    id: "data_entry_lag_mean",
    name: "Data entry lag (mean)",
    description:
      "Mean days from a visit to the entry of its data in the EDC, over visits with data entered. The key risk indicator for entry timeliness.",
    formula: { kind: "simple", measure: enteredLag("mean") },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "days",
    format: ONE_DECIMAL,
    owner: DM_OWNER,
    steward: DM_STEWARD,
    glossaryTerm: "edc-term",
    displayFolder: "Visits and data entry",
  }),
  define({
    id: "missed_visit_rate",
    name: "Missed visit rate",
    description:
      "Missed visits as a share of all visits due by the data cut, dated by the planned visit date.",
    formula: {
      kind: "ratio",
      numerator: count(VISIT, "planned_date_key", is("visit_status", "missed")),
      denominator: count(VISIT, "planned_date_key"),
      scale: 1,
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "share of visits due",
    format: PERCENT,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "missed-visit-term",
    displayFolder: "Visits and data entry",
  }),
  define({
    id: "out_of_window_visit_rate",
    name: "Out-of-window visit rate",
    description:
      "Visits performed outside their protocol window, as a share of visits performed.",
    formula: {
      kind: "ratio",
      numerator: count(
        VISIT,
        "visit_date_key",
        present("visit_date_key"),
        is("is_out_of_window", true)
      ),
      denominator: performedVisits,
      scale: 1,
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "share of visits performed",
    format: PERCENT,
    owner: OPS_OWNER,
    steward: OPS_STEWARD,
    glossaryTerm: "visit-window-term",
    displayFolder: "Visits and data entry",
  }),
  define({
    id: "query_rate_per_100_visits",
    name: "Query rate per 100 visits",
    description:
      "Data queries opened per 100 visits performed. The gold model holds no CRF page counts, so the rate is per visit rather than per 100 CRF pages.",
    formula: {
      kind: "ratio",
      numerator: count(QUERY, "opened_date_key"),
      denominator: performedVisits,
      scale: 100,
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "queries per 100 visits",
    format: ONE_DECIMAL,
    owner: DM_OWNER,
    steward: DM_STEWARD,
    glossaryTerm: "data-query-term",
    displayFolder: "Queries",
  }),
  revise(
    define({
      id: "open_query_count",
      name: "Open queries",
      description:
        "Queries not closed at the data cut: still open, or answered by the site and awaiting review. Closed studies are left out by default, because their backlog is history.",
      formula: {
        kind: "simple",
        measure: count(QUERY, "opened_date_key", unresolvedQuery),
      },
      allowedDimensions: QUERY_DIMENSIONS,
      defaultFilters: ONGOING_STUDIES,
      unit: "queries",
      format: WHOLE,
      owner: DM_OWNER,
      steward: DM_STEWARD,
      glossaryTerm: "data-query-term",
      displayFolder: "Queries",
    }),
    ...BY_FORM
  ),
  revise(
    define({
      id: "query_aging_mean",
      name: "Query aging",
      description:
        "Mean days from opening to the data cut of the queries not closed at the cut. Closed studies are left out by default, because their backlog is history.",
      formula: {
        kind: "simple",
        measure: measure(
          QUERY,
          "mean",
          queryAge,
          "opened_date_key",
          unresolvedQuery
        ),
      },
      allowedDimensions: QUERY_DIMENSIONS,
      defaultFilters: ONGOING_STUDIES,
      unit: "days",
      format: ONE_DECIMAL,
      owner: DM_OWNER,
      steward: DM_STEWARD,
      glossaryTerm: "data-query-term",
      displayFolder: "Queries",
    }),
    ...BY_FORM
  ),
  revise(
    define({
      id: "query_resolution_time_median",
      name: "Query resolution time (median)",
      description:
        "Median calendar days from a query's opening to its closing, over closed queries. Days are counted between UTC dates.",
      formula: {
        kind: "simple",
        measure: measure(
          QUERY,
          "median",
          daysBetween(keyDate("opened_date_key"), keyDate("closed_date_key")),
          "opened_date_key",
          present("closed_date_key")
        ),
      },
      allowedDimensions: QUERY_DIMENSIONS,
      unit: "days",
      format: ONE_DECIMAL,
      owner: DM_OWNER,
      steward: DM_STEWARD,
      glossaryTerm: "data-query-term",
      displayFolder: "Queries",
    }),
    ...BY_FORM
  ),
  agedQueries(
    "open_queries_aged_0_7_days",
    "Open queries aged 0 to 7 days",
    0,
    7
  ),
  agedQueries(
    "open_queries_aged_8_30_days",
    "Open queries aged 8 to 30 days",
    8,
    30
  ),
  agedQueries(
    "open_queries_aged_31_60_days",
    "Open queries aged 31 to 60 days",
    31,
    60
  ),
  agedQueries(
    "open_queries_aged_over_60_days",
    "Open queries aged over 60 days",
    61,
    null
  ),
  define({
    id: "sdv_completion",
    name: "SDV completion",
    description:
      "CRF pages source-verified at monitoring visits as a share of the pages due for source data verification at those visits.",
    formula: {
      kind: "ratio",
      numerator: measure(
        MONITORING,
        "sum",
        col("sdv_pages_verified"),
        "visit_date_key"
      ),
      denominator: measure(
        MONITORING,
        "sum",
        col("sdv_pages_due"),
        "visit_date_key"
      ),
      scale: 1,
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "share of pages due",
    format: PERCENT,
    owner: "Clinical Monitoring Lead",
    steward: OPS_STEWARD,
    glossaryTerm: "sdv-term",
    displayFolder: "Monitoring",
  }),
  revise(
    define({
      id: "monitoring_reports_overdue",
      name: "Overdue monitoring visit reports",
      description:
        "Monitoring visits whose report was still not final after its due date, at the data cut. The due date is the visit date plus the report deadline in the study's monitoring plan.",
      formula: {
        kind: "simple",
        measure: count(
          MONITORING,
          "visit_date_key",
          absent("report_final_date_key"),
          compare(
            daysBetween(keyDate("report_due_date_key"), DATA_CUT),
            ">",
            lit(0)
          )
        ),
      },
      allowedDimensions: MONTHLY_DIMENSIONS,
      defaultFilters: ONGOING_STUDIES,
      unit: "monitoring visits",
      format: WHOLE,
      owner: "Clinical Monitoring Lead",
      steward: OPS_STEWARD,
      glossaryTerm: "monitoring-visit-term",
      displayFolder: "Monitoring",
    }),
    "2.0.0",
    "2026-10-24",
    "Reads each report's deadline from the study's monitoring plan (gold.fct_monitoring_visit.report_due_date_key) instead of an assumed 20 days, and is certified (#2736)."
  ),
  define(
    {
      id: "monitoring_visits_overdue",
      name: "Overdue interim monitoring visits",
      description:
        "Interim monitoring visits the monitoring plan scheduled whose visit window closed before the data cut with no visit made. Each site's next visit is planned the plan's interval after its previous visit and is on time until the plan's window closes.",
      formula: {
        kind: "simple",
        measure: count(
          PLANNED_MONITORING,
          "due_date_key",
          absent("actual_date_key"),
          compare(daysBetween(keyDate("due_date_key"), DATA_CUT), ">", lit(0))
        ),
      },
      allowedDimensions: MONTHLY_DIMENSIONS,
      defaultFilters: ONGOING_STUDIES,
      unit: "planned visits",
      format: WHOLE,
      owner: "Clinical Monitoring Lead",
      steward: OPS_STEWARD,
      glossaryTerm: "monitoring-visit-term",
      displayFolder: "Monitoring",
    },
    2736
  ),
  define({
    id: "monitoring_report_cycle_time_median",
    name: "Monitoring report cycle time (median)",
    description:
      "Median days from a monitoring visit to its final report, over visits whose report is final.",
    formula: {
      kind: "simple",
      measure: measure(
        MONITORING,
        "median",
        col("days_to_final_report"),
        "visit_date_key",
        present("days_to_final_report")
      ),
    },
    allowedDimensions: MONTHLY_DIMENSIONS,
    unit: "days",
    format: ONE_DECIMAL,
    owner: "Clinical Monitoring Lead",
    steward: OPS_STEWARD,
    glossaryTerm: "monitoring-visit-term",
    displayFolder: "Monitoring",
  }),
  define({
    id: "important_deviation_rate",
    name: "Important deviations per 100 subjects",
    description:
      "Protocol deviations classed as important (after ICH E3) per 100 enrolled subjects.",
    formula: {
      kind: "ratio",
      numerator: count(
        DEVIATION,
        "occurred_date_key",
        is("is_important", true)
      ),
      denominator: enrolled,
      scale: 100,
    },
    allowedDimensions: FACT_DIMENSIONS,
    unit: "deviations per 100 enrolled subjects",
    format: ONE_DECIMAL,
    owner: "Clinical Quality Lead",
    steward: OPS_STEWARD,
    glossaryTerm: "important-deviation-term",
    displayFolder: "Protocol deviations",
  }),
  define({
    id: "non_important_deviation_rate",
    name: "Non-important deviations per 100 subjects",
    description:
      "Protocol deviations not classed as important per 100 enrolled subjects.",
    formula: {
      kind: "ratio",
      numerator: count(
        DEVIATION,
        "occurred_date_key",
        is("is_important", false)
      ),
      denominator: enrolled,
      scale: 100,
    },
    allowedDimensions: FACT_DIMENSIONS,
    unit: "deviations per 100 enrolled subjects",
    format: ONE_DECIMAL,
    owner: "Clinical Quality Lead",
    steward: OPS_STEWARD,
    glossaryTerm: "protocol-deviation-term",
    displayFolder: "Protocol deviations",
  }),
  define({
    id: "subjects_with_important_deviation",
    name: "Subjects with an important deviation",
    description:
      "Share of enrolled subjects with at least one important protocol deviation, a common study-level quality tolerance limit parameter.",
    formula: {
      kind: "ratio",
      numerator: measure(
        DEVIATION,
        "count-distinct",
        col("subject_id"),
        "occurred_date_key",
        is("is_important", true)
      ),
      denominator: enrolled,
      scale: 1,
    },
    allowedDimensions: FACT_DIMENSIONS,
    unit: "share of enrolled subjects",
    format: PERCENT,
    owner: "Clinical Quality Lead",
    steward: OPS_STEWARD,
    glossaryTerm: "important-deviation-term",
    displayFolder: "Protocol deviations",
  }),
  define(
    {
      id: "protocol_deviation_count",
      name: "Protocol deviations",
      description:
        "Protocol deviations that occurred, important or not, counted on the date each occurred. It can be broken down by category and importance; the rates per 100 enrolled subjects cannot, because enrollment has neither.",
      formula: {
        kind: "simple",
        measure: count(DEVIATION, "occurred_date_key"),
      },
      allowedDimensions: DEVIATION_DIMENSIONS,
      unit: "deviations",
      format: WHOLE,
      owner: "Clinical Quality Lead",
      steward: OPS_STEWARD,
      glossaryTerm: "protocol-deviation-term",
      displayFolder: "Protocol deviations",
    },
    2759
  ),
  define({
    id: "fpi_to_lpi_days",
    name: "First subject in to last subject in",
    description:
      "Days from the first subject's enrollment to the last subject's in one study: the enrollment period. A study that has not reached both milestones has no value.",
    formula: {
      kind: "milestone-span",
      from: "first-subject-in",
      to: "last-subject-in",
    },
    grain: "study",
    allowedDimensions: STUDY_DIMENSIONS,
    unit: "days",
    format: WHOLE,
    owner: "Portfolio Management Lead",
    steward: "Portfolio Data Steward",
    glossaryTerm: "enrollment-period-term",
    displayFolder: "Milestones",
  }),
  define({
    id: "lplv_to_dbl_days",
    name: "Last subject last visit to database lock",
    description:
      "Days from the last subject's last visit to database lock in one study. A study that has not reached both milestones has no value.",
    formula: {
      kind: "milestone-span",
      from: "last-subject-last-visit",
      to: "database-lock",
    },
    grain: "study",
    allowedDimensions: STUDY_DIMENSIONS,
    unit: "days",
    format: WHOLE,
    owner: "Portfolio Management Lead",
    steward: "Portfolio Data Steward",
    glossaryTerm: "database-lock-term",
    displayFolder: "Milestones",
  }),
  define({
    id: "budget_burn_vs_plan",
    name: "Budget burn vs plan",
    description:
      "Actual spend as a share of the budget for the same months, up to the data cut. Above 100% means spend runs ahead of budget.",
    formula: {
      kind: "ratio",
      numerator: actualSpend,
      denominator: measure(SPEND, "sum", col("budget_usd"), "month_date_key"),
      scale: 1,
    },
    allowedDimensions: [...STUDY_DIMENSIONS, "vendor", "month"],
    unit: "share of budget",
    format: PERCENT,
    owner: "Clinical Finance Lead",
    steward: "Finance Data Steward",
    glossaryTerm: "budget-burn-term",
    displayFolder: "Finance",
  }),
  define({
    id: "cost_per_enrolled_subject",
    name: "Cost per enrolled subject",
    description:
      "Actual spend up to the data cut divided by the number of subjects enrolled. The gold model holds no randomisation fact, so the denominator is enrolled rather than randomised subjects.",
    formula: {
      kind: "ratio",
      numerator: actualSpend,
      denominator: enrolled,
      scale: 1,
    },
    allowedDimensions: STUDY_DIMENSIONS,
    unit: "USD per enrolled subject",
    format: { style: "currency", decimals: 0 },
    owner: "Clinical Finance Lead",
    steward: "Finance Data Steward",
    glossaryTerm: "enrollment-term",
    displayFolder: "Finance",
  }),
]);

/**
 * Metrics a clinical operations or portfolio lead would expect that the gold
 * model (warehouse schema 1.1.0) cannot compute. Each names the gold data it
 * lacks and, where one exists, the registry metric that covers part of it.
 */
export const METRIC_GAPS: readonly MetricGap[] = Object.freeze([
  {
    name: "eTMF completeness",
    reason:
      "Expected and filed eTMF documents reach silver (silver.etmf_document) but no gold fact.",
    missing:
      "A gold fact of expected eTMF documents with due and filed date keys and the site and study keys.",
    nearestMetricId: null,
  },
  {
    name: "Forecast at completion",
    reason:
      "gold.fct_spend holds budget only for months up to the data cut, so there is no budget at completion to forecast against.",
    missing:
      "The approved budget for future periods, or a budget at completion per study and vendor.",
    nearestMetricId: "budget_burn_vs_plan",
  },
  {
    name: "Cost per randomised subject",
    reason:
      "Randomisations reach silver (silver.irt_randomization) but no gold fact.",
    missing:
      "A gold fact of randomisations with the study, site and date keys.",
    nearestMetricId: "cost_per_enrolled_subject",
  },
  {
    name: "Query rate per 100 CRF pages",
    reason:
      "No gold table counts the CRF pages a visit produces; sdv_pages_due counts only the pages due for source data verification.",
    missing: "The number of CRF pages entered per visit in gold.fct_visit.",
    nearestMetricId: "query_rate_per_100_visits",
  },
  {
    name: "Enrollment against a time-phased plan",
    reason:
      "Gold holds each site's total enrollment target but no planned enrollment by month.",
    missing: "Planned cumulative enrollment per study or site and month.",
    nearestMetricId: "enrollment_vs_plan",
  },
  {
    name: "Adverse event reporting rate (key risk indicator)",
    reason:
      "The operational gold marts hold no adverse events; they exist only in the Study Data Pipeline's SDTM for DEMO-301.",
    missing:
      "A gold fact of reported adverse events with the study, site and onset date keys for every study.",
    nearestMetricId: null,
  },
  {
    name: "Primary endpoint missing data (quality tolerance limit)",
    reason: "Gold holds no endpoint assessments.",
    missing:
      "Planned and collected primary endpoint assessments per subject and visit.",
    nearestMetricId: null,
  },
]);
