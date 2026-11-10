// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  planRoute as planGridRoute,
  type Cell,
} from "@/components/retro-labyrinth/route-plan";
import {
  QUICK_RUN_REWARD_STEP,
  chooseRouteRoom,
  createRunSeed,
  describeRouteMap,
  drawQuickRunRewards,
  drawRouteOptions,
  drawRunRewards,
  generateQuickRunCampaign,
  generateRoguelikeCampaign,
  planRoute,
  startRunRoute,
} from "@/lib/dungeon";

/** A grid from rows of "." (open) and "#" (wall). */
function grid(rows: string[]): boolean[][] {
  return rows.map((row) => [...row].map((ch) => ch === "."));
}

describe("planRoute (grid walk)", () => {
  it("returns the shortest route to the target, excluding the start", () => {
    const open = grid(["....", "....", "...."]);
    const route = planGridRoute(open, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(route).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("goes around a wall rather than through it", () => {
    const open = grid(["...", ".#.", "..."]);
    const route = planGridRoute(open, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(route).not.toBeNull();
    expect(route!.some((c: Cell) => c.x === 1 && c.y === 1)).toBe(false);
    expect(route!.at(-1)).toEqual({ x: 2, y: 1 });
    expect(route!.length).toBe(4);
  });

  it("returns null when the target is walled off", () => {
    const open = grid(["..#..", "..#..", "..#.."]);
    expect(planGridRoute(open, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
  });

  it("returns an empty route when the player is already on the target", () => {
    const open = grid(["..."]);
    expect(planGridRoute(open, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it("never steps onto a closed cell, including out-of-bounds indices", () => {
    const open = grid(["..", ".#"]);
    const route = planGridRoute(open, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(route).toEqual([{ x: 1, y: 0 }]);
    expect(planGridRoute(open, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe("Quick Run route (#3461)", () => {
  const SEEDS = Array.from({ length: 60 }, (_, i) => createRunSeed(i * 7919));

  it("plays DMZ Gateway, one middle room, then FaceForge", () => {
    for (const seed of SEEDS) {
      const library = generateQuickRunCampaign(seed);
      expect(library.map((room) => room.index)).toEqual([1, 2, 3]);
      expect(library[0].id).toBe("dmz_gateway");
      expect(["tsp", "blinkbrowse", "active_directory"]).toContain(
        library[1].id
      );
      expect(library[2].id).toBe("faceforge");
      expect(planRoute(library).length).toBe(3);
    }
  });

  it("draws the middle room from the seed, and every middle room appears", () => {
    const seed = SEEDS[0];
    expect(generateQuickRunCampaign(seed)[1].id).toBe(
      generateQuickRunCampaign(seed)[1].id
    );
    const middles = new Set(
      SEEDS.map((s) => generateQuickRunCampaign(s)[1].id)
    );
    expect(middles).toEqual(
      new Set(["tsp", "blinkbrowse", "active_directory"])
    );
  });

  it("walks the route map one room per step, with no rest stop", () => {
    const library = generateQuickRunCampaign(SEEDS[3]);
    let route = startRunRoute(SEEDS[3]);
    const fullMap = describeRouteMap(generateRoguelikeCampaign(), route);
    const quickMap = describeRouteMap(library, route);
    expect(quickMap).toHaveLength(3);
    expect(Object.keys(quickMap[0]).sort()).toEqual(
      Object.keys(fullMap[0]).sort()
    );
    expect(quickMap.map((step) => step.state)).toEqual([
      "current",
      "choice",
      "ahead",
    ]);
    expect(quickMap[2].rooms.map((room) => room.id)).toEqual(["faceforge"]);
    for (const expected of [1, 2]) {
      const options = drawRouteOptions(library, route);
      expect(options).toEqual([expected]);
      route = chooseRouteRoom(library, route, expected);
    }
    expect(drawRouteOptions(library, route)).toEqual([]);
    expect(
      describeRouteMap(library, route)
        .flatMap((step) => step.rooms)
        .some((room) => room.tier === "rest")
    ).toBe(false);
  });

  it("ends Room 2 with a two-card reward choice instead of three", () => {
    expect(QUICK_RUN_REWARD_STEP).toBe(1);
    for (const seed of SEEDS) {
      const full = drawRunRewards(seed, QUICK_RUN_REWARD_STEP, ["npm_install"]);
      const quick = drawQuickRunRewards(seed, ["npm_install"]);
      expect(full).toHaveLength(3);
      expect(quick).toHaveLength(2);
      expect(quick[0].kind).toBe("heal");
      expect(full).toContainEqual(quick[1]);
      expect(quick[1].kind).not.toBe("heal");
      expect(drawQuickRunRewards(seed, ["npm_install"])).toEqual(quick);
    }
    const kinds = new Set(
      SEEDS.map((seed) => drawQuickRunRewards(seed, ["npm_install"])[1].kind)
    );
    expect(kinds).toEqual(new Set(["weapon", "passive"]));
  });

  it("leaves full runs as they were", () => {
    const library = generateRoguelikeCampaign();
    expect(library.map((room) => room.id)).toEqual([
      "dmz_gateway",
      "active_directory",
      "blinkbrowse",
      "tsp",
      "billable_hours",
      "faceforge",
      "neural_warden",
    ]);
    expect(planRoute(library).length).toBe(6);
  });
});
