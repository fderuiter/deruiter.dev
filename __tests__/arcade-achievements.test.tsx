/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordArcadeScore,
  getArcadeProgress,
  parseScoreValue,
  ARCADE_UNIFIED_PROGRESS_KEY,
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

      // Score 150 in Working With Duck (unlocks duck_first_sprint)
      const result = recordArcadeScore("working-with-duck", 150);

      expect(result.newlyUnlocked.length).toBeGreaterThan(0);
      expect(
        result.newlyUnlocked.some((t) => t.id === "duck_first_sprint")
      ).toBe(true);
      expect(trophyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          trophyId: "duck_first_sprint",
          gameId: "working-with-duck",
          title: "Deadline Met",
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
      expect(unlockedIds).toContain("arcade_legend");
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
