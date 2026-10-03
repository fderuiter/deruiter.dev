import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROOF_LAYOUT,
  countLeaves,
  fanPose,
  fitSlotWidth,
  layoutLevelMap,
  layoutProofTree,
  levelMapBadge,
  nodeBoxWidth,
  nodeGlyph,
  prettyMath,
  ramChipFill,
  tacticCardArt,
} from "@/components/QuasiPerfectPuzzler/boardArt";
import { puzzleLevels, tacticDefs } from "@/lib/quasi-perfect";
import type { ASTNode, LevelScore } from "@/lib/quasi-perfect/types";

const countNodes = (node: ASTNode): number =>
  1 + (node.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);

const v = (id: string, value: string): ASTNode => ({
  id,
  type: "Variable",
  value,
});

// (a + b) * c = d, a tree of depth 3 with four leaves.
const sample: ASTNode = {
  id: "eq",
  type: "Equality",
  value: "=",
  children: [
    {
      id: "mul",
      type: "Operator",
      value: "*",
      children: [
        {
          id: "add",
          type: "Operator",
          value: "+",
          children: [v("a", "a"), v("b", "b")],
        },
        v("c", "c"),
      ],
    },
    v("d", "d"),
  ],
};

describe("proof board glyphs (#1519)", () => {
  it("typesets connectives, operators and booleans", () => {
    expect(nodeGlyph({ id: "i", type: "Implication", value: "→" })).toBe("→");
    expect(nodeGlyph({ id: "c", type: "Conjunction", value: "and" })).toBe("∧");
    expect(nodeGlyph({ id: "n", type: "Negation", value: "not" })).toBe("¬");
    expect(nodeGlyph({ id: "m", type: "Operator", value: "*" })).toBe("×");
    expect(nodeGlyph({ id: "s", type: "Operator", value: "-" })).toBe("−");
    expect(nodeGlyph({ id: "t", type: "Boolean", value: true })).toBe("⊤");
    expect(nodeGlyph({ id: "f", type: "Boolean", value: false })).toBe("⊥");
    expect(nodeGlyph(v("x", "x"))).toBe("x");
    // A power is never drawn as ^, which reads as ∧ in a math face.
    expect(nodeGlyph({ id: "p", type: "Operator", value: "^" })).toBe("xⁿ");
  });

  it("typesets formulas for display without changing their terms", () => {
    expect(prettyMath("(a + b) * c = d")).toBe("(a + b) × c = d");
    expect(prettyMath("x - 0 = x")).toBe("x − 0 = x");
    expect(prettyMath("a <= b")).toBe("a ≤ b");
    expect(prettyMath("x = x")).toBe("x = x");
    expect(prettyMath("(a + b) ^ 2 = a ^ 12")).toBe("(a + b)² = a¹²");
  });
});

