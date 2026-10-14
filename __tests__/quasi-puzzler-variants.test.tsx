// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { LevelMap } from "@/components/QuasiPerfectPuzzler/LevelMap";
import { VariantPicker } from "@/components/QuasiPerfectPuzzler/VariantPicker";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import {
  areVariantsUnlocked,
  getLevelVariant,
  getLevelVariants,
  getRunStartingRam,
  isStepLimitReached,
  isTacticBanned,
  isVariantCleared,
  isVariantRunCleared,
  normalizeClearedVariants,
  parseGameProgress,
  puzzleLevels,
  recordClearedVariant,
  type GameProgressState,
  type LevelScore,
} from "@/lib/quasi-perfect";

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

const score = (over: Partial<LevelScore>): LevelScore => ({
  levelId: 1,
  completed: true,
  usedSorry: false,
  remainingRam: 15,
  stars: 3,
  morality: 100,
  timestamp: 1,
  golfed: true,
  steps: 1,
  ...over,
});

const levelById = (id: number) => puzzleLevels.find((l) => l.id === id)!;

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe("variant rules", () => {
  it("unlocks only after an honest clear", () => {
    expect(areVariantsUnlocked(null, 1)).toBe(false);
    expect(areVariantsUnlocked({ completedLevels: {} }, 1)).toBe(false);
    expect(
      areVariantsUnlocked(
        { completedLevels: { 1: score({ usedSorry: true, stars: 0 }) } },
        1
      )
    ).toBe(false);
    expect(
      areVariantsUnlocked(
        { completedLevels: { 1: score({ completed: false }) } },
        1
      )
    ).toBe(false);
    expect(areVariantsUnlocked({ completedLevels: { 1: score({}) } }, 1)).toBe(
      true
    );
  });

  it("finds variants by kind and returns null for the base level", () => {
    expect(getLevelVariant(levelById(1), null)).toBeNull();
    expect(getLevelVariant(levelById(1), "banned")).toBeNull();
    expect(getLevelVariant(levelById(13), "banned")?.bannedTactic).toBe(
      "linarith"
    );
    expect(getLevelVariants({ id: 999 })).toEqual([]);
  });

  it("states each rule in words", () => {
    const [tight, step] = getLevelVariants(levelById(1));
    expect(tight.rule).toContain("1 GB");
    expect(step.rule).toContain("at most 1 tactic.");
    expect(getLevelVariant(levelById(9), "step-limit")?.rule).toContain(
      "at most 3 tactics."
    );
  });

  it("replaces the mode budget only for Tight RAM", () => {
    const level = levelById(13);
    const tight = getLevelVariant(level, "tight-ram");
    expect(getRunStartingRam(level, "story", null)).toBe(28);
    expect(getRunStartingRam(level, "hacker", null)).toBe(14);
    expect(getRunStartingRam(level, "story", tight)).toBe(8);
    expect(getRunStartingRam(level, "hacker", tight)).toBe(8);
    expect(
      getRunStartingRam(level, "story", getLevelVariant(level, "banned"))
    ).toBe(28);
  });

  it("bans only the variant's tactic", () => {
    const banned = getLevelVariant(levelById(5), "banned");
    expect(isTacticBanned(banned, "rw")).toBe(true);
    expect(isTacticBanned(banned, "simp")).toBe(false);
    expect(isTacticBanned(null, "rw")).toBe(false);
  });

  it("fails a step-limit run on the step after the limit", () => {
    const step = getLevelVariant(levelById(9), "step-limit");
    expect(isStepLimitReached(step, 2, false)).toBe(false);
    expect(isStepLimitReached(step, 3, false)).toBe(true);
    expect(isStepLimitReached(step, 3, true)).toBe(false);
    expect(isStepLimitReached(null, 30, false)).toBe(false);
    expect(isVariantRunCleared(step!, 3, false)).toBe(true);
    expect(isVariantRunCleared(step!, 4, false)).toBe(false);
    expect(isVariantRunCleared(step!, 3, true)).toBe(false);
    expect(isVariantRunCleared({}, 99, false)).toBe(true);
  });
});

