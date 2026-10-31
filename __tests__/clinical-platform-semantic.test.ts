// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_DIMENSIONS,
  METRIC_GAPS,
  METRIC_REGISTRY,
  buildWarehouse,
  checkMetricChange,
  checkMetricRegistry,
  checkRegulatoryWording,
  checkReportMetrics,
  describeMetricFormula,
  evaluateMetric,
  findClinicalClaims,
  generatePortfolio,
  metricRelease,
  toMetricFlowYaml,
  toSql,
  toTmdl,
  type MetricDefinition,
  type MetricMeasure,
  type MetricRelease,
  type Warehouse,
  type WarehouseRow,
} from "@/lib/clinical-platform";
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";
import {
  METRIC_LOCK_FILE,
  METRIC_METRICFLOW_GOLDEN,
  METRIC_REFERENCE_PAGE,
  METRIC_SQL_GOLDENS,
  METRIC_TMDL_GOLDEN,
  metricArtifacts,
  nextReleases,
  type MetricLockFile,
} from "../scripts/generate-metric-artifacts";

const root = path.resolve(__dirname, "..");
const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dataCut = warehouse.asOf;

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`no metric ${id}`);
  return found;
}

/** A metric with some fields replaced, for negative tests. */
function variant(
  id: string,
  changes: Partial<MetricDefinition>
): MetricDefinition {
  return { ...metric(id), ...changes };
}

const total = (m: MetricDefinition, w: Warehouse = warehouse) =>
  evaluateMetric(w, m).rows[0]?.value;

/**
 * Every metric's value on the default portfolio (seed 301, data cut
 * 2026-09-30). A change to the portfolio, the gold build or a definition
 * that moves a value fails here; update the value deliberately and say why.
 * Study grain metrics have one value per study that reached both milestones.
 */
const GOLDEN_VALUES: Readonly<Record<string, number | Record<string, number>>> =
  {
    subjects_screened: 1808,
    subjects_enrolled: 1228,
    enrollment_vs_plan: 0.788189987163,
    screen_failure_rate: 0.313966480447,
    screen_failures: 562,
    early_termination_rate: 0.0830618892508,
    site_activation_cycle_time: 154,
    // #2880: every site has activated by the data cut; two have not yet
    // enrolled a subject.
    sites_selected: 120,
    sites_contracted: 120,
    sites_irb_approved: 120,
    sites_initiated: 120,
    sites_activated: 120,
    sites_with_first_subject_in: 118,
    selection_to_contract_days: 38,
    contract_to_irb_approval_days: 26,
    irb_approval_to_initiation_days: 20,
    initiation_to_activation_days: 3.5,
    activation_to_first_subject_in_days: 48,
    data_entry_lag_median: 2,
    data_entry_lag_p90: 9,
    data_entry_lag_mean: 3.4852393617,
    missed_visit_rate: 0.0194124498512,
    out_of_window_visit_rate: 0.0314108486208,
    query_rate_per_100_visits: 47.2218556157,
    open_query_count: 36,
    query_aging_mean: 2.91666666667,
    query_resolution_time_median: 5,
    // The age bands (#2759) add up to the open queries: no unresolved query
    // on the seed is older than 30 days at the data cut.
    open_queries_aged_0_7_days: 33,
    open_queries_aged_8_30_days: 3,
    open_queries_aged_31_60_days: 0,
    open_queries_aged_over_60_days: 0,
    sdv_completion: 0.854189433022,
    monitoring_reports_overdue: 2,
    monitoring_visits_overdue: 5,
    monitoring_report_cycle_time_median: 14,
    important_deviation_rate: 13.9250814332,
    non_important_deviation_rate: 13.1107491857,
    subjects_with_important_deviation: 0.130293159609,
    // Every deviation (#2759): the 171 important and 161 not important that
    // the two deviation rates count per 100 enrolled subjects.
    protocol_deviation_count: 332,
    // #2881: only DEV-402 sends events to a committee; 28 of its 39 had
    // been adjudicated by the data cut, and 11 still wait.
    cec_events_reported: 39,
    cec_events_adjudicated: 28,
    cec_adjudication_backlog: 11,
    cec_adjudication_time_median: 27.5,
    // Study start-up (#2911): every study has reached both milestones.
    protocol_final_to_fpi_days: {
      "DEMO-101": 90,
      "DEMO-201": 90,
      "DEMO-202": 132,
      "DEMO-203": 147,
      "DEMO-301": 93,
      "DEMO-302": 185,
      "DEV-401": 114,
      "DEV-402": 86,
    },
    fpi_to_lpi_days: {
      "DEMO-101": 128,
      "DEMO-201": 457,
      "DEMO-202": 527,
      "DEMO-203": 442,
      "DEMO-301": 176,
      "DEV-401": 201,
    },
    lplv_to_dbl_days: { "DEMO-101": 75, "DEMO-301": 46, "DEV-401": 43 },
    budget_burn_vs_plan: 1.03733677578,
    cost_per_enrolled_subject: 37871.6620521,
    // #2912: forecast at completion. Only DEMO-302 is forecast to overrun:
    // its CRO, the over-budget vendor the generator plants, runs about 30%
    // over budget and is forecast to stay there for the quarters to come.
    actual_spend: 46506401,
    budget_at_completion: {
      "DEMO-101": 1225000,
      "DEMO-201": 8900000,
      "DEMO-202": 4152500,
      "DEMO-203": 8880000,
      "DEMO-301": 2205000,
      "DEMO-302": 29960000,
      "DEV-401": 2103750,
      "DEV-402": 9695000,
    },
    forecast_at_completion: {
      // DEMO-101 has issued its final report: nothing remains to forecast.
      "DEMO-101": 1142433,
      "DEMO-201": 8245247,
      "DEMO-202": 4013154,
      "DEMO-203": 8569157,
      "DEMO-301": 2122720,
      "DEMO-302": 34588681,
      "DEV-401": 1912580,
      "DEV-402": 9383684,
    },
    variance_at_completion: {
      "DEMO-101": -82567,
      "DEMO-201": -654753,
      "DEMO-202": -139346,
      "DEMO-203": -310843,
      "DEMO-301": -82280,
      "DEMO-302": 4628681,
      "DEV-401": -191170,
      "DEV-402": -311316,
    },
    forecast_vs_budget_at_completion: 1.04255591188,
  };

