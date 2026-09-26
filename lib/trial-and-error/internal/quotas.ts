import type { Scenario } from "../types";

/** A quota raised for a post-marketing round, rounded up to the next 100. */
function raisedQuota(quota: number, factor: number): number {
  return Math.ceil((quota * factor) / 100) * 100;
}

/**
 * A scenario with every quota raised by `factor` (#1088). A staged Boss's
 * stages and an FDA Information Request's questions are raised one by one,
 * and the Blind's quota stays their sum.
 */
export function raiseQuotas(scenario: Scenario, factor: number): Scenario {
  const encounter = scenario.encounter;
  if (encounter?.kind === "DMC_DEFENSE") {
    const [open, closed] = encounter.stages.map((stage) => ({
      ...stage,
      quota: raisedQuota(stage.quota, factor),
    }));
    return {
      ...scenario,
      blind: { ...scenario.blind, quota: open.quota + closed.quota },
      encounter: { ...encounter, stages: [open, closed] },
    };
  }
  if (encounter?.kind === "FDA_IR") {
    const questions = encounter.questions.map((q) => ({
      ...q,
      quota: raisedQuota(q.quota, factor),
    }));
    return {
      ...scenario,
      blind: {
        ...scenario.blind,
        quota: questions.reduce((sum, q) => sum + q.quota, 0),
      },
      encounter: { ...encounter, questions },
    };
  }
  return {
    ...scenario,
    blind: {
      ...scenario.blind,
      quota: raisedQuota(scenario.blind.quota, factor),
    },
  };
}
