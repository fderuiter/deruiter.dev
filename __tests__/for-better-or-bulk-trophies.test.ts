import { describe, it, expect, beforeEach } from "vitest";
import {
  ARCADE_TROPHIES,
  getArcadeProgress,
  unlockArcadeTrophies,
} from "@/lib/arcade-achievements";
import { runTrophyIds } from "@/components/for-better-or-bulk/rewards";
import {
  DEFAULT_SETUP,
  createLevel,
  type GameState,
} from "@/lib/for-better-or-bulk";

const NEW_IDS = [
  "for_better_or_bulk_three_stars",
  "for_better_or_bulk_perfect_day",
  "for_better_or_bulk_nothing_burnt",
];

function finished(seed: number, assist = false): GameState {
  const state = createLevel({ ...DEFAULT_SETUP, seed, assist });
  return { ...state, finishedAt: 10, burntBatches: 0 };
}

describe("For Better or Bulk trophies", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the two existing trophies' definitions and targets", () => {
    const setupCrew = ARCADE_TROPHIES.find(
      (t) => t.id === "for_better_or_bulk_setup_crew"
    );
    const everything = ARCADE_TROPHIES.find(
      (t) => t.id === "for_better_or_bulk_everything"
    );
    expect(setupCrew?.targetScore).toBe(12);
    expect(everything?.targetScore).toBe(27);
    expect(setupCrew?.title).toBe("Setup Crew");
    expect(everything?.title).toBe("Bought Out the Roses");
  });

  it("adds the three run trophies with no score target", () => {
    for (const id of NEW_IDS) {
      const trophy = ARCADE_TROPHIES.find((t) => t.id === id);
      expect(trophy?.gameId).toBe("for-better-or-bulk");
      expect(trophy?.targetScore).toBeUndefined();
    }
  });

  it("awards three stars on the standard day and a perfect day on a seeded one", () => {
    expect(runTrophyIds(finished(0), 3, 1)).toContain(
      "for_better_or_bulk_three_stars"
    );
    expect(runTrophyIds(finished(0), 3, 1)).not.toContain(
      "for_better_or_bulk_perfect_day"
    );
    expect(runTrophyIds(finished(12345), 3, 1)).toContain(
      "for_better_or_bulk_perfect_day"
    );
    expect(runTrophyIds(finished(12345), 3, 1)).not.toContain(
      "for_better_or_bulk_three_stars"
    );
    expect(runTrophyIds(finished(0), 2, 1)).not.toContain(
      "for_better_or_bulk_three_stars"
    );
  });

  it("awards nothing burnt only for a finished run with no burnt batches", () => {
    expect(runTrophyIds(finished(0), 0, 1)).toContain(
      "for_better_or_bulk_nothing_burnt"
    );
    expect(
      runTrophyIds({ ...finished(0), burntBatches: 1 }, 0, 1)
    ).not.toContain("for_better_or_bulk_nothing_burnt");
    expect(
      runTrophyIds({ ...finished(0), finishedAt: null }, 0, 1)
    ).not.toContain("for_better_or_bulk_nothing_burnt");
  });

  it("earns no run trophy when assisted or sped up", () => {
    expect(runTrophyIds(finished(0, true), 3, 1)).toEqual([]);
    expect(runTrophyIds(finished(0), 3, 2)).toEqual([]);
  });

  it("unlocks named trophies once and keeps their first timestamp", () => {
    const first = unlockArcadeTrophies(["for_better_or_bulk_three_stars"]);
    expect(first.map((t) => t.id)).toEqual(["for_better_or_bulk_three_stars"]);
    const stamp =
      getArcadeProgress().unlockedTrophies["for_better_or_bulk_three_stars"];
    expect(stamp).toBeGreaterThan(0);
    expect(unlockArcadeTrophies(["for_better_or_bulk_three_stars"])).toEqual(
      []
    );
    expect(
      getArcadeProgress().unlockedTrophies["for_better_or_bulk_three_stars"]
    ).toBe(stamp);
  });

  it("ignores ids that are not trophies", () => {
    expect(unlockArcadeTrophies(["not-a-trophy"])).toEqual([]);
  });
});
