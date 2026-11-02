import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  buildWarehouse,
  checkReportSpec,
  evaluateMetric,
  generatePortfolio,
  portfolioDashboard,
  portfolioReportSpecs,
  type Warehouse,
  type WarehouseRow,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dashboard = portfolioDashboard(warehouse);
const studies = warehouse.tables["gold.dim_study"];
const kinds = new Map(
  warehouse.tables["gold.dim_milestone"].map((m) => [
    m.milestone_key,
    String(m.milestone_kind),
  ])
);

/** `20240603` as `2024-06-03`. */
const iso = (key: unknown) =>
  typeof key === "number"
    ? `${String(key).slice(0, 4)}-${String(key).slice(4, 6)}-${String(key).slice(6, 8)}`
    : null;

const days = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / 86_400_000;

function milestoneRow(studyId: string, kind: string): WarehouseRow {
  const study = studies.find((s) => s.study_id === studyId)!;
  return warehouse.tables["gold.fct_milestone"].find(
    (m) =>
      m.study_key === study.study_key && kinds.get(m.milestone_key) === kind
  )!;
}

/** The warehouse with one milestone's actual date moved. */
function withActual(
  studyId: string,
  kind: string,
  actual: number | null
): Warehouse {
  const target = milestoneRow(studyId, kind);
  return {
    ...warehouse,
    tables: {
      ...warehouse.tables,
      "gold.fct_milestone": warehouse.tables["gold.fct_milestone"].map((m) =>
        m === target ? { ...m, actual_date_key: actual } : m
      ),
    },
  };
}

describe("the milestone swimlane (#2911)", () => {
  const { swimlane } = dashboard;

  it("has a lane per study, in id order, with every milestone of gold.fct_milestone", () => {
    expect(swimlane.lanes.map((l) => l.studyId)).toEqual(
      studies.map((s) => String(s.study_id)).sort()
    );
    expect(
      swimlane.lanes.reduce((sum, l) => sum + l.milestones.length, 0)
    ).toBe(warehouse.tables["gold.fct_milestone"].length);
    for (const lane of swimlane.lanes) {
      expect(lane.milestones.map((m) => m.kind)).toEqual(
        swimlane.kinds.map((k) => k.kind)
      );
      for (const milestone of lane.milestones) {
        const row = milestoneRow(lane.studyId, milestone.kind);
        expect(milestone.planned).toBe(iso(row.planned_date_key));
        expect(milestone.actual).toBe(iso(row.actual_date_key));
        expect(milestone.label).toBe(row.milestone_label);
      }
    }
  });

  it("names each kind as gold.dim_milestone does, in lifecycle order", () => {
    expect(swimlane.kinds.map((k) => k.name)).toEqual([
      "Protocol final",
      "Regulatory approval",
      "First site activated",
      "First subject in",
      "50% enrolled",
      "Last subject in",
      "Last subject last visit",
      "Database lock",
      "Final report",
    ]);
  });

  it("rates every milestone against its plan at the data cut", () => {
    const cut = warehouse.asOf;
    for (const lane of swimlane.lanes) {
      for (const m of lane.milestones) {
        const expected =
          m.actual !== null
            ? m.actual > m.planned
              ? "late"
              : "on-time"
            : m.planned < cut
              ? "overdue"
              : "upcoming";
        expect(m.status, `${lane.studyId} ${m.kind}`).toBe(expected);
        expect(m.overdueDays).toBe(
          expected === "overdue" ? days(m.planned, cut) : null
        );
      }
      expect(lane.slipped).toBe(
        lane.milestones.filter(
          (m) => m.status === "late" || m.status === "overdue"
        ).length
      );
    }
  });

  it("shows the seed's slips: DEMO-302 is 108 days past its planned last subject in", () => {
    const lane = (id: string) => swimlane.lanes.find((l) => l.studyId === id)!;
    const demo302 = lane("DEMO-302");
    expect(
      demo302.milestones.find((m) => m.kind === "last-subject-in")
    ).toMatchObject({
      status: "overdue",
      planned: "2026-06-14",
      actual: null,
      overdueDays: 108,
    });
    expect(demo302.slipped).toBe(5);
    expect(
      lane("DEMO-101").milestones.find((m) => m.kind === "final-report")
    ).toMatchObject({ status: "late", varianceDays: 2 });
    expect(
      swimlane.lanes.flatMap((l) =>
        l.milestones.filter((m) => m.status === "overdue")
      )
    ).toHaveLength(1);
  });

  it("spans every milestone and the data cut, in whole months", () => {
    const dates = swimlane.lanes.flatMap((l) =>
      l.milestones.flatMap((m) => [m.planned, m.actual ?? m.planned])
    );
    expect(swimlane.from).toBe("2024-06-01");
    expect(swimlane.to).toBe("2028-06-01");
    for (const date of [...dates, warehouse.asOf]) {
      expect(date >= swimlane.from && date < swimlane.to).toBe(true);
    }
    expect(swimlane.years).toEqual([
      "2025-01-01",
      "2026-01-01",
      "2027-01-01",
      "2028-01-01",
    ]);
  });
});

