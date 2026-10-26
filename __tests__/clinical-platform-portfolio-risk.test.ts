import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  PORTFOLIO_RISK_THRESHOLDS,
  assessStudyRisk,
  buildWarehouse,
  evaluateMetric,
  generatePortfolio,
  portfolioDashboard,
  portfolioRiskHeatmap,
  type PortfolioForecast,
  type PortfolioLane,
  type PortfolioRiskRating,
} from "@/lib/clinical-platform";

/**
 * The portfolio risk heatmap (#2914): every rating follows from a stated
 * rule over the dashboard's own inputs, with the thresholds from
 * `PORTFOLIO_RISK_THRESHOLDS` and the RBQM library.
 */

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dashboard = portfolioDashboard(warehouse);
const { rows, rules } = dashboard.risk;
const { schedule, budget } = PORTFOLIO_RISK_THRESHOLDS;

const ratings = (studyId: string) => {
  const row = rows.find((r) => r.studyId === studyId)!;
  return [row.schedule.rating, row.budget.rating, row.quality.rating];
};

describe("the risk heatmap (#2914)", () => {
  it("rates every study, in study order, on the seed", () => {
    expect(
      Object.fromEntries(rows.map((r) => [r.studyId, ratings(r.studyId)]))
    ).toEqual({
      "DEMO-101": ["green", "green", "green"],
      "DEMO-201": ["green", "green", "green"],
      "DEMO-202": ["green", "green", "green"],
      "DEMO-203": ["green", "green", "red"],
      "DEMO-301": ["green", "green", "green"],
      "DEMO-302": ["red", "red", "amber"],
      "DEV-401": ["green", "green", "green"],
      "DEV-402": ["red", "green", "green"],
    });
    expect(rows.map((r) => r.studyId)).toEqual(
      dashboard.swimlane.lanes.map((l) => l.studyId)
    );
  });

  it("rates budget from the two governed metrics against the thresholds", () => {
    const byStudy = (id: string) =>
      new Map(
        evaluateMetric(
          warehouse,
          METRIC_REGISTRY.find((m) => m.id === id)!,
          { dimensions: ["study"] }
        ).rows.map((r) => [r.dimensions.study, r.value])
      );
    const values = budget.metricIds.map(byStudy);
    for (const row of rows) {
      const worst = Math.max(...values.map((v) => Number(v.get(row.studyId))));
      const expected: PortfolioRiskRating =
        worst > budget.red ? "red" : worst > budget.amber ? "amber" : "green";
      expect(row.budget.rating, row.studyId).toBe(expected);
    }
    expect(rows.find((r) => r.studyId === "DEMO-302")!.budget.reason).toBe(
      "Budget burn vs plan is 115.4% and forecast against budget at completion is 115.4%."
    );
  });

  it("rates quality from the study's risk assessment: red on a breach, amber on any other signal", () => {
    for (const row of rows) {
      const assessment = assessStudyRisk(warehouse, row.studyId);
      const expected: PortfolioRiskRating = assessment.qtls.some(
        (q) => q.status === "breached"
      )
        ? "red"
        : assessment.log.length > 0
          ? "amber"
          : "green";
      expect(row.quality.rating, row.studyId).toBe(expected);
    }
    expect(rows.find((r) => r.studyId === "DEMO-203")!.quality.reason).toBe(
      "The quality tolerance limit on subjects who end the study early is breached. Also raised: 6 red key risk indicators."
    );
    expect(rows.find((r) => r.studyId === "DEMO-302")!.quality.reason).toBe(
      "Raised at the data cut: 2 sites flagged by central monitoring."
    );
  });

  it("rates schedule from the next milestone and, while enrolling, the forecast", () => {
    const late = rows.find((r) => r.studyId === "DEMO-302")!;
    expect(late.enrolling).toBe(true);
    expect(late.schedule.reason).toBe(
      "Last patient in is 108 days overdue against its plan of 2026-06-14. The forecast median for the last subject in is 2027-09-25."
    );
    const open = rows.find((r) => r.studyId === "DEV-402")!;
    expect(open.schedule.reason).toBe(
      "Enrollment complete is due 2026-12-13. Of the forecast runs, 0.2% enroll the last subject by then."
    );
    const done = rows.find((r) => r.studyId === "DEMO-101")!;
    expect(done.enrolling).toBe(false);
    expect(done.schedule.reason).toBe("Every milestone is reached.");
  });

  it("writes each column's rule from its thresholds", () => {
    expect(rules.map((r) => r.dimension)).toEqual([
      "schedule",
      "budget",
      "quality",
    ]);
    const [time, money] = rules;
    expect(time.green).toContain("at least 80% of forecast runs");
    expect(time.red).toContain("more than 30 days overdue");
    expect(money.amber).toBe("Either is above 105% and neither above 110%.");
    for (const rule of rules) {
      expect(rule.reason).toBe(PORTFOLIO_RISK_THRESHOLDS[rule.dimension].reason);
    }
  });
});

describe("the schedule rule at its thresholds (#2914)", () => {
  const lane = dashboard.swimlane.lanes.find((l) => l.studyId === "DEV-402")!;
  const forecast = dashboard.forecasts.find((f) => f.studyId === "DEV-402")!;
  const rate = (
    edit: { overdueDays?: number; chance?: number; passed?: boolean } = {}
  ) => {
    const next = lane.milestones.findIndex((m) => m.actual === null);
    const edited: PortfolioLane = {
      ...lane,
      milestones: lane.milestones.map((m, index) =>
        index === next && edit.overdueDays !== undefined
          ? { ...m, status: "overdue", overdueDays: edit.overdueDays }
          : m
      ),
    };
    const shown: PortfolioForecast = {
      ...forecast,
      planPassed: edit.passed ?? false,
      forecast: {
        ...forecast.forecast,
        probabilityByPlan: edit.chance ?? 0.9,
      },
    };
    return portfolioRiskHeatmap(
      warehouse,
      { ...dashboard.swimlane, lanes: [edited] },
      [shown]
    ).rows[0].schedule.rating;
  };

  it("turns amber below the amber chance and red below the red one", () => {
    expect(rate({ chance: schedule.chanceAmber })).toBe("green");
    expect(rate({ chance: schedule.chanceAmber - 0.0005 })).toBe("amber");
    expect(rate({ chance: schedule.chanceRed })).toBe("amber");
    expect(rate({ chance: schedule.chanceRed - 0.0005 })).toBe("red");
    expect(rate({ chance: 1, passed: true })).toBe("red");
  });

  it("turns amber on any overdue day and red past the overdue limit", () => {
    expect(rate()).toBe("green");
    expect(rate({ overdueDays: 1 })).toBe("amber");
    expect(rate({ overdueDays: schedule.overdueRedDays })).toBe("amber");
    expect(rate({ overdueDays: schedule.overdueRedDays + 1 })).toBe("red");
  });

  it("takes the worse of the milestone and the forecast", () => {
    expect(rate({ overdueDays: 5, chance: 0.1 })).toBe("red");
    expect(rate({ overdueDays: 45, chance: 0.95 })).toBe("red");
  });
});
