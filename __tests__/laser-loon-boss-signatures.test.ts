// @vitest-environment node
// #2144: all four bosses shared one aimed volley. Each now has its own
// signature attack, and the Starflake's shield turns beams away.
import { describe, it, expect } from "vitest";
import {
  BOSS_SIGNATURE_HINTS,
  CAMPAIGN_ACTS,
  GAVEL_WALL_GAP,
  STARFLAKE_SHIELD_HALF_ARC,
  SWARM_MAX_MINIONS,
  checkLaserRayHit,
  getBossSignature,
  isShieldFacing,
  spawnBossForAct,
  updateBossAttack,
  updateTargetsPosition,
  type Target,
} from "@/lib/laser-loon";

const LOON = { x: 120, y: 210 };

function firstVolley(act: number, phaseTwo = false, rng = () => 0.5) {
  let targets: Target[] = [spawnBossForAct(act, 1).boss];
  if (phaseTwo) targets[0] = { ...targets[0], hp: 1 };
  let nextId = 100;
  for (let frame = 0; frame < 1000; frame++) {
    const r = updateBossAttack(targets, 1, LOON.x, LOON.y, act, nextId, rng);
    targets = r.targets;
    nextId = r.nextId;
    if (r.fired) return targets.filter((t) => !t.isBoss);
  }
  throw new Error("no volley");
}

describe("boss signatures (#2144)", () => {
  it("gives each campaign boss a different signature with a hint", () => {
    const signatures = CAMPAIGN_ACTS.map((a) => getBossSignature(a.bossType));
    expect(signatures).toEqual(["swarm", "lob", "burst", "wall"]);
    for (const sig of signatures) {
      expect(BOSS_SIGNATURE_HINTS[sig].length).toBeGreaterThan(10);
    }
  });

  it("has the Mosquito Queen call a swarm alongside her shot, up to a cap", () => {
    const volley = firstVolley(1);
    expect(volley.filter((t) => t.isProjectile)).toHaveLength(1);
    const swarm = volley.filter((t) => !t.isProjectile);
    expect(swarm).toHaveLength(2);
    expect(swarm.every((t) => t.type === "mosquito" && t.vx < 0)).toBe(true);

    const crowded: Target[] = [
      spawnBossForAct(1, 1).boss,
      ...Array.from({ length: SWARM_MAX_MINIONS }, (_, i) => ({
        ...swarm[0],
        id: 500 + i,
      })),
    ];
    crowded[0] = { ...crowded[0], specialAttackTimer: 10_000 };
    const r = updateBossAttack(crowded, 1, LOON.x, LOON.y, 1, 900);
    expect(
      r.targets.filter((t) => t.type === "mosquito" && !t.isProjectile)
    ).toHaveLength(SWARM_MAX_MINIONS);
  });

  it("has the Butter Colossus lob pats that fall toward the loon", () => {
    const pats = firstVolley(2);
    expect(pats).toHaveLength(2);
    expect(pats.every((p) => p.isProjectile && (p.ay ?? 0) > 0)).toBe(true);
    // Fly the first pat: it comes down within reach of where the loon was.
    let flying = [pats[0]];
    let closest = Infinity;
    for (let f = 0; f < 200 && flying.length; f++) {
      flying = updateTargetsPosition(flying, 1, "campaign", 0);
      if (flying[0]) {
        closest = Math.min(
          closest,
          Math.hypot(flying[0].x - LOON.x, flying[0].y - LOON.y)
        );
      }
    }
    expect(closest).toBeLessThan(20);
    expect(firstVolley(2, true)).toHaveLength(3);
  });

  it("has the Starflake fire a radial burst, denser in phase 2", () => {
    const burst = firstVolley(3);
    expect(burst).toHaveLength(8);
    expect(burst.some((s) => s.vx > 0)).toBe(true);
    expect(burst.some((s) => s.vx < 0)).toBe(true);
    expect(firstVolley(3, true)).toHaveLength(12);
  });

  it("has the Gavel slam a wall with one gap the loon fits through", () => {
    const wall = firstVolley(4, false, () => 0.5);
    expect(wall.length).toBeGreaterThan(8);
    expect(wall.every((s) => s.vx < 0 && s.vy === 0)).toBe(true);
    const ys = wall.map((s) => s.y).sort((a, b) => a - b);
    const widest = Math.max(...ys.slice(1).map((y, i) => y - ys[i]));
    expect(widest).toBeGreaterThanOrEqual(GAVEL_WALL_GAP - 30);
  });

  it("alternates the Gavel's walls with aimed volleys in phase 2", () => {
    let targets: Target[] = [{ ...spawnBossForAct(4, 1).boss, hp: 1 }];
    let nextId = 100;
    const volleys: number[] = [];
    for (let f = 0; f < 2000 && volleys.length < 2; f++) {
      const before = targets.filter((t) => t.isProjectile).length;
      const r = updateBossAttack(targets, 1, LOON.x, LOON.y, 4, nextId);
      targets = r.targets;
      nextId = r.nextId;
      if (r.fired) {
        volleys.push(targets.filter((t) => t.isProjectile).length - before);
      }
    }
    expect(volleys[0]).toBeGreaterThan(8);
    expect(volleys[1]).toBe(3);
  });
});

describe("Starflake shield (#2144)", () => {
  const starflake = (shieldAngle: number): Target => ({
    ...spawnBossForAct(3, 1).boss,
    x: 600,
    y: 210,
    shieldAngle,
  });

  it("faces a beam from the loon only while its arc points that way", () => {
    expect(isShieldFacing(starflake(Math.PI), LOON.x, LOON.y)).toBe(true);
    expect(isShieldFacing(starflake(0), LOON.x, LOON.y)).toBe(false);
    expect(
      isShieldFacing(
        starflake(Math.PI - STARFLAKE_SHIELD_HALF_ARC - 0.1),
        LOON.x,
        LOON.y
      )
    ).toBe(false);
    const other = { ...spawnBossForAct(1, 1).boss, x: 600, y: 210, shieldAngle: Math.PI };
    expect(isShieldFacing(other, LOON.x, LOON.y)).toBe(false);
  });

  it("turns a beam away while shielded and takes it while open", () => {
    const shielded = checkLaserRayHit(LOON.x, LOON.y, 600, 210, "ruby-laser", [
      starflake(Math.PI),
    ]);
    expect(shielded.updatedTargets[0].hp).toBe(starflake(Math.PI).hp);
    expect(shielded.damagedPoints[0].counter).toBe("blocked");

    const open = checkLaserRayHit(LOON.x, LOON.y, 600, 210, "ruby-laser", [
      starflake(0),
    ]);
    expect(open.updatedTargets[0].hp).toBeLessThan(starflake(0).hp);
  });
});
