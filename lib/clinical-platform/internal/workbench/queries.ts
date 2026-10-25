/**
 * The SQL workbench's saved query library (#2633): worked examples of the
 * SQL an analyst writes against the gold star schema, and the generated SQL
 * behind every governed metric, so a reviewer can ask "show me the SQL
 * behind this number" and run it. Every query is DuckDB SQL over the tables
 * `emitDdl` creates; the tests execute each one on the seeded warehouse.
 */
import type {
  MetricDefinition,
  MetricDimensionId,
  SqlDialect,
  WorkbenchQuery,
} from "../../types";
import { METRIC_REGISTRY } from "../semantic/registry";
import { toSql } from "../semantic/sql";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The three dialects the metric compiler writes, in display order. */
export const WORKBENCH_DIALECTS: readonly SqlDialect[] = [
  "duckdb",
  "postgres",
  "tsql",
];

/** Hand-written examples, each showing one technique on the gold tables. */
function examples(cut: string): WorkbenchQuery[] {
  const example = (
    query: Omit<WorkbenchQuery, "kind" | "metricId" | "dimensions" | "dialects">
  ): WorkbenchQuery => ({
    ...query,
    kind: "example",
    metricId: null,
    dimensions: [],
    dialects: null,
  });
  return [
    example({
      id: "open-query-aging",
      title: "Open query aging",
      description:
        "Every query not closed at the data cut, with its age in days, its rank by age within its study, the number open in the study and its site's median age. Closed studies are left out, as the certified open-query metrics leave them out.",
      techniques: ["window functions", "star-schema joins"],
      tables: [
        "gold.fct_query",
        "gold.dim_study",
        "gold.dim_site",
        "gold.dim_date",
      ],
      sql: `-- Open queries at the data cut (${cut}), oldest first within each study.
WITH open_queries AS (
  SELECT
    s.study_id,
    si.site_id,
    q.query_id,
    q.queried_field,
    date_diff('day', d.calendar_date, DATE '${cut}') AS age_days
  FROM gold.fct_query AS q
  JOIN gold.dim_study AS s ON s.study_key = q.study_key
  JOIN gold.dim_site AS si ON si.site_key = q.site_key
  JOIN gold.dim_date AS d ON d.date_key = q.opened_date_key
  WHERE q.query_status IN ('open', 'answered')
    AND s.study_status <> 'closed'
)
SELECT
  study_id,
  site_id,
  query_id,
  queried_field,
  age_days,
  RANK() OVER (PARTITION BY study_id ORDER BY age_days DESC) AS age_rank_in_study,
  COUNT(*) OVER (PARTITION BY study_id) AS open_in_study,
  MEDIAN(age_days) OVER (PARTITION BY study_id, site_id) AS site_median_age_days
FROM open_queries
ORDER BY study_id, age_rank_in_study, query_id;`,
    }),
    example({
      id: "enrollment-against-plan",
      title: "Enrollment against plan by study",
      description:
        "Subjects enrolled in each study against the planned enrollment of its current sites. One common table expression counts, another sums the plan, and the outer query joins them to every study, so a study with no enrollment still shows.",
      techniques: ["common table expressions", "outer joins"],
      tables: ["gold.fct_enrollment", "gold.dim_site", "gold.dim_study"],
      sql: `-- Enrollment against plan by study.
WITH enrolled AS (
  SELECT f.study_key, COUNT(*) AS enrolled
  FROM gold.fct_enrollment AS f
  WHERE f.event_type = 'enrolled'
  GROUP BY f.study_key
),
planned AS (
  SELECT si.study_id, SUM(si.planned_enrollment) AS planned
  FROM gold.dim_site AS si
  WHERE si.is_current
  GROUP BY si.study_id
)
SELECT
  s.study_id,
  s.study_status,
  COALESCE(e.enrolled, 0) AS enrolled,
  p.planned,
  ROUND(100.0 * COALESCE(e.enrolled, 0) / NULLIF(p.planned, 0), 1) AS percent_of_plan
FROM gold.dim_study AS s
LEFT JOIN enrolled AS e ON e.study_key = s.study_key
LEFT JOIN planned AS p ON p.study_id = s.study_id
ORDER BY s.study_id;`,
    }),
    example({
      id: "milestone-lifecycle",
      title: "Study lifecycle, milestone by milestone",
      description:
        "Walks each study's milestones in lifecycle order with a recursive query: it starts at the first milestone and steps to the next in sequence, carrying the days since the previous milestone and since the first. A milestone not reached yet uses its planned date.",
      techniques: ["recursive common table expressions"],
      tables: [
        "gold.fct_milestone",
        "gold.dim_milestone",
        "gold.dim_study",
        "gold.dim_date",
      ],
      sql: `-- Each study's lifecycle as a chain of milestones.
WITH RECURSIVE dated AS (
  SELECT
    f.study_key,
    m.milestone_sequence,
    m.milestone_name,
    f.is_reached,
    COALESCE(a.calendar_date, p.calendar_date) AS milestone_date
  FROM gold.fct_milestone AS f
  JOIN gold.dim_milestone AS m ON m.milestone_key = f.milestone_key
  JOIN gold.dim_date AS p ON p.date_key = f.planned_date_key
  LEFT JOIN gold.dim_date AS a ON a.date_key = f.actual_date_key
),
chain AS (
  SELECT
    study_key,
    milestone_sequence,
    milestone_name,
    is_reached,
    milestone_date,
    0 AS days_since_previous,
    0 AS days_since_first
  FROM dated
  WHERE milestone_sequence = 1
  UNION ALL
  SELECT
    n.study_key,
    n.milestone_sequence,
    n.milestone_name,
    n.is_reached,
    n.milestone_date,
    date_diff('day', c.milestone_date, n.milestone_date),
    c.days_since_first + date_diff('day', c.milestone_date, n.milestone_date)
  FROM chain AS c
  JOIN dated AS n
    ON n.study_key = c.study_key
   AND n.milestone_sequence = c.milestone_sequence + 1
)
SELECT
  s.study_id,
  c.milestone_sequence,
  c.milestone_name,
  c.milestone_date,
  c.is_reached,
  c.days_since_previous,
  c.days_since_first
FROM chain AS c
JOIN gold.dim_study AS s ON s.study_key = c.study_key
ORDER BY s.study_id, c.milestone_sequence;`,
    }),
    example({
      id: "deviation-site-as-of",
      title: "Deviations with the site as it stood that day",
      description:
        "Joins each protocol deviation to the version of its site in force on the day it occurred, from the site's type 2 history: a version holds from valid_from up to, not including, valid_to. The current version sits beside it, so a status that has changed since shows.",
      techniques: ["slowly changing dimension type 2", "point-in-time joins"],
      tables: ["gold.fct_deviation", "gold.dim_site", "gold.dim_date"],
      sql: `-- Each deviation with its site's status then and now.
SELECT
  f.deviation_id,
  cur.site_id,
  d.calendar_date AS occurred_on,
  hist.version_number AS version_then,
  hist.site_status AS status_then,
  cur.version_number AS version_now,
  cur.site_status AS status_now
FROM gold.fct_deviation AS f
JOIN gold.dim_date AS d ON d.date_key = f.occurred_date_key
JOIN gold.dim_site AS keyed ON keyed.site_key = f.site_key
JOIN gold.dim_site AS hist
  ON hist.site_id = keyed.site_id
 AND d.calendar_date >= hist.valid_from
 AND d.calendar_date < hist.valid_to
JOIN gold.dim_site AS cur
  ON cur.site_id = keyed.site_id
 AND cur.is_current
ORDER BY cur.site_id, occurred_on, f.deviation_id;`,
    }),
  ];
}

