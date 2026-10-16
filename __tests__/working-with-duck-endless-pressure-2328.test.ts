// @vitest-environment node
//
// #2328: endless difficulty kept climbing only until about Q6 (impulses) and
// Q13 (meters), and a surprise roll fired only if Duck happened to be
// roaming on the exact tick it came due, so "surprises come more often"
// rarely held. Late quarters now keep tightening within a ceiling, and a due
// surprise waits for Duck's next calm moment instead of being skipped.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BACK_DOOR_BOUNDS,
  ENDLESS_QUARTER_WORK,
  SPRINTS,
  createInitialDuckGameState,
  dragDuckTo,
  endlessPace,
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
  quarter: number,
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  const base = createInitialDuckGameState(5, "endless");
  return {
    ...base,
    status: "running",
    endlessQuarter: quarter,
    workProgress: (quarter - 1) * ENDLESS_QUARTER_WORK,
    duck: { ...base.duck, stateTimer: 10_000, maxStateTimer: 10_000 },
    ...overrides,
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

/**
 * An attentive player, like the playtest bot: Drop It on chews, Sit on
 * zoomies or high Excitement, and a potty trip when Bladder runs high.
 */
function attentivePlayer(state: WorkingWithDuckState): WorkingWithDuckState {
  const duckState = state.duck.state;
  if (duckState === "SNEAKY_CHEW" || duckState === "NO_TAKE_THROW") {
    return performTrick(state, "DROP_IT");
  }
  if (duckState === "ZOOMIES" || state.excitement > 65) {
    return performTrick(state, "SIT");
  }
  if (duckState === "SNIFFING_POTTY" || state.bladder > 70) {
    return dropAtBackDoor(state);
  }
  return state;
}

/** Surprises started over `ticks` ticks of an endless run held in one quarter. */
function surprisesOverRun(quarter: number, ticks: number): number {
  let state = endlessRun(quarter);
  let started = 0;
  for (let i = 0; i < ticks && state.status === "running"; i++) {
    const before = state.activeSurpriseEvent;
    state = stepDuckGame(attentivePlayer(state));
    if (!before && state.activeSurpriseEvent) started += 1;
    // Hold the run in this quarter so the pace under test stays fixed.
    state = {
      ...state,
      workProgress: (quarter - 1) * ENDLESS_QUARTER_WORK,
      endlessQuarter: quarter,
      naughtyVsGood: Math.max(state.naughtyVsGood, 0),
    };
  }
  return started;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("endless pace keeps rising past Y2 (#2328)", () => {
  it("leaves the first quarters exactly as they were", () => {
    const sprint5 = SPRINTS[4];
    expect(endlessPace(1).meterLevel).toBe(5);
    expect(endlessPace(1).impulseInterval).toBe(sprint5.impulseInterval);
    expect(endlessPace(2).meterLevel).toBeCloseTo(5.6);
    expect(endlessPace(5).impulseInterval).toBe(sprint5.impulseInterval - 48);
  });

  it("keeps shortening the impulse interval after Q6", () => {
    const q6 = endlessPace(6).impulseInterval;
    const q8 = endlessPace(8).impulseInterval;
    const q12 = endlessPace(12).impulseInterval;
    expect(q8).toBeLessThan(q6);
    expect(q12).toBeLessThan(q8);
  });

  it("keeps raising the meter level after Q13", () => {
    const q13 = endlessPace(13).meterLevel;
    const q20 = endlessPace(20).meterLevel;
    const q40 = endlessPace(40).meterLevel;
    expect(q20).toBeGreaterThan(q13);
    expect(q40).toBeGreaterThan(q20);
  });

  it("never passes its ceiling, however long the run", () => {
    for (const quarter of [50, 200, 10_000]) {
      const pace = endlessPace(quarter);
      expect(pace.meterLevel).toBeLessThanOrEqual(16);
      expect(pace.impulseInterval).toBeGreaterThanOrEqual(40);
      expect(Number.isFinite(pace.meterLevel)).toBe(true);
      expect(Number.isFinite(pace.impulseInterval)).toBe(true);
    }
  });
});

describe("a due endless surprise waits for a calm moment (#2328)", () => {
  it("fires once Duck is roaming again when the due tick found him busy", () => {
    seedRandom(7);
    const interval = endlessPace(2).surpriseInterval;
    const busy = endlessRun(2, {
      ticks: interval - 1,
      thirst: 90,
      duck: {
        ...endlessRun(2).duck,
        state: "DRINKING_WATER",
        stateTimer: 30,
        maxStateTimer: 30,
      },
    });
    let state = stepDuckGame(busy);
    expect(state.ticks).toBe(interval);
    expect(state.activeSurpriseEvent).toBeNull();

    // Duck finishes drinking and roams; the surprise he was due arrives
    // before the next scheduled roll.
    for (let i = 0; i < interval - 1 && !state.activeSurpriseEvent; i++) {
      state = stepDuckGame(state);
    }
    expect(state.activeSurpriseEvent).not.toBeNull();
    expect(state.ticks).toBeLessThan(2 * interval);
  });

  it("brings a late-quarter run most of the surprises its interval promises", () => {
    seedRandom(2328);
    const ticks = 60 * 120;
    const interval = endlessPace(8).surpriseInterval;
    const promised = Math.floor(ticks / interval);
    const started = surprisesOverRun(8, ticks);
    expect(started).toBeGreaterThanOrEqual(Math.ceil(promised * 0.6));
  });

  it("keeps campaign surprises on their exact-tick roll", () => {
    seedRandom(7);
    const base = createInitialDuckGameState(2);
    const busy: WorkingWithDuckState = {
      ...base,
      status: "running",
      ticks: 519,
      thirst: 90,
      duck: {
        ...base.duck,
        state: "DRINKING_WATER",
        stateTimer: 30,
        maxStateTimer: 30,
      },
    };
    let state = stepDuckGame(busy);
    for (let i = 0; i < 120; i++) state = stepDuckGame(state);
    expect(state.activeSurpriseEvent).toBeNull();
  });
});
