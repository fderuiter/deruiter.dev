// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import {
  ACT_TWO_FIRST_CHAPTER,
  generateLeanProofScript,
  puzzleLevels,
  type LeanProofStep,
  type LevelScore,
} from "@/lib/quasi-perfect";
import { ARCADE_TROPHIES, getArcadeProgress } from "@/lib/arcade-achievements";

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

const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";
const lastLevel = puzzleLevels[puzzleLevels.length - 1];

const honest = (levelId: number | string): LevelScore => ({
  levelId,
  completed: true,
  usedSorry: false,
  remainingRam: 7,
  stars: 3,
  morality: 100,
  timestamp: 1,
});

function renderFinale(campaignStars: {
  earned: number;
  possible: number;
  proven: number;
  challengesCleared?: number;
  challengesTotal?: number;
}) {
  return render(
    <VictoryModal
      score={honest(lastLevel.id)}
      level={lastLevel}
      totalLevels={puzzleLevels.length}
      currentLevelIndex={puzzleLevels.length - 1}
      leanCode="-- proof"
      ramUsed={1}
      campaignStars={campaignStars}
      onNextLevel={vi.fn()}
      onRestartLevel={vi.fn()}
    />
  );
}

const card = () => screen.getByTestId("victory-campaign-complete").textContent;

describe("Quasi Puzzler Act 2 payoff and copy (#2202)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("calls a finished Act 2 complete and points at the challenges, not gold", () => {
    renderFinale({
      earned: 90,
      possible: 90,
      proven: 30,
      challengesCleared: 3,
      challengesTotal: 20,
    });
    expect(card()).toContain("Act 2 complete");
    expect(card()).toContain("3 of 20 challenge variants cleared");
    expect(card()).not.toMatch(/chase gold/);
  });

  it("still sends a player short of gold to chase it", () => {
    renderFinale({ earned: 80, possible: 90, proven: 30 });
    expect(card()).toContain("Act 2 complete");
    expect(card()).toContain("chase gold");
  });

  it("says the proof stayed within its RAM budget", () => {
    renderFinale({ earned: 3, possible: 90, proven: 1 });
    expect(document.body.textContent).toContain(
      "within its simulated RAM budget"
    );
    expect(document.body.textContent).not.toMatch(/without exhausting/);
  });

  it("awards the Act 2 trophy when every Act 2 level is proved honestly", () => {
    const trophy = ARCADE_TROPHIES.find((t) => t.id === "quasi_act_two");
    expect(trophy).toMatchObject({
      gameId: "quasi-puzzler",
      milestone: "act_two_proven",
    });

    const completedLevels: Record<string, LevelScore> = {};
    for (const lvl of puzzleLevels) {
      if (lvl.chapter >= ACT_TWO_FIRST_CHAPTER) {
        completedLevels[lvl.id] = honest(lvl.id);
      }
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedLevels, unlockedChapter: 4 })
    );
    render(<QuasiPerfectPuzzler />);
    const click = (el: Element) => act(() => void fireEvent.click(el));
    click(screen.getByRole("button", { name: /^L19$/ }));
    click(
      screen.getByRole("button", { name: /Apply Tactic: intro.* to the goal/i })
    );
    click(
      screen.getByRole("button", {
        name: /Apply Tactic: exact( add_zero)? to the goal/i,
      })
    );
    expect(getArcadeProgress().unlockedTrophies.quasi_act_two).toBeTruthy();
  });

  it("bullets each induction case in the Lean text", () => {
    const step = (leanLine: string, subgoalLabel: string): LeanProofStep => ({
      id: leanLine,
      tacticId: "rw",
      leanLine,
      explanation: "",
      goalBefore: subgoalLabel,
      goalAfter: "",
      subgoalLabel,
    });
    const script = generateLeanProofScript(
      lastLevel,
      [
        step("induction' n with k ih", "Main Goal"),
        step("rfl", "Base case: 0 + 0 = 0"),
        step("rw [add_succ]", "Step case: 0 + (k + 1) = k + 1"),
        step("rw [ih]", "Step case: 0 + (k + 1) = k + 1"),
      ],
      true
    );
    expect(script).toContain(
      [
        "  induction' n with k ih",
        "  · rfl",
        "  · rw [add_succ]",
        "    rw [ih]",
      ].join("\n")
    );
  });
});
