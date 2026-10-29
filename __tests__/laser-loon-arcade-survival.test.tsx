// Laser Loon Arcade Survival (#2141): waves that ramp and rotate the act
// rosters, hearts that end the run, and a title screen that names the mode.
import React from "react";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MINION_FIRE_FIRST_ACT,
  SURVIVAL_FULL_HEAT_SECONDS,
  SURVIVAL_WAVE_SECONDS,
  formatRunClock,
  getSurvivalWave,
} from "@/lib/laser-loon";
import { LaserLoon } from "@/components/LaserLoon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

describe("getSurvivalWave (#2141)", () => {
  it("rotates the act rosters every wave and loops after the Capitol", () => {
    const labels = [0, 1, 2, 3, 4].map(
      (w) => getSurvivalWave(w * SURVIVAL_WAVE_SECONDS).label
    );
    expect(labels).toEqual(["Lake", "Fair", "Hearing", "Capitol", "Lake"]);
    expect(getSurvivalWave(SURVIVAL_WAVE_SECONDS - 0.1).wave).toBe(0);
    expect(getSurvivalWave(SURVIVAL_WAVE_SECONDS).rosterAct).toBe(2);
  });

  it("holds fire in the first wave, then fires harder each wave up to a cap", () => {
    expect(getSurvivalWave(0).fireLevel).toBe(0);
    const levels = [1, 2, 3, 4, 8].map(
      (w) => getSurvivalWave(w * SURVIVAL_WAVE_SECONDS).fireLevel
    );
    expect(levels).toEqual([
      MINION_FIRE_FIRST_ACT,
      MINION_FIRE_FIRST_ACT + 1,
      MINION_FIRE_FIRST_ACT + 2,
      MINION_FIRE_FIRST_ACT + 3,
      MINION_FIRE_FIRST_ACT + 3,
    ]);
  });

  it("ramps spawns and crowd size until full heat, then holds", () => {
    const start = getSurvivalWave(0);
    const hot = getSurvivalWave(SURVIVAL_FULL_HEAT_SECONDS);
    const later = getSurvivalWave(SURVIVAL_FULL_HEAT_SECONDS * 3);
    expect(hot.spawnChance).toBeGreaterThan(start.spawnChance);
    expect(hot.maxTargets).toBeGreaterThan(start.maxTargets);
    expect(later.spawnChance).toBe(hot.spawnChance);
    expect(later.maxTargets).toBe(hot.maxTargets);
  });

  it("treats bad input as the start of a run", () => {
    expect(getSurvivalWave(-5)).toEqual(getSurvivalWave(0));
    expect(getSurvivalWave(Number.NaN)).toEqual(getSurvivalWave(0));
  });
});

describe("formatRunClock (#2141)", () => {
  it("reads minutes and padded seconds", () => {
    expect(formatRunClock(0)).toBe("0:00");
    expect(formatRunClock(65.9)).toBe("1:05");
    expect(formatRunClock(-3)).toBe("0:00");
  });
});

describe("Arcade Survival in the cabinet (#2141)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows hearts, the wave and a survival clock in the HUD", async () => {
    render(<LaserLoon />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Arcade Survival/i }));
    });
    const hud = screen.getByLabelText("Game status");
    expect(hud.textContent).toContain("Lake");
    expect(hud.textContent).toContain("0:00");
    expect(screen.getByRole("img", { name: /Hits left: 3 of 3/ })).toBeTruthy();
  });

  it("names the picked mode on the title screen", async () => {
    render(<LaserLoon />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Arcade Survival/i }));
    });
    expect(screen.getByText("ARCADE SURVIVAL")).toBeTruthy();
    expect(screen.getByRole("button", { name: /START SURVIVAL/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /START CAMPAIGN/ })).toBeNull();
  });

  it("lets contact damage and minion fire run outside the campaign, never in sandbox", () => {
    // The session logic lives in its hook since #3436.
    const source = [
      "components/LaserLoon.tsx",
      "components/laser-loon/useLaserLoonSession.ts",
    ]
      .map((file) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8"))
      .join("\n");
    expect(source).toContain(
      'Enemy contact costs the loon a hit in campaign and survival play\n      if (gameState === "playing" && mode !== "sandbox")'
    );
    expect(source).toContain(
      'mode === "arcade" ? wave.fireLevel : currentActNum'
    );
    expect(source).toMatch(
      /if \(mode === "arcade"\) \{\s+setGameState\("gameover"\);/
    );
  });

  it("keeps the result cards from repeating the clock or centering the star row (#2262)", () => {
    // The session logic lives in its hook since #3436.
    const source = [
      "components/LaserLoon.tsx",
      "components/laser-loon/useLaserLoonSession.ts",
    ]
      .map((file) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8"))
      .join("\n");
    // The headline already reads "Survived 1:42"; a "102s" tile repeated it.
    expect(source).not.toContain('{ label: "Survived", value: survivalSecs');
    expect(source).toContain('{ label: "Flags downed", value: runKills }');
    expect(source).toMatch(
      /runKillsRef\.current \+= 1;\s+setRunKills\(runKillsRef\.current\);\s+if \(mode !== "campaign"\) return;/
    );
    expect(source).toMatch(/setRunKills\(0\);\s+runKillsRef\.current = 0;/);
    expect(source).toMatch(
      /data-testid="laser-loon-campaign-stars"\s+className="font-mono text-xs text-neutral-300"/
    );
  });
});
