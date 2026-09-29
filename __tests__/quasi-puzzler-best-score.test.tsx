// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { puzzleLevels, type LevelScore } from "@/lib/quasi-perfect";

vi.mock("@/components/ui/CopyButton", () => ({ CopyButton: () => null }));

const score = (over: Partial<LevelScore>): LevelScore => ({
  levelId: 1,
  completed: true,
  usedSorry: false,
  remainingRam: 20,
  stars: 3,
  morality: 100,
  timestamp: 1,
  ...over,
});

describe("VictoryModal best-score labelling (#1230)", () => {
  it("labels the run just completed and shows the retained best after a sorry replay", () => {
    render(
      <VictoryModal
        score={score({ usedSorry: true, stars: 0, morality: -100 })}
        savedBest={score({})}
        level={puzzleLevels[0]}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    expect(screen.getByTestId("victory-run-label").textContent).toBe(
      "This run"
    );
    const best = screen.getByTestId("victory-saved-best").textContent ?? "";
    expect(best).toContain("3 of 3 stars");
    expect(best).toContain("did not replace it");
  });
});
