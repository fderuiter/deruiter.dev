/**
 * The portfolio risk heatmap (#2914): every study rated green, amber or
 * red on schedule, budget and quality, each by a rule whose thresholds are
 * stated here and written out on the page. Schedule reads the milestone
 * swimlane and the enrollment forecast, budget two governed finance
 * metrics, and quality the study's risk-based quality management
 * assessment from the operations Risk tab (#2631).
 *
 * The thresholds belong to the synthetic portfolio's fictional governance;
 * each states its reason rather than borrowing authority.
 */
import type {
  MetricDefinition,
  PortfolioForecast,
  PortfolioLane,
  PortfolioRiskCell,
  PortfolioRiskHeatmap,
  PortfolioRiskRating,
  PortfolioRiskRule,
  PortfolioSwimlane,
  Warehouse,
} from "../../types";
import { QTL_LIBRARY } from "../rbqm/library";
import { assessStudyRisk } from "../rbqm/assess";
import { evaluateMetric } from "../semantic/evaluate";
import { METRIC_REGISTRY } from "../semantic/registry";
import { formatMetricValue } from "./format";

/**
 * The heatmap's thresholds (#2914).
 *
 * - `schedule`: a study still enrolling turns amber when fewer than
 *   `chanceAmber` of its forecast runs meet the planned last subject in, and
 *   red below `chanceRed` or once the planned date has passed. Any study
 *   turns amber when its next milestone is overdue, and red when it is more
 *   than `overdueRedDays` overdue.
 * - `budget`: amber when either metric is above `amber`, red above `red`.
 * - `quality`: red when a quality tolerance limit is breached; amber when the
 *   assessment raised any other signal. The KRI thresholds and QTL limits
 *   are the RBQM library's.
 */
export const PORTFOLIO_RISK_THRESHOLDS = {
  schedule: {
    chanceAmber: 0.8,
    chanceRed: 0.5,
    overdueRedDays: 30,
    reason:
      "A portfolio plans on its studies finishing enrollment when they said they would. Below four runs in five the plan needs a contingency; below an even chance it needs a decision. A month overdue is past what a study team can recover without one.",
  },
  budget: {
    metricIds: ["budget_burn_vs_plan", "forecast_vs_budget_at_completion"],
    amber: 1.05,
    red: 1.1,
    reason:
      "Five percent over is inside what a change order or a reforecast usually absorbs; past ten percent the overrun needs the sponsor's approval.",
  },
  quality: {
    reason:
      "A breached quality tolerance limit puts the study's results at risk and has a planned response; any other signal raised is for the study team to review.",
  },
} as const;

const RULE_NAMES = {
  schedule: "Schedule",
  budget: "Budget",
  quality: "Quality",
} as const;

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

const SEVERITY: Readonly<Record<PortfolioRiskRating, number>> = {
  green: 0,
  amber: 1,
  red: 2,
};

function worst(
  ...ratings: readonly PortfolioRiskRating[]
): PortfolioRiskRating {
  return ratings.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "green");
}

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`no metric ${id}`);
  return found;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A name as it reads after the start of a sentence. */
