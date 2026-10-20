// @vitest-environment node
// The Neural Warden fights by its own rules, not as a FaceForge reskin (#2178).
import { describe, it, expect } from "vitest";
import {
  armBossForRoomEntry,
  BOSS_OPENING_GRACE_MS,
  createFaceForgeBoss,
  createNeuralWardenBoss,
  NEURAL_WARDEN_PHASES,
  NEURAL_WARDEN_TELEGRAPH_MS,
  updateBoss,
  updateNeuralWardenBoss,
  type BossState,
} from "@/lib/dungeon";

const W = 15;
const H = 9;

/** A Warden at a given share of its HP, ready to fire at `now`. */
function warden(hpShare: number, salvoCount = 0): BossState {
  const boss = createNeuralWardenBoss(7, 4);
  return {
    ...boss,
    hp: Math.round(boss.maxHp * hpShare),
    lastSalvoTime: 0,
    salvoCount,
  };
}

/** The directions a volley's shots travel, as rounded unit steps. */
function headings(boss: BossState): string[] {
  return [
    ...new Set(
      boss.projectiles.map((p) => {
        const n = Math.hypot(p.vx, p.vy);
        return `${Math.round(p.vx / n)},${Math.round(p.vy / n)}`;
      })
    ),
  ].sort();
}

describe("Neural Warden boss (#2178)", () => {
  it("keeps its own name, colour and phase titles", () => {
    const { updatedBoss } = updateBoss(warden(1), 1, 1, 100, W, H);
    expect(updatedBoss.phaseTitle).toBe(NEURAL_WARDEN_PHASES[1].title);
    expect(updatedBoss.mesh.color).toBe(NEURAL_WARDEN_PHASES[1].color);

    const mid = updateBoss(warden(0.5), 1, 1, 100, W, H).updatedBoss;
    expect(mid.phase).toBe(2);
    expect(mid.phaseTitle).toBe(NEURAL_WARDEN_PHASES[2].title);

    const low = updateBoss(warden(0.2), 1, 1, 100, W, H).updatedBoss;
    expect(low.phase).toBe(3);
    expect(low.phaseTitle).toBe(NEURAL_WARDEN_PHASES[3].title);
  });

  it("leaves FaceForge fighting as before", () => {
    const { updatedBoss } = updateBoss(
      { ...createFaceForgeBoss(7, 4), lastSalvoTime: 0 },
      1,
      1,
      5000,
      W,
      H
    );
    expect(updatedBoss.phaseTitle).toBe("PHASE 1: PROBE VOLLEY");
    expect(updatedBoss.mesh.color).toBe("#ec4899");
    expect(updatedBoss.telegraph).toBeUndefined();
  });

  it("holds fire through the opening grace period", () => {
    const boss = armBossForRoomEntry(createNeuralWardenBoss(7, 4), 10_000);
    const early = updateNeuralWardenBoss(boss, 1, 1, 10_100, W, H);
    expect(early.updatedBoss.projectiles).toHaveLength(0);
    expect(early.updatedBoss.phaseTitle).toMatch(/BOOTING/);
    const later = updateNeuralWardenBoss(
      early.updatedBoss,
      1,
      1,
      10_000 + BOSS_OPENING_GRACE_MS,
      W,
      H
    );
    expect(later.updatedBoss.projectiles.length).toBeGreaterThan(0);
  });

  it("lights the lanes of a lattice volley before it fires", () => {
    const interval = NEURAL_WARDEN_PHASES[1].attackIntervalMs;
    const quiet = updateNeuralWardenBoss(
      { ...warden(1), lastSalvoTime: 10_000 },
      1,
      1,
      10_000 + interval - NEURAL_WARDEN_TELEGRAPH_MS - 50,
      W,
      H
    ).updatedBoss;
    expect(quiet.telegraph).toBeUndefined();

    const locking = updateNeuralWardenBoss(
      { ...warden(1), lastSalvoTime: 10_000 },
      1,
      1,
      10_000 + interval - NEURAL_WARDEN_TELEGRAPH_MS + 50,
      W,
      H
    ).updatedBoss;
    expect(locking.telegraph).toBe("cross");
    expect(locking.phaseTitle).toMatch(/LANES LOCKING/);
    expect(locking.projectiles).toHaveLength(0);
  });

  it("fires phase 1 down the + lanes, then the X lanes", () => {
    const first = updateNeuralWardenBoss(
      warden(1, 0),
      1,
      1,
      5000,
      W,
      H
    ).updatedBoss;
    expect(headings(first)).toEqual(["-1,0", "0,-1", "0,1", "1,0"]);

    const second = updateNeuralWardenBoss(
      warden(1, 1),
      1,
      1,
      5000,
      W,
      H
    ).updatedBoss;
    expect(headings(second)).toEqual(["-1,-1", "-1,1", "1,-1", "1,1"]);
  });

  it("sweeps a two-ended beam that turns every shot in phase 2", () => {
    const a = updateNeuralWardenBoss(
      warden(0.5, 0),
      1,
      1,
      5000,
      W,
      H
    ).updatedBoss;
    const b = updateNeuralWardenBoss(
      warden(0.5, 1),
      1,
      1,
      5000,
      W,
      H
    ).updatedBoss;
    expect(a.projectiles).toHaveLength(2);
    const angle = (s: BossState) =>
      Math.atan2(s.projectiles[0].vy, s.projectiles[0].vx);
    expect(angle(b) - angle(a)).toBeCloseTo(Math.PI / 6);
    // The two ends point opposite ways.
    expect(a.projectiles[0].vx).toBeCloseTo(-a.projectiles[1].vx);
    expect(a.telegraph).toBeUndefined();
  });

  it("aims phase 3 at the lanes the player is nearest, plus a seeker", () => {
    // Player on a diagonal from the boss at (7,4).
    const diag = updateNeuralWardenBoss(
      warden(0.2, 0),
      10,
      7,
      5000,
      W,
      H
    ).updatedBoss;
    expect(diag.projectiles.some((p) => p.id.startsWith("warden-seeker"))).toBe(
      true
    );
    const lanes = diag.projectiles.filter((p) =>
      p.id.startsWith("warden-lane")
    );
    expect(lanes.every((p) => Math.abs(p.vx) > 0 && Math.abs(p.vy) > 0)).toBe(
      true
    );

    // Player in line with the boss: the + lanes.
    const cross = updateNeuralWardenBoss(
      warden(0.2, 0),
      7,
      1,
      5000,
      W,
      H
    ).updatedBoss;
    const crossLanes = cross.projectiles.filter((p) =>
      p.id.startsWith("warden-lane")
    );
    expect(
      crossLanes.every((p) => Math.abs(p.vx) < 1e-9 || Math.abs(p.vy) < 1e-9)
    ).toBe(true);
  });

  it("can be dodged by standing off every lane in phase 1", () => {
    // (9,1) is two across and three up from (7,4): on no + or X lane.
    let boss = warden(1, 0);
    let damage = 0;
    for (let t = 5000; t < 9000; t += 1000 / 60) {
      const res = updateNeuralWardenBoss(boss, 9, 1, t, W, H);
      boss = res.updatedBoss;
      damage += res.spawnedDamage;
    }
    expect(boss.salvoCount).toBeGreaterThanOrEqual(2);
    expect(damage).toBe(0);
  });
});
