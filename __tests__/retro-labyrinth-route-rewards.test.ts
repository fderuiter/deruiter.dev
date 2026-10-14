// @vitest-environment node
//
// #2084: a run routes through the room library on a seeded map, choosing
// between two next rooms after each room, and picks one of three rewards.
import { describe, expect, it } from "vitest";
import {
  CYBERDECK_CLASSES,
  EMPTY_RUN_BUILD,
  REWARD_HEAL_HP,
  RUN_LOADOUT_SLOTS,
  RUN_PASSIVES,
  applyRunReward,
  chooseRouteRoom,
  createRunSeed,
  describeRouteMap,
  drawRouteOptions,
  drawRunRewards,
  generateRoguelikeCampaign,
  planRoute,
  routeRooms,
  routeRunLength,
  routeTierOf,
  runBuildBonuses,
  runLoadout,
  startRunRoute,
  type DungeonRoom,
  type RunRoute,
} from "@/lib/dungeon";

const library = generateRoguelikeCampaign();
const SEEDS = Array.from({ length: 40 }, (_, i) => createRunSeed(i * 7919));

/** Every route a seed allows, following each option at every step. */
function allRoutes(lib: readonly DungeonRoom[], seed: string): RunRoute[] {
  const done: RunRoute[] = [];
  const walk = (route: RunRoute) => {
    const options = drawRouteOptions(lib, route);
    if (options.length === 0) {
      done.push(route);
      return;
    }
    for (const choice of options) walk(chooseRouteRoom(lib, route, choice));
  };
  walk(startRunRoute(seed));
  return done;
}

/** The option lists a route takes when it always picks the first option. */
function firstPickOptions(seed: string): number[][] {
  let route = startRunRoute(seed);
  const seen: number[][] = [];
  for (;;) {
    const options = drawRouteOptions(library, route);
    if (options.length === 0) return seen;
    seen.push(options);
    route = chooseRouteRoom(library, route, options[0]);
  }
}

