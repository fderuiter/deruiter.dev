// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  STORY_RAM_MULTIPLIER,
  computeLevelStars,
  getStartingRam,
  puzzleLevels,
} from "@/lib/quasi-perfect";

const level = { initialRam: 16, goldRamTarget: 15, silverRamTarget: 8 };

describe("Quasi-Perfect Puzzler RAM budget (#1182)", () => {
  it("gives Story Mode a real budget of twice the Hacker Mode RAM", () => {
    expect(getStartingRam(level, "hacker")).toBe(16);
    expect(getStartingRam(level, "story")).toBe(16 * STORY_RAM_MULTIPLIER);
  });

  it("gives every campaign level a finite Story Mode budget", () => {
    for (const lvl of puzzleLevels) {
      const ram = getStartingRam(lvl, "story");
      expect(ram).toBeGreaterThan(lvl.initialRam);
      expect(ram).toBeLessThan(99);
    }
  });

  it("grades RAM used the same way in both modes", () => {
    // 1 GB used: gold in either mode
    expect(computeLevelStars(level, "hacker", 15, false)).toBe(3);
    expect(computeLevelStars(level, "story", 31, false)).toBe(3);
    // 5 GB used: silver in either mode
    expect(computeLevelStars(level, "hacker", 11, false)).toBe(2);
    expect(computeLevelStars(level, "story", 27, false)).toBe(2);
    // 12 GB used: bronze in either mode
    expect(computeLevelStars(level, "hacker", 4, false)).toBe(1);
    expect(computeLevelStars(level, "story", 20, false)).toBe(1);
  });

  it("no longer hands out three stars for a wasteful Story Mode proof", () => {
    expect(computeLevelStars(level, "story", 2, false)).toBe(1);
  });

  it("gives zero stars for a proof admitted with sorry", () => {
    expect(computeLevelStars(level, "story", 32, true)).toBe(0);
  });
});
