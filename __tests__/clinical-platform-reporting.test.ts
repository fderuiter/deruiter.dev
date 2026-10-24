// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  NO_METRIC_ROWS,
  NO_METRIC_VALUE,
  REPORT_PACK,
  buildReport,
  buildWarehouse,
  checkRegulatoryWording,
  checkReportSpec,
  evaluateMetric,
  findClinicalClaims,
  formatMetricValue,
  generatePortfolio,
  reportCatalog,
  reportTelemetrySlug,
  searchReportCatalog,
  toSql,
  type MetricDefinition,
  type ReportFinding,
  type ReportSpec,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);

function pack(id: string): ReportSpec {
  const found = REPORT_PACK.find((spec) => spec.id === id);
  if (found === undefined) throw new Error(`no report ${id}`);
  return found;
}

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`no metric ${id}`);
  return found;
}

/** A certified bar report on one metric, for negative tests. */
const CERTIFIED: ReportSpec = {
  ...pack("study-status"),
  id: "test-certified",
  metrics: ["subjects_enrolled"],
};

function messages(findings: readonly ReportFinding[]): string[] {
  return findings.map((finding) => `${finding.rule}: ${finding.message}`);
}

describe("standard report pack", () => {
  it("holds four valid reports across all three tiers", () => {
    expect(REPORT_PACK.map((spec) => spec.id)).toEqual([
      "study-status",
      "site-performance",
      "data-management-metrics",
      "monthly-portfolio-review",
    ]);
    for (const spec of REPORT_PACK) {
      expect(messages(checkReportSpec(spec)), spec.id).toEqual([]);
    }
    expect(new Set(REPORT_PACK.map((spec) => spec.tier))).toEqual(
      new Set(["certified", "managed", "exploratory"])
    );
  });

  it("makes no clinical or compliance claims in its copy", () => {
    for (const spec of REPORT_PACK) {
      const copy = [spec.title, spec.audience, spec.purpose].join(" ");
      expect(findClinicalClaims(copy), spec.id).toEqual([]);
      expect(checkRegulatoryWording(copy), spec.id).toEqual([]);
    }
  });
});

describe("checkReportSpec", () => {
  // The registry certifies every metric it holds (#2736 certified the last
  // draft), so the draft rules are checked against a registry with one.
  const WITH_DRAFT = METRIC_REGISTRY.map((m) =>
    m.id === "monitoring_reports_overdue"
      ? { ...m, status: "draft" as const }
      : m
  );

  it("rejects a certified report that uses a draft (exploratory) metric", () => {
    expect(
      messages(
        checkReportSpec(
          {
            ...CERTIFIED,
            metrics: ["subjects_enrolled", "monitoring_reports_overdue"],
            visual: "table",
          },
          WITH_DRAFT
        )
      )
    ).toEqual([
      "metric: certified report test-certified cannot use draft metric monitoring_reports_overdue",
    ]);
  });

  it("rejects a deprecated metric in a report of any tier", () => {
    const registry = METRIC_REGISTRY.map((m) =>
      m.id === "subjects_enrolled" ? { ...m, status: "deprecated" as const } : m
    );
    expect(messages(checkReportSpec(CERTIFIED, registry))).toEqual([
      "metric: certified report test-certified cannot use deprecated metric subjects_enrolled",
    ]);
    for (const tier of ["managed", "exploratory"] as const) {
      expect(
        messages(
          checkReportSpec({ ...CERTIFIED, tier, signOff: null }, registry)
        )
      ).toEqual([
        "metric: test-certified cannot use deprecated metric subjects_enrolled",
      ]);
    }
  });

  it("lets managed and exploratory reports use draft metrics", () => {
    for (const tier of ["managed", "exploratory"] as const) {
      expect(
        checkReportSpec(
          {
            ...CERTIFIED,
            tier,
            signOff: null,
            metrics: ["monitoring_reports_overdue"],
          },
          WITH_DRAFT
        )
      ).toEqual([]);
    }
  });

  it("rejects metrics outside the registry and groupings a metric does not allow", () => {
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          metrics: ["no_such_metric"],
        })
      )
    ).toEqual([
      "metric: test-certified uses no_such_metric, which is not in the registry",
    ]);
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          metrics: ["enrollment_vs_plan"],
          dimensions: ["month"],
          visual: "line",
        })
      )
    ).toEqual(["metric: enrollment_vs_plan cannot be grouped by month"]);
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          metrics: ["fpi_to_lpi_days"],
          dimensions: [],
          visual: "stat",
        })
      )
    ).toEqual([
      "metric: fpi_to_lpi_days is defined per study; group it by study to query it",
    ]);
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          filters: [{ dimension: "vendor", operator: "in", values: ["x"] }],
        })
      )
    ).toEqual(["metric: subjects_enrolled cannot be filtered by vendor"]);
  });

  it("rejects a visual that does not fit the grouping", () => {
    const visual = (spec: Partial<ReportSpec>): string[] =>
      messages(checkReportSpec({ ...CERTIFIED, ...spec }));
    expect(visual({ visual: "bar", dimensions: [] })).toEqual([
      "visual: a bar report groups by exactly one dimension",
    ]);
    expect(visual({ visual: "line", dimensions: ["study"] })).toEqual([
      "visual: a line report groups by the month dimension alone",
    ]);
    expect(visual({ visual: "stat", dimensions: ["study"] })).toEqual([
      "visual: a stat report groups by no dimensions",
    ]);
    expect(
      visual({ visual: "table", dimensions: ["study", "country", "month"] })
    ).toEqual(["visual: a table report groups by at most two dimensions"]);
  });

  it("keeps one value axis: a chart's metrics share a unit", () => {
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          metrics: ["subjects_enrolled", "screen_failure_rate"],
        })
      )
    ).toEqual([
      "visual: a bar report shares one value axis, but its metrics are in subjects, share of screened subjects; use a table or one report per unit",
    ]);
    expect(
      checkReportSpec({
        ...CERTIFIED,
        metrics: ["subjects_enrolled", "screen_failure_rate"],
        visual: "table",
      })
    ).toEqual([]);
  });

  it("needs the owner's sign-off on the current version of a certified report", () => {
    expect(messages(checkReportSpec({ ...CERTIFIED, signOff: null }))).toEqual([
      "tier: a certified report needs the owner's sign-off",
    ]);
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          version: "1.1.0",
          signOff: { role: " ", date: "2026-02-30", version: "1.0.0" },
        })
      )
    ).toEqual([
      "tier: the sign-off names no role",
      "tier: sign-off date 2026-02-30 is not an ISO 8601 date",
      "tier: the sign-off is for version 1.0.0, not 1.1.0",
    ]);
  });

  it("checks the spec's own fields", () => {
    expect(
      messages(
        checkReportSpec({
          ...CERTIFIED,
          id: "Study Status",
          title: " ",
          version: "1.0",
          refreshSlaHours: 0.5,
          metrics: ["subjects_enrolled", "subjects_enrolled"],
          dimensions: ["study", "study"],
          visual: "table",
          signOff: { ...CERTIFIED.signOff!, version: "1.0" },
        })
      )
    ).toEqual([
      'spec: id "Study Status" is not in kebab case',
      "spec: title is empty",
      "spec: version 1.0 is not a semantic version",
      "spec: the refresh SLA must be a whole number of hours, at least 1",
      "spec: it lists a metric twice",
      "spec: it groups by a dimension twice",
      "metric: subjects_enrolled: a dimension is grouped twice",
      "metric: subjects_enrolled: a dimension is grouped twice",
    ]);
    expect(messages(checkReportSpec({ ...CERTIFIED, metrics: [] }))).toEqual([
      "spec: it shows no metrics",
    ]);
  });
});

