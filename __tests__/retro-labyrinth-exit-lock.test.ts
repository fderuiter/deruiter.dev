import { describe, it, expect } from "vitest";
import {
  BOSS_MAX_LEAD_TILES,
  createFaceForgeBoss,
  generateRoguelikeCampaign,
  getBossAimPoint,
  getExitLockState,
  updateFaceForgeBoss,
} from "@/lib/dungeon";

// #1321: room 2's boss could be walked past to the exit in 18 moves, room 1
// took 21 moves and no damage, and aimed shots missed any moving player.

describe("Labyrinth exits wait for the room objective (#1321)", () => {
  it("locks the exit while the boss is alive and opens it once defeated", () => {
    const boss = createFaceForgeBoss(7, 4);
    const locked = getExitLockState(boss, undefined);
    expect(locked.locked).toBe(true);
    expect(locked.objective).toBe("DEFEAT THE BOSS");
    expect(locked.lockedMessage).toBe("EXIT LOCKED: DEFEAT THE BOSS");

    const open = getExitLockState({ ...boss, hp: 0, defeated: true }, []);
    expect(open.locked).toBe(false);
  });

  it("locks the exit until every route node is visited, counting progress", () => {
    const nodes = [
      { id: 1, x: 3, y: 1, visited: true },
      { id: 2, x: 7, y: 2, visited: false },
      { id: 3, x: 10, y: 5, visited: false },
    ];
    const state = getExitLockState(undefined, nodes);
    expect(state.locked).toBe(true);
    expect(state.objective).toBe("VISIT THE ROUTE NODES (1/3)");
    expect(state.lockedMessage).toBe("EXIT LOCKED: 2 ROUTE NODES LEFT");

    const oneLeft = getExitLockState(
      undefined,
      nodes.map((n) => ({ ...n, visited: n.id !== 3 }))
    );
    expect(oneLeft.lockedMessage).toBe("EXIT LOCKED: 1 ROUTE NODE LEFT");

    const done = getExitLockState(
      undefined,
      nodes.map((n) => ({ ...n, visited: true }))
    );
    expect(done.locked).toBe(false);
  });

  it("leaves rooms with no boss or route nodes open", () => {
    expect(getExitLockState(undefined, undefined).locked).toBe(false);
    expect(getExitLockState(undefined, []).locked).toBe(false);
  });

  it("puts every route node on an open tile the player can reach", () => {
    // Room 1's third node sat inside a wall; with the exit locked on the
    // nodes, that would have made the room impossible to leave.
    for (const room of generateRoguelikeCampaign()) {
      const reached = new Set([`${room.startX},${room.startY}`]);
      const queue = [[room.startX, room.startY]];
      while (queue.length > 0) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const key = `${x + dx},${y + dy}`;
          const cell = room.grid[y + dy]?.[x + dx];
          if (cell === undefined || cell === "#" || reached.has(key)) continue;
          reached.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
      for (const node of room.tspNodes ?? []) {
        expect(
          room.grid[node.y][node.x],
          `${room.id} node ${node.id}`
        ).not.toBe("#");
        expect(
          reached.has(`${node.x},${node.y}`),
          `${room.id} ${node.id}`
        ).toBe(true);
      }
      expect(reached.has(`${room.exitX},${room.exitY}`), room.id).toBe(true);
    }
  });

  it("starts the first two campaign rooms with a locked exit", () => {
    const [room1, room2] = generateRoguelikeCampaign();
    expect(getExitLockState(room1.boss, room1.tspNodes).locked).toBe(true);
    expect(getExitLockState(room2.boss, room2.tspNodes).objective).toBe(
      "DEFEAT THE BOSS"
    );
  });
});

describe("Boss salvos lead a moving player (#1321)", () => {
  it("aims at the player's tile when they are standing still", () => {
    const boss = createFaceForgeBoss(7, 4);
    expect(getBossAimPoint(boss, 3, 1)).toEqual({ x: 3, y: 1 });
    expect(getBossAimPoint(boss, 3, 1, { dx: 0, dy: 0 })).toEqual({
      x: 3,
      y: 1,
    });
  });

  it("aims ahead along the player's heading, capped for far targets", () => {
    const boss = createFaceForgeBoss(7, 4);
    // Two tiles away: half the distance ahead.
    expect(getBossAimPoint(boss, 7, 2, { dx: 1, dy: 0 })).toEqual({
      x: 8,
      y: 2,
    });
    // Far away: the lead stops at the cap.
    const far = getBossAimPoint(boss, 1, 1, { dx: 1, dy: 0 });
    expect(far.x).toBe(1 + BOSS_MAX_LEAD_TILES);
    expect(far.y).toBe(1);
  });

  it("fires a fan of three in phase 1 that is centred on the lead point", () => {
    const boss = createFaceForgeBoss(7, 4);
    const still = updateFaceForgeBoss(boss, 3, 1, 5000, 15, 9);
    const moving = updateFaceForgeBoss(boss, 3, 1, 5000, 15, 9, {
      dx: 1,
      dy: 0,
    });
    expect(still.updatedBoss.projectiles).toHaveLength(3);
    expect(moving.updatedBoss.projectiles).toHaveLength(3);

    const centre = (res: typeof still) => {
      const p = res.updatedBoss.projectiles[1];
      return Math.atan2(p.vy, p.vx);
    };
    const aim = getBossAimPoint(boss, 3, 1, { dx: 1, dy: 0 });
    expect(centre(moving)).toBeCloseTo(
      Math.atan2(aim.y - boss.y, aim.x - boss.x),
      6
    );
    expect(centre(moving)).not.toBeCloseTo(centre(still), 3);
  });

  it("widens the phase 2 spread to five shots", () => {
    const boss = { ...createFaceForgeBoss(7, 4), hp: 150 };
    const res = updateFaceForgeBoss(boss, 3, 1, 5000, 15, 9);
    expect(res.updatedBoss.phase).toBe(2);
    expect(res.updatedBoss.projectiles).toHaveLength(5);
  });
});
