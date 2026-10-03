// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CRO_FLOOR,
  DAY_END,
  HARD_STOP,
  ROOM_IDS,
  STATION_IDS,
  WALK_MINUTES_PER_TILE,
  WORLD_MAPS,
  describeSurroundings,
  followRoute,
  getRoom,
  getStation,
  hudReadout,
  interact,
  isBlocked,
  isWalkable,
  newWorld,
  officeDirectory,
  parseWorld,
  placeTeam,
  planRoute,
  roomAt,
  roomConditions,
  serializeWorld,
  startDay,
  step,
  stepFrom,
  targetInFront,
  tileAt,
  type Facing,
  type InteractionOutcome,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed = "floor-1"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

/** Walks a list of steps, failing the test on any refusal. */
function walk(world: WorldState, steps: Facing[]): WorldState {
  let current = world;
  for (const dir of steps) current = expectOk(step(current, dir)).world;
  return current;
}

describe("study director world: the CRO floor", () => {
  it("is a 40 by 22 tile map with every room and station", () => {
    expect(CRO_FLOOR.rows).toHaveLength(22);
    for (const row of CRO_FLOOR.rows) expect(row).toHaveLength(40);
    expect(CRO_FLOOR.rooms.map((r) => r.id)).toEqual([...ROOM_IDS]);
    expect(CRO_FLOOR.stations.map((s) => s.id).sort()).toEqual(
      [...STATION_IDS].sort()
    );
    expect(WORLD_MAPS[CRO_FLOOR.id]).toBe(CRO_FLOOR);
    for (const s of CRO_FLOOR.stations) {
      expect(tileAt(CRO_FLOOR, s.x, s.y)).toBe("station");
      expect(roomAt(CRO_FLOOR, s.x, s.y)?.id).toBe(s.room);
    }
  });

  it("puts every anchor and seat on a free tile inside its room", () => {
    for (const room of CRO_FLOOR.rooms) {
      expect(isWalkable(CRO_FLOOR, room.anchor.x, room.anchor.y)).toBe(true);
      expect(roomAt(CRO_FLOOR, room.anchor.x, room.anchor.y)?.id).toBe(room.id);
      for (const seat of room.seats) {
        expect(isWalkable(CRO_FLOOR, seat.x, seat.y)).toBe(true);
        expect(roomAt(CRO_FLOOR, seat.x, seat.y)?.id).toBe(room.id);
      }
    }
    const spawn = CRO_FLOOR.spawn;
    expect(roomAt(CRO_FLOOR, spawn.x, spawn.y)?.id).toBe("lobby");
  });

  it("treats anything off the map as wall", () => {
    expect(tileAt(CRO_FLOOR, -1, 0)).toBe("wall");
    expect(tileAt(CRO_FLOOR, 40, 5)).toBe("wall");
    expect(tileAt(CRO_FLOOR, 1.5, 1)).toBe("wall");
    expect(isWalkable(CRO_FLOOR, 4, 6)).toBe(true); // a door
  });
});

describe("study director world: collision", () => {
  it("blocks walls, furniture, stations and people, and passes doors", () => {
    expect(isBlocked(CRO_FLOOR, 0, 8)).toBe(true); // wall
    expect(isBlocked(CRO_FLOOR, 2, 2)).toBe(true); // desk
    expect(isBlocked(CRO_FLOOR, 23, 10)).toBe(true); // coffee machine
    expect(isBlocked(CRO_FLOOR, 4, 6)).toBe(false); // door
    expect(isBlocked(CRO_FLOOR, 20, 8, [{ x: 20, y: 8 }])).toBe(true);
  });

  it("turns without moving or spending time when the way is blocked", () => {
    const world = fresh();
    // Walk right to the lobby's east wall and push into it.
    let current = world;
    for (let i = 0; i < 10; i += 1) {
      const result = expectOk(step(current, "right"));
      current = result.world;
      if (!result.moved) break;
    }
    const pushed = expectOk(step(current, "right"));
    expect(pushed.moved).toBe(false);
    expect(pushed.world.player.x).toBe(current.player.x);
    expect(pushed.world.minute).toBe(current.minute);
    const turned = expectOk(step(current, "down"));
    expect(turned.world.player.facing).toBe("down");
  });

  it("does not walk through a person", () => {
    const world = fresh();
    const { x, y } = world.player;
    const blocker = [{ x, y: y - 1 }];
    const result = expectOk(step(world, "up", CRO_FLOOR, blocker));
    expect(result.moved).toBe(false);
    expect(result.world.player).toEqual({ x, y, facing: "up" });
  });

  it("refuses to walk once the study is over", () => {
    const world = fresh();
    const done = { ...world, study: { ...world.study, status: "complete" } };
    expect(step(done as WorldState, "up")).toEqual({
      ok: false,
      reason: "study-complete",
    });
  });
});

