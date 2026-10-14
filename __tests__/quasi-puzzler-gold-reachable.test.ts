// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cloneAST,
  computeLevelStars,
  getLevelPar,
  isGolfedRun,
  isProofComplete,
  LEVEL_REFERENCE_PROOFS,
  puzzleLevels,
  tacticDefs,
  type ASTNode,
  type PuzzlerLevelDef,
  type SubGoal,
  type TacticId,
} from "@/lib/quasi-perfect";

/**
 * #1939: levels 11 and 16 asked for more RAM left than their own hinted
 * solution could leave, so gold was impossible. Each entry of
 * LEVEL_REFERENCE_PROOFS is the cheapest proof the level's hints describe; it
 * must earn three stars in Hacker Mode. The proofs are run through the tactic
 * engine, so a path that only adds up on paper (L16's `simp`, which has no
 * rule for `>`) fails here. The same paths set each level's step par (#2059).
 */
const REFERENCE_PATHS = LEVEL_REFERENCE_PROOFS;

const offered = (level: (typeof puzzleLevels)[number]) =>
  new Set(
    level.availableTactics.map((t) => (typeof t === "string" ? t : t.id))
  );

const nodesOf = (root: ASTNode): ASTNode[] => [
  root,
  ...(root.children ?? []).flatMap(nodesOf),
];

/**
 * Plays a path the way the board does: each tactic goes to the first target
 * it succeeds on (root goal, then any goal node, then any hypothesis node),
 * and a split goal is worked through branch by branch.
 */
function playPath(level: PuzzlerLevelDef, path: readonly TacticId[]) {
  let subgoals: SubGoal[] = [
    {
      id: "root",
      label: "goal",
      goal: cloneAST(level.goal),
      hypotheses: level.hypotheses.map(cloneAST),
      isCompleted: false,
    },
  ];
  let active = 0;
  let used = 0;
  let steps = 0;
  // A level can offer one tactic twice with different hypotheses (rw [h1],
  // rw [h2]); the nth use of an id takes the nth card for it.
  const seen = new Map<TacticId, number>();
  const offeredArg = (id: TacticId) => {
    const cards = level.availableTactics.filter(
      (t) => (typeof t === "string" ? t : t.id) === id
    );
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    const item = cards[Math.min(n, cards.length - 1)];
    return typeof item === "object" ? item.hypothesis : undefined;
  };
  for (const id of path) {
    const goal = subgoals[active];
    if (!goal) return { solved: false, used, steps };
    const targets = [
      ...nodesOf(goal.goal),
      ...goal.hypotheses.flatMap(nodesOf),
    ];
    const arg = offeredArg(id);
    const result = targets
      .map((node) =>
        tacticDefs[id].execute(node, goal.goal, goal.hypotheses, arg)
      )
      .find((r) => r.success);
    if (!result) return { solved: false, used, steps, failedAt: id };
    used += result.ramConsumed;
    steps += 1;
    if (result.newSubGoals && result.newSubGoals.length > 0) {
      subgoals = [
        ...subgoals.slice(0, active),
        ...result.newSubGoals,
        ...subgoals.slice(active + 1),
      ];
    } else if (result.newAST) {
      subgoals[active] = {
        ...goal,
        goal: result.newAST,
        hypotheses: result.newHypotheses ?? goal.hypotheses,
        isCompleted: !!result.isProofComplete || isProofComplete(result.newAST),
      };
    } else if (result.isProofComplete) {
      subgoals[active] = { ...goal, isCompleted: true };
    }
    const next = subgoals.findIndex((g) => !g.isCompleted);
    active = next === -1 ? subgoals.length : next;
  }
  return { solved: subgoals.every((g) => g.isCompleted), used, steps };
}

describe("Quasi Puzzler gold targets", () => {
  it("has a reference path for every level", () => {
    expect(Object.keys(REFERENCE_PATHS).map(Number)).toEqual(
      puzzleLevels.map((l) => l.id)
    );
  });

  it.each(puzzleLevels.map((l) => [l.id, l] as const))(
    "level %i: the hinted proof earns three stars",
    (id, level) => {
      const path = REFERENCE_PATHS[Number(id)];
      for (const tactic of path) expect(offered(level).has(tactic)).toBe(true);
      const { solved, used } = playPath(level, path);
      expect(solved).toBe(true);
      expect(
        computeLevelStars(level, "hacker", level.initialRam - used, false)
      ).toBe(3);
      expect(level.silverRamTarget).toBeLessThan(level.goldRamTarget);
    }
  );
});

describe("Quasi Puzzler step par (#2059)", () => {
  it.each(puzzleLevels.map((l) => [l.id, l] as const))(
    "level %i: par is reachable through the engine and earns Golfed",
    (id, level) => {
      const par = getLevelPar(level);
      expect(par).not.toBeNull();
      expect(par).toBeGreaterThan(0);
      const { solved, steps } = playPath(level, REFERENCE_PATHS[Number(id)]);
      expect(solved).toBe(true);
      expect(steps).toBe(par);
      expect(isGolfedRun(steps, par, false)).toBe(true);
      // One tactic over par, or any sorry, misses the badge.
      expect(isGolfedRun(steps + 1, par, false)).toBe(false);
      expect(isGolfedRun(steps, par, true)).toBe(false);
    }
  );
});
