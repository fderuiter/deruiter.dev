// @vitest-environment jsdom
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { TacticCard } from "@/components/QuasiPerfectPuzzler/TacticCard";
import { parseFormula, puzzleLevels, tacticDefs } from "@/lib/quasi-perfect";

const rfl = (text: string) => {
  const goal = parseFormula(text, "t");
  return tacticDefs.rfl.execute(goal, goal, []);
};

describe("Quasi Puzzler rfl honesty and tablet hand (#2277, #2278)", () => {
  afterEach(cleanup);

  it("closes what Nat reduces by definition, as Lean's rfl does (#2277)", () => {
    expect(rfl("x + 0 = x").success).toBe(true);
    expect(rfl("x + 0 = x").isProofComplete).toBe(true);
    expect(rfl("n * 0 = 0").success).toBe(true);
    expect(rfl("(a + b) + 0 = a + b").success).toBe(true);
  });

  it("still needs a lemma for 0 + x = x, as Lean does (#2277)", () => {
    const result = rfl("0 + x = x");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/type mismatch/);
  });

  it("says what a false closed sum evaluates to (#2277)", () => {
    const result = rfl("3 + 7 = 11");
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "error: 'rfl' failed: 3 + 7 evaluates to 10, not 11."
    );
  });

  it("drops the decoy rfl from Level 5's hand (#2277)", () => {
    const level5 = puzzleLevels.find((l) => l.id === 5)!;
    const ids = level5.availableTactics.map((t) =>
      typeof t === "string" ? t : t.id
    );
    expect(ids).not.toContain("rfl");
    expect(ids).toEqual(expect.arrayContaining(["rw", "simp"]));
  });

  it("marks compact cards so a crowded touch hand can shrink them (#2278)", () => {
    const { container, rerender } = render(
      <TacticCard
        tactic={tacticDefs.induction}
        isSelected={false}
        disabled={false}
        compact
        onSelect={() => {}}
      />
    );
    const card = () =>
      container.querySelector("[data-tactic-id]") as HTMLElement;
    expect(card().className).toContain("qp-card-compact");
    rerender(
      <TacticCard
        tactic={tacticDefs.induction}
        isSelected={false}
        disabled={false}
        onSelect={() => {}}
      />
    );
    expect(card().className).not.toContain("qp-card-compact");
  });
});
