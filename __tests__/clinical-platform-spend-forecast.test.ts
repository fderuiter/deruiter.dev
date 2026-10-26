import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_GAPS,
  METRIC_REGISTRY,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  checkWarehouse,
  evaluateMetric,
  generatePortfolio,
  type FinancePlanLine,
  type Portfolio,
  type Warehouse,
} from "@/lib/clinical-platform";

/**
 * The budget plan and the forecast at completion (#2912): the plan the
 * generator draws, `gold.fct_spend_forecast` built from it, and the
 * metrics that read it.
 */

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
const warehouse = buildWarehouse(portfolio);
const { finance, financePlan, ctms } = portfolio.feeds;

const metric = (id: string) => {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`no metric ${id}`);
  return found;
};

const studyIds = new Map(
  warehouse.tables["gold.dim_study"].map((s) => [s.study_key, s.study_id])
);
/** Vendor id by key; investigator grants (key 0) have none. */
const vendorIds = new Map(
  warehouse.tables["gold.dim_vendor"].map((v) => [
    v.vendor_key,
    v.vendor_key === 0 ? null : v.vendor_id,
  ])
);

/** The forecast row of a study and vendor, by their ids. */
function forecastOf(w: Warehouse, studyId: string, vendorId: string | null) {
  const studies = new Map(
    w.tables["gold.dim_study"].map((s) => [s.study_id, s.study_key])
  );
  const vendors = new Map(
    w.tables["gold.dim_vendor"].map((v) => [v.vendor_id, v.vendor_key])
  );
  return w.tables["gold.fct_spend_forecast"].find(
    (r) =>
      r.study_key === studies.get(studyId) &&
      r.vendor_key === (vendorId === null ? 0 : vendors.get(vendorId))
  );
}

/** The portfolio with its finance feeds replaced. */
function withFinance(
  edit: (feeds: Portfolio["feeds"]) => Partial<Portfolio["feeds"]>
): Warehouse {
  return buildWarehouse({
    ...portfolio,
    feeds: { ...portfolio.feeds, ...edit(portfolio.feeds) },
  });
}

const plannedReport = (studyId: string) =>
  ctms.milestones.find(
    (m) => m.studyId === studyId && m.kind === "final-report"
  )!.plannedOn;

/** `2026-Q3` as its first day. */
const quarterStart = (period: string) =>
  `${period.slice(0, 4)}-${String((Number(period.slice(6)) - 1) * 3 + 1).padStart(2, "0")}-01`;

describe("the budget plan (#2912)", () => {
  it("covers every quarter of every cost category from the start to the planned final report", () => {
    for (const study of portfolio.studies) {
      const lines = financePlan.filter((l) => l.studyId === study.id);
      const categories = [
        ...new Set(
          finance.filter((l) => l.studyId === study.id).map((l) => l.category)
        ),
      ];
      expect(new Set(lines.map((l) => l.category))).toEqual(
        new Set(categories)
      );
      for (const category of categories) {
        const periods = lines
          .filter((l) => l.category === category)
          .map((l) => l.period);
        expect(periods).toEqual([...periods].sort());
        expect(new Set(periods).size).toBe(periods.length);
        expect(quarterStart(periods[0]) <= study.startOn).toBe(true);
        const last = quarterStart(periods[periods.length - 1]);
        expect(last <= plannedReport(study.id), study.id).toBe(true);
        // The quarter after the last one starts after the planned report.
        const next = new Date(`${last}T00:00:00Z`);
        next.setUTCMonth(next.getUTCMonth() + 3);
        expect(next.toISOString().slice(0, 10) > plannedReport(study.id)).toBe(
          true
        );
      }
    }
  });

  it("plans the same budget a quarter books, and the same vendor", () => {
    const plan = new Map(
      financePlan.map((l) => [`${l.studyId}|${l.category}|${l.period}`, l])
    );
    for (const line of finance) {
      const planned = plan.get(
        `${line.studyId}|${line.category}|${line.period}`
      );
      // A quarter booked only because a final report came late lies after
      // the planned report, so the plan has no line for it.
      if (planned === undefined) {
        expect(quarterStart(line.period) > plannedReport(line.studyId)).toBe(
          true
        );
        continue;
      }
      expect(planned.budgetUsd).toBe(line.budgetUsd);
      expect(planned.vendorId).toBe(line.vendorId);
    }
  });
});

