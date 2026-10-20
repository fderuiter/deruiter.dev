// @vitest-environment node
// #2159: score measures the work and the care, not the time spent.
import { describe, it, expect } from "vitest";
import {
  activeCodeBurst,
  computeParBonus,
  createInitialDuckGameState,
  PAR_POINTS_PER_SECOND,
  SPRINTS,
  stepDuckGame,
  WORK_UNIT_POINTS,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

function running(level = 1): WorkingWithDuckState {
  return { ...createInitialDuckGameState(level), status: "running" };
}

describe("Working With Duck scoring (#2159)", () => {
  it("pays a coding burst the same per work unit as passive work", () => {
    const before = running();
    const burst = activeCodeBurst(before);
    const burstWork = burst.workProgress - before.workProgress;
    const burstPoints = burst.totalScore - before.totalScore;
    expect(burstWork).toBeGreaterThan(0);
    expect(burstPoints).toBe(Math.round(burstWork * WORK_UNIT_POINTS));

    // Passive work over a second of calm play pays the same rate, give or
    // take the per-tick rounding.
    let passive = running();
    for (let i = 0; i < 60; i++) passive = stepDuckGame(passive);
    const perUnit = passive.totalScore / passive.workProgress;
    expect(perUnit).toBeGreaterThan(WORK_UNIT_POINTS * 0.8);
    expect(perUnit).toBeLessThan(WORK_UNIT_POINTS * 1.2);
  });

  it("gives a par bonus for each whole second under par, none over it", () => {
    const par = SPRINTS[0].parSeconds;
    const fast = { ...running(1), ticks: (par - 10) * 60 };
    expect(computeParBonus(fast)).toBe(10 * PAR_POINTS_PER_SECOND);
    const onPar = { ...running(1), ticks: par * 60 };
    expect(computeParBonus(onPar)).toBe(0);
    const slow = { ...running(1), ticks: (par + 30) * 60 };
    expect(computeParBonus(slow)).toBe(0);
  });

  it("adds the par bonus to the score when a sprint ships", () => {
    const par = SPRINTS[0].parSeconds;
    const almost: WorkingWithDuckState = {
      ...running(1),
      ticks: (par - 20) * 60,
      workProgress: SPRINTS[0].targetWork - 0.01,
      totalScore: 1000,
    };
    const won = stepDuckGame(almost);
    expect(won.status).toBe("won");
    expect(won.sprintParBonus).toBe(20 * PAR_POINTS_PER_SECOND);
    expect(won.totalScore).toBeGreaterThanOrEqual(
      1000 + 250 + 20 * PAR_POINTS_PER_SECOND
    );
  });

  it("gives endless no par bonus", () => {
    const endless = {
      ...createInitialDuckGameState(5, "endless"),
      status: "running" as const,
    };
    expect(stepDuckGame(endless).sprintParBonus ?? 0).toBe(0);
  });
});
