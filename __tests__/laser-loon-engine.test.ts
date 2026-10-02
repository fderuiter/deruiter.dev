// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LaserLoonEngine } from "@/lib/laser-loon/engine";

describe("LaserLoonEngine", () => {
  it("initializes with starting campaign act and ruby-laser weapon", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    const snapshot = engine.getSnapshot();

    expect(snapshot.mode).toBe("campaign");
    expect(snapshot.currentAct).toBe(1);
    expect(snapshot.laserType).toBe("ruby-laser");
    expect(snapshot.score).toBe(0);
    expect(snapshot.multiplier).toBe(1);
    expect(snapshot.gameState).toBe("idle");
  });

  it("starts the game and spawns initial targets", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    engine.startGame();

    const snapshot = engine.getSnapshot();
    expect(snapshot.gameState).toBe("playing");
    expect(snapshot.targets.length).toBeGreaterThanOrEqual(1);
  });

  it("updates loon position and aim smoothly", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    engine.startGame();

    engine.setAim(600, 300);
    engine.setLoonTargetY(250);

    // Advance 25 frames (25 * 1/60s)
    for (let i = 0; i < 25; i++) {
      engine.update(1 / 60);
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.aimPos.x).toBe(600);
    expect(snapshot.aimPos.y).toBe(300);
    expect(snapshot.loonPos.y).toBeCloseTo(250, 0);
  });

  it("launches ice blocks into physics simulation", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    engine.startGame();

    const initialIceCount = engine.getSnapshot().iceBlocks.length;
    engine.launchIceBlock(400, 200);

    const snapshot = engine.getSnapshot();
    expect(snapshot.iceBlocks.length).toBe(initialIceCount + 1);

    // Update physics
    engine.update(1 / 60);
    expect(engine.getSnapshot().iceBlocks[0].x).toBeGreaterThan(400);
  });

  it("cycles weapon types and updates state snapshot", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    engine.setLaserType("aurora-wave");

    expect(engine.getSnapshot().laserType).toBe("aurora-wave");
  });

  it("uses ObjectPool to generate particle explosions without garbage collection churn", () => {
    const engine = new LaserLoonEngine({ mode: "campaign" });
    engine.startGame();

    engine.spawnExplosion(300, 200, "#ef4444", 15);
    const snapshot = engine.getSnapshot();

    expect(snapshot.activeParticleCount).toBeGreaterThanOrEqual(15);

    // Advance 2 seconds so particles expire
    engine.update(2.0);
    expect(engine.getSnapshot().activeParticleCount).toBe(0);
  });
});
