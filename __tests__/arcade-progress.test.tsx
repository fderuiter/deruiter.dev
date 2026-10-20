// @vitest-environment jsdom
//
// #2548: the arcade progress store. Returning players upgrade from today's
// bytes without losing a best, a trophy or a Daily record.
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ARCADE_CORRUPT_SUFFIX,
  ARCADE_PROGRESS_CATALOG,
  ARCADE_REGISTRY,
  ARCADE_UNIFIED_PROGRESS_KEY,
  arcadeCoreSlice,
  arcadeDailySlice,
  defineSlice,
  read,
  subscribe,
  useProgress,
  write,
} from "@/lib/arcade";
import {
  ARCADE_DAILY_STORAGE_KEY,
  emptyArcadeDailyProgress,
} from "@/lib/arcade/daily";
import {
  getArcadeDailyProgress,
  recordArcadeDailyResult,
} from "@/lib/arcade/daily-store";
import {
  getArcadeProgress,
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { safeStorage } from "@/lib/safe-storage";

/** `arcade_unified_progress_v1` exactly as safe-storage's setItem wrote it. */
function todaysUnifiedBytes(value: unknown): string {
  return JSON.stringify({
    value,
    lastAccessedAt: 1_760_000_000_000,
    expiresAt: null,
    isExpirable: false,
  });
}

function storedCore(): Record<string, unknown> {
  const raw = localStorage.getItem(ARCADE_UNIFIED_PROGRESS_KEY);
  return raw
    ? (JSON.parse(raw) as { value: Record<string, unknown> }).value
    : {};
}

describe("Arcade progress store (#2548)", () => {
  beforeEach(() => {
    safeStorage.clear();
    localStorage.clear();
  });

  afterEach(cleanup);

  describe("upgrading from today's bytes", () => {
    it("keeps every best and trophy in the unified progress envelope", () => {
      localStorage.setItem(
        ARCADE_UNIFIED_PROGRESS_KEY,
        todaysUnifiedBytes({
          highScores: { "laser-loon": 2400, "trial-and-error": 91000 },
          unlockedTrophies: { laser_loon_novice: 1_700_000_000_000 },
          updatedAt: 1_700_000_000_000,
        })
      );
      const progress = getArcadeProgress();
      expect(progress.highScores).toEqual({
        "laser-loon": 2400,
        "trial-and-error": 91000,
      });
      expect(progress.unlockedTrophies.laser_loon_novice).toBe(
        1_700_000_000_000
      );
    });

    it("still reads a unified value stored without the envelope", () => {
      localStorage.setItem(
        ARCADE_UNIFIED_PROGRESS_KEY,
        JSON.stringify({
          highScores: { "garmin-watch": 12 },
          unlockedTrophies: {},
          updatedAt: 1,
        })
      );
      expect(getArcadeProgress().highScores["garmin-watch"]).toBe(12);
    });

    it("folds the per-game mirror keys in once, with max", () => {
      localStorage.setItem(
        ARCADE_UNIFIED_PROGRESS_KEY,
        todaysUnifiedBytes({
          highScores: { "laser-loon": 900 },
          unlockedTrophies: {},
          updatedAt: 1,
        })
      );
      localStorage.setItem("laser_loon_high_score", "1500");
      localStorage.setItem("retro_labyrinth_highscore", "300");
      localStorage.setItem("study_director_high_score", "40");
      const progress = getArcadeProgress();
      expect(progress.highScores).toMatchObject({
        "laser-loon": 1500,
        "retro-labyrinth": 300,
        "study-director": 40,
      });
      expect(storedCore().migratedAt).toEqual(expect.any(Number));
      // Marked done: a later mirror value is no longer read.
      localStorage.setItem("retro_labyrinth_highscore", "5000");
      expect(getArcadeProgress().highScores["retro-labyrinth"]).toBe(300);
      // The keys stay in place for a release, so a rollback loses nothing.
      expect(localStorage.getItem("laser_loon_high_score")).toBe("1500");
    });

    it("never lowers a stored best while folding", () => {
      localStorage.setItem(
        ARCADE_UNIFIED_PROGRESS_KEY,
        todaysUnifiedBytes({
          highScores: { "clinical-chaos": 4000 },
          unlockedTrophies: {},
          updatedAt: 1,
        })
      );
      localStorage.setItem("clinical_chaos_highscore", "100");
      expect(getArcadeProgress().highScores["clinical-chaos"]).toBe(4000);
    });

    it("folds the legacy per-game keys and copies them to the game's key", () => {
      localStorage.setItem("working_duck_high_score", "350");
      localStorage.setItem("garmin_runner_high_score", "800");
      localStorage.setItem("clinical_chaos_high_score", "60");
      const progress = getArcadeProgress();
      expect(progress.highScores["working-with-duck"]).toBe(350);
      expect(progress.highScores["garmin-watch"]).toBe(800);
      expect(progress.highScores["clinical-chaos"]).toBe(60);
      expect(localStorage.getItem("working_with_duck_high_score")).toBe("350");
      expect(localStorage.getItem("garmin_simulator_high_score")).toBe("800");
    });

    it("reads game saves for their score but never writes them", () => {
      const save = JSON.stringify({
        completedLevels: { a: { stars: 3 }, b: { stars: 2 } },
      });
      localStorage.setItem("quasi_perfect_puzzler_progress_v1", save);
      localStorage.setItem("quasi_puzzle_high_score", "500");
      localStorage.setItem(
        "meme_achievements_unlocked",
        JSON.stringify(["konami", "vault"])
      );
      const progress = getArcadeProgress();
      expect(progress.highScores["quasi-puzzler"]).toBe(500);
      expect(progress.highScores["meme-vault"]).toBe(200);
      expect(localStorage.getItem("quasi_perfect_puzzler_progress_v1")).toBe(
        save
      );
    });

    it("writes nothing for a visitor with nothing to keep", () => {
      expect(getArcadeProgress().highScores).toEqual({});
      expect(localStorage.length).toBe(0);
    });

    it("keeps the Daily record and its bytes", () => {
      const today = {
        version: 1,
        bests: { "protocol-drift": { "2026-10-13": { score: 88 } } },
        played: ["2026-10-12", "2026-10-13"],
        longest: 4,
      };
      localStorage.setItem(ARCADE_DAILY_STORAGE_KEY, JSON.stringify(today));
      expect(getArcadeDailyProgress()).toEqual(today);
      expect(read(arcadeDailySlice)).toEqual(today);
      expect(localStorage.getItem(ARCADE_DAILY_STORAGE_KEY)).toBe(
        JSON.stringify(today)
      );
      const noon = Date.UTC(2026, 9, 14, 12);
      expect(
        recordArcadeDailyResult(
          "protocol-drift",
          "2026-10-14",
          { score: 90 },
          noon
        )
      ).toBe(true);
      const after = JSON.parse(
        localStorage.getItem(ARCADE_DAILY_STORAGE_KEY) ?? "null"
      );
      expect(after.bests["protocol-drift"]["2026-10-13"]).toEqual({
        score: 88,
      });
      expect(after.played).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
      expect(after.longest).toBe(4);
    });
  });

  describe("one home for a high score", () => {
    it("stops writing the per-game mirror keys", () => {
      recordArcadeScore("trial-and-error", 1200);
      recordArcadeScore("study-director", 30);
      expect(localStorage.getItem("trial_and_error_high_score")).toBeNull();
      expect(localStorage.getItem("study_director_high_score")).toBeNull();
      expect(getArcadeProgress().highScores["trial-and-error"]).toBe(1200);
    });

    it("keeps the unified key in safe-storage's envelope", () => {
      recordArcadeScore("laser-loon", 600);
      const stored = JSON.parse(
        localStorage.getItem(ARCADE_UNIFIED_PROGRESS_KEY) ?? "null"
      );
      expect(stored).toMatchObject({
        value: { highScores: { "laser-loon": 600 } },
        expiresAt: null,
        isExpirable: false,
      });
      expect(stored.lastAccessedAt).toEqual(expect.any(Number));
      expect(safeStorage.getItem(ARCADE_UNIFIED_PROGRESS_KEY)).toMatchObject({
        highScores: { "laser-loon": 600 },
      });
    });

    it("keeps a trophy's first unlock time", () => {
      recordArcadeMilestone("laser-loon", "act_no_hit");
      const first =
        getArcadeProgress().unlockedTrophies.laser_loon_flawless_act;
      recordArcadeMilestone("laser-loon", "act_no_hit");
      expect(getArcadeProgress().unlockedTrophies.laser_loon_flawless_act).toBe(
        first
      );
    });
  });

  describe("damaged values", () => {
    it("sets a damaged unified value aside and reads empty, never throwing", () => {
      localStorage.setItem(ARCADE_UNIFIED_PROGRESS_KEY, "{oops");
      expect(() => getArcadeProgress()).not.toThrow();
      expect(getArcadeProgress().highScores).toEqual({});
      expect(
        localStorage.getItem(
          `${ARCADE_UNIFIED_PROGRESS_KEY}${ARCADE_CORRUPT_SUFFIX}`
        )
      ).toBe("{oops");
      recordArcadeScore("laser-loon", 10);
      expect(getArcadeProgress().highScores["laser-loon"]).toBe(10);
      expect(
        localStorage.getItem(
          `${ARCADE_UNIFIED_PROGRESS_KEY}${ARCADE_CORRUPT_SUFFIX}`
        )
      ).toBe("{oops");
    });

    it("drops damaged entries rather than the whole record", () => {
      localStorage.setItem(
        ARCADE_UNIFIED_PROGRESS_KEY,
        todaysUnifiedBytes({
          highScores: { "laser-loon": 700, broken: "lots" },
          unlockedTrophies: { laser_loon_novice: 5, bad: null },
          updatedAt: 1,
        })
      );
      const progress = getArcadeProgress();
      expect(progress.highScores).toEqual({ "laser-loon": 700 });
      expect(progress.unlockedTrophies).toEqual({ laser_loon_novice: 5 });
    });

    it("sets a damaged Daily record aside", () => {
      localStorage.setItem(ARCADE_DAILY_STORAGE_KEY, "[1,2]");
      expect(getArcadeDailyProgress()).toEqual(emptyArcadeDailyProgress());
      expect(
        localStorage.getItem(
          `${ARCADE_DAILY_STORAGE_KEY}${ARCADE_CORRUPT_SUFFIX}`
        )
      ).toBe("[1,2]");
    });
  });

  describe("slices", () => {
    it("migrates an unversioned value as v0 on read", () => {
      const slice = defineSlice<{ version: 2; best: number }>({
        id: "test.versioned",
        key: "arcade_progress_test_versioned",
        class: "profile",
        version: 2,
        schema: {
          safeParse: (v) => {
            const value = v as { version?: unknown; best?: unknown };
            return value?.version === 2 && typeof value.best === "number"
              ? { success: true, data: { version: 2, best: value.best } }
              : { success: false };
          },
        },
        migrate: (value, from) =>
          from === 0 ? { version: 2, best: Number(value) } : value,
        merge: (a, b) => (a.best >= b.best ? a : b),
        empty: () => ({ version: 2, best: 0 }),
      });
      localStorage.setItem(slice.key, "41");
      expect(read(slice)).toEqual({ version: 2, best: 41 });
    });

    it("refuses to write a value that fails the schema", () => {
      expect(
        write(arcadeCoreSlice, JSON.parse('{"highScores":3}') as never)
      ).toBe(false);
      expect(localStorage.getItem(ARCADE_UNIFIED_PROGRESS_KEY)).toBeNull();
    });

    it("tells subscribers about a write", () => {
      let calls = 0;
      const stop = subscribe(arcadeCoreSlice, () => {
        calls += 1;
      });
      recordArcadeScore("laser-loon", 50);
      stop();
      expect(calls).toBe(1);
    });

    it("re-renders useProgress readers on a write", () => {
      function Best() {
        const progress = useProgress(arcadeCoreSlice);
        return (
          <p data-testid="best">{progress.highScores["laser-loon"] ?? 0}</p>
        );
      }
      render(<Best />);
      expect(screen.getByTestId("best").textContent).toBe("0");
      act(() => {
        recordArcadeScore("laser-loon", 777);
      });
      expect(screen.getByTestId("best").textContent).toBe("777");
    });
  });

  describe("catalog", () => {
    it("has one entry per registry game, in registry order", () => {
      expect(ARCADE_PROGRESS_CATALOG.map((entry) => entry.slug)).toEqual(
        ARCADE_REGISTRY.map((entry) => entry.slug)
      );
    });

    it("never uses a storage key twice", () => {
      const keys = [
        arcadeCoreSlice.key,
        arcadeDailySlice.key,
        ...ARCADE_PROGRESS_CATALOG.flatMap((entry) => [
          ...entry.slices.map((slice) => slice.key),
          ...(entry.scoreKey ? [entry.scoreKey] : []),
          ...(entry.legacyScoreKeys ?? []),
        ]),
      ];
      expect(new Set(keys).size).toBe(keys.length);
      const ids = [arcadeCoreSlice.id, arcadeDailySlice.id];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