describe("gold.fct_spend_forecast (#2912)", () => {
  const rows = warehouse.tables["gold.fct_spend_forecast"];

  it("passes every warehouse check", () => {
    expect(checkWarehouse(WAREHOUSE_SCHEMA, warehouse)).toEqual([]);
  });

  it("books to date exactly what gold.fct_spend holds, study by study and vendor by vendor", () => {
    const spend = new Map<string, { budget: number; actual: number }>();
    for (const r of warehouse.tables["gold.fct_spend"]) {
      const id = `${r.study_key}|${r.vendor_key}`;
      const sum = spend.get(id) ?? { budget: 0, actual: 0 };
      sum.budget += Number(r.budget_usd);
      sum.actual += Number(r.actual_usd);
      spend.set(id, sum);
    }
    expect(rows).toHaveLength(spend.size);
    for (const r of rows) {
      const booked = spend.get(`${r.study_key}|${r.vendor_key}`);
      expect(r.budget_to_date_usd).toBe(booked?.budget);
      expect(r.actual_to_date_usd).toBe(booked?.actual);
    }
  });

  it("forecasts each vendor's remaining budget at its own spend-to-budget ratio", () => {
    for (const r of rows) {
      const budget = Number(r.budget_to_date_usd);
      const actual = Number(r.actual_to_date_usd);
      const remaining = Number(r.remaining_budget_usd);
      const studyId = String(studyIds.get(r.study_key));
      const vendorId = vendorIds.get(r.vendor_key) ?? null;
      const planned = financePlan
        .filter(
          (l: FinancePlanLine) =>
            l.studyId === studyId &&
            l.vendorId === vendorId &&
            quarterStart(l.period) > warehouse.asOf
        )
        .reduce((sum, l) => sum + l.budgetUsd, 0);
      const reported = ctms.milestones.some(
        (m) =>
          m.studyId === studyId &&
          m.kind === "final-report" &&
          m.actualOn !== null
      );
      expect(remaining, `${studyId} ${vendorId}`).toBe(reported ? 0 : planned);
      expect(r.as_of_date_key).toBe(Number(warehouse.asOf.replaceAll("-", "")));
      expect(r.budget_at_completion_usd).toBe(budget + remaining);
      expect(r.forecast_at_completion_usd).toBe(
        actual + Math.round((remaining * actual) / budget)
      );
      expect(r.variance_at_completion_usd).toBe(
        Number(r.forecast_at_completion_usd) -
          Number(r.budget_at_completion_usd)
      );
    }
  });

  it("forecasts the largest overrun for the vendor the generator plants over budget", () => {
    const over = portfolio.signals.find((s) => s.kind === "vendor-over-budget");
    const [largest, next] = [...rows].sort(
      (a, b) =>
        Number(b.variance_at_completion_usd) -
        Number(a.variance_at_completion_usd)
    );
    expect(
      `${studyIds.get(largest.study_key)} ${vendorIds.get(largest.vendor_key)}`
    ).toBe(`DEMO-302 ${over?.vendorId}`);
    // Other vendors drift a little either way; none comes close.
    expect(Number(largest.variance_at_completion_usd)).toBeGreaterThan(
      10 * Number(next.variance_at_completion_usd)
    );
  });

  it("forecasts nothing more once the final report is in, whatever the plan still holds", () => {
    // DEMO-101 issued its final report on 2026-03-22. A plan quarter left
    // after the data cut does not reopen it.
    const extra: FinancePlanLine = {
      ...financePlan.find((l) => l.studyId === "DEMO-101")!,
      period: "2027-Q1",
    };
    const w = withFinance((feeds) => ({
      financePlan: [...feeds.financePlan, extra],
    }));
    expect(forecastOf(w, "DEMO-101", extra.vendorId)).toMatchObject({
      remaining_budget_usd: 0,
    });
  });

  it("forecasts the remaining budget as planned for a vendor with nothing booked yet", () => {
    // A vendor contracted for later quarters only: no ratio to date to scale by.
    const target = financePlan.find(
      (l) => l.studyId === "DEV-402" && l.vendorId === "VEN-IRT-01"
    )!;
    const w = withFinance((feeds) => ({
      finance: feeds.finance.filter(
        (l) => !(l.studyId === "DEV-402" && l.vendorId === "VEN-IRT-01")
      ),
    }));
    const row = forecastOf(w, "DEV-402", target.vendorId);
    expect(row).toMatchObject({ budget_to_date_usd: 0, actual_to_date_usd: 0 });
    expect(Number(row?.remaining_budget_usd)).toBeGreaterThan(0);
    expect(row?.forecast_at_completion_usd).toBe(row?.remaining_budget_usd);
    expect(row?.variance_at_completion_usd).toBe(0);
  });
});

describe("the at-completion metrics (#2912)", () => {
  const byStudy = (id: string, w: Warehouse = warehouse) =>
    Object.fromEntries(
      evaluateMetric(w, metric(id), { dimensions: ["study"] }).rows.map((r) => [
        r.dimensions.study,
        r.value,
      ])
    );

  it("add up from the vendors to each study", () => {
    for (const id of [
      "budget_at_completion",
      "forecast_at_completion",
      "variance_at_completion",
    ]) {
      const sums: Record<string, number> = {};
      for (const row of evaluateMetric(warehouse, metric(id), {
        dimensions: ["study", "vendor"],
      }).rows) {
        const study = String(row.dimensions.study);
        sums[study] = (sums[study] ?? 0) + (row.value ?? 0);
      }
      expect(sums, id).toEqual(byStudy(id));
    }
  });

  it("read the same actual spend to date as the forecast", () => {
    const actual = byStudy("actual_spend");
    for (const [study, value] of Object.entries(
      byStudy("forecast_at_completion")
    )) {
      const remaining = warehouse.tables["gold.fct_spend_forecast"]
        .filter((r) => studyIds.get(r.study_key) === study)
        .reduce((sum, r) => sum + Number(r.remaining_budget_usd), 0);
      // With nothing left to forecast, the forecast is what was spent.
      if (remaining === 0) expect(value).toBe(actual[study]);
      else expect(Number(value)).toBeGreaterThan(Number(actual[study]));
    }
  });

  it("give the forecast as a share of the budget at completion", () => {
    const budget = byStudy("budget_at_completion");
    const forecast = byStudy("forecast_at_completion");
    for (const [study, share] of Object.entries(
      byStudy("forecast_vs_budget_at_completion")
    )) {
      expect(share).toBeCloseTo(
        Number(forecast[study]) / Number(budget[study]),
        12
      );
    }
  });

  it("no longer list forecast at completion as a gap", () => {
    expect(METRIC_GAPS.map((g) => g.name)).not.toContain(
      "Forecast at completion"
    );
  });
});
