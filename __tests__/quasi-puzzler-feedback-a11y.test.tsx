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
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import {
  countHonestProofs,
  parseFormula,
  tacticDefs,
  type LevelScore,
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

const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";

const score = (levelId: number, usedSorry = false): LevelScore => ({
  levelId,
  completed: true,
  usedSorry,
  remainingRam: usedSorry ? 0 : 7,
  stars: usedSorry ? 0 : 3,
  morality: usedSorry ? 0 : 100,
  timestamp: 1,
});

const click = (el: Element) => act(() => void fireEvent.click(el));

describe("Quasi Puzzler feedback and a11y (#2198-#2201)", () => {
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

  it("norm_num calls a false concrete goal false, not non-concrete (#2199)", () => {
    const target = parseFormula("4 + 4 = 7", "t");
    const result = tacticDefs.norm_num.execute(target, target, []);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/reduced '4 \+ 4 = 7' to False/);
    expect(result.message).toMatch(/undo and choose another route/);
    expect(result.message).not.toMatch(/non-concrete/);

    const open = parseFormula("x + 4 = 7", "t");
    expect(tacticDefs.norm_num.execute(open, open, []).message).toMatch(
      /non-concrete/
    );
  });

  it("names each screen-reader Apply button by its argument (#2200)", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedLevels: {}, unlockedChapter: 4 })
    );
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L20$/ }));
    expect(
      screen.getByRole("button", { name: "Apply Tactic: use 3 to the goal" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Apply Tactic: use 4 to the goal" })
    ).toBeTruthy();
  });

  it("counts only honest proofs (#2198)", () => {
    expect(countHonestProofs(null)).toBe(0);
    expect(
      countHonestProofs({
        completedLevels: { 1: score(1), 2: score(2, true), 3: score(3) },
      })
    ).toBe(2);
  });

  it("shows the hub count without a stale total or sorry levels (#2198)", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completedLevels: { 1: score(1), 2: score(2, true), 3: score(3) },
      })
    );
    const { container } = render(<ArcadeHubClient />);
    expect(container.textContent).toContain("2 Proofs");
    expect(container.textContent).not.toMatch(/\/ 5 Proofs/);
  });
  it("shows the victory Lean text wrapped, not as a scroll box (#2201)", () => {
    render(<QuasiPerfectPuzzler />);
    click(
      screen.getByRole("button", { name: /Apply Tactic: rfl to the goal/i })
    );
    const dialog = screen.getByRole("dialog", { name: /solved/ });
    const pre = dialog.querySelector("pre")!;
    expect(pre.className).toContain("whitespace-pre-wrap");
    expect(pre.className).not.toMatch(/overflow-|max-h-/);
    // The card itself scrolls instead, and holds focusable buttons.
    const card = dialog.firstElementChild as HTMLElement;
    expect(card.className).toContain("overflow-y-auto");
    expect(card.querySelector("button")).not.toBeNull();
  });
});