describe("the metric registry", () => {
  it("defines 53 metrics that pass every governance check", () => {
    expect(METRIC_REGISTRY).toHaveLength(53);
    expect(checkMetricRegistry()).toEqual([]);
  });

  it("covers the metrics #2624 asks for, or lists why it cannot", () => {
    const asked = [
      "enrollment_vs_plan",
      "screen_failure_rate",
      "site_activation_cycle_time",
      "data_entry_lag_median",
      "data_entry_lag_p90",
      "query_rate_per_100_visits",
      "query_aging_mean",
      "open_query_count",
      "important_deviation_rate",
      "non_important_deviation_rate",
      "sdv_completion",
      "monitoring_reports_overdue",
      // The monitoring plan (#2736) made this computable.
      "monitoring_visits_overdue",
      "fpi_to_lpi_days",
      "lplv_to_dbl_days",
      "budget_burn_vs_plan",
      "cost_per_enrolled_subject",
      // Key risk indicators and a quality tolerance limit parameter for #2631.
      "data_entry_lag_mean",
      "early_termination_rate",
      "missed_visit_rate",
      "subjects_with_important_deviation",
    ];
    const ids = METRIC_REGISTRY.map((m) => m.id);
    for (const id of asked) expect(ids).toContain(id);
    expect(METRIC_GAPS.map((g) => g.name)).toEqual([
      "eTMF completeness",
      "Cost per randomised subject",
      "Query rate per 100 CRF pages",
      "Enrollment against a time-phased plan",
      "Adverse event reporting rate (key risk indicator)",
      "Primary endpoint missing data (quality tolerance limit)",
    ]);
    for (const gap of METRIC_GAPS) {
      if (gap.nearestMetricId !== null)
        expect(ids).toContain(gap.nearestMetricId);
    }
  });

  it("links every metric to a glossary term that exists", () => {
    const keys = new Set(CANONICAL_GLOSSARY.map((t) => t.key));
    for (const m of METRIC_REGISTRY) {
      expect(m.glossaryTerm, m.id).not.toBeNull();
      expect(keys.has(m.glossaryTerm ?? ""), m.id).toBe(true);
    }
  });

  it("describes every formula in words", () => {
    expect(describeMetricFormula(metric("query_rate_per_100_visits"))).toBe(
      "(count of gold.fct_query rows) / (count of gold.fct_visit rows where visit_date_key is not null), times 100"
    );
    for (const m of METRIC_REGISTRY) {
      expect(describeMetricFormula(m)).toMatch(/gold\.(fct|dim)_/);
    }
  });
});

