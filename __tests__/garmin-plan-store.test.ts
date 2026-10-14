import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MockStorage } from "../vitest.setup";
import * as safeStorage from "@/lib/safe-storage";
import { safeClear } from "@/lib/safe-storage";
import {
  BAG_SIZE,
  START_CONTINUES,
  clearWorkout,
  newPlan,
  takeHutItem,
} from "@/lib/garmin-plan";
import {
  PLAN_SAVE_VERSION,
  PLAN_STORAGE_KEY,
  clearPlan,
  loadPlan,
  normalizePlan,
  savePlan,
} from "@/lib/garmin-plan-store";
import { START_LIVES } from "@/lib/garmin-powerups";

// The Training Plan save (#1994): the round trip, a corrupt save, malformed
// fields one by one, a failed write and New plan.

let mockStorage = new MockStorage();

beforeEach(() => {
  mockStorage = new MockStorage();
  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  safeClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A plan part of the way through. */
function inProgress() {
  const save = clearWorkout(
    clearWorkout(newPlan(42), "easy", {
      lives: 4,
      score: 1500,
      trainingEffect: 3.1,
    }),
    "tempo",
    { lives: 4, score: 800, trainingEffect: 2 }
  );
  return { ...takeHutItem(save, "hut-1", 1).save, cursor: "hut-1" as const };
}

/** Writes `value` as the stored save, past the in-memory cache. */
function store(value: unknown) {
  safeClear();
  mockStorage.setItem(
    PLAN_STORAGE_KEY,
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

describe("the Training Plan save (#1994)", () => {
  it("has no save until one is written", () => {
    expect(loadPlan()).toBeNull();
  });

  it("reads back the plan it saved", () => {
    const plan = inProgress();
    expect(savePlan(plan)).toBe(true);
    expect(loadPlan()).toEqual(plan);
    const raw = JSON.parse(mockStorage.getItem(PLAN_STORAGE_KEY) ?? "{}");
    expect(raw.v).toBe(PLAN_SAVE_VERSION);
  });

  it("reads a corrupt save as no save", () => {
    for (const raw of ["not json", "[1, 2]", "42", "null", '{"v": 99}']) {
      store(raw);
      expect(loadPlan()).toBeNull();
    }
  });

  it("falls back field by field, and drops unknown nodes and items", () => {
    store({
      v: PLAN_SAVE_VERSION,
      seed: 9,
      cleared: ["easy", "moon-base", 7],
      huts: { "hut-1": "gel", "hut-2": "sword", "moon-base": "gel" },
      cursor: "nowhere",
      lives: -3,
      continues: 50,
      score: "lots",
      bag: ["gel", "sword", ...Array(20).fill("protein")],
      finished: "yes",
      dnfs: 1.5,
      lastTe: 9,
    });
    const plan = loadPlan();
    expect(plan).not.toBeNull();
    expect(plan?.seed).toBe(9);
    expect(plan?.cleared).toEqual(["easy"]);
    expect(plan?.huts).toEqual({ "hut-1": "gel" });
    expect(plan?.cursor).toBe("easy");
    expect(plan?.lives).toBe(START_LIVES);
    expect(plan?.continues).toBe(START_CONTINUES);
    expect(plan?.score).toBe(0);
    expect(plan?.bag).toHaveLength(BAG_SIZE);
    expect(plan?.bag[0]).toBe("gel");
    expect(plan?.finished).toBe(false);
    expect(plan?.dnfs).toBe(0);
    expect(plan?.lastTe).toBeNull();
  });

  it("keeps cleared nodes in plan order", () => {
    expect(
      normalizePlan({ v: PLAN_SAVE_VERSION, cleared: ["tempo", "easy"] })
        ?.cleared
    ).toEqual(["easy", "tempo"]);
  });

  it("reports a save storage will not take", () => {
    vi.spyOn(safeStorage, "safeSetRawItem").mockReturnValue(false);
    expect(savePlan(newPlan(1))).toBe(false);
  });

  it("reports a write that throws as not saved", () => {
    vi.spyOn(safeStorage, "safeSetRawItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(savePlan(newPlan(1))).toBe(false);
  });

  it("starts over on New plan", () => {
    savePlan(inProgress());
    clearPlan();
    expect(loadPlan()).toBeNull();
  });
});
