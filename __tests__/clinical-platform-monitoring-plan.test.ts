import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_GAPS,
  METRIC_REGISTRY,
  buildWarehouse,
  evaluateMetric,
  generatePortfolio,
  type MetricExpression,
  type MetricFormula,
  type MetricPredicate,
  type WarehouseRow,
} from "@/lib/clinical-platform";

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
const warehouse = buildWarehouse(portfolio);
const gold = (table: string) => warehouse.tables[`gold.${table}`];
const metric = (id: string) => METRIC_REGISTRY.find((m) => m.id === id)!;

/** ISO 8601 date of a `YYYYMMDD` date key. */
function iso(key: unknown): string {
  const text = String(key);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

/** `YYYYMMDD` key of a date some days after another key. */
function plus(key: unknown, days: number): number {
  const date = new Date(`${iso(key)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return Number(date.toISOString().slice(0, 10).replaceAll("-", ""));
}

function daysFrom(from: unknown, to: unknown): number {
  return (
    (Date.parse(`${iso(to)}T00:00:00Z`) -
      Date.parse(`${iso(from)}T00:00:00Z`)) /
    86_400_000
  );
}

const studyById = new Map(gold("dim_study").map((s) => [s.study_id, s]));
const planByStudy = new Map(
  gold("dim_monitoring_plan").map((p) => [p.study_id, p])
);
const planByKey = new Map(
  gold("dim_monitoring_plan").map((p) => [p.monitoring_plan_key, p])
);
const studyIdByKey = new Map(
  gold("dim_study").map((s) => [s.study_key, String(s.study_id)])
);

/** Values of a metric per study, for the studies that have a row. */
function byStudy(id: string): Record<string, number | null> {
  return Object.fromEntries(
    evaluateMetric(warehouse, metric(id), { dimensions: ["study"] }).rows.map(
      (row) => [row.dimensions.study, row.value]
    )
  );
}

describe("the monitoring plan (#2736)", () => {
  it("gives every study one plan, in force before its first site initiation", () => {
    const plans = portfolio.feeds.ctms.monitoringPlans;
    expect(plans.map((p) => p.studyId)).toEqual(
      portfolio.studies.map((s) => s.id)
    );
    const firstInitiation = new Map<string, string>();
    for (const visit of portfolio.feeds.ctms.monitoringVisits) {
      if (visit.type !== "SIV") continue;
      const known = firstInitiation.get(visit.studyId);
      if (known === undefined || visit.visitDate < known) {
        firstInitiation.set(visit.studyId, visit.visitDate);
      }
    }
    for (const plan of plans) {
      expect(plan.synthetic).toBe(true);
      expect(plan.source).toBe("CTMS");
      const first = firstInitiation.get(plan.studyId);
      if (first !== undefined) {
        expect(plan.effectiveOn <= first, plan.studyId).toBe(true);
      }
    }
  });

  it("sets the report deadline by who runs the study", () => {
    for (const plan of portfolio.feeds.ctms.monitoringPlans) {
      const study = studyById.get(plan.studyId)!;
      expect(plan.reportDueDays, plan.studyId).toBe(
        study.operating_model === "cro" ? 15 : 20
      );
    }
    expect(
      Object.fromEntries(
        gold("dim_monitoring_plan").map((p) => [
          p.study_id,
          `${p.interim_interval_days}+${p.visit_window_days}`,
        ])
      )
    ).toEqual({
      "DEMO-101": "28+7",
      "DEMO-201": "56+14",
      "DEMO-202": "56+14",
      "DEMO-203": "56+14",
      "DEMO-301": "42+14",
      "DEMO-302": "42+14",
      "DEV-401": "56+14",
      "DEV-402": "42+7",
    });
  });

  it("dates each visit report's deadline from the plan in force", () => {
    for (const visit of gold("fct_monitoring_visit")) {
      const plan = planByKey.get(visit.monitoring_plan_key)!;
      expect(plan.study_id).toBe(studyIdByKey.get(visit.study_key));
      expect(visit.report_due_date_key).toBe(
        plus(visit.visit_date_key, Number(plan.report_due_days))
      );
    }
  });
});

describe("planned interim monitoring visits (#2736)", () => {
  const planned = gold("fct_planned_monitoring_visit");
  const visits = new Map(
    gold("fct_monitoring_visit").map((v) => [v.monitoring_visit_id, v])
  );
  const bySite = new Map<string, WarehouseRow[]>();
  for (const row of planned) {
    const site = String(row.planned_visit_id).replace(/-PV\d+$/, "");
    bySite.set(site, [...(bySite.get(site) ?? []), row]);
  }

  it("meets every interim visit made with exactly one planned visit", () => {
    const met = planned
      .map((p) => p.monitoring_visit_id)
      .filter((id) => id !== null);
    const interim = gold("fct_monitoring_visit")
      .filter((v) => v.visit_type === "IMV")
      .map((v) => v.monitoring_visit_id);
    expect([...met].sort()).toEqual([...interim].sort());
    expect(new Set(met).size).toBe(met.length);
  });

  it("plans each visit the plan's interval after the previous one, due when the window closes", () => {
    for (const [site, rows] of bySite) {
      const siteVisits = gold("fct_monitoring_visit")
        .filter((v) => String(v.monitoring_visit_id).startsWith(`${site}-MV`))
        .sort((a, b) => Number(a.visit_date_key) - Number(b.visit_date_key));
      let previous = siteVisits.find(
        (v) => v.visit_type === "SIV"
      )!.visit_date_key;
      for (const row of rows) {
        const plan = planByKey.get(row.monitoring_plan_key)!;
        expect(row.planned_date_key, String(row.planned_visit_id)).toBe(
          plus(previous, Number(plan.interim_interval_days))
        );
        expect(row.due_date_key).toBe(
          plus(row.planned_date_key, Number(plan.visit_window_days))
        );
        if (row.actual_date_key === null) {
          expect(row.days_late).toBeNull();
          expect(row).toBe(rows.at(-1));
          continue;
        }
        const visit = visits.get(row.monitoring_visit_id)!;
        expect(row.actual_date_key).toBe(visit.visit_date_key);
        expect(row.days_late).toBe(
          Math.max(0, daysFrom(row.due_date_key, row.actual_date_key))
        );
        previous = row.actual_date_key;
      }
    }
  });

  it("leaves a next visit outstanding only where monitoring goes on", () => {
    const closedOut = new Set(
      gold("fct_monitoring_visit")
        .filter((v) => v.visit_type === "COV")
        .map((v) => String(v.monitoring_visit_id).replace(/-MV\d+$/, ""))
    );
    const lastVisitDone = new Set(
      portfolio.feeds.ctms.milestones
        .filter((m) => m.kind === "last-subject-last-visit" && m.actualOn)
        .map((m) => m.studyId)
    );
    for (const [site, rows] of bySite) {
      const study = studyIdByKey.get(rows[0].study_key)!;
      const outstanding = rows.filter((r) => r.actual_date_key === null);
      const monitored = !closedOut.has(site) && !lastVisitDone.has(study);
      expect(outstanding.length, site).toBe(monitored ? 1 : 0);
    }
  });
});

describe("the monitoring metrics (#2736)", () => {
  it("certifies the reports metric at 2.0.0, reading its deadline from the plan", () => {
    const reports = metric("monitoring_reports_overdue");
    expect(reports.status).toBe("certified");
    expect(reports.version).toBe("2.0.0");
    expect(reports.changeLog.map((c) => c.version)).toEqual(["1.0.0", "2.0.0"]);
    const lock = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "__tests__/fixtures/clinical-platform/metric-registry.lock.json"
        ),
        "utf8"
      )
    ) as {
      releases: { id: string; version: string; status: string }[];
    };
    expect(
      lock.releases
        .filter((m) => m.id === "monitoring_reports_overdue")
        .map((m) => `${m.version} ${m.status}`)
    ).toEqual(["1.0.0 draft", "2.0.0 certified"]);
  });

  it("adds overdue interim visits and drops the gap it closes", () => {
    const visitsOverdue = metric("monitoring_visits_overdue");
    expect(visitsOverdue.status).toBe("certified");
    expect(visitsOverdue.changeLog[0].summary).toContain("#2736");
    expect(METRIC_GAPS.map((g) => g.name)).not.toContain(
      "Monitoring visits overdue against the monitoring plan"
    );
  });

  it("keeps no literal deadline anywhere in the registry", () => {
    const literals = (formula: MetricFormula): MetricPredicate[] => {
      switch (formula.kind) {
        case "simple":
          return [...formula.measure.where];
        case "ratio":
          return [...formula.numerator.where, ...formula.denominator.where];
        default:
          return [];
      }
    };
    const isSpan = (e: MetricExpression) => e.kind === "days-between";
    for (const m of METRIC_REGISTRY) {
      for (const p of literals(m.formula)) {
        if (p.kind !== "compare") continue;
        for (const [span, other] of [
          [p.left, p.right],
          [p.right, p.left],
        ] as const) {
          if (isSpan(span) && other.kind === "literal") {
            expect(other.value, `${m.id} compares a span with a literal`).toBe(
              0
            );
          }
        }
      }
    }
  });

  it("counts overdue reports and visits per study on the default seed", () => {
    // Groups with no matching row are absent, not zero.
    expect(byStudy("monitoring_reports_overdue")).toEqual({
      "DEMO-302": 1,
      "DEV-402": 1,
    });
    expect(byStudy("monitoring_visits_overdue")).toEqual({
      "DEMO-302": 1,
      "DEV-402": 4,
    });
  });

  it("finds an overdue visit only once its window closed before the data cut", () => {
    const cut = Number(warehouse.asOf.replaceAll("-", ""));
    const overdue = gold("fct_planned_monitoring_visit").filter(
      (r) => r.actual_date_key === null && Number(r.due_date_key) < cut
    );
    const ongoing = overdue.filter(
      (r) =>
        studyById.get(studyIdByKey.get(r.study_key)!)?.study_status !== "closed"
    );
    expect(ongoing).toHaveLength(5);
    for (const row of ongoing) {
      expect(planByStudy.has(studyIdByKey.get(row.study_key)!)).toBe(true);
    }
  });
});