describe("Retro Labyrinth route map (#2084)", () => {
  it("keeps the room library in the baseline order of #2048", () => {
    expect(library.map((room) => room.id)).toEqual([
      "dmz_gateway",
      "active_directory",
      "blinkbrowse",
      "tsp",
      "billable_hours",
      "faceforge",
      "neural_warden",
    ]);
  });

  it("sorts the rooms into tiers", () => {
    expect(library.map((room) => routeTierOf(room))).toEqual([
      "opening",
      "opening",
      "middle",
      "middle",
      "rest",
      "boss",
      "boss",
    ]);
  });

  it("plans six rooms: the opening room, three of four middle rooms, two bosses", () => {
    const plan = planRoute(library);
    expect(plan.start).toBe(0);
    expect(plan.middle).toEqual([1, 2, 3, 4]);
    expect(plan.bosses).toEqual([5, 6]);
    expect(plan.middleSteps).toBe(3);
    expect(routeRunLength(library)).toBe(6);
  });

  it("reproduces the same options from the same seed", () => {
    for (const seed of SEEDS) {
      expect(firstPickOptions(seed)).toEqual(firstPickOptions(seed));
      expect(allRoutes(library, seed)).toEqual(allRoutes(library, seed));
    }
  });

  it("draws different options from different seeds", () => {
    const maps = new Set(
      SEEDS.map((seed) =>
        JSON.stringify(allRoutes(library, seed).map((r) => r.path))
      )
    );
    expect(maps.size).toBeGreaterThan(1);
    expect(drawRouteOptions(library, startRunRoute("LAB-AAAAAA"))).not.toEqual(
      drawRouteOptions(library, startRunRoute("LAB-TEST01"))
    );
  });

  it("ends every route on FaceForge then the Neural Warden, with no room twice", () => {
    for (const seed of SEEDS) {
      for (const route of allRoutes(library, seed)) {
        const ids = routeRooms(library, route).map((room) => room.id);
        expect(ids).toHaveLength(6);
        expect(ids[0]).toBe("dmz_gateway");
        expect(ids.slice(-2)).toEqual(["faceforge", "neural_warden"]);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("offers two rooms at each middle step and one at each boss step", () => {
    for (const seed of SEEDS) {
      const counts = firstPickOptions(seed).map((options) => options.length);
      expect(counts).toEqual([2, 2, 2, 1, 1]);
    }
  });

  it("opens the choice with Active Directory against a middle room, keeping the rest stop back", () => {
    const firsts = new Set<string>();
    for (const seed of SEEDS) {
      const options = drawRouteOptions(library, startRunRoute(seed));
      const ids = options.map((i) => library[i].id);
      expect(ids[0]).toBe("active_directory");
      expect(["blinkbrowse", "tsp"]).toContain(ids[1]);
      firsts.add(ids[1]);
    }
    expect(firsts.size).toBe(2);
  });

  it("numbers route rooms by their run position", () => {
    const route = chooseRouteRoom(library, startRunRoute("LAB-TEST01"), 3);
    expect(routeRooms(library, route).map((r) => [r.id, r.index])).toEqual([
      ["dmz_gateway", 1],
      ["tsp", 2],
    ]);
  });

  it("refuses a room that is not on offer", () => {
    expect(() =>
      chooseRouteRoom(library, startRunRoute("LAB-TEST01"), 6)
    ).toThrow(RangeError);
  });

  it("maps cleared, current, choice and ahead steps, naming the bosses ahead", () => {
    const route = chooseRouteRoom(library, startRunRoute("LAB-TEST01"), 1);
    const map = describeRouteMap(library, route);
    expect(map.map((s) => s.state)).toEqual([
      "cleared",
      "current",
      "choice",
      "ahead",
      "ahead",
      "ahead",
    ]);
    expect(map[1].rooms[0].name).toBe("Active Directory");
    expect(map[2].rooms).toHaveLength(2);
    expect(map[3].rooms).toHaveLength(0);
    expect(map[4].rooms.map((r) => r.name)).toEqual(["FaceForge"]);
    expect(map[5].rooms.map((r) => r.name)).toEqual(["Neural Warden"]);
  });

  it("plays a library of repeated rooms as a straight line", () => {
    const room = library[2];
    const line = [room, room, room, room].map((r, i) => ({
      ...r,
      index: i + 1,
    }));
    expect(routeRunLength(line)).toBe(4);
    const routes = allRoutes(line, "LAB-TEST01");
    expect(routes.map((r) => r.path)).toEqual([[0, 1, 2, 3]]);
  });

  it("builds seeds from entropy, and from the crypto source without it", () => {
    expect(createRunSeed(0)).toBe("LAB-000000");
    expect(createRunSeed(123456)).toBe(createRunSeed(123456));
    expect(createRunSeed(1)).not.toBe(createRunSeed(2));
    expect(createRunSeed()).toMatch(/^LAB-[0-9A-HJ-NP-Z]{6}$/);
  });
});

describe("Retro Labyrinth reward pick (#2084)", () => {
  const starter = CYBERDECK_CLASSES.script_kiddie.starterWeapons;

  it("offers a weapon, a heal and a passive, the same for the same seed", () => {
    const offer = drawRunRewards("LAB-TEST01", 0, starter);
    expect(offer.map((r) => r.kind)).toEqual(["weapon", "heal", "passive"]);
    expect(drawRunRewards("LAB-TEST01", 0, starter)).toEqual(offer);
    const weapon = offer[0];
    expect(weapon.kind === "weapon" && weapon.weaponId).toBeTruthy();
    if (weapon.kind === "weapon" && weapon.weaponId) {
      expect(starter).not.toContain(weapon.weaponId);
      expect(weapon.weaponId).not.toBe("emp_blast");
    }
    const heal = offer[1];
    expect(heal.kind === "heal" && heal.hp).toBe(REWARD_HEAL_HP);
  });

  it("varies the offer by seed and by room", () => {
    const offers = new Set(
      SEEDS.flatMap((seed) =>
        [0, 1, 2].map((step) =>
          JSON.stringify(drawRunRewards(seed, step, starter))
        )
      )
    );
    expect(offers.size).toBeGreaterThan(5);
  });

  it("keeps a picked weapon in the loadout for every later room", () => {
    const offer = drawRunRewards("LAB-TEST01", 0, starter);
    let build = applyRunReward(EMPTY_RUN_BUILD, offer[0]);
    const picked = build.bonusWeapons[0];
    expect(runLoadout(starter, build)).toEqual([...starter, picked]);
    // A later heal leaves it in place.
    build = applyRunReward(build, drawRunRewards("LAB-TEST01", 1, starter)[1]);
    expect(runLoadout(starter, build)).toContain(picked);
  });

  it("caps the loadout at five slots and offers a refill when it is full", () => {
    let build = EMPTY_RUN_BUILD;
    for (let step = 0; step < 4; step++) {
      const offer = drawRunRewards(
        "LAB-TEST01",
        step,
        runLoadout(starter, build)
      );
      build = applyRunReward(build, offer[0]);
    }
    const loadout = runLoadout(starter, build);
    expect(loadout).toHaveLength(RUN_LOADOUT_SLOTS);
    const refill = drawRunRewards("LAB-TEST01", 5, loadout)[0];
    expect(refill).toMatchObject({ kind: "weapon", weaponId: null });
    expect(applyRunReward(build, refill)).toBe(build);
  });

  it("stacks passives into the run's bonuses", () => {
    let build = EMPTY_RUN_BUILD;
    for (const id of [
      "overclocked_bus",
      "overclocked_bus",
      "chip_cache",
      "hardened_shell",
      "ram_bank",
    ] as const) {
      build = applyRunReward(build, {
        kind: "passive",
        passiveId: id,
        name: RUN_PASSIVES[id].name,
        description: RUN_PASSIVES[id].description,
      });
    }
    expect(runBuildBonuses(build)).toEqual({
      ramRegen: 2,
      maxHp: 20,
      maxRam: 16,
      chipsPerRoom: 1,
    });
    expect(runBuildBonuses(EMPTY_RUN_BUILD)).toEqual({
      ramRegen: 0,
      maxHp: 0,
      maxRam: 0,
      chipsPerRoom: 0,
    });
  });
});