/**
 * One governed metric as a saved query, in every dialect, grouped by study
 * where the metric allows it: the level the platform pages show it at, and
 * the level a milestone span is defined at.
 */
function metricQuery(metric: MetricDefinition, cut: string): WorkbenchQuery {
  const dimensions: MetricDimensionId[] = metric.allowedDimensions.includes(
    "study"
  )
    ? ["study"]
    : [];
  const dialects = Object.fromEntries(
    WORKBENCH_DIALECTS.map((dialect) => [
      dialect,
      toSql(metric, dimensions, [], dialect, { dataCut: cut }),
    ])
  ) as Record<SqlDialect, string>;
  return {
    id: `metric-${metric.id.replaceAll("_", "-")}`,
    title: metric.name,
    kind: "metric",
    description: metric.description,
    techniques: ["generated by the metric compiler"],
    tables: [
      ...new Set(
        [...dialects.duckdb.matchAll(/"gold"\."(\w+)"/g)].map(
          (m) => `gold.${m[1]}`
        )
      ),
    ].sort(),
    sql: dialects.duckdb,
    metricId: metric.id,
    dimensions,
    dialects,
  };
}

/**
 * The saved queries: the worked examples, then one per governed metric in
 * registry order, each metric query carrying its DuckDB, PostgreSQL and
 * T-SQL forms.
 *
 * @param dataCut - ISO 8601 date of the data cut, written into the queries
 *   that measure age at the cut. Usually the warehouse's `asOf`.
 * @param metrics - Metrics to include, usually `METRIC_REGISTRY`.
 * @returns The queries, with unique ids.
 * @throws RangeError when `dataCut` is not a date.
 */
export function workbenchQueries(
  dataCut: string,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): WorkbenchQuery[] {
  const parsed = new Date(`${dataCut}T00:00:00Z`);
  if (
    !ISO_DATE.test(dataCut) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dataCut
  ) {
    throw new RangeError(`${dataCut} is not an ISO 8601 date`);
  }
  return [
    ...examples(dataCut),
    ...metrics.map((metric) => metricQuery(metric, dataCut)),
  ];
}
