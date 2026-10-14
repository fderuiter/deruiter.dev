// @vitest-environment node
//
// #2051: endless mode escalates by quarter (faster meters and impulses plus
// one hazard per wave) and scores quarters survived plus work done; the
// puppy-hiccups surprise fires and makes tricks fail unless timed between
// hiccups.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BACK_DOOR_BOUNDS,
  ENDLESS_QUARTER_POINTS,
  ENDLESS_QUARTER_WORK,
  HICCUP_EVENT_TICKS,
  HICCUP_PERIOD_TICKS,
  HICCUP_WINDOW_TICKS,
  SPRINTS,
  computeEndlessScore,
  createInitialDuckGameState,
  dragDuckTo,
  endlessPace,
  endlessQuarterLabel,
  endlessQuartersSurvived,
  isDuckHiccuping,
  performTrick,
  releaseDuck,
  startDraggingDuck,
  stepDuckGame,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

/** Deterministic Math.random so each seed replays the same run. */
function seedRandom(seed: number) {
  let value = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  });
}

/** A running endless run in the given quarter, with Duck calmly roaming. */
function endlessRun(
  quarter = 1,
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  const base = createInitialDuckGameState(5, "endless");
  return {
    ...base,
    status: "running",
    endlessQuarter: quarter,
    workProgress: (quarter - 1) * ENDLESS_QUARTER_WORK,
    // Keep Duck roaming without a fresh wander target or impulse.
    duck: { ...base.duck, stateTimer: 10_000, maxStateTimer: 10_000 },
    ...overrides,
  };
}

function hiccupping(
  elapsed: number,
  state: WorkingWithDuckState = endlessRun()
): WorkingWithDuckState {
  return {
    ...state,
    activeSurpriseEvent: {
      type: "puppy-hiccups",
      timer: HICCUP_EVENT_TICKS - elapsed,
      maxTimer: HICCUP_EVENT_TICKS,
      resolved: false,
    },
  };
}

