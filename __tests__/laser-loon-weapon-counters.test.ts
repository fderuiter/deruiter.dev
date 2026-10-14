// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_ACTS,
  ENEMY_TYPES,
  RESISTED_DAMAGE_MULTIPLIER,
  WEAKNESS_DAMAGE_MULTIPLIER,
  WEAPONS,
  checkLaserRayHit,
  getActAvailableEnemies,
  getActNewEnemies,
  getEnemyWeakness,
  getWeaponCounter,
  getWeaponDamageMultiplier,
  spawnBossForAct,
  spawnTarget,
  updateIceBlocksAndCollisions,
  type CivicEnemyType,
  type IceBlock,
  type LaserType,
  type Target,
} from "@/lib/laser-loon";

const ALL_WEAPONS = Object.keys(WEAPONS) as LaserType[];
const RAY_WEAPONS = ALL_WEAPONS.filter((w) => w !== "ice-cannon");

function makeTarget(type: CivicEnemyType, overrides: Partial<Target> = {}) {
  const template = ENEMY_TYPES.find((e) => e.type === type)!;
  const target: Target = {
    id: 1,
    x: 300,
    y: 200,
    vx: 0,
    vy: 0,
    radius: template.radius,
    type,
    label: template.label,
    color: template.color,
    hp: template.hp,
    maxHp: template.hp,
    points: template.points,
    pulsePhase: 0,
    frozenTimer: 0,
    isBoss: template.isBoss ?? false,
    ...overrides,
  };
  return target;
}

function iceBlockAt(x: number, y: number): IceBlock {
  return { id: 1, x, y, vx: 0, vy: 0, size: 20, rotation: 0, vRot: 0, hp: 1 };
}

/** Shots (ray hits or mortar blocks) one weapon needs to kill a fresh target. */
function shotsToKill(target: Target, weapon: LaserType, cap = 80): number {
  let current: Target | undefined = target;
  for (let shot = 1; shot <= cap; shot++) {
    if (weapon === "ice-cannon") {
      const res = updateIceBlocksAndCollisions(
        [iceBlockAt(current.x, current.y)],
        [current],
        0,
        "campaign",
        0
      );
      if (res.killedTargets.length > 0) return shot;
      current = res.updatedTargets[0];
    } else {
      const res = checkLaserRayHit(100, current.y, 600, current.y, weapon, [
        current,
      ]);
      if (res.killedTargets.length > 0) return shot;
      current = res.updatedTargets[0];
    }
    if (!current) return shot;
  }
  return Infinity;
}

/** Milliseconds of sustained fire one weapon needs to clear a minion. */
function timeToKillMs(type: CivicEnemyType, weapon: LaserType): number {
  return shotsToKill(makeTarget(type), weapon) * WEAPONS[weapon].fireIntervalMs;
}