describe("buildReport", () => {
  it("shows exactly the registry's values for every report in the pack", () => {
    for (const spec of REPORT_PACK) {
      const report = buildReport(warehouse, spec);
      expect(report.dataCut).toBe(warehouse.asOf);
      expect(report.columns.map((column) => column.metricId)).toEqual(
        spec.metrics
      );
      expect(report.rows.length, spec.id).toBeGreaterThan(0);
      spec.metrics.forEach((id, column) => {
        const result = evaluateMetric(warehouse, metric(id), {
          dimensions: spec.dimensions,
          filters: spec.filters,
        });
        const byKey = new Map(
          result.rows.map((row) => [
            spec.dimensions.map((d) => row.dimensions[d]).join("\u001f"),
            row.value,
          ])
        );
        for (const row of report.rows) {
          const cell = row.cells[column];
          if (byKey.has(row.key)) {
            expect(cell.value, `${spec.id} ${id} ${row.key}`).toBe(
              byKey.get(row.key)
            );
            expect(cell.text).toBe(formatMetricValue(metric(id), cell.value));
          } else {
            expect(cell).toEqual({ value: null, text: NO_METRIC_ROWS });
          }
        }
        expect(report.rows.filter((row) => byKey.has(row.key)).length).toBe(
          result.rows.length
        );
      });
      report.calculations.forEach((calc, index) => {
        const m = metric(spec.metrics[index]);
        expect(calc.sql).toBe(
          toSql(m, spec.dimensions, spec.filters, "duckdb", {
            dataCut: warehouse.asOf,
          })
        );
        expect(calc.version).toBe(m.version);
      });
    }
  });

  it("sorts rows by their dimension values and labels the dimensions", () => {
    const report = buildReport(warehouse, pack("monthly-portfolio-review"));
    expect(report.dimensionLabels).toEqual(["Month"]);
    const months = report.rows.map((row) => row.labels[0]);
    expect(months).toEqual([...months].sort());
    expect(months[0]).toMatch(/^\d{4}-\d{2}$/);
  });

  it("marks a group a metric has no rows for, rather than showing zero", () => {
    const report = buildReport(warehouse, pack("data-management-metrics"));
    const open = report.columns.findIndex(
      (column) => column.metricId === "open_query_count"
    );
    const missing = report.rows.filter((row) => row.cells[open].value === null);
    expect(missing.length).toBeGreaterThan(0);
    for (const row of missing) {
      expect(row.cells[open].text).toBe(NO_METRIC_ROWS);
    }
  });

  it("gives charts one value axis that covers every value, and tables none", () => {
    for (const spec of REPORT_PACK) {
      const report = buildReport(warehouse, spec);
      if (spec.visual === "table") {
        expect(report.scale).toBeNull();
        continue;
      }
      const scale = report.scale!;
      const values = report.rows.flatMap((row) =>
        row.cells.flatMap((cell) => (cell.value === null ? [] : [cell.value]))
      );
      expect(scale.min).toBeLessThanOrEqual(Math.min(0, ...values));
      expect(scale.max).toBeGreaterThanOrEqual(Math.max(...values));
      expect(scale.ticks[0].value).toBe(scale.min);
      expect(scale.ticks.at(-1)!.value).toBe(scale.max);
      expect(scale.ticks.length).toBeGreaterThanOrEqual(3);
      expect(scale.ticks.length).toBeLessThanOrEqual(9);
    }
  });

  it("is deterministic and refuses a spec that breaks a rule", () => {
    const spec = pack("site-performance");
    expect(buildReport(warehouse, spec)).toEqual(buildReport(warehouse, spec));
    expect(() =>
      buildReport(warehouse, { ...CERTIFIED, signOff: null })
    ).toThrow(
      "report test-certified cannot be built: a certified report needs the owner's sign-off"
    );
  });
});