describe("golden values on the default seed", () => {
  it.each(METRIC_REGISTRY.map((m) => [m.id, m] as const))("%s", (id, m) => {
    const golden = GOLDEN_VALUES[id];
    if (typeof golden === "number") {
      // Goldens carry 12 significant figures, so compare relatively.
      const value = total(m);
      expect(value).not.toBeNull();
      expect(Math.abs((value ?? Number.NaN) - golden)).toBeLessThanOrEqual(
        1e-11 * Math.max(1, Math.abs(golden))
      );
      return;
    }
    const rows = evaluateMetric(warehouse, m, { dimensions: ["study"] }).rows;
    expect(
      Object.fromEntries(rows.map((r) => [r.dimensions.study, r.value]))
    ).toEqual(golden);
  });

  it("has a golden value for every metric and no other", () => {
    expect(Object.keys(GOLDEN_VALUES).sort()).toEqual(
      METRIC_REGISTRY.map((m) => m.id).sort()
    );
  });

  it("keeps the activation cycle time anchored on protocol finalisation", () => {
    // site_activation_cycle_time counts from the first version's valid_from,
    // which the gold build opens on dim_study.start_on, the date the
    // protocol was finalised. If the two ever diverge, the metric must read
    // start_on directly and take a major version.
    const start = new Map(
      warehouse.tables["gold.dim_study"].map((s) => [s.study_id, s.start_on])
    );
    const first = warehouse.tables["gold.dim_site"].filter(
      (s) => s.version_number === 1
    );
    expect(first.length).toBeGreaterThan(0);
    for (const site of first) {
      expect(site.valid_from, String(site.site_id)).toBe(
        start.get(site.study_id)
      );
    }
  });

  it("matches the gold KRI snapshots at each site's last snapshot", () => {
    // A third, independent path: fct_kri_snapshot is computed by the gold
    // build from silver rows, not from the facts the registry reads.
    const kris: [string, string, number][] = [
      ["query-rate", "query_rate_per_100_visits", 100],
      ["missed-visit-rate", "missed_visit_rate", 1],
      ["important-deviation-rate", "important_deviation_rate", 100],
      ["entry-lag-days", "data_entry_lag_mean", 1],
    ];
    const siteOf = new Map(
      warehouse.tables["gold.dim_site"].map((s) => [s.site_key, s.site_id])
    );
    for (const [kri, id, scale] of kris) {
      const latest = new Map<unknown, WarehouseRow>();
      for (const row of warehouse.tables["gold.fct_kri_snapshot"]) {
        if (row.kri_id !== kri) continue;
        const site = siteOf.get(row.site_key);
        const known = latest.get(site);
        if (
          !known ||
          Number(row.snapshot_date_key) > Number(known.snapshot_date_key)
        ) {
          latest.set(site, row);
        }
      }
      const values = new Map(
        evaluateMetric(warehouse, metric(id), {
          dimensions: ["site"],
        }).rows.map((r) => [r.dimensions.site, r.value])
      );
      expect(latest.size, kri).toBe(120);
      for (const [site, row] of latest) {
        const value = values.get(String(site)) ?? null;
        if (row.kri_value === null) {
          expect(value, `${kri} ${String(site)}`).toBeNull();
        } else {
          expect(value, `${kri} ${String(site)}`).not.toBeNull();
          expect(
            Math.abs(Number(value) / scale - Number(row.kri_value)),
            `${kri} ${String(site)}`
          ).toBeLessThanOrEqual(0.00005 + 1e-12);
        }
      }
    }
  });

  it("adds counts and sums up across every allowed dimension", () => {
    const additive = METRIC_REGISTRY.filter(
      (m) =>
        m.formula.kind === "simple" &&
        ["count", "sum"].includes(m.formula.measure.aggregation)
    );
    expect(additive.length).toBeGreaterThan(2);
    for (const m of additive) {
      for (const dimension of m.allowedDimensions) {
        const rows = evaluateMetric(warehouse, m, {
          dimensions: [dimension],
        }).rows;
        const sum = rows.reduce((acc, r) => acc + Number(r.value), 0);
        expect(sum, `${m.id} by ${dimension}`).toBe(total(m));
      }
    }
  });

  it("sums a count over any set of studies to the count filtered to them", () => {
    const m = metric("subjects_enrolled");
    const byStudy = new Map(
      evaluateMetric(warehouse, m, { dimensions: ["study"] }).rows.map((r) => [
        String(r.dimensions.study),
        Number(r.value),
      ])
    );
    fc.assert(
      fc.property(
        fc.subarray([...byStudy.keys()], { minLength: 1 }),
        (studies) => {
          const filtered = evaluateMetric(warehouse, m, {
            filters: [{ dimension: "study", operator: "in", values: studies }],
          }).rows[0].value;
          const excluded = evaluateMetric(warehouse, m, {
            filters: [
              { dimension: "study", operator: "not-in", values: studies },
            ],
          }).rows[0].value;
          const expected = studies.reduce(
            (acc, s) => acc + (byStudy.get(s) ?? 0),
            0
          );
          return (
            filtered === expected &&
            Number(filtered) + Number(excluded) === total(m)
          );
        }
      ),
      { numRuns: 40 }
    );
  });
});

