// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { puzzleLevels } from "@/lib/quasi-perfect";
import { getArcadeProgress, parseScoreValue } from "@/lib/arcade-achievements";

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

const applyTactic = (name: RegExp) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`Apply Tactic: ${name.source} to the goal`, "i"),
    })
  );

const lastLevel = puzzleLevels[puzzleLevels.length - 1];
const goldScore = {
  levelId: lastLevel.id,
  completed: true,
  usedSorry: false,
  remainingRam: lastLevel.goldRamTarget,
  stars: 3,
  morality: 100,
  timestamp: 1,
};

describe("Quasi Puzzler playtest fixes (#1939)", () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not record arcade score for a level closed with sorry", () => {
    render(<QuasiPerfectPuzzler />);
    applyTactic(/sorry/);
    expect(screen.getByText(/GOAL ADMITTED VIA SORRY/)).toBeTruthy();
    expect(getArcadeProgress().highScores["quasi-puzzler"] ?? 0).toBe(0);
  });

  it("records arcade score for an honest proof", () => {
    render(<QuasiPerfectPuzzler />);
    applyTactic(/rfl/);
    expect(getArcadeProgress().highScores["quasi-puzzler"]).toBe(100);
  });

  it("closes the victory card on Escape and brings it back on request", () => {
    render(<QuasiPerfectPuzzler />);
    applyTactic(/rfl/);
    const dialog = screen.getByRole("dialog", { name: /solved/i });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /solved/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show result" }));
    expect(screen.getByRole("dialog", { name: /solved/i })).toBeTruthy();
  });

  it("ignores shortcut keys typed into a field", () => {
    const { container } = render(<QuasiPerfectPuzzler />);
    const section = container.querySelector("section");
    expect(section).toBeTruthy();
    const input = document.createElement("input");
    section!.appendChild(input);
    const before = screen.queryAllByRole("dialog").length;
    fireEvent.keyDown(input, { key: "b" });
    expect(screen.queryAllByRole("dialog").length).toBe(before);
    fireEvent.keyDown(section!, { key: "b" });
    expect(screen.queryAllByRole("dialog").length).toBeGreaterThan(before);
  });

  it("focuses the main action when the result card opens", () => {
    render(<QuasiPerfectPuzzler />);
    applyTactic(/rfl/);
    expect(document.activeElement?.textContent).toMatch(/Next Level/);
  });

  it("labels the stars and states the RAM each star needs", () => {
    const level = puzzleLevels[0];
    render(
      <VictoryModal
        score={{ ...goldScore, levelId: level.id, stars: 2 }}
        level={level}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        ramUsed={3}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    expect(screen.getByRole("img", { name: "2 of 3 stars" })).toBeTruthy();
    const targets = screen.getByTestId("victory-star-targets").textContent;
    expect(targets).toContain("You used 3.0 GB.");
    expect(targets).toContain(
      `Gold: use ${level.initialRam - level.goldRamTarget} GB or less.`
    );
  });

  it("only calls the campaign complete when every level is proven", () => {
    render(
      <VictoryModal
        score={goldScore}
        level={lastLevel}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={puzzleLevels.length - 1}
        campaignStars={{ earned: 3, possible: 54, proven: 1 }}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
        onRestartCampaign={vi.fn()}
      />
    );
    const card = screen.getByTestId("victory-campaign-complete");
    expect(card.textContent).toContain("Final level cleared");
    expect(card.textContent).not.toContain("Campaign complete");
  });

  it("ends the campaign after the last level", () => {
    const restart = vi.fn();
    render(
      <VictoryModal
        score={goldScore}
        level={lastLevel}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={puzzleLevels.length - 1}
        campaignStars={{ earned: 86, possible: 90, proven: 30 }}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
        onRestartCampaign={restart}
      />
    );
    const card = screen.getByTestId("victory-campaign-complete");
    expect(within(card).getByText("Campaign complete")).toBeTruthy();
    expect(card.textContent).toContain("30 of 30 levels proven honestly");
    expect(card.textContent).toContain("86 of 90 stars");
    fireEvent.click(screen.getByRole("button", { name: "Back to Level 1" }));
    expect(restart).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Next Level/ })).toBeNull();
  });
});

describe("arcade score from saved Quasi progress (#1939)", () => {
  it("counts only levels proven without sorry", () => {
    const raw = JSON.stringify({
      completedLevels: {
        1: { usedSorry: false, stars: 3 },
        2: { usedSorry: true, stars: 0 },
        3: { usedSorry: false, stars: 1 },
      },
    });
    expect(parseScoreValue(raw)).toBe(200);
  });
});
