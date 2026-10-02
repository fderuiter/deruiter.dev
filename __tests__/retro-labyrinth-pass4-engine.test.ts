// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  BOSS_REFERENCE_FRAME_MS,
  CYBERDECK_CLASSES,
  DEFAULT_WEAPONS,
  ENEMY_CONTACT_DAMAGE,
  computeRoomExitScore,
  createFaceForgeBoss,
  fireWeapon,
  generateCyberpunkCampaign,
  generateFaceForgeRoom,
  generateRoguelikeCampaign,
  grantAmmoForLoadout,
  isEnemyWalkable,
  updateEnemyAI,
  updateFaceForgeBoss,
  type BossState,
  type Enemy,
  type Weapon,
  type WeaponId,
} from "@/lib/dungeon";

// Pass-4 arcade playtest of Retro Labyrinth: #1665 (enemy contact, patrols
// and step timing), #1667 (boss room winnable after a retry) and #1668
// (each crypto coin scores once).

const openGrid = (): string[][] =>
  Array.from({ length: 9 }, () => Array.from({ length: 15 }, () => " "));

function enemy(overrides: Partial<Enemy>): Enemy {
  return fromPartial<Enemy>({
    id: "e",
    type: "drone",
    name: "Drone",
    x: 5,
    y: 5,
    hp: 40,
    maxHp: 40,
    state: "patrol",
    patrolDir: "right",
    symbol: "D",
    color: "#ef4444",
    ...overrides,
  });
}

describe("enemy contact costs HP and never ends the run by itself (#1665)", () => {
  it("charges 25 HP and leaves the enemy off the player's tile", () => {
    const res = updateEnemyAI(
      [enemy({ x: 4, y: 5, patrolDir: "right" })],
      openGrid(),
      5,
      5,
      ENEMY_CONTACT_DAMAGE
    );
    expect(res.damageToPlayer).toBe(ENEMY_CONTACT_DAMAGE);
    expect(res.contactedPlayer).toBe(true);
    expect(res).not.toHaveProperty("caughtPlayer");
    expect(res.updatedEnemies[0]).toMatchObject({ x: 4, y: 5 });
  });

  it("holds the enemy still for a moment after contact", () => {
    const hit = updateEnemyAI(
      [enemy({ x: 4, y: 5, patrolDir: "right" })],
      openGrid(),
      5,
      5,
      333
    );
    const next = updateEnemyAI(hit.updatedEnemies, openGrid(), 5, 5, 333);
    expect(next.damageToPlayer).toBe(0);
    expect(next.updatedEnemies[0]).toMatchObject({ x: 4, y: 5 });
  });
});

describe("patrols stay on floor tiles inside the grid (#1665)", () => {
  const rooms = [
    ...generateRoguelikeCampaign(),
    ...generateCyberpunkCampaign(),
  ];

  it.each(rooms.map((room) => [room.id, room] as const))(
    "%s: every patrolling enemy stays walkable for 200 steps",
    (_id, room) => {
      let enemies = room.enemies;
      for (const e of enemies) {
        expect(isEnemyWalkable(room.grid, e.x, e.y), `${e.id} spawn`).toBe(
          true
        );
      }
      // The player waits in a wall corner, far from every enemy.
      for (let step = 0; step < 200; step++) {
        enemies = updateEnemyAI(enemies, room.grid, 0, 0, 333).updatedEnemies;
        for (const e of enemies) {
          expect(
            isEnemyWalkable(room.grid, e.x, e.y),
            `${e.id} at (${e.x},${e.y}) on step ${step}`
          ).toBe(true);
        }
      }
    }
  );

  it("moves an up patrol up and turns it at a wall", () => {
    const grid = openGrid();
    grid[2][3] = "#";
    let [e] = updateEnemyAI(
      [enemy({ x: 3, y: 4, patrolDir: "up", minY: 0 })],
      grid,
      14,
      8,
      333
    ).updatedEnemies;
    expect(e).toMatchObject({ y: 3, patrolDir: "up" });
    [e] = updateEnemyAI([e], grid, 14, 8, 333).updatedEnemies;
    expect(e).toMatchObject({ y: 4, patrolDir: "down" });
  });
});