describe("formatMetricValue", () => {
  it("uses the metric's style and decimals", () => {
    expect(formatMetricValue(metric("screen_failure_rate"), 0.2345)).toBe(
      "23.5%"
    );
    expect(formatMetricValue(metric("subjects_enrolled"), 1234)).toBe("1,234");
    expect(formatMetricValue(metric("data_entry_lag_median"), 2)).toBe("2.0");
    expect(
      formatMetricValue(metric("cost_per_enrolled_subject"), 15250.4)
    ).toBe("$15,250");
    expect(formatMetricValue(metric("subjects_enrolled"), null)).toBe(
      NO_METRIC_VALUE
    );
    expect(formatMetricValue(metric("subjects_enrolled"), Number.NaN)).toBe(
      NO_METRIC_VALUE
    );
  });
});

describe("report catalog", () => {
  const entries = reportCatalog(REPORT_PACK, {
    lastRefresh: warehouse.asOf,
    usage: {
      [reportTelemetrySlug("study-status")]: { views: 12 },
      "some-other-project": { views: 99 },
    },
  });

  it("lists every report with its metadata and usage", () => {
    expect(entries.map((entry) => entry.id)).toEqual(
      REPORT_PACK.map((spec) => spec.id)
    );
    expect(entries[0]).toMatchObject({
      title: "Study status report",
      tier: "certified",
      audience: "Study leadership",
      owner: "Clinical Operations Lead",
      metricNames: ["Subjects screened", "Subjects enrolled"],
      lastRefresh: "2026-09-30",
      views: 12,
    });
    expect(entries[1].views).toBe(0);
    expect(reportCatalog(REPORT_PACK)[0]).toMatchObject({
      views: null,
      lastRefresh: null,
    });
    expect(reportTelemetrySlug("study-status")).toBe(
      "platform-report-study-status"
    );
  });

  it("searches words in any order, ignoring case, across text and metric names", () => {
    const ids = (query: Parameters<typeof searchReportCatalog>[1]) =>
      searchReportCatalog(entries, query).map((entry) => entry.id);
    expect(ids({})).toEqual(entries.map((entry) => entry.id));
    expect(ids({ text: "  " })).toEqual(entries.map((entry) => entry.id));
    expect(ids({ text: "QUERY site" })).toEqual(["site-performance"]);
    expect(ids({ text: "enrolled" })).toEqual([
      "study-status",
      "monthly-portfolio-review",
    ]);
    expect(ids({ text: "monitoring lead deviations" })).toEqual([
      "site-performance",
    ]);
    expect(ids({ text: "no such words" })).toEqual([]);
  });

  it("filters by tier and audience, and every criterion must match", () => {
    const ids = (query: Parameters<typeof searchReportCatalog>[1]) =>
      searchReportCatalog(entries, query).map((entry) => entry.id);
    expect(ids({ tiers: ["certified"] })).toEqual([
      "study-status",
      "monthly-portfolio-review",
    ]);
    expect(ids({ tiers: ["managed", "exploratory"] })).toEqual([
      "site-performance",
      "data-management-metrics",
    ]);
    expect(ids({ tiers: [] })).toHaveLength(4);
    expect(ids({ audience: "Data management" })).toEqual([
      "data-management-metrics",
    ]);
    expect(ids({ audience: "data management" })).toEqual([]);
    expect(
      ids({
        text: "enrolled",
        tiers: ["certified"],
        audience: "Portfolio leadership",
      })
    ).toEqual(["monthly-portfolio-review"]);
  });
});
