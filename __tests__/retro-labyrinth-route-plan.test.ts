import { describe, expect, it } from "vitest";
import { planRoute, type Cell } from "@/components/retro-labyrinth/route-plan";

/** A grid from rows of "." (open) and "#" (wall). */
function grid(rows: string[]): boolean[][] {
  return rows.map((row) => [...row].map((ch) => ch === "."));
}

describe("planRoute", () => {
  it("returns the shortest route to the target, excluding the start", () => {
    const open = grid(["....", "....", "...."]);
    const route = planRoute(open, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(route).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("goes around a wall rather than through it", () => {
    const open = grid(["...", ".#.", "..."]);
    const route = planRoute(open, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(route).not.toBeNull();
    expect(route!.some((c: Cell) => c.x === 1 && c.y === 1)).toBe(false);
    expect(route!.at(-1)).toEqual({ x: 2, y: 1 });
    expect(route!.length).toBe(4);
  });

  it("returns null when the target is walled off", () => {
    const open = grid(["..#..", "..#..", "..#.."]);
    expect(planRoute(open, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
  });

  it("returns an empty route when the player is already on the target", () => {
    const open = grid(["..."]);
    expect(planRoute(open, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it("never steps onto a closed cell, including out-of-bounds indices", () => {
    const open = grid(["..", ".#"]);
    const route = planRoute(open, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(route).toEqual([{ x: 1, y: 0 }]);
    expect(planRoute(open, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeNull();
  });
});