describe("the evaluator at its boundaries", () => {
  const withTables = (
    tables: Record<string, readonly WarehouseRow[]>
  ): Warehouse => ({
    ...warehouse,
    tables: { ...warehouse.tables, ...tables },
  });
  const empty = withTables(
    Object.fromEntries(Object.keys(warehouse.tables).map((t) => [t, []]))
  );

  it("gives 0 for counts and no value for means, medians and ratios over no rows", () => {
    for (const m of METRIC_REGISTRY) {
      if (m.grain === "study") {
        expect(
          evaluateMetric(empty, m, { dimensions: ["study"] }).rows
        ).toEqual([]);
        continue;
      }
      const rows = evaluateMetric(empty, m).rows;
      expect(rows, m.id).toHaveLength(1);
      const additive =
        m.formula.kind === "simple" &&
        ["count", "count-distinct", "sum"].includes(
          m.formula.measure.aggregation
        );
      expect(rows[0].value, m.id).toBe(additive ? 0 : null);
      for (const dialect of ["duckdb", "postgres", "tsql"] as const) {
        expect(toSql(m, [], [], dialect, { dataCut })).toMatch(
          /^-- .+\n-- .+\n/
        );
      }
    }
  });

  it("interpolates percentiles between ranked values, as percentile_cont does", () => {
    const visits = (lags: number[]) =>
      withTables({
        "gold.fct_visit": lags.map((lag) => ({
          entry_lag_days: lag,
          visit_date_key: 20260105,
        })),
      });
    const five = visits([10, 1, 4, 2, 3]);
    expect(total(metric("data_entry_lag_median"), five)).toBe(3);
    expect(total(metric("data_entry_lag_p90"), five)).toBeCloseTo(7.6, 12);
    expect(total(metric("data_entry_lag_mean"), five)).toBe(4);
    const four = visits([1, 2, 3, 4]);
    expect(total(metric("data_entry_lag_median"), four)).toBe(2.5);
    expect(total(metric("data_entry_lag_p90"), four)).toBeCloseTo(3.7, 12);
    const one = visits([6]);
    expect(total(metric("data_entry_lag_p90"), one)).toBe(6);
  });

  it("gives no value for a zero denominator and skips rows with a null operand", () => {
    const m = metric("sdv_completion");
    const visits = (due: number[]) =>
      withTables({
        "gold.fct_monitoring_visit": due.map((d) => ({
          sdv_pages_due: d,
          sdv_pages_verified: 0,
          visit_date_key: 20260105,
        })),
      });
    expect(total(m, visits([0, 0]))).toBeNull();
    expect(total(m, visits([4, 0]))).toBe(0);
    const overdue = metric("monitoring_reports_overdue");
    // Due on the data cut is not yet overdue; due the day before is.
    const reports = withTables({
      "gold.fct_monitoring_visit": [
        {
          visit_date_key: 20260901,
          report_final_date_key: null,
          report_due_date_key: 20260929,
        },
        {
          visit_date_key: 20260910,
          report_final_date_key: null,
          report_due_date_key: 20260930,
        },
        {
          visit_date_key: 20260901,
          report_final_date_key: 20260905,
          report_due_date_key: 20260915,
        },
      ],
      "gold.dim_study": [],
    });
    // Default filter on study status: with no study rows every row drops out.
    expect(total(overdue, reports)).toBe(0);
    const unfiltered = evaluateMetric(reports, overdue, {
      filters: [
        { dimension: "study_status", operator: "not-in", values: ["none"] },
      ],
    });
    expect(unfiltered.rows[0].value).toBe(0);
    expect(
      evaluateMetric(
        withTables({
          ...reports.tables,
          "gold.dim_study": [{ study_key: 1, study_status: "enrolling" }],
          "gold.fct_monitoring_visit": reports.tables[
            "gold.fct_monitoring_visit"
          ].map((r) => ({ ...r, study_key: 1 })),
        }),
        overdue
      ).rows[0].value
    ).toBe(1);
  });

  it("rejects queries the metric does not allow", () => {
    const rate = metric("early_termination_rate");
    expect(() =>
      evaluateMetric(warehouse, rate, { dimensions: ["month"] })
    ).toThrow(/cannot be grouped by month/);
    expect(() =>
      evaluateMetric(warehouse, rate, { dimensions: ["study", "study"] })
    ).toThrow(/grouped twice/);
    expect(() =>
      evaluateMetric(warehouse, rate, {
        filters: [{ dimension: "vendor", operator: "in", values: ["x"] }],
      })
    ).toThrow(/cannot be filtered by vendor/);
    expect(() =>
      evaluateMetric(warehouse, rate, {
        filters: [{ dimension: "study", operator: "in", values: [] }],
      })
    ).toThrow(/lists no values/);
    expect(() => evaluateMetric(warehouse, metric("fpi_to_lpi_days"))).toThrow(
      /group it by study/
    );
    expect(() => toSql(metric("query_aging_mean"), [], [], "duckdb")).toThrow(
      /data cut/
    );
    expect(() =>
      toSql(metric("query_aging_mean"), [], [], "duckdb", {
        dataCut: "2026-02-30",
      })
    ).toThrow(/data cut/);
    expect(() => toTmdl(METRIC_REGISTRY)).toThrow(/data cut/);
    expect(() => toMetricFlowYaml(METRIC_REGISTRY)).toThrow(/data cut/);
  });

  it("lets a query's filter replace the default filter on the same dimension", () => {
    const open = metric("open_query_count");
    const byDefault = evaluateMetric(warehouse, open, {
      dimensions: ["study_status"],
    });
    expect(byDefault.filters).toEqual(open.defaultFilters);
    expect(byDefault.rows.map((r) => r.dimensions.study_status)).not.toContain(
      "closed"
    );
    const replaced = evaluateMetric(warehouse, open, {
      dimensions: ["study_status"],
      filters: [
        { dimension: "study_status", operator: "in", values: ["closed"] },
      ],
    });
    expect(replaced.filters).toHaveLength(1);
    expect(
      replaced.rows.every((r) => r.dimensions.study_status === "closed")
    ).toBe(true);
  });
});

