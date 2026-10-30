// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  useQuasiSession,
  type QuasiSessionEvent,
} from "@/components/QuasiPerfectPuzzler/useQuasiSession";
import { useQuasiSandboxSession } from "@/components/QuasiPerfectPuzzler/useQuasiSandboxSession";
import type { ArcadeFx } from "@/hooks/useArcadeFx";
import { safeClear } from "@/lib/safe-storage";

/**
 * The Quasi-Perfect Puzzler sessions on their own (#3433): one intent from
 * each group (arming, proving, history, goals and the sandbox), the named
 * events, and a failed tactic that stays armed (#1232).
 */

// A fresh session opens on Level 1 (rfl, sorry). By index, Level 2 deals
// symm, rw [h], rfl and sorry, and Level 9 split, exact h_p, exact h_q and
// sorry.
const LEVEL_TWO = 1;
const LEVEL_NINE = 8;

function renderSession() {
  const events: QuasiSessionEvent[] = [];
  const fx = fromPartial<ArcadeFx>({ shake: vi.fn(), flash: vi.fn() });
  const hook = renderHook(() =>
    useQuasiSession({ fx, onEvent: (event) => events.push(event) })
  );
  return { ...hook, events, fx };
}

function openLevel(
  result: ReturnType<typeof renderSession>["result"],
  index: number
) {
  act(() => result.current.loadLevel(index));
  expect(result.current.currentLevelIndex).toBe(index);
}

beforeEach(() => safeClear());
afterEach(() => cleanup());

describe("useQuasiSession arming", () => {
  it("arms and disarms a tactic, and selects a target", () => {
    const { result } = renderSession();
    act(() => result.current.arm(1));
    expect(result.current.selectedTacticIndex).toBe(1);
    act(() => result.current.disarm());
    expect(result.current.selectedTacticIndex).toBeNull();

    const rootId = result.current.goalAST.id;
    act(() => result.current.selectTarget(rootId));
    expect(result.current.selectedTargetId).toBe(rootId);
  });

  it("keeps a failed tactic armed so it can be retargeted (#1232)", () => {
    const { result, events, fx } = renderSession();
    openLevel(result, LEVEL_TWO);
    const ram = result.current.currentRam;

    // rw [h] on the whole equality is refused: it rewrites sub-terms only.
    act(() => result.current.arm(1));
    act(() => result.current.applyTactic(1, result.current.goalAST.id));

    expect(result.current.selectedTacticIndex).toBe(1);
    expect(result.current.proofSteps).toHaveLength(0);
    expect(result.current.currentRam).toBeLessThan(ram);
    expect(events).toEqual([
      { type: "tacticFailed", tacticId: "rw", reason: "refused" },
    ]);
    expect(fx.shake).toHaveBeenCalled();
  });
});

describe("useQuasiSession proving", () => {
  it("solves Level 1 with rfl: applied, goal closed, level solved", () => {
    const { result, events } = renderSession();
    act(() => result.current.applyTactic(0, result.current.goalAST.id));

    expect(result.current.levelSolved).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      "tacticApplied",
      "goalClosed",
      "levelSolved",
    ]);
    const solved = events.find((e) => e.type === "levelSolved");
    expect(solved).toMatchObject({
      score: { levelId: 1, usedSorry: false, completed: true },
    });
    expect(result.current.parsedProgress.completedLevels[1]).toMatchObject({
      completed: true,
      usedSorry: false,
    });
  });

  it("admits the goal with sorry", () => {
    const { result, events } = renderSession();
    act(() => result.current.admitSorry());

    expect(result.current.levelSolved).toBe(true);
    expect(result.current.currentScore?.usedSorry).toBe(true);
    expect(events[0]).toEqual({ type: "tacticApplied", tacticId: "sorry" });
  });
});

describe("useQuasiSession history", () => {
  it("undoes, redoes and resets a step", () => {
    const { result } = renderSession();
    openLevel(result, LEVEL_TWO);
    act(() => result.current.applyTactic(0, result.current.goalAST.id));
    expect(result.current.proofSteps).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.proofSteps).toHaveLength(0);
    act(() => result.current.redo());
    expect(result.current.proofSteps).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.proofSteps).toHaveLength(0);
    expect(result.current.history).toHaveLength(0);
  });
});

describe("useQuasiSession goals", () => {
  it("splits a conjunction into subgoals and moves between them", () => {
    const { result, events } = renderSession();
    openLevel(result, LEVEL_NINE);
    act(() => result.current.applyTactic(0, result.current.goalAST.id));

    expect(result.current.subgoals).toHaveLength(2);
    expect(events).toContainEqual({ type: "subgoalsSplit", count: 2 });
    act(() => result.current.setActiveGoal(1));
    expect(result.current.activeGoalIndex).toBe(1);
    expect(result.current.activeSubgoal).toBe(result.current.subgoals[1]);
  });
});

describe("useQuasiSandboxSession", () => {
  it("compiles a custom formula into the goal", () => {
    const { result } = renderHook(() => useQuasiSandboxSession());
    const preset = result.current.currentGoal;
    act(() => result.current.setCustomGoalInput("x + 0 = x"));
    expect(result.current.parseResult.ast).not.toBeNull();
    act(() => result.current.compile());

    expect(result.current.selectedPresetIdx).toBeNull();
    expect(result.current.currentGoal.id).toMatch(/^custom-goal/);
    expect(result.current.currentGoal).not.toBe(preset);
    expect(result.current.activeFormulaTitle).toMatch(/^Custom Formula: /);
    expect(result.current.isComplete).toBe(false);
  });

  it("applies a tactic, keeping a failed one armed (#2323)", () => {
    const { result } = renderHook(() => useQuasiSandboxSession());
    const rfl = result.current.allTacticIds.indexOf("rfl");
    const ring = result.current.allTacticIds.indexOf("ring");

    act(() => result.current.setSelectedTacticIndex(rfl));
    act(() => result.current.apply(rfl, result.current.currentGoal.id));
    expect(result.current.isComplete).toBe(false);
    expect(result.current.selectedTacticIndex).toBe(rfl);

    act(() => result.current.apply(ring, result.current.currentGoal.id));
    expect(result.current.isComplete).toBe(true);
    expect(result.current.selectedTacticIndex).toBeNull();
  });
});
