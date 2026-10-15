/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordArcadeScore,
  recordArcadeMilestone,
  unlockArcadeTrophies,
  getArcadeProgress,
  parseScoreValue,
  ARCADE_TROPHIES,
  ARCADE_UNIFIED_PROGRESS_KEY,
  HALL_OF_FAME_TROPHY_COUNT,
} from "@/lib/arcade-achievements";
import { onAppEvent } from "@/lib/event-bus";
import {
  safeStorage,
  safeSetRawItem,
  safeGetRawItem,
} from "@/lib/safe-storage";

describe("Arcade Achievements & Leaderboard Registry", () => {
  beforeEach(() => {
    safeStorage.clear();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  describe("parseScoreValue", () => {
    it("parses numeric values and strings correctly", () => {
      expect(parseScoreValue(100)).toBe(100);
      expect(parseScoreValue("250")).toBe(250);
      expect(parseScoreValue(null)).toBe(0);
      expect(parseScoreValue(undefined)).toBe(0);
      expect(parseScoreValue("invalid")).toBe(0);
    });

    it("parses JSON enveloped objects or progress states", () => {
      expect(parseScoreValue(JSON.stringify({ value: 450 }))).toBe(450);
      expect(
        parseScoreValue(
          JSON.stringify({ completedLevels: { l1: true, l2: true } })
        )
      ).toBe(200);
      expect(parseScoreValue(JSON.stringify(["m1", "m2", "m3"]))).toBe(300);
    });
  });

  describe("Legacy High Score Key Migration", () => {
    it("automatically migrates legacy storage keys into unified progress", () => {
      // Set legacy keys
      safeSetRawItem("working_duck_high_score", "350");
      safeSetRawItem("garmin_runner_high_score", "800");

      const progress = getArcadeProgress();

      expect(progress.highScores["working-with-duck"]).toBe(350);
      expect(progress.highScores["garmin-watch"]).toBe(800);
      expect(safeGetRawItem("working_with_duck_high_score")).toBe("350");
      expect(safeGetRawItem("garmin_simulator_high_score")).toBe("800");
    });
  });

  describe("Score Recording and Trophy Engine", () => {
    it("updates high score and dispatches arcade_score_updated event", () => {
      const scoreHandler = vi.fn();
      const unsubscribe = onAppEvent("arcade_score_updated", scoreHandler);

      const result = recordArcadeScore("working-with-duck", 150);

      expect(result.progress.highScores["working-with-duck"]).toBe(150);
      expect(scoreHandler).toHaveBeenCalledWith({
        gameId: "working-with-duck",
        score: 150,
        metadata: undefined,
      });

      unsubscribe();
    });

    it("evaluates and unlocks trophies when score thresholds are met", () => {
      const trophyHandler = vi.fn();
      const unsubscribe = onAppEvent("arcade_trophy_unlocked", trophyHandler);

      // Score 600 in Laser Loon (unlocks laser_loon_novice)
      const result = recordArcadeScore("laser-loon", 600);

      expect(result.newlyUnlocked.length).toBeGreaterThan(0);
      expect(
        result.newlyUnlocked.some((t) => t.id === "laser_loon_novice")
      ).toBe(true);
      expect(trophyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trophyId: "laser_loon_novice",
          gameId: "laser-loon",
          title: "Flag Defender",
        })
      );

      unsubscribe();
    });

    it("evaluates cross-game meta achievements when playing multiple games", () => {
      recordArcadeScore("working-with-duck", 600);
      recordArcadeScore("laser-loon", 2500);
      const res3 = recordArcadeScore("clinical-chaos", 2100);

      // 3 games played >= 3 -> Arcade Triathlete meta trophy unlocked
      const unlockedIds = Object.keys(res3.progress.unlockedTrophies);
      expect(unlockedIds).toContain("arcade_triathlon");
      // Big scores alone no longer make a Hall of Famer (#2047).
      expect(unlockedIds).not.toContain("arcade_legend");
    });
  });

  describe("Milestone trophies (#2047)", () => {
    it("unlocks Working With Duck trophies from play, not points (#2159)", () => {
      expect(
        recordArcadeScore("working-with-duck", 5000).newlyUnlocked.filter(
          (t) => t.gameId === "working-with-duck"
        )
      ).toEqual([]);
      expect(
        recordArcadeMilestone("working-with-duck", "sprint_shipped").map(
          (t) => t.id
        )
      ).toEqual(["duck_first_sprint"]);
      expect(
        recordArcadeMilestone("working-with-duck", "three_star_sprint").map(
          (t) => t.id
        )
      ).toEqual(["duck_master"]);
    });

    it("unlocks a trophy from its game's milestone, once", () => {
      const handler = vi.fn();
      const unsubscribe = onAppEvent("arcade_trophy_unlocked", handler);

      const first = recordArcadeMilestone("trial-and-error", "run_won");
      const again = recordArcadeMilestone("trial-and-error", "run_won");

      expect(first.map((t) => t.id)).toEqual(["trial_error_csr_lock"]);
      expect(again).toEqual([]);
      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it("unlocks the Protocol Drift lean-lock trophy only from play (#2054)", () => {
      const lean = ARCADE_TROPHIES.find(
        (t) => t.id === "protocol_drift_lean_lock"
      );
      expect(lean).toMatchObject({
        gameId: "protocol-drift",
        category: "milestone",
        milestone: "lock_under_par_chips",
      });
      expect(lean?.targetScore).toBeUndefined();
      const scored = recordArcadeScore("protocol-drift", 99999).newlyUnlocked;
      expect(scored.map((t) => t.id)).not.toContain("protocol_drift_lean_lock");
      expect(scored.map((t) => t.id)).not.toContain(
        "protocol_drift_defensible"
      );
      expect(
        recordArcadeMilestone("protocol-drift", "lock_under_par_chips").map(
          (t) => t.id
        )
      ).toEqual(["protocol_drift_lean_lock"]);
      expect(
        recordArcadeMilestone("protocol-drift", "all_badges").map((t) => t.id)
      ).toEqual(["protocol_drift_defensible"]);
    });

    it("unlocks Worked a Full Week only from finishing a week (#2086)", () => {
      const trophy = ARCADE_TROPHIES.find(
        (t) => t.id === "patty_drive_thru_full_week"
      );
      expect(trophy).toMatchObject({
        gameId: "patty-drive-thru",
        category: "milestone",
        milestone: "full_week",
      });
      expect(trophy?.targetScore).toBeUndefined();
      const scored = recordArcadeScore("patty-drive-thru", 99999).newlyUnlocked;
      expect(scored.map((t) => t.id)).not.toContain(
        "patty_drive_thru_full_week"
      );
      expect(
        recordArcadeMilestone("patty-drive-thru", "full_week").map((t) => t.id)
      ).toEqual(["patty_drive_thru_full_week"]);
      expect(recordArcadeMilestone("patty-drive-thru", "full_week")).toEqual(
        []
      );
    });

    it("ignores milestones another game or no trophy owns", () => {
      expect(recordArcadeMilestone("laser-loon", "run_won")).toEqual([]);
      expect(recordArcadeMilestone("trial-and-error", "nope")).toEqual([]);
    });

    it("does not unlock Trial & Error trophies from a first-Blind score", () => {
      const { newlyUnlocked } = recordArcadeScore("trial-and-error", 5200);
      expect(newlyUnlocked.map((t) => t.id)).not.toContain(
        "trial_error_csr_lock"
      );
      expect(newlyUnlocked.map((t) => t.id)).not.toContain(
        "trial_error_first_blind"
      );
    });

    it("does not unlock Garmin or Quasi milestone trophies from score", () => {
      const garmin = recordArcadeScore("garmin-watch", 99999).newlyUnlocked;
      const quasi = recordArcadeScore("quasi-puzzler", 1800).newlyUnlocked;
      const ids = [...garmin, ...quasi].map((t) => t.id);
      expect(ids).not.toContain("garmin_gc_master");
      expect(ids).not.toContain("quasi_master_prover");
    });

    it("keeps trophies unlocked under the old score rules", () => {
      const progress = getArcadeProgress();
      progress.unlockedTrophies.trial_error_csr_lock = 1;
      recordArcadeScore("trial-and-error", 10);
      expect(
        getArcadeProgress().unlockedTrophies.trial_error_csr_lock
      ).toBeDefined();
    });

    it("names Hall of Famer once enough game trophies are unlocked", () => {
      const gameTrophies = ARCADE_TROPHIES.filter(
        (t) => t.category !== "cross_game"
      ).map((t) => t.id);
      expect(
        unlockArcadeTrophies(
          gameTrophies.slice(0, HALL_OF_FAME_TROPHY_COUNT - 1)
        ).map((t) => t.id)
      ).not.toContain("arcade_legend");
      expect(
        unlockArcadeTrophies([gameTrophies[HALL_OF_FAME_TROPHY_COUNT - 1]]).map(
          (t) => t.id
        )
      ).toContain("arcade_legend");
    });

    it("gives every milestone trophy a play-based condition", () => {
      for (const trophy of ARCADE_TROPHIES.filter((t) => t.milestone)) {
        expect(trophy.conditionDescription).not.toMatch(/points/i);
      }
    });
  });

  describe("Persistence using SafeStorageAdapter Envelope", () => {
    it("persists progress across calls in safeStorage envelope format", () => {
      recordArcadeScore("laser-loon", 1200);

      const storedEnvelope = safeStorage.getEnvelope(
        ARCADE_UNIFIED_PROGRESS_KEY
      );
      expect(storedEnvelope).not.toBeNull();
      expect(storedEnvelope?.value).toBeDefined();

      const freshProgress = getArcadeProgress();
      expect(freshProgress.highScores["laser-loon"]).toBe(1200);
    });
  });
});
