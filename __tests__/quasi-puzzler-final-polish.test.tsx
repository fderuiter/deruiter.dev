// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { InlineCodeText } from "@/components/QuasiPerfectPuzzler/InlineCodeText";
import { TacticHand } from "@/components/QuasiPerfectPuzzler/TacticHand";
import { ExpressionTree } from "@/components/QuasiPerfectPuzzler/ExpressionTree";
import {
  parseFormula,
  puzzleLevels,
  renderASTString,
  tacticDefs,
  type LevelScore,
} from "@/lib/quasi-perfect";

const lastLevel = puzzleLevels[puzzleLevels.length - 1];
const score: LevelScore = {
  levelId: lastLevel.id,
  completed: true,
  usedSorry: false,
  remainingRam: 7,
  stars: 3,
  morality: 100,
  timestamp: 1,
};

function renderFinale(
  extra: Partial<React.ComponentProps<typeof VictoryModal>>
) {
  return render(
    <VictoryModal
      score={score}
      level={lastLevel}
      totalLevels={puzzleLevels.length}
      currentLevelIndex={puzzleLevels.length - 1}
      leanCode="-- proof"
      ramUsed={1}
      campaignStars={{ earned: 90, possible: 90, proven: 30 }}
      onNextLevel={vi.fn()}
      onRestartLevel={vi.fn()}
      onRestartCampaign={vi.fn()}
      {...extra}
    />
  );
}

describe("Quasi Puzzler final polish (#2246-#2249)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the finale card at its top and points at the level map (#2246)", () => {
    const onOpenLevelMap = vi.fn();
    renderFinale({ onOpenLevelMap });
    const card = screen.getByRole("dialog").firstElementChild as HTMLElement;
    expect(card.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Open Level Map" }));
    expect(onOpenLevelMap).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Back to Level 1" })
    ).toBeNull();
  });

  it("keeps Back to Level 1 where no level map is offered (#2246)", () => {
    renderFinale({});
    expect(
      screen.getByRole("button", { name: "Back to Level 1" })
    ).toBeTruthy();
  });

  it("lets rfl close an equality of closed numerals (#2248)", () => {
    const goal = parseFormula("3 + 7 = 10", "t");
    const result = tacticDefs.rfl.execute(goal, goal, []);
    expect(result.success).toBe(true);
    expect(result.isProofComplete).toBe(true);

    const wrong = parseFormula("3 + 7 = 11", "t");
    expect(tacticDefs.rfl.execute(wrong, wrong, []).success).toBe(false);
    const open = parseFormula("a + b = b + a", "t");
    expect(tacticDefs.rfl.execute(open, open, []).success).toBe(false);
  });

  it("renders backtick spans in briefing copy as code (#2249)", () => {
    const { container } = render(
      <InlineCodeText text="Play `use 3`, then `norm_num`." />
    );
    expect(container.textContent).toBe("Play use 3, then norm_num.");
    const codes = container.querySelectorAll("code");
    expect(Array.from(codes).map((c) => c.textContent)).toEqual([
      "use 3",
      "norm_num",
    ]);
    cleanup();
    // An unmatched backtick stays as typed.
    const { container: odd } = render(<InlineCodeText text="a ` b" />);
    expect(odd.textContent).toBe("a ` b");
  });

  it("groups consecutive binders when printing (#2249)", () => {
    expect(
      renderASTString(parseFormula("∀ a b c, a * (b + c) = a * b + a * c", "t"))
    ).toBe("∀ a b c, a * (b + c) = a * b + a * c");
    expect(renderASTString(parseFormula("∀ n, ∃ m, m = n", "t"))).toBe(
      "∀ n, ∃ m, m = n"
    );
  });

  it("uses compact cards for a crowded fan on a narrow screen (#2249)", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("max-width: 1179px"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList
    );
    const level = puzzleLevels.find(
      (l) => l.availableTactics.length >= 7 && l.availableTactics.length <= 8
    )!;
    expect(level).toBeDefined();
    const { container } = render(
      <TacticHand
        availableTactics={level.availableTactics}
        currentRam={level.initialRam}
        selectedTacticIndex={null}
        onSelectTactic={() => {}}
        onCardDragStart={() => {}}
        onCardDragEnd={() => {}}
      />
    );
    const card = container.querySelector("[data-tactic-id]") as HTMLElement;
    expect(card.className).toContain("w-[96px]");
  });
  it("puts the induction hypothesis first in the Γ row (#2247)", () => {
    const hyp = (name: string, text: string) => ({
      ...parseFormula(text, name),
      metadata: { name },
    });
    render(
      <ExpressionTree
        goalAST={parseFormula("σ(2 ^ (k + 1)) + 1 = 2 ^ (k + 1 + 1)", "g")}
        hypotheses={[
          hyp("σ_base", "σ(1) = 1"),
          hyp("pow_double", "2 ^ m + 2 ^ m = 2 ^ (m + 1)"),
          hyp("ih", "σ(2 ^ k) + 1 = 2 ^ (k + 1)"),
        ]}
        selectedTargetId={null}
        hoveredTargetId={null}
        onSelectTarget={() => {}}
        onHoverTarget={() => {}}
      />
    );
    const chips = screen
      .getByTestId("hypotheses-row")
      .querySelectorAll("button[data-node-id]");
    expect(chips[0].textContent).toContain("ih");
  });
});
