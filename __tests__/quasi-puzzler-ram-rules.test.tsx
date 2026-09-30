// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { TacticHand } from "@/components/QuasiPerfectPuzzler/TacticHand";
import {
  describeModeRules,
  getTacticBlock,
  puzzleLevels,
  tacticDefs,
  type ASTNode,
  type TacticId,
} from "@/lib/quasi-perfect";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

// #1651: sorry still cleared a level at 0 GB although every copy of the rules
// says the level must be reset, and simp's no-progress warning named 6 GB
// while the engine charged 1 GB.

const variable = (id: string, value: string): ASTNode => ({
  id,
  type: "Variable",
  value,
});

describe("getTacticBlock (#1651)", () => {
  it("locks sorry, like every tactic, once RAM reaches 0 GB", () => {
    expect(getTacticBlock(tacticDefs.sorry, 0)?.reason).toBe("exhausted");
    expect(getTacticBlock(tacticDefs.rfl, 0)?.reason).toBe("exhausted");
    expect(getTacticBlock(tacticDefs.sorry, 0)?.message).toMatch(/reset/i);
  });

  it("allows sorry while any RAM remains", () => {
    expect(getTacticBlock(tacticDefs.sorry, 1)).toBeNull();
  });

  it("reports the real shortfall when a tactic costs more than is left", () => {
    const block = getTacticBlock(tacticDefs.omega, 3);
    expect(block?.reason).toBe("insufficient");
    expect(block?.message).toContain(`${tacticDefs.omega.baseRamCost} GB`);
    expect(block?.message).toContain("3.0 GB");
  });

  it("matches the exhaustion rule the game describes", () => {
    expect(describeModeRules("story").exhaustion).toMatch(/sorry/);
    expect(describeModeRules("hacker").exhaustion).toBe(
      describeModeRules("story").exhaustion
    );
  });
});

describe("tactic charges match their messages (#1651)", () => {
  it("simp's no-progress warning states the RAM actually charged", () => {
    const x = variable("x", "x");
    const result = tacticDefs.simp.execute(x, x, []);
    expect(result.success).toBe(false);
    expect(result.ramConsumed).toBe(tacticDefs.simp.failureCost);
    expect(result.message).toContain(`${result.ramConsumed} GB`);
    expect(result.message).not.toContain(`${tacticDefs.simp.baseRamCost} GB`);
  });

  it("every failed tactic charges its failureCost and names only that figure", () => {
    const goal: ASTNode = {
      id: "goal",
      type: "Equality",
      value: "=",
      children: [variable("l", "p"), variable("r", "q")],
    };
    const hyp: ASTNode = {
      id: "hyp",
      type: "Equality",
      value: "=",
      metadata: { name: "h" },
      children: [variable("ha", "a"), variable("hb", "b")],
    };
    const targets = [goal, goal.children![0]];
    let failures = 0;
    for (const id of Object.keys(tacticDefs) as TacticId[]) {
      const tactic = tacticDefs[id];
      for (const target of targets) {
        for (const hyps of [[], [hyp]]) {
          const result = tactic.execute(target, goal, hyps);
          const expected = result.success
            ? tactic.baseRamCost
            : tactic.failureCost;
          expect(result.ramConsumed, `${id} ramConsumed`).toBe(expected);
          for (const match of result.message.matchAll(/(\d+(?:\.\d+)?) GB/g)) {
            expect(Number(match[1]), `${id}: ${result.message}`).toBe(
              result.ramConsumed
            );
          }
          if (!result.success) failures += 1;
        }
      }
    }
    expect(failures).toBeGreaterThan(10);
  });
});

describe("TacticHand counter (#1651)", () => {
  it("counts only playable cards", () => {
    render(
      <TacticHand
        availableTactics={["rfl", "rw", "simp", "sorry"]}
        currentRam={1}
        selectedTacticIndex={null}
        onSelectTactic={vi.fn()}
        onCardDragStart={vi.fn()}
        onCardDragEnd={vi.fn()}
      />
    );
    expect(screen.getByTestId("tactic-hand-count").textContent).toBe(
      "4 cards, 2 playable"
    );
    cleanup();
  });

  it("shows no playable cards at 0 GB", () => {
    render(
      <TacticHand
        availableTactics={["rfl", "sorry"]}
        currentRam={0}
        selectedTacticIndex={null}
        onSelectTactic={vi.fn()}
        onCardDragStart={vi.fn()}
        onCardDragEnd={vi.fn()}
      />
    );
    expect(screen.getByTestId("tactic-hand-count").textContent).toBe(
      "2 cards, 0 playable"
    );
    cleanup();
  });
});

describe("Quasi-Perfect Puzzler refuses sorry at 0 GB (#1651)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("quasi_perfect_puzzler_mode_v1", "hacker");
  });

  afterEach(() => {
    cleanup();
  });

  it("does not clear Level 2 with sorry after RAM is exhausted", () => {
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: /^L2\b/ }));
    expect(
      document.getElementById("quasi-current-level-heading")?.textContent
    ).toBe(puzzleLevels[1].title);

    const rfl = screen.getByRole("button", {
      name: /Apply Tactic: rfl to the goal/i,
    });
    for (let i = 0; i < puzzleLevels[1].initialRam; i += 1) {
      fireEvent.click(rfl);
    }
    expect(screen.getByText(/RAM Memory: 0\.0 GB/)).toBeTruthy();
    expect(
      screen.getAllByText(/SIMULATED RAM EXHAUSTED/).length
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: sorry to the goal/i })
    );

    expect(screen.getByText(/Proof Status: In Progress/)).toBeTruthy();
    expect(screen.getByText(/Steps Applied: 0/)).toBeTruthy();
    expect(screen.queryByText(/Morality (Penalty|exception)/i)).toBeNull();
    expect(screen.getAllByText(/Reset the level/i).length).toBeGreaterThan(0);
  });
});
