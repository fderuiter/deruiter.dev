import { describe, expect, it } from "vitest";
import {
  cashFlow,
  decisionMemo,
  planRoadmap,
  scoreVendors,
  sensitivity,
  tornado,
} from "@/lib/clinical-platform";
import type { StrategyScenario } from "@/lib/clinical-platform";

const scenario: StrategyScenario = {
  criteria: [
    { id: "fit", label: "Fit", group: "Capability", weight: 3 },
    { id: "cost", label: "Cost", group: "Economics", weight: 1 },
  ],
  vendors: [
    { id: "a", name: "Fictional A", ratings: { fit: 5, cost: 1 } },
    { id: "b", name: "Fictional B", ratings: { fit: 2, cost: 5 } },
  ],
};

describe("strategy calculations", () => {
  it("normalizes weighted scores and exposes changes when weights move", () => {
    expect(scoreVendors(scenario)[0]).toMatchObject({ id: "a", score: 4 });
    const balanced = {
      ...scenario,
      criteria: scenario.criteria.map((c) => ({ ...c, weight: 1 })),
    };
    expect(scoreVendors(balanced)[0]?.id).toBe("b");
    expect(
      sensitivity(
        {
          ...scenario,
          criteria: [
            { ...scenario.criteria[0], weight: 1.5 },
            scenario.criteria[1],
          ],
        },
        1
      )
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ changed: true })])
    );
  });
  it("does not invent a winner when all weights are zero", () => {
    const empty = {
      ...scenario,
      criteria: scenario.criteria.map((c) => ({ ...c, weight: 0 })),
    };
    expect(scoreVendors(empty).every((v) => v.score === null)).toBe(true);
    expect(sensitivity(empty).every((v) => v.winner === null)).toBe(true);
  });
  it("keeps negative annual flows and a negative NPV", () => {
    const input = {
      implementation: 100,
      validation: 20,
      annualLicense: 40,
      annualRun: 30,
      annualBenefit: 20,
      decommissionSavings: 0,
      discountRate: 10,
    };
    const result = cashFlow(input);
    expect(result.annual).toHaveLength(5);
    expect(result.annual[0]?.net).toBe(-50);
    expect(result.npv).toBeLessThan(-300);
    expect(result.totalCost).toBe(470);
    expect(tornado(input)[0]?.label).toBeDefined();
  });
  it("handles zero cost without dividing by zero", () => {
    expect(
      cashFlow({
        implementation: 0,
        validation: 0,
        annualLicense: 0,
        annualRun: 0,
        annualBenefit: 10,
        decommissionSavings: 0,
        discountRate: 0,
      }).roi
    ).toBeNull();
  });
  it("respects roadmap dependencies and reports items that cannot fit", () => {
    const items = [
      { id: "a", label: "A", capability: "Data", effort: 2, dependsOn: [] },
      {
        id: "b",
        label: "B",
        capability: "Analytics",
        effort: 2,
        dependsOn: ["a"],
      },
    ];
    expect(
      planRoadmap(items, 2).horizons.map((h) => h.items.map((i) => i.id))
    ).toEqual([["a"], ["b"], []]);
    expect(planRoadmap(items, 1).blocked).toHaveLength(2);
  });
  it("escapes HTML and labels both memo formats as synthetic", () => {
    const memo = {
      context: "<script>alert(1)</script>",
      options: "A",
      criteria: "B",
      recommendation: "C",
      risks: "D",
    };
    expect(decisionMemo(memo, "html")).toContain("&lt;script&gt;");
    expect(decisionMemo(memo, "markdown")).toContain("Synthetic data");
  });
});
