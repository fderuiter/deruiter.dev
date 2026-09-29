import { describe, it, expect } from "vitest";
import {
  createInitialScoreState,
  getNextShiftScoreState,
} from "@/lib/clinical-trial-chaos";

// #1325: phase 1 ended at 4,800 and phase 2 started at SCORE 0, so the
// campaign never showed a total and Best only reflected one phase.

describe("Clinical Chaos campaign score (#1325)", () => {
  const endOfPhase1 = {
    ...createInitialScoreState(),
    score: 4800,
    highScore: 3000,
    combo: 6,
    maxCombo: 9,
    multiplier: 3,
    subjectsSubmitted: 7,
    correctionsMade: 12,
    cleanSubmissions: 5,
    auditViolations: 2,
  };

  it("carries the score and tallies into the next campaign phase", () => {
    const next = getNextShiftScoreState(endOfPhase1, true, 3000);
    expect(next.score).toBe(4800);
    expect(next.subjectsSubmitted).toBe(7);
    expect(next.correctionsMade).toBe(12);
    expect(next.cleanSubmissions).toBe(5);
    expect(next.auditViolations).toBe(2);
    expect(next.maxCombo).toBe(9);
    expect(next.highScore).toBe(4800);
    // The streak itself restarts with the new phase.
    expect(next.combo).toBe(0);
    expect(next.multiplier).toBe(1);
  });

  it("starts phase 1 and endless runs fresh", () => {
    const next = getNextShiftScoreState(endOfPhase1, false, 3000);
    expect(next).toEqual({ ...createInitialScoreState(), highScore: 3000 });
  });
});
