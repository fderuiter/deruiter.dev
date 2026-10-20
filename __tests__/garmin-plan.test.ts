// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BAG_SIZE,
  GEAR_ITEMS,
  PLAN_NODES,
  PLAN_SEED,
  START_CONTINUES,
  START_NODE,
  clearWorkout,
  cycleCursor,
  dnfWorkout,
  hutItems,
  isOpen,
  moveCursor,
  newPlan,
  nextWorkout,
  nodeLabel,
  nodeStatus,
  planNode,
  planRunFor,
  takeHutItem,
  trainingReadiness,
  type PlanNodeId,
  type PlanSave,
} from "@/lib/garmin-plan";
import { START_LIVES } from "@/lib/garmin-powerups";
import { createInitialState } from "@/lib/garmin-engine";
import { workoutOutcome } from "@/components/garmin-watch/useTrainingPlan";

// The Training Plan's rules (#1994): the map graph and its unlocks, the
// cursor, huts, DNFs and continues, readiness, and practice runs.

const RESULT = { lives: 3, score: 1200, trainingEffect: 3.2 };

/** A plan with `ids` cleared in order. */
function clearedPlan(...ids: PlanNodeId[]): PlanSave {
  return ids.reduce(
    (save, id) =>
      planNode(id).kind === "hut"
        ? takeHutItem(save, id, 0).save
        : clearWorkout(save, id, RESULT),
    newPlan(7)
  );
}

describe("the map graph (#1994)", () => {
  it("joins only nodes next to each other, so the arrows follow every path", () => {
    for (const node of PLAN_NODES) {
      for (const id of node.next) {
        const to = planNode(id);
        expect(Math.abs(to.col - node.col) + Math.abs(to.row - node.row)).toBe(
          1
        );
      }
    }
  });

  it("places every node in its own cell, with each workout on its own stage", () => {
    const cells = new Set(PLAN_NODES.map((n) => `${n.col},${n.row}`));
    expect(cells.size).toBe(PLAN_NODES.length);
    const stages = PLAN_NODES.filter((n) => n.stage !== null).map(
      (n) => n.stage
    );
    expect(stages).toEqual([1, 2, 3, 4, 5]);
  });

  it("reaches every node from the start, with Race Day last", () => {
    const reached = new Set<PlanNodeId>([START_NODE]);
    const queue: PlanNodeId[] = [START_NODE];
    while (queue.length > 0) {
      for (const id of planNode(queue.shift() as PlanNodeId).next) {
        if (!reached.has(id)) {
          reached.add(id);
          queue.push(id);
        }
      }
    }
    expect(reached.size).toBe(PLAN_NODES.length);
    expect(planNode("raceday").next).toEqual([]);
  });

  it("opens only the Easy Run on a new plan", () => {
    const save = newPlan(1);
    expect(
      PLAN_NODES.filter((n) => isOpen(save, n.id)).map((n) => n.id)
    ).toEqual(["easy"]);
    expect(save.lives).toBe(START_LIVES);
    expect(save.continues).toBe(START_CONTINUES);
  });

  it("opens the nodes a cleared workout leads to", () => {
    const save = clearedPlan("easy", "tempo");
    expect(nodeStatus(save, "easy")).toBe("cleared");
    expect(nodeStatus(save, "intervals")).toBe("open");
    expect(nodeStatus(save, "hut-1")).toBe("open");
    expect(nodeStatus(save, "long")).toBe("locked");
    expect(nodeStatus(save, "raceday")).toBe("locked");
  });

  it("never clears a locked node or a hut as a workout", () => {
    const save = newPlan(1);
    expect(clearWorkout(save, "long", RESULT)).toBe(save);
    expect(clearWorkout(save, "hut-1", RESULT)).toBe(save);
  });

  it("carries the lives and points of a cleared workout back to the plan", () => {
    const save = clearWorkout(newPlan(1), "easy", {
      lives: 5,
      score: 900,
      trainingEffect: 2.5,
    });
    expect(save.lives).toBe(5);
    expect(save.score).toBe(900);
    expect(save.lastTe).toBe(2.5);
    const again = clearWorkout(save, "tempo", RESULT);
    expect(again.score).toBe(2100);
    expect(again.cleared).toEqual(["easy", "tempo"]);
  });

  it("wins the finisher medal on Race Day", () => {
    const save = clearedPlan("easy", "tempo", "intervals", "long");
    expect(save.finished).toBe(false);
    expect(clearWorkout(save, "raceday", RESULT).finished).toBe(true);
  });

  it("runs each workout on its stage of the plan's fixed course", () => {
    expect(planRunFor(planNode("tempo"))).toEqual({
      stage: 2,
      seed: PLAN_SEED,
      raceDay: false,
    });
    expect(planRunFor(planNode("raceday"))).toEqual({
      stage: 5,
      seed: PLAN_SEED,
      raceDay: true,
    });
    expect(planRunFor(planNode("hut-1"))).toBeNull();
  });
});

