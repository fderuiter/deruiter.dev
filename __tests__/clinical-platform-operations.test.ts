import { describe, expect, it } from "vitest";
import {
  CSM_TESTS,
  DEFAULT_PORTFOLIO_SEED,
  KRI_LIBRARY,
  METRIC_GAPS,
  METRIC_REGISTRY,
  NO_METRIC_ROWS,
  QTL_LIBRARY,
  assessStudyRisk,
  buildWarehouse,
  checkReportSpec,
  dataContracts,
  dataProducts,
  evaluateMetric,
  formatMetricValue,
  generatePortfolio,
  operationsDashboard,
  operationsReportSpecs,
  type MetricDimensionId,
  type OperationsDashboard,
  type OperationsScope,
  type ReportData,
  type WarehouseRow,
} from "@/lib/clinical-platform";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const studies = warehouse.tables["gold.dim_study"];
const sites = warehouse.tables["gold.dim_site"].filter((s) => s.is_current);

/** Every study, every country of a study and every site, as scopes. */
const EVERY_SCOPE: readonly OperationsScope[] = [
  {},
  ...studies.map((s) => ({ study: String(s.study_id) })),
  ...[...new Set(sites.map((s) => `${s.study_id}|${s.country_code}`))].map(
    (key) => {
      const [study, country] = key.split("|");
      return { study, country };
    }
  ),
  ...sites.map((s) => ({
    study: String(s.study_id),
    country: String(s.country_code),
    site: String(s.site_id),
  })),
];

function report(dashboard: OperationsDashboard, id: string): ReportData {
  const found = [
    dashboard.glance,
    ...dashboard.sections.flatMap((s) => s.reports),
  ].find((r) => r.spec.id === id);
  if (found === undefined) throw new Error(`no report ${id}`);
  return found;
}

/** A panel's report at whatever level the dashboard is, whatever it groups by. */
function panel(dashboard: OperationsDashboard, id: string): ReportData {
  const found = dashboard.sections
    .flatMap((s) => s.reports)
    .find((r) => r.spec.id === id || r.spec.id.startsWith(`${id}-by-`));
  if (found === undefined) throw new Error(`no panel ${id}`);
  return found;
}

/**
 * Dashboards by scope. Several tests visit every scope, and each dashboard
 * takes a while to build, so each is built once for the whole file.
 */
const dashboards = new Map<string, OperationsDashboard>();
function dashboardAt(scope: OperationsScope): OperationsDashboard {
  const key = JSON.stringify(scope);
  const cached = dashboards.get(key);
  if (cached !== undefined) return cached;
  const built = operationsDashboard(warehouse, scope);
  dashboards.set(key, built);
  return built;
}

/** The glance's values by metric id. */
function glanceValues(dashboard: OperationsDashboard) {
  return Object.fromEntries(
    dashboard.glance.columns.map((column, index) => [
      column.metricId,
      dashboard.glance.rows[0]?.cells[index].value ?? null,
    ])
  );
}

/** One row of a report, by its first label, as values by metric id. */
function rowValues(data: ReportData, label: string) {
  const row = data.rows.find((r) => r.labels[0] === label);
  if (row === undefined) return null;
  return Object.fromEntries(
    data.columns.map((column, index) => [
      column.metricId,
      row.cells[index].value,
    ])
  );
}

/** The reports whose empty cells read zero, by panel id (#2759, #2880, #2881). */
const ZERO_FILLED = [
  "query-age-bands",
  "site-activation-funnel",
  "cec-adjudication-backlog",
] as const;

/** The site start-up stage counts, in the order sites reach them (#2880). */
const FUNNEL = [
  "sites_selected",
  "sites_contracted",
  "sites_irb_approved",
  "sites_initiated",
  "sites_activated",
  "sites_with_first_subject_in",
] as const;

/** The reports that group by their own dimensions at every level (#2759). */
const BREAKDOWNS: Readonly<Record<string, readonly MetricDimensionId[]>> = {
  "screen-failure-reasons": ["screen_failure_reason"],
  "queries-by-form": ["queried_form"],
  "deviations-by-category": ["deviation_category", "deviation_importance"],
};