function dropAtBackDoor(state: WorkingWithDuckState): WorkingWithDuckState {
  let next = startDraggingDuck(state);
  next = dragDuckTo(
    next,
    BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2,
    BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2
  );
  return releaseDuck(next);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("endless pace (#2051)", () => {
  it("plays quarter 1 at the sprint 5 rates with no hazards", () => {
    const sprint5 = SPRINTS[4];
    expect(endlessPace(1)).toEqual({
      meterLevel: 5,
      impulseInterval: sprint5.impulseInterval,
      surpriseInterval: 520,
      hazards: [],
    });
  });

  it("raises meter rates and impulse frequency and adds one hazard per quarter", () => {
    const q1 = endlessPace(1);
    const q2 = endlessPace(2);
    const q3 = endlessPace(3);
    const q4 = endlessPace(4);
    expect(q2.meterLevel).toBeGreaterThan(q1.meterLevel);
    expect(q3.meterLevel).toBeGreaterThan(q2.meterLevel);
    expect(q2.impulseInterval).toBeLessThan(q1.impulseInterval);
    expect(q4.impulseInterval).toBeLessThan(q3.impulseInterval);
    expect(q2.hazards).toEqual(["surprises"]);
    expect(q2.surpriseInterval).toBeLessThan(q1.surpriseInterval);
    expect(q3.hazards).toEqual(["surprises", "mud"]);
    expect(q4.hazards).toEqual(["surprises", "mud", "cable-chewing"]);
  });

  it("keeps rising past Q4 but within bounds", () => {
    const late = endlessPace(40);
    expect(late.meterLevel).toBeLessThanOrEqual(12);
    expect(late.impulseInterval).toBeGreaterThanOrEqual(60);
    expect(late.hazards).toHaveLength(3);
    expect(endlessPace(Number.NaN)).toEqual(endlessPace(1));
  });

  it("names quarters Q1 to Q4, then with the year", () => {
    expect(endlessQuarterLabel(1)).toBe("Q1");
    expect(endlessQuarterLabel(4)).toBe("Q4");
    expect(endlessQuarterLabel(5)).toBe("Y2 Q1");
    expect(endlessQuarterLabel(10)).toBe("Y3 Q2");
    expect(endlessQuarterLabel(0)).toBe("Q1");
  });
});

describe("endless waves (#2051)", () => {
  it("starts every run in Q1", () => {
    expect(createInitialDuckGameState(5, "endless").endlessQuarter).toBe(1);
    expect(createInitialDuckGameState(1).endlessQuarter).toBe(1);
  });

  it("advances a quarter every ENDLESS_QUARTER_WORK work units with a Q1 → Q2 banner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = endlessRun(1, { workProgress: ENDLESS_QUARTER_WORK - 0.001 });
    const next = stepDuckGame(state);
    expect(next.endlessQuarter).toBe(2);
    expect(next.activeSkillToast?.badge).toBe("Q1 → Q2");
    expect(next.activeSkillToast?.text).toMatch(/Surprises come more often/);
    expect(next.soundCueQueue).toContain("combo-fanfare");
    expect(next.status).toBe("running");

    const later = stepDuckGame(
      endlessRun(2, { workProgress: 2 * ENDLESS_QUARTER_WORK - 0.001 })
    );
    expect(later.endlessQuarter).toBe(3);
    expect(later.activeSkillToast?.badge).toBe("Q2 → Q3");
  });

  it("never changes quarter in the campaign", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const base = createInitialDuckGameState(5);
    const next = stepDuckGame({
      ...base,
      status: "running",
      workProgress: 200,
    });
    expect(next.endlessQuarter).toBe(1);
    expect(next.activeSkillToast).toBeNull();
  });

  it("fills the meters faster in later quarters", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const rise = (quarter: number) => {
      const state = endlessRun(quarter);
      const next = stepDuckGame(state);
      return {
        excitement: next.excitement - state.excitement,
        bladder: next.bladder - state.bladder,
      };
    };
    expect(rise(3).excitement).toBeGreaterThan(rise(1).excitement);
    expect(rise(3).bladder).toBeGreaterThan(rise(1).bladder);
  });

  it("rolls surprise events more often once the surprises hazard is active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const at = (quarter: number) =>
      stepDuckGame(endlessRun(quarter, { ticks: 299, lastImpulseTick: 299 }));
    expect(at(1).activeSurpriseEvent).toBeNull();
    expect(at(2).activeSurpriseEvent?.type).toBe("amazon-delivery");
  });

  it("tracks mud in after potty trips from Q3, and muddy paws slow work", () => {
    expect(dropAtBackDoor(endlessRun(2)).isMuddy).toBe(false);
    expect(dropAtBackDoor(endlessRun(3)).isMuddy).toBe(true);
    const campaign = {
      ...createInitialDuckGameState(5),
      status: "running" as const,
    };
    expect(dropAtBackDoor(campaign).isMuddy).toBe(false);

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const work = (isMuddy: boolean) => {
      const state = endlessRun(3, { isMuddy });
      return stepDuckGame(state).workProgress - state.workProgress;
    };
    expect(work(true)).toBeCloseTo(work(false) * 0.8, 6);
  });

  it("sends Duck for the power cable, chewing faster, from Q4", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const impulse = (quarter: number) =>
      stepDuckGame(endlessRun(quarter, { ticks: 1000, lastImpulseTick: 0 }));
    const q4 = impulse(4);
    expect(q4.duck.state).toBe("SNEAKY_CHEW");
    expect(q4.activeHazardTarget).toBe("power-cable");
    expect(q4.duck.maxStateTimer).toBe(150);
    // Before Q4 the same roll is a flop, not a chew.
    expect(impulse(3).duck.state).toBe("THE_FLOP");
  });

  it("loses a long idle run", () => {
    for (const seed of [1, 7, 42, 1234, 99991]) {
      seedRandom(seed);
      let state: WorkingWithDuckState = {
        ...createInitialDuckGameState(5, "endless"),
        status: "running",
      };
      for (let t = 0; t < 60 * 600 && state.status === "running"; t++) {
        state = stepDuckGame(state);
      }
      expect(state.status).toBe("failed");
      vi.restoreAllMocks();
    }
  });
});

describe("endless score (#2051)", () => {
  it("scores quarters survived plus work done", () => {
    const state = endlessRun(3, { workProgress: 250.7 });
    expect(endlessQuartersSurvived(state)).toBe(2);
    expect(computeEndlessScore(state)).toBe(2 * ENDLESS_QUARTER_POINTS + 250);
    expect(computeEndlessScore(endlessRun(1))).toBe(0);
  });

  it("is 0 outside endless mode", () => {
    const campaign = { ...createInitialDuckGameState(3), workProgress: 100 };
    expect(computeEndlessScore(campaign)).toBe(0);
    expect(endlessQuartersSurvived(campaign)).toBe(0);
  });
});

