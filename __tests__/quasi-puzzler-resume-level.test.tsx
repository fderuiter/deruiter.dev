// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import {
  puzzleLevels,
  parseGameProgress,
  resolveResumeLevelIndex,
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

// #1650: reloading the page always reopened Level 1. saveProgress copied
// `existing.currentLevelIndex || 0`, nothing wrote the real index, and the
// component always started from index 0.

const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";

const solved = (levelId: number | string): LevelScore => ({
  levelId,
  completed: true,
  usedSorry: false,
  remainingRam: 10,
  stars: 3,
  morality: 100,
  timestamp: 1,
});

const completedFirst = (count: number): Record<string, LevelScore> =>
  Object.fromEntries(
    puzzleLevels.slice(0, count).map((lvl) => [String(lvl.id), solved(lvl.id)])
  );

const heading = () =>
  document.getElementById("quasi-current-level-heading")?.textContent;

const readSaved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

describe("resolveResumeLevelIndex (#1650)", () => {
  it("returns a valid saved index", () => {
    expect(
      resolveResumeLevelIndex(
        { completedLevels: {}, currentLevelIndex: 2 },
        puzzleLevels
      )
    ).toBe(2);
  });

  it("chooses the first unsolved level when no index is saved", () => {
    expect(
      resolveResumeLevelIndex(
        { completedLevels: completedFirst(5), currentLevelIndex: 0 },
        puzzleLevels
      )
    ).toBe(5);
    expect(
      resolveResumeLevelIndex(
        parseGameProgress(
          JSON.stringify({ completedLevels: completedFirst(2) })
        ),
        puzzleLevels
      )
    ).toBe(2);
  });

  it("falls back to Level 1 for an out-of-range or corrupt index", () => {
    for (const bad of [99, -1, 1.5, "3", null]) {
      expect(
        resolveResumeLevelIndex(
          parseGameProgress(
            JSON.stringify({
              completedLevels: completedFirst(3),
              currentLevelIndex: bad,
            })
          ),
          puzzleLevels
        )
      ).toBe(0);
    }
  });

  it("never throws on malformed stored progress", () => {
    for (const raw of [null, "", "{", "[]", "42", '{"completedLevels":7}']) {
      expect(() =>
        resolveResumeLevelIndex(parseGameProgress(raw), puzzleLevels)
      ).not.toThrow();
      expect(
        resolveResumeLevelIndex(parseGameProgress(raw), puzzleLevels)
      ).toBe(0);
    }
  });

  it("returns Level 1 once every level is solved and none is saved", () => {
    expect(
      resolveResumeLevelIndex(
        {
          completedLevels: completedFirst(puzzleLevels.length),
          currentLevelIndex: 0,
        },
        puzzleLevels
      )
    ).toBe(0);
  });
});

describe("Quasi-Perfect Puzzler resumes the saved level (#1650)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves the level index when a level is chosen and restores it on remount", () => {
    const first = render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[0].title);

    fireEvent.click(screen.getByRole("button", { name: /^L3\b/ }));
    expect(heading()).toBe(puzzleLevels[2].title);
    expect(readSaved().currentLevelIndex).toBe(2);

    first.unmount();
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[2].title);
  });

  it("keeps the saved index and scores when a level is solved", () => {
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: .*rfl.* to the goal/i })
    );
    const saved = readSaved();
    expect(saved.completedLevels[String(puzzleLevels[0].id)].completed).toBe(
      true
    );
    expect(saved.currentLevelIndex).toBe(0);

    // Reloading after clearing Level 1 opens the first unsolved level.
    cleanup();
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[1].title);
  });

  it("opens the first unsolved level for older saves that never stored an index", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentLevelIndex: 0,
        completedLevels: completedFirst(5),
      })
    );
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[5].title);
  });

  it("opens Level 1 when the saved index is corrupt", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentLevelIndex: 999,
        completedLevels: completedFirst(5),
      })
    );
    render(<QuasiPerfectPuzzler />);
    expect(heading()).toBe(puzzleLevels[0].title);
  });

  it("keeps existing scores when it writes the level index", () => {
    const existing = {
      currentLevelIndex: 0,
      completedLevels: completedFirst(2),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    render(<QuasiPerfectPuzzler />);
    fireEvent.click(screen.getByRole("button", { name: /^L4\b/ }));
    const saved = readSaved();
    expect(saved.currentLevelIndex).toBe(3);
    expect(saved.completedLevels).toEqual(existing.completedLevels);
  });
});