describe("operations report specs (#2630)", () => {
  it("passes every reporting rule at every study, country and site", () => {
    const findings = EVERY_SCOPE.flatMap((scope) =>
      operationsReportSpecs(warehouse, scope).flatMap((spec) =>
        checkReportSpec(spec)
      )
    );
    expect(findings).toEqual([]);
  });

  it("groups each level by the level below and filters to the scope", () => {
    const specs = (scope: OperationsScope) =>
      operationsReportSpecs(warehouse, scope).filter(
        (spec) =>
          spec.id !== "operations-at-a-glance" && !(spec.id in BREAKDOWNS)
      );
    expect(new Set(specs({}).map((s) => s.dimensions.join()))).toEqual(
      new Set(["study"])
    );
    const study = specs({ study: "DEMO-302" });
    expect(new Set(study.map((s) => s.dimensions.join()))).toEqual(
      new Set(["country"])
    );
    for (const spec of study) {
      expect(spec.filters).toEqual([
        { dimension: "study", operator: "in", values: ["DEMO-302"] },
      ]);
    }
    const country = specs({ study: "DEMO-302", country: "DE" });
    expect(new Set(country.map((s) => s.dimensions.join()))).toEqual(
      new Set(["site"])
    );
    const site = specs({ study: "DEMO-302", site: "DEMO-302-DE-103" });
    // A single site has nothing below it: screening runs by month, the rest
    // are single values.
    expect(
      Object.fromEntries(site.map((s) => [s.id, s.dimensions.join()]))
    ).toEqual({
      "enrollment-against-plan": "",
      "screening-and-enrollment-by-month": "month",
      "screening-outcomes": "",
      "site-activation": "",
      "site-activation-funnel": "",
      "site-start-up-stages": "",
      "data-entry-and-queries": "",
      "query-age-bands": "",
      "protocol-deviations": "",
      "monitoring-and-sdv": "",
    });
    for (const spec of site) {
      expect(spec.filters).toEqual([
        { dimension: "site", operator: "in", values: ["DEMO-302-DE-103"] },
      ]);
    }
  });

  it("groups a breakdown by its own dimensions at every level (#2759)", () => {
    for (const scope of EVERY_SCOPE) {
      const specs = operationsReportSpecs(warehouse, scope);
      const glance = specs.find((s) => s.id === "operations-at-a-glance");
      for (const [id, dimensions] of Object.entries(BREAKDOWNS)) {
        const spec = specs.find((s) => s.id === id);
        expect(spec?.dimensions, `${id} at ${JSON.stringify(scope)}`).toEqual(
          dimensions
        );
        expect(spec?.filters).toEqual(glance?.filters);
      }
    }
  });

  it("splits the screen failures by reason, adding up at every scope (#2879)", () => {
    const metric = METRIC_REGISTRY.find((m) => m.id === "screen_failures")!;
    // Only subjects who failed screening have a reason, so no group is empty.
    const reasons = new Set(
      warehouse.tables["silver.edc_subject"]
        .map((s) => s.screen_failure_reason)
        .filter((reason) => reason !== null)
    );
    expect(reasons.size).toBe(5);
    for (const scope of EVERY_SCOPE) {
      const spec = operationsReportSpecs(warehouse, scope).find(
        (s) => s.id === "screen-failure-reasons"
      )!;
      const label = JSON.stringify(scope);
      const byReason = evaluateMetric(warehouse, metric, {
        dimensions: spec.dimensions,
        filters: spec.filters,
      }).rows;
      const total = evaluateMetric(warehouse, metric, {
        dimensions: [],
        filters: spec.filters,
      }).rows[0]?.value;
      for (const row of byReason) {
        expect(
          reasons.has(row.dimensions.screen_failure_reason ?? ""),
          label
        ).toBe(true);
      }
      expect(
        byReason.reduce((n, row) => n + (row.value ?? 0), 0),
        label
      ).toBe(total ?? 0);
    }
  });

  it("never lets a later start-up stage count more sites than an earlier one (#2880)", () => {
    for (const scope of EVERY_SCOPE) {
      const dashboard = dashboardAt(scope);
      const funnel = panel(dashboard, "site-activation-funnel");
      const plan = panel(dashboard, "enrollment-against-plan");
      expect(funnel.columns.map((c) => c.metricId)).toEqual(FUNNEL);
      const label = JSON.stringify(scope);
      // Every group with a site has a row, and no cell reads "No rows".
      expect(
        funnel.rows.map((r) => r.labels),
        label
      ).toEqual(plan.rows.map((r) => r.labels));
      for (const row of funnel.rows) {
        expect(row.cells.map((c) => c.text)).not.toContain(NO_METRIC_ROWS);
        const counts = row.cells.map((c) => c.value ?? 0);
        counts.slice(1).forEach((count, index) => {
          expect(
            count,
            `${label} ${row.labels.join()} ${FUNNEL[index + 1]}`
          ).toBeLessThanOrEqual(counts[index]);
        });
      }
    }
  });

  it("splits the open queries into age bands that add up (#2759)", () => {
    for (const scope of EVERY_SCOPE) {
      const dashboard = dashboardAt(scope);
      const bands = panel(dashboard, "query-age-bands");
      const queries = panel(dashboard, "data-entry-and-queries");
      const open = queries.columns.findIndex(
        (c) => c.metricId === "open_query_count"
      );
      const label = JSON.stringify(scope);
      // A group with no open query has no row in either report.
      expect(
        bands.rows.map((r) => r.labels),
        label
      ).toEqual(
        queries.rows
          .filter((r) => r.cells[open].value !== null)
          .map((r) => r.labels)
      );
      for (const row of bands.rows) {
        // An empty band reads zero, never "No rows".
        expect(row.cells.map((c) => c.text)).not.toContain(NO_METRIC_ROWS);
        const sum = row.cells.reduce((n, cell) => n + (cell.value ?? 0), 0);
        const match = queries.rows.find(
          (r) => r.labels.join() === row.labels.join()
        );
        expect(sum, `${label} ${row.labels.join()}`).toBe(
          match?.cells[open].value
        );
      }
    }
  });

  it("never claims a sign-off, and keeps the draft overdue metric in an exploratory report", () => {
    for (const spec of operationsReportSpecs(warehouse, {})) {
      expect(spec.signOff).toBeNull();
      expect(spec.tier).not.toBe("certified");
      const draft = spec.metrics.some(
        (id) => METRIC_REGISTRY.find((m) => m.id === id)?.status === "draft"
      );
      if (draft) expect(spec.tier).toBe("exploratory");
    }
  });
});

