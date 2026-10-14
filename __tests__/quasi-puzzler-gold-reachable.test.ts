// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cloneAST,
  computeLevelStars,
  getLevelPar,
  getLevelVariants,
  getRunStartingRam,
  isGolfedRun,
  isStepLimitReached,
  isVariantRunCleared,
  isProofComplete,
  LEVEL_REFERENCE_PROOFS,
  LEVEL_VARIANT_RULES,
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
function playPath(
  level: PuzzlerLevelDef,
  path: readonly TacticId[],
  hand: PuzzlerLevelDef["availableTactics"] = level.availableTactics
) {
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
    const cards = hand.filter((t) => (typeof t === "string" ? t : t.id) === id);
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

describe("Quasi Puzzler variants (#2090)", () => {
  it("authors variant rules for every level", () => {
    expect(Object.keys(LEVEL_VARIANT_RULES).map(Number)).toEqual(
      puzzleLevels.map((l) => l.id)
    );
  });

  const cases = puzzleLevels.flatMap((level) =>
    getLevelVariants(level).map((v) => [level.id, v.kind, level, v] as const)
  );

  it.each(cases)(
    "level %i, %s: the reference proof clears the variant",
    (_id, _kind, level, variant) => {
      const hand = level.availableTactics.filter(
        (t) => (typeof t === "string" ? t : t.id) !== variant.bannedTactic
      );
      for (const tactic of variant.referenceProof) {
        expect(tactic).not.toBe("sorry");
        expect(tactic).not.toBe(variant.bannedTactic);
        expect(offered({ ...level, availableTactics: hand }).has(tactic)).toBe(
          true
        );
      }
      const { solved, used, steps } = playPath(
        level,
        variant.referenceProof,
        hand
      );
      expect(solved).toBe(true);
      // Hacker Mode is the tighter budget, so a proof that fits it fits both.
      expect(used).toBeLessThanOrEqual(
        getRunStartingRam(level, "hacker", variant)
      );
      expect(isVariantRunCleared(variant, steps, false)).toBe(true);
      // The run never trips the step limit on its way to the proof.
      for (let s = 0; s < steps; s++) {
        expect(isStepLimitReached(variant, s, false)).toBe(false);
      }
    }
  );

  it.each(puzzleLevels.map((l) => [l.id, l] as const))(
    "level %i: variants tighten the level rather than repeat it",
    (_id, level) => {
      const variants = getLevelVariants(level);
      const kinds = variants.map((v) => v.kind);
      expect(kinds).toContain("tight-ram");
      expect(kinds).toContain("step-limit");
      const tight = variants.find((v) => v.kind === "tight-ram");
      // At or below the gold budget, in both modes.
      const goldBudget = level.initialRam - level.goldRamTarget;
      expect(tight?.startingRam).toBeLessThanOrEqual(goldBudget);
      expect(getRunStartingRam(level, "story", tight)).toBe(tight?.startingRam);
      expect(variants.find((v) => v.kind === "step-limit")?.stepLimit).toBe(
        getLevelPar(level)
      );
      const banned = variants.find((v) => v.kind === "banned");
      if (banned) {
        // A ban only counts when it removes a tactic the usual proof needs.
        expect(LEVEL_REFERENCE_PROOFS[Number(level.id)]).toContain(
          banned.bannedTactic
        );
        expect(offered(level).has(banned.bannedTactic as TacticId)).toBe(true);
      }
    }
  );

  it("offers a banned-tactic variant on the levels with a second route", () => {
    expect(
      puzzleLevels
        .filter((l) => getLevelVariants(l).some((v) => v.kind === "banned"))
        .map((l) => l.id)
    ).toEqual([5, 12, 13, 14, 16, 19, 20, 25, 26, 27, 28, 30]);
  });
});
