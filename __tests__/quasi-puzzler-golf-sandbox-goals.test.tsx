// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { LevelMap } from "@/components/QuasiPerfectPuzzler/LevelMap";
import { SandboxMode } from "@/components/QuasiPerfectPuzzler/SandboxMode";
import {
  SANDBOX_PRESETS,
  getLevelPar,
  gradeSandboxRun,
  isLevelGolfed,
  mergeLevelScore,
  parseGameProgress,
  parseSandboxProgress,
  puzzleLevels,
  recordSandboxProof,
  tacticDefs,
  cloneAST,
  isProofComplete,
  type LevelScore,
} from "@/lib/quasi-perfect";
import { parseScoreValue } from "@/lib/arcade-achievements";

vi.mock("@/components/ui/CopyButton", () => ({ CopyButton: () => null }));
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

const PROGRESS_KEY = "quasi_perfect_puzzler_progress_v1";
const SANDBOX_KEY = "quasi_perfect_puzzler_sandbox_v1";

const score = (over: Partial<LevelScore>): LevelScore => ({
  levelId: 1,
  completed: true,
  usedSorry: false,
  remainingRam: 10,
  stars: 2,
  morality: 100,
  timestamp: 1,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe("Golfed badge in saved progress (#2059)", () => {
  it("loads progress saved before the badge existed, with no badges", () => {
    const legacy = JSON.stringify({
      completedLevels: {
        1: {
          levelId: 1,
          completed: true,
          usedSorry: false,
          remainingRam: 14,
          stars: 3,
          morality: 100,
          timestamp: 5,
        },
      },
      currentLevelIndex: 1,
    });
    const parsed = parseGameProgress(legacy);
    expect(parsed.completedLevels[1].stars).toBe(3);
    expect(parsed.currentLevelIndex).toBe(1);
    expect(isLevelGolfed(parsed.completedLevels[1])).toBe(false);
    // The arcade score reader scores a golfed save like the legacy one.
    const golfedSave = JSON.stringify({
      ...parsed,
      completedLevels: {
        1: { ...parsed.completedLevels[1], golfed: true, steps: 1 },
      },
    });
    expect(parseScoreValue(golfedSave)).toBe(parseScoreValue(legacy));
    expect(parseScoreValue(golfedSave)).toBeGreaterThan(0);
  });

  it("drops a golfed or steps field of the wrong type", () => {
    const parsed = parseGameProgress(
      JSON.stringify({
        completedLevels: {
          1: { ...score({}), golfed: "yes", steps: "two" },
          2: { ...score({ levelId: 2 }), golfed: true, steps: 1 },
        },
      })
    );
    expect(parsed.completedLevels[1]).not.toHaveProperty("golfed");
    expect(parsed.completedLevels[1]).not.toHaveProperty("steps");
    expect(parsed.completedLevels[1].stars).toBe(2);
    expect(isLevelGolfed(parsed.completedLevels[2])).toBe(true);
    expect(parsed.completedLevels[2].steps).toBe(1);
  });

  it("keeps the badge when a later run wins on stars but misses par", () => {
    const golfed = score({ stars: 2, golfed: true, steps: 1 });
    const moreStars = score({ stars: 3, golfed: false, steps: 4 });
    const kept = mergeLevelScore(golfed, moreStars);
    expect(kept.stars).toBe(3);
    expect(kept.golfed).toBe(true);
  });

  it("adds the badge when a later run golfs but has fewer stars", () => {
    const kept = mergeLevelScore(
      score({ stars: 3 }),
      score({ stars: 1, golfed: true })
    );
    expect(kept.stars).toBe(3);
    expect(isLevelGolfed(kept)).toBe(true);
  });

  it("never awards the badge to a sorry score", () => {
    expect(isLevelGolfed(score({ usedSorry: true, golfed: true }))).toBe(false);
    const kept = mergeLevelScore(
      undefined,
      score({ usedSorry: true, stars: 0, golfed: true })
    );
    expect(isLevelGolfed(kept)).toBe(false);
  });

  it("returns the kept score itself when the badge does not change", () => {
    const base = score({});
    expect(mergeLevelScore(base, score({ stars: 1 }))).toBe(base);
  });
});

describe("Golfed badge on the board", () => {
  it("shows the par next to the gold target and saves Golfed for an at-par proof", () => {
    render(<QuasiPerfectPuzzler />);
    const par = getLevelPar(puzzleLevels[0]);
    expect(screen.getByTestId("quasi-level-par").textContent).toBe(
      `par ${par} tactic`
    );
    expect(screen.getByTestId("quasi-level-targets").textContent).toContain(
      "Gold"
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: rfl to the goal/i })
    );
    expect(screen.getByTestId("victory-golfed")).toBeTruthy();
    const saved = parseGameProgress(localStorage.getItem(PROGRESS_KEY));
    expect(saved.completedLevels[1].golfed).toBe(true);
    expect(saved.completedLevels[1].steps).toBe(1);
  });

  it("shows the badge in the level map after a reload", () => {
    const progress = parseGameProgress(
      JSON.stringify({
        completedLevels: {
          1: score({ golfed: true }),
          2: score({ levelId: 2 }),
        },
      })
    );
    render(
      <LevelMap
        levels={puzzleLevels}
        currentLevelIndex={0}
        progress={progress}
        onSelectLevel={vi.fn()}
      />
    );
    expect(screen.getByTestId("quasi-level-golfed-1")).toBeTruthy();
    expect(screen.queryByTestId("quasi-level-golfed-2")).toBeNull();
    expect(screen.getByRole("button", { name: "L1" })).toBeTruthy();
    expect(
      document.getElementById("quasi-level-badge-1")?.textContent
    ).toContain("Golfed");
  });

  it("explains the par in the victory modal when the run missed it", () => {
    render(
      <VictoryModal
        score={score({ steps: 3, golfed: false })}
        level={puzzleLevels[2]}
        par={2}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={2}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    const text = screen.getByTestId("victory-par").textContent ?? "";
    expect(text).toContain("3 tactics applied. Par 2 tactics.");
    expect(text).toContain("Golfed badge");
    expect(screen.queryByTestId("victory-golfed")).toBeNull();
  });
});

describe("Sandbox preset goals", () => {
  it.each(SANDBOX_PRESETS.map((p) => [p.id, p] as const))(
    "%s: the reference proof meets gold through the engine",
    (_id, preset) => {
      expect(preset.silverRamBudget).toBeGreaterThan(preset.goldRamBudget);
      let goal = cloneAST(preset.goal);
      let hyps = preset.hypotheses.map(cloneAST);
      let spent = 0;
      for (const id of preset.referenceProof) {
        const result = tacticDefs[id].execute(goal, goal, hyps);
        expect(result.success).toBe(true);
        spent += result.ramConsumed;
        if (result.newAST) goal = result.newAST;
        if (result.newHypotheses) hyps = result.newHypotheses;
      }
      expect(isProofComplete(goal)).toBe(true);
      expect(gradeSandboxRun(preset, spent, false)).toBe("gold");
    }
  );

  it("grades by RAM spent and gives sorry no medal", () => {
    const preset = { goldRamBudget: 3, silverRamBudget: 5 };
    expect(gradeSandboxRun(preset, 3, false)).toBe("gold");
    expect(gradeSandboxRun(preset, 4, false)).toBe("silver");
    expect(gradeSandboxRun(preset, 6, false)).toBe("bronze");
    expect(gradeSandboxRun(preset, 0, true)).toBeNull();
  });

  it("keeps the lowest RAM and parses saved progress defensively", () => {
    const first = recordSandboxProof({}, "binomial", 6);
    const better = recordSandboxProof(first, "binomial", 4);
    expect(better.binomial.bestRamUsed).toBe(4);
    expect(recordSandboxProof(better, "binomial", 5)).toBe(better);
    expect(parseSandboxProgress("not json")).toEqual({});
    expect(
      parseSandboxProgress(
        JSON.stringify({
          binomial: { verified: true, bestRamUsed: 4 },
          tautology: { verified: false, bestRamUsed: 3 },
          decidable: { verified: true, bestRamUsed: -1 },
        })
      )
    ).toEqual({ binomial: { verified: true, bestRamUsed: 4 } });
  });

  it("shows the targets, marks a preset verified and remembers it", () => {
    const { unmount } = render(<SandboxMode />);
    const goals = screen.getByTestId("sandbox-goals");
    expect(goals.textContent).toContain("Gold: use 4 GB or less");
    expect(goals.textContent).toContain("Silver: 6 GB or less");
    expect(screen.getByTestId("sandbox-verified").dataset.verified).toBe(
      "false"
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Goal\. Equality node/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Tactic ring\./ }));
    expect(screen.getByTestId("sandbox-ram-used").textContent).toContain(
      "This attempt: 4 GB · Gold"
    );
    expect(screen.getByTestId("sandbox-verified").dataset.verified).toBe(
      "true"
    );
    expect(parseSandboxProgress(localStorage.getItem(SANDBOX_KEY))).toEqual({
      binomial: { verified: true, bestRamUsed: 4 },
    });
    unmount();

    render(<SandboxMode />);
    expect(screen.getByTestId("sandbox-verified").textContent).toContain(
      "Verified · best 4 GB (Gold)"
    );
    expect(screen.getByTestId("sandbox-preset-verified-binomial")).toBeTruthy();
    // The verified mark does not change the preset button's name.
    expect(
      screen.getByRole("button", { name: /^Binomial Expansion \(a \+ b\)²/ })
    ).toBeTruthy();
  });

  it("does not verify a preset admitted with sorry", () => {
    render(<SandboxMode />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Goal\. Equality node/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Tactic (Use )?sorry\./ })
    );
    expect(screen.getByTestId("sandbox-ram-used").textContent).toContain(
      "admitted with sorry"
    );
    expect(screen.getByTestId("sandbox-verified").dataset.verified).toBe(
      "false"
    );
    expect(localStorage.getItem(SANDBOX_KEY)).toBeNull();
  });
});