describe("operations dashboard numbers (#2630)", () => {
  it("shows the registry's golden values for the whole portfolio", () => {
    // The same values __tests__/clinical-platform-semantic.test.ts pins for
    // the default seed (301, data cut 2026-09-30).
    const portfolio = operationsDashboard(warehouse);
    expect(portfolio.dataCut).toBe("2026-09-30");
    const values = glanceValues(portfolio);
    expect(values.subjects_screened).toBe(1808);
    expect(values.subjects_enrolled).toBe(1228);
    expect(values.enrollment_vs_plan).toBeCloseTo(0.788189987163, 11);
    expect(values.screen_failure_rate).toBeCloseTo(0.313966480447, 11);
    expect(values.open_query_count).toBe(36);
    expect(values.sdv_completion).toBeCloseTo(0.854189433022, 11);
    expect(values.important_deviation_rate).toBeCloseTo(13.925081433, 8);
    expect(portfolio.glance.rows[0].cells.map((c) => c.text)).toEqual([
      "1,808",
      "1,228",
      "78.8%",
      "31.4%",
      "36",
      "85.4%",
      "13.9",
    ]);
  });

  it("computes every value with the registry's own evaluator", () => {
    const scopes: OperationsScope[] = [
      {},
      { runBy: "VEN-CRO-02" },
      { study: "DEV-402" },
      { study: "DEMO-302", country: "DE" },
      { study: "DEMO-302", site: "DEMO-302-DE-103" },
    ];
    for (const scope of scopes) {
      const dashboard = operationsDashboard(warehouse, scope);
      for (const data of [
        dashboard.glance,
        ...dashboard.sections.flatMap((s) => s.reports),
      ]) {
        data.columns.forEach((column, index) => {
          const metric = METRIC_REGISTRY.find((m) => m.id === column.metricId)!;
          const expected = evaluateMetric(warehouse, metric, {
            dimensions: data.spec.dimensions,
            filters: data.spec.filters,
          }).rows;
          for (const row of data.rows) {
            const match = expected.find((e) =>
              data.spec.dimensions.every(
                (d, i) => e.dimensions[d] === row.labels[i]
              )
            );
            // A query age band or funnel stage with no row for a group
            // counted none of it (#2759, #2880); any other missing row has
            // no value.
            const missing = ZERO_FILLED.some((id) =>
              data.spec.id.startsWith(id)
            )
              ? 0
              : null;
            expect(
              row.cells[index].value,
              `${data.spec.id} ${column.metricId}`
            ).toBe(match === undefined ? missing : match.value);
          }
        });
      }
    }
  });

  it("narrows every number the same way when drilling in", () => {
    // A study's glance equals its row in the portfolio's by-study reports,
    // a country's equals its row at the study level, and a site's its row
    // at the country level.
    const levels: [OperationsScope, (child: OperationsScope) => string][] = [
      [{}, (c) => c.study!],
      [{ study: "DEMO-302" }, (c) => c.country!],
      [{ study: "DEMO-302", country: "DE" }, (c) => c.site!],
    ];
    for (const [scope, labelOf] of levels) {
      const parent = operationsDashboard(warehouse, scope);
      expect(parent.members.length).toBeGreaterThan(0);
      for (const member of parent.members) {
        const child = glanceValues(
          operationsDashboard(warehouse, member.scope)
        );
        const byChild = parent.sections
          .flatMap((s) => s.reports)
          .map((r) => rowValues(r, labelOf(member.scope)) ?? {});
        for (const values of byChild) {
          for (const [metricId, value] of Object.entries(values)) {
            if (metricId in child) {
              expect(child[metricId], `${member.id} ${metricId}`).toBe(value);
            }
          }
        }
      }
    }
  });

  it("adds up enrollment across the studies to the portfolio total", () => {
    const portfolio = operationsDashboard(warehouse);
    const byStudy = report(portfolio, "screening-and-enrollment-by-study");
    const column = byStudy.columns.findIndex(
      (c) => c.metricId === "subjects_enrolled"
    );
    const total = byStudy.rows.reduce(
      (sum, row) => sum + (row.cells[column].value ?? 0),
      0
    );
    expect(total).toBe(glanceValues(portfolio).subjects_enrolled);
  });
});