describe("the map cursor (#1994)", () => {
  it("moves along a path to an open node only", () => {
    const fresh = newPlan(1);
    expect(moveCursor(fresh, "easy", "right")).toBe("easy");
    const save = clearedPlan("easy", "tempo");
    expect(moveCursor(save, "easy", "right")).toBe("tempo");
    expect(moveCursor(save, "tempo", "down")).toBe("hut-1");
    expect(moveCursor(save, "tempo", "right")).toBe("intervals");
    expect(moveCursor(save, "hut-1", "up")).toBe("tempo");
    // No path from the first hut to the second, though they sit side by side.
    const both = clearedPlan("easy", "tempo", "intervals");
    expect(moveCursor(both, "hut-1", "right")).toBe("hut-1");
    // Nothing to the left of the start, and Race Day is still locked.
    expect(moveCursor(both, "easy", "left")).toBe("easy");
    expect(moveCursor(both, "intervals", "up")).toBe("intervals");
  });

  it("steps through the open nodes in plan order, wrapping round", () => {
    const save = clearedPlan("easy", "tempo");
    expect(cycleCursor(save, "easy", 1)).toBe("tempo");
    expect(cycleCursor(save, "tempo", 1)).toBe("intervals");
    expect(cycleCursor(save, "intervals", 1)).toBe("hut-1");
    expect(cycleCursor(save, "hut-1", 1)).toBe("easy");
    expect(cycleCursor(save, "easy", -1)).toBe("hut-1");
    expect(cycleCursor(save, "long", 1)).toBe("easy");
  });

  it("labels each node with where it is and what Jump does", () => {
    const save = clearedPlan("easy", "tempo");
    expect(nodeLabel(save, "easy")).toBe(
      "Easy Run, week 1 Monday, stage 1: cleared, Space or START runs it as practice"
    );
    expect(nodeLabel(save, "intervals")).toBe(
      "Intervals, week 1 Friday, stage 3: open, Space or START starts it"
    );
    expect(nodeLabel(save, "raceday")).toBe(
      "Race Day, week 2 Saturday, stage 5: locked"
    );
    expect(nodeLabel(save, "hut-1")).toBe(
      "Recovery Hut, week 2 Tuesday: open, pick one of three hidden items"
    );
  });
});