describe("Laser Loon weapon counters (#2052)", () => {
  describe("counter table", () => {
    it("gives every minion exactly one weakness and leaves bosses neutral", () => {
      for (const template of ENEMY_TYPES) {
        if (template.isBoss) {
          expect(getEnemyWeakness(template.type)).toBeUndefined();
          for (const weapon of ALL_WEAPONS) {
            expect(getWeaponCounter(template.type, weapon)).toBe("neutral");
          }
        } else {
          const weak = getEnemyWeakness(template.type);
          expect(weak).toBeDefined();
          expect(template.resists ?? []).not.toContain(weak);
        }
      }
    });

    it("armours Veto Stamps against everything except the Cryo-Mortar", () => {
      expect(getWeaponCounter("veto-stamp", "ice-cannon")).toBe("weak");
      expect(getWeaponCounter("veto-stamp", "ruby-laser")).toBe("resisted");
      expect(getWeaponCounter("veto-stamp", "cyan-pulse")).toBe("resisted");
      expect(getWeaponCounter("veto-stamp", "aurora-wave")).toBe("resisted");
    });

    it("shields Seal Drones against everything except Aurora's wide wave", () => {
      expect(getWeaponCounter("seal-guardian", "aurora-wave")).toBe("weak");
      expect(getWeaponCounter("seal-guardian", "ruby-laser")).toBe("resisted");
      expect(getWeaponCounter("seal-guardian", "cyan-pulse")).toBe("resisted");
      expect(getWeaponCounter("seal-guardian", "ice-cannon")).toBe("resisted");
    });

    it("makes the swarm types weak to Cyan Pulse", () => {
      for (const swarm of [
        "mosquito",
        "pronto-pup-rogue",
        "red-tape",
      ] as const) {
        expect(getEnemyWeakness(swarm)).toBe("cyan-pulse");
      }
    });

    it("maps counters to the documented multipliers", () => {
      expect(WEAKNESS_DAMAGE_MULTIPLIER).toBeGreaterThan(1);
      expect(RESISTED_DAMAGE_MULTIPLIER).toBeGreaterThan(0);
      expect(RESISTED_DAMAGE_MULTIPLIER).toBeLessThan(1);
      expect(getWeaponDamageMultiplier("veto-stamp", "ice-cannon")).toBe(
        WEAKNESS_DAMAGE_MULTIPLIER
      );
      expect(getWeaponDamageMultiplier("veto-stamp", "ruby-laser")).toBe(
        RESISTED_DAMAGE_MULTIPLIER
      );
      expect(getWeaponDamageMultiplier("tricolor-rival", "ruby-laser")).toBe(1);
      expect(getWeaponDamageMultiplier("gavel-sovereign", "cyan-pulse")).toBe(
        1
      );
    });
  });

  describe("checkLaserRayHit damage step", () => {
    it("doubles damage on a weakness hit and tags it as weak", () => {
      const target = makeTarget("seal-guardian", { hp: 10, maxHp: 10 });
      const res = checkLaserRayHit(100, 200, 600, 200, "aurora-wave", [target]);
      const expected = 10 - WEAPONS["aurora-wave"].damage * 2;
      expect(res.updatedTargets[0].hp).toBeCloseTo(expected);
      expect(res.damagedPoints[0].counter).toBe("weak");
    });

    it("halves damage on a resisted hit and tags it as resisted", () => {
      const target = makeTarget("veto-stamp", { hp: 10, maxHp: 10 });
      const res = checkLaserRayHit(100, 200, 600, 200, "ruby-laser", [target]);
      const expected = 10 - WEAPONS["ruby-laser"].damage * 0.5;
      expect(res.updatedTargets[0].hp).toBeCloseTo(expected);
      expect(res.damagedPoints[0].counter).toBe("resisted");
    });

    it("leaves neutral hits at full weapon damage", () => {
      const target = makeTarget("tricolor-rival", { hp: 10, maxHp: 10 });
      const res = checkLaserRayHit(100, 200, 600, 200, "ruby-laser", [target]);
      expect(res.updatedTargets[0].hp).toBeCloseTo(
        10 - WEAPONS["ruby-laser"].damage
      );
      expect(res.damagedPoints[0].counter).toBe("neutral");
    });

    it("stacks the counter with the Hotdish overcharge", () => {
      const target = makeTarget("veto-stamp", { hp: 10, maxHp: 10 });
      const res = checkLaserRayHit(
        100,
        200,
        600,
        200,
        "cyan-pulse",
        [target],
        true
      );
      expect(res.updatedTargets[0].hp).toBeCloseTo(
        10 - WEAPONS["cyan-pulse"].damage * 1.6 * 0.5
      );
    });

    it("never applies counters to boss volley shots", () => {
      const shot = makeTarget("seal-guardian", {
        hp: 10,
        maxHp: 10,
        isProjectile: true,
      });
      const res = checkLaserRayHit(100, 200, 600, 200, "ruby-laser", [shot]);
      expect(res.damagedPoints[0].counter).toBe("neutral");
      expect(res.updatedTargets[0].hp).toBeCloseTo(
        10 - WEAPONS["ruby-laser"].damage
      );
    });
  });

  describe("Cryo-Mortar damage step", () => {
    it("crushes an armoured Veto Stamp in one block", () => {
      const res = updateIceBlocksAndCollisions(
        [iceBlockAt(300, 200)],
        [makeTarget("veto-stamp")],
        0,
        "campaign",
        0
      );
      expect(res.killedTargets).toHaveLength(1);
      expect(res.hitPoints[0].counter).toBe("weak");
    });

    it("chips a shielded Seal Drone at half damage", () => {
      const res = updateIceBlocksAndCollisions(
        [iceBlockAt(300, 200)],
        [makeTarget("seal-guardian", { hp: 10, maxHp: 10 })],
        0,
        "campaign",
        0
      );
      expect(res.updatedTargets[0].hp).toBeCloseTo(10 - 3 * 0.5);
      expect(res.hitPoints[0].counter).toBe("resisted");
    });

    it("keeps boss mortar damage neutral", () => {
      const { boss } = spawnBossForAct(3, 1);
      const res = updateIceBlocksAndCollisions(
        [iceBlockAt(boss.x, boss.y)],
        [boss],
        0,
        "campaign",
        0
      );
      expect(res.updatedTargets[0].hp).toBe(boss.hp - 2);
      expect(res.hitPoints[0].counter).toBe("neutral");
    });
  });

  describe("campaign tuning", () => {
    it.each(CAMPAIGN_ACTS.map((a) => a.actNumber))(
      "Act %i stays killable with every single weapon",
      (act) => {
        for (const type of getActAvailableEnemies(act)) {
          for (const weapon of ALL_WEAPONS) {
            const shots = shotsToKill(makeTarget(type), weapon);
            // Slower, never unwinnable: a resisted minion still drops
            // inside about a second of sustained fire.
            expect(shots).toBeLessThanOrEqual(10);
            expect(shots * WEAPONS[weapon].fireIntervalMs).toBeLessThanOrEqual(
              1000
            );
          }
        }
        const { boss } = spawnBossForAct(act, 1);
        for (const weapon of ALL_WEAPONS) {
          expect(Number.isFinite(shotsToKill(boss, weapon, 200))).toBe(true);
        }
      }
    );

    it.each(CAMPAIGN_ACTS.map((a) => a.actNumber))(
      "Act %i rewards mixing weapons over any single one",
      (act) => {
        const pool = getActAvailableEnemies(act);
        const mixed = pool.reduce(
          (sum, type) =>
            sum + Math.min(...ALL_WEAPONS.map((w) => timeToKillMs(type, w))),
          0
        );
        const bestSingle = Math.min(
          ...ALL_WEAPONS.map((w) =>
            pool.reduce((sum, type) => sum + timeToKillMs(type, w), 0)
          )
        );
        expect(mixed).toBeLessThanOrEqual(bestSingle * 0.85);
      }
    );

    it("makes each minion's weakness its fastest kill", () => {
      for (const template of ENEMY_TYPES.filter((e) => !e.isBoss)) {
        const weak = getEnemyWeakness(template.type)!;
        const weakTime = timeToKillMs(template.type, weak);
        for (const weapon of ALL_WEAPONS) {
          expect(weakTime).toBeLessThanOrEqual(
            timeToKillMs(template.type, weapon)
          );
        }
      }
    });

    it("spawns targets that carry their counters through the ray weapons", () => {
      const { newTarget } = spawnTarget([], 1, 768, 420, "veto-stamp", 3);
      for (const weapon of RAY_WEAPONS) {
        const res = checkLaserRayHit(
          0,
          newTarget.y,
          newTarget.x,
          newTarget.y,
          weapon,
          [newTarget]
        );
        expect(res.damagedPoints[0].counter).toBe("resisted");
      }
    });
  });

  describe("act intro field guide", () => {
    it("lists only the enemies new to each act", () => {
      expect(getActNewEnemies(1)).toEqual(["mosquito", "hailstorm", "jetski"]);
      expect(getActNewEnemies(2)).toEqual([
        "butter-bomb",
        "pronto-pup-rogue",
        "livestock-decoy",
      ]);
      expect(getActNewEnemies(3)).toEqual([
        "red-tape",
        "veto-stamp",
        "tricolor-rival",
        "clipboard",
      ]);
      expect(getActNewEnemies(4)).toEqual([
        "legislative-amendment",
        "seal-guardian",
        "polar-vortex",
      ]);
    });
  });
});
