import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_GAPS,
  METRIC_REGISTRY,
  buildWarehouse,
  checkReportSpec,
  dataContracts,
  dataProducts,
  evaluateMetric,
  generatePortfolio,
  operationsDashboard,
  operationsReportSpecs,
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
        (spec) => spec.id !== "operations-at-a-glance"
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
      "data-entry-and-queries": "",
      "protocol-deviations": "",
      "monitoring-and-sdv": "",
    });
    for (const spec of site) {
      expect(spec.filters).toEqual([
        { dimension: "site", operator: "in", values: ["DEMO-302-DE-103"] },
      ]);
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
    expect(values.sdv_completion).toBeCloseTo(0.853482293855, 11);
    expect(values.important_deviation_rate).toBeCloseTo(13.680781759, 8);
    expect(portfolio.glance.rows[0].cells.map((c) => c.text)).toEqual([
      "1,808",
      "1,228",
      "78.8%",
      "31.4%",
      "36",
      "85.3%",
      "13.7",
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
            expect(
              row.cells[index].value,
              `${data.spec.id} ${column.metricId}`
            ).toBe(match === undefined ? null : match.value);
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

  it("shows milestones at the portfolio and study levels only", () => {
    const ids = (scope: OperationsScope) =>
      operationsDashboard(warehouse, scope).sections.map((s) => s.id);
    const all = [
      "enrollment",
      "activation",
      "data-management",
      "quality",
      "milestones",
    ];
    expect(ids({})).toEqual(all);
    expect(ids({ study: "DEMO-302" })).toEqual(all);
    expect(ids({ study: "DEMO-302", country: "DE" })).toEqual(all.slice(0, 4));
    expect(ids({ study: "DEMO-302", site: "DEMO-302-DE-103" })).toEqual(
      all.slice(0, 4)
    );
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
      "Screen failure reasons #2760",
      "Site activation funnel #2760",
      "Query rate per 100 CRF pages #none",
      "Query aging buckets and open queries by form #2759",
      "Deviations by category and importance #2759",
      "eTMF completeness #none",
      "Monitoring visits overdue against the monitoring plan #2736",
    ]);
    const cec = (study: string) =>
      operationsDashboard(warehouse, { study })
        .sections.find((s) => s.id === "milestones")!
        .gaps.map((g) => g.name);
    expect(cec("DEV-402")).toEqual(["CEC adjudication backlog"]);
    expect(cec("DEV-401")).toEqual([]);
    expect(cec("DEMO-301")).toEqual([]);
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
  const reports = (d: OperationsDashboard) => [
    d.glance,
    ...d.sections.flatMap((s) => s.reports),
  ];

  it("lists every data product the numbers read, with its contract's freshness", () => {
    for (const scope of EVERY_SCOPE) {
      const dashboard = operationsDashboard(warehouse, scope);
      const metricIds = reports(dashboard).flatMap((r) => r.spec.metrics);
      const expected = new Set(readBy(metricIds));
      if (dashboard.milestones !== null) {
        expected.add("gold.dim_milestone");
        expected.add("gold.fct_milestone");
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
      for (const report of reports(operationsDashboard(warehouse, scope))) {
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
      "gold.fct_deviation",
      "gold.fct_enrollment",
      "gold.fct_milestone",
      "gold.fct_monitoring_visit",
      "gold.fct_query",
      "gold.fct_visit",
    ]);
    expect(new Set(sources.map((s) => s.freshnessHours))).toEqual(
      new Set([24])
    );
  });
});