describe("registry governance checks", () => {
  const messages = (m: MetricDefinition) =>
    checkMetricRegistry([m]).map((f) => f.message);
  const simple = (id: string): MetricMeasure => {
    const formula = metric(id).formula;
    if (formula.kind !== "simple") throw new Error(`${id} is not simple`);
    return formula.measure;
  };

  it("rejects a definition the gold model cannot compute or compile safely", () => {
    const lag = simple("data_entry_lag_median");
    expect(
      messages(
        variant("data_entry_lag_median", {
          formula: { kind: "simple", measure: { ...lag, where: [] } },
        })
      )
    ).toEqual([
      "value: reads nullable entry_lag_days without a not-null condition",
      "value: reads nullable visit_date_key without a not-null condition",
    ]);
    expect(
      messages(
        variant("data_entry_lag_median", {
          formula: {
            kind: "simple",
            measure: { ...lag, table: "silver.edc_visit" },
          },
        })
      )
    ).toContain("value: reads silver.edc_visit, which is not a gold table");
    expect(
      messages(
        variant("data_entry_lag_median", {
          formula: {
            kind: "simple",
            measure: {
              ...lag,
              expression: { kind: "column", column: "entry_lag" },
            },
          },
        })
      )
    ).toContain("value: gold.fct_visit has no column entry_lag");
    expect(
      messages(
        variant("data_entry_lag_median", {
          formula: {
            kind: "simple",
            measure: {
              ...lag,
              expression: { kind: "column", column: "visit_status" },
            },
          },
        })
      )
    ).toContain("value: median needs a number");
    expect(
      messages(
        variant("subjects_enrolled", {
          allowedDimensions: ["study", "vendor"],
        })
      )
    ).toContain("value on gold.fct_enrollment cannot reach vendor");
  });

  it("rejects bad versions, change logs, glossary links and wording", () => {
    const base = metric("screen_failure_rate");
    expect(messages({ ...base, version: "1.0" })).toContain(
      "version 1.0 is not x.y.z"
    );
    expect(messages({ ...base, version: "1.1.0" })).toContain(
      "the change log does not end at version 1.1.0"
    );
    expect(messages({ ...base, glossaryTerm: "no-such-term" })).toContain(
      "glossary term no-such-term is not in CANONICAL_GLOSSARY"
    );
    expect(messages({ ...base, glossaryTerm: null })).toContain(
      "a certified metric links no glossary term"
    );
    expect(
      messages({ ...base, status: "draft", glossaryTerm: null })
    ).not.toContain("a certified metric links no glossary term");
    expect(
      messages({
        ...base,
        description: "A validated, 21 CFR Part 11 compliant rate.",
      }).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      messages({
        ...base,
        defaultFilters: [
          { dimension: "vendor", operator: "in", values: ["x"] },
        ],
      })
    ).toContain("default filter on vendor, which is not allowed");
    expect(
      messages({ ...metric("fpi_to_lpi_days"), grain: "portfolio" })
    ).toContain(
      "a milestone span is defined per study; its grain must be study"
    );
    expect(
      checkMetricRegistry([base, { ...base, id: "copy" }]).map((f) => f.message)
    ).toEqual(["name Screen failure rate is used twice"]);
  });
});