describe("study director world: walking time", () => {
  it("costs a quarter of a clock minute per tile, fractionally", () => {
    const world = fresh();
    const one = expectOk(step(world, "up"));
    expect(one.moved).toBe(true);
    expect(one.world.minute).toBe(world.minute + WALK_MINUTES_PER_TILE);
    expect(one.world.walked).toBe(1);
    const four = walk(world, ["up", "up", "left", "left"]);
    expect(four.minute).toBe(world.minute + 1);
  });

  it("costs a point of energy every fortieth tile", () => {
    const world = { ...fresh(), walked: 39 };
    const result = expectOk(step(world, "up"));
    expect(result.world.energy).toBe(world.energy - 1);
    expect(expectOk(step(result.world, "down")).world.energy).toBe(
      result.world.energy
    );
  });

  it("records walking past the office day as overtime and stops at the hard stop", () => {
    const late = { ...fresh(), minute: DAY_END };
    const result = expectOk(step(late, "up"));
    expect(result.world.overtime).toBe(WALK_MINUTES_PER_TILE);
    const stop = { ...fresh(), minute: HARD_STOP };
    expect(step(stop, "up")).toEqual({ ok: false, reason: "too-late" });
  });

  it("tracks which room the player is in", () => {
    const world = fresh();
    const doorway = walk(world, ["up", "up", "up"]); // in the lobby's top door
    expect(doorway.location).toBe("lobby");
    expect(walk(doorway, ["up"]).location).toBe("corridor");
  });
});

describe("study director world: directory pathing", () => {
  const world = fresh();
  const people = placeTeam(world.study);

  it("reaches every directory entry from the lobby", () => {
    for (const entry of officeDirectory(CRO_FLOOR, people)) {
      const route = planRoute(world.player, entry.target, CRO_FLOOR, people);
      expect(route, entry.id).not.toBeNull();
      const walked = expectOk(followRoute(world, route!, CRO_FLOOR, people));
      expect(walked.walkedSteps).toBe(route!.steps.length);
      expect(walked.world.minute).toBeCloseTo(
        world.minute + route!.steps.length * WALK_MINUTES_PER_TILE
      );
      expect(route!.minutes).toBe(route!.steps.length * WALK_MINUTES_PER_TILE);
      const target = entry.target;
      if (target.kind === "room") {
        expect(walked.world.location).toBe(target.room.id);
      } else {
        const front = targetInFront(walked.world, CRO_FLOOR, people);
        expect(front?.kind).toBe(target.kind);
      }
    }
  });

  it("finds the shortest walk to the coffee machine", () => {
    const coffee = getStation(CRO_FLOOR, "coffee")!;
    const route = planRoute(world.player, { kind: "station", station: coffee });
    // Lobby (35,12) up through the door to the corridor, west to the break
    // room door at x=26, down and over to stand right of the machine.
    expect(route?.steps.length).toBe(17);
    expect(route?.facing).toBe("left");
  });

  it("is deterministic and walks nowhere when already there", () => {
    const lobby = getRoom(CRO_FLOOR, "lobby")!;
    const a = planRoute(world.player, { kind: "room", room: lobby });
    expect(a?.steps).toEqual([]);
    const regulatory = getRoom(CRO_FLOOR, "regulatory")!;
    const b = planRoute(world.player, { kind: "room", room: regulatory });
    const c = planRoute(world.player, { kind: "room", room: regulatory });
    expect(b).toEqual(c);
  });

  it("returns null when the target cannot be reached", () => {
    const coffee = getStation(CRO_FLOOR, "coffee")!;
    const walls = [
      { x: 24, y: 10 },
      { x: 23, y: 11 },
    ];
    expect(
      planRoute(
        world.player,
        { kind: "station", station: coffee },
        CRO_FLOOR,
        walls
      )
    ).toBeNull();
  });
});