describe("operations drill-down (#2630)", () => {
  it("lists the next level down with links that open it", () => {
    const portfolio = operationsDashboard(warehouse);
    expect(portfolio.level).toBe("portfolio");
    expect(portfolio.memberLevel).toBe("study");
    expect(portfolio.members.map((m) => m.id)).toEqual(
      studies.map((s) => s.study_id).sort()
    );
    const study = operationsDashboard(warehouse, { study: "DEV-402" });
    expect(study.memberLevel).toBe("country");
    const codes = [
      ...new Set(
        sites.filter((s) => s.study_id === "DEV-402").map((s) => s.country_code)
      ),
    ].sort();
    expect(study.members.map((m) => m.id)).toEqual(codes);
    for (const member of study.members) {
      const n = sites.filter(
        (s) => s.study_id === "DEV-402" && s.country_code === member.id
      ).length;
      expect(member.detail).toBe(`${n} ${n === 1 ? "site" : "sites"}`);
    }
    expect(study.members.find((m) => m.id === "CA")?.label).toBe("Canada");
    const country = operationsDashboard(warehouse, {
      study: "DEMO-302",
      country: "DE",
    });
    expect(
      country.members.every((m) => m.scope.site?.startsWith("DEMO-302-DE-"))
    ).toBe(true);
    const site = operationsDashboard(warehouse, country.members[0].scope);
    expect(site.level).toBe("site");
    expect(site.memberLevel).toBeNull();
    expect(site.members).toEqual([]);
    expect(site.crumbs.map((c) => c.label)).toEqual([
      "Portfolio",
      "DEMO-302",
      "Germany",
      country.members[0].id,
    ]);
  });

  it("takes a site's country when only the site is given", () => {
    const site = operationsDashboard(warehouse, {
      study: "DEMO-302",
      site: "DEMO-302-DE-103",
    });
    expect(site.scope).toEqual({
      study: "DEMO-302",
      country: "DE",
      site: "DEMO-302-DE-103",
    });
    expect(site.notice).toBeNull();
  });

  it.each([
    [
      { study: "NOPE" },
      "portfolio",
      "No study NOPE in the portfolio. Showing the whole portfolio.",
    ],
    [
      { study: "DEMO-301", country: "JP" },
      "study",
      "DEMO-301 has no sites in JP. Showing DEMO-301.",
    ],
    [
      { study: "DEMO-301", country: "US", site: "DEMO-302-DE-103" },
      "country",
      "No site DEMO-302-DE-103 in DEMO-301 in US. Showing DEMO-301 in United States.",
    ],
    [
      { runBy: "VEN-NOPE" },
      "portfolio",
      "No run-by choice VEN-NOPE. Showing every study.",
    ],
  ] as const)(
    "cuts %j back to the %s level and says why",
    (scope, level, notice) => {
      const dashboard = operationsDashboard(warehouse, scope);
      expect(dashboard.level).toBe(level);
      expect(dashboard.notice).toBe(notice);
    }
  );

  it("filters the portfolio to the studies a sponsor or CRO runs", () => {
    const portfolio = operationsDashboard(warehouse);
    expect(portfolio.runByOptions.map((o) => `${o.id}:${o.studies}`)).toEqual([
      ":8",
      "sponsor:5",
      "VEN-CRO-01:1",
      "VEN-CRO-02:2",
    ]);
    const cro = operationsDashboard(warehouse, { runBy: "VEN-CRO-02" });
    expect(cro.members.map((m) => m.id)).toEqual(["DEMO-201", "DEMO-203"]);
    expect(
      report(cro, "enrollment-against-plan-by-study").rows.map(
        (r) => r.labels[0]
      )
    ).toEqual(["DEMO-201", "DEMO-203"]);
    const enrolled = METRIC_REGISTRY.find((m) => m.id === "subjects_enrolled")!;
    const expected = evaluateMetric(warehouse, enrolled, {
      filters: [
        {
          dimension: "study",
          operator: "in",
          values: ["DEMO-201", "DEMO-203"],
        },
      ],
    }).rows[0].value;
    expect(glanceValues(cro).subjects_enrolled).toBe(expected);
    // The choice belongs to the portfolio level; a study is a study.
    expect(
      operationsDashboard(warehouse, { study: "DEMO-201", runBy: "sponsor" })
        .scope
    ).toEqual({
      study: "DEMO-201",
    });
  });
});