describe("layoutProofTree", () => {
  const layout = layoutProofTree(sample);

  it("places every node once, parents before children", () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(
      ["a", "add", "b", "c", "d", "eq", "mul"].sort()
    );
    const order = layout.nodes.map((n) => n.id);
    expect(order.indexOf("eq")).toBe(0);
    expect(order.indexOf("mul")).toBeLessThan(order.indexOf("add"));
    expect(order.indexOf("add")).toBeLessThan(order.indexOf("a"));
  });

  it("gives each leaf its own slot and centres parents over their children", () => {
    const at = (id: string) => layout.nodes.find((n) => n.id === id)!;
    const { slotWidth, padding } = DEFAULT_PROOF_LAYOUT;
    expect(layout.leafCount).toBe(4);
    expect(countLeaves(sample)).toBe(4);
    expect(at("a").x).toBe(padding + slotWidth / 2);
    expect(at("b").x).toBe(at("a").x + slotWidth);
    expect(at("add").x).toBe((at("a").x + at("b").x) / 2);
    expect(at("mul").x).toBe((at("add").x + at("c").x) / 2);
    expect(at("eq").x).toBe((at("mul").x + at("d").x) / 2);
    expect(layout.width).toBe(padding * 2 + 4 * slotWidth);
  });

  it("puts depth on rows and keeps every node inside the board", () => {
    for (const n of layout.nodes) {
      expect(n.y).toBeCloseTo(
        layout.nodes[0].y + n.depth * DEFAULT_PROOF_LAYOUT.levelGap
      );
      expect(n.x - n.width / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + n.width / 2).toBeLessThanOrEqual(layout.width);
      expect(n.y - n.height / 2).toBeGreaterThanOrEqual(0);
      expect(n.y + n.height / 2).toBeLessThanOrEqual(layout.height);
    }
    expect(layout.nodes.find((n) => n.isRoot)?.id).toBe("eq");
  });

  it("draws one edge per parent-child pair, from parent bottom to child top", () => {
    expect(layout.edges).toHaveLength(6);
    const edge = layout.edges.find((e) => e.toId === "d")!;
    const parent = layout.nodes.find((n) => n.id === "eq")!;
    const child = layout.nodes.find((n) => n.id === "d")!;
    expect(edge.fromId).toBe("eq");
    expect(
      edge.d.startsWith(`M ${parent.x} ${parent.y + parent.height / 2}`)
    ).toBe(true);
    expect(edge.d.endsWith(`${child.x} ${child.y - child.height / 2}`)).toBe(
      true
    );
  });

  it("lays out every campaign goal without overlapping nodes on a row", () => {
    for (const lvl of puzzleLevels) {
      const l = layoutProofTree(lvl.goal);
      const rows = new Map<number, typeof l.nodes>();
      for (const n of l.nodes)
        rows.set(n.depth, [...(rows.get(n.depth) ?? []), n]);
      for (const row of rows.values()) {
        const sorted = [...row].sort((p, q) => p.x - q.x);
        for (let i = 1; i < sorted.length; i++) {
          const gap =
            sorted[i].x -
            sorted[i].width / 2 -
            (sorted[i - 1].x + sorted[i - 1].width / 2);
          expect(gap, `level ${lvl.id}`).toBeGreaterThan(0);
        }
      }
      expect(l.nodes).toHaveLength(countNodes(lvl.goal));
    }
  });

  it("survives a cyclic tree instead of recursing forever", () => {
    const loop: ASTNode = { id: "p", type: "Negation", value: "¬" };
    loop.children = [loop];
    const l = layoutProofTree(loop);
    expect(l.nodes).toHaveLength(1);
  });
});

describe("fitSlotWidth and nodeBoxWidth", () => {
  it("fits a small tree to the board and clamps a wide one", () => {
    expect(fitSlotWidth(880, 2)).toBe(168);
    expect(fitSlotWidth(880, 8)).toBe(106);
    expect(fitSlotWidth(880, 40)).toBe(64);
    expect(fitSlotWidth(0, 3)).toBe(DEFAULT_PROOF_LAYOUT.slotWidth);
    expect(fitSlotWidth(Number.NaN, 3)).toBe(DEFAULT_PROOF_LAYOUT.slotWidth);
  });

  it("grows a node box with its label and draws the goal larger", () => {
    expect(nodeBoxWidth("=", true)).toBeGreaterThan(nodeBoxWidth("=", false));
    expect(nodeBoxWidth("σσσ", false)).toBeGreaterThan(
      nodeBoxWidth("σ", false)
    );
    expect(nodeBoxWidth("x".repeat(50), false)).toBe(160);
  });
});