describe("breaking-change detection", () => {
  const certified = metricRelease(metric("screen_failure_rate"));
  const changedFormula = (version: string): MetricRelease => {
    const m = metric("screen_failure_rate");
    if (m.formula.kind !== "ratio") throw new Error("expected a ratio");
    return metricRelease({
      ...m,
      version,
      formula: {
        ...m.formula,
        denominator: {
          ...m.formula.denominator,
          where: m.formula.denominator.where.slice(0, 1),
        },
      },
    });
  };

  it("fails a changed certified formula without a major version bump", () => {
    expect(
      checkMetricChange(certified, changedFormula("1.0.0")).map(
        (f) => f.message
      )
    ).toEqual(["version 1.0.0 changed without a new version number"]);
    expect(
      checkMetricChange(certified, changedFormula("1.1.0")).map(
        (f) => f.message
      )
    ).toEqual([
      "changes what certified screen_failure_rate computes without a major version bump (1.0.0 to 1.1.0)",
    ]);
    expect(checkMetricChange(certified, changedFormula("2.0.0"))).toEqual([]);
  });

  it("treats a changed unit, filter or removed dimension as breaking too", () => {
    const at = (
      version: string,
      contract: Partial<MetricRelease["contract"]>
    ) => ({
      ...certified,
      version,
      contract: { ...certified.contract, ...contract },
    });
    for (const change of [
      { unit: "percent of screened subjects" },
      {
        defaultFilters: [
          {
            dimension: "study_status" as const,
            operator: "in" as const,
            values: ["enrolling"],
          },
        ],
      },
      { allowedDimensions: certified.contract.allowedDimensions.slice(1) },
      { grain: "study" as const },
    ]) {
      expect(checkMetricChange(certified, at("1.1.0", change))).toHaveLength(1);
      expect(checkMetricChange(certified, at("2.0.0", change))).toEqual([]);
    }
  });

  it("lets a draft change with a minor bump and needs a minor bump for additions", () => {
    const draft = { ...certified, status: "draft" as const };
    expect(
      checkMetricChange(draft, { ...changedFormula("1.1.0"), status: "draft" })
    ).toEqual([]);
    const fewer = {
      ...certified,
      contract: {
        ...certified.contract,
        allowedDimensions: ["study" as const],
      },
    };
    expect(
      checkMetricChange(fewer, { ...certified, version: "1.0.1" }).map(
        (f) => f.message
      )
    ).toEqual(["an added dimension needs at least a minor version bump"]);
    expect(
      checkMetricChange(fewer, { ...certified, version: "1.1.0" })
    ).toEqual([]);
    const deprecated = {
      ...certified,
      version: "1.0.1",
      status: "deprecated" as const,
    };
    expect(
      checkMetricChange(certified, deprecated).map((f) => f.message)
    ).toEqual(["a status change needs at least a minor version bump"]);
    expect(
      checkMetricChange(
        { ...deprecated, version: "1.1.0" },
        { ...certified, version: "1.2.0" }
      ).map((f) => f.message)
    ).toContain(
      "a deprecated metric does not return to use; define a new metric"
    );
    expect(
      checkMetricChange(certified, { ...certified, version: "0.9.0" }).map(
        (f) => f.message
      )
    ).toEqual(["version 0.9.0 is lower than 1.0.0"]);
  });

  it("keeps the lock file in step with the registry and its history versioned", () => {
    const lock = JSON.parse(
      readFileSync(path.join(root, METRIC_LOCK_FILE), "utf8")
    ) as MetricLockFile;
    expect(nextReleases(lock.releases)).toEqual(lock.releases);
    for (const m of METRIC_REGISTRY) {
      expect(
        lock.releases.some((r) => r.id === m.id && r.version === m.version),
        m.id
      ).toBe(true);
    }
    const ids = [...new Set(lock.releases.map((r) => r.id))];
    for (const id of ids) {
      const history = lock.releases.filter((r) => r.id === id);
      for (let i = 1; i < history.length; i += 1) {
        expect(checkMetricChange(history[i - 1], history[i]), id).toEqual([]);
      }
    }
  });

  it("refuses to record a certified formula change without a major bump", () => {
    const lock = JSON.parse(
      readFileSync(path.join(root, METRIC_LOCK_FILE), "utf8")
    ) as MetricLockFile;
    const m = metric("screen_failure_rate");
    const ratio = m.formula;
    if (ratio.kind !== "ratio") throw new Error("expected a ratio");
    const edited = (version: string): MetricDefinition => ({
      ...m,
      version,
      formula: { ...ratio, scale: 100 },
      changeLog: [
        ...m.changeLog,
        { version, date: "2026-10-25", summary: "Per 100." },
      ],
    });
    const registry = (next: MetricDefinition) =>
      METRIC_REGISTRY.map((x) => (x.id === m.id ? next : x));
    expect(() =>
      nextReleases(lock.releases, registry(edited("1.0.0")))
    ).toThrow(/screen_failure_rate 1\.0\.0 changed after it was released/);
    expect(() =>
      nextReleases(lock.releases, registry(edited("1.1.0")))
    ).toThrow(/without a major version bump/);
    const bumped = nextReleases(lock.releases, registry(edited("2.0.0")));
    expect(bumped.filter((r) => r.id === m.id).map((r) => r.version)).toEqual([
      "1.0.0",
      "2.0.0",
    ]);
  });
});