describe("puppy hiccups (#2051)", () => {
  /** A state one tick before a surprise roll, with Duck roaming calmly. */
  function beforeSurprise(level: number, mode: "campaign" | "endless") {
    const base = createInitialDuckGameState(level, mode);
    return {
      ...base,
      status: "running" as const,
      ticks: 519,
      lastImpulseTick: 519,
      duck: { ...base.duck, stateTimer: 10_000, maxStateTimer: 10_000 },
    };
  }

  it("joins the random surprise pool from sprint 2 and in endless", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const sprint2 = stepDuckGame(beforeSurprise(2, "campaign"));
    expect(sprint2.activeSurpriseEvent?.type).toBe("puppy-hiccups");
    expect(sprint2.activeSurpriseEvent?.timer).toBe(HICCUP_EVENT_TICKS);
    expect(sprint2.soundCueQueue).toContain("hiccup");
    expect(
      stepDuckGame(beforeSurprise(5, "endless")).activeSurpriseEvent?.type
    ).toBe("puppy-hiccups");
  });

  it("leaves sprint 1's surprise pool as it was", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(
      stepDuckGame(beforeSurprise(1, "campaign")).activeSurpriseEvent?.type
    ).toBe("squirrel-window");
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    expect(
      stepDuckGame(beforeSurprise(1, "campaign")).activeSurpriseEvent?.type
    ).toBe("amazon-delivery");
  });

  it("hiccups at the start of each period", () => {
    expect(isDuckHiccuping(endlessRun())).toBe(false);
    expect(isDuckHiccuping(hiccupping(0))).toBe(true);
    expect(isDuckHiccuping(hiccupping(HICCUP_WINDOW_TICKS - 1))).toBe(true);
    expect(isDuckHiccuping(hiccupping(HICCUP_WINDOW_TICKS))).toBe(false);
    expect(isDuckHiccuping(hiccupping(HICCUP_PERIOD_TICKS))).toBe(true);
  });

  it("makes a trick fail mid-hiccup and break the combo", () => {
    const state = {
      ...hiccupping(0),
      excitement: 80,
      comboStreak: 2,
      comboTimer: 100,
    };
    const next = performTrick(state, "SIT");
    expect(next.duck.state).toBe("IDLE_ROAM");
    expect(next.activeTrick).toBeNull();
    expect(next.totalScore).toBe(state.totalScore);
    expect(next.excitement).toBe(state.excitement);
    expect(next.comboStreak).toBe(0);
    expect(next.soundCueQueue).toContain("hiccup");
    expect(next.floatingAlerts.some((a) => a.text.includes("slipped"))).toBe(
      true
    );
    // Mashing the key does not stack the same alert.
    expect(performTrick(next, "SIT").floatingAlerts).toHaveLength(
      next.floatingAlerts.length
    );
  });

  it("lets a trick timed between hiccups land", () => {
    const state = { ...hiccupping(HICCUP_WINDOW_TICKS + 5), excitement: 80 };
    const next = performTrick(state, "SIT");
    expect(next.duck.state).toBe("PERFORMING_TRICK");
    expect(next.totalScore).toBeGreaterThan(state.totalScore);
    expect(next.excitement).toBeLessThan(state.excitement);
  });

  it("hiccups once per period and resolves cleanly when the bout ends", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = hiccupping(0);
    let hiccups = 0;
    for (let t = 0; t < HICCUP_EVENT_TICKS; t++) {
      const queued = state.soundCueQueue.length;
      state = stepDuckGame(state);
      hiccups += state.soundCueQueue
        .slice(queued)
        .filter((cue) => cue === "hiccup").length;
    }
    expect(hiccups).toBe(
      Math.ceil(HICCUP_EVENT_TICKS / HICCUP_PERIOD_TICKS) - 1
    );
    expect(state.activeSurpriseEvent).toBeNull();
    expect(isDuckHiccuping(state)).toBe(false);
    expect(
      state.floatingAlerts.some((a) => a.text.startsWith("Hiccups gone"))
    ).toBe(true);
    expect(performTrick({ ...state, excitement: 80 }, "SIT").duck.state).toBe(
      "PERFORMING_TRICK"
    );
  });
});