describe("variant progress", () => {
  it("records a clear in picker order without touching the base score", () => {
    const base: GameProgressState = {
      completedLevels: { 1: score({ stars: 2, golfed: false }) },
      currentLevelIndex: 0,
    };
    const once = recordClearedVariant(base, 1, "step-limit");
    const twice = recordClearedVariant(once, 1, "tight-ram");
    expect(twice.clearedVariants?.[1]).toEqual(["tight-ram", "step-limit"]);
    expect(twice.completedLevels).toBe(base.completedLevels);
    expect(recordClearedVariant(twice, 1, "tight-ram")).toBe(twice);
    expect(isVariantCleared(twice, 1, "tight-ram")).toBe(true);
    expect(isVariantCleared(twice, 1, "banned")).toBe(false);
    expect(isVariantCleared(null, 1, "banned")).toBe(false);
  });

  it("loads a save from before variants with its stars, badges and steps", () => {
    const legacy = JSON.stringify({
      completedLevels: { 1: score({ stars: 3, golfed: true, steps: 1 }) },
      currentLevelIndex: 1,
    });
    const parsed = parseGameProgress(legacy);
    expect(parsed.clearedVariants).toEqual({});
    expect(parsed.completedLevels[1].stars).toBe(3);
    expect(parsed.completedLevels[1].golfed).toBe(true);
    expect(parsed.completedLevels[1].steps).toBe(1);
  });

  it("cleans malformed variant saves", () => {
    expect(normalizeClearedVariants(null)).toEqual({});
    expect(normalizeClearedVariants([])).toEqual({});
    expect(normalizeClearedVariants("x")).toEqual({});
    expect(
      normalizeClearedVariants({
        1: ["step-limit", "bogus", "tight-ram", "step-limit"],
        2: "tight-ram",
        3: [],
      })
    ).toEqual({ 1: ["tight-ram", "step-limit"] });
  });
});