describe("certified reports", () => {
  const ids = ["subjects_enrolled", "screen_failure_rate"];

  it("may use certified metrics only", () => {
    expect(
      checkReportMetrics({
        id: "ops",
        title: "Operations",
        certified: true,
        metricIds: ids,
      })
    ).toEqual([]);
    const registry = METRIC_REGISTRY.map((m) =>
      m.id === "screen_failure_rate"
        ? { ...m, status: "deprecated" as const }
        : m
    );
    expect(
      checkReportMetrics(
        { id: "ops", title: "Operations", certified: true, metricIds: ids },
        registry
      )
    ).toEqual([
      {
        rule: "report",
        metricId: "screen_failure_rate",
        message:
          "certified report ops cannot use deprecated metric screen_failure_rate",
      },
    ]);
    const withDraft = METRIC_REGISTRY.map((m) =>
      m.id === "monitoring_reports_overdue"
        ? { ...m, status: "draft" as const }
        : m
    );
    expect(
      checkReportMetrics(
        {
          id: "ops",
          title: "Operations",
          certified: true,
          metricIds: ["monitoring_reports_overdue"],
        },
        withDraft
      ).map((f) => f.message)
    ).toEqual([
      "certified report ops cannot use draft metric monitoring_reports_overdue",
    ]);
    // Every metric in the registry itself is certified (#2736).
    expect(METRIC_REGISTRY.filter((m) => m.status !== "certified")).toEqual([]);
  });

  it("lets an uncertified report use any registry metric, and no report an unknown one", () => {
    expect(
      checkReportMetrics({
        id: "explore",
        title: "Exploration",
        certified: false,
        metricIds: ["monitoring_reports_overdue"],
      })
    ).toEqual([]);
    expect(
      checkReportMetrics({
        id: "explore",
        title: "Exploration",
        certified: false,
        metricIds: ["etmf_completeness"],
      }).map((f) => f.message)
    ).toEqual(["explore uses etmf_completeness, which is not in the registry"]);
  });
});