describe("the cycle-time benchmarks (#2911)", () => {
  it("are governed reports that pass every reporting rule", () => {
    const specs = portfolioReportSpecs().slice(0, 3);
    expect(specs.map((s) => s.metrics[0])).toEqual([
      "protocol_final_to_fpi_days",
      "fpi_to_lpi_days",
      "lplv_to_dbl_days",
    ]);
    for (const spec of specs) expect(checkReportSpec(spec)).toEqual([]);
    expect(dashboard.benchmarks.map((b) => b.report.spec)).toEqual(specs);
  });

  it("show each study's value as the registry computes it", () => {
    for (const { report } of dashboard.benchmarks) {
      const metric = METRIC_REGISTRY.find(
        (m) => m.id === report.spec.metrics[0]
      )!;
      const expected = evaluateMetric(warehouse, metric, {
        dimensions: ["study"],
      }).rows.map((r) => [r.dimensions.study, r.value]);
      expect(report.rows.map((r) => [r.labels[0], r.cells[0].value])).toEqual(
        expected
      );
    }
  });

  it("give the median, quartiles and the study furthest from the median", () => {
    expect(
      dashboard.benchmarks.map((b) => ({
        studies: b.studies,
        median: b.median,
        quartiles: [b.lowerQuartileText, b.medianText, b.upperQuartileText],
        outlier: b.outlier,
        beyondFences: b.beyondFences,
      }))
    ).toEqual([
      {
        studies: 8,
        median: 103.5,
        quartiles: ["90.0", "103.5", "135.8"],
        outlier: {
          studyId: "DEMO-302",
          value: 185,
          text: "185",
          fromMedian: 81.5,
          fromMedianText: "81.5",
          beyondFence: false,
        },
        beyondFences: [],
      },
      {
        // DEMO-302 and DEV-402 are still enrolling.
        studies: 6,
        median: 321.5,
        quartiles: ["182.3", "321.5", "453.3"],
        outlier: {
          studyId: "DEMO-202",
          value: 527,
          text: "527",
          fromMedian: 205.5,
          fromMedianText: "205.5",
          beyondFence: false,
        },
        beyondFences: [],
      },
      {
        // Only three studies have locked their database.
        studies: 3,
        median: 46,
        quartiles: ["44.5", "46.0", "60.5"],
        outlier: {
          studyId: "DEMO-101",
          value: 75,
          text: "75",
          fromMedian: 29,
          fromMedianText: "29.0",
          beyondFence: false,
        },
        beyondFences: [],
      },
    ]);
  });

  it("call a study an outlier only beyond Tukey's fences", () => {
    // DEMO-302's first subject 637 days after its protocol: the upper fence
    // is 135.75 + 1.5 × 45.75 = 204.4 days.
    const slow = portfolioDashboard(
      withActual("DEMO-302", "first-subject-in", 20260601)
    ).benchmarks[0];
    expect(slow.outlier).toMatchObject({
      studyId: "DEMO-302",
      value: 637,
      beyondFence: true,
    });
    expect(slow.upperQuartile).toBe(135.75);
    expect(slow.beyondFences).toEqual(["DEMO-302"]);
  });

  it("name no study furthest from the median with fewer than three values", () => {
    const twoLocked = portfolioDashboard(
      withActual("DEMO-101", "database-lock", null)
    ).benchmarks[2];
    expect(twoLocked.studies).toBe(2);
    expect(twoLocked.median).toBe(44.5);
    expect(twoLocked.outlier).toBeNull();
    expect(twoLocked.beyondFences).toEqual([]);
  });

  it("read no value as no value, never as zero", () => {
    const none = portfolioDashboard({
      ...warehouse,
      tables: { ...warehouse.tables, "gold.fct_milestone": [] },
    });
    for (const benchmark of none.benchmarks) {
      expect(benchmark.studies).toBe(0);
      expect(benchmark.median).toBeNull();
      expect(benchmark.medianText).toBe("No value");
      expect(benchmark.outlier).toBeNull();
    }
    expect(none.swimlane.lanes.every((l) => l.milestones.length === 0)).toBe(
      true
    );
  });
});

