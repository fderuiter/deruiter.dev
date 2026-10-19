// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateGoodBoyMultiplier,
  createInitialDuckGameState,
  giveTreat,
} from "@/lib/working-with-duck-engine";

// #2529: pins the treat and Good Boy scoring rules the weekly Stryker run
// found unasserted: exact boundaries, deltas and clamps.

function running(
  overrides: Partial<ReturnType<typeof createInitialDuckGameState>> = {}
) {
  return {
    ...createInitialDuckGameState(1, "campaign"),
    status: "running" as const,
    ...overrides,
  };
}

function trading(
  overrides: Partial<ReturnType<typeof createInitialDuckGameState>> = {}
) {
  const state = running(overrides);
  return { ...state, duck: { ...state.duck, state: "NO_TAKE_THROW" as const } };
}

describe("calculateGoodBoyMultiplier boundaries (#2529)", () => {
  it.each([
    [80, 2.5],
    [79, 2.0],
    [50, 2.0],
    [20, 1.5],
    [19, 1.2],
    [0, 1.2],
    [-1, 1.0],
    [-40, 1.0],
    [-41, 0.7],
  ])("scale %i gives ×%f", (scale, multiplier) => {
    expect(calculateGoodBoyMultiplier(scale)).toBe(multiplier);
  });
});

describe("giveTreat (#2529)", () => {
  it("trades a treat for the ball with exact scale and excitement deltas", () => {
    const before = trading({ naughtyVsGood: 30, excitement: 40 });
    const after = giveTreat(before);
    expect(after.naughtyVsGood).toBe(55);
    expect(after.excitement).toBe(30);
    expect(after.comboTimer).toBe(180);
    expect(after.soundCueQueue).toEqual([...before.soundCueQueue, "ding"]);
    const alert = after.floatingAlerts.at(-1);
    expect(alert).toMatchObject({
      x: before.duck.x,
      y: before.duck.y - 25,
      vy: -1.2,
      text: "🍖 Ball Traded! (+35 pts)",
    });
  });

  it("clamps the trade at the top of the scale and the floor of excitement", () => {
    const after = giveTreat(trading({ naughtyVsGood: 90, excitement: 4 }));
    expect(after.naughtyVsGood).toBe(100);
    expect(after.excitement).toBe(0);
  });

  it("announces a combo from the second trade and a fanfare from the third", () => {
    const second = giveTreat(trading({ comboStreak: 1 }));
    expect(second.floatingAlerts.at(-1)?.text).toBe(
      "🍖 Ball Traded! (2× Combo! +70 pts)"
    );
    expect(second.soundCueQueue).not.toContain("combo-fanfare");

    const third = giveTreat(trading({ comboStreak: 2 }));
    expect(third.totalScore).toBe(105);
    expect(third.soundCueQueue.slice(-2)).toEqual(["ding", "combo-fanfare"]);
  });

  it("gives an ordinary treat a gentler, clamped effect and no score", () => {
    const before = running({ naughtyVsGood: 30, excitement: 40 });
    const after = giveTreat(before);
    expect(after.naughtyVsGood).toBe(40);
    expect(after.excitement).toBe(32);
    expect(after.totalScore).toBe(before.totalScore);
    expect(after.comboStreak).toBe(before.comboStreak);
    expect(after.floatingAlerts).toEqual(before.floatingAlerts);

    const clamped = giveTreat(running({ naughtyVsGood: 95, excitement: 3 }));
    expect(clamped.naughtyVsGood).toBe(100);
    expect(clamped.excitement).toBe(0);
  });

  it("does nothing while the sprint is paused", () => {
    const paused = { ...trading(), status: "paused" as const };
    expect(giveTreat(paused)).toBe(paused);
  });
});