describe("operations sections (#2630)", () => {
  it("shows a study's milestones in its own vocabulary", () => {
    const device = operationsDashboard(warehouse, { study: "DEV-401" });
    expect(device.study?.regulatoryPath).toBe("IDE");
    const approval = device.milestones?.find(
      (m) => m.kind === "regulatory-approval"
    );
    expect(approval).toEqual({
      kind: "regulatory-approval",
      label: "IDE approval",
      planned: "2024-07-18",
      actual: "2024-07-03",
      varianceDays: -15,
    });
    expect(device.milestones?.at(-1)).toMatchObject({
      label: "Clinical investigation report final",
      actual: null,
      varianceDays: null,
    });
    const drug = operationsDashboard(warehouse, { study: "DEMO-301" });
    expect(drug.milestones?.map((m) => m.label)).toContain("IND in effect");
    expect(operationsDashboard(warehouse).milestones).toBeNull();
  });

  it("names the CRO that runs a study", () => {
    const study = operationsDashboard(warehouse, { study: "DEMO-302" });
    expect(study.study).toMatchObject({
      operatingModel: "cro",
      croName: "Quillfeather Clinical Research",
    });
    expect(
      operationsDashboard(warehouse, { study: "DEMO-301" }).study?.croName
    ).toBeNull();
    expect(
      studies
        .filter((s: WarehouseRow) => s.operating_model === "cro")
        .map((s) => s.study_id)
    ).toEqual(["DEMO-201", "DEMO-203", "DEMO-302"]);
  });

  it("shows milestones at the portfolio and study levels only, and risk below the portfolio (#2631)", () => {
    const ids = (scope: OperationsScope) =>
      operationsDashboard(warehouse, scope).sections.map((s) => s.id);
    const shared = ["enrollment", "activation", "data-management", "quality"];
    expect(ids({})).toEqual([...shared, "milestones"]);
    expect(ids({ study: "DEMO-302" })).toEqual([
      ...shared,
      "risk",
      "milestones",
    ]);
    expect(ids({ study: "DEMO-302", country: "DE" })).toEqual([
      ...shared,
      "risk",
    ]);
    expect(ids({ study: "DEMO-302", site: "DEMO-302-DE-103" })).toEqual([
      ...shared,
      "risk",
    ]);
  });

  it("shows overdue reports and interim visits against each study's monitoring plan (#2736)", () => {
    const monitoring = operationsDashboard(warehouse)
      .sections.find((s) => s.id === "quality")!
      .reports.find((r) => r.spec.id === "monitoring-and-sdv-by-study")!;
    expect(monitoring.spec.tier).toBe("managed");
    const column = (id: string) =>
      monitoring.columns.findIndex((c) => c.metricId === id);
    const overdue = (id: string) =>
      Object.fromEntries(
        monitoring.rows
          .map((row) => [row.labels[0], row.cells[column(id)].value] as const)
          .filter(([, value]) => value !== null)
      );
    // The golden values __tests__/clinical-platform-monitoring-plan.test.ts
    // pins per study; closed studies have no rows.
    expect(overdue("monitoring_reports_overdue")).toEqual({
      "DEMO-302": 1,
      "DEV-402": 1,
    });
    expect(overdue("monitoring_visits_overdue")).toEqual({
      "DEMO-302": 1,
      "DEV-402": 4,
    });
  });

  it("lists what the registry cannot compute yet, with the registry's own reasons", () => {
    const portfolio = operationsDashboard(warehouse);
    const gaps = portfolio.sections.flatMap((s) => s.gaps);
    for (const gap of gaps) {
      const recorded = METRIC_GAPS.find((g) => g.name === gap.name);
      if (recorded !== undefined) expect(gap.reason).toBe(recorded.reason);
    }
    expect(gaps.map((g) => `${g.name} #${g.issue ?? "none"}`)).toEqual([
      "Enrollment against a time-phased plan #none",
      "Query rate per 100 CRF pages #none",
      "eTMF completeness #none",
    ]);
    // A device study's adjudication backlog is a report now, not a gap.
    expect(
      dashboardAt({ study: "DEV-402" })
        .sections.flatMap((s) => s.gaps)
        .map((g) => g.name)
    ).not.toContain("CEC adjudication backlog");
  });
});

