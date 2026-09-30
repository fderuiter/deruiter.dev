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
import {
  puzzleLevels,
  resolveSavedLevelIndex,
  tacticDefs,
  type ASTNode,
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

const PROGRESS_KEY = "quasi_perfect_puzzler_progress_v1";
const click = (el: HTMLElement) => act(() => void fireEvent.click(el));
const heading = () =>
  document.getElementById("quasi-current-level-heading")?.textContent;
const savedProgress = () =>
  JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");

const cardFor = (tacticId: string) =>
  document.querySelector<HTMLElement>(`[data-tactic-id="${tacticId}"]`);

describe("resolveSavedLevelIndex (#1650)", () => {
  const levels = puzzleLevels.map((l) => ({ id: l.id }));

  it("restores a valid saved index", () => {
    expect(
      resolveSavedLevelIndex(
        { currentLevelIndex: 2, completedLevels: {} },
        levels
      )
    ).toBe(2);
  });

  it("falls back to Level 1 for out-of-range or corrupt indices", () => {
    for (const bad of [-1, levels.length, 1.5, "3", null, NaN]) {
      expect(resolveSavedLevelIndex({ currentLevelIndex: bad }, levels)).toBe(
        0
      );
    }
    expect(resolveSavedLevelIndex("nonsense", levels)).toBe(0);
    expect(resolveSavedLevelIndex(undefined, levels)).toBe(0);
  });

  it("opens the first unsolved level when no index was saved", () => {
    const done = (id: number) => ({
      levelId: id,
      completed: true,
      usedSorry: false,
      remainingRam: 1,
      stars: 1,
      morality: 100,
      timestamp: 1,
    });
    expect(
      resolveSavedLevelIndex(
        { completedLevels: { 1: done(1), 2: done(2) } },
        levels
      )
    ).toBe(2);
  });
});

describe("Quasi-Puzzler remembers the current level (#1650)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("saves the index when a level is opened from the level strip", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L3/i }));
    expect(savedProgress().currentLevelIndex).toBe(2);
  });

  it("reopens on the saved level after a reload", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ currentLevelIndex: 2, completedLevels: {} })
    );
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[2].title);
  });

  it("opens Level 1 without throwing for a corrupt saved index", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ currentLevelIndex: 999, completedLevels: {} })
    );
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[0].title);
    cleanup();
    localStorage.setItem(PROGRESS_KEY, "{not json");
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[0].title);
  });

  it("keeps the saved level when a score is recorded", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2/i }));
    click(cardFor("sorry") as HTMLElement);
    click(
      document.querySelector('[data-node-id="eq-lvl2-symm"]') as HTMLElement
    );
    const saved = savedProgress();
    expect(saved.currentLevelIndex).toBe(1);
    expect(saved.completedLevels["2"].completed).toBe(true);
  });
});

describe("tactic failure messages report the real charge (#1651)", () => {
  const varNode: ASTNode = { id: "x", type: "Variable", value: "x" };

  it("simp no-progress message matches ramConsumed and failureCost", () => {
    const result = tacticDefs.simp.execute(varNode, varNode, []);
    expect(result.success).toBe(false);
    expect(result.ramConsumed).toBe(tacticDefs.simp.failureCost);
    expect(result.message).toContain(
      `${result.ramConsumed} GB of RAM was consumed`
    );
    expect(result.message).not.toContain("6 GB");
  });

  it("no failure message quotes a GB figure that differs from the charge", () => {
    const eq: ASTNode = {
      id: "eq",
      type: "Equality",
      value: "=",
      children: [
        { id: "l", type: "Variable", value: "a" },
        { id: "r", type: "Variable", value: "b" },
      ],
    };
    for (const def of Object.values(tacticDefs)) {
      const result = def.execute(varNode, eq, [eq]);
      if (result.success) continue;
      const quoted = [...result.message.matchAll(/(\d+(?:\.\d+)?) GB/g)].map(
        (m) => Number(m[1])
      );
      for (const gb of quoted) expect(gb).toBe(result.ramConsumed);
    }
  });
});

describe("RAM exhaustion also stops sorry (#1651)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  function exhaustRamOnLevelTwoInHackerMode() {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2/i }));
    click(screen.getByRole("button", { name: /^Hacker Mode$/i }));
    // rfl on the b = a goal fails (type mismatch) and costs 1 GB each time.
    // A failed tactic leaves its card armed, so one selection is enough.
    click(cardFor("rfl") as HTMLElement);
    for (let i = 0; i < 16; i++) {
      click(
        document.querySelector('[data-node-id="eq-lvl2-symm"]') as HTMLElement
      );
    }
    expect(document.body.textContent).toContain("SIMULATED RAM EXHAUSTED");
  }

  it("refuses sorry at 0 GB and keeps the level unsolved", () => {
    exhaustRamOnLevelTwoInHackerMode();
    const sorry = cardFor("sorry") as HTMLElement;
    expect(sorry.getAttribute("aria-disabled")).toBe("true");
    click(sorry);
    click(
      document.querySelector('[data-node-id="eq-lvl2-symm"]') as HTMLElement
    );
    expect(document.body.textContent).not.toContain("Morality");
    expect(savedProgress().completedLevels).toBeUndefined();
  });

  it("counts only playable cards in the hand", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2/i }));
    expect(document.body.textContent).toContain("4 cards available");
    cleanup();
    exhaustRamOnLevelTwoInHackerMode();
    expect(document.body.textContent).toContain("4 cards, 0 playable");
  });
});