describe("VariantPicker", () => {
  const variants = getLevelVariants(levelById(13));

  it("explains how to unlock when locked", () => {
    render(
      <VariantPicker
        variants={variants}
        activeKind={null}
        unlocked={false}
        isCleared={() => false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId("quasi-variants-locked").textContent).toContain(
      "unlock 3 challenge variants"
    );
    expect(screen.queryByRole("button", { name: /Tight RAM/ })).toBeNull();
  });

  it("marks cleared variants in text and picks one", () => {
    const onSelect = vi.fn();
    render(
      <VariantPicker
        variants={variants}
        activeKind="banned"
        unlocked
        isCleared={(kind) => kind === "tight-ram"}
        onSelect={onSelect}
      />
    );
    expect(screen.getByText(/1 of 3 cleared/)).toBeTruthy();
    const tight = screen.getByRole("button", { name: /Tight RAM.*Cleared/ });
    expect(tight.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "No linarith" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByTestId("quasi-variant-rule").textContent).toContain(
      "banned"
    );
    fireEvent.click(tight);
    expect(onSelect).toHaveBeenCalledWith("tight-ram");
    fireEvent.click(screen.getByRole("button", { name: "Base level" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe("variants on the board", () => {
  const seed = (progress: Partial<GameProgressState>) =>
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ currentLevelIndex: 0, ...progress })
    );

  it("hides the picker until the level is cleared honestly", () => {
    render(<QuasiPerfectPuzzler />);
    expect(screen.getByTestId("quasi-variants-locked")).toBeTruthy();
    expect(screen.queryByTestId("quasi-variant-picker")).toBeNull();
  });

  it("clears Tight RAM on level 12 without changing the base stars", () => {
    seed({
      completedLevels: { 12: score({ levelId: 12, stars: 2, golfed: false }) },
      currentLevelIndex: 11,
    });
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: "Tight RAM" }));
    expect(screen.getByTestId("quasi-variant-rule").textContent).toContain(
      "3 GB"
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Apply Tactic: norm_num to the goal/i,
      })
    );
    expect(screen.getByTestId("victory-variant").textContent).toContain(
      "Variant cleared: Tight RAM"
    );
    const saved = parseGameProgress(localStorage.getItem(PROGRESS_KEY));
    expect(saved.clearedVariants?.[12]).toEqual(["tight-ram"]);
    expect(saved.completedLevels[12].stars).toBe(2);
    expect(saved.completedLevels[12].golfed).toBe(false);
  });

  it("does not clear a variant with sorry", () => {
    seed({
      completedLevels: { 12: score({ levelId: 12 }) },
      currentLevelIndex: 11,
    });
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: "Step limit" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: sorry to the goal/i })
    );
    expect(screen.getByTestId("victory-variant").textContent).toContain(
      "Variant not cleared"
    );
    const saved = parseGameProgress(localStorage.getItem(PROGRESS_KEY));
    expect(saved.clearedVariants?.[12]).toBeUndefined();
    expect(saved.completedLevels[12].stars).toBe(3);
  });

  it("marks the banned card with text and refuses it", () => {
    seed({
      completedLevels: { 5: score({ levelId: 5 }) },
      currentLevelIndex: 4,
    });
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: "No rw" }));
    const card = document.querySelector(
      '[data-tactic-id="rw"][data-banned="true"]'
    );
    expect(card?.textContent).toContain("Banned");
    expect(card?.getAttribute("aria-label")).toContain(
      "Banned in this variant"
    );
    const apply = screen.getByRole("button", {
      name: /Apply Tactic: rw to the goal \(banned in this variant\)/i,
    });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: simp to the goal/i })
    );
    expect(screen.getByTestId("victory-variant").textContent).toContain(
      "Variant cleared: No rw"
    );
  });

  it("fails a step-limit run on the step after par", () => {
    seed({
      completedLevels: { 2: score({ levelId: 2 }) },
      currentLevelIndex: 1,
    });
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: "Step limit" }));
    // Level 2's par is one tactic; symm succeeds but leaves the goal open.
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: symm to the goal/i })
    );
    expect(screen.getByTestId("quasi-step-limit-failed").textContent).toContain(
      "1 of 1 tactics used"
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: rw to the goal/i })
    );
    expect(screen.queryByTestId("victory-variant")).toBeNull();
    // Reset keeps the variant and clears the failure.
    fireEvent.click(
      screen.getByRole("button", { name: "Reset and Retry Variant" })
    );
    expect(screen.queryByTestId("quasi-step-limit-failed")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Step limit" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });
});

describe("variants on the map and in the result card", () => {
  it("shows cleared variants per unlocked level", () => {
    const progress = parseGameProgress(
      JSON.stringify({
        completedLevels: { 1: score({}), 2: score({ levelId: 2 }) },
        clearedVariants: { 1: ["tight-ram", "step-limit"] },
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
    expect(screen.getByTestId("quasi-level-variants-1").textContent).toBe(
      "V2/2"
    );
    expect(screen.getByTestId("quasi-level-variants-2").textContent).toBe(
      "V0/2"
    );
    expect(screen.queryByTestId("quasi-level-variants-3")).toBeNull();
    expect(
      document.getElementById("quasi-level-badge-1")?.textContent
    ).toContain("2 of 2 challenge variants cleared");
  });

  it("replaces stars with the variant result", () => {
    const variant = getLevelVariant(levelById(13), "tight-ram");
    render(
      <VictoryModal
        score={score({ levelId: 13, steps: 1 })}
        level={levelById(13)}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={12}
        variant={variant}
        variantCleared
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    expect(screen.queryByTestId("victory-stars")).toBeNull();
    expect(screen.getByTestId("victory-variant").textContent).toContain(
      "base level's stars are unchanged"
    );
    expect(screen.getByRole("button", { name: "Replay Variant" })).toBeTruthy();
  });
});