describe("boss projectiles move on elapsed time (#1665)", () => {
  function firedBoss(): BossState {
    const boss = createFaceForgeBoss(7, 4);
    return updateFaceForgeBoss(boss, 1, 4, 5000, 15, 9, undefined, 0)
      .updatedBoss;
  }

  it("covers the same ground in two 120 Hz frames as in one 60 Hz frame", () => {
    const boss = firedBoss();
    expect(boss.projectiles.length).toBeGreaterThan(0);
    const at60 = updateFaceForgeBoss(
      boss,
      1,
      4,
      5001,
      15,
      9,
      undefined,
      BOSS_REFERENCE_FRAME_MS
    ).updatedBoss;
    let at120 = updateFaceForgeBoss(
      boss,
      1,
      4,
      5001,
      15,
      9,
      undefined,
      BOSS_REFERENCE_FRAME_MS / 2
    ).updatedBoss;
    at120 = updateFaceForgeBoss(
      at120,
      1,
      4,
      5002,
      15,
      9,
      undefined,
      BOSS_REFERENCE_FRAME_MS / 2
    ).updatedBoss;
    at60.projectiles.forEach((p, i) => {
      expect(at120.projectiles[i].x).toBeCloseTo(p.x, 6);
      expect(at120.projectiles[i].y).toBeCloseTo(p.y, 6);
    });
  });
});

describe("every class can beat the boss room after a retry (#1667)", () => {
  /** Fires every boss-damaging charge from next to the boss. */
  function bossDamage(
    weapons: Record<WeaponId, Weapon>,
    loadout: readonly WeaponId[]
  ): { defeated: boolean } {
    let boss: BossState | undefined = createFaceForgeBoss(7, 4);
    let current = weapons;
    for (const id of loadout) {
      while (current[id].ammo > 0 && boss && !boss.defeated) {
        const res = fireWeapon(id, current, 6, 4, 80, 80, [], boss, 0, 999);
        current = res.updatedWeapons;
        boss = res.updatedBoss;
      }
    }
    return { defeated: !!boss?.defeated };
  }

  const empty = (): Record<WeaponId, Weapon> =>
    Object.fromEntries(
      Object.entries(DEFAULT_WEAPONS).map(([id, w]) => [id, { ...w, ammo: 0 }])
    ) as Record<WeaponId, Weapon>;

  it.each(Object.values(CYBERDECK_CLASSES).map((c) => [c.id, c] as const))(
    "%s wins from an empty loadout plus the room's git stash",
    (_id, cls) => {
      const room = generateFaceForgeRoom();
      expect(room.items.some((i) => i.itemId === "git_stash")).toBe(true);
      const push = grantAmmoForLoadout(
        empty(),
        cls.starterWeapons,
        "git_force_push",
        1,
        true
      );
      const zeroDay = grantAmmoForLoadout(
        push.updatedWeapons,
        cls.starterWeapons,
        "zero_day",
        1,
        true
      );
      expect(push.weaponId).not.toBeNull();
      expect(cls.starterWeapons).toContain(push.weaponId);
      expect(cls.starterWeapons).toContain(zeroDay.weaponId);
      expect(
        bossDamage(zeroDay.updatedWeapons, cls.starterWeapons).defeated
      ).toBe(true);
    }
  );

  it("gives a class its own weapon's ammo when it carries the granted one", () => {
    const res = grantAmmoForLoadout(
      empty(),
      CYBERDECK_CLASSES.cryptanalyst.starterWeapons,
      "zero_day",
      2,
      false
    );
    expect(res).toMatchObject({ weaponId: "zero_day", charges: 2 });
  });

  it("converts to the same damage in a weapon the class can fire", () => {
    const res = grantAmmoForLoadout(
      empty(),
      CYBERDECK_CLASSES.script_kiddie.starterWeapons,
      "zero_day",
      2,
      false
    );
    // 2 x 220 damage is 10 npm install charges of 45.
    expect(res).toMatchObject({ weaponId: "npm_install", charges: 10 });
  });

  it("gives nothing when the class has no weapon that can use it", () => {
    const res = grantAmmoForLoadout(
      empty(),
      ["port_scan", "emp_blast", "mitm_spoof"],
      "zero_day",
      2,
      false
    );
    expect(res.weaponId).toBeNull();
    expect(res.charges).toBe(0);
  });
});

describe("room exit score counts each crypto coin once (#1668)", () => {
  it("adds only this room's crypto across a three-room run", () => {
    // Room 01: 900 in play, 20 moves (600 bonus), 200 crypto earned.
    const room1 = computeRoomExitScore(900, 20, 200);
    expect(room1).toBe(1700);
    // Room 02: 2000 more in play, 22 moves (560), 500 crypto earned. The
    // 200 from Room 01 is not counted again.
    const room2 = computeRoomExitScore(room1 + 2000, 22, 500);
    expect(room2).toBe(1700 + 2000 + 560 + 500);
    // Room 03: nothing earned; spending at the Market does not lower it.
    const room3 = computeRoomExitScore(room2, 18, 0);
    expect(room3).toBe(room2 + 640);
  });

  it("pays at least the minimum speed bonus", () => {
    expect(computeRoomExitScore(0, 500, 0)).toBe(100);
  });
});