describe("compiled artifacts", () => {
  const artifacts = metricArtifacts();

  it("keeps the checked-in goldens and catalog page in step with the registry", () => {
    expect(Object.keys(artifacts).sort()).toEqual(
      [
        ...Object.values(METRIC_SQL_GOLDENS),
        METRIC_METRICFLOW_GOLDEN,
        METRIC_TMDL_GOLDEN,
        METRIC_REFERENCE_PAGE,
      ].sort()
    );
    for (const [file, contents] of Object.entries(artifacts)) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toBe(contents);
    }
  });

  it("writes every metric into every target", () => {
    const yaml = artifacts[METRIC_METRICFLOW_GOLDEN];
    const tmdl = artifacts[METRIC_TMDL_GOLDEN];
    for (const m of METRIC_REGISTRY) {
      expect(yaml).toContain(`\n  - name: ${m.id}\n`);
      expect(tmdl).toContain(`\tmeasure '${m.name.replaceAll("'", "''")}' =\n`);
      expect(tmdl).toContain(`\t\tannotation MetricId = ${m.id}\n`);
      expect(tmdl).toContain(`\t\tdisplayFolder: ${m.displayFolder}\n`);
      for (const file of Object.values(METRIC_SQL_GOLDENS)) {
        expect(artifacts[file]).toContain(
          `: ${m.id} ${m.version} (${m.status}),`
        );
      }
    }
  });

  it("uses each dialect's own syntax where the dialects differ", () => {
    const p90 = metric("data_entry_lag_p90");
    const tsql = toSql(p90, ["study"], [], "tsql");
    expect(tsql).toMatch(/SELECT DISTINCT/);
    expect(tsql).toContain("OVER (PARTITION BY [dim_study].[study_id])");
    expect(toSql(p90, [], [], "tsql")).toContain("OVER ()");
    expect(toSql(p90, ["study"], [], "postgres")).toContain(
      'PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY CAST("f"."entry_lag_days" AS DOUBLE PRECISION))'
    );
    const aging = metric("query_aging_mean");
    expect(toSql(aging, [], [], "postgres", { dataCut })).toContain(
      "(DATE '2026-09-30' - TO_DATE(CAST(\"f\".\"opened_date_key\" AS TEXT), 'YYYYMMDD'))"
    );
    expect(toSql(aging, [], [], "tsql", { dataCut })).toContain(
      "DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE))"
    );
    expect(toSql(metric("enrollment_vs_plan"), [], [], "tsql")).toContain(
      "[f].[is_current] = 1"
    );
  });

  it("makes no compliance or validation claim in any generated text", () => {
    const texts = [
      ...Object.values(artifacts),
      ...METRIC_REGISTRY.flatMap((m) => [
        m.name,
        m.description,
        describeMetricFormula(m),
      ]),
      ...METRIC_GAPS.flatMap((g) => [g.name, g.reason, g.missing]),
      ...METRIC_DIMENSIONS.map((d) => d.description),
    ];
    for (const text of texts) {
      expect(findClinicalClaims(text)).toEqual([]);
      expect(checkRegulatoryWording(text)).toEqual([]);
    }
  });
});