describe("study director world: people, interaction and description", () => {
  const world = fresh();
  const people = placeTeam(world.study);

  it("places each team member at a desk in their department", () => {
    expect(people).toHaveLength(world.study.team.length);
    const maya = people.find((p) => p.name === "Maya")!;
    expect(maya.room).toBe("dataManagement");
    const spots = new Set(people.map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(people.length);
    for (const p of people) expect(isWalkable(CRO_FLOOR, p.x, p.y)).toBe(true);
  });

  it("lists every room, person and station in the directory", () => {
    const entries = officeDirectory(CRO_FLOOR, people);
    expect(entries).toHaveLength(
      CRO_FLOOR.rooms.length + people.length + CRO_FLOOR.stations.length
    );
    expect(entries.map((e) => e.id)).toContain("station:coffee");
    expect(entries.map((e) => e.id)).toContain("person:maya");
  });

  it("drinks coffee at the coffee machine", () => {
    const coffee = getStation(CRO_FLOOR, "coffee")!;
    const route = planRoute(world.player, { kind: "station", station: coffee });
    const there = expectOk(followRoute(world, route!)).world;
    const tired = { ...there, energy: 50 };
    const outcome = interact(tired);
    expect(outcome?.title).toBe("Coffee machine");
    expect(outcome?.world.coffees).toBe(1);
    expect(outcome?.world.energy).toBe(70);
  });

  it("offers to go home at the car and lets handlers override defaults", () => {
    const car = getStation(CRO_FLOOR, "exit")!;
    const route = planRoute(world.player, { kind: "station", station: car });
    const there = expectOk(followRoute(world, route!)).world;
    expect(interact(there)?.offer).toBe("goHome");
    const custom: InteractionOutcome = {
      world: there,
      title: "Custom",
      lines: [],
      tone: "neutral",
    };
    expect(
      interact(there, CRO_FLOOR, [], { station: { exit: () => custom } })
    ).toBe(custom);
    // A handler that declines falls through to the default.
    expect(
      interact(there, CRO_FLOOR, [], { station: { exit: () => null } })?.offer
    ).toBe("goHome");
  });

  it("talks to the person in front of the player", () => {
    const maya = people.find((p) => p.name === "Maya")!;
    const route = planRoute(
      world.player,
      { kind: "person", person: maya },
      CRO_FLOOR,
      people
    );
    const there = expectOk(followRoute(world, route!, CRO_FLOOR, people)).world;
    expect(interact(there, CRO_FLOOR, people)?.title).toBe("Maya");
    expect(interact(world, CRO_FLOOR, people)).toBeNull();
  });

  it("describes the room, its people and stations, and room condition", () => {
    const text = describeSurroundings(world, CRO_FLOOR, people);
    expect(text).toMatch(/^The lobby/);
    const office = getRoom(CRO_FLOOR, "office")!;
    const inOffice = expectOk(
      followRoute(
        world,
        planRoute(world.player, { kind: "room", room: office })!
      )
    ).world;
    const described = describeSurroundings(inOffice, CRO_FLOOR, people, {
      office: { clutter: 0.5, marks: [] },
    });
    expect(described).toMatch(/EDC workstation and Phone/);
    expect(described).toMatch(/Paper is piling up/);
    expect(roomConditions().office).toEqual({ clutter: 0, marks: [] });
  });

  it("reads budget, timeline and enrollment but no hidden meters", () => {
    const hud = hudReadout(world);
    expect(hud.weekday).toBe("Monday");
    expect(hud.clock).toMatch(/AM$/);
    expect(hud.budget.total).toBe(world.study.setup.budget);
    expect(hud.enrollment.target).toBe(world.study.setup.subjects);
    expect(Object.keys(hud)).not.toContain("integrity");
    expect(Object.keys(hud)).not.toContain("compliance");
    expect(Object.keys(hud)).not.toContain("team");
  });
});

describe("study director world: saves keep the player", () => {
  it("round-trips the position and drops impossible ones", () => {
    const world = {
      ...fresh(),
      player: { x: 20, y: 8, facing: "left" as const },
    };
    expect(parseWorld(serializeWorld(world))?.player).toEqual(world.player);
    const raw = JSON.parse(serializeWorld(world));
    raw.player = { x: 0, y: 0, facing: "sideways" };
    expect(parseWorld(JSON.stringify(raw))?.player).toEqual(CRO_FLOOR.spawn);
    delete raw.player;
    delete raw.walked;
    const legacy = parseWorld(JSON.stringify(raw));
    expect(legacy?.player).toEqual(CRO_FLOOR.spawn);
    expect(legacy?.walked).toBe(0);
    expect(stepFrom({ x: 1, y: 1 }, "down")).toEqual({ x: 1, y: 2 });
  });
});
