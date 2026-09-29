import { describe, it, expect } from "vitest";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { DEVICE_PROFILES } from "@/lib/garmin-engine";

// #1319 / #1214: the Garmin field manual described a different game (a SELECT
// button, sensor widgets, GPS polling, heart-rate fog) and never mentioned
// jumping, pausing, the score rules or the device tiers.
describe("Garmin field manual matches the playable runner", () => {
  const manual = GAME_MANUALS["garmin-watch"];
  const text = JSON.stringify(manual);

  it("drops controls and systems the game doesn't have", () => {
    expect(text).not.toMatch(/SELECT|sensor widget|Sensor Rate|GPS polling/i);
    expect(text).not.toMatch(/heart-rate intervals|high HR workouts/i);
  });

  it("documents every key the watch handles", () => {
    const keys = manual.controls.map((c) => c.key ?? "").join(" ");
    for (const key of [
      "Enter",
      "Space",
      "↑",
      "↓",
      "G",
      "Backspace",
      "L",
      "W",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("states the endless objective, the scoring and every crash cause", () => {
    expect(manual.objective).toMatch(/endless/i);
    expect(text).toMatch(/high score/i);
    for (const cause of [
      "Null Pointer",
      "Watchdog Tripped",
      "Out Of Memory",
      "Out Of Storage",
    ]) {
      expect(text).toContain(cause);
    }
    expect(text).toMatch(/power loss/i);
  });

  it("describes each device tier with its real limits", () => {
    for (const profile of Object.values(DEVICE_PROFILES)) {
      const model = profile.name.replace(/\s*\(.*\)$/, "");
      expect(text).toContain(model);
      expect(text).toContain(`${profile.ramLimitKb} KB`);
    }
  });
});
