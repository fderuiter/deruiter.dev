// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getActAvailableEnemies,
  spawnTarget,
  spawnBossForAct,
  updatePowerUps,
  createIceBlock,
  updateIceBlocksAndCollisions,
  updateTargetsPosition,
  checkLaserRayHit,
  createExplosionParticles,
  updateParticles,
  Target,
  PowerUp,
} from "@/lib/laser-loon";

describe("Laser Loon Physics, Geometry & Simulation Fixtures", () => {
  it("generates correct enemy pools for all acts and default fallback", () => {
    expect(getActAvailableEnemies(1)).toEqual([
      "mosquito",
      "hailstorm",
      "jetski",
    ]);
    expect(getActAvailableEnemies(2)).toEqual([
      "butter-bomb",
      "pronto-pup-rogue",
      "livestock-decoy",
      "mosquito",
    ]);
    expect(getActAvailableEnemies(3)).toEqual([
      "red-tape",
      "veto-stamp",
      "tricolor-rival",
      "clipboard",
    ]);
    expect(getActAvailableEnemies(4)).toEqual([
      "legislative-amendment",
      "seal-guardian",
      "polar-vortex",
      "red-tape",
    ]);
    expect(getActAvailableEnemies(99)).toEqual([
      "mosquito",
      "hailstorm",
      "butter-bomb",
      "red-tape",
      "veto-stamp",
      "tricolor-rival",
    ]);
  });

  it("spawns targets from top edge, bottom edge, and default right edge", () => {
    // Spawn targets with random variations
    const targets: Target[] = [];
    let nextId = 1;

    for (let i = 0; i < 20; i++) {
      const res = spawnTarget(
        targets,
        nextId,
        800,
        500,
        undefined,
        (i % 4) + 1
      );
      nextId = res.nextId;
      targets.push(res.newTarget);
    }

    expect(targets.length).toBe(20);
    expect(targets.every((t) => t.hp > 0 && t.maxHp > 0)).toBe(true);
  });

  it("simulates boss flight trajectory, boundary reflections, and shield rotation", () => {
    const { boss } = spawnBossForAct(1, 100, 800, 500);

    // Initial state
    expect(boss.isBoss).toBe(true);
    expect(boss.shieldAngle).toBe(0);

    // Run multi-tick physics
    let currentBoss = boss;
    for (let tick = 0; tick < 100; tick++) {
      const updated = updateTargetsPosition(
        [currentBoss],
        1,
        "campaign",
        0.15,
        500,
        800
      );
      currentBoss = updated[0];
      expect(currentBoss.y).toBeGreaterThanOrEqual(80);
      expect(currentBoss.y).toBeLessThanOrEqual(420);
    }

    expect(currentBoss.shieldAngle).toBeGreaterThan(0);
  });

  it("evaluates raycasting across all weapon types: quantum-beam, cryo-lance, and ruby-laser", () => {
    const target: Target = {
      id: 1,
      x: 300,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 20,
      type: "mosquito",
      label: "Mosquito",
      color: "#f43f5e",
      hp: 10,
      maxHp: 10,
      points: 100,
      pulsePhase: 0,
      frozenTimer: 0,
    };

    // Cyan pulse
    const resQuantum = checkLaserRayHit(100, 200, 500, 200, "cyan-pulse", [
      target,
    ]);
    expect(resQuantum.hitAny).toBe(true);
    expect(resQuantum.damagedPoints.length).toBe(1);

    // Ice cannon
    const resCryo = checkLaserRayHit(100, 200, 500, 200, "ice-cannon", [
      target,
    ]);
    expect(resCryo.hitAny).toBe(true);

    // Ruby laser with overcharge
    const resRuby = checkLaserRayHit(
      100,
      200,
      500,
      200,
      "ruby-laser",
      [target],
      true
    );
    expect(resRuby.hitAny).toBe(true);
  });

  it("simulates ice block physics in sandbox mode with wall bounces and gravity", () => {
    const { iceBlock } = createIceBlock(100, 10, 400, -100, 1, 10);
    iceBlock.vy = -10; // Moving up towards top wall

    const res = updateIceBlocksAndCollisions(
      [iceBlock],
      [],
      1,
      "sandbox",
      0.5,
      800,
      500
    );

    expect(res.shatteredBlocks.length).toBeGreaterThan(0); // Bounced and left shatter effect
    expect(res.updatedIceBlocks.length).toBe(1);
    expect(res.updatedIceBlocks[0].vy).toBeGreaterThan(0); // Inverted direction downward
  });

  it("handles ice block bounce against bottom wall boundary", () => {
    const { iceBlock } = createIceBlock(100, 495, 400, 600, 1, 10);
    iceBlock.vy = 10; // Moving down towards bottom wall

    const res = updateIceBlocksAndCollisions(
      [iceBlock],
      [],
      1,
      "sandbox",
      0.5,
      800,
      500
    );

    expect(res.shatteredBlocks.length).toBeGreaterThan(0);
    expect(res.updatedIceBlocks[0].vy).toBeLessThan(0); // Inverted direction upward
  });

  it("culls out-of-bounds power-ups that travel past the left screen threshold", () => {
    const powerUps: PowerUp[] = [
      {
        id: 1,
        x: -50,
        y: 200,
        vx: -5,
        vy: 0,
        type: "hotdish",
        label: "Hotdish",
        color: "#fbbf24",
        pulsePhase: 0,
        durationMs: 5000,
      },
      {
        id: 2,
        x: 300,
        y: 200,
        vx: -2,
        vy: 0,
        type: "pronto-pup",
        label: "Pronto Pup",
        color: "#f97316",
        pulsePhase: 0,
        durationMs: 5000,
      },
    ];

    const res = updatePowerUps(powerUps, 1, 100, 100, 32);
    expect(res.remainingPowerUps).toHaveLength(1);
    expect(res.remainingPowerUps[0].id).toBe(2);
    expect(res.collectedPowerUp).toBeNull();
  });

  it("creates star explosion particles and updates particle fading lifecycle", () => {
    const starParticles = createExplosionParticles(
      200,
      200,
      "#f59e0b",
      8,
      false,
      true
    );
    expect(starParticles).toHaveLength(8);
    expect(starParticles[0].shape).toBe("star");

    const updated = updateParticles(starParticles, 2);
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0].alpha).toBeLessThan(1);
  });
});