describe("event adjudication backlog (#2881)", () => {
  const BACKLOG = "cec-adjudication-backlog";
  const TIME = "cec-adjudication-time";
  const adjudicating = new Set(
    studies
      .filter((s) => s.has_cec_adjudication === true)
      .map((s) => s.study_id)
  );
  const shown = (dashboard: OperationsDashboard) =>
    dashboard.sections
      .flatMap((s) => s.reports)
      .map((r) => r.spec.id)
      .filter((id) => id.startsWith("cec-"));

  it("appears only where a study in scope sends events to its committee", () => {
    expect([...adjudicating]).toEqual(["DEV-402"]);
    for (const scope of EVERY_SCOPE) {
      const expected =
        scope.study === undefined || adjudicating.has(scope.study);
      expect(shown(dashboardAt(scope)).length > 0, JSON.stringify(scope)).toBe(
        expected
      );
    }
    // A run-by choice without a device study hides it at the portfolio.
    expect(
      shown(operationsDashboard(warehouse, { runBy: "VEN-CRO-02" }))
    ).toEqual([]);
    // The spec list the dashboard is built from agrees.
    expect(
      operationsReportSpecs(warehouse, { study: "DEMO-301" })
        .map((spec) => spec.id)
        .filter((id) => id.startsWith("cec-"))
    ).toEqual([]);
    expect(
      operationsReportSpecs(warehouse, { study: "DEV-402" })
        .map((spec) => spec.id)
        .filter((id) => id.startsWith("cec-"))
    ).toEqual([`${BACKLOG}-by-country`, `${TIME}-by-country`]);
  });

  it("adds up: every event reported is adjudicated or waiting, at every scope", () => {
    const events = warehouse.tables["gold.fct_cec_adjudication"];
    const portfolio = panel(dashboardAt({}), BACKLOG);
    expect(portfolio.rows.map((r) => r.labels)).toEqual([["DEV-402"]]);
    expect(portfolio.rows[0].cells.map((c) => c.value)).toEqual([
      events.length,
      events.filter((e) => e.adjudicated_date_key !== null).length,
      events.filter((e) => e.adjudicated_date_key === null).length,
    ]);
    for (const scope of EVERY_SCOPE.filter((s) => s.study === "DEV-402")) {
      for (const row of panel(dashboardAt(scope), BACKLOG).rows) {
        const [reported, adjudicated, waiting] = row.cells.map((c) => c.value);
        const label = `${JSON.stringify(scope)} ${row.labels.join()}`;
        expect(
          row.cells.map((c) => c.text),
          label
        ).not.toContain(NO_METRIC_ROWS);
        expect(adjudicated! + waiting!, label).toBe(reported);
      }
    }
  });
});