describe("tacticCardArt", () => {
  it("maps RAM cost to a rarity edge and pips, with sorry cursed", () => {
    expect(tacticCardArt("rfl", 1)).toEqual({
      glyph: "≡",
      rarity: "common",
      pips: 1,
    });
    expect(tacticCardArt("rw", 2).rarity).toBe("uncommon");
    expect(tacticCardArt("norm_num", 3).rarity).toBe("uncommon");
    expect(tacticCardArt("ring", 4).rarity).toBe("rare");
    expect(tacticCardArt("omega", 10).pips).toBe(3);
    expect(tacticCardArt("sorry", 0)).toEqual({
      glyph: "?",
      rarity: "cursed",
      pips: 0,
    });
  });

  it("gives every tactic a distinct glyph that is not its name", () => {
    const glyphs = Object.values(tacticDefs).map((t) => {
      const art = tacticCardArt(t.id, t.baseRamCost);
      expect(art.glyph).not.toBe(t.name);
      return art.glyph;
    });
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe("fanPose", () => {
  it("keeps one card upright and fans a hand symmetrically", () => {
    expect(fanPose(0, 1)).toEqual({ rotate: 0, translateY: 0 });
    const hand = [0, 1, 2, 3, 4].map((i) => fanPose(i, 5));
    expect(hand[2]).toEqual({ rotate: 0, translateY: 0 });
    expect(hand[0].rotate).toBe(-hand[4].rotate);
    expect(hand[0].translateY).toBe(hand[4].translateY);
    expect(hand[0].rotate).toBeLessThan(hand[1].rotate);
    expect(hand[0].translateY).toBeGreaterThan(hand[1].translateY);
  });

  it("tilts less per card as the hand grows", () => {
    expect(Math.abs(fanPose(0, 8).rotate)).toBeLessThanOrEqual(3.5 * 4 + 0.001);
    const step3 = fanPose(1, 3).rotate - fanPose(0, 3).rotate;
    const step8 = fanPose(1, 8).rotate - fanPose(0, 8).rotate;
    expect(step8).toBeLessThan(step3);
  });
});

describe("ramChipFill", () => {
  it("empties chips from the right as RAM is spent", () => {
    expect(ramChipFill(16, 16, 8)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(ramChipFill(12, 16, 8)).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
    expect(ramChipFill(3, 16, 8)).toEqual([1, 0.5, 0, 0, 0, 0, 0, 0]);
    expect(ramChipFill(0, 16, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("stays in range for odd inputs", () => {
    expect(ramChipFill(40, 16, 4)).toEqual([1, 1, 1, 1]);
    expect(ramChipFill(-3, 16, 4)).toEqual([0, 0, 0, 0]);
    expect(ramChipFill(5, 0, 4)).toEqual([0, 0, 0, 0]);
    expect(ramChipFill(5, 10, 0)).toHaveLength(1);
  });
});

describe("layoutLevelMap", () => {
  const map = layoutLevelMap([6, 6, 6]);

  it("places 18 stops on a serpentine trail, one chapter per row", () => {
    expect(map.nodes).toHaveLength(18);
    expect(map.nodes.map((n) => n.index)).toEqual(
      Array.from({ length: 18 }, (_, i) => i)
    );
    const row = (r: number) => map.nodes.filter((n) => n.row === r);
    // Chapter 1 runs left to right, chapter 2 right to left, chapter 3 again.
    expect(row(0)[0].x).toBeLessThan(row(0)[5].x);
    expect(row(1)[0].x).toBeGreaterThan(row(1)[5].x);
    expect(row(2)[0].x).toBeLessThan(row(2)[5].x);
    // Each row turns back where the previous one ended.
    expect(row(1)[0].x).toBeCloseTo(row(0)[5].x);
    for (const n of map.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(1);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(map.height);
    }
    expect(map.rowY).toHaveLength(3);
  });

  it("draws one continuous path through every stop", () => {
    expect(map.path.startsWith("M ")).toBe(true);
    expect(map.path.match(/C /g)).toHaveLength(17);
  });

  it("handles a chapter of one level", () => {
    const one = layoutLevelMap([1]);
    expect(one.nodes[0].x).toBe(0.5);
  });
});

describe("levelMapBadge", () => {
  const score = (over: Partial<LevelScore>): LevelScore => ({
    levelId: 1,
    completed: true,
    usedSorry: false,
    remainingRam: 10,
    stars: 2,
    morality: 100,
    timestamp: 0,
    ...over,
  });

  it("reads unplayed, solved and admitted levels", () => {
    expect(levelMapBadge(undefined).state).toBe("unplayed");
    expect(levelMapBadge(score({}))).toEqual({
      stars: 2,
      state: "solved",
      description: "Solved, 2 of 3 stars",
    });
    expect(levelMapBadge(score({ usedSorry: true, stars: 0 })).state).toBe(
      "admitted"
    );
    expect(levelMapBadge(score({ stars: 9 })).stars).toBe(3);
  });
});