function inSentence(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** A phrase as it reads at the start of a sentence. */
function upper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A list in words: "a", "a and b", "a, b and c". */
function list(items: readonly string[]): string {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Each column's rule in words, from the thresholds. */
function rules(): PortfolioRiskRule[] {
  const { schedule, budget } = PORTFOLIO_RISK_THRESHOLDS;
  const names = list(
    budget.metricIds.map((id, index) =>
      index === 0 ? metric(id).name : inSentence(metric(id).name)
    )
  );
  const share = (value: number) => percent.format(value);
  return [
    {
      dimension: "schedule",
      name: RULE_NAMES.schedule,
      reason: PORTFOLIO_RISK_THRESHOLDS.schedule.reason,
      green: `The next milestone is not overdue and, for a study still enrolling, at least ${percent.format(schedule.chanceAmber)} of forecast runs enroll the last subject by the planned date.`,
      amber: `The next milestone is overdue by up to ${plural(schedule.overdueRedDays, "day")}, or ${percent.format(schedule.chanceRed)} to ${percent.format(schedule.chanceAmber)} of forecast runs meet the planned date.`,
      red: `The next milestone is more than ${plural(schedule.overdueRedDays, "day")} overdue, fewer than ${percent.format(schedule.chanceRed)} of forecast runs meet the planned date, or the planned date has passed.`,
    },
    {
      dimension: "budget",
      name: RULE_NAMES.budget,
      reason: PORTFOLIO_RISK_THRESHOLDS.budget.reason,
      green: `${names} are both at or below ${share(budget.amber)}.`,
      amber: `Either is above ${share(budget.amber)} and neither above ${share(budget.red)}.`,
      red: `Either is above ${share(budget.red)}.`,
    },
    {
      dimension: "quality",
      name: RULE_NAMES.quality,
      reason: PORTFOLIO_RISK_THRESHOLDS.quality.reason,
      green:
        "The study's risk assessment raised no signal at the data cut: no red key risk indicator, no quality tolerance limit past its secondary limit and no site flagged by central monitoring.",
      amber:
        "The assessment raised a signal, but no quality tolerance limit is breached.",
      red: "A quality tolerance limit is breached.",
    },
  ];
}

function scheduleCell(
  lane: PortfolioLane,
  forecast: PortfolioForecast | undefined
): PortfolioRiskCell {
  const { chanceAmber, chanceRed, overdueRedDays } =
    PORTFOLIO_RISK_THRESHOLDS.schedule;
  const next = lane.milestones.find((m) => m.actual === null);
  const ratings: PortfolioRiskRating[] = [];
  const reasons: string[] = [];
  if (next === undefined) {
    reasons.push("Every milestone is reached.");
  } else if (next.overdueDays !== null) {
    ratings.push(next.overdueDays > overdueRedDays ? "red" : "amber");
    reasons.push(
      `${next.label} is ${plural(next.overdueDays, "day")} overdue against its plan of ${next.planned}.`
    );
  } else {
    reasons.push(`${next.label} is due ${next.planned}.`);
  }
  if (forecast !== undefined) {
    const { probabilityByPlan, plannedLastSubjectIn, quantiles } =
      forecast.forecast;
    // When the next milestone is the last subject in, its date is already said.
    const lastInNext = next?.kind === "last-subject-in";
    if (forecast.planPassed) {
      ratings.push("red");
      reasons.push(
        lastInNext
          ? `The forecast median for the last subject in is ${quantiles.p50}.`
          : `The planned last subject in, ${plannedLastSubjectIn}, has passed; the forecast median is ${quantiles.p50}.`
      );
    } else {
      ratings.push(
        probabilityByPlan < chanceRed
          ? "red"
          : probabilityByPlan < chanceAmber
            ? "amber"
            : "green"
      );
      reasons.push(
        `Of the forecast runs, ${forecast.probabilityText} enroll the last subject by ${lastInNext ? "then" : `the planned ${plannedLastSubjectIn}`}.`
      );
    }
  }
  return {
    dimension: "schedule",
    rating: worst(...ratings),
    reason: reasons.join(" "),
  };
}

function budgetCell(
  values: readonly { readonly id: string; readonly value: number | null }[]
): PortfolioRiskCell {
  const { amber, red } = PORTFOLIO_RISK_THRESHOLDS.budget;
  const known = values.filter(
    (v): v is { id: string; value: number } => v.value !== null
  );
  if (known.length === 0) {
    return {
      dimension: "budget",
      rating: "green",
      reason: "No spend or budget is booked yet to compare.",
    };
  }
  const rating = worst(
    ...known.map(({ value }): PortfolioRiskRating =>
      value > red ? "red" : value > amber ? "amber" : "green"
    )
  );
  const parts = known.map(
    ({ id, value }, index) =>
      `${index === 0 ? metric(id).name : inSentence(metric(id).name)} is ${formatMetricValue(metric(id), value)}`
  );
  return { dimension: "budget", rating, reason: `${list(parts)}.` };
}

function qualityCell(warehouse: Warehouse, studyId: string): PortfolioRiskCell {
  const assessment = assessStudyRisk(warehouse, studyId);
  const breached = assessment.qtls.filter((q) => q.status === "breached");
  const warnings = assessment.qtls.filter((q) => q.status === "warning");
  const redKris = assessment.kris.filter((k) => k.status === "red").length;
  const flaggedSites = new Set(
    assessment.csm.results.filter((r) => r.flagged).map((r) => r.siteId)
  ).size;
  const name = (qtlId: string) =>
    QTL_LIBRARY.find((q) => q.id === qtlId)?.name ?? qtlId;
  const limits = (assessed: readonly { qtlId: string }[]) =>
    `${assessed.length === 1 ? "the quality tolerance limit" : "the quality tolerance limits"} on ${list(assessed.map((q) => inSentence(name(q.qtlId))))}`;
  const raised = [
    ...(warnings.length > 0
      ? [`${limits(warnings)} past the secondary limit`]
      : []),
    ...(redKris > 0 ? [plural(redKris, "red key risk indicator")] : []),
    ...(flaggedSites > 0
      ? [`${plural(flaggedSites, "site")} flagged by central monitoring`]
      : []),
  ];
  if (breached.length > 0) {
    const others = raised.length > 0 ? ` Also raised: ${list(raised)}.` : "";
    return {
      dimension: "quality",
      rating: "red",
      reason: `${upper(limits(breached))} ${breached.length === 1 ? "is" : "are"} breached.${others}`,
    };
  }
  if (raised.length > 0) {
    return {
      dimension: "quality",
      rating: "amber",
      reason: `Raised at the data cut: ${list(raised)}.`,
    };
  }
  return {
    dimension: "quality",
    rating: "green",
    reason: "No signal raised at the data cut.",
  };
}

/**
 * The risk heatmap over one warehouse.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @param swimlane - The dashboard's milestone swimlane.
 * @param forecasts - The dashboard's baseline enrollment forecasts.
 * @returns Every study rated on schedule, budget and quality, with each column's rule.
 */
export function portfolioRiskHeatmap(
  warehouse: Warehouse,
  swimlane: PortfolioSwimlane,
  forecasts: readonly PortfolioForecast[]
): PortfolioRiskHeatmap {
  const { metricIds } = PORTFOLIO_RISK_THRESHOLDS.budget;
  const byStudy = metricIds.map((id) => {
    const values = new Map<string, number | null>();
    for (const row of evaluateMetric(warehouse, metric(id), {
      dimensions: ["study"],
    }).rows) {
      values.set(String(row.dimensions.study), row.value);
    }
    return { id, values };
  });
  return {
    rules: rules(),
    rows: swimlane.lanes.map((lane) => {
      const forecast = forecasts.find((f) => f.studyId === lane.studyId);
      return {
        studyId: lane.studyId,
        title: lane.title,
        enrolling: forecast !== undefined,
        schedule: scheduleCell(lane, forecast),
        budget: budgetCell(
          byStudy.map(({ id, values }) => ({
            id,
            value: values.get(lane.studyId) ?? null,
          }))
        ),
        quality: qualityCell(warehouse, lane.studyId),
      };
    }),
  };
}