describe("operations data freshness (#2630, #2626)", () => {
  // Contracts describe the schema, not the rows, so a small run will do.
  const run = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 24 });
  const contracts = new Map(dataContracts(run).map((c) => [c.productId, c]));
  const products = dataProducts(run);
  const readBy = (metricIds: readonly string[]) =>
    products
      .filter((p) =>
        p.consumers.some((c) => c.kind === "metric" && metricIds.includes(c.id))
      )
      .map((p) => p.id);
  const RISK_METRICS = [
    ...KRI_LIBRARY.flatMap((k) => [k.metricId, k.minimum.metricId]),
    ...QTL_LIBRARY.map((q) => q.metricId),
  ];
  const reports = (d: OperationsDashboard) => [
    d.glance,
    ...d.sections.flatMap((s) => s.reports),
  ];

  it("lists every data product the numbers read, with its contract's freshness", () => {
    for (const scope of EVERY_SCOPE) {
      const dashboard = dashboardAt(scope);
      const metricIds = reports(dashboard).flatMap((r) => r.spec.metrics);
      const expected = new Set(readBy(metricIds));
      if (dashboard.milestones !== null) {
        expected.add("gold.dim_milestone");
        expected.add("gold.fct_milestone");
      }
      if (dashboard.risk !== null) {
        for (const id of readBy(RISK_METRICS)) expected.add(id);
        for (const test of CSM_TESTS) {
          for (const column of test.reads) {
            expected.add(column.split(".").slice(0, 2).join("."));
          }
        }
      }
      expect(dashboard.sources.map((s) => s.productId)).toEqual(
        [...expected].sort()
      );
      for (const source of dashboard.sources) {
        const contract = contracts.get(source.productId)!;
        expect(source.freshnessHours).toBe(contract.sla.freshnessHours);
        expect(source.contractVersion).toBe(contract.version);
        expect(source.name).toBe(
          products.find((p) => p.id === source.productId)!.name
        );
      }
    }
  });

  it("promises no report fresher than the products it reads", () => {
    for (const scope of EVERY_SCOPE) {
      for (const report of reports(dashboardAt(scope))) {
        const slowest = Math.max(
          ...readBy(report.spec.metrics).map(
            (id) => contracts.get(id)!.sla.freshnessHours
          )
        );
        expect(
          report.spec.refreshSlaHours,
          report.spec.id
        ).toBeGreaterThanOrEqual(slowest);
      }
    }
  });

  it("reads only daily gold loads on the portfolio dashboard", () => {
    const { sources } = operationsDashboard(warehouse);
    expect(sources.map((s) => s.productId)).toEqual([
      "gold.dim_site",
      "gold.fct_cec_adjudication",
      "gold.fct_deviation",
      "gold.fct_enrollment",
      "gold.fct_milestone",
      "gold.fct_monitoring_visit",
      "gold.fct_planned_monitoring_visit",
      "gold.fct_query",
      "gold.fct_visit",
    ]);
    expect(new Set(sources.map((s) => s.freshnessHours))).toEqual(
      new Set([24])
    );
  });
});

