import { describe, it, expect, beforeEach } from "vitest";
import { MockStorage } from "../vitest.setup";
import {
  GEAR_ITEM_EFFECTS,
  GEAR_ITEM_TIER,
  PREWORKOUT_MS,
  applyGearItem,
  bagCheck,
  loadoutApplies,
  packableOnly,
  restDayTargets,
  startLoadout,
  stepLoadout,
  unpackGearItem,
} from "@/lib/garmin/bag";
import { BODY_BATTERY_MAX } from "@/lib/garmin/body-battery";
import {
  createInitialState,
  setRules,
  startGame,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  BAG_SIZE,
  GEAR_ITEMS,
  PLAN_SEED,
  clearWorkout,
  isOpen,
  newPlan,
  nodeStatus,
  takeHutItem,
  type GearItem,
  type PlanNodeId,
  type PlanSave,
} from "@/lib/garmin/plan";
import {
  PLAN_SAVE_VERSION,
  PLAN_STORAGE_KEY,
  loadPlan,
  normalizePlan,
  savePlan,
} from "@/lib/garmin/plan-store";
import { HIGH_MS } from "@/lib/garmin/powerups";
import { safeClear } from "@/lib/safe-storage";

// The gear bag (#1995): capacity, the rules for using each item, the save,
// and that races leave the bag alone.

const RESULT = { lives: 3, score: 1000, trainingEffect: 3 };
const FRAME = 1000 / 60;

/** A plan with `ids` cleared and `bag` in the bag. */
function plan(ids: PlanNodeId[], bag: GearItem[] = []): PlanSave {
  const save = ids.reduce((s, id) => clearWorkout(s, id, RESULT), newPlan(3));
  return { ...save, bag };
}

/** A workout's start state, past the GPS lock unless `gpsMs` is given. */
function workout(gpsMs = 0): GameEngineState {
  return {
    ...startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix",
      undefined,
      undefined,
      { stage: 1, seed: PLAN_SEED, raceDay: false }
    ),
    gpsMs,
  };
}

describe("gear bag capacity (#1995)", () => {
  it("holds at most eight items: a full bag leaves the hut item behind", () => {
    const full = {
      ...plan(["easy", "tempo"]),
      bag: Array(BAG_SIZE).fill("gel"),
    };
    const pick = takeHutItem(full, "hut-1", 0);
    expect(pick.stored).toBe(false);
    expect(pick.save.bag).toHaveLength(BAG_SIZE);
    // The hut is still visited: it gives one item, taken or not.
    expect(nodeStatus(pick.save, "hut-1")).toBe("cleared");
  });

  it("counts packed gear towards the eight, so it always fits back", () => {
    const packed = applyGearItem(plan([], ["gel"]), "gel").save;
    const full = {
      ...plan(["easy", "tempo"]),
      packed: packed.packed,
      bag: Array(BAG_SIZE - 1).fill("cape"),
    };
    // Seven in the bag and one packed: the hut item stays behind.
    expect(takeHutItem(full, "hut-1", 0).stored).toBe(false);
    const back = unpackGearItem(full, "gel");
    expect(back.used).toBe(true);
    expect(back.save.bag).toHaveLength(BAG_SIZE);
    expect(back.save.packed).toEqual([]);
  });

  it("describes every item", () => {
    for (const item of GEAR_ITEMS) {
      expect(GEAR_ITEM_EFFECTS[item].length).toBeGreaterThan(10);
    }
  });
});

