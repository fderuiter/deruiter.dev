import { describe, expect, it } from "vitest";
import { generateTSPRoom } from "@/lib/dungeon/generator";
import {
  replayTspMoves,
  solveTspRoom,
  tspIsWon,
  tspSyncRoomToPatrols,
} from "@/components/retro-labyrinth/room-solver";
import { ENEMY_STEP_INTERVAL_MS, updateEnemyAI } from "@/lib/dungeon/ai";
import { tspWallTelegraph, updateTSPMovingWalls } from "@/lib/dungeon/tsp";

// Room 1 (the TSP enclave) must stay clearable: the walls and the drone
// patrol cannot close the only route to the nodes or the exit (#2032).
describe("Room 1 stays passable", () => {
  const room = generateTSPRoom();

  it("has a move sequence that visits every node and reaches the exit", () => {
    const moves = solveTspRoom(room);
    expect(moves, "no route exists").not.toBeNull();
    expect(moves!.length).toBeGreaterThan(0);
    expect(moves!.length).toBeLessThanOrEqual(60);
  });

  it("the found sequence replays without a refused move or an enemy touch", () => {
    const moves = solveTspRoom(room)!;
    const end = replayTspMoves(room, moves);
    expect(
      end,
      "a move was refused or an enemy touched the walker"
    ).not.toBeNull();
    expect(tspIsWon(room, end!)).toBe(true);
  });

  it("syncs to patrols that have ticked since generation", () => {
    // Seven idle ticks stand in for the real time the live game runs before the
    // walk starts. Four observed states, one tick apart, must find that state.
    let enemies = room.enemies.map((e) => ({ ...e }));
    const tick = (list: typeof enemies) =>
      updateEnemyAI(
        list,
        room.grid,
        room.startX,
        room.startY,
        ENEMY_STEP_INTERVAL_MS
      ).updatedEnemies;
    for (let i = 0; i < 7; i++) enemies = tick(enemies);
    const observed: string[][] = [];
    for (let i = 0; i < 4; i++) {
      observed.push(enemies.map((e) => `${e.x},${e.y}`));
      enemies = tick(enemies);
    }
    const synced = tspSyncRoomToPatrols(room, observed);
    expect(synced).not.toBeNull();
    expect(synced!.enemies.map((e) => `${e.x},${e.y}`)).toEqual(observed[3]);
  });
});

describe("Room 1 wall telegraph", () => {
  const room = generateTSPRoom();

  it("counts the moves to the next shift that adds a wall, within four", () => {
    const shift = tspWallTelegraph(room.grid, room.tspMovingWalls ?? [], 0);
    expect(shift.stepsUntilAppear).toBeGreaterThanOrEqual(1);
    expect(shift.stepsUntilAppear).toBeLessThanOrEqual(4);
    expect(shift.appearing.length).toBeGreaterThan(0);
  });

  it("lists the appearing cells as walls only after that shift", () => {
    const walls = room.tspMovingWalls ?? [];
    const shift = tspWallTelegraph(room.grid, walls, 0);
    const steps = shift.stepsUntilAppear!;
    const later = updateTSPMovingWalls(room.grid, walls, steps).updatedGrid;
    for (const cell of shift.appearing) {
      const [x, y] = cell.split(",").map(Number);
      expect(later[y][x]).toBe("W");
      expect(room.grid[y][x]).not.toBe("W");
    }
  });

  it("lists walls that the next move takes away as vanishing now", () => {
    const walls = room.tspMovingWalls ?? [];
    const shift = tspWallTelegraph(room.grid, walls, 0);
    const next = updateTSPMovingWalls(room.grid, walls, 1).updatedGrid;
    for (const cell of shift.vanishing) {
      const [x, y] = cell.split(",").map(Number);
      expect(room.grid[y][x]).toBe("W");
      expect(next[y][x]).not.toBe("W");
    }
  });
});