describe("operations risk tab (#2631)", () => {
  const risk = (scope: OperationsScope) => dashboardAt(scope).risk;
  const metric = (id: string) => METRIC_REGISTRY.find((m) => m.id === id)!;
  const activated = (study: string) =>
    sites
      .filter((s) => s.study_id === study && s.activated_on !== null)
      .map((s) => String(s.site_id))
      .sort();

  it("has no risk tab at the portfolio level", () => {
    expect(risk({})).toBeNull();
    expect(risk({ runBy: "sponsor" })).toBeNull();
  });

  it("shows each study's assessment whole at the study level", () => {
    for (const study of studies) {
      const id = String(study.study_id);
      const tab = risk({ study: id })!;
      const assessment = assessStudyRisk(warehouse, id);
      expect(tab.studyId).toBe(id);
      expect(tab.sites.map((s) => s.id)).toEqual(activated(id));
      expect(tab.planVersion).toBe(assessment.plan.version);
      expect(tab.planEffectiveOn).toBe(assessment.plan.effectiveOn);
      expect(tab.kris.map((k) => k.id)).toEqual(KRI_LIBRARY.map((k) => k.id));
      for (const kri of tab.kris) {
        const definition = KRI_LIBRARY.find((k) => k.id === kri.id)!;
        const expected = assessment.kris.filter((a) => a.kriId === kri.id);
        expect(kri.cells.map((c) => [c.siteId, c.status])).toEqual(
          expected.map((a) => [a.siteId, a.status])
        );
        expect(kri.cells.map((c) => c.text)).toEqual(
          expected.map((a) =>
            formatMetricValue(metric(definition.metricId), a.value)
          )
        );
      }
      expect(tab.qtls.map((q) => [q.id, q.status])).toEqual(
        assessment.qtls.map((q) => [q.qtlId, q.status])
      );
      expect(tab.csm.results).toEqual(assessment.csm.results);
      expect(tab.csm.excluded).toEqual(assessment.csm.excluded);
      expect(tab.log).toEqual(assessment.log);
    }
  });

  it("narrows sites, KRIs, central monitoring and signals to the scope, but never the QTLs", () => {
    // Each study's whole tab, built once rather than once per country and site.
    const wholes = new Map<string, NonNullable<ReturnType<typeof risk>>>();
    for (const scope of EVERY_SCOPE.filter((s) => s.country !== undefined)) {
      const tab = risk(scope)!;
      const study = scope.study!;
      if (!wholes.has(study)) wholes.set(study, risk({ study })!);
      const whole = wholes.get(study)!;
      const inScope = new Set(
        sites
          .filter(
            (s) =>
              s.study_id === scope.study &&
              s.country_code === scope.country &&
              (scope.site === undefined || s.site_id === scope.site)
          )
          .map((s) => String(s.site_id))
      );
      const shown = new Set(tab.sites.map((s) => s.id));
      expect(
        [...shown].every((id) => inScope.has(id)),
        JSON.stringify(scope)
      ).toBe(true);
      expect(tab.sites.map((s) => s.id)).toEqual(
        whole.sites.map((s) => s.id).filter((id) => inScope.has(id))
      );
      for (const kri of tab.kris) {
        expect(kri.cells.every((c) => shown.has(c.siteId))).toBe(true);
      }
      expect(tab.csm.sites.every((id) => shown.has(id))).toBe(true);
      expect(tab.csm.results.every((r) => shown.has(r.siteId))).toBe(true);
      expect(
        tab.csm.excluded.every((e) => e.siteId === null || shown.has(e.siteId))
      ).toBe(true);
      for (const entry of tab.log) {
        const raised = whole.log.find(
          (e) => e.signalId === entry.signalId && e.event === "raised"
        )!;
        const source = raised.source!;
        expect(source.kind === "qtl" || shown.has(source.siteId)).toBe(true);
      }
      expect(tab.qtls).toEqual(whole.qtls);
    }
  });

  it("drills from each site row into that site's own scope", () => {
    for (const site of risk({ study: "DEMO-302" })!.sites) {
      const dashboard = operationsDashboard(warehouse, site.scope);
      expect(dashboard.notice).toBeNull();
      expect(dashboard.scope).toEqual(site.scope);
      expect(dashboard.risk!.sites).toEqual([site]);
    }
  });

  it("puts each KRI's thresholds in its metric's unit", () => {
    const tab = risk({ study: "DEMO-302" })!;
    const kri = (id: string) => tab.kris.find((k) => k.id === id)!;
    expect(kri("kri-screen-failure").thresholds).toBe(
      "Amber at 50.0% or more, red at 65.0% or more."
    );
    expect(kri("kri-screen-failure").minimum).toBe("8 subjects screened");
    expect(kri("kri-sdv").thresholds).toBe(
      "Amber at 80.0% or less, red at 70.0% or less."
    );
    expect(kri("kri-entry-lag").minimum).toBe("3 subjects enrolled");
  });

  it("flags the planted site on several tests, and shows its signal only where it is in scope", () => {
    const planted = "DEMO-302-BR-118";
    const flagged = (scope: OperationsScope) =>
      risk(scope)!
        .csm.results.filter((r) => r.flagged && r.siteId === planted)
        .map((r) => r.testId);
    expect(flagged({ study: "DEMO-302" }).length).toBeGreaterThanOrEqual(2);
    // One query reads as one, not "1 queries".
    expect(
      risk({ study: "DEMO-302" })!.csm.results.find(
        (r) => r.siteId === planted && r.testId === "csm-query-under-reporting"
      )!.detail
    ).toMatch(/^1 query over 32 entered visits;/);
    expect(flagged({ study: "DEMO-302", country: "BR" })).toEqual(
      flagged({ study: "DEMO-302" })
    );
    const signals = (scope: OperationsScope) =>
      risk(scope)!.log.map((e) => e.signalId);
    expect(signals({ study: "DEMO-302", country: "BR" })).toContain(
      "DEMO-302-SIG-001"
    );
    expect(signals({ study: "DEMO-302", country: "DE" })).toEqual([]);
  });

  it("shows a QTL breach and the signal it raises (DEMO-203)", () => {
    const tab = risk({ study: "DEMO-203" })!;
    const breach = tab.qtls.find((q) => q.id === "qtl-early-termination")!;
    expect(breach).toMatchObject({
      status: "breached",
      value: "27.8%",
      secondaryLimit: "18.0%",
      limit: "25.0%",
    });
    const raised = tab.log.find(
      (e) => e.source?.kind === "qtl" && e.source.qtlId === breach.id
    )!;
    expect(raised.event).toBe("raised");
    expect(raised.note).toContain("past the tolerance limit of 25.0%");
    // A study-level signal belongs to every country of the study.
    expect(
      risk({ study: "DEMO-203", country: "JP" })!.log.map((e) => e.signalId)
    ).toContain(raised.signalId);
  });

  it("names what central monitoring cannot test yet, with the issue that adds the data", () => {
    const section = operationsDashboard(warehouse, {
      study: "DEMO-302",
    }).sections.find((s) => s.id === "risk")!;
    expect(section.reports).toEqual([]);
    // Adverse event under-reporting (#2956), the time of day of entry
    // (#2955) and digit preference in vital signs (#2957) are tested now.
    expect(section.gaps.map((g) => `${g.name} #${g.issue}`)).toEqual([
      "Weekend and holiday visit dates #2776",
    ]);
    const factor = risk({ study: "DEMO-302" })!.factors.find(
      (f) => f.id === "ctq-safety-reporting"
    )!;
    expect(factor.gap?.issue).toBe(2980);
    expect(factor.kris).toEqual([]);
  });
});
