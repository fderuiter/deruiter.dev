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
import type { LevelScore } from "@/lib/quasi-perfect";

const announce = vi.fn();

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));

const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";

const click = (el: Element) => act(() => void fireEvent.click(el));
const levelButton = (id: number) =>
  screen.getByRole("button", { name: new RegExp(`^L${id}$`) });
const card = (name: RegExp) =>
  screen
    .getAllByRole("button", { name })
    .find((el) => el.hasAttribute("data-tactic-id"))!;
const node = (expression: string) =>
  screen
    .getAllByRole("button")
    .find((el) =>
      el.getAttribute("aria-label")?.endsWith(`Expression: ${expression}`)
    )!;
const heading = () =>
  document.getElementById("quasi-current-level-heading")?.textContent ?? "";
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

const honest = (levelId: number): LevelScore => ({
  levelId,
  completed: true,
  usedSorry: false,
  remainingRam: 7,
  stars: 3,
  morality: 100,
  timestamp: 1,
});

describe("Quasi Puzzler Act 2 (#2091)", () => {
  beforeEach(() => {
    localStorage.clear();
    announce.mockClear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps Act 2 locked on a fresh save, with a reason for every reader", () => {
    render(<QuasiPerfectPuzzler />);
    const l19 = levelButton(19);
    expect(l19.getAttribute("aria-disabled")).toBe("true");
    expect(l19.className).toContain("min-h-[44px]");
    expect(
      document.getElementById("quasi-level-badge-19")?.textContent
    ).toMatch(/Locked until the Act 1 capstone is proved/);
    expect(screen.getByTestId("level-map-locked-note").textContent).toMatch(
      /Level 18, the Act 1 capstone, is proved without sorry/
    );

    click(l19);
    expect(heading()).toContain("The Identity Crisis");
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/Level 19 is locked/)
    );
    // The header counts only the levels that can be played.
    expect(document.body.textContent).toContain("Level 1 of 18");
  });

  it("opens Act 2 from an old save whose capstone was proved, and plays a ∀ level", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedLevels: { 18: honest(18) } })
    );
    render(<QuasiPerfectPuzzler />);
    expect(screen.queryByTestId("level-map-locked-note")).toBeNull();
    click(levelButton(19));
    expect(heading()).toContain("For Every Number");

    const goal = node("∀ n, n + 0 = n");
    expect(goal.getAttribute("aria-label")).toBe(
      "Goal ∀n. Universal quantifier: for all n. Expression: ∀ n, n + 0 = n"
    );

    click(card(/Tactic intro/i));
    click(goal);
    click(card(/Tactic exact add_zero/i));
    click(node("n + 0 = n"));

    const dialog = screen.getByRole("dialog", {
      name: /For Every Number solved/,
    });
    expect(dialog.textContent).toContain("intro n");
    expect(dialog.textContent).toContain("exact add_zero n");
    expect(saved().completedLevels["19"]).toMatchObject({
      completed: true,
      stars: 3,
      golfed: true,
    });
  });

  it("splits an induction goal into base and step tabs", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedLevels: {}, unlockedChapter: 4 })
    );
    render(<QuasiPerfectPuzzler />);
    click(levelButton(22));
    click(card(/Tactic induction/i));
    click(node("∀ n, 0 + n = n"));
    expect(document.body.textContent).toContain("Base case: 0 + 0 = 0");
    expect(document.body.textContent).toContain(
      "Step case: 0 + (k + 1) = k + 1"
    );
  });

  it("an honest capstone proof unlocks Act 2 and Next Level goes to Level 19", () => {
    render(<QuasiPerfectPuzzler />);
    click(levelButton(18));
    expect(heading()).toContain("The Quasiperfect Capstone");

    click(card(/Tactic rw \[h_sig\]/i));
    click(node("σ(n)"));
    click(card(/Tactic ring/i));
    click(node("2 * n + 1 - 1 + n ^ 2 = (n + 1) ^ 2 - 1"));

    expect(screen.getByTestId("victory-act-two-unlocked").textContent).toMatch(
      /Act 2 unlocked/
    );
    expect(saved().unlockedChapter).toBe(4);

    click(screen.getByRole("button", { name: /Next Level/ }));
    expect(heading()).toContain("For Every Number");
    expect(levelButton(19).getAttribute("aria-disabled")).toBeNull();
  });
});
