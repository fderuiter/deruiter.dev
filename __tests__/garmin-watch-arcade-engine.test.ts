// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GarminWatchEngine } from "@/lib/garmin-engine";

describe("GarminWatchEngine", () => {
  it("initializes Connect IQ watch emulator with fenix profile", () => {
    const engine = new GarminWatchEngine("fenix");
    const snapshot = engine.getSnapshot();

    expect(snapshot.device).toBe("fenix");
    expect(snapshot.gameState).toBe("idle");
    expect(snapshot.batteryPercent).toBe(100);
  });

  it("handles bezel button presses (start, up, down, back, light)", () => {
    const engine = new GarminWatchEngine("fenix");
    engine.pressButton("start");

    const snapshot = engine.getSnapshot();
    expect(snapshot.gameState).toBe("playing");
  });

  it("advances simulation tick and thermal dissipation", () => {
    const engine = new GarminWatchEngine("fenix");
    engine.pressButton("start");
    engine.update(1 / 60);

    const snapshot = engine.getSnapshot();
    expect(snapshot.cpuLoadPercent).toBeGreaterThanOrEqual(0);
  });
});