describe("Recovery Huts (#1994)", () => {
  it("hides three different items, drawn by the plan's seed", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const items = hutItems(newPlan(seed), "hut-1");
      expect(items).toHaveLength(3);
      expect(new Set(items).size).toBe(3);
      for (const item of items) expect(GEAR_ITEMS).toContain(item);
      expect(hutItems(newPlan(seed), "hut-1")).toEqual(items);
      for (const item of items) seen.add(item);
    }
    // Over many plans, every item turns up at a hut (#1995).
    expect([...seen].sort()).toEqual([...GEAR_ITEMS].sort());
    const orders = new Set(
      Array.from({ length: 20 }, (_, s) => hutItems(newPlan(s), "hut-2").join())
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("gives the item behind the picked slot, once, into the bag", () => {
    const save = clearedPlan("easy", "tempo");
    const behind = hutItems(save, "hut-1")[2];
    const pick = takeHutItem(save, "hut-1", 2);
    expect(pick.item).toBe(behind);
    expect(pick.stored).toBe(true);
    expect(pick.save.bag).toEqual([behind]);
    expect(pick.save.huts["hut-1"]).toBe(behind);
    expect(nodeStatus(pick.save, "hut-1")).toBe("cleared");
    expect(nodeLabel(pick.save, "hut-1")).toContain("visited, you took the");
    const again = takeHutItem(pick.save, "hut-1", 0);
    expect(again.item).toBeNull();
    expect(again.save).toBe(pick.save);
  });

  it("gives nothing at a locked hut, a workout or a slot out of range", () => {
    const fresh = newPlan(1);
    expect(takeHutItem(fresh, "hut-1", 0).item).toBeNull();
    const save = clearedPlan("easy", "tempo");
    expect(takeHutItem(save, "tempo", 0).item).toBeNull();
    expect(takeHutItem(save, "hut-1", 3).item).toBeNull();
    expect(takeHutItem(save, "hut-1", 0.5).item).toBeNull();
  });

  it("leaves the item at the hut when the bag is full", () => {
    const save = {
      ...clearedPlan("easy", "tempo"),
      bag: Array.from({ length: BAG_SIZE }, () => "gel" as const),
    };
    const pick = takeHutItem(save, "hut-1", 0);
    expect(pick.stored).toBe(false);
    expect(pick.save.bag).toHaveLength(BAG_SIZE);
    expect(nodeStatus(pick.save, "hut-1")).toBe("cleared");
  });
});

describe("DNFs and continues (#1994)", () => {
  it("spends a continue to refill the lives, keeping progress and score", () => {
    const save = { ...clearedPlan("easy"), lives: 1 };
    const dnf = dnfWorkout(save);
    expect(dnf.outOfContinues).toBe(false);
    expect(dnf.save.lives).toBe(START_LIVES);
    expect(dnf.save.continues).toBe(START_CONTINUES - 1);
    expect(dnf.save.score).toBe(save.score);
    expect(dnf.save.cleared).toEqual(save.cleared);
    expect(dnf.save.dnfs).toBe(1);
  });

  it("resets the score, not the map, with no continue left", () => {
    const save = { ...clearedPlan("easy", "tempo"), continues: 0 };
    const dnf = dnfWorkout(save);
    expect(dnf.outOfContinues).toBe(true);
    expect(dnf.save.score).toBe(0);
    expect(dnf.save.continues).toBe(START_CONTINUES);
    expect(dnf.save.cleared).toEqual(["easy", "tempo"]);
  });
});

describe("the Morning Report (#1994)", () => {
  it("rates a fresh plan High and names the first workout", () => {
    const save = newPlan(1);
    expect(trainingReadiness(save)).toEqual({ score: 75, level: "High" });
    expect(nextWorkout(save)?.id).toBe("easy");
  });

  it("drops readiness after DNFs and keeps it between 1 and 100", () => {
    const tired = { ...newPlan(1), lives: 1, dnfs: 3 };
    expect(trainingReadiness(tired)).toEqual({ score: 10, level: "Poor" });
    const fresh = {
      ...newPlan(1),
      lives: 99,
      bag: ["gel", "gel", "gel", "gel"] as PlanSave["bag"],
      lastTe: 5,
    };
    expect(trainingReadiness(fresh)).toEqual({ score: 100, level: "Prime" });
    expect(trainingReadiness({ ...newPlan(1), dnfs: 99 }).score).toBe(1);
  });

  it("has no next workout once Race Day is won", () => {
    const save = clearWorkout(
      clearedPlan("easy", "tempo", "intervals", "long"),
      "raceday",
      RESULT
    );
    expect(nextWorkout(save)).toBeNull();
  });
});

describe("practice runs (#1994)", () => {
  const finished = {
    ...createInitialState("fenix", 0, []),
    gameState: "summary" as const,
    runClockMs: 61_230,
    score: 4000,
    lives: 1,
  };

  it("leave the plan untouched, finished or not", () => {
    const save = clearedPlan("easy", "tempo");
    const done = workoutOutcome(save, "easy", true, finished);
    expect(done.save).toBe(save);
    expect(done.outcome.kind).toBe("practice");
    expect(done.outcome.lines).toContain("TIME 1:01.23");
    const lost = workoutOutcome(save, "tempo", true, {
      ...finished,
      gameState: "crashed",
    });
    expect(lost.save).toBe(save);
    expect(lost.outcome.text).toContain("The plan is unchanged.");
  });

  it("clear the node when it is not a practice run", () => {
    const save = clearedPlan("easy");
    const done = workoutOutcome(save, "tempo", false, finished);
    expect(done.outcome.kind).toBe("cleared");
    expect(done.save.cleared).toEqual(["easy", "tempo"]);
    expect(done.save.lives).toBe(1);
    expect(done.save.score).toBe(save.score + 4000);
    expect(done.outcome.text).toBe(
      "Tempo done in 1:01.23. Intervals and Recovery Hut open."
    );
  });

  it("is a finisher card on Race Day and a DNF card on a lost workout", () => {
    const save = clearedPlan("easy", "tempo", "intervals", "long");
    const won = workoutOutcome(save, "raceday", false, finished);
    expect(won.outcome.kind).toBe("finisher");
    expect(won.save.finished).toBe(true);
    const lost = workoutOutcome(save, "raceday", false, {
      ...finished,
      gameState: "crashed",
    });
    expect(lost.outcome.kind).toBe("dnf");
    expect(lost.save.continues).toBe(START_CONTINUES - 1);
    expect(lost.outcome.text).toBe(
      "DNF, back to training. 1 continue left. Lives back to 3."
    );
  });
});
