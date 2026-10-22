import type {
  StrategyScenario,
  StrategyScore,
  StrategyCashFlow,
  RoadmapItem,
  StrategyMemo,
} from "../../types";
import { SYNTHETIC_DATA_NOTICE } from "../../presets";

const bound = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;
const finite = (value: number) => (Number.isFinite(value) ? value : 0);

/** Normalize nonnegative weights; an all-zero matrix has no ranking. */
export function scoreVendors(scenario: StrategyScenario): StrategyScore[] {
  const weightSum = scenario.criteria.reduce(
    (sum, criterion) => sum + Math.max(0, finite(criterion.weight)),
    0
  );
  return scenario.vendors
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      score:
        weightSum === 0
          ? null
          : scenario.criteria.reduce((sum, criterion) => {
              const rating = bound(
                finite(vendor.ratings[criterion.id] ?? 0),
                0,
                5
              );
              return sum + Math.max(0, finite(criterion.weight)) * rating;
            }, 0) / weightSum,
    }))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name)
    );
}

/** Vary one weight at a time while leaving all other weights fixed. */
export function sensitivity(scenario: StrategyScenario, fraction = 0.25) {
  const baseWinner = scoreVendors(scenario)[0]?.id ?? null;
  return scenario.criteria.flatMap((criterion) =>
    [
      {
        label: `${criterion.label} −${Math.round(fraction * 100)}%`,
        factor: 1 - fraction,
      },
      {
        label: `${criterion.label} +${Math.round(fraction * 100)}%`,
        factor: 1 + fraction,
      },
    ].map(({ label, factor }) => {
      const changed = {
        ...scenario,
        criteria: scenario.criteria.map((item) =>
          item.id === criterion.id
            ? { ...item, weight: Math.max(0, item.weight * factor) }
            : item
        ),
      };
      const winner = scoreVendors(changed)[0];
      return {
        label,
        winner: winner?.score === null ? null : (winner?.name ?? null),
        changed: winner?.score !== null && winner?.id !== baseWinner,
      };
    })
  );
}

export function cashFlow(input: StrategyCashFlow) {
  const discount = Math.max(0, finite(input.discountRate)) / 100;
  const annual = Array.from({ length: 5 }, (_, index) => {
    const year = index + 1;
    const benefit =
      finite(input.annualBenefit) + finite(input.decommissionSavings);
    const cost = finite(input.annualLicense) + finite(input.annualRun);
    return {
      year,
      benefit,
      cost,
      net: benefit - cost,
      discounted: (benefit - cost) / (1 + discount) ** year,
    };
  });
  const upfront = finite(input.implementation) + finite(input.validation);
  const totalBenefit = annual.reduce((sum, row) => sum + row.benefit, 0);
  const totalCost = upfront + annual.reduce((sum, row) => sum + row.cost, 0);
  return {
    annual,
    totalCost,
    npv: -upfront + annual.reduce((sum, row) => sum + row.discounted, 0),
    roi:
      totalCost === 0 ? null : ((totalBenefit - totalCost) / totalCost) * 100,
  };
}

/** Rank NPV impact of a 20% change to each financial assumption. */
export function tornado(input: StrategyCashFlow) {
  const baseline = cashFlow(input).npv;
  const keys = [
    "implementation",
    "validation",
    "annualLicense",
    "annualRun",
    "annualBenefit",
    "decommissionSavings",
  ] as const;
  return keys
    .map((key) => ({
      label: key.replace(/([A-Z])/g, " $1").toLowerCase(),
      impact: cashFlow({ ...input, [key]: input[key] * 1.2 }).npv - baseline,
    }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

/** Ready items respect dependencies and the capacity budget in each horizon. */
export function planRoadmap(items: readonly RoadmapItem[], capacity: number) {
  const scheduled = new Map<string, string>();
  const remaining = [...items];
  const horizons = ["Now", "Next", "Later"] as const;
  const result: { horizon: string; items: RoadmapItem[]; used: number }[] = [];
  for (const horizon of horizons) {
    let used = 0;
    const chosen: RoadmapItem[] = [];
    for (const item of [...remaining]) {
      if (
        item.effort + used > capacity ||
        !item.dependsOn.every((id) => scheduled.has(id))
      )
        continue;
      chosen.push(item);
      used += item.effort;
      scheduled.set(item.id, horizon);
      remaining.splice(remaining.indexOf(item), 1);
    }
    result.push({ horizon, items: chosen, used });
  }
  return { horizons: result, blocked: remaining };
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char
  );
const clean = (value: string) => value.replace(/[\r\n#*_<>]/g, " ").trim();

export function decisionMemo(memo: StrategyMemo, format: "html" | "markdown") {
  const fields = [
    ["Context", memo.context],
    ["Options", memo.options],
    ["Criteria", memo.criteria],
    ["Recommendation", memo.recommendation],
    ["Risks", memo.risks],
  ];
  if (format === "markdown")
    return `# Synthetic platform decision memo\n\n${SYNTHETIC_DATA_NOTICE}\n\n${fields.map(([label, value]) => `## ${label}\n\n${clean(value)}\n`).join("\n")}`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic platform decision memo</title><style>body{font:16px/1.5 system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111}h1,h2{line-height:1.2}@media print{body{margin:0;font-size:12px}h2{break-after:avoid}}</style><main><h1>Synthetic platform decision memo</h1><p>${escapeHtml(SYNTHETIC_DATA_NOTICE)}</p>${fields.map(([label, value]) => `<section><h2>${label}</h2><p>${escapeHtml(value)}</p></section>`).join("")}</main></html>`;
}