describe("using items (#1995)", () => {
  it("packs an item out of the bag for the next workout", () => {
    const use = applyGearItem(plan([], ["gel", "gel"]), "gel");
    expect(use.used).toBe(true);
    expect(use.save.bag).toEqual(["gel"]);
    expect(use.save.packed).toEqual(["gel"]);
    expect(use.text).toBe("Energy Gel packed for your next workout.");
  });

  it("refuses an item that isn't in the bag", () => {
    const save = plan([], ["gel"]);
    expect(bagCheck(save, "cape")).toEqual({
      ok: false,
      reason: "Not in the bag.",
    });
    expect(applyGearItem(save, "cape")).toEqual({
      save,
      used: false,
      text: "Not in the bag.",
    });
  });

  it("packs each item once", () => {
    const once = applyGearItem(
      plan([], ["preworkout", "preworkout"]),
      "preworkout"
    );
    const twice = applyGearItem(once.save, "preworkout");
    expect(twice.used).toBe(false);
    expect(twice.text).toBe("Already packed for the next workout.");
    expect(twice.save.bag).toEqual(["preworkout"]);
  });

  it("packs one power-up per workout", () => {
    const shake = applyGearItem(plan([], ["protein", "cape"]), "protein").save;
    expect(bagCheck(shake, "cape")).toEqual({
      ok: false,
      reason: "One power-up per workout: the Protein Shake is packed.",
    });
    // A power-up packs beside a Runner's High, a gel and a Pre-Workout.
    const all = ["high", "gel", "preworkout"].reduce<PlanSave>(
      (s, item) => applyGearItem(s, item as GearItem).save,
      { ...shake, bag: [...shake.bag, "high", "gel", "preworkout"] }
    );
    expect(all.packed).toEqual(["protein", "high", "gel", "preworkout"]);
  });

  it("puts a packed item back in the bag", () => {
    const packed = applyGearItem(plan([], ["heatmap"]), "heatmap").save;
    const back = unpackGearItem(packed, "heatmap");
    expect(back.used).toBe(true);
    expect(back.save.packed).toEqual([]);
    expect(back.save.bag).toEqual(["heatmap"]);
    expect(unpackGearItem(back.save, "heatmap").used).toBe(false);
  });

  it("takes a Rest Day on the map: the paths past the next workout open", () => {
    const save = plan(["easy"], ["restday"]);
    expect(restDayTargets(save)).toEqual(["intervals", "hut-1"]);
    const use = applyGearItem(save, "restday");
    expect(use.used).toBe(true);
    expect(use.text).toBe(
      "Rest Day taken. Intervals and Recovery Hut are open."
    );
    expect(use.save.bag).toEqual([]);
    expect(use.save.packed).toEqual([]);
    expect(isOpen(use.save, "intervals")).toBe(true);
    expect(isOpen(use.save, "hut-1")).toBe(true);
    // Tempo is skipped, not cleared.
    expect(nodeStatus(use.save, "tempo")).toBe("open");
  });

  it("skips to Race Day from the Long Run, but never past it", () => {
    const longRun = plan(
      ["easy", "tempo", "intervals"],
      ["restday", "restday"]
    );
    expect(restDayTargets(longRun)).toEqual(["raceday"]);
    const rested = applyGearItem(longRun, "restday").save;
    expect(isOpen(rested, "raceday")).toBe(true);
    // The Long Run is still open, so the next Rest Day has it to skip again,
    // and nothing left to open.
    expect(restDayTargets(rested)).toEqual([]);
    expect(bagCheck(rested, "restday")).toEqual({
      ok: false,
      reason: "No path is left for a Rest Day to open.",
    });
  });
});

describe("packed gear in a workout (#1995)", () => {
  it("goes with a new workout, never a practice run or Race Day", () => {
    expect(loadoutApplies("easy", false)).toBe(true);
    expect(loadoutApplies("long", false)).toBe(true);
    expect(loadoutApplies("easy", true)).toBe(false);
    expect(loadoutApplies("raceday", false)).toBe(false);
    expect(loadoutApplies("hut-1", false)).toBe(false);
  });

  it("starts the workout at a power-up's tier", () => {
    for (const item of ["protein", "heatmap", "cape"] as const) {
      expect(startLoadout(workout(), [item]).power).toBe(GEAR_ITEM_TIER[item]);
    }
  });

  it("changes nothing with nothing packed", () => {
    const s = workout();
    expect(startLoadout(s, [])).toBe(s);
    expect(stepLoadout(s, s, FRAME)).toBe(s);
  });

  it("starts a Runner's High as the GPS locks, once", () => {
    const s = startLoadout(workout(2000), ["high"]);
    expect(stepLoadout(s, s, FRAME)).toBe(s);
    const locked = { ...s, gpsMs: 0 };
    const high = stepLoadout(s, locked, FRAME);
    expect(high.starMs).toBe(HIGH_MS);
    expect(high.banner?.text).toBe("RUNNER'S HIGH!");
    expect(high.loadout).toBeNull();
  });

  it("holds the pace meter full for six seconds after the GPS lock", () => {
    let s = startLoadout(workout(), ["preworkout"]);
    let elapsed = 0;
    while (elapsed < PREWORKOUT_MS) {
      const drained = { ...s, isGrounded: true, paceMeter: 0.2 };
      s = stepLoadout(s, drained, FRAME);
      expect(s.paceMeter).toBe(1);
      elapsed += FRAME;
    }
    expect(s.loadout).toBeNull();
    const after = { ...s, isGrounded: true, paceMeter: 0.2 };
    expect(stepLoadout(s, after, FRAME).paceMeter).toBe(0.2);
  });

  it("ends the Pre-Workout at the first take-off, which leaves full", () => {
    const s0 = startLoadout(workout(), ["preworkout"]);
    const grounded = stepLoadout(s0, { ...s0, isGrounded: true }, FRAME);
    expect(grounded.paceMeter).toBe(1);
    const air = { ...grounded, isGrounded: false, paceMeter: 1 };
    const flying = stepLoadout(grounded, air, FRAME);
    expect(flying.loadout).toBeNull();
    // Landing again, the meter is the engine's own.
    const landed = { ...flying, isGrounded: true, paceMeter: 0.3 };
    expect(stepLoadout(flying, landed, FRAME).paceMeter).toBe(0.3);
  });

  it("ends the Pre-Workout with a lost life", () => {
    const s0 = startLoadout(workout(), ["preworkout", "gel"]);
    const lost = {
      ...s0,
      isGrounded: true,
      paceMeter: 0,
      lives: (s0.lives ?? 3) - 1,
    };
    const next = stepLoadout(s0, lost, FRAME);
    expect(next.paceMeter).toBe(0);
    expect(next.loadout).toEqual({ high: false, gel: true, preworkoutMs: 0 });
  });

  it("refills Body Battery with the gel at the first bonk, once", () => {
    const s = startLoadout(workout(), ["gel"]);
    const bonk = { ...s, bodyBattery: { value: 0, bonked: true } };
    const refilled = stepLoadout(s, bonk, FRAME);
    expect(refilled.bodyBattery).toEqual({
      value: BODY_BATTERY_MAX,
      bonked: false,
    });
    expect(refilled.banner?.text).toBe("ENERGY GEL · BATTERY FULL");
    expect(refilled.loadout).toBeNull();
    const again = { ...refilled, bodyBattery: { value: 0, bonked: true } };
    expect(stepLoadout(refilled, again, FRAME).bodyBattery?.bonked).toBe(true);
  });

  it("keeps the gel for a later bonk while the others are spent", () => {
    const s = startLoadout(workout(), ["high", "gel"]);
    const next = stepLoadout(s, s, FRAME);
    expect(next.loadout).toEqual({ high: false, gel: true, preworkoutMs: 0 });
  });

  it("packs only what can be packed, from a stored list", () => {
    expect(
      packableOnly(["restday", "gel", "gel", "cape", "protein", "high"])
    ).toEqual(["gel", "cape", "high"]);
  });
});