describe("budget against forecast at completion (#2912)", () => {
  const { finance } = dashboard;
  const total = (id: string, w: Warehouse = warehouse) =>
    evaluateMetric(
      w,
      METRIC_REGISTRY.find((m) => m.id === id)!
    ).rows[0]?.value ?? null;

  it("are governed reports that pass every reporting rule, after the benchmarks", () => {
    const specs = portfolioReportSpecs().slice(3);
    expect(specs.map((s) => [s.id, s.dimensions, s.visual])).toEqual([
      ["portfolio-cost-at-completion-by-study", ["study"], "bar"],
      ["portfolio-cost-at-completion-by-vendor", ["vendor"], "bar"],
      ["portfolio-variance-at-completion-by-study", ["study"], "table"],
      ["portfolio-variance-at-completion-by-vendor", ["vendor"], "table"],
    ]);
    for (const spec of specs) {
      expect(checkReportSpec(spec)).toEqual([]);
      expect(spec.owner).toBe("Clinical Finance Lead");
    }
    expect(finance.reports.map((r) => r.spec)).toEqual(specs);
  });

  it("show each study's and vendor's values as the registry computes them", () => {
    for (const report of finance.reports) {
      report.spec.metrics.forEach((id, column) => {
        const expected = evaluateMetric(
          warehouse,
          METRIC_REGISTRY.find((m) => m.id === id)!,
          { dimensions: report.spec.dimensions }
        ).rows.map((r) => [r.dimensions[report.spec.dimensions[0]], r.value]);
        expect(
          report.rows.map((r) => [r.labels[0], r.cells[column].value]),
          `${report.spec.id} ${id}`
        ).toEqual(expected);
      });
    }
  });

  it("add the vendor rows up to the portfolio, as the study rows do", () => {
    const [byStudy, byVendor] = finance.reports;
    byStudy.spec.metrics.forEach((id, column) => {
      const sum = (rows: typeof byStudy.rows) =>
        rows.reduce((acc, r) => acc + (r.cells[column].value ?? 0), 0);
      expect(sum(byVendor.rows), id).toBe(total(id));
      expect(sum(byStudy.rows), id).toBe(total(id));
    });
  });

  it("totals the portfolio and names who is forecast to overrun", () => {
    const { reports, ...summary } = finance;
    expect(reports).toHaveLength(4);
    expect(summary).toEqual({
      budgetAtCompletionText: "$67,121,250",
      actualSpendText: "$46,506,401",
      forecastAtCompletionText: "$69,977,656",
      varianceAtCompletion: 2856406,
      varianceAtCompletionText: "$2,856,406",
      shareText: "104.3%",
      studyOverruns: [
        {
          name: "DEMO-302",
          variance: 4628681,
          varianceText: "$4,628,681",
          shareText: "115.4%",
        },
      ],
      // The CRO the generator plants over budget, which runs DEMO-302.
      vendorOverruns: [
        {
          name: "Quillfeather Clinical Research",
          variance: 4935420,
          varianceText: "$4,935,420",
          shareText: "129.4%",
        },
      ],
    });
  });

  it("labels a dollar axis compactly, so five labels fit a phone", () => {
    expect(finance.reports[0].scale?.ticks.map((t) => t.text)).toEqual([
      "$0",
      "$10M",
      "$20M",
      "$30M",
      "$40M",
    ]);
    // An axis under 10,000 keeps the metric's own format.
    expect(
      dashboard.benchmarks[0].report.scale?.ticks.map((t) => t.text)
    ).toEqual(["0", "50", "100", "150", "200"]);
  });

  it("orders overruns largest first", () => {
    // Every vendor of DEMO-201 runs 20% over budget from here on.
    const study = studies.find((s) => s.study_id === "DEMO-201")!;
    const w: Warehouse = {
      ...warehouse,
      tables: {
        ...warehouse.tables,
        "gold.fct_spend_forecast": warehouse.tables[
          "gold.fct_spend_forecast"
        ].map((r) =>
          r.study_key === study.study_key
            ? {
                ...r,
                forecast_at_completion_usd: Math.round(
                  Number(r.budget_at_completion_usd) * 1.2
                ),
                variance_at_completion_usd: Math.round(
                  Number(r.budget_at_completion_usd) * 0.2
                ),
              }
            : r
        ),
      },
    };
    expect(
      portfolioDashboard(w).finance.studyOverruns.map((o) => [
        o.name,
        o.shareText,
      ])
    ).toEqual([
      ["DEMO-302", "115.4%"],
      ["DEMO-201", "120.0%"],
    ]);
  });
});