describe("Race Mode and the bag (#1995)", () => {
  it("starts every race from the Base tier, with no loadout", () => {
    const race = startGame(
      createInitialState("fenix", 0, []),
      "fenix",
      undefined,
      { course: "saturday5k", category: "any", seed: 1 }
    );
    expect(race.power ?? "base").toBe("base");
    expect(race.loadout ?? null).toBeNull();
  });

  it("leaves the packed gear for Race Day's next new workout", () => {
    const packed = applyGearItem(
      plan(["easy", "tempo", "intervals", "long"], ["cape"]),
      "cape"
    ).save;
    // Race Day is the only workout left and takes none of it.
    expect(loadoutApplies("raceday", false)).toBe(false);
    expect(packed.packed).toEqual(["cape"]);
  });
});

describe("the bag in the save (#1995)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: new MockStorage(),
      writable: true,
      configurable: true,
    });
    safeClear();
  });

  it("keeps the bag, the packed gear and Rest Day paths", () => {
    const rested = applyGearItem(
      plan(["easy"], ["restday", "gel"]),
      "restday"
    ).save;
    const save = applyGearItem(rested, "gel").save;
    expect(savePlan(save)).toBe(true);
    expect(loadPlan()).toEqual(save);
  });

  it("reads a stored Foam Roller as a Rest Day", () => {
    const stored = {
      ...newPlan(1),
      v: PLAN_SAVE_VERSION,
      bag: ["foamroller", "gel"],
      huts: { "hut-1": "foamroller" },
    };
    const save = normalizePlan(stored);
    expect(save?.bag).toEqual(["restday", "gel"]);
    expect(save?.huts).toEqual({ "hut-1": "restday" });
  });

  it("keeps the bag and packed gear to eight between them", () => {
    const save = normalizePlan({
      ...newPlan(1),
      v: PLAN_SAVE_VERSION,
      bag: Array(BAG_SIZE).fill("gel"),
      packed: ["cape", "high"],
    });
    expect(save?.packed).toEqual(["cape", "high"]);
    expect(save?.bag).toHaveLength(BAG_SIZE - 2);
  });

  it("drops malformed packed gear and unknown unlocked nodes", () => {
    const save = normalizePlan({
      ...newPlan(1),
      v: PLAN_SAVE_VERSION,
      packed: ["cape", "protein", "restday", "sword", "cape"],
      unlocked: ["intervals", "moon", 4],
    });
    expect(save?.packed).toEqual(["cape"]);
    expect(save?.unlocked).toEqual(["intervals"]);
  });

  it("reads a save from before the bag with nothing packed", () => {
    const old: Record<string, unknown> = {
      ...newPlan(1),
      v: PLAN_SAVE_VERSION,
    };
    delete old.packed;
    delete old.unlocked;
    safeClear();
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(old));
    expect(loadPlan()?.packed).toEqual([]);
    expect(loadPlan()?.unlocked).toEqual([]);
  });
});
